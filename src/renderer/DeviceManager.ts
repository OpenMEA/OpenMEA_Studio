import EventEmitter from "events";
import { EngineClient } from "./engine/EngineClient";
import { DeviceProperties } from "./model/DeviceProperties";
import { DeviceInitState, DeviceState, deviceStateDidNotChange } from "./model/DeviceState";

export const DEVICE_OPENMEA = 'OpenMEA'
export const DEVICE_NEUROPROBE = 'Neuroprobe'
export const DEVICE_NWB_FILE = 'NWB file'

export class DeviceManager {
    deviceProps: DeviceProperties | null = null
    deviceState: DeviceState = new DeviceState()

    constructor(engineClient: EngineClient) {
        this.deviceProps = null //AVAILABLE_DEVICE_PROPERTIES[DEVICE_NWB_FILE]
        this._engineClient = engineClient
        engineClient.onDeviceStateUpdated(this.handleDeviceMessage)
    }

    onDeviceChanged = (handler: () => void) => {
        this._eventEmitter.on('deviceChanged', handler)
    }

    onSamplesPerSecChanged = (handler: (samplesPerSec:number) => void) => {
        this._eventEmitter.on('samplesPerSecChanged', handler)
    }

    onDeviceStateChanged = (handler: () => void) => {
        this._eventEmitter.on('deviceStateChanged', handler)
    }

    setSamplesPerSec = async (samplesPerSec: number): Promise<void> => {
        const deviceState = this.deviceState

        if (samplesPerSec == deviceState.samplesPerSec) {
            return
        }
        
        deviceState.samplesPerSec = samplesPerSec
        this._engineClient.setSamplesPerSec(samplesPerSec);
        // We will not emit any events here.
        // Once the engine updates the device's sampling rate, it will
        // send us a message, which will be picked up by handleDeviceMessage().
        // This will trigger a series of events that will update samplesPerSec
        // everywhere else.
    }

    startSampling = async () : Promise<void> => {
        await this._engineClient.startSampling()
    }

    stopSampling = async () : Promise<void> => {
        await this._engineClient.stopSampling()
    }

    setDevice = async (deviceName: string) => {
        this.deviceProps = new DeviceProperties({name: deviceName})
        //this.deviceProps = AVAILABLE_DEVICE_PROPERTIES[deviceName]
        this.emitDeviceStateChanged()
        await this._engineClient.connectToDevice(deviceName)
        this.emitDeviceChanged()
    }

    // ------------------- Private -------------------
    private _engineClient: EngineClient
    private _eventEmitter: EventEmitter = new EventEmitter()

    private handleDeviceMessage = (messages: Partial<DeviceState>[]) => {
        if (messages.length === undefined || messages.length == 0) {
            return
        }

        // Merge the messages. For each field, only its final value matters.
        let deviceStateUpdate = {} as Partial<DeviceState>
        for (let message of messages) {
            Object.assign(deviceStateUpdate, message);
        }

        const oldDeviceState = this.deviceState
        const newDeviceState = new DeviceState(oldDeviceState)
        Object.assign(newDeviceState, deviceStateUpdate)

        if (deviceStateUpdate.deviceProps) {
            newDeviceState.deviceProps = new DeviceProperties(deviceStateUpdate.deviceProps)
            this.deviceProps = newDeviceState.deviceProps
        }

        if (deviceStateDidNotChange(oldDeviceState, newDeviceState) && !deviceStateUpdate.deviceProps) {
            return
        }

        this.deviceState = newDeviceState

        if (oldDeviceState.samplesPerSec != newDeviceState.samplesPerSec) {
            this.emitSamplesPerSecChanged(newDeviceState.samplesPerSec);
        }

        this.emitDeviceStateChanged();

        if (!oldDeviceState.isConnected && newDeviceState.initState == DeviceInitState.NOT_INITIALIZED) {
            // Just connected to a device that was not initialized.
            this._engineClient.initializeDevice().then(() => {});
        }
    }

    private emitDeviceChanged = () => {
        this._eventEmitter.emit('deviceChanged');
    }

    private emitDeviceStateChanged = () => {
        this._eventEmitter.emit('deviceStateChanged');
    }

    private emitSamplesPerSecChanged = (samplesPerSec: number) => {
        this._eventEmitter.emit('samplesPerSecChanged', samplesPerSec);
    }
}