import { StimConfig } from '../model/StimConfig'
import { ApiClient } from './ApiClient'
import { Pipeline, PipelineElement } from './Pipeline'
import { PipelinePostResponse } from './PipelinePostResponse'
import { DeviceState } from '../model/DeviceState'

export class EngineClient {
    constructor() {
    }

    createPipeline = async (stepConfigs: PipelineElement[]) => {
       const reply = await this._apiClient.sendPostForJson('/pipelines', stepConfigs)
       const pipelinePostResponse = new PipelinePostResponse(reply)
       const pipeline = new Pipeline(this._apiClient, pipelinePostResponse)
       return pipeline
    }

    onReady = (handler: () => void) => {
        this._apiClient.onReady(handler)
    }

    configureStimulator = async (stimConfig: StimConfig) => {
        await this._apiClient.sendPost('/device/commands', stimConfig)
    }

    startStim = async () => {
        await this._apiClient.sendPost('/device/commands', {
            startStim: true
        })
    }

    stopStim = async () => {
        await this._apiClient.sendPost('/device/commands', {
            stopStim: true
        })
    }

    startSampling = async () => {
        await this._apiClient.sendPost('/device/commands', {
            startSampling: true
        })
    }

    stopSampling = async () => {
        await this._apiClient.sendPost('/device/commands', {
            stopSampling: true
        })
    }

    runDeviceCommand = async (command: string) => {
        await this._apiClient.sendPost('/device/commands', {
            command: command
        })
    }

    initializeDevice = async () => {
        await this._apiClient.sendPost('/device/commands', {
            initializeDevice: true
        })
    }

    setSamplesPerSec = async(samplesPerSec: number) => {
        await this._apiClient.sendPost('/device/commands', {
            setSamplingRate: samplesPerSec
        })
    }

    checkDeviceState = async () => {
        await this._apiClient.sendPost('/device/commands', {
            checkDeviceState: true
        })
    }

    openFile = async (filePath: string) => {
        await this._apiClient.sendPost('/device/commands', {
            openFile: filePath
        })
    }

    seekTo = async (sampleNum: number) => {
        await this._apiClient.sendPost('/device/commands', {
            seekTo: sampleNum
        })
    }

    connectToDevice = async (deviceName: string) => {
        await this._apiClient.sendPost('/device', {
            connectToDevice: deviceName
        })
    }

    onDeviceStateUpdated = (handler: (messages: Partial<DeviceState>[]) => void) => {
        this._apiClient.on('deviceState', handler)
    }

    // ================ Private =====================
    private _apiClient = new ApiClient()
}

