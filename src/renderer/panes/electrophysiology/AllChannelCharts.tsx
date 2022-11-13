import { ArrangeChannels } from 'client/renderer/model/ChartConfig';
import * as React from 'react'
import { AppContext } from '../../AppContext';
import { AppProps } from '../../AppProps';
import { TimeSeriesChart } from './TimeSeriesChart';

export interface AllChannelChartsState {
} 

export class AllElectrodesChart extends React.Component<AppProps, AllChannelChartsState> {
    render = () => {
        const context = this.props.context
        const chartConfig = context.chartConfig
        const deviceProps = context.deviceManager.deviceProps

        if (!deviceProps || deviceProps.numElectrodes == 0) {
            return <div className="w-full h-full flex flex-wrap flex-col"></div>
        }

        const numElectrodes = deviceProps.numElectrodes
        const rows = deviceProps.numElectrodeRows
        const columns = Math.ceil(numElectrodes / rows)

        const width = `${100 / columns}%`
        const height = `${100 / rows}%`

        const charts: JSX.Element[] = []

        for (let i = 0; i < numElectrodes; i++) {
            let electrodeNum : number|null = i
            let electrodeName: string|null = "Electrode " + i

            if (chartConfig.arrangeChannels == ArrangeChannels.BY_POSITION) {
                const row = i % rows
                const column = Math.floor(i / rows)
                const position = row * columns + column
                electrodeNum = deviceProps.electrodeMap[position]

                if (electrodeNum === null || electrodeNum === undefined || isNaN(electrodeNum)) {
                    charts.push(<ChartPlaceholder key={"placeholder-" + position}
                        width={width} height={height} />)
                    continue
                }

                electrodeName = deviceProps.electrodeNames[electrodeNum]

            } else if (!deviceProps.electrodeExistsMap[electrodeNum]) {
                continue
            }

            charts.push(<ChartForElectrode key={"electrode" + electrodeNum}
                context={context}
                electrode={electrodeNum}
                name={"Electrode " + electrodeName}
                width={width}
                height={height} />)
        }

        return <div className="w-full h-full flex flex-wrap flex-col">
            {charts}
        </div>;
    };
}

interface ChartForChannelProps {
    context: AppContext
    electrode: number
    name: string | null
    width: string
    height: string
}

function ChartForElectrode(props: ChartForChannelProps) {
    const context = props.context
    const channel = props.electrode
    const selectedChannelClass = props.electrode == context.selectedElectrode ? "bg-gray-300" : 0

    let stimTrigger: JSX.Element | null = null
    
    return <a className={`flex-none flex flex-col px-1 m-0 p-0 ${selectedChannelClass} text-black`}
                style={{width: props.width, height: props.height }}
                onClick={() => {context.setSelectedElectrode(channel)}}>
        <p className="flex-0" style={{fontSize: '0.71em', marginBottom: '-15px'}}>
            { props.name } &ensp;{stimTrigger}
        </p>
        <div className="flex-auto overflow-hidden">
            <TimeSeriesChart context={context} 
                            electrode={channel} 
                            hideAxes={true}
                            hideGridlines={true}/>
        </div>
    </a>
}

interface ChartPlaceholderProps {
    width: string
    height: string
}

function ChartPlaceholder(props: ChartPlaceholderProps) {
    return <div style={{width: props.width, height: props.height}} />
}