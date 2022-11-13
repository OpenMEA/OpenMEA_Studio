import * as url from 'url'
import * as path from 'path'
import { BrowserWindowConstructorOptions } from 'electron'
import { AppWindow } from './AppWindow'

// Main studio window
const mainWindowUrl = url.format({
    pathname: path.join(__dirname, './index.html'),
    protocol: 'file:',
    slashes: true,
})

const mainWindowOptions = {
    height: 900,
    width: 1500,
    //fullscreen: true,
    autoHideMenuBar: true,
    title: "OpenMEA Studio",
    frame: true,
    show: false,
    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false,
        enableRemoteModule: true
    }
} as BrowserWindowConstructorOptions

export const mainWindow = new AppWindow(mainWindowUrl, mainWindowOptions, 1, false)
