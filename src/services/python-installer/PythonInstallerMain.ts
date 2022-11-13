import fs from 'fs'
import path from 'path'
import log from 'electron-log'
import https from 'https'
import yauzl from 'yauzl'

import { ipcMain, webContents } from "electron";
import { IPC_CHANNEL_PYTHON_INSTALLED_EVENT, IPC_CHANNEL_PYTHON_INSTALLLOG_MESSAGE, IPC_CHANNEL_PYTHON_INSTALL_STATUS_REPLY, IPC_CHANNEL_PYTHON_INSTALL_STATUS_REQUEST } from "./PythonInstallIpcChannels";
import { spawn } from 'child_process';
import { getEngineDir, getPythonExe } from 'client/main/EngineProcess'

// See full list of Python versions here: https://www.python.org/downloads/
// IMPORTANT! When updating this Python version, don't forget to also update
// the download link.
const PYTHON_VERSION = '3.9.6'
const PYTHON_DOWNLOAD_LINK = "https://www.python.org/ftp/python/3.9.6/python-3.9.6-embed-amd64.zip"
const GET_PIP_LINK = "https://bootstrap.pypa.io/get-pip.py"

// This file lives in the Python installation dir and is used to set the default
// package search paths. We'll need to fix it after the install.
const PYTHON_PTH_FILE = 'python39._pth'
const LINUX_PYTHON = 'python3.9'

export class PythonInstallerMain {
    constructor() {        
        if (process.platform == 'win32') {
            const pythonExe = getPythonExe()
            this._isPythonInstalled = fs.existsSync(pythonExe)
        
        } else if (process.platform == 'linux') {
            // We'll need check if the requirements are up-to-date anyway
            this._isPythonInstalled = false;

        } else {
            // TODO: handle Python setup/start better
            this._isPythonInstalled = true;
        }

        ipcMain.on(IPC_CHANNEL_PYTHON_INSTALL_STATUS_REQUEST, this.handlePythonInstallStatusRequest)
    }

    public installPythonIfNotPresent = async (): Promise<void> => {
        if (this._isPythonInstalled) {
            return
        }

        try {
            if (process.platform == 'win32') {
                await this.installPythonWindows()
            
            } else if (process.platform == 'linux') {
                await this.installPythonLinux()
            }

            this._isPythonInstalled = true;
            this.sendMessage(IPC_CHANNEL_PYTHON_INSTALLED_EVENT, null)

        } catch (err) {
            this.log("=== Failed ===")
        }
    }

    // ===================== Private ======================
    private _isPythonInstalled: boolean

    private installPythonWindows = async () => {
        const pythonExe = getPythonExe()
        const pythonDir = path.dirname(pythonExe)

        // Download the Python version
        this.log(`Downloading Python ${PYTHON_VERSION}. Hang on...`)

        if (!fs.existsSync(pythonDir)) {
            fs.mkdirSync(pythonDir, { recursive: true })
        } else {
            fs.rmSync(pythonDir, {force: true, recursive: true})
            fs.mkdirSync(pythonDir, { recursive: true })
        }

        const pythonZipPath = path.join(pythonDir, `python.${PYTHON_VERSION}.zip`)
        await downloadFile(PYTHON_DOWNLOAD_LINK, pythonZipPath)

        this.log(`Unzipping...`)
        await unzip(pythonZipPath, pythonDir)
        this.log(`Downloaded Python ${PYTHON_VERSION} into ${pythonDir}.`)

        // Download and install PIP
        console.log(`Installing PIP... `)
        const getPipPath = path.join(pythonDir, `get-pip.py`)
        await downloadFile(GET_PIP_LINK, getPipPath)

        await this.run(pythonExe, [getPipPath, '--no-warn-script-location'])
        this.log(`Installed PIP.`)

        // Add Lib/site-packages to pythonXX._pth file
        const pythonPthPath = path.join(pythonDir, PYTHON_PTH_FILE)
        fs.appendFileSync(pythonPthPath, 'import site\n')
        this.log(`Added 'import site' to ${PYTHON_PTH_FILE}.`)
        this.log(`Done setting up Python ${PYTHON_VERSION}.`)

        // Install PIP dependences for the engine.
        this.log('Installing required PIP packages...')
        const engineDir = getEngineDir()
        const requirementsTxt = path.join(engineDir, 'requirements.txt')
        await this.run(pythonExe, 
                    ['-m', 'pip', 'install', '-r', requirementsTxt, '--no-warn-script-location'])
        
        this.log('Done with PIP packages.')
        this.log('=== Done ===')
    }

    private log = (msg: string) : void => {
        log.info(msg)
        this.sendMessage(IPC_CHANNEL_PYTHON_INSTALLLOG_MESSAGE, msg)
    }

    private installPythonLinux = async () => {
        const pythonExe = getPythonExe()
        const engineDir = getEngineDir()


        if (!fs.existsSync(pythonExe)) {
            this.log(`Setting up Python virtualenv. Hang on...`)

            // Check prerequisites
            const whichPython = await this.runAndGetOutput('which', [LINUX_PYTHON])
            const whichPip = await this.runAndGetOutput('which', ['pip3'])

            const hasPython = whichPython.trim() != ''
            const hasPip = whichPip.trim() != ''

            if (!hasPython || !hasPip) {
                if (!hasPython && !hasPip) {
                    this.log(`ERROR - could not find ${LINUX_PYTHON} or pip3.`)
                    this.log(`Please install ${LINUX_PYTHON}, ${LINUX_PYTHON}-venv, and pip`)
                
                } else if (!hasPython) {
                    this.log(`ERROR - could not find ${LINUX_PYTHON}.`)
                    this.log(`Please install ${LINUX_PYTHON}, ${LINUX_PYTHON}-venv`)
                
                } else {
                    this.log(`ERROR - could not find pip3.`)
                    this.log(`Please install pip`)
                }

                throw "Could not complete setup"
            }

            // Set up the virtual environment
            this.log(`${LINUX_PYTHON} -m venv .venv`)
            await this.run(LINUX_PYTHON, ['-m', 'venv', '.venv'], engineDir)
    
            this.log(``)
            this.log(`Upgrading PIP`)
            await this.run(pythonExe, ['-m', 'pip', 'install', '--upgrade', 'pip', 'wheel', 'setuptools'], engineDir)
            this.log(``)
        }

        this.log(`Installing required PIP packages`)
        await this.run(pythonExe, ['-m', 'pip', 'install', '-r', 'requirements.txt'], engineDir)

        this.log('Done with PIP packages.')
        this.log('=== Done ===')
    }

    private run = async (exe: string, args: string[], cwd?: string) : Promise<void> => {
        return new Promise((resolve, reject) => {
            const process = spawn(exe, args, { stdio: 'pipe', cwd: cwd })

            process.stdout.on('data', (data: any) => {
                const message = data.toString().trimEnd()
                this.log(message)
            })

            process.stderr.on('data', (data: any) => {
                const message = data.toString().trimEnd()
                this.log(message)
            })

            process.on('error', err => {
                log.error(`Failed to start ${exe}: ${err}`)
                reject(`Failed to start ${exe}: ${err}`)
            })
    
            process.on('exit', (code:number) => {
                if (code != 0) {
                    reject('Failed')

                } else {
                    resolve()
                }
                
            })
        })
    }

    private runAndGetOutput = async(exe: string, args: string[], cwd?: string): Promise<string> => {
        this.log(`${exe} ${args.join(' ')}`)
        return new Promise((resolve, reject) => {
            const process = spawn(exe, args, { stdio: 'pipe', cwd: cwd })
            let output = ""
            process.stdout.on('data', (data: any) => {
                const message = data.toString().trimEnd()
                output += message
            })

            process.stderr.on('data', (data: any) => {
                const message = data.toString().trimEnd()
                output += message
            })

            process.on('error', err => {
                log.error(`Failed to start ${exe}: ${err}`)
                reject(`Failed to start ${exe}: ${err}`)
            })

            process.on('exit', (code:number) => {
                if (code != 0) {
                    reject('Failed')

                } else {
                    resolve(output)
                }
            })
        })
    }

    private handlePythonInstallStatusRequest = (evt: any, args: any) => {
        this.sendMessage(IPC_CHANNEL_PYTHON_INSTALL_STATUS_REPLY, this._isPythonInstalled)
    }

    private sendMessage = (channel: string, message: any) => {
        const renderers = webContents.getAllWebContents()

        for (let renderer of renderers) {
            renderer.send(channel, message)
        }
    }
}

async function downloadFile(fromUrl: string, toPath: string) : Promise<void> {
    const downloadedFile = fs.createWriteStream(toPath)
    return new Promise((resolve, reject) => {
        https.get(fromUrl, response => {
            response.pipe(downloadedFile)

            downloadedFile.on('finish', () => resolve())

            downloadedFile.on('error', (err) => {
                console.log("Could not download embedded python: " + err)
                fs.rm(toPath, () => {
                    throw err
                })
            })
        })
    })
}

async function unzip(fromZipFile: string, toDir: string) : Promise<void> {
    return new Promise((resolve, reject) => {
        // Unzip the file.
        // Taken from the docs for yauzl library: https://github.com/thejoshwolfe/yauzl
        yauzl.open(fromZipFile, {lazyEntries: true}, (err, zipfile) => {
            if (err) throw err

            if (!zipfile) {
                throw `Could not open zip file ${fromZipFile}`
            }

            zipfile.readEntry() 
            zipfile.on('entry', entry => {
                if (/\/$/.test(entry.fileName)) {
                    // Directory file names end with '/'.
                    // Note that entries for directories themselves are optional.
                    // An entry's fileName implicitly requires its parent directories to exist.
                    zipfile.readEntry();
                } else {
                    // Save the file.
                    const unzippedFilePath = path.join(toDir, entry.fileName)
                    const unzippedFile = fs.createWriteStream(unzippedFilePath)

                    zipfile.openReadStream(entry, function(err, readStream) {
                        if (err) throw err;
                        
                        if (!readStream) {
                            throw `Could not open zip file ${fromZipFile}`
                        }

                        readStream.on("end", function() {
                            zipfile.readEntry();
                        });

                        readStream.pipe(unzippedFile);
                    });
                }
            })

            zipfile.on('error', err => {throw err})
            zipfile.on('close', () => resolve())
        })  
    })
}