import { EventEmitter } from "events";
import { ApiClient } from "./ApiClient";
import { PipelinePostResponse } from "./PipelinePostResponse";

export type PipelineElement = string|{[id: string] : string|number|boolean}

export class Pipeline {
    constructor(apiClient: ApiClient, pipelinePostResponse: PipelinePostResponse) {
        this._apiClient = apiClient
        this._id = pipelinePostResponse.id
        this._steps = pipelinePostResponse.steps

        this._apiClient.on(this._id, this.handleData)
    }

    onData = (handler: (data:any) => void) => {
        this._eventEmitter.on('data', handler)
    }

    updateStep = async (stepNum: number, config: {[id:string]: string|number|boolean}) => {
        // TODO

        console.log(this._steps.length)
    }

    delete = async () => {
        this._eventEmitter.removeAllListeners()
        this._apiClient.off(this._id, this.handleData)

        await this._apiClient.sendDelete(`/pipelines/${this._id}`)
    }

    // ===================== Private =====================
    private _apiClient : ApiClient
    private _id: string
    private _steps: string[]

    private _eventEmitter = new EventEmitter()

    private handleData = (data: any) => {
        this._eventEmitter.emit('data', data)
    }
}