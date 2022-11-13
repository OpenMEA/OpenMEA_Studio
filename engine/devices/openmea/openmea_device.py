import multiprocessing
import os
import queue
from typing import Dict

from constants import OPENMEA_NUM_ELECTRODES
from devices.common.udp_data_receiver import UdpDataReceiver
from devices.device import Device
from devices.openmea.openmea_device_process import run_stimulator


DEVICE_PROPS = {
    'name': 'OpenMEA',
    'canControlReplay': False,
    'canControlSampling': True,
    'canRecordToFile': True,
    'canStimulate': True,
    'canSampleDC': True,
    'numElectrodes': OPENMEA_NUM_ELECTRODES,
    'numElectrodeRows': 8,
    'electrodeMap': [
        None, 0x3e, 0x3c, 0x39, 0x36, 0x33, 0x31, None,
        0x02, 0x01, 0x3d, 0x38, 0x37, 0x32, 0x2e, 0x2d,
        0x04, 0x03, 0x00, 0x3a, 0x35, 0x30, 0x2c, 0x2b,
        0x07, 0x06, 0x05, 0x3b, 0x34, 0x2a, 0x29, 0x28,
        0x08, 0x09, 0x0a, 0x14, 0x1b, 0x25, 0x26, 0x27,
        0x0b, 0x0c, 0x10, 0x15, 0x1a, 0x20, 0x23, 0x24,
        0x0d, 0x0e, 0x12, 0x17, 0x18, 0x1d, 0x21, 0x22,
        None, 0x11, 0x13, 0x16, 0x19, 0x1c, 0x1e, None
    ],
    'electrodeExists': [
        False, True, True, True, True, True, True, True, True, True, True, True, True, True, True, True,
        False, True, True, True, True, True, True, True, True, True, True, True, True, True, True, True,
        False, True, True, True, True, True, True, True, True, True, True, True, True, True, True, True,
        False, True, True, True, True, True, True, True, True, True, True, True, True, True, True, True,
    ],
    'electrodeNames': [],
}


def init_electrode_names():
    numRows = int(DEVICE_PROPS['numElectrodeRows'])
    numCols = int(DEVICE_PROPS['numElectrodes'] / DEVICE_PROPS['numElectrodeRows'])
    electrodeNames = [None] * OPENMEA_NUM_ELECTRODES

    for row in range(numRows):
        for col in range(numCols):
            position = row * numCols + col
            electrodeNum = DEVICE_PROPS['electrodeMap'][position]

            if (electrodeNum is None):
                continue

            electrodeName = (col + 1) * 10 + (row + 1)
            electrodeNames[electrodeNum] = f'{electrodeName}'

    DEVICE_PROPS['electrodeNames'] = electrodeNames


class OpenMEADevice(Device):
    name = "OpenMEA"

    def __init__(self, config: Dict):
        super(OpenMEADevice, self).__init__()
        self.rcv_queue = multiprocessing.Queue()
        self.send_queue = multiprocessing.Queue()
        self.udp_data_receiver = UdpDataReceiver([5051, 5052, 5053, 5054], 16, 20, True)
        self.is_closed = False
        self.sent_device_config = False

        # Note that this process's rcv_queue is the child process's send_queue, and vice versa.
        self.device_control_process = \
            multiprocessing.Process(target=run_stimulator,
                                    args=(self.send_queue, self.rcv_queue, os.getpid(), config))
        self.device_control_process.start()

    def num_electrodes(self) -> int:
        return OPENMEA_NUM_ELECTRODES

    def run_command(self, msg: Dict):
        if self.is_closed:
            return

        self.send_queue.put_nowait(msg)

    def collect_updates(self):
        if self.is_closed:
            return {}

        result = {
            'state': [],
            'data': self.udp_data_receiver.collect_data()
        }

        if not self.sent_device_config:
            result['state'].append({'deviceProps': self.get_properties()})
            self.sent_device_config = True

        while True:
            try:
                message = self.rcv_queue.get_nowait()

                if 'state' in message:
                    result['state'].append(message['state'])

            except queue.Empty:
                break

        return result

    def close(self):
        self.is_closed = True
        self.udp_data_receiver.close()
        self.device_control_process.terminate()
        self.device_control_process.join()
        self.device_control_process.close()
        self.rcv_queue.close()
        self.send_queue.close()

    def get_properties(self) -> Dict:
        if len(DEVICE_PROPS['electrodeNames']) == 0:
            init_electrode_names()

        return DEVICE_PROPS



