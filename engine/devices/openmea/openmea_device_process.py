import logging
import os
import queue
import re
import threading
import time
from typing import Dict

import psutil

from devices.openmea.biphasic_stimulator import BiphasicStimulator
from devices.openmea.stimulator import Stimulator
from devices.openmea.rsh2116 import rsh2116_set_stim_step_size, STIM_STEP_SIZE_1_uA
from devices.common.ssh_connection import SshConnection
from devices.openmea.wav_stimulator import WavStimulator

ELECTRODES_PER_CHIP = 16

# Rough implementation - stimulation based on a threshold
STIM_ON_ELECTRODE = '(disable)-electrode[0]'
STIM_UPPER_THRESHOLD = 0.001  # Volts
STIM_LOWER_THRESHOLD = -0.0009  # Volts

DEVICE_SCLK_FREQ = 200_000_000.
MAX_SAMPLES_PER_SEC = 40_000.


class OpenMEADeviceProcess:
    def __init__(self, rcv_queue, send_queue, parent_pid, config: Dict):
        self.rcv_queue = rcv_queue
        self.send_queue = send_queue
        self.parent_pid = parent_pid
        self.last_parent_exit_check_time = time.time()
        self.stimulator = Stimulator()
        self.num_chips = len(config['fifo_dev_files'])

        self.stim_step_size_index = STIM_STEP_SIZE_1_uA
        self.max_frequency = 20_000

        self.ssh_connection = SshConnection(config)
        self.last_ssh_connection_check = time.time()
        self.connected = False
        self.initialized_stim = False
        self.is_stimulating = False

        self.device_init_commands = config['device_init_commands']
        self.log = logging.getLogger(__name__)
        self.log.setLevel(logging.INFO)

        # It's convenient for the device to always start in "not connected" state.
        # This makes device switching logic easier.
        self.emit_device_state({'isConnected': False})

    def configure(self, config: Dict):
        if self.stim_step_size_index != config['stimStepSizeIndex']:
            self.stim_step_size_index = config['stimStepSizeIndex']

            if self.connected and self.initialized_stim:
                commands = rsh2116_set_stim_step_size(self.stim_step_size_index)
                self.ssh_connection.exec_same_chip_commands_on_all(commands)
            # else: we'll set this on the first stimulation.

        self.max_frequency = config['maxFrequency']

        pulse_type = config['pulseType']

        if self.stimulator.pulse_type() == pulse_type:
            self.stimulator.update_config(config)
            return

        self.stimulator.on_stimulation_done()

        if pulse_type == 'wav_files':
            self.stimulator = WavStimulator(config)

        elif pulse_type == 'biphasic':
            self.stimulator = BiphasicStimulator(config,
                                                 self.stim_step_size_index,
                                                 self.max_frequency)

    def start_stim(self):
        self.is_stimulating = True
        self.stimulator.on_stimulation_starting()
        self.emit_device_state({'isStimulating': True})

    def stop_stim(self):
        self.stimulator.stop_stimulation()

    def continue_stim(self):
        if (not self.connected) or (not self.is_stimulating):
            return

        if not self.initialized_stim:
            # Pad the init commands with COMMAND_READ_CHIP_ID to align it to 4-command blocks.
            init_commands = rsh2116_set_stim_step_size(self.stim_step_size_index)

            self.ssh_connection.exec_same_chip_commands_on_all(init_commands)
            self.initialized_stim = True

        start_generate = time.time()
        commands = self.stimulator.emit_next_commands()
        self.is_stimulating = not self.stimulator.is_done()
        start_send = time.time()
        self.ssh_connection.exec_chip_commands(commands)
        end = time.time()
        print(f'Generate: {start_send -start_generate }; send: {end-start_send}')

        if not self.is_stimulating:
            self.emit_device_state({'isStimulating': False})

    def exec_device_command(self, command: str):
        self.ssh_connection.exec_device_command(command)
        self.check_and_send_device_state()

    def initialize_device(self):
        num_init_steps = len(self.device_init_commands)
        self.emit_device_state({'initState': 'INITIALIZING',
                                'initStepDone': 0,
                                'numInitSteps': num_init_steps})

        for i in range(num_init_steps):
            command = self.device_init_commands[i]
            self.emit_device_state({'log': command})
            result = self.ssh_connection.exec_ssh(self.device_init_commands[i])
            self.emit_device_state({'initState': 'INITIALIZING',
                                    'initStepDone': i,
                                    'numInitSteps': num_init_steps,
                                    'log': result})

        self.check_and_send_device_state()

    def check_and_send_device_state(self):
        device_state_str = self.ssh_connection.exec_get_device_state()
        if device_state_str is None:
            self.emit_device_state({'isConnected': False})
            return

        match_groups = re.match('([0-9a-f]+),([0-9a-f]+),([0-9]+),([01]),([01])', device_state_str.strip())

        device_state_msg = {'isConnected': True}

        if not match_groups:
            device_state_msg['initState'] = 'NOT_INITIALIZED'

        elif (match_groups.group(4) != "0") or (match_groups.group(3) != "00000002"):
            device_state_msg['initState'] = "INIT_FAILED"

        else:
            device_state_msg['initState'] = 'INITIALIZED'
            device_state_msg['isSampling'] = match_groups.group(5) == "1"

            sample_duration_sclk = int(match_groups.group(2), 16)
            samples_per_sec = DEVICE_SCLK_FREQ / sample_duration_sclk
            device_state_msg['samplesPerSec'] = samples_per_sec
            device_state_msg['isStimulating'] = self.is_stimulating

        self.emit_device_state(device_state_msg)

    def process_message(self, msg: Dict):
        if 'checkDeviceState' in msg:
            self.check_and_send_device_state()

        if 'initializeDevice' in msg:
            self.initialize_device()

        if 'command' in msg:
            self.exec_device_command(msg['command'])

        if 'pulseConfig' in msg:
            self.configure(msg)

        if 'startStim' in msg:
            self.start_stim()

        if 'stopStim' in msg:
            self.stop_stim()

        if 'setSamplingRate' in msg:
            self.set_sampling_rate(msg['setSamplingRate'])

        if 'startSampling' in msg:
            self.exec_device_command('start')

        if 'stopSampling' in msg:
            self.exec_device_command('stop')

    def process_messages(self):
        while True:
            self.exit_if_parent_exists()

            try:
                msg = self.rcv_queue.get_nowait()
                self.process_message(msg)
            except queue.Empty:
                break

    def run_loop(self):
        while True:
            now = time.time()

            if now > (self.last_ssh_connection_check + 5):
                self.last_ssh_connection_check = now
                conn_check_thread = threading.Thread(target=self.run_connection_check)
                conn_check_thread.start()

            self.process_messages()
            self.continue_stim()
            time.sleep(0.001)

    def run_connection_check(self):
        was_connected = self.connected
        self.connected = self.ssh_connection.ensure_connection()

        if not self.connected:
            self.initialized_stim = False

        self.emit_device_state({'isConnected': self.connected})

        if not was_connected and self.connected:
            self.check_and_send_device_state()

    def exit_if_parent_exists(self):
        now = time.time()

        if now <= self.last_parent_exit_check_time + 1:
            return

        self.last_parent_exit_check_time = now

        if self.parent_pid not in psutil.pids():
            os.abort()

    def emit_device_state(self, state):
        self.send_queue.put_nowait({'state': state})

    def set_sampling_rate(self, rate):
        adjusted_rate = min(rate, MAX_SAMPLES_PER_SEC)
        sample_duration_sck = int(round(DEVICE_SCLK_FREQ / adjusted_rate))
        self.exec_device_command(f'sampledur {sample_duration_sck}')


def run_stimulator(rcv_queue, send_queue, parent_pid, config: Dict):
    stimulator = OpenMEADeviceProcess(rcv_queue, send_queue, parent_pid, config)
    stimulator.run_loop()
