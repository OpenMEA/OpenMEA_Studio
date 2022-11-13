import math
from typing import Dict

import numpy as np

from engine_step import EngineStep, EngineStepConfig


class SpectrogramFilterConfig(EngineStepConfig):
    @staticmethod
    def from_json(json: Dict):
        return SpectrogramFilterConfig(json['samplesPerSec'], json['calculationPeriod'], json['maxFreq'])

    def __init__(self, samples_per_sec: float, calculation_period: float, max_freq: int):
        super().__init__()
        self.samples_per_sec = samples_per_sec
        self.calculation_period = calculation_period
        self.max_freq = max_freq


class SpectrogramFilter(EngineStep):
    name = 'SpectrogramFilter'

    def __init__(self):
        super().__init__()

        self.samples_per_period = 0
        self.num_frequencies = 0
        self.sqrt_bandwidth = 0

        # Current state
        self.was_reset = False
        self.leftover_samples = np.zeros(0, float)

    def configure(self, config: SpectrogramFilterConfig, engine):
        self.samples_per_period = round(config.samples_per_sec * config.calculation_period)

        # Multiplying by calculation_period is the same as dividing by
        # minimum frequency = 1/calculation_period.
        # Then we add +1 to make space for 0 Hz frequency.
        self.num_frequencies = math.floor(config.max_freq * config.calculation_period) + 1
        self.sqrt_bandwidth = math.sqrt(1 / config.calculation_period)

    def do_step(self, data_ndarray):
        if (data_ndarray is None) or (len(data_ndarray) == 0):
            self.result = None
            return

        samples = np.concatenate((self.leftover_samples, data_ndarray))
        num_samples = len(samples)

        num_periods = math.floor(num_samples / self.samples_per_period)
        spectrogram = None
        to_sample = 0

        if num_periods > 0:
            spectrogram = np.zeros(self.num_frequencies * num_periods)
            from_sample = 0

            for i in range(num_periods):
                to_sample = from_sample + self.samples_per_period
                fft = np.fft.rfft(samples[from_sample:to_sample], norm='forward')

                result_from = i * self.num_frequencies
                result_to = result_from + self.num_frequencies
                spectrogram[result_from:result_to] = np.abs(fft[:self.num_frequencies])
                spectrogram[result_from:result_to] /= self.sqrt_bandwidth
                from_sample = to_sample

        self.leftover_samples = samples[to_sample:]
        self.result = spectrogram




