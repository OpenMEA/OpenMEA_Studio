import * as React from 'react'
import { AppContext } from 'client/renderer/AppContext';
import { SpectrogramLegend } from 'client/renderer/panes/electrophysiology/SpectrogramLegend';
import { AllElectrodesChart } from './AllChannelCharts';
import { SpectrogramChart } from './SpectrogramChart';
import { TimeSeriesChart } from './TimeSeriesChart';

export interface ElectrophysiologyPaneProps {
    context: AppContext
}

export class ElectrophysiologyPane extends React.Component<ElectrophysiologyPaneProps, {}> {
    render = () => {
        const props = this.props
        const context = props.context
        const deviceProps = props.context.deviceManager.deviceProps
        const selectedElectrode = context.selectedElectrode

        if (!deviceProps 
            || deviceProps.numElectrodes == 0 
            || selectedElectrode > deviceProps.numElectrodes
            || !deviceProps.electrodeNames[selectedElectrode]) 
        {
            return <div className="flex-1 flex flex-col overflow-hidden"></div>
        }

        return <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-none w-full pr-2 flex flex-row" style={{height:'33%'}}>
                <div className="flex-1 h-full w-1/2 flex flex-col">
                    <h2 className="flex-0 mt-4" style={{marginLeft: '40px'}}>
                        Electrode {deviceProps.electrodeNames[selectedElectrode]}
                    </h2>
                    <div className="flex-auto overflow-hidden">
                        <TimeSeriesChart context={context} electrode={selectedElectrode} />
                    </div>
                </div>
                <div className="flex-1 h-full w-1/2 flex flex-col">
                    <div className="flex-0 flex flex-row justify-between">
                        <h2 className="flex-0 mt-4 text-white">
                            .
                        </h2>
                        <div className="flex-0" style={{marginRight: '20px'}}>
                            <SpectrogramLegend/>
                        </div>
                    </div>
                    
                    <div className="flex-auto overflow-hidden">
                        <SpectrogramChart context={context} electrode={selectedElectrode} />
                    </div>
                </div>
            </div>

            <div className="flex-none p-2" style={{height:'67%'}}>
                <AllElectrodesChart context={context} />
            </div>
        </div>
    }
}