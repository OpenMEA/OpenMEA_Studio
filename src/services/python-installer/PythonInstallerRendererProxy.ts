import { ipcRenderer } from "electron";
import { EventEmitter } from "events";
import { ILogEmitter } from "../ILogEmitter";
import { IPC_CHANNEL_PYTHON_INSTALLED_EVENT, IPC_CHANNEL_PYTHON_INSTALLLOG_MESSAGE, IPC_CHANNEL_PYTHON_INSTALL_STATUS_REPLY, IPC_CHANNEL_PYTHON_INSTALL_STATUS_REQUEST } from "./PythonInstallIpcChannels";

const NEW_LOG_EVENT = 'l'
const PYTHON_INSTALLED_EVENT = 'p'

export class PythonInstallerRendererProxy implements ILogEmitter {
    constructor() {
        ipcRenderer.on(IPC_CHANNEL_PYTHON_INSTALLLOG_MESSAGE, this.handleLogMessage)
        ipcRenderer.on(IPC_CHANNEL_PYTHON_INSTALL_STATUS_REPLY, this.handleInstallStatusReply)

        ipcRenderer.on(IPC_CHANNEL_PYTHON_INSTALLED_EVENT, () => {
            this._eventEmitter.emit(PYTHON_INSTALLED_EVENT)
        })
    }

    onLogMessage = (handler: (log: string) => void) => {
        this._eventEmitter.addListener(NEW_LOG_EVENT, handler)
    }

    getPythonInstalledStatus = async () : Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            this._resolveStatusRequest = resolve
            ipcRenderer.send(IPC_CHANNEL_PYTHON_INSTALL_STATUS_REQUEST, null)
        })
    }

    onPythonInstalled = (handler: () => void) => {
        this._eventEmitter.addListener(PYTHON_INSTALLED_EVENT, handler)
    }

    // ================ Private =================
    private _eventEmitter = new EventEmitter()
    private _resolveStatusRequest: ((result: boolean) => void) | null = null

    private handleLogMessage = (event: any, args: any) => {
        this._eventEmitter.emit(NEW_LOG_EVENT, args as string)
    }

    private handleInstallStatusReply = (event: any, args: any) => {
        this._resolveStatusRequest?.(args as boolean)
        this._resolveStatusRequest = null
    }
}