import * as React from 'react'
import format from 'format-duration'
import { SaveFileConfig } from "../../model/SaveFileConfig";
import { DialogType, FilePicker } from 'client/renderer/components/FilePicker';

export interface SaveFileConfigViewProps {
    config: SaveFileConfig | null
    onChange: (config: SaveFileConfig) => void
}

export interface SaveFileConfigViewState {
    doneRecording: boolean
    recordingStartMillisec: number | null
    recordingElapsedMillisec: number | null
}

export class SaveFileConfigView extends React.Component<SaveFileConfigViewProps, SaveFileConfigViewState> {
    constructor(props: SaveFileConfigViewProps) {
        super(props)

        this.state = {
            doneRecording: false,
            recordingStartMillisec: null,
            recordingElapsedMillisec: null 
        }
    }
    
    render() {
        const config = this.props.config
        const state = this.state

        // Render "Record" / "Stop" button along with other info
        let recordButtonRow : JSX.Element | null = null

        if (config?.filePath) {
            const buttonAction = config.recording ? "Stop" : "Record"
            const buttonClass = config.recording ? "danger" : "primary"

            let elapsedTime : JSX.Element | null = null
            const elapsedMsec = state.recordingElapsedMillisec

            if (config.recording && elapsedMsec) {
                elapsedTime = <span className="inline-block text-red-500 ml-4">{ format(elapsedMsec) }</span>
            }

            recordButtonRow = <div className="mt-2">
                <button className={buttonClass}
                    onClick={this.onClickRecordButton} 
                    style={{width: '85px'}}>
                    {buttonAction}
                </button>
                { elapsedTime }
            </div>
        }

        const overwriteWarning = state.doneRecording ? 
            <p className="text-sm text-gray-300 mt-1">Recording again will overwrite the file</p>
            : null


        return <div>
            <FilePicker filePath={config?.filePath}
                        disabled={config?.recording}
                        dialogType={DialogType.SAVE}
                        filters={[
                            {name: 'NWB Files', extensions: ['nwb']},
                            {name: 'All Files', extensions: ['*']}
                        ]}
                        onChange={this.onFileSelected}/>
            { recordButtonRow }
            { overwriteWarning }
        </div>
    }

    // =================== Private =================
    private onFileSelected = (filePath: string) => {
        const oldConfig = this.props.config
        const newConfig = oldConfig ? {...oldConfig, filePath} : {filePath, recording: false}

        this.setState({doneRecording: false, recordingStartMillisec: null})
        this.props.onChange(newConfig)
    }

    private onClickRecordButton = (evt:any) => {
        const oldConfig = this.props.config!!
        const newConfig = { ...oldConfig, recording: !oldConfig.recording }

        if (newConfig.recording) {
            this.setState({
                doneRecording: false,
                recordingStartMillisec: Date.now(),
                recordingElapsedMillisec: 0
            })
            
            setTimeout(this.updateElapsedTime, 250)
        
        } else {
            this.setState({
                doneRecording: true,
                recordingStartMillisec: null,
                recordingElapsedMillisec: null
            })
        }


        this.props.onChange(newConfig)
    }

    private updateElapsedTime = () => {
        if (!this.props.config?.recording) {
            return
        }

        this.setState({
            recordingElapsedMillisec: Date.now() - this.state.recordingStartMillisec!!
        })

        setTimeout(this.updateElapsedTime, 250)
    }
}