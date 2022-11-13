import { OPENMEA_ELECTRODE_MAP, NUM_OPENMEA_ELECTRODES, PULSE_COLORS } from 'client/Constants'
import * as React from 'react'
import { VisibleIf } from './VisibleIf'
import { ElectrodeMarker } from './ElectrodeMarker'
import { themeColor } from './Colors'

export interface ElectrodePickerProps {
    electrodesByPulse: number[][]
    onElectrodeSelectionsChanged: (electrodesByPupse: number[][]) => void
}

export interface ElectrodePickerState {
    selectedPulse: number
}

export class ElectrodePicker extends React.Component<ElectrodePickerProps, ElectrodePickerState> {
    constructor(props: ElectrodePickerProps) {
        super(props)

        this.state = {
            selectedPulse: 0
        }
    }

    render = () => {
        const props = this.props
        const state = this.state
        const electrodesByPulse = props.electrodesByPulse
        const selectedPulse = state.selectedPulse

        const numElectrodes = NUM_OPENMEA_ELECTRODES
        const columns = Math.ceil(Math.sqrt(numElectrodes))
        const rows = Math.ceil(numElectrodes / columns)
        
        const electrodeMarkers: JSX.Element[] = []

        const electrodePulses: (number|null)[] = Array(numElectrodes).fill(null)

        for (let pulseIndex = 0; pulseIndex < electrodesByPulse.length; pulseIndex++) {
            for (let electrode of electrodesByPulse[pulseIndex]) {
                electrodePulses[electrode] = pulseIndex
            }
        }

        for (let i = 0; i < numElectrodes; i++) {
            const row = i % rows
            const column = Math.floor(i / rows)
            const position = row * columns + column

            const electrodeNum = OPENMEA_ELECTRODE_MAP[position]

            if (isNaN(electrodeNum)) {
                continue
            }

            let fill: string|null = null
            let outline: string|null = null
            let pulseIndex = electrodePulses[electrodeNum]

            if (pulseIndex !== null) {
                const color = PULSE_COLORS[pulseIndex % PULSE_COLORS.length]
                fill = color
                outline = color
            }

            const hoverColor = PULSE_COLORS[selectedPulse % PULSE_COLORS.length]

            const displayRow = row + 1
            const displayColumn = column + 1

            electrodeMarkers.push(<ElectrodeMarker 
                key={`e-${electrodeNum}`}
                name={"" + displayColumn + "" + displayRow}
                outline={outline}
                fill={fill}
                hoverColor={hoverColor}
                style={{gridColumn: displayColumn, gridRow: displayRow, justifySelf: 'stretch',}}
                onClick={() => this.onClickElectrode(electrodeNum)} />)
        }

        const pulseSelectors: JSX.Element[] = []
        const lastPulseIndex = electrodesByPulse.length - 1

        for (let i = 0; i < electrodesByPulse.length; i++) {
            const pulseColor = PULSE_COLORS[i % PULSE_COLORS.length]
            const buttonBgClass = i == selectedPulse ? `disabled:bg-${pulseColor}-200` : `bg-${pulseColor}-100`
            const hoverClass = i == selectedPulse ? `hover:bg-${pulseColor}-200` : `hover:bg-${pulseColor}-200`

            const buttonStyle = {
                // 'position' is needed to make z-index work correctly with translated
                // left button. See
                // https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z_index/The_stacking_context
                position: 'relative',
                borderTopLeftRadius: i == 0 ? undefined : '0',
                borderBottomLeftRadius: i == 0 ? undefined : '0',
                borderTopRightRadius: i == lastPulseIndex ? undefined: '0',
                borderBottomRightRadius: i == lastPulseIndex ? undefined: '0',
                zIndex: i,
                marginLeft: i == 0 ? '20px' : '-1px',
                transform: i == selectedPulse ? 'translate(1px, 1px)' : undefined,
                background: i == selectedPulse ? themeColor(pulseColor, '200') : undefined,
                color: i == selectedPulse ? 'black' : undefined
            } as React.CSSProperties


            const pulseSelector = 
                <button key={'pulse-' + i} 
                        onClick={() => this.setState({selectedPulse: i})}
                        style={buttonStyle}
                        className={buttonBgClass + ' ' + hoverClass}
                        disabled={i == selectedPulse}>
                    { i + 1}
                </button>

            pulseSelectors.push(pulseSelector)
        }
        
        const gridStyle = {
            display: 'grid', 
            gridTemplateColumns: `repeat(${columns}, 23px)`,
            gridColumnGap: '4px',
            gridTemplateRows: `repeat(${rows}, 23px)`,
            gridRowGap: '4px'
        } as React.CSSProperties

        const gridWidth = 23 * columns + 4 * (columns - 1)

        return <div>
            <VisibleIf condition={electrodesByPulse.length > 1}>
                <div className="mt-3">
                    <label>Stimulate with</label>
                    { pulseSelectors }
                </div>
            </VisibleIf>
            <div className="mt-4" style={gridStyle}>
                { electrodeMarkers }
            </div>
            <div className="mt-2 text-center" style={{width: `${gridWidth}px`}}>
                <a href="" className="mr-4 text-sm" onClick={this.onClickSelectAll}>Select all</a>
                <a href="" className="text-sm"onClick={this.onClickClearAll}>Clear all</a>
            </div>
        </div>

    }

    //===================== Private =====================
    private onClickElectrode = (electrodeNum: number) => {
        // We'll need to toggle whether the electrode in the list for the current pulse.
        // If it's included in other pulse lists, we'll need to remove it.
        const selectedPulse = this.state.selectedPulse
        const electrodesByPulse = this.props.electrodesByPulse.map(arr => arr.slice())

        for (let i = 0; i < electrodesByPulse.length; i++) {
            const currentList = electrodesByPulse[i]
            const indexInCurrentList = currentList.indexOf(electrodeNum)

            if (indexInCurrentList >= 0) {
                currentList.splice(indexInCurrentList, 1)
            
            } else if (i == selectedPulse) {
                currentList.push(electrodeNum)
            }
        }

        this.props.onElectrodeSelectionsChanged(electrodesByPulse)
    }

    private onClickClearAll = (evt:any) => {
        evt.preventDefault()
        const newElectrodesByPulse = this.props.electrodesByPulse.map(_ => [])
        this.props.onElectrodeSelectionsChanged(newElectrodesByPulse)
    }

    private onClickSelectAll = (evt:any) => {
        evt.preventDefault()

        const list: number[] = []
        const numElectrodes = NUM_OPENMEA_ELECTRODES
        const columns = Math.ceil(Math.sqrt(numElectrodes))
        const rows = Math.ceil(numElectrodes / columns)

        for (let i = 0; i < numElectrodes; i++) {
            const row = i % rows
            const column = Math.floor(i / rows)
            const position = row * columns + column

            const electrodeNum = OPENMEA_ELECTRODE_MAP[position]

            if (isNaN(electrodeNum)) {
                continue
            }

            list.push(electrodeNum)
        }

        const newElectrodesByPulse: number[][] = this.props.electrodesByPulse.map(_ => [])
        newElectrodesByPulse[this.state.selectedPulse] = list
        this.props.onElectrodeSelectionsChanged(newElectrodesByPulse)
    }
}
