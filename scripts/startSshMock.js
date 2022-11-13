const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process');

// Copy write_evenly to the docker build dir.
const writeEvenlyTargetDir = path.join(__dirname, 'ssh-mock/write_evenly')
if (!fs.existsSync(writeEvenlyTargetDir)) {
    fs.mkdirSync(writeEvenlyTargetDir, {recursive: true});

} else {
    for (let file of fs.readdirSync(writeEvenlyTargetDir)) {
        const fullPath = path.join(writeEvenlyTargetDir, file);
        fs.rmSync(fullPath)
    }    
}

const writeEvenlySourceDir = path.join(__dirname, '../../write_evenly')

for (let file of fs.readdirSync(writeEvenlySourceDir)) {
    const from = path.join(writeEvenlySourceDir, file);
    const to = path.join(writeEvenlyTargetDir, file);
    fs.copyFileSync(from, to);
}

// Make 'outout' and 'output/tmp' if they don't exist.
const outdir = path.join(__dirname, '../output');
if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir);
}

const outdirTmp = path.join(__dirname, '../output/tmp');
if (!fs.existsSync(outdirTmp)) {
    fs.mkdirSync(outdirTmp);
}

// Build and start dockerfile.
const dockerDir = path.join(__dirname, 'ssh-mock');
let dockerBuildResult = spawnSync('docker',
    ['build', '-t', 'ssh-mock', '.'], 
    {
        stdio: 'inherit',
        cwd: dockerDir
    });

if (dockerBuildResult.status && dockerBuildResult.status != 0) {
    throw "Aborting - docker build failed."
}

const studoPath = path.join(__dirname, '..');
spawnSync('docker',
    ['run', '-d', '--rm', '--name', 'ssh-mock', '-p', '127.0.0.1:8022:22', '-v', studoPath + ':/studio', 'ssh-mock'], 
    {
        stdio: 'inherit'
    });

