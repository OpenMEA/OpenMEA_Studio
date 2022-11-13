import math
from io import BytesIO
from typing import Dict

from devices.openmea.stimulator import Stimulator
from devices.openmea.rsh2116 import STIM_STEP_SIZES, \
    rsh2116_write_register, \
    REG_STIM_POLARITY, REG_STIM_ON, COMMAND_READ_CHIP_ID, REG_CHARGE_RECOV_SWITCH, rsh2116_electrode_bit, \
    rsh2116_write_current

ELECTRODES_PER_CHIP = 16


class BiphasicStimulator(Stimulator):
    def __init__(self, config_json: Dict, stim_step_size_index: int, max_freq: int):
        super().__init__()
        self.config = config_json
        self.stim_step_size_index = stim_step_size_index
        self.max_freq = max_freq

    def pulse_type(self):
        return 'biphasic'

    def update_config(self, config_json: Dict):
        self.config = config_json
        self.max_freq = self.config['maxFrequency']
        self.stim_step_size_index = self.config['stimStepSizeIndex']

    def emit_next_commands(self) -> Dict[int, BytesIO]:
        stim_step_size = STIM_STEP_SIZES[self.stim_step_size_index]
        main_electrodes = self.config['electrodesByPulse'][0]
        inverse_electrodes = []
        pulse_config = self.config['pulseConfig']

        num_main = len(main_electrodes)
        num_inverse = len(inverse_electrodes)

        if (num_main == 0) and (num_inverse == 0):
            return dict()

        phase1_current = int(round(pulse_config['phase1Current'] / stim_step_size))

        commands = {0: BytesIO(), 1: BytesIO(), 2: BytesIO(), 3: BytesIO() }
        main_electrode_flags = {0: 0, 1: 0, 2: 0, 3: 0}
        inverse_electrode_flags = {0: 0, 1: 0, 2: 0, 3: 0}
        all_electrode_flags = {0: 0, 1: 0, 2: 0, 3: 0}
        setup_steps_counts = {0: 0, 1: 0, 2: 0, 3: 0}

        chips_used = {0: False, 1: False, 2: False, 3: False}

        # Phase 1 setup
        for electrode in main_electrodes:
            chip_electrode = electrode % ELECTRODES_PER_CHIP
            chip = math.floor(electrode / ELECTRODES_PER_CHIP)
            chips_used[chip] = True

            commands[chip].write(rsh2116_write_current(chip_electrode, phase1_current))
            electrode_bit = rsh2116_electrode_bit(chip_electrode)
            main_electrode_flags[chip] |= electrode_bit
            all_electrode_flags[chip] |= electrode_bit
            setup_steps_counts[chip] += 1

        for electrode in inverse_electrodes:
            chip_electrode = electrode % ELECTRODES_PER_CHIP
            chip = math.floor(electrode / ELECTRODES_PER_CHIP)
            chips_used[chip] = True

            commands[chip].write(rsh2116_write_current(chip_electrode, -phase1_current))
            electrode_bit = rsh2116_electrode_bit(chip_electrode)
            inverse_electrode_flags[chip] |= electrode_bit
            all_electrode_flags[chip] |= electrode_bit
            setup_steps_counts[chip] += 1

        # Make sure that we start stimulating all electrodes together.
        # Note that chip commands have to come in groups of four.
        num_phase1_setup_commands = max(setup_steps_counts.values())

        # Ensure that the commands line up with 4-command blocks, after accounting
        # for the extra two commands farther down.
        extra_pad_commands = (4 - (num_phase1_setup_commands + 2) % 4) % 4
        pad_to_steps = num_phase1_setup_commands + extra_pad_commands

        for chip in commands:
            if not chips_used[chip]:
                continue

            for i in range(setup_steps_counts[chip], pad_to_steps):
                commands[chip].write(COMMAND_READ_CHIP_ID)

        # Trigger Phase 1
        for chip, chip_used in chips_used.items():
            if not chip_used:
                continue

            positive_current_electrodes = \
                main_electrode_flags[chip] if phase1_current > 0 else inverse_electrode_flags[chip]

            commands[chip].write(
                rsh2116_write_register(REG_STIM_POLARITY, positive_current_electrodes))
            commands[chip].write(
                (rsh2116_write_register(REG_STIM_ON, all_electrode_flags[chip], trigger=True)))

        # Set up Phase 2 right away. We'll trigger it later.
        phase2_current = int(round(pulse_config['phase2Current'] / stim_step_size))

        for electrode in main_electrodes:
            chip_electrode = electrode % ELECTRODES_PER_CHIP
            chip = math.floor(electrode / ELECTRODES_PER_CHIP)
            commands[chip].write(rsh2116_write_current(chip_electrode, phase2_current))

        for electrode in inverse_electrodes:
            chip_electrode = electrode % ELECTRODES_PER_CHIP
            chip = math.floor(electrode / ELECTRODES_PER_CHIP)
            commands[chip].write(rsh2116_write_current(chip_electrode, -phase2_current))

        # Wait for the phase to be over and then terminate it.
        phase1_duration_steps = 4 * int(round(pulse_config['phase1Duration'] * float(self.max_freq)))
        pad_phase1_steps = phase1_duration_steps - num_phase1_setup_commands - 2
        pad_phase1_steps = max(2, pad_phase1_steps)

        for i in range(pad_phase1_steps):
            for chip, chip_used in chips_used.items():
                if not chip_used:
                    continue

                commands[chip].write(COMMAND_READ_CHIP_ID)

        # At this point, we're 2 commands short of a 4-command block.
        # We'll add the missing commands while triggering the next phase.

        # Do the interphase, if needed
        interphase_duration_steps = 4 * int(round(pulse_config['interphaseDuration'] * float(self.max_freq)))

        if interphase_duration_steps > 0:
            for chip, chip_used in chips_used.items():
                if not chip_used:
                    continue

                commands[chip].write(COMMAND_READ_CHIP_ID)
                commands[chip].write(rsh2116_write_register(REG_STIM_ON, 0, trigger=True))

                for i in range(interphase_duration_steps):
                    commands[chip].write(COMMAND_READ_CHIP_ID)

        # At this point, we're again 2 commands short of a 4-command block.
        # We'll add the missing commands while triggering the next phase.

        # Trigger Phase 2.
        for chip, chip_used in chips_used.items():
            if not chip_used:
                continue

            positive_current_electrodes = \
                main_electrode_flags[chip] if phase2_current > 0 else inverse_electrode_flags[chip]

            commands[chip].write(
                rsh2116_write_register(REG_STIM_POLARITY, positive_current_electrodes))
            commands[chip].write(
                (rsh2116_write_register(REG_STIM_ON, all_electrode_flags[chip], trigger=True)))

        # Wait for Phase 2 to end and stop it.
        phase2_duration_steps = 4 * int(round(pulse_config['phase2Duration'] * float(self.max_freq)))
        phase2_duration_steps = max(4, phase2_duration_steps)

        for chip, chip_used in chips_used.items():
            if not chip_used:
                continue

            # We subtract 1 to account for the stop stim command at the end.
            for i in range(phase2_duration_steps - 1):
                commands[chip].write(COMMAND_READ_CHIP_ID)

            commands[chip].write(rsh2116_write_register(REG_STIM_ON, 0, trigger=True))

            # Do some charge recovery
            commands[chip].write(rsh2116_write_register(REG_CHARGE_RECOV_SWITCH,
                                                        all_electrode_flags[chip],
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
            commands[chip].write(rsh2116_write_register(REG_CHARGE_RECOV_SWITCH,
                                                        0,
                                                        trigger=True))

        return commands
