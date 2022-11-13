import math
import time
from typing import Dict

import numpy as np

from engine_step import EngineStep, EngineStepConfig


class SubsamplingFilterConfig(EngineStepConfig):
    @staticmethod
    def from_json(json: Dict):
        return SubsamplingFilterConfig(json['samplesPerSec'], json['maxSubsamples'], json['windowLengthSec'])

    def __init__(self, samples_per_sec: float = 0, max_subsamples: int = 0, window_length_sec: float = 0):
        super().__init__()
        self.samples_per_sec = samples_per_sec
        self.max_subsamples = max_subsamples
        self.window_length_sec = window_length_sec


class SubsamplingFilter(EngineStep):
    """
    `SubsamplingFilter` calculates the minimum and maximum value for each
    `sample_rate` samples, and returns an array `[min1, max1, min2, max2, ...]`
    where `minN`, `maxN` are min and max values for the Nth subsampling window.

    This is not a typical subsampling algorithm; this is done to make sure that the
    UI can plot the full range of the signal and not accidentally hide any
    peaks or troughs.

    Note that `subsample_rate` doesn't have to be an integer. If it isn't,
    `SubsamplingFilter` tries to periodically include a 'leap' sample in the subsampling
    window to account for the fractional value of `subsample_rate`.
    """
    name = 'SubsamplingFilter'

    def __init__(self):
        super().__init__()

        self.max_subsamples = 0
        self.subsample_rate = 0
        self.config = None
        self.was_reset = False

        # This number might not be an integer if the sampling rate is not an integer
        self.leftover_sample_fraction = 0
        self.leftover_samples = np.zeros(0, float)

    def configure(self, config: SubsamplingFilterConfig, engine) -> None:
        self.max_subsamples = config.max_subsamples
        self.config = config
        num_samples_in_window = config.samples_per_sec * config.window_length_sec
        self.subsample_rate = 2 * num_samples_in_window / self.max_subsamples

        self.was_reset = True

        self.leftover_sample_fraction = 0
        self.leftover_samples = np.zeros(0, float)

    def do_step(self, data_ndarray):
        if (data_ndarray is None) or (len(data_ndarray) == 0):
            self.result = None
            return

        # Note: this can be float.
        samples = np.concatenate((self.leftover_samples, data_ndarray))
        num_samples = len(samples)
        samples_available_for_subsampling = num_samples - self.leftover_sample_fraction

        num_subsamples = math.floor(samples_available_for_subsampling / self.subsample_rate)
        total_samples_subsampled = 0
        subsamples = None
        to_sample = 0
        leftover_sample_fraction = self.leftover_sample_fraction

        if num_subsamples > 0:
            subsamples = np.zeros(num_subsamples * 2, float)
            from_sample = 0

            for i in range(num_subsamples):
                # Note that self.subsample_rate is a float. If it has a non-integer value,
                # we need to correctly include an extra 'leap' subsample every once in a while.
                should_include_samples = leftover_sample_fraction + self.subsample_rate
                actual_included_samples = math.floor(should_include_samples)
                to_sample = from_sample + actual_included_samples

                min_value = np.amin(samples[from_sample:to_sample])
                max_value = np.amax(samples[from_sample:to_sample])

                subsamples[2*i] = min_value
                subsamples[2*i + 1] = max_value

                total_samples_subsampled += actual_included_samples
                from_sample = to_sample

                # This should be 0 <= x < 1
                leftover_sample_fraction = should_include_samples - actual_included_samples

        self.leftover_sample_fraction = leftover_sample_fraction
        self.leftover_samples = samples[to_sample:]
        self.result = subsamples

    def after_step(self):
        pass
