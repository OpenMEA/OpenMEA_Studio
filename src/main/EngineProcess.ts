import { spawn } from 'child_process'
import path from 'path'
import process from 'process'
import log from 'electron-log'
import fs from 'fs'

const ENGINE_DIR = 'engine'

export class EngineProcess {
    consrtuctor() {

    }

    start() {
        const pythonExe = getPythonExe()
        log.info(`pythonExe: ${pythonExe}`)
        const engineFullDir = getEngineDir()

        log.info("Spawning the engine process... ")

        const engineProcess = spawn(pythonExe, ['main.py', `'${process.pid}'`], {
            cwd: engineFullDir,
            stdio: ['pipe', 'pipe', 'pipe'],
        })

        engineProcess.stdout.on('data', (data: any) => {
            log.info(`[python:${engineProcess.pid}]: ${data.toString().trimEnd()}`)
        })

        engineProcess.stderr.on('data', (data: any) => {
            log.error(`[python:${engineProcess.pid}]: ${data.toString().trimEnd()}`)
        })

        engineProcess.on('error', err => {
            log.error(`Failed to start the engine subprocess: ${err}`)

        })

        engineProcess.on('exit', () => {
            log.info(`[python:${engineProcess.pid}]: exited`)
        })

        engineProcess.on('spawn', () => {
            log.info(`[python:${engineProcess.pid}]: spawned`)
        })

        // Don't wait for the child process to exist - that won't happen anytime soon.
        // engineProcess.unref()
    }
}

export function getEngineDir() {
    let engineFullDir = path.join(process.cwd(), ENGINE_DIR)

    if (fs.existsSync(engineFullDir)) {
        return engineFullDir
    }

    return path.join(process.cwd(), 'resources', ENGINE_DIR)
}

export function getPythonExe() {
    if (process.platform == 'win32') {
        const pythonDir = path.join(process.cwd(), 'libs/python')
        const pythonExe = path.join(pythonDir, 'python.exe')

        // In development environment
        if (fs.existsSync(pythonExe)) {
            return pythonExe
        }

        // In a distrubuted package
        return path.join(process.cwd(), 'resources/libs/python/python.exe')
    
    } else if (process.platform == 'linux') {
        const pythonDir = path.join(getEngineDir(), '.venv', 'bin')
        const  pythonExe = path.join(pythonDir, 'python')
        return pythonExe
    
    } else {
        throw `We don't support automated Python setup for platform ${process.platform}`
    }
}