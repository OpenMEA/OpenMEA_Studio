import * as React from 'react'
import { remote } from 'electron'
import path from 'path';
import { isWavFile, StimConfig, WavStimulationConfig } from 'client/renderer/model/StimConfig';
import { PULSE_COLORS } from 'client/Constants';

export interface WavConfigViewProps {
    stimConfig: StimConfig
    onConfigChanged: (config: StimConfig) => void
}

export interface WavConfigViewState {

}

export class WavConfigView extends React.Component<WavConfigViewProps, WavConfigViewState> {
    render = () => {
        const stimConfig = this.props.stimConfig
        const pulseConfig = stimConfig.pulseConfig

        if (!isWavFile(pulseConfig)) {
            return <div className="text-red-500">pulseConfig is not .wav config</div>
        }

        const fileViews: JSX.Element[] = []

        for (let i = 0; i < pulseConfig.filePaths.length; i++) {
            const filePath = pulseConfig.filePaths[i]
            const fileName = path.basename(filePath)

            const color = PULSE_COLORS[i % PULSE_COLORS.length]

            const fileView = <tr key={'file-' + i} className="pt-1">
                <td style={{width: '23px', textAlign: 'center', verticalAlign: 'middle'}}>
                    <span className={`block m-0 text-xs border border-${color}-500 bg-${color}-100 rounded-full text-center text-gray-800`}
                          style={{
                              width: '23px',
                              height: '23px',
                              paddingTop: '2px',
                              marginTop: '2px'
                          }}>
                        {i + 1}
                    </span>
                </td>
                <td className="pl-4">{fileName}</td>
                <td style={{width:'60px'}}>
                    <button className="text-xs" onClick={() => this.onFileRemoved(i)}>Remove</button>
                </td>
            </tr>

            fileViews.push(fileView)
        }

        return <div>
            <div className="mt-2">
                <label className="sidebar-label">Keep looping</label>
                <input type="checkbox" checked={stimConfig.loopForever} onChange={this.onKeepLoopingClicked}/>
            </div>
            <h2 className="mt-6">Select files</h2>
            <table className="mt-2" style={{width: '100%'}}>
                <tbody>
                    {fileViews}
                </tbody>
            </table>
            <p className="mt-2">
                <a href="" onClick={this.onClickAddFile}>Add file</a>
            </p>
        </div>
    }

    //================== Private ====================
    private onClickAddFile = (evt:any) => {
        evt.preventDefault()

        showOpenWavFileDialog().then(result => {
            if (result.canceled) {
                return
            }

            const oldConfig = this.props.stimConfig
            const oldWavConfig = oldConfig.pulseConfig as WavStimulationConfig
            const newFiles = [...oldWavConfig.filePaths, result.filePaths[0]]
            const newWavConfig = {
                filePaths: newFiles
            } as WavStimulationConfig

            const newElectrodesByPulse = [...oldConfig.electrodesByPulse]
            newElectrodesByPulse.push([])

            this.props.onConfigChanged({
                ...this.props.stimConfig,
                pulseConfig: newWavConfig,
                electrodesByPulse: newElectrodesByPulse
            })
        })
    }

    private onFileRemoved = (fileIndex: number) => {
        const oldConfig = this.props.stimConfig
        const oldWavConfig = oldConfig.pulseConfig as WavStimulationConfig
        const newFiles = oldWavConfig.filePaths.slice()
        newFiles.splice(fileIndex, 1)

        const newElectrodesByPulse = oldConfig.electrodesByPulse.slice()
        newElectrodesByPulse.splice(fileIndex, 1)
        
        const newWavConfig = {
            filePaths: newFiles
        } as WavStimulationConfig
        
        this.props.onConfigChanged({
            ...this.props.stimConfig,
            pulseConfig: newWavConfig,
            electrodesByPulse: newElectrodesByPulse
        })
    }

    private onKeepLoopingClicked = (evt:any) => {
        const checked = evt.target.checked
        this.props.onConfigChanged({
            ...this.props.stimConfig,
            loopForever: checked
        })
    }

}

function showOpenWavFileDialog() : Promise<any> {
    return remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
        filters: [
            {name: '.wav Files', extensions: ['wav']},
            {name: 'All Files', extensions: ['*']}
        ],
    })
}
