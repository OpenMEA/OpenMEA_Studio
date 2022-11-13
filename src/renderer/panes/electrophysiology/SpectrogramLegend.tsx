import * as React from 'react'
import * as d3 from "d3"
import { MAX_SPECTROGRAM_VALUE, MIN_SPECTROGRAM_VALUE, spectrogramColor } from './SpectrogramChart'

export interface SpectrogramLegendProps {
    
}

const HEIGHT = 31
const WIDTH = 260
const MARGIN_LEFT = 20
const MARGIN_RIGHT = 40
const MARGIN_TOP = 9
const TICK_OVERHANG = 2
const MARGIN_BOTTOM = 11 + TICK_OVERHANG

const TICK_HEIGHT = HEIGHT - MARGIN_TOP - MARGIN_BOTTOM + TICK_OVERHANG

const NUM_TICKS = 7

export class SpectrogramLegend extends React.Component<SpectrogramLegendProps, {}> {
    render = () => {
        return <canvas 
                ref={(ref) => this._canvasRef = ref} 
                height={HEIGHT} width={WIDTH}
                className="mt-4 ml-4">
        </canvas>
    }

    componentDidMount = () => {
        this.renderLegend()
    }

    // ===================== Private =====================
    private _canvasRef : HTMLCanvasElement | null = null

    private renderLegend = () => {
        if (!this._canvasRef) {
            return
        }

        //const color = spectrogramColor
        const tickLabelY = HEIGHT - MARGIN_BOTTOM + TICK_OVERHANG + 2;

        // Draw the title

        // Draw the bar
        const context = this._canvasRef.getContext('2d')!!
        //const numSteps = Math.min(color.domain().length, color.range().length)
        context.lineWidth = 1

        const minSpectrogramLog = Math.log10(MIN_SPECTROGRAM_VALUE)
        const maxSpectrogramLog = Math.log10(MAX_SPECTROGRAM_VALUE)
        const barWidth = WIDTH - MARGIN_LEFT - MARGIN_RIGHT
        let ticksDrawn = 0
        const tickSpacing = barWidth / (NUM_TICKS - 1);
        
        for (let x = 0; x < barWidth; x++) {
            const valueLog = (x/barWidth) * (maxSpectrogramLog - minSpectrogramLog) + minSpectrogramLog
            const value = Math.pow(10, valueLog)

            if (x == Math.round(ticksDrawn * tickSpacing) || x == (barWidth - 1)) {
                ticksDrawn++

                // Draw the tick
                context.fillStyle = 'black'
                context.fillRect(x + MARGIN_LEFT, MARGIN_TOP, 1, TICK_HEIGHT)

                // Draw the tick legend
                context.fillStyle = 'black'
                context.font = '10px sans-serif'
                const displayedValueLog = Math.round(valueLog)
                const displayedValue = Math.pow(10, displayedValueLog)
                const tickText = formatTick(displayedValue)
                const textSize = context.measureText(tickText)
                const textAscent = textSize.actualBoundingBoxAscent;
                context.fillText(tickText, MARGIN_LEFT + x - textSize.width/2, tickLabelY + textAscent)
            
            } else {
                const color = spectrogramColor(value)
                context.fillStyle = color
                context.fillRect(x + MARGIN_LEFT, MARGIN_TOP, 1, HEIGHT - MARGIN_TOP - MARGIN_BOTTOM)
            }
        }

        // Draw the units
        context.fillStyle = 'black'
        context.font = '10px sans-serif'
        context.fillText('V/√Hz', WIDTH - MARGIN_RIGHT + 5, HEIGHT - MARGIN_BOTTOM)
    }
}

function formatTick(value: number): string {
    return d3.format('~s')(value)
}

