import urllib.parse
import uuid
from typing import Dict, Union

from aiohttp import web
from aiohttp.web_response import Response

from filters.add_another_series_filter import AddAnotherSeriesFilter, AddAnotherSeriesFilterConfig
from filters.resampling_filter import ResamplingFilter, ResamplingFilterConfig
from sources_and_sinks.nwb_file_writer import NwbFileWriter, NwbFileWriterConfig
from engine import Engine
from filters.band_filter import BandFilter, BandFilterConfig
from filters.comb_filter import CombFilter, CombFilterConfig
from filters.rescaling_filter import RescalingFilter, RescalingFilterConfig
from filters.spectrogram_filter import SpectrogramFilter, SpectrogramFilterConfig
from filters.subsampling_filter import SubsamplingFilter, SubsamplingFilterConfig


class WebServer:
    def __init__(self, engine: Engine):
        self.engine = engine

    # POST /pipelines
    async def pipelines_post(self, request):
        steps_json = await request.json()

        steps = []

        for step_json in steps_json:
            step = get_step(self.engine, step_json)
            steps.append(step)

        pipeline_id = self.engine.add_pipeline(steps)

        response = dict()
        response['id'] = str(pipeline_id)
        response['steps'] = [str(step.id) for step in steps]
        return web.json_response(response)

    # DELETE /pipelines/{id}
    async def pipelines_delete(self, request):
        id_string = request.match_info['id']
        pipeline_id = uuid.UUID(id_string)
        self.engine.delete_pipeline(pipeline_id)
        return Response(status=204)

    # PATCH /pipelines/{id}
    async def pipelines_patch(self, request):
        pass

    # PATCH /steps/{id}
    async def steps_patch(self, request):
        pass

    # POST /modules/{module_name}
    async def module_post(self, request):
        module_raw_name = request.match_info['module_name']
        module_name = urllib.parse.unquote(module_raw_name)
        command_json = await request.json()
        self.engine.handle_module_command(module_name, command_json)

    # POST /device
    async def device_post(self, request):
        command_json = await request.json()
        if 'connectToDevice' in command_json:
            self.engine.connect_to_device(command_json['connectToDevice'])
        return Response(status=204)

    # POST /device/commands
    async def device_commands_post(self, request):
        command_json = await request.json()
        self.engine.handle_device_command(command_json)
        return Response(status=200)



def get_step(engine: Engine, step_json: Union[str, Dict]):
    config = None
    step_type = None

    if isinstance(step_json, str):
        return engine.get_published_step(step_json)

    elif step_json['name'] == AddAnotherSeriesFilter.name:
        config = AddAnotherSeriesFilterConfig.from_json(step_json)
        step_type = AddAnotherSeriesFilter

    elif step_json['name'] == BandFilter.name:
        config = BandFilterConfig.from_json(step_json)
        step_type = BandFilter

    elif step_json['name'] == CombFilter.name:
        config = CombFilterConfig.from_json(step_json)
        step_type = CombFilter

    elif step_json['name'] == NwbFileWriter.name:
        config = NwbFileWriterConfig.from_json(step_json)
        step_type = NwbFileWriter

    elif step_json['name'] == ResamplingFilter.name:
        config = ResamplingFilterConfig.from_json(step_json)
        step_type = ResamplingFilter

    elif step_json['name'] == RescalingFilter.name:
        config = RescalingFilterConfig.from_json(step_json)
        step_type = RescalingFilter

    elif step_json['name'] == SpectrogramFilter.name:
        config = SpectrogramFilterConfig.from_json(step_json)
        step_type = SpectrogramFilter

    elif step_json['name'] == SubsamplingFilter.name:
        config = SubsamplingFilterConfig.from_json(step_json)
        step_type = SubsamplingFilter

    step = step_type()
    step.configure(config, engine)
    return step


async def setup_server(app, engine: Engine):
    server = WebServer(engine)
    app.add_routes([web.post('/pipelines', server.pipelines_post),
                    web.delete('/pipelines/{id}', server.pipelines_delete),
                    web.post('/modules/{module_name}', server.module_post),
                    web.post('/device', server.device_post),
                    web.post('/device/commands', server.device_commands_post)])
    return server
