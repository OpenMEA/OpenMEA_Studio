import * as React from 'react'

const fs = window.require('fs')
const path = window.require('path')
const process = window.require('process')
const APP_PATH = process.cwd()

export interface ModuleProps {
    name: string
}

export interface ModuleState {

}

export class UNitModule extends React.Component<ModuleProps, ModuleState> {
    constructor(props: ModuleProps) {
        super(props)

        this._moduleHtmlPath = getModuleDir(props.name)
    }

    render = () => {
        if (!this._moduleHtmlPath) {
            const devDir = getModuleDevDir(this.props.name)
            const distDir = getModuleDistDir(this.props.name)

            return <div className="w-full h-full">
                Could not find file '{devDir}' or '{distDir}'.
            </div>
        }

        return <iframe src={this._moduleHtmlPath} style={{width: '100%', height: '100%'}}></iframe>
    }

    // ======================= Private ====================
    private _moduleHtmlPath: string | null = null


}

function getModuleDir(moduleName: string) : string | null {
    let moduleHtmlPath = getModuleDevDir(moduleName)

    if (fs.existsSync(moduleHtmlPath)) {
        return moduleHtmlPath
    }

    moduleHtmlPath = getModuleDistDir(moduleName)

    if (fs.existsSync(moduleHtmlPath)) {
        return moduleHtmlPath
    }

    return null
}

function getModuleDevDir(moduleName: string) : string {
    // This is the location when we're doing development.
    return path.join(APP_PATH, 'engine', 'modules', moduleName, 'index.html')
}

function getModuleDistDir(moduleName: string) : string {
    // This is the location after packaging the Electron app.
    return path.join(APP_PATH, 'resources', 'engine', 'modules', moduleName, 'index.html')
}