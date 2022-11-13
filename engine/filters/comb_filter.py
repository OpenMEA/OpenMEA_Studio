import math
from typing import Dict

import numpy as np
from scipy.signal import iircomb

from engine_step import EngineStepConfig, EngineStep


class CombFilterConfig(EngineStepConfig):
    @staticmethod
    def from_json(json: Dict):
        config = CombFilterConfig()
        config.samples_per_sec = json['samplesPerSec']
        config.freq = json['freq']
        config.q_factor = json['qFactor']

        return config

    def __init__(self):
        super().__init__()
        self.samples_per_sec = 0
        self.freq = 0
        self.q_factor = 0


class CombFilter(EngineStep):
    name = 'CombFilter'

    def __init__(self):
        super().__init__()

        # Comb filter parameters.
        self.b0 = 0
        self.bN = 0
        self.aN = 0
        self.N = 0

        self.leftover_in = None
        self.prev_in = None
        self.prev_out = None

    def configure(self, config: CombFilterConfig, engine):
        if config.freq is None or config.freq == 0:
            self.b0 = 0
            self.bN = 0
            self.aN = 0
            self.N = 0
            return

        # Set up the comb filter.
        comb_b, comb_a = iircomb(config.freq, config.q_factor, fs=config.samples_per_sec)

        self.b0 = comb_b[0]
        self.bN = comb_b[-1]
        self.aN = comb_a[-1]
        self.N = round(config.samples_per_sec / config.freq)

        self.leftover_in = np.zeros(0, float)
        self.prev_in = np.zeros(self.N, float)
        self.prev_out = np.zeros(self.N, float)

    def do_step(self, data_ndarray):
        if data_ndarray is None or len(data_ndarray) == 0:
            self.result = None
            return

        if self.N == 0:
            # The filter is off
            self.result = data_ndarray
            return

        samples = np.concatenate((self.leftover_in, data_ndarray))
        num_batches = math.floor(len(samples) / self.N)

        if num_batches == 0:
            self.leftover_in = samples
            self.result = None
            return

        result = np.zeros(num_batches * self.N, float)
        to_sample = 0

        for i in range(num_batches):
            from_sample = i * self.N
            to_sample = from_sample + self.N
            result[from_sample:to_sample] = samples[from_sample:to_sample] * self.b0 + \
                                            self.prev_in * self.bN - \
                                            self.prev_out * self.aN

            self.prev_in = samples[from_sample:to_sample]
            self.prev_out = result[from_sample:to_sample]

        self.leftover_in = samples[to_sample:]
        self.result = result
