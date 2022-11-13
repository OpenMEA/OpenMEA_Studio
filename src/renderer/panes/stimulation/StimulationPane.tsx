import * as React from 'react'
import { BiphasicStimulationConfig, isBiphasic, isWavFile, PulseConfig, PulseType, StimConfig, WavStimulationConfig } from 'client/renderer/model/StimConfig';
import { SiNumberInput } from 'client/renderer/components/SiNumberInput';
import { formatSI, KeysMatching } from 'client/Utils';
import { STIM_STEP_SIZES } from 'client/Constants';
import { DeviceState } from 'client/renderer/model/DeviceState';
import { ElectrodePicker } from 'client/renderer/components/ElectrodePicker';
import { VisibleIf } from 'client/renderer/components/VisibleIf';
import { WavConfigView } from './WavPulseConfigView';

export interface StimulationPaneProps {
    stimConfig: StimConfig
    selectedElectrode: number
    deviceState: DeviceState
    setStimConfig: (config: StimConfig) => void
    startStim: () => Promise<void>
    stopStim: () => Promise<void>
}

export interface StimulationPaneState {
}

export class StimulationPane extends React.Component<StimulationPaneProps, StimulationPaneState> {
    constructor(props: StimulationPaneProps) {
        super(props)
        this.state = {
        }
    }
    
    render = () => {
        const stimConfig = this.props.stimConfig
        let pulseConfigView: JSX.Element
        const deviceConfig = this.props.deviceState
        const isStimulating = deviceConfig.isStimulating
        const isSampling = deviceConfig.isSampling
        const isConnected = deviceConfig.isConnected
        
        let hasElectrodes = false
        for (let electrodes of stimConfig.electrodesByPulse) {
            if (electrodes.length > 0) {
                hasElectrodes = true
                break
            }
        }

        if (isWavFile(stimConfig.pulseConfig)) {
            pulseConfigView = <WavConfigView stimConfig={stimConfig}
                                             onConfigChanged={this.props.setStimConfig}/>
        
        } else if (isBiphasic(stimConfig.pulseConfig)) {
            pulseConfigView = <BiphasicConfigView config={stimConfig.pulseConfig}
                                                  stimStepSizeIndex={stimConfig.stimStepSizeIndex}
                                                  maxFrequency={stimConfig.maxFrequency}
                                                  onChange={this.onPulseConfigChange} />
        } else {
            pulseConfigView = <div className="mt-2">This shouldn't be here</div>
        }

        return <div className="flex-none flex flex-col overflow-hidden p-4"
                    style={{width: '320px'}}>
            <h2 className="mt-0">
                Stimulation settings &emsp;
            </h2>
            <div className="mt-2">
                <label className="sidebar-label">Min current step</label>
                <select onChange={this.onStimStepSizeChanged} value={stimConfig.stimStepSizeIndex}>
                    <option value={0}>10 nA</option>
                    <option value={1}>20 nA</option>
                    <option value={2}>50 nA</option>
                    <option value={3}>100 nA</option>
                    <option value={4}>200 nA</option>
                    <option value={5}>500 nA</option>
                    <option value={6}>1 μA</option>
                    <option value={7}>2 μA</option>
                    <option value={8}>5 μA</option>
                    <option value={9}>10 μA</option>
                </select>
            </div>

            <div className="mt-2">
                <label className="sidebar-label">Pulse waveform</label>
                <select onChange={this.onPulseTypeChanged} value={stimConfig.pulseType}>
                    <option value={PulseType.WAV_FILES}>.wav file</option>
                    <option value={PulseType.BIPHASIC}>Biphasic</option>
                </select>
            </div>

            { pulseConfigView }

            <h2 className="mt-6 mb-0">
                Electrodes to stimulate
            </h2>

            <VisibleIf condition={stimConfig.electrodesByPulse.length > 0}>
                <ElectrodePicker electrodesByPulse={stimConfig.electrodesByPulse}
                                onElectrodeSelectionsChanged={this.onElectrodeSelectionChanged}/>
            </VisibleIf>
            <div className="mt-6">
                <button className="primary" 
                        disabled={!isConnected || !isSampling || isStimulating || !hasElectrodes}
                        style={{width: '120px'}}
                        onClick={() => this.props.startStim().then(() => {})}>
                    { isStimulating ? "Stimulating..." : "↯ Stimulate"}
                </button>
                <VisibleIf condition={isStimulating}>
                    <button className="danger ml-4"
                            onClick={() => this.props.stopStim().then(() => {})}> 
                        Stop
                    </button>
                </VisibleIf>
            </div>
            <VisibleIf condition={!isConnected}>
                <div className="mt-2 text-xs text-gray-700">Device not connected</div>
            </VisibleIf>
            <VisibleIf condition={(isConnected && !isSampling)}>
                <div className="mt-2 text-xs text-gray-700">Cannot stimulate when sampling is not on</div>
            </VisibleIf>
            <VisibleIf condition={(isConnected && isSampling && !hasElectrodes)}>
                <div className="mt-2 text-xs text-gray-700">No electrodes selected</div>
            </VisibleIf>

        </div>
    }

    // ======================= Private =======================
    private onStimStepSizeChanged = (evt:any) => {
        const stimStepSizeIndex = parseInt(evt.target.value)
        this.props.setStimConfig({
            ...this.props.stimConfig,
            stimStepSizeIndex: stimStepSizeIndex
        })
    }
   
    private onPulseTypeChanged = (evt:any) => {
        const pulseType = evt.target.value as PulseType
        const pulseConfig = pulseType == PulseType.WAV_FILES ? new WavStimulationConfig()
                                                            : new BiphasicStimulationConfig()

        const oldStimConfig = this.props.stimConfig
        this.props.setStimConfig({
            ...oldStimConfig,
            pulseType: pulseType,
            pulseConfig: pulseConfig,
            electrodesByPulse: pulseType == PulseType.WAV_FILES? [] : [[]]
        })
    }

    private onPulseConfigChange = (pulseConfig: PulseConfig) => {
        const oldStimConfig = this.props.stimConfig
        this.props.setStimConfig({
            ...oldStimConfig,
            pulseConfig: pulseConfig
        })
    }

    private onElectrodeSelectionChanged = (electrodesByPulse: number[][]) => {
        const oldStimConfig = this.props.stimConfig
        this.props.setStimConfig({
            ...oldStimConfig,
            electrodesByPulse: electrodesByPulse
        })
    }
}

interface BiphasicPulseConfigView {
    config: BiphasicStimulationConfig
    stimStepSizeIndex: number
    maxFrequency: number
    onChange: (config: BiphasicStimulationConfig) => void
}

function BiphasicConfigView(props: BiphasicPulseConfigView) {
    const config = props.config
    const onDurationChanged = (setting: KeysMatching<BiphasicStimulationConfig, number>) => {
        return (value: number) => {
            const newConfig = { ...config }
            newConfig[setting] = roundToNearestFreqMultiple(value, props.maxFrequency)

            // Typically we want phase 2 to mirror phase 1.
            if (setting == 'phase1Duration') {
                newConfig.phase2Duration = value
            }

            props.onChange(newConfig)
        }
    }
    
    const onAmplitudeChanged = (setting: KeysMatching<BiphasicStimulationConfig, number>) => {
        return (value: number) => {
            const newConfig = { ...config }
            newConfig[setting] = roundToStepSizeMultiple(value, props.stimStepSizeIndex)

            // Typically we want phase 2 to mirror phase 1.
            if (setting == "phase1Current") {
                newConfig.phase2Current = -value
            }

            props.onChange(newConfig)
        }
    }

    const chargeBalance = config.phase1Duration * config.phase1Current +
                          config.phase2Duration * config.phase2Current

    let chargeBalanceView: JSX.Element | null

    if (Math.abs(chargeBalance) < Math.abs(STIM_STEP_SIZES[props.stimStepSizeIndex] / props.maxFrequency)) {
        chargeBalanceView = <div className="mt-2">
            <span className="text-green-500">Charge is balanced.</span>
        </div>
    
    } else {
        chargeBalanceView = <div className="mt-2">
            <span className="text-red-500">Net charge change: {formatSI(chargeBalance)}C.</span>
        </div>
    }

    return <div>
        <div className="mt-2">
            <label className="sidebar-label">Phase 1 duration</label>
            <SiNumberInput value={config.phase1Duration}
                                onChange={onDurationChanged("phase1Duration")} />
            <span className="units">s</span>
        </div>
        <div className="mt-2">
            <label className="sidebar-label">Phase 1 current</label>
            <SiNumberInput value={config.phase1Current}
                                onChange={onAmplitudeChanged("phase1Current")} />
            <span className="units">A</span>
        </div>
        <div className="mt-2">
            <label className="sidebar-label">Interphase duration</label>
            <SiNumberInput value={config.interphaseDuration}
                                onChange={onDurationChanged("interphaseDuration")} />
            <span className="units">s</span>
        </div>
        <div className="mt-2">
            <label className="sidebar-label">Phase 2 duration</label>
            <SiNumberInput value={config.phase2Duration}
                                onChange={onDurationChanged("phase2Duration")} />
            <span className="units">s</span>
        </div>
        <div className="mt-2">
            <label className="sidebar-label">Phase 2 current</label>
            <SiNumberInput value={config.phase2Current}
                                onChange={onAmplitudeChanged("phase2Current")} />
            <span className="units">A</span>
        </div>
        { chargeBalanceView }
    </div>
}

function roundToStepSizeMultiple(value: number, stimStepSizeIndex: number): number {
    const stimStepSize = STIM_STEP_SIZES[stimStepSizeIndex]
    const nearestMultiple = Math.round(value / stimStepSize)
    const roudedCurrent = nearestMultiple * stimStepSize
    const maxCurrent = 255 * stimStepSize

    return Math.max(-maxCurrent, Math.min(maxCurrent, roudedCurrent))
}

function roundToNearestFreqMultiple(value: number, maxFrequency: number): number {
    const nearestMultiple = Math.round(value * maxFrequency)   // = value / (period) = value / (1/freq)
    return nearestMultiple / maxFrequency // = nearestMultiple * period
}