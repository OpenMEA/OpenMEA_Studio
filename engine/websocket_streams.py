import logging
from typing import Dict

import aiohttp_cors
import socketio


class WebsocketStreams:
    def __init__(self, app):
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)

        # Typically we shouldn't allow arbitrary cross-origin requests, but this server listens only on
        # 127.0.0.1, so we should be fine for now. If needed, we can later add more security.
        self.socketio = socketio.AsyncServer(cors_allowed_origins='*')
        self.app = app
        self.socketio.attach(app)

        aiohttp_cors.setup(self.app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
            )
        })

        @self.socketio.event
        def connect(sid, environ):
            self.logger.info('connection made')

        @self.socketio.event
        async def message(sid, data):
            self.logger.info('connection made')

    async def send_general(self, message: Dict):
        await self.socketio.emit('msg', message)

    async def send_module_message(self, module: str, message: Dict):
        await self.socketio.emit(module, message)
