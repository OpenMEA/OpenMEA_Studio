from typing import Dict

all_openmea_modules = []


def register_openmea_module(openmea_module):
    all_openmea_modules.append(openmea_module)


class OpenMEAModule:
    def __init__(self):
        # Must always define a name.
        # Convention: the module name should be a short, capitalized, human readable name.
        # Avoid replacing spaces with dashes or underscores.
        # E.g. use 'Calcium imaging' instead of 'calcium_imaging'.
        self.name = '<Set module name in subclass>'

    def handle_command(self, command_json: Dict):
        pass

    def do_step(self):
        pass
