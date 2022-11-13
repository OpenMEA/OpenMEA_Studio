import json
import time
from typing import Dict

import numpy as np
from pynwb import NWBHDF5IO

from devices.device import Device
from util import electrode_name

DEVICE_NAME = 'NWB file'


DEFAULT_DEVICE_PROPS = {
    'name': DEVICE_NAME,
    'canControlReplay': True,
    'canControlSampling': False,
    'canRecordToFile': False,
    'canStimulate': False,
    'canSampleDC': False,
    'numElectrodes': 0,
    'numElectrodeRows': 0,
    'electrodeMap': [],
    'electrodeExists': [],
    'electrodeNames': [],
}


class NwbFileDevice(Device):
    name = DEVICE_NAME

    def __init__(self, config: Dict):
        super(NwbFileDevice, self).__init__()
        self.replay_position_sec = 0
        self.replay_length_sec = 0
        self.device_state_messages = []
        self.file_path = ""

        self.samples_per_sec = 0
        self.num_samples = 0
        self.emitted_to_sample = 0
        self.preloaded_from = 0
        self.preloaded_to = 0
        self.preloaded_samples = {}
        self.preload_chunk_size = 0
        self.started_at_time = 0
        self.started_at_sample = 0
        self.is_playing = False

        self.emit_extra_samples = {}
        self.emit_was_reset = False
        self.device_props = None
        self.num_loaded_electrodes = 0
        self.can_sample_dc = False

        state_update = {
            'isConnected': False,
            'initState': 'NOT_INITIALIZED',
            'isSampling': False,
            'isStimulating': False,
            'initStepDone': 1,
            'numInitSteps': 1,

            'replayLengthSamples': None,
            'replayPositionSample': None,
            'error': None,
            'deviceProps': DEFAULT_DEVICE_PROPS
        }

        self.emit_device_state(state_update)

    def num_electrodes(self) -> int:
        return self.num_loaded_electrodes

    def run_command(self, msg: Dict):
        if 'openFile' in msg:
            self.open_file(msg['openFile'])

        if 'startSampling' in msg:
            self.start_playing()

        if 'stopSampling' in msg:
            self.pause_playing()

        if 'seekTo' in msg:
            self.seek_to(msg['seekTo'])

    def collect_updates(self):
        updates = {
            'data': self.collect_data()
        }

        if len(self.device_state_messages) > 0:
            updates['state'] = self.device_state_messages
            self.device_state_messages = []

        if self.emit_was_reset:
            updates['was_reset'] = True
            self.emit_was_reset = False

        return updates

    def close(self):
        pass

    def collect_data(self):
        if len(self.emit_extra_samples) > 0:
            data = self.emit_extra_samples
            self.emit_extra_samples = {}
            return data

        if not self.is_playing:
            return {}

        state_update = {}
        elapsed = time.time() - self.started_at_time
        prev_emit_to = self.emitted_to_sample
        emit_to = int(round(elapsed * self.samples_per_sec)) + self.started_at_sample

        if emit_to >= self.num_samples:
            emit_to = self.num_samples

            # Reached the end. Stop.
            self.is_playing = False
            state_update['isSampling'] = False

        emit_from_index = prev_emit_to - self.preloaded_from
        emit_to_index = emit_to - self.preloaded_from

        if emit_to_index > (self.preloaded_to - self.preloaded_from):
            self.preload_next_chunk()

            # The line above may have changed self.preloaded_from and self.preloaded_to,
            # so we'll need to recalculate these.
            emit_from_index = prev_emit_to - self.preloaded_from
            emit_to_index = emit_to - self.preloaded_from

        data = {}
        for i in range(self.num_loaded_electrodes):
            ac_series_name = electrode_name(i, 'ac')
            data[ac_series_name] = self.preloaded_samples[ac_series_name][emit_from_index:emit_to_index]

            if self.can_sample_dc:
                dc_series_name = electrode_name(i, 'dc')
                data[dc_series_name] = self.preloaded_samples[dc_series_name][emit_from_index:emit_to_index]

        self.emitted_to_sample = emit_to
        state_update['replayPositionSample'] = self.emitted_to_sample

        if len(state_update) > 0:
            self.emit_device_state(state_update)

        return data

    def open_file(self, file_path):
        self.file_path = file_path

        try:
            with NWBHDF5IO(file_path, 'r') as nwb_io:
                nwb_file = nwb_io.read()

                # Load the electrode configuration
                # FIXME: try and catch cases when NWB format is not supporred by this application.
                notes = nwb_file.notes
                stored_props = json.loads(notes)
                device_props = dict(DEFAULT_DEVICE_PROPS)
                device_props['canSampleDC'] = stored_props['canSampleDC']
                device_props['numElectrodes'] = stored_props['numElectrodes']
                device_props['numElectrodeRows'] = stored_props['numElectrodeRows']
                device_props['electrodeMap'] = stored_props['electrodeMap']
                device_props['electrodeExists'] = stored_props['electrodeExists']
                device_props['electrodeNames'] = stored_props['electrodeNames']

                self.num_loaded_electrodes = device_props['numElectrodes']
                self.can_sample_dc = device_props['canSampleDC']
                self.device_props = device_props

                # Load the time series details
                first_electrode = nwb_file.acquisition[electrode_name(0, 'ac')]
                self.samples_per_sec = first_electrode.rate
                self.num_samples = len(first_electrode.data)

                self.emitted_to_sample = 0
                self.preloaded_samples = {}
                self.preloaded_from = 0
                self.started_at_sample = 0
                self.emit_was_reset = True

                # Preload data into memory in 20-second chunks.
                self.preload_chunk_size = int(round(20 * self.samples_per_sec))

                num_to_preload = min(self.num_samples, self.preload_chunk_size)
                self.preloaded_to = num_to_preload

                # Preload some samples.
                # While at it, validate that all the time series have the same metadata
                for i in range(self.num_loaded_electrodes):
                    ac_time_series = nwb_file.acquisition[electrode_name(i, 'ac')]

                    # The number of samples in individual time series may vary slightly
                    # because of the differences in timing when this studio has received the
                    # UDP packets.
                    num_ac_samples = len(ac_time_series.data)

                    if self.num_samples > num_ac_samples:
                        self.num_samples = num_ac_samples

                    if ac_time_series.rate != self.samples_per_sec:
                        raise Exception('Not all electrodes have the same sampling rate')

                    self.preloaded_samples[electrode_name(i, 'ac')] = ac_time_series.data[:num_to_preload]

                    if self.can_sample_dc:
                        dc_time_series = nwb_file.acquisition[electrode_name(i, 'dc')]
                        num_dc_samples = len(dc_time_series.data)

                        if self.num_samples > num_dc_samples:
                            self.num_samples = num_dc_samples

                        if dc_time_series.rate != self.samples_per_sec:
                            raise Exception('Not all electrodes have the same sampling rate')

                        self.preloaded_samples[electrode_name(i, 'dc')] = dc_time_series.data[:num_to_preload]

                # Signal success to the UI.
                state_update = {
                    'isConnected': True,
                    'initState': 'INITIALIZED',
                    'isSampling': False,
                    'samplesPerSec': self.samples_per_sec,
                    'replayLengthSamples': self.num_samples,
                    'replayPositionSample': 0,
                    'error': None,
                    'deviceProps': self.device_props
                }

                self.emit_device_state(state_update)
        except:
            self.samples_per_sec = 0
            self.num_samples = 0
            self.emitted_to_sample = 0
            self.preloaded_to = 0

            state_update = {
                'isConnected': False,
                'initState': 'INIT_FAILED',
                'isSampling': False,
                'replayLengthSamples': None,
                'replayPositionSample': None,
                'error': 'Could not open the file',
                'deviceProps': DEFAULT_DEVICE_PROPS
            }

            self.emit_device_state(state_update)

    def start_playing(self):
        self.is_playing = True
        self.started_at_time = time.time()
        self.started_at_sample = self.emitted_to_sample
        self.emit_device_state({'isSampling': True})

    def pause_playing(self):
        self.is_playing = False
        self.emit_device_state({'isSampling': False})

    def seek_to(self, seek_to_sample):
        # We will immediately emmit 30 sec worth of samples
        # immediately before the seek point in order to fill up
        # the charts.
        state_update = {}

        if self.is_playing:
            self.is_playing = False
            state_update['isSampling'] = False

        seek_to_sample = min(seek_to_sample, self.num_samples)
        self.emit_was_reset = True

        desired_extra_samples = int(round(30 * self.samples_per_sec))
        extra_samples_from = max(0, seek_to_sample - desired_extra_samples)
        self.preload_chunk_for_seeking(extra_samples_from, seek_to_sample)

        if seek_to_sample != 0:
            for i in range(self.num_loaded_electrodes):
                ac_series_name = electrode_name(i, 'ac')
                dc_series_name = electrode_name(i, 'dc')

                emit_to = seek_to_sample - extra_samples_from

                self.emit_extra_samples[ac_series_name] = self.preloaded_samples[ac_series_name][:emit_to]

                if self.can_sample_dc:
                    self.emit_extra_samples[dc_series_name] = self.preloaded_samples[dc_series_name][:emit_to]

        # Store and emit the current spot in the recording.
        self.emitted_to_sample = seek_to_sample
        state_update['replayPositionSample'] = seek_to_sample

        self.emit_device_state(state_update)

    def emit_device_state(self, device_state_msg):
        self.device_state_messages.append(device_state_msg)

    def preload_next_chunk(self):
        num_remaining = self.num_samples - self.preloaded_to
        num_to_preload = min(num_remaining, self.preload_chunk_size)
        preload_to = self.preloaded_to + num_to_preload
        preload_from = self.preloaded_to

        unload_to_index = self.emitted_to_sample - self.preloaded_from

        with NWBHDF5IO(self.file_path, 'r') as nwb_io:
            nwb_file = nwb_io.read()

            for i in range(self.num_loaded_electrodes):
                ac_series_name = electrode_name(i, 'ac')
                ac_preloaded_samples = self.preloaded_samples[ac_series_name]
                ac_preloaded_samples = ac_preloaded_samples[unload_to_index:]
                ac_nwb_series = nwb_file.acquisition[ac_series_name]
                ac_preloaded_samples = np.concatenate((ac_preloaded_samples,
                                                       ac_nwb_series.data[preload_from:preload_to]))
                self.preloaded_samples[ac_series_name] = ac_preloaded_samples

                if self.can_sample_dc:
                    dc_series_name = electrode_name(i, 'dc')
                    dc_preloaded_samples = self.preloaded_samples[dc_series_name]
                    dc_preloaded_samples = dc_preloaded_samples[unload_to_index:]
                    dc_nwb_series = nwb_file.acquisition[dc_series_name]

                    dc_preloaded_samples = np.concatenate((dc_preloaded_samples,
                                                           dc_nwb_series.data[preload_from:preload_to]))

                    self.preloaded_samples[dc_series_name] = dc_preloaded_samples

        self.preloaded_from = self.emitted_to_sample
        self.preloaded_to = preload_to

    def preload_chunk_for_seeking(self, preload_from, seek_to):
        num_remaining = self.num_samples - seek_to
        num_to_preload = min(num_remaining, self.preload_chunk_size)
        preload_to = seek_to + num_to_preload

        with NWBHDF5IO(self.file_path, 'r') as nwb_io:
            nwb_file = nwb_io.read()

            for i in range(self.num_loaded_electrodes):
                ac_series_name = electrode_name(i, 'ac')
                ac_nwb_series = nwb_file.acquisition[ac_series_name]
                self.preloaded_samples[ac_series_name] = ac_nwb_series.data[preload_from:preload_to]

                if self.can_sample_dc:
                    dc_series_name = electrode_name(i, 'dc')
                    dc_nwb_series = nwb_file.acquisition[dc_series_name]
                    self.preloaded_samples[dc_series_name] = dc_nwb_series.data[preload_from:preload_to]

        self.preloaded_from = preload_from
        self.preloaded_to = preload_to

    def get_properties(self) -> Dict:
        return self.device_props

