import { AppContext } from "client/renderer/AppContext"
import { DialogType, FilePicker } from "client/renderer/components/FilePicker"
import React, { useState } from "react"
import format from 'format-duration'
import Slider from 'rc-slider'
import { VisibleIf } from "client/renderer/components/VisibleIf"

export const FileReplayControl = (props: {context: AppContext}) => {
    const [filePath, setFilePath] = useState<string|null>(null)
    const [isLoadingFile, setLoadingFile] = useState<boolean>(false)
    const [sliderMovedTo, setSliderMovedTo] = useState<number>(0)
    const [isSliderBeingMoved, setSliderBeingMoved] = useState<boolean>(false)
    const [elapsedSamplesBeforeMove, setElapsedSamplesBeforeMove] = useState<number|null>(null)

    const engineClient = props.context.engineClient
    const deviceState = props.context.deviceState

    const onFileSelected = async (newFilePath: string) => {
        setFilePath(newFilePath)
        setLoadingFile(true)
        await engineClient.openFile(newFilePath)
        setLoadingFile(false)
    }


    const onTogglePlay = (evt:any) => {
        if (deviceState.isSampling) {
            engineClient.stopSampling()
        } else {
            engineClient.startSampling()
        }
    }

    const onSliderDragged = (newValue:number|number[]) => {
        setElapsedSamplesBeforeMove(deviceState.replayPositionSample)
        setSliderBeingMoved(true)

        if (Array.isArray(newValue)) {
            setSliderMovedTo(newValue[0])
        } else {
            setSliderMovedTo(newValue)
        }
    }

    const onSliderLetGo = async (newValue:number|number[]) => {
        let sliderValue: number

        if (Array.isArray(newValue)) {
            sliderValue = newValue[0]
        } else {
            sliderValue = newValue
        }

        if (newValue == deviceState.replayPositionSample) {
            // Already here; no need to do extra work.
            setSliderBeingMoved(false)
            setElapsedSamplesBeforeMove(null)
            return
        }

        setLoadingFile(true)
        await engineClient.seekTo(sliderValue)
        setSliderBeingMoved(false)
        // The rest will complete in the 'elapsedTime' variable calculation.
        // We'll have to wait for the engine to send us a new data+state update.
    }

    let buttonText = deviceState.isSampling ? "Pause" : "Play"
    if (isLoadingFile) {
        buttonText = "Loading..."
    }

    // Update the displayed elapsed time. 
    let elapsedSamples = 0

    if (isSliderBeingMoved) {
        elapsedSamples = sliderMovedTo
    
    } else if (deviceState.replayPositionSample === elapsedSamplesBeforeMove) {
        elapsedSamples = sliderMovedTo
    
    } else if (deviceState.replayLengthSamples !== null) {
        if (elapsedSamplesBeforeMove !== null) {
            // End seeking to new position
            setLoadingFile(false)
            setElapsedSamplesBeforeMove(null)
        }

        elapsedSamples = (deviceState.replayPositionSample!!)
    }

    const elapsedTime = elapsedSamples / deviceState.samplesPerSec
    let elapsedTimeMessage = ""

    if (deviceState.replayLengthSamples !== null) {
        const totalTime = format(deviceState.replayLengthSamples / deviceState.samplesPerSec * 1000)
        const replayPositionSec = format(elapsedTime * 1000)
        elapsedTimeMessage = `${replayPositionSec} / ${totalTime}`
    }

    // Due to lag between the UI and the engine, the engine may send a few updates after 
    // the user clicks on the slider to go to the new time location. 
    // This block is necessary to prevent the slider from jumping around.
    if (isLoadingFile && (elapsedSamplesBeforeMove != deviceState.replayPositionSample)) {
        setElapsedSamplesBeforeMove(deviceState.replayPositionSample)
    }

    return <React.Fragment>
        <FilePicker filePath={filePath}
                    dialogType={DialogType.OPEN}
                    filters={[
                        {name: 'All Files', extensions: ['*']}
                    ]}
                    onChange={onFileSelected}/>
        <div className="mt-2 mb-3">
            <button className="mr-1" 
                    onClick={onTogglePlay}
                    style={{width: '100px'}}
                    disabled={!deviceState.isConnected || isLoadingFile}>{buttonText}</button>
            <span className="ml-4">{elapsedTimeMessage}</span>
        </div>
        <VisibleIf condition={deviceState.replayLengthSamples !== null}>
            <Slider min={0} max={deviceState.replayLengthSamples!!} value={elapsedSamples}
                onChange={onSliderDragged} onAfterChange={onSliderLetGo}/>
        </VisibleIf>

    </React.Fragment>
}
