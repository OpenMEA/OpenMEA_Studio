import _thread
import json
import time
from datetime import datetime
import os
from pathlib import Path
from typing import Dict, Optional, List, Any

import numpy as np
from dateutil.tz import tzlocal
from hdmf.backends.hdf5 import H5DataIO
from pynwb import NWBFile, NWBHDF5IO
from pynwb.ecephys import ElectricalSeries

from engine_step import EngineStepConfig, EngineStep

# Larger buffers cause UI pauses during writes. As the buffers get smaller,
# the pauses get smaller, but only up to a point.
from util import electrode_name

BUFFER_SIZE = 262_144  # = 10 ^ 15, or 1/4 MB for 32-bit float per channel.


class NwbFileWriterConfig(EngineStepConfig):
    @staticmethod
    def from_json(json: Dict):
        config = NwbFileWriterConfig()

        config.file_path = json['filePath']
        config.offset = json['offset']
        config.resolution = json['resolution']
        config.conversion = json['conversion']
        config.samples_per_sec = json['samplesPerSec']
        config.num_electrodes = json['numElectrodes']

        return config

    def __init__(self):
        super().__init__()
        self.file_path: str = ""
        self.offset = 0
        self.resolution = 0
        self.conversion = 1
        self.samples_per_sec = 0
        self.num_electrodes = 0


class NwbFileWriter(EngineStep):
    name = 'NwbFileWriter'

    def __init__(self):
        super().__init__()
        self.config: Optional[NwbFileWriterConfig] = None

        self.nwb_file = None
        self.time_series_data = None
        self.file_io = None
        self.chunk_streams = []
        self.samples_written_per_series = []
        self.buffers_ac = []
        self.buffers_dc = []
        self.buffer_space_used = []
        self.num_electrodes = 0
        self.can_sample_dc = False

    def configure(self, config: NwbFileWriterConfig, engine):
        self.config = config

        device_props = engine.device.get_properties()
        device_name = device_props['name']
        self.num_electrodes = device_props['numElectrodes']
        self.can_sample_dc = device_props['canSampleDC']

        file_name = os.path.basename(config.file_path)
        notes = json.dumps(device_props)
        self.nwb_file = NWBFile(file_name, file_name, datetime.now(tzlocal()), notes=notes)

        # Initialize data chunk streams. The code in do_step() will write to these.
        self.buffers_ac = []
        self.buffers_dc = []

        for i in range(config.num_electrodes):
            chunk_stream = H5DataIO(data=np.empty(shape=(0,), dtype='f4'),
                                    maxshape=(None,),
                                    chunks=(BUFFER_SIZE,),
                                    compression='gzip',
                                    compression_opts=4,
                                    shuffle=True,
                                    fillvalue=np.nan)
            self.chunk_streams.append(chunk_stream)

            self.buffers_ac.append(np.zeros(BUFFER_SIZE, 'f4'))
            self.buffers_dc.append(np.zeros(BUFFER_SIZE, 'f4'))

        self.samples_written_per_series = [0 for _ in range(config.num_electrodes)]
        self.buffer_space_used = [0 for _ in range(config.num_electrodes)]

        # Set up the rest of the NWB file, including the metadata.
        device = self.nwb_file.create_device(name=device_name)
        electrode_group = self.nwb_file.create_electrode_group(device_name,
                                                               description='',
                                                               location='',
                                                               device=device)

        for i in range(config.num_electrodes):
            self.nwb_file.add_electrode(i * 1., 0., 0., 1., '', '', electrode_group, id=i)

        series_start_time = time.time()

        for i in range(config.num_electrodes):
            electrode_table_region = self.nwb_file.create_electrode_table_region([i], f'electrode {i}')
            time_series_ac = ElectricalSeries(electrode_name(i, 'ac'),
                                              self.chunk_streams[i],
                                              electrode_table_region,
                                              resolution=config.resolution,
                                              starting_time=series_start_time,
                                              rate=float(config.samples_per_sec))

            self.nwb_file.add_acquisition(time_series_ac)

            if self.can_sample_dc:
                time_series_dc = ElectricalSeries(electrode_name(i, 'dc'),
                                                  self.chunk_streams[i],
                                                  electrode_table_region,
                                                  resolution=config.resolution,
                                                  starting_time=series_start_time,
                                                  rate=float(config.samples_per_sec))

                self.nwb_file.add_acquisition(time_series_dc)

        # Open the file for appending. Remove any existing files.
        existing_file = Path(config.file_path)

        if existing_file.exists():
            if not existing_file.is_file():
                raise Exception(f'{config.file_path} is not a file')

            os.remove(config.file_path)

        self.file_io = NWBHDF5IO(config.file_path, 'w')
        self.file_io.write(self.nwb_file)
        self.file_io.close()

    def do_step(self, electrode_channels: Dict[str, Any]):
        chunks_to_write_ac = [None for _ in range(self.num_electrodes)]
        chunks_to_write_dc = [None for _ in range(self.num_electrodes)]
        has_chunks_to_write = False

        if len(electrode_channels) == 0:
            return

        for i in range(self.num_electrodes):
            samples_ac = electrode_channels[electrode_name(i, 'ac')]

            if self.can_sample_dc:
                samples_dc = electrode_channels[electrode_name(i, 'dc')]

            # There the same number of AC and DC samples.
            num_samples = len(samples_ac)

            if num_samples == 0:
                continue

            buffer_ac = self.buffers_ac[i]
            buffer_dc = self.buffers_dc[i]

            buffer_space_used = self.buffer_space_used[i]

            if (buffer_space_used + num_samples) > BUFFER_SIZE:
                # Ready to write the chunk to the file.
                num_to_copy = BUFFER_SIZE - buffer_space_used
                buffer_ac[buffer_space_used:] = samples_ac[:num_to_copy]
                chunks_to_write_ac[i] = buffer_ac

                if self.can_sample_dc:
                    buffer_dc[buffer_space_used:] = samples_dc[:num_to_copy]
                    chunks_to_write_dc[i] = buffer_dc

                has_chunks_to_write = True

                new_buffer_ac = np.zeros(BUFFER_SIZE, 'f4')

                if self.can_sample_dc:
                    new_buffer_dc = np.zeros(BUFFER_SIZE, 'f4')

                num_left_over = num_samples - num_to_copy
                new_buffer_ac[:num_left_over] = samples_ac[num_to_copy:]
                self.buffers_ac[i] = new_buffer_ac

                if self.can_sample_dc:
                    new_buffer_dc[:num_left_over] = samples_dc[num_to_copy:]
                    self.buffers_dc[i] = new_buffer_dc

                self.buffer_space_used[i] = num_left_over

            else:
                # The buffer will not overflow.
                buffer_ac[buffer_space_used:buffer_space_used + num_samples] = samples_ac

                if self.can_sample_dc:
                    buffer_dc[buffer_space_used:buffer_space_used + num_samples] = samples_dc

                self.buffer_space_used[i] += num_samples

        if not has_chunks_to_write:
            return

        # Write the data updates to file.
        chunk_sizes = [BUFFER_SIZE for _ in range(self.num_electrodes)]
        _thread.start_new_thread(self.write_to_file,
                                 (chunks_to_write_ac, chunks_to_write_dc, chunk_sizes))

    def write_to_file(self, chunks_ac: List, chunks_dc: List, chunk_sizes: List[int]):
        file_path = self.config.file_path
        samples_written_per_series = self.samples_written_per_series

        io = NWBHDF5IO(file_path, 'a')
        nwb_file = io.read()

        for i in range(self.num_electrodes):
            chunk_ac = chunks_ac[i]
            chunk_size = chunk_sizes[i]

            if (chunk_ac is None) or (chunk_size == 0):
                continue

            old_length = samples_written_per_series[i]
            new_length = old_length + chunk_size

            time_series_ac_data = nwb_file.get_acquisition(electrode_name(i, 'ac')).data
            time_series_ac_data.resize((new_length,))
            time_series_ac_data[old_length:new_length] = chunk_ac[:chunk_size]

            if self.can_sample_dc:
                chunk_dc = chunks_dc[i]
                time_series_dc_data = nwb_file.get_acquisition(electrode_name(i, 'dc')).data
                time_series_dc_data.resize((new_length,))
                time_series_dc_data[old_length:new_length] = chunk_dc[:chunk_size]

            samples_written_per_series[i] += chunk_size

        io.close()

    def finalize(self):
        # Write the data accumulated so far.
        _thread.start_new_thread(self.write_to_file, (self.buffers_ac, self.buffers_dc, self.buffer_space_used))
