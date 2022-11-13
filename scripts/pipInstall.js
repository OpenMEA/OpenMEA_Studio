const { spawnSync } = require('child_process')
const path = require('path')

const PYTHON_DIR = path.join(__dirname, '../libs/python/')
const PYTHON_EXE_PATH = path.join(PYTHON_DIR, 'python.exe')
const ENGINE_DIR = path.join(__dirname, '../engine')
const REQUIREMENTS_TXT = path.join(ENGINE_DIR, 'requirements.txt')

console.log('Installing required PIP packages...')
spawnSync(PYTHON_EXE_PATH, 
        ['-m', 'pip', 'install', '-r', REQUIREMENTS_TXT, '--no-warn-script-location'], 
        {stdio: 'inherit'})
console.log('Done with PIP packages.')
