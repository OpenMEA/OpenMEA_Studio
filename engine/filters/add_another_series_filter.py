from typing import Dict, Optional

from engine_step import EngineStepConfig, EngineStep
from stores.data_buffer import DataBuffer


class AddAnotherSeriesFilterConfig(EngineStepConfig):
    @staticmethod
    def from_json(json: Dict):
        config = AddAnotherSeriesFilterConfig()
        config.other_series_name = json['addSeriesName']
        config.this_series_factor = json['thisSeriesFactor']
        config.other_series_factor = json['otherSeriesFactor']

        return config

    def __init__(self):
        super().__init__()
        self.other_series_name = ''
        self.this_series_factor = 0
        self.other_series_factor = 0


class AddAnotherSeriesFilter(EngineStep):
    name = 'AddAnotherSeriesFilter'

    def __init__(self):
        super().__init__()

        # Comb filter parameters.
        self.other_series_engine_step: Optional[EngineStep] = None
        self.this_series_factor = 0
        self.other_series_factor = 0

    def configure(self, config: AddAnotherSeriesFilterConfig, engine):
        self.this_series_factor = config.this_series_factor
        self.other_series_factor = config.other_series_factor
        self.other_series_engine_step = engine.get_published_step(config.other_series_name)

    def do_step(self, data_ndarray):
        if (data_ndarray is None) or (len(data_ndarray) == 0):
            self.result = None
            return

        other_series = self.other_series_engine_step.result

        if type(self.other_series_engine_step) is DataBuffer:
            other_series = self.other_series_engine_step.get_cache()

        num_to_include = min(len(data_ndarray), len(other_series))

        self.result = data_ndarray[-num_to_include:] * self.this_series_factor + \
                      other_series[-num_to_include:] * self.other_series_factor


