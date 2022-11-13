from io import BytesIO
from typing import Dict


class Stimulator:
    def __init__(self):
        pass

    def pulse_type(self) -> str:
        return 'none'

    def update_config(self, config_json: Dict) -> None:
        pass

    def on_stimulation_starting(self) -> None:
        pass

    def emit_next_commands(self) -> Dict[int, BytesIO]:
        return dict()

    def stop_stimulation(self) -> None:
        pass

    def is_done(self) -> bool:
        return True

    def on_stimulation_done(self) -> None:
        pass
