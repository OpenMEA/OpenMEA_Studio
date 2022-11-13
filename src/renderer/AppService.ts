import { OPENMEA_ELECTRODE_EXISTS, RESCALING_FILTER_CONFIG, INIT_SAMPLES_PER_SEC } from 'client/Constants';
import { ArrangeChannels, ChartConfig } from 'client/renderer/model/ChartConfig';
import { PythonInstallerRendererProxy } from 'client/services/python-installer/PythonInstallerRendererProxy';
import * as React from 'react'
import { AppContext, PythonInstallState } from './AppContext';
import { EngineClient } from './engine/EngineClient';
import { Pipeline } from './engine/Pipeline';
import { BandFilterConfig } from './model/BandFilterConfig';
import { CombFilterConfig } from './model/CombFilterConfig';
import { SaveFileConfig } from './model/SaveFileConfig';
import { StimConfig } from './model/StimConfig';
import { AcDcMixConfig } from './model/AcDcMixConfig';
import { DeviceManager } from './DeviceManager';

export interface AppServiceState {
    selectedElectrode: number
    deviceConnected: boolean | null
    
    chartConfig: ChartConfig
    acDcMixConfig: AcDcMixConfig
    bandFilterConfig: BandFilterConfig
    combFilterConfig: CombFilterConfig
    saveFileConfig: SaveFileConfig | null
    stimConfig: StimConfig

    lastResizedTimestamp: number
    lastFilterConfigChangeTimestamp: number

    isEngineReady: boolean
    pythonInstallState: PythonInstallState
}

export interface AppServiceProps {
    renderChildren: (timeTracker: AppContext) => JSX.Element
}

export class AppService extends React.Component<AppServiceProps, AppServiceState> {
    constructor(props: AppServiceProps) {
        super(props)

        // Initialize services
        this._engineClient = new EngineClient()
        this._engineClient.onReady(() => {
            this.setState({isEngineReady: true})
            this._engineClient.checkDeviceState()
            
            // Initialize the chip
            this._engineClient.configureStimulator(this.state.stimConfig).then(() => {})
        })

        this._pythonInstaller = new PythonInstallerRendererProxy()

        this._deviceManager = new DeviceManager(this._engineClient)
        this._deviceManager.onDeviceChanged(this.handleDeviceChanged)
        this._deviceManager.onDeviceStateChanged(() => this.forceUpdate())
        this._deviceManager.onSamplesPerSecChanged(this.handleDeviceSamplesPerSecChanged)

        // Initialize event handling
        window.onresize = this.resetLastResizedTimestamp

        // Initialize data
        const now = Date.now()

        let initialElectrode = 0
        while(!OPENMEA_ELECTRODE_EXISTS[initialElectrode]) {
            initialElectrode++
        }

        this.state = {
            selectedElectrode: initialElectrode,
            deviceConnected: null,

            chartConfig: {
                samplesPerSec: INIT_SAMPLES_PER_SEC,

                streamMinVolts: -0.1,
                streamMaxVolts: 0.1,
                showMinVolts: -0.0001,
                showMaxVolts: 0.0001,
                showTimePeriodSec: 5,
                arrangeChannels: ArrangeChannels.BY_POSITION,

                spectrogramCalculationPeriod: 0.1,
                spectrogramMaxFreq: 300,

                notchFilter60Hz: false
            } as ChartConfig,

            acDcMixConfig: {
                acMultiplier: 1,
                dcMultiplier: 0.0005
            },

            bandFilterConfig: {
                samplesPerSec: INIT_SAMPLES_PER_SEC,
                
                lowOrder: 2,
                low3dbFreq: 2000,
                lowRp: 0,
                lowRs: 0,
                lowFType: "none",
                
                highOrder: 2,
                high3dbFreq: 250,
                highRp: 0,
                highRs: 0,
                highFType: "none"
            },

            combFilterConfig: {
                samplesPerSec: INIT_SAMPLES_PER_SEC,
                freq: 0,
                qFactor: 30,
                order: 1
            },

            stimConfig: new StimConfig(),
            saveFileConfig: null,

            lastResizedTimestamp: now,
            lastFilterConfigChangeTimestamp: now,

            isEngineReady: false,
            pythonInstallState: PythonInstallState.UNKNOWN
        }
    }

    render = () => {
        const state = this.state

        const appContext = {
            engineClient: this._engineClient,
            isEngineReady: state.isEngineReady,
            pythonInstaller: this._pythonInstaller,
            pythonInstallState: state.pythonInstallState,
            deviceManager: this._deviceManager,

            selectedElectrode: state.selectedElectrode,
            deviceState: this._deviceManager.deviceState,

            chartConfig: state.chartConfig,
            acDcMixConfig: state.acDcMixConfig,
            bandFilterConfig: state.bandFilterConfig,
            combFilterConfig: state.combFilterConfig,
            saveFileConfig: state.saveFileConfig,
            stimConfig: state.stimConfig,

            lastResizeTimestamp: state.lastResizedTimestamp,
            lastFilterConfigChangeTimestamp: state.lastFilterConfigChangeTimestamp,

            setChartConfig: this.setChartConfig,
            setAcDcMixConfig: this.setAcDcMixConfig,
            setBandFilterConfig: this.setBandFilterConfig,
            setCombFilterConfig: this.setCombFilterConfig,
            setSaveFileConfig: this.setSaveFileConfig,
            setStimConfig: this.setStimConfig,
            notifyLayoutChanged: this.notifyLayoutChanged,

            setSelectedElectrode: this.setSelectedElectrode,
        } as AppContext

        return this.props.renderChildren(appContext);
    }

    componentDidMount = () => {
        this._pythonInstaller.getPythonInstalledStatus()
            .then(isInstalled => {
                this.setState({
                    pythonInstallState: 
                        isInstalled ? PythonInstallState.INSTALLED : PythonInstallState.NOT_INSTALLED
                })
            })

        this._pythonInstaller.onPythonInstalled(() => {
            this.setState({pythonInstallState: PythonInstallState.INSTALLED})
        })
    }


    // ====================== Private ======================
    private _engineClient : EngineClient
    private _savingFilePipeline : Pipeline | null = null
    private _pythonInstaller: PythonInstallerRendererProxy
    private _deviceManager: DeviceManager
    
    private _lastResizeIntervalId: number | null = null
    private _lastEmittedResizeTimestamp: number = 0
    private _lastResizeTimestamp: number = 0

    private setChartConfig = (chartConfig: ChartConfig) => {
        const state = this.state

        if (chartConfig.samplesPerSec == state.chartConfig.samplesPerSec) {
            this.setState({chartConfig: chartConfig})
        }

        const samplesPerSec = chartConfig.samplesPerSec
        
        this.setState({
            chartConfig: chartConfig,
            bandFilterConfig: {...state.bandFilterConfig, samplesPerSec: samplesPerSec},
            combFilterConfig: {...state.combFilterConfig, samplesPerSec: samplesPerSec},
            stimConfig: {...state.stimConfig, maxFrequency: samplesPerSec},
            lastFilterConfigChangeTimestamp: Date.now()
        })

        this._engineClient.configureStimulator({...state.stimConfig, maxFrequency: samplesPerSec})
            .then(() => {})
    }

    private setAcDcMixConfig = (config: AcDcMixConfig) => {
        this.setState({
            acDcMixConfig: config,
            lastFilterConfigChangeTimestamp: Date.now()
        })
    }

    private setBandFilterConfig = (config: BandFilterConfig) => {
        this.setState({
            bandFilterConfig: config,
            lastFilterConfigChangeTimestamp: Date.now()
        })
    }

    private setCombFilterConfig = (config: CombFilterConfig) => {
        this.setState({
            combFilterConfig: config,
            lastFilterConfigChangeTimestamp: Date.now()
        })
    }

    private setSaveFileConfig = async (config: SaveFileConfig): Promise<void> => {
        this.setState({saveFileConfig: config})

        const samplesPerSec = this.state.chartConfig.samplesPerSec

        if (config.recording && config.filePath) {
            this._savingFilePipeline = await this._engineClient.createPipeline([
                'electrodes',
                {
                    name: 'NwbFileWriter',
                    filePath: config.filePath,
                    offset: RESCALING_FILTER_CONFIG.offset,
                    conversion: RESCALING_FILTER_CONFIG.multiplier,
                    resolution: RESCALING_FILTER_CONFIG.multiplier,
                    samplesPerSec: samplesPerSec,
                    numElectrodes: this._deviceManager.deviceProps?.numElectrodes ?? 0
                }
            ])
            
        } else if (!config.recording && this._savingFilePipeline) {
            await this._savingFilePipeline.delete()
        }
    }

    private setStimConfig = async (config: StimConfig): Promise<void> => {
        await this._engineClient.configureStimulator(config)
        this.setState({stimConfig: config})
    }

    private setSelectedElectrode = (channel: number) => {
        this.setState({selectedElectrode: channel})
    }

    private notifyLayoutChanged = () => {
        this.resetLastResizedTimestamp()
    }

    private resetLastResizedTimestamp = () => {
        // Debounce the requests here. Otherwise, while the user is resizing the window,
        // the UI will make continuous requests to the back-end.
        this._lastResizeTimestamp =  Date.now()

        if (!this._lastResizeIntervalId) {
            console.log('start debouncing')
            this._lastResizeIntervalId = window.setInterval(this.onLastResizeIntervalTimeout, 1000)
            this.onLastResizeIntervalTimeout()
        }
    }

    private onLastResizeIntervalTimeout = () => {
        console.log('onLastResizedTimestampTimeout()')
        if (this._lastResizeTimestamp == this._lastEmittedResizeTimestamp) {
            console.log('stop debouncing')
            if (this._lastResizeIntervalId) {
                clearInterval(this._lastResizeIntervalId)
                this._lastResizeIntervalId = null
            }

        } else {
            console.log('emitting value')
            this._lastEmittedResizeTimestamp = this._lastResizeTimestamp
            this.setState({lastResizedTimestamp: this._lastResizeTimestamp})
        }
    }

    private handleDeviceSamplesPerSecChanged = (samplesPerSec: number) => {
        const state = this.state
        this.setState({
            bandFilterConfig: {...state.bandFilterConfig, samplesPerSec: samplesPerSec},
            combFilterConfig: {...state.combFilterConfig, samplesPerSec: samplesPerSec},
            stimConfig: {...state.stimConfig, maxFrequency: samplesPerSec},
            lastFilterConfigChangeTimestamp: Date.now()
        })
    }

    private handleDeviceChanged = () => {
        this.notifyLayoutChanged()
        this.forceUpdate()
    }
}
