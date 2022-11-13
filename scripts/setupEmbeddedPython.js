const https = require('https')
const path = require('path')
const fs = require('fs')
const { exit } = require('process')
const { spawnSync } = require('child_process')
const yauzl = require('yauzl')

// See full list of Python versions here: https://www.python.org/downloads/
// IMPORTANT! When updating this Python version, don't forget to also update
// the download link.
const PYTHON_VERSION = '3.9.6'
const PYTHON_DOWNLOAD_LINK = "https://www.python.org/ftp/python/3.9.6/python-3.9.6-embed-amd64.zip"
const GET_PIP_LINK = "https://bootstrap.pypa.io/get-pip.py"

// This file lives in the Python installation dir and is used to set the default
// package search paths. We'll need to fix it after the install.
const PYTHON_PTH_FILE = 'python39._pth'

const PYTHON_DIR = path.join(__dirname, '../libs/python/')
const PYTHON_EXE_PATH = path.join(PYTHON_DIR, 'python.exe')


// ================== Useful functions ===================
function downloadFile(fromUrl, toPath) {
    const downloadedFile = fs.createWriteStream(toPath)
    return new Promise((resolve, reject) => {
        const request = https.get(fromUrl, response => {
            response.pipe(downloadedFile)

            downloadedFile.on('finish', () => resolve())

            downloadedFile.on('error', (err) => {
                console.log("Could not download embedded python: " + err)
                fs.rm(downloadedFilePath)
                throw err
            })
    
        })
    })
}

function unzip(fromZipFile, toDir) {
    return new Promise((resolve, reject) => {
        // Unzip the file.
        // Taken from the docs for yauzl library: https://github.com/thejoshwolfe/yauzl
        yauzl.open(fromZipFile, {lazyEntries: true}, (err, zipfile) => {
            if (err) throw err

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

// ================== Main script =====================
// Wrap everything in an async function so we can use async/await
(async function() {
    console.log(`Checking if embedded Python ${PYTHON_VERSION} version is present...`)

    if (fs.existsSync(PYTHON_EXE_PATH)) {
        const versionRunResult = spawnSync(PYTHON_EXE_PATH, ['--version'])
        const foundVersion = versionRunResult.stdout.toString().trim()
    
        if (foundVersion.includes(`Python ${PYTHON_VERSION}`)) {
            console.log(`Python ${PYTHON_VERSION} is already installed. Done.`)    
            exit(0)
        }
    
        console.log(`Found ${foundVersion}; need ${PYTHON_VERSION}. Will reinstall.`)
    }
    
    // Download the Python version
    console.log(`Downloading Python ${PYTHON_VERSION}. Hang on...`)
    
    if (!fs.existsSync(PYTHON_DIR)) {
        fs.mkdirSync(PYTHON_DIR, { recursive: true })
    } else {
        fs.rmSync(PYTHON_DIR, {force: true, recursive: true})
        fs.mkdirSync(PYTHON_DIR, { recursive: true })
    }
    
    const pythonZipPath = path.join(PYTHON_DIR, `python.${PYTHON_VERSION}.zip`)
    await downloadFile(PYTHON_DOWNLOAD_LINK, pythonZipPath)
    
    console.log(`Unzipping...`)
    await unzip(pythonZipPath, PYTHON_DIR)
    console.log(`Downloaded Python ${PYTHON_VERSION} into ${PYTHON_DIR}.`)
    
    // Download and install PIP
    console.log(`Installing PIP... `)
    const getPipPath = path.join(PYTHON_DIR, `get-pip.py`)
    await downloadFile(GET_PIP_LINK, getPipPath)
    
    spawnSync(PYTHON_EXE_PATH, [getPipPath, '--no-warn-script-location'], {stdio: 'inherit'})
    
    console.log(`Installed PIP.`)

    // Add Lib/site-packages to pythonXX._pth file
    const pythonPthPath = path.join(PYTHON_DIR, PYTHON_PTH_FILE)
    fs.appendFileSync(pythonPthPath, 'import site\n')
    console.log(`Added 'import site' to ${PYTHON_PTH_FILE}.`)
    console.log(`Done setting up Python ${PYTHON_VERSION}.`)
})()
