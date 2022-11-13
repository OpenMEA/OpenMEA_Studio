import asyncio
import logging
import time
import uuid
from typing import List, Dict

from devices.device import Device
from devices.neuroprobe.neuroprobe_device import NeuroprobeDevice
from devices.nwb_file.nwb_file_device import NwbFileDevice
from engine_pipeline import EnginePipeline
from engine_step import EngineStep
from devices.openmea.openmea_device import OpenMEADevice
from stores.data_buffer import DataBuffer
from openmea_module import OpenMEAModule, all_openmea_modules
from util import electrode_name
from websocket_streams import WebsocketStreams

STEPS_PER_SEC = 120


class Engine:
    def __init__(self, stream_sender: WebsocketStreams, config: Dict):
        self.config = config

        self.pipelines_by_id: Dict[uuid.UUID, EnginePipeline] = dict()
        self.steps_by_id: Dict[uuid.UUID, EngineStep] = dict()
        self.published_steps: Dict[str, EngineStep] = dict()
        self.modules: Dict[str, OpenMEAModule] = dict()
        self.stream_sender: WebsocketStreams = stream_sender
        self.next_step_time = time.time() + 1 / STEPS_PER_SEC
        self.logger = logging.getLogger(__name__)
        self.device: Device = Device()

        self.count = 0

    def initialize(self):
        self.published_steps.clear()

        for i in range(0, self.device.num_electrodes()):
            self.published_steps[electrode_name(i, 'ac')] = DataBuffer()
            self.published_steps[electrode_name(i, 'dc')] = DataBuffer()

        self.published_steps['electrodes'] = EngineStep()

        # Load the modules.
        # for openmea_module in all_openmea_modules:
        #     module_instance = openmea_module()
        #     self.modules[module_instance.name] = module_instance

    async def do_step(self):
        message = dict()

        # Collect the data from the device
        updates = self.device.collect_updates()

        if updates is not None:
            if 'state' in updates and len(updates['state']) > 0:
                message['deviceState'] = updates['state']

        for key in self.published_steps.keys():
            self.published_steps[key].result = None

        if 'was_reset' in updates and updates['was_reset']:
            if 'deviceState' not in message:
                message['deviceState'] = []

            message['deviceState'].append({'lastResetTime': time.time()})

            for i in range(0, self.device.num_electrodes()):
                if electrode_name(i, 'ac') in self.published_steps:
                    self.published_steps[electrode_name(i, 'ac')].clear()
                else:
                    self.published_steps[electrode_name(i, 'ac')] = DataBuffer()

                if electrode_name(i, 'dc') in self.published_steps:
                    self.published_steps[electrode_name(i, 'dc')].clear()
                else:
                    self.published_steps[electrode_name(i, 'dc')] = DataBuffer()

        self.published_steps['electrodes'].result = updates['data']

        for key, data in updates['data'].items():
            step = self.published_steps[key]

            if type(step) is DataBuffer:
                step.add_data(data)
            else:
                step.result = data

        # Run the pipelines
        for pipeline in self.pipelines_by_id.values():
            result = pipeline.do_step()

            if result is not None:
                # Python can't convert ndarrays to JSON. Need to convert them to
                # List to allow that.
                message[str(pipeline.id)] = result.tolist()

        await self.stream_sender.send_general(message)

        for openmea_module in self.modules.values():
            result = openmea_module.do_step()

            if result is not None:
                await self.stream_sender.send_module_message(openmea_module.name, result)

    async def run(self):
        prev_time = 0

        while True:
            self.count += 1

            await self.do_step()

            # Sleep until the next step
            now = time.time()

            # print(f'step cycle: {now - prev_time}')
            prev_time = now

            this_step_scheduled_time = self.next_step_time
            next_step_time = max(this_step_scheduled_time + 1 / STEPS_PER_SEC, now)
            sleep_sec = next_step_time - now
            self.next_step_time = next_step_time
            await asyncio.sleep(sleep_sec)

    def add_pipeline(self, steps: List[EngineStep]):
        pipeline = EnginePipeline(steps)
        self.pipelines_by_id[pipeline.id] = pipeline

        return pipeline.id

    def delete_pipeline(self, id):
        self.pipelines_by_id[id].finalize()
        del self.pipelines_by_id[id]

    def get_published_step(self, name: str):
        if name in self.published_steps:
            return self.published_steps[name]
        else:
            raise EngineException(f'Could not find published step named "{name}"')

    def handle_module_command(self, module_name: str, command_json: Dict):
        if module_name not in self.modules:
            raise ModuleNotFoundException(module_name)

        self.modules[module_name].handle_command(command_json)

    def handle_device_command(self, msg: Dict):
        self.device.run_command(msg)

    def connect_to_device(self, device_name):
        # Figure out the new device type
        new_device_type = None
        device_config = None

        if device_name == OpenMEADevice.name:
            if self.device.__class__ != OpenMEADevice:
                new_device_type = OpenMEADevice
                device_config = self.config['openmea']

        elif device_name == NwbFileDevice.name:
            if self.device.__class__ != NwbFileDevice:
                new_device_type = NwbFileDevice
                device_config = self.config['openmea']

        elif device_name == NeuroprobeDevice.name:
            if self.device.__class__ != NeuroprobeDevice:
                new_device_type = NeuroprobeDevice
                device_config = self.config['neuroprobe']

        else:
            raise EngineException(f'Unknown device name: {device_name}')

        if new_device_type is None:
            return

        if self.device is not None:
            self.device.close()

        # Reset all data caches
        self.device = new_device_type(device_config)
        self.initialize()


class EngineException(Exception):
    def __init__(self, message):
        self.message = message


class ModuleNotFoundException(Exception):
    def __init__(self, module_name):
        self.message = f"Could not find module '{module_name}'"
