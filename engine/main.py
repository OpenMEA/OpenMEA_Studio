import asyncio
import logging
import platform
import sys
import os
from pathlib import Path

import yaml

import psutil
from aiohttp import web

# In embeddable Python, it's necessary to explicitly add the current directory to sys.path so that it can import
# local packages and modules.
# Note that this has to be done here because embeddable python does not support PYTHONPATH env var..
scriptdir = os.path.dirname(os.path.realpath(__file__))
if scriptdir not in sys.path:
    sys.path.insert(0, scriptdir)

from engine import Engine
from web_server import setup_server
from websocket_streams import WebsocketStreams
from module_loader import load_openmea_modules


async def main():
    # If this process was started by the UI process, we will have to make
    # sure that this process ends even if the parent process got killed and
    # never got a chance to terminate this process.
    if len(sys.argv) > 1 and platform.system() == 'Linux':
        parent_pid = int(sys.argv[1].replace('"', '').replace("'", ''))
        asyncio.ensure_future(quit_when_parent_quits(parent_pid))

    load_openmea_modules()
    config = load_config()

    # Initialize the services
    app = web.Application()
    websocket_streams = WebsocketStreams(app)
    engine = Engine(websocket_streams, config)
    await setup_server(app, engine)

    # Start the webserver
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, port=4999)
    await site.start()

    # Start the engine
    engine.initialize()
    await engine.run()


async def quit_when_parent_quits(parent_pid):
    while True:
        await asyncio.sleep(1)
        if parent_pid not in psutil.pids():
            os.abort()


def load_config():
    if os.path.isfile('config.yml'):
        return yaml.safe_load(Path('config.yml').read_text())

    return yaml.safe_load(Path('config.prod.yml').read_text())


if __name__ == '__main__':
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    logging.getLogger('aiohttp.access').setLevel(logging.WARNING)
    logging.getLogger('asyncio').setLevel(logging.WARNING)

    # Start the async loop
    loop = asyncio.get_event_loop()
    loop.create_task(main())
    loop.run_forever()
