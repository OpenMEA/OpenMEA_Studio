import numpy as np

from engine_step import EngineStep

CACHE_SIZE = 40_000 * 30


class DataBuffer(EngineStep):
    def __init__(self):
        super().__init__()
        self.cache = np.zeros(CACHE_SIZE)
        self.cache_end = 0

    def do_step(self, _):
        pass

    def add_data(self, data_ndarray):
        self.result = data_ndarray

        if data_ndarray is None or len(data_ndarray) == 0:
            self.result = None
            return

        data_len = len(data_ndarray)

        if data_len + self.cache_end >= CACHE_SIZE:
            num_to_keep = min(max(0, int(CACHE_SIZE/2 - data_len)), self.cache_end)

            if num_to_keep > 0:
                self.cache[:num_to_keep] = \
                    self.cache[(self.cache_end - num_to_keep):self.cache_end]
                self.cache_end -= num_to_keep
            else:
                self.cache_end = 0

            num_to_add = min(data_len, CACHE_SIZE)
            self.cache[self.cache_end: self.cache_end + num_to_add] = data_ndarray[-num_to_add:]

        else:
            self.cache[self.cache_end:self.cache_end + data_len] = data_ndarray
            self.cache_end += data_len

    def get_cache(self):
        return self.cache[:self.cache_end]

    def clear(self):
        self.cache = np.zeros(CACHE_SIZE)
        self.cache_end = 0
