import * as React from 'react'
import path from 'path'
import { remote } from 'electron'

export interface FilePickerProps {
    filePath: string | null | undefined
    disabled?: boolean
    dialogType: DialogType
    filters?: Electron.FileFilter[]
    onChange: (path: string) => void
}

export enum DialogType {
    OPEN, SAVE
}

export class FilePicker extends React.Component<FilePickerProps, {}> {
    render() {
        const props = this.props
        const filePath = this.props.filePath
        let fileSelector: JSX.Element

        if (filePath) {
            // A file has already been selected.
            const fileName = shortenName(path.basename(filePath))
            const changeLink = props.disabled ? null : 
                <a className="gray" href="" onClick={this.onClickSelectFile}>(Change)</a>

            fileSelector = <span>
                <span className="text-gray-600 mr-3">{fileName}</span> 
                { changeLink }
            </span>
        } else {
            fileSelector = <a className="gray" href="" onClick={this.onClickSelectFile}>(Select...)</a>
        }

        return <div className="mt-2">
            <span className="mr-0">File: </span>
            { fileSelector }
        </div>
    }

    // ================ Private =================
    private onClickSelectFile = (evt:any) => {
        evt.preventDefault()

        if (this.props.dialogType == DialogType.SAVE) {
            remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
                filters: this.props.filters,
                properties: ["showOverwriteConfirmation"]
            }).then(this.onSaveFileSelected)
        
        } else {
            remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
                filters: this.props.filters,
            }).then(this.onOpenFileSelected)
        }
    }

    private onSaveFileSelected = (result:any) => {
        if (result.canceled) {
            return
        }

        const filePath = result.filePath
        this.props.onChange(filePath)
    }

    private onOpenFileSelected = (result:any) => {
        if (result.canceled) {
            return
        }

        const filePath = result.filePaths[0]
        this.props.onChange(filePath)
    }
}

function shortenName(fileName: string) {
    if (fileName.length <= 30) {
        return fileName
    }

    const firstChunk = fileName.substring(0, 10);
    const lastChunk = fileName.substring(fileName.length - 14)
    return firstChunk + "..." + lastChunk
}