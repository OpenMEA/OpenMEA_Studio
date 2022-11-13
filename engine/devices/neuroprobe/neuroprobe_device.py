import multiprocessing
import os
import queue
from typing import Dict

from devices.common.udp_data_receiver import UdpDataReceiver
from devices.device import Device
from devices.neuroprobe.neuroprobe_device_process import run_controller

NEUROPROBE_NUM_ELECTRODES = 18

DEVICE_PROPS = {
    'name': 'Neuroprobe',
    'canControlReplay': False,
    'canControlSampling': True,
    'canRecordToFile': True,
    'canStimulate': True,
    'canSampleDC': False,
    'numElectrodes': NEUROPROBE_NUM_ELECTRODES,
    'numElectrodeRows': 9,
    'electrodeMap': [
        17, 0,
        8, 9,
        16, 1,
        7, 10,
        15, 2,
        6, 11,
        14, 3,
        5, 12,
        13, 4,
    ],
    'electrodeExists': [
        True, True, True, True, True, True, True, True, True,
        True, True, True, True, True, True, True, True, True
    ],
    'electrodeNames': [
        '8', '9', '10', '11', '12', '13', '14', '15', '16',
        '17', '18', '19', '20', '21', '22', '23', '24', '25',
    ],
}

class NeuroprobeDevice(Device):
    name = "Neuroprobe"

    def __init__(self, config: Dict):
        super(NeuroprobeDevice, self).__init__()
        self.rcv_queue = multiprocessing.Queue()
        self.send_queue = multiprocessing.Queue()
        self.udp_data_receiver = UdpDataReceiver([5052], NEUROPROBE_NUM_ELECTRODES, 20, False)
        self.is_closed = False
        self.sent_device_config = False

        # Note that this process's rcv_queue is the child process's send_queue, and vice versa.
        self.device_control_process = \
            multiprocessing.Process(target=run_controller,
                                    args=(self.send_queue, self.rcv_queue, os.getpid(), config))
        self.device_control_process.start()

    def num_electrodes(self) -> int:
        return NEUROPROBE_NUM_ELECTRODES

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
        return DEVICE_PROPS


