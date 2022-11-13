import { PythonInstallerMain } from 'client/services/python-installer/PythonInstallerMain';
import { app } from 'electron';
import log from 'electron-log'
import * as process from 'process'
import { EngineProcess } from './EngineProcess';

import { mainWindow } from './windows'

//app.commandLine.appendSwitch('enable-logging')

const PID = process.pid
log.info(`[p:${PID}] ============ Starting OpenMEA Studio ================`)

let isSpecialStartup = false

log.info(`[p:${PID}] Process path: ${process.execPath}`)
log.info(`[p:${PID}] Process cwd: ${process.cwd()}`)
log.info(`[p:${PID}] Process argv:`)
if (process.argv.length > 1) {
    for (const arg of process.argv) {
        log.info(`[p:${PID}]     ${arg}`)
    }
}

//============= Handle install/update/other special tasks ================
const isSquirrelSpecialStartup = require('electron-squirrel-startup')

if (isSquirrelSpecialStartup) {
    isSpecialStartup = true
    log.info(`[p:${PID}] Performing a Squirrel task. Will exit early.`)
    // The executable was started just so that squirrel could
    // handle some of its events.
    // We must exit immediately so we don't accidentally start
    // the real app. 

    app.quit();
}

//============= Initialize services ================
log.info(`[p:${PID}] Starting services...`)

let engineProcess : EngineProcess | null
const pythonInstaller = new PythonInstallerMain()


//============= Startup function - called later ================
async function start() {
    log.info("start(): Starting")
    log.info("start(): Opening main popup window")
    mainWindow.open()

    pythonInstaller.installPythonIfNotPresent()
    .then(() => {
        engineProcess = new EngineProcess()
        engineProcess.start()
    })

}

process.on('uncaughtException', err => {
    log.error(err)
})

//============= Begin startup ================
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
if (!isSpecialStartup) {
    app.on('ready', start);
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    app.quit();
});

app.on('activate', () => {
    // On OS X it"s common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    // if (mainWindow === null) {
    //     createWindow();
    // }
});

app.on('renderer-process-crashed', err => {
    log.error(err)
})

app.on('render-process-gone', err => {
    log.error(err)
})



