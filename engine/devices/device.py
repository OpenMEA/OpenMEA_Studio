from typing import Dict


class Device:
    def run_command(self, msg: Dict):
        pass

    def collect_updates(self):
        return {
            'data': {}
        }

    def close(self):
        pass

    def num_electrodes(self) -> int:
        return 0

    def get_properties(self) -> Dict:
        return {}