from typing import Dict

from engine_step import EngineStepConfig, EngineStep


class RescalingFilterConfig(EngineStepConfig):
    @staticmethod
    def from_json(json: Dict):
        config = RescalingFilterConfig()
        config.offset = json['offset']
        config.multiplier = json['multiplier']

        return config

    def __init__(self):
        super().__init__()
        self.offset = 0
        self.multiplier = 1


class RescalingFilter(EngineStep):
    name = 'RescalingFilter'

    def __init__(self):
        super().__init__()
        self.config = RescalingFilterConfig()

    def configure(self, config: RescalingFilterConfig, engine):
        self.config = config

    def do_step(self, data_ndarray):
        if (data_ndarray is None) or (len(data_ndarray) == 0):
            self.result = None
            return

        result = data_ndarray.astype(float)
        result += self.config.offset
        result *= self.config.multiplier
        self.result = result
