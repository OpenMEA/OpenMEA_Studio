import * as React from 'react'
import { PythonInstallState } from './AppContext'
import { AppProps } from './AppProps'
import { LogView } from './components/LogView'
import { SamplingPane } from './panes/settings/SamplingPane'
import { VisibleIf } from './components/VisibleIf'
import { ElectrophysiologyPane } from './panes/electrophysiology/ElectrophysiologyPane'
import { StimulationPane } from './panes/stimulation/StimulationPane'

export interface AppState {
    showSampling: boolean
    showStim: boolean
}

export class App extends React.Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props)

        this.state = {
            showSampling: true,
            showStim: true,
        }
    }


    render = () => {
        const props = this.props
        const context = props.context
        const engine = context.engineClient
        const state = this.state

        const pythonInstallState = context.pythonInstallState

        if (pythonInstallState == PythonInstallState.UNKNOWN) {
            return <div style={{width: '100vw', height: '100vh', textAlign: 'center', lineHeight: '100%',}}>
                Initializing...
            </div>
        }

        if (pythonInstallState == PythonInstallState.NOT_INSTALLED) {
            return <div style={{width: '100vw', height: '100vh'}}
                        className="flex flex-col overflow-hidden">
                <h2 className="flex-0 mt-4 ml-4">Setting up Python</h2>
                <div className="flex-auto overflow-hidden">
                <LogView logEmitter={context.pythonInstaller} />
                </div>
            </div>
        }

        if (!context.isEngineReady) {
            return <div style={{width: '100vw', height: '100vh', textAlign: 'center', lineHeight: '100%',}}>
                Starting the Python engine. This can take up to a minute.
            </div>
        }

        // Settings pane
        const onClickSettingsTab = () => {
            this.setState({showSampling: !state.showSampling})
            context.notifyLayoutChanged();
        }

        // Stim pane
        const onClickStimTab = () => {
            this.setState({showStim: !state.showStim})
            context.notifyLayoutChanged();
        }

        const selectedElectrode = context.selectedElectrode
        const deviceProps = this.props.context.deviceManager.deviceProps

        return <div style={{width: '100vw', height: '100vh'}} className="flex flex-row overflow-hidden">
            <div className="pt-4" style={{width:'30px'}}>
                <LeftTab text='Sampling' onClick={onClickSettingsTab} selected={state.showSampling}/>
            </div>
            <VisibleIf condition={state.showSampling}>
                <SamplingPane context={context} />
            </VisibleIf>
            <ElectrophysiologyPane context={context} />
            <VisibleIf condition={state.showStim && deviceProps && deviceProps.canStimulate}>
                <StimulationPane stimConfig={context.stimConfig}
                                selectedElectrode={selectedElectrode}
                                deviceState={context.deviceState}
                                setStimConfig={context.setStimConfig}
                                startStim={engine.startStim}
                                stopStim={engine.stopStim} />
            </VisibleIf>
            <VisibleIf condition={deviceProps && deviceProps.canStimulate}>
                <div className="pt-4" style={{width:'30px'}}>
                    <RightTab text='Stimulation' onClick={onClickStimTab} selected={state.showStim}/>
                </div>
            </VisibleIf>
        </div>
    }
}

interface TabProps {
    text: string
    selected: boolean
    onClick: () => void
}

function LeftTab(props: TabProps) {
    const style = {
        display: 'block',
        border: '1px solid lightgray',
        borderRadius: '2px',
        width: '90px',
        height: '25px',
        transform: 'rotate(-90deg) translate(-36px,-34px)',
        textAlign: 'center'
    } as React.CSSProperties

    const onClick = (evt:any) => {
        evt.preventDefault()
        props.onClick()
        return false
    }

    let className = "text-sm text-gray-800 hover:text-gray-800 active:text-gray-800 " + 
                    "cursor-pointer hover:bg-gray-100 select-none"

    if (props.selected) {
        className += " bg-gray-100"
    } else {
        className += " bg-gray-50"
    }

    return <a style={style} onClick={onClick}
            className={className}>
        { props.text }
    </a>
}

function RightTab(props: TabProps) {
    const style = {
        display: 'block',
        border: '1px solid lightgray',
        borderRadius: '2px',
        width: '90px',
        height: '25px',
        transform: 'rotate(90deg) translate(36px,26px)',
        textAlign: 'center'
    } as React.CSSProperties

    const onClick = (evt:any) => {
        evt.preventDefault()
        props.onClick()
        return false
    }

    let className = "text-sm text-gray-800 hover:text-gray-800 active:text-gray-800 " + 
                    "cursor-pointer hover:bg-gray-100 select-none"

    if (props.selected) {
        className += " bg-gray-100"
    } else {
        className += " bg-gray-50"
    }

    return <a style={style} onClick={onClick}
            className={className}>
        { props.text }
    </a>
}