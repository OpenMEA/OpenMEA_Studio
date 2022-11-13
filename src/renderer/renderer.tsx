import '@fortawesome/fontawesome-free/css/all.min.css'
import 'rc-slider/assets/index.css'
import './styles/main.css'
import * as React from 'react'
import ReactDOM from 'react-dom'
import * as log from 'electron-log'

import { AppService } from 'client/renderer/AppService';
import { App } from './App';

// Initialize services required for TimeTrackerService
console.log = log.info


// Initialize other services
log.info("Hi from renderer!")


// Render!
ReactDOM.render(
    <AppService renderChildren={(appContext) =>
        <App context={appContext} />
    }/>
    ,
    document.getElementById('root')
);
