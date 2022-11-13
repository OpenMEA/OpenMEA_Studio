from typing import Dict

from openmea_module import OpenMEAModule, register_openmea_module


class StimModule(OpenMEAModule):
    def __init__(self):
        super().__init__()
        self.name = 'Stim'

        self.step_num = 0

    def handle_command(self, command_json: Dict):
        # No configuration needed here
        pass

    def do_step(self):
        self.step_num += 1
        return self.step_num


register_openmea_module(StimModule)

