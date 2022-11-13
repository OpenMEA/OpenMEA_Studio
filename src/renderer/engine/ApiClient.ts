import EventEmitter from "events"
import { io, Socket } from 'socket.io-client'

const ROOT_URL = 'http://127.0.0.1:4999'

export class ApiClient {
    constructor() {
        this._socket = io(ROOT_URL)

        this._socket.on('connect', () => {
            console.log('Socket.io client connected')
            this._readyEmitter.emit('ready')
        })

        this._socket.on('connection_error', () => {
            console.log('Socket.io client connection error')
        })

        this._socket.on('disconnect', () => {
            console.log('Socket.io client disconnected')
        })

        this._socket.on('msg', (data : {[id: string]: any}) => {
            for (let id in data) {
                if (data[id]) {
                    this._eventEmitter.emit(id, data[id])
                }
            }
        })
    }

    on = (pipelineId: string, handler: (data: any) => void) => {
        this._eventEmitter.on(pipelineId, handler)
    }

    off =  (pipelineId: string, handler: (data: any) => void) => {
        this._eventEmitter.off(pipelineId, handler)
    }

    onReady = (handler: () => void) => {
        this._readyEmitter.on('ready', handler)
    }

    sentGet = async (url: string)  : Promise<any> => {
        const reply = await this.makeRequest(url, 'GET')
        return await reply.json()
    }

    sendPostForJson = async (url: string, body?: any) : Promise<any> => {
        const reply = await this.makeRequest(url, 'POST', body)
        return await reply.json()
    }

    sendPost = async (url: string, body?: any) : Promise<void> => {
        await this.makeRequest(url, 'POST', body)
    }

    sendPatch = async (url: string, body: any) : Promise<void> => {
        await this.makeRequest(url, 'PATCH', body)
    }

    sendDelete = async (url: string) : Promise<void> => {
        await this.makeRequest(url, 'DELETE')
    }

    // ================ Private ===================
    private _socket: Socket
    private _eventEmitter = new EventEmitter()
    private _readyEmitter = new EventEmitter()


    private makeRequest = async (url: string, method: string, body?: any) => {
        const request = {
            method: method,
        } as RequestInit

        if (body) {
            request.body = JSON.stringify(body)
        }

        const reply = await fetch(ROOT_URL + url, request)

        if (!reply.ok) {
            if (reply.body) {
                const text = await reply.text()
                throw text
            } else {
                throw `Response: ${reply.status}` 
            }
        }

        return reply
    }
}