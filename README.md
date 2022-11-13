# OpenMEA Studio

OpenMEA Studio is a desktop application for interfacing with OpenMEA hardware.

## Building, running

Recommended tools:
* Node.js - required. Get latest LTS (long-term support) version [from here](https://nodejs.org/en/).
* [VS Code](https://code.visualstudio.com/) - for front-end development
* [PyCharm](https://www.jetbrains.com/pycharm/download/#section=windows) - for Python development.

After everything is installed, run

```
# This installs all dependencies, including embeddable Python and its packages.
> npm install

# This builds the runnable JavaScript package from TypeScript. It will
# keep monitoring the TypeScript files for changes until you press Ctrl+C.
> npm run dev

# In separate command prompt, run this to start the app.
> npm start

# In a separate command prompt, send some fake electrode UDP data:
> node scripts/udptest.js
```

## Running on Ubuntu

It's possible to run OpenMEA Studio on Ubuntu, though the process is less user-friendly.

```
npm install
npm run dev 

# Whe the above doesn't print anything for 15 sec, press Ctrl+C

npm start
```

On Ububtu, when exiting OpenMEA Studio, sometimes the child Python processes don't get properly cleaned up. To deal with it, run

```
ps -a | grep python
kill -9 <python PID>
```

Note that the first time the whole system is run it may be sluggish and laggy. If that happens, stop and restart all processes.

## Project structure

* `engine/`: Python calculation engine
    * `main.py`: the main entry point
* `src/`: Source code for the TypeScript / Electron app
    * `main/`: Main Node.js process that kicks off all other sub-processes
        * `main.ts`: its entry point
    * `renderer/`: Web UI that is hosted in the embedded browser. It's written using React, TypeScript, and Tailwind CSS.
        * `renderer.ts`: its entry point
* `scripts/`: Useful scripts for setup and testing

## Packaging for distribution

TBD - stay tuned

