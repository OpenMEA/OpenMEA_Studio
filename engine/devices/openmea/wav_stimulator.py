import logging
import math
import time
import wave
from io import BytesIO
from typing import Dict, List, Optional

from devices.openmea.rsh2116 import rsh2116_electrode_bit, COMMAND_READ_CHIP_ID, rsh2116_write_register, REG_STIM_ON, \
    REG_CHARGE_RECOV_SWITCH, rsh2116_write_current, REG_STIM_POLARITY
from devices.openmea.stimulator import Stimulator

EMIT_AHEAD_SEC = 3
ELECTRODES_PER_CHIP = 16


class WavStimulator(Stimulator):
    def __init__(self, config: Dict):
        super(WavStimulator, self).__init__()
        self.log = logging.getLogger(__name__)
        self.log.setLevel(logging.INFO)

        self.config = None
        self.max_freq = 0

        self.file_paths = []
        self.files: List[Optional[wave.Wave_read]] = []

        self.emit_start_time = 0
        self.prev_emit_time = 0
        self.frames_emitted = 0
        self.is_done_emitting = True
        self.stop_requested = False

        self.electrodes_by_file: List[List[int]] = []
        self.all_electrode_flags: Dict[int, int] = {}
        self.num_electrodes_per_chip: Dict[int, int] = {}
        self.pad_commands: Dict[int, int] = {}
        self.chips_used: List[int] = []
        self.loop_forever = False

        self.update_config(config)

    def pulse_type(self):
        return 'wav_files'

    def update_config(self, config: Dict):
        self.on_stimulation_done()

        self.config = config
        self.max_freq = config['maxFrequency']
        self.file_paths = config['pulseConfig']['filePaths']
        self.electrodes_by_file = config['electrodesByPulse']
        self.loop_forever = config['loopForever']

    def on_stimulation_starting(self) -> None:
        # Open the .wav files
        for file in self.files:
            if file is not None:
                file.close()

        self.files = []

        for file_path in self.file_paths:
            self.files.append(wave.open(file_path, 'rb'))

        # Initialize the overall state
        self.emit_start_time = 0
        self.frames_emitted = 0
        self.is_done_emitting = False
        self.stop_requested = False

        # Pre-calculate some useful values and gather some stats
        # on the electrodes that we'll need to stimulate.
        self.all_electrode_flags: Dict[int, int] = {0: 0, 1: 0, 2: 0, 3: 0}
        self.num_electrodes_per_chip: Dict[int, int] = {0: 0, 1: 0, 2: 0, 3: 0}

        for electrodes in self.electrodes_by_file:
            for electrode in electrodes:
                chip_electrode = electrode % ELECTRODES_PER_CHIP
                chip = math.floor(electrode / ELECTRODES_PER_CHIP)
                self.num_electrodes_per_chip[chip] += 1

                electrode_bit = rsh2116_electrode_bit(chip_electrode)
                self.all_electrode_flags[chip] |= electrode_bit

        self.chips_used = [k for k, v in self.num_electrodes_per_chip.items() if v > 0]

        if len(self.chips_used) == 0:
            self.is_done_emitting = True
            return

        # Figure out how many pad commands we'll have to add for each chip
        # in order to have each wav frame line up with 4-command blocks.
        # Don't forget an extra command for setting the stim polarities.
        max_chip_commands = max(self.num_electrodes_per_chip.values()) + 1
        pad_to_multiple_of_4 = (4 - (max_chip_commands % 4)) % 4
        pad_to_commands = max_chip_commands + pad_to_multiple_of_4

        for chip in self.chips_used:
            self.pad_commands[chip] = pad_to_commands - self.num_electrodes_per_chip[chip] - 1

    def emit_next_commands(self) -> Dict[int, BytesIO]:
        if self.is_done_emitting:
            return {}

        now = time.time()
        commands = {0: BytesIO(), 1: BytesIO(), 2: BytesIO(), 3: BytesIO(), }

        if self.emit_start_time == 0:
            # Initialize everything
            self.emit_start_time = now
            self.prev_emit_time = now

            # Turn on all the electrodes we'll use, but don't trigger them yet.
            # We'll have to make sure to line up all commands on 4-command borders.
            for chip in self.chips_used:
                commands[chip].write(COMMAND_READ_CHIP_ID)
                commands[chip].write(COMMAND_READ_CHIP_ID)
                commands[chip].write(COMMAND_READ_CHIP_ID)
                commands[chip].write(
                    rsh2116_write_register(REG_STIM_ON, self.all_electrode_flags[chip]))

        if self.stop_requested:
            self.is_done_emitting = True
            return self._turn_off_electrodes()

        # Read the next set of .wav file frames
        emit_to_time = now + EMIT_AHEAD_SEC
        should_be_at_frames = round((emit_to_time - self.emit_start_time) * float(self.max_freq))
        num_frames_to_emit = should_be_at_frames - self.frames_emitted

        frames: List[bytes] = []
        max_frames_read = 0

        for i in range(len(self.files)):
            file = self.files[i]
            if file is None:
                frames.append(b'')
                continue

            file_frames = file.readframes(num_frames_to_emit)
            num_frames_read = len(file_frames)

            if num_frames_read < num_frames_to_emit:
                if self.loop_forever:
                    file.rewind()
                    file_frames += file.readframes(num_frames_to_emit - num_frames_read)
                    max_frames_read = num_frames_to_emit

                else:
                    file.close()
                    self.files[i] = None
                    max_frames_read = max(max_frames_read, num_frames_read)

            else:
                max_frames_read = num_frames_to_emit

            frames.append(file_frames)

        # Is this the end?
        will_be_done = False

        if max_frames_read < num_frames_to_emit:
            will_be_done = True
            num_frames_to_emit = max_frames_read

        # Print some stats
        delay = now - self.prev_emit_time
        # self.log.info(f'Delay: {delay}; emitting {len(values)} frames')
        print(f'Delay: {delay}; emitting {num_frames_to_emit} frames')

        # Generate Intan chip commands from .wav frames
        for frame_num in range(num_frames_to_emit):
            pos_electrodes_flags = {0: 0, 1: 0, 2: 0, 3: 0}

            # Translate .wav levels into file commands
            for file_num in range(len(self.files)):
                value = 0

                if frame_num < len(frames[file_num]):
                    value = frames[file_num][frame_num] - 128

                for electrode in self.electrodes_by_file[file_num]:
                    chip_electrode = electrode % ELECTRODES_PER_CHIP
                    chip = math.floor(electrode / ELECTRODES_PER_CHIP)
                    commands[chip].write(rsh2116_write_current(chip_electrode, value))

                    if value >= 0:
                        electrode_bit = rsh2116_electrode_bit(chip_electrode)
                        pos_electrodes_flags[chip] |= electrode_bit

            for chip in self.chips_used:
                # Pad to a multiple of 4 commands, and to align the frames together
                # on different chips.
                for i in range(self.pad_commands[chip]):
                    commands[chip].write(COMMAND_READ_CHIP_ID)

                # Stim!
                commands[chip].write(
                    rsh2116_write_register(REG_STIM_POLARITY,
                                           pos_electrodes_flags[chip],
                                           trigger=True))

        # If we're done, end the stimulation.
        if will_be_done:
            self.is_done_emitting = True
            self._turn_off_electrodes(commands)

        self.frames_emitted = should_be_at_frames
        self.prev_emit_time = now
        return commands

    def is_done(self) -> bool:
        return self.is_done_emitting

    def on_stimulation_done(self) -> None:
        self.emit_start_time = 0
        for file in self.files:
            if file is not None:
                file.close()

        self.files = []

    def stop_stimulation(self) -> None:
        self.stop_requested = True

    def _turn_off_electrodes(self, commands: Dict[int, BytesIO] = None) -> Dict[int, BytesIO]:
        if commands is None:
            commands = {}

            for chip in self.chips_used:
                commands[chip] = BytesIO()

        for chip in self.chips_used:
            commands[chip].write(COMMAND_READ_CHIP_ID)
            commands[chip].write(COMMAND_READ_CHIP_ID)
            commands[chip].write(COMMAND_READ_CHIP_ID)
            commands[chip].write(rsh2116_write_register(REG_STIM_ON, 0, trigger=True))

            # Do some charge recovery
            commands[chip].write(rsh2116_write_register(REG_CHARGE_RECOV_SWITCH,
                                                        self.all_electrode_flags[chip],
                                                        trigger=True))
            commands[chip].write(COMMAND_READ_CHIP_ID)
            commands[chip].write(COMMAND_READ_CHIP_ID)
            commands[chip].write(COMMAND_READ_CHIP_ID)

            commands[chip].write(COMMAND_READ_CHIP_ID)
            commands[chip].write(COMMAND_READ_CHIP_ID)
            commands[chip].write(COMMAND_READ_CHIP_ID)
            commands[chip].write(COMMAND_READ_CHIP_ID)

            commands[chip].write(COMMAND_READ_CHIP_ID)
            commands[chip].write(COMMAND_READ_CHIP_ID)
            commands[chip].write(COMMAND_READ_CHIP_ID)
            commands[chip].write(rsh2116_write_register(REG_CHARGE_RECOV_SWITCH, 0, trigger=True))

        return commands
