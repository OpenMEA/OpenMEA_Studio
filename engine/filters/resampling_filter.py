import math
from typing import Dict

import numpy as np
from scipy.signal import resample_poly

from engine_step import EngineStepConfig, EngineStep


class ResamplingFilterConfig(EngineStepConfig):
    @staticmethod
    def from_json(json: Dict):
        config = ResamplingFilterConfig()
        config.in_sample_rate = json['inSampleRate']
        config.out_sample_rate = json['outSampleRate']

        return config

    def __init__(self):
        super().__init__()
        self.in_sample_rate = 0
        self.out_sample_rate = 0


class ResamplingFilter(EngineStep):
    name = 'ResamplingFilter'

    def __init__(self):
        super().__init__()
        self.filter_is_off = True
        self.in_batch_size = 0
        self.out_batch_size = 0
        self.leftover_samples = np.zeros(0, float)

    def configure(self, config: ResamplingFilterConfig, engine):
        if config.in_sample_rate == config.out_sample_rate:
            self.filter_is_off = True
            return

        self.filter_is_off = False
        gcd_rate = np.gcd(config.in_sample_rate, config.out_sample_rate)

        # Force these results to be ints.
        self.in_batch_size = round(config.in_sample_rate / gcd_rate) * 100
        self.out_batch_size = round(config.out_sample_rate / gcd_rate) * 100

    def do_step(self, data_ndarray):
        if self.filter_is_off:
            self.result = data_ndarray
            return

        if data_ndarray is None or len(data_ndarray) == 0:
            self.result = None
            return

        samples = np.concatenate((self.leftover_samples, data_ndarray))
        num_samples = len(samples)

        num_batches = math.floor(num_samples / self.in_batch_size)
        resampled = None
        to_in_sample = 0

        if num_batches > 0:
            resampled = np.zeros(num_batches * self.out_batch_size, float)
            from_in_sample = 0
            from_out_sample = 0

            for i in range(num_batches):
                to_in_sample = from_in_sample + self.in_batch_size
                to_out_sample = from_out_sample + self.out_batch_size
                in_batch = samples[from_in_sample:to_in_sample]
                resampled[from_out_sample:to_out_sample] = resample_poly(in_batch,
                                                                         self.out_batch_size,
                                                                         self.in_batch_size)

                from_in_sample = to_in_sample
                from_out_sample = to_out_sample

        self.leftover_samples = samples[to_in_sample:]
        self.result = resampled

