import logging
import os
import queue
import re
import threading
import time
from typing import Dict

import psutil

from devices.common.ssh_connection import SshConnection

DEVICE_SCLK_FREQ = 200_000_000.
MAX_SAMPLES_PER_SEC = 40_000.


class NeuroprobeDeviceProcess:
    def __init__(self, rcv_queue, send_queue, parent_pid, config: Dict):
        self.rcv_queue = rcv_queue
        self.send_queue = send_queue
        self.parent_pid = parent_pid
        self.last_parent_exit_check_time = time.time()

        self.ssh_connection = SshConnection(config)
        self.last_ssh_connection_check = time.time()
        self.connected = False

        self.device_init_commands = config['device_init_commands']
        self.log = logging.getLogger(__name__)
        self.log.setLevel(logging.INFO)

        # It's convenient for the device to always start in "not connected" state.
        # This makes device switching logic easier.
        self.emit_device_state({'isConnected': False})

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

        match_groups = \
            re.match('([0-9a-f]+),([0-9a-f]+),([01]),([01]),([01]),([01]),([01]),([01]),([0-9a-f]+),([01]),([01])',
                     #                                                     rdh_SampleDur^ rhd_BootFailed^   ^rhd_SampleActive
                     device_state_str.strip())

        device_state_msg = {'isConnected': True}

        if not match_groups:
            device_state_msg['initState'] = 'NOT_INITIALIZED'

        elif (match_groups.group(10) != "0"):  # or (match_groups.group(3) != "00000002"):
            device_state_msg['initState'] = "INIT_FAILED"

        else:
            device_state_msg['initState'] = 'INITIALIZED'
            device_state_msg['isSampling'] = match_groups.group(11) == "1"

            # FIXME: get sampledur position from Rakshith
            sample_duration_sclk = int(match_groups.group(9), 16)
            samples_per_sec = DEVICE_SCLK_FREQ / sample_duration_sclk
            device_state_msg['samplesPerSec'] = samples_per_sec

        self.emit_device_state(device_state_msg)

    def process_message(self, msg: Dict):
        if 'checkDeviceState' in msg:
            self.check_and_send_device_state()

        if 'initializeDevice' in msg:
            self.initialize_device()

        if 'command' in msg:
            self.exec_device_command(msg['command'])

        if 'setSamplingRate' in msg:
            self.set_sampling_rate(msg['setSamplingRate'])

        if 'startSampling' in msg:
            self.exec_device_command('rhd_sample_en')

        if 'stopSampling' in msg:
            self.exec_device_command('rhd_sample_dis')


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
            time.sleep(0.001)

    def run_connection_check(self):
        was_connected = self.connected
        self.connected = self.ssh_connection.ensure_connection()

        if not was_connected and self.connected:
            self.check_and_send_device_state()

        else:
            self.emit_device_state({'isConnected': self.connected})

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
        self.exec_device_command(f'rhd_sample_dur {sample_duration_sck}')


def run_controller(rcv_queue, send_queue, parent_pid, config: Dict):
    stimulator = NeuroprobeDeviceProcess(rcv_queue, send_queue, parent_pid, config)
    stimulator.run_loop()
