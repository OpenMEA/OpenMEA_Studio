import { INIT_SAMPLES_PER_SEC } from "client/Constants"
import { DeviceProperties } from "./DeviceProperties"

export class DeviceState {
    isConnected: boolean|null = null
    initState: DeviceInitState = DeviceInitState.UNKNOWN
    isSampling: boolean = false
    isStimulating: boolean = false
    initStepDone: number|null = null
    numInitSteps: number|null = null
    samplesPerSec: number = INIT_SAMPLES_PER_SEC
    
    replayLengthSamples: number|null = null
    replayPositionSample: number|null = null
    error: string|null = null
    lastResetTime: number|null = null
    deviceProps: DeviceProperties | null = null

    constructor(init?: Partial<DeviceState>) {
        if (!init) return

        Object.assign(this, init)
        
        if (init.deviceProps) {
            this.deviceProps = new DeviceProperties(init.deviceProps)
        }
    }
}

export function deviceStateDidNotChange(oldState: DeviceState, newState: DeviceState) {
    if (oldState.isConnected !== newState.isConnected) return false
    if (oldState.initState !== newState.initState) return false
    if (oldState.isSampling !== newState.isSampling) return false
    if (oldState.isStimulating !== newState.isStimulating) return false
    if (oldState.initStepDone !== newState.initStepDone) return false
    if (oldState.numInitSteps !== newState.numInitSteps) return false
    if (oldState.samplesPerSec !== newState.samplesPerSec) return false
    
    if (oldState.replayLengthSamples !== newState.replayLengthSamples) return false
    if (oldState.replayPositionSample !== newState.replayPositionSample) return false
    if (oldState.error !== newState.error) return false

    if (newState.deviceProps !== newState.deviceProps) return false
    
    return true
}

export enum DeviceInitState {
    UNKNOWN = "UNKNOWN",
    NOT_INITIALIZED = "NOT_INITIALIZED",
    INIT_FAILED = "INIT_FAILED",
    INITIALIZING = "INITIALIZING",
    INITIALIZED = "INITIALIZED"
}