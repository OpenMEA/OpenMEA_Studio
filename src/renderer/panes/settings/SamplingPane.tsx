import * as React from 'react'
import { ChartConfig } from 'client/renderer/model/ChartConfig';
import { AppContext } from '../../AppContext';
import { KeysMatching } from 'client/Utils';
import { SiNumberInput } from '../../components/SiNumberInput';
import { BandFilterConfig } from '../../model/BandFilterConfig';
import { CombFilterConfig } from '../../model/CombFilterConfig';
import { SaveFileConfigView } from './SaveFileConfigView';
import { DeviceInitState } from 'client/renderer/model/DeviceState';
import { AcDcMixConfig } from 'client/renderer/model/AcDcMixConfig';
import { DEVICE_NEUROPROBE, DEVICE_NWB_FILE, DEVICE_OPENMEA } from 'client/renderer/DeviceManager';
import { VisibleIf } from 'client/renderer/components/VisibleIf';
import { FileReplayControl } from './FileReplayControls';

export interface SamplingPaneProps {
    context: AppContext
}

export interface SamplingPaneState {
}

export class SamplingPane extends React.Component<SamplingPaneProps, SamplingPaneState> {
    constructor(props: SamplingPaneProps) {
        super(props)
        this.state = {
        }
    }

    render = () => {
        const context = this.props.context
        const deviceState = context.deviceState
        const chartConfig = context.chartConfig
        const acDcMixConfig = context.acDcMixConfig
        const bandFilterConfig = context.bandFilterConfig
        const deviceManager = context.deviceManager
        const deviceProps = deviceManager.deviceProps

        if (!deviceProps) {
            // Show only the device selection screen.
            return <div className="flex-none p-4" style={{ width: '350px' }}>
                <div className="mt-0">
                    <label className="sidebar-label">Connect to</label>
                    <select value={""} 
                            onChange={(evt) => deviceManager.setDevice(evt.target.value)}>
                        <option value="">Select a device</option>
                        <option value={DEVICE_OPENMEA}>{DEVICE_OPENMEA}</option>
                        <option value={DEVICE_NEUROPROBE}>{DEVICE_NEUROPROBE}</option>
                        <option value={DEVICE_NWB_FILE}>{DEVICE_NWB_FILE}</option>
                    </select>
                </div>
            </div>
        }

        //value={props.value} onChange={evt => props.onChange(evt.target.value)}
        return <div className="flex-none p-4" style={{ width: '350px' }}>
            <div className="mt-0">
                <label className="sidebar-label">Connect to</label>
                <select value={deviceProps.name} 
                        onChange={(evt) => deviceManager.setDevice(evt.target.value)}>
                    <option value={DEVICE_OPENMEA}>{DEVICE_OPENMEA}</option>
                    <option value={DEVICE_NEUROPROBE}>{DEVICE_NEUROPROBE}</option>
                    <option value={DEVICE_NWB_FILE}>{DEVICE_NWB_FILE}</option>
                </select>
            </div>
            <VisibleIf condition={deviceProps.canControlSampling}>
                <h2 className="mt-4 mb-2">
                    Sampling settings
                </h2>
                <div>
                    <label className="sidebar-label">Sampling frequency</label>
                    <SiNumberInput value={deviceState.samplesPerSec}
                        onChange={deviceManager.setSamplesPerSec} />
                    <span className="units">Hz</span>
                </div>
                <div className="mt-2">
                    <button className="mr-1"
                        onClick={() => deviceManager.startSampling()}>Start sampling</button>

                    <button onClick={() => deviceManager.stopSampling()}>Stop sampling</button>
                </div>
                {this.renderDeviceState()}
            </VisibleIf>
            <VisibleIf condition={deviceProps.canRecordToFile}>
                <h2 className="mt-4 mb-2">
                    Record
                </h2>
                <SaveFileConfigView config={context.saveFileConfig} onChange={context.setSaveFileConfig} />
            </VisibleIf>

            <VisibleIf condition={deviceProps.canControlReplay}>
                <h2 className="mt-4 mb-2">
                    NWB file controls
                </h2>
                <FileReplayControl context={context} />
            </VisibleIf>

            <h2 className="mt-4 mb-2">Charting</h2>
            <div className="mt-2">
                <label className="sidebar-label">Min value</label>
                <SiNumberInput value={chartConfig.showMinVolts}
                    onChange={this.handlChartConfigChange("showMinVolts")} />
                <span className="units">V</span>
            </div>
            <div className="mt-2">
                <label className="sidebar-label">Max value</label>
                <SiNumberInput value={chartConfig.showMaxVolts}
                    onChange={this.handlChartConfigChange("showMaxVolts")} />
                <span className="units">V</span>
            </div>
            <div className="mt-2">
                <label className="sidebar-label">Time scale</label>
                <SiNumberInput value={chartConfig.showTimePeriodSec}
                    onChange={this.handlChartConfigChange("showTimePeriodSec")} />
                <span className="units">s</span>
            </div>

            <VisibleIf condition={deviceProps.canSampleDC}>
                <h2 className="mt-4 mb-2">Combining AC+DC</h2>
                <div>
                    <label className="sidebar-label">AC multiplier</label>
                    <SiNumberInput value={acDcMixConfig.acMultiplier}
                        onChange={this.handlAcDcMixConfigChange("acMultiplier")} />
                </div>
                <div className="mt-2">
                    <label className="sidebar-label">DC multiplier</label>
                    <SiNumberInput value={acDcMixConfig.dcMultiplier}
                        onChange={this.handlAcDcMixConfigChange("dcMultiplier")} />
                </div>
            </VisibleIf>

            <h2 className="mt-4 mb-2">Spectrogram</h2>
            <div>
                <label className="sidebar-label">Calculation period</label>
                <SiNumberInput value={chartConfig.spectrogramCalculationPeriod}
                    onChange={this.handlChartConfigChange("spectrogramCalculationPeriod")} />
                <span className="units">s</span>
            </div>
            <div className="mt-2">
                <label className="sidebar-label">Max frequency</label>
                <SiNumberInput value={chartConfig.spectrogramMaxFreq}
                    onChange={this.handlChartConfigChange("spectrogramMaxFreq")} />
                <span className="units">Hz</span>
            </div>

            <h2 className="mt-4 mb-2">Filtering</h2>
            <div className="mt-2">
                <label className="sidebar-label">Low pass filter</label>
                <FilterPicker value={bandFilterConfig.lowFType}
                    onChange={this.handleBandFilterTypeChange('lowFType')} />
            </div>
            {this.renderLowPassOptions()}
            <div className="mt-2">
                <label className="sidebar-label">High pass filter</label>
                <FilterPicker value={bandFilterConfig.highFType}
                    onChange={this.handleBandFilterTypeChange('highFType')} />
            </div>
            {this.renderHighPassOptions()}
            {this.renderCombFilterDropdown()}
            {this.renderCombFilterOptions()}
        </div>;
    };

    // ==================== Private ======================

    private renderDeviceState = () => {
        const deviceState = this.props.context.deviceState
        
        let stateStr = ""
        let color = "text-gray-500";

        if (deviceState.isConnected === undefined || deviceState.isConnected === null) {
            stateStr = "Connecting to the device..."

        } else if (deviceState.isConnected === false) {
            stateStr = "Device is not connected"
            color = "text-red-500"
        
        } else if (deviceState.initState == DeviceInitState.NOT_INITIALIZED) {
            stateStr = "Device is not ready"
        
        } else if (deviceState.initState == DeviceInitState.INITIALIZING) {
            stateStr = "Initializing the device..."

            if (deviceState.numInitSteps && deviceState.initStepDone) {
                const percentDone = Math.round(100 * deviceState.initStepDone / deviceState.numInitSteps)
                stateStr += ` ${percentDone}%`
            }
        
        } else if (deviceState.initState == DeviceInitState.INIT_FAILED) {
            stateStr = "Failed to initialize the device"
            color = "text-red-500"

        } else if (deviceState.initState == DeviceInitState.INITIALIZED) {
            if (deviceState.isSampling) {
                stateStr = "Sampling..."
            } else {
                stateStr = "Ready to sample"
            }
        }

        return <div className={`mt-2 text-sm ${color}`}>
            { stateStr }
        </div>
    }

    private renderLowPassOptions = () => {
        const context = this.props.context
        const bandFilterConfig = context.bandFilterConfig

        if (bandFilterConfig.lowFType == 'none') {
            return null
        }

        return <div>
            <div className="mt-2">
                <label className="sidebar-label pl-3">Order</label>
                <SiNumberInput value={bandFilterConfig.lowOrder}
                                onChange={this.handleBandFilterConfigChange("lowOrder")} />
            </div>
            <div className="mt-2">
                <label className="sidebar-label pl-3">Cutoff frequency</label>
                <SiNumberInput value={bandFilterConfig.low3dbFreq}
                                onChange={this.handleBandFilterConfigChange("low3dbFreq")} />
                <span className="units">Hz</span>
            </div>
        </div>
    }

    private renderHighPassOptions = () => {
        const context = this.props.context
        const bandFilterConfig = context.bandFilterConfig

        if (bandFilterConfig.highFType == 'none') {
            return null
        }

        return <div>
            <div className="mt-2">
                <label className="sidebar-label pl-3">Order</label>
                <SiNumberInput value={bandFilterConfig.highOrder}
                                onChange={this.handleBandFilterConfigChange("highOrder")} />
            </div>
            <div className="mt-2">
                <label className="sidebar-label pl-3">Cutoff frequency</label>
                <SiNumberInput value={bandFilterConfig.high3dbFreq}
                                onChange={this.handleBandFilterConfigChange("high3dbFreq")} />
                <span className="units">Hz</span>
            </div>
        </div>
    }

    private renderCombFilterDropdown = () => {
        const combFilterConfig = this.props.context.combFilterConfig
        const onFreqChanged = this.handleCombFilterConfigChange('freq')

        return <div className="mt-2">
            <label className="sidebar-label" htmlFor="notchFilter60Hz">
                Comb filter
            </label>
            <select value={combFilterConfig.freq} 
                    onChange={evt => onFreqChanged(parseInt(evt.target.value))}>
                <option value="0">None</option>
                <option value="50">50 Hz</option>
                <option value="60">60 Hz</option>
            </select>
        </div>

    }

    private renderCombFilterOptions = () => {
        const combFilterConfig = this.props.context.combFilterConfig

        if (combFilterConfig.freq == 0) {
            return null
        }

        return <div>
            <div className="mt-2">
                <label className="sidebar-label pl-3">Q factor</label>
                <SiNumberInput value={combFilterConfig.qFactor}
                                onChange={this.handleCombFilterConfigChange("qFactor")} />
            </div>
            <div className="mt-2">
                <label className="sidebar-label pl-3">Order</label>
                <select value={combFilterConfig.order}
                        className="input-short"
                        style={{textAlignLast: 'right'}}
                        onChange={evt => this.handleCombFilterConfigChange("order")(parseInt(evt.target.value))}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                </select>
            </div>
        </div>
        
    }

    private handlChartConfigChange = (setting: KeysMatching<ChartConfig, number>) => {
        return (value: number) => {
            const context = this.props.context
            const oldChartConfig = context.chartConfig

            const newChartConfig = {...oldChartConfig}
            newChartConfig[setting] = value

            context.setChartConfig(newChartConfig)
        }
    }

    private handlAcDcMixConfigChange = (setting: KeysMatching<AcDcMixConfig, number>) => {
        return (value: number) => {
            const context = this.props.context
            const oldConfig = context.acDcMixConfig

            const newConfig = {...oldConfig}
            newConfig[setting] = value

            context.setAcDcMixConfig(newConfig)
        }
    }
    private handleBandFilterTypeChange = (field: 'lowFType' | 'highFType') => {
        return (value: string) => {
            const context = this.props.context
            const oldConfig = context.bandFilterConfig

            const newConfig = {...oldConfig}
            newConfig[field] = value

            context.setBandFilterConfig(newConfig)
        }
    }

    private handleBandFilterConfigChange = (field: KeysMatching<BandFilterConfig, number>) => {
        return (value: number) => {
            const context = this.props.context
            const oldConfig = context.bandFilterConfig

            const newConfig = {...oldConfig}
            newConfig[field] = value

            context.setBandFilterConfig(newConfig)
        }
    }

    private handleCombFilterConfigChange = (field: KeysMatching<CombFilterConfig, number>) => {
        return (value: number) => {
            const context = this.props.context
            const oldConfig = context.combFilterConfig

            const newConfig = {...oldConfig}
            newConfig[field] = value

            context.setCombFilterConfig(newConfig)
        }
    }
}

function FilterPicker(props: {value: string, onChange: (value: string) => void}) : JSX.Element {
    return <select value={props.value} onChange={evt => props.onChange(evt.target.value)}>
        <option value="none">None</option>
        <option value="butter">Butterworth</option>
        <option value="bessel">Bessel</option>
    </select>
}