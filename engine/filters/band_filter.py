from typing import Optional, Dict

import numpy as np
from scipy.signal import iirfilter, sosfilt

from engine_step import EngineStepConfig, EngineStep


class BandFilterConfig(EngineStepConfig):
    @staticmethod
    def from_json(json: Dict):
        config = BandFilterConfig()

        config.samples_per_sec = json['samplesPerSec']

        config.low_order = json.get('lowOrder')
        config.low_3db_freq = json.get('low3dbFreq')
        config.low_rp = json.get('lowRp')
        config.low_rs = json.get('lowRs')
        config.low_ftype = json.get('lowFType')

        config.high_order = json.get('highOrder')
        config.high_3db_freq = json.get('high3dbFreq')
        config.high_rp = json.get('highRp')
        config.high_rs = json.get('highRs')
        config.high_ftype = json.get('highFType')

        return config

    def __init__(self):
        super().__init__()

        self.samples_per_sec = 0

        # Low-pass and high-pass filter configuration. See documentation for
        # for scipy.signal.sosfilt filter.
        # https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.sosfilt.html#scipy.signal.sosfilt
        self.low_order: int = 0
        self.low_3db_freq: float = 0
        self.low_rp: Optional[float] = None
        self.low_rs: Optional[float] = None
        self.low_ftype: str = "none"

        self.high_order: int = 0
        self.high_3db_freq: float = 0
        self.high_rp: Optional[float] = None
        self.high_rs: Optional[float] = None
        self.high_ftype: str = "none"


class BandFilter(EngineStep):
    name = 'BandFilter'

    def __init__(self):
        super().__init__()
        self.config: Optional[BandFilterConfig] = None

        # These are the initial values for the next filtering window.
        # Thse correspond to the the 'zi' input argument and 'zf' output argument
        # of scipy.signal.sosfilt filter.
        self.low_zf = None
        self.high_zf = None

        # Configuration for the low- and high-pass filters
        self.low_sos = None
        self.high_sos = None

    def configure(self, config: BandFilterConfig, engine):
        self.config = config

        if (config.low_ftype is not None) and (config.low_ftype.lower() != 'none'):
            self.low_sos = iirfilter(config.low_order,
                                     config.low_3db_freq,
                                     rp=config.low_rp,
                                     rs=config.low_rs,
                                     btype='lowpass',
                                     ftype=config.low_ftype,
                                     output='sos',
                                     fs=config.samples_per_sec)

            n_sections = self.low_sos.shape[0]
            self.low_zf = np.zeros([n_sections, 2])
        else:
            self.low_sos = None
            self.low_zf = None

        if (config.high_ftype is not None) and (config.high_ftype.lower() != 'none'):
            self.high_sos = iirfilter(config.high_order,
                                     config.high_3db_freq,
                                     rp=config.high_rp,
                                     rs=config.high_rs,
                                     btype='highpass',
                                     ftype=config.high_ftype,
                                     output='sos',
                                     fs=config.samples_per_sec)

            n_sections = self.high_sos.shape[0]
            self.high_zf = np.zeros([n_sections, 2])
        else:
            self.high_sos = None
            self.high_zf = None

    def do_step(self, data_ndarray):
        if (data_ndarray is None) or (len(data_ndarray) == 0):
            self.result = None
            return

        samples = data_ndarray

        if self.low_sos is not None:
            samples, self.low_zf = sosfilt(self.low_sos, samples, zi=self.low_zf)

        if self.high_sos is not None:
            samples, self.high_zf = sosfilt(self.high_sos, samples, zi=self.high_zf)

        self.result = samples


