import React from "react"
import * as d3 from "d3"
import { AppContext } from "../../AppContext"
import { AXIS_COLOR, } from "client/Constants"
import { Pipeline } from "../../engine/Pipeline"
import { buildPipelineBase } from "client/Utils"

const L_PADDING = 40
const R_PADDING = 20
const BOTTOM_PADDIG = 20

export const MIN_SPECTROGRAM_VALUE =  0.000_000_1
const MID_VALUE =  0.000_1
export const MAX_SPECTROGRAM_VALUE = 0.1

// Function for calculating color of each spectrogram block
export const spectrogramColor = 
    d3.scaleDivergingLog([MIN_SPECTROGRAM_VALUE, MAX_SPECTROGRAM_VALUE], t => d3.interpolateRdBu(1-t*2))

export interface SpectrogramChartProps {
    context: AppContext,
    electrode: number
    hideAxes?: boolean
    hideGridlines?: boolean
}

export interface SpectrogramChartState {
}

export class SpectrogramChart extends React.Component<SpectrogramChartProps, SpectrogramChartState> {
    constructor(props: SpectrogramChartProps) {
        super(props)
    }

    render = () => {
        return <div style={{width: '100%', height: '100%'}} ref={ref => this._rootDivRef = ref}>
            <canvas ref={(ref) => this._canvasElement = ref}>
            </canvas>
        </div>
    }

    componentDidMount = () => {
        this.recalculateSpectrogramParams()
        this.recalculateChartDimensions()
        this.resetPipelineAndRedraw()
    }

    componentDidUpdate = (prevProps: SpectrogramChartProps) => {
        let resetPipelineAndRedraw = false

        const oldChannel = prevProps.electrode
        const newChannel = this.props.electrode

        if (newChannel != oldChannel) {
            resetPipelineAndRedraw = true
        }

        const oldContext = prevProps.context
        const newContext = this.props.context

        if (oldContext.lastResizeTimestamp != newContext.lastResizeTimestamp) {
            if (this._rootDivRef) {
                this.recalculateChartDimensions()
                resetPipelineAndRedraw = true
            }
        }

        if (oldContext.lastFilterConfigChangeTimestamp != newContext.lastFilterConfigChangeTimestamp) {
            resetPipelineAndRedraw = true
        }

        const oldChartConfig = oldContext.chartConfig
        const newChartConfig = newContext.chartConfig

        if ((oldChartConfig.showTimePeriodSec != newChartConfig.showTimePeriodSec)
            || (oldChartConfig.spectrogramCalculationPeriod != newChartConfig.spectrogramCalculationPeriod)
            || (oldChartConfig.spectrogramMaxFreq != newChartConfig.spectrogramMaxFreq)) {

            this.recalculateSpectrogramParams()
            resetPipelineAndRedraw = true;
        }

        if (resetPipelineAndRedraw) {
            this.resetPipelineAndRedraw()
        }
    }

    componentWillUnmount = () => {
        this._pipeline?.delete()
    }

    // ==================== Private ====================
    private _rootDivRef : Element | null = null
    private _canvasElement : HTMLCanvasElement | null = null

    private _width = 500
    private _height = 300

    private _spectrogramValues: number[] = []
    private _maxSpectrogramValues = 0

    private _numFrequencies = 0
    private _baseFrequency = 0

    private _pipeline: Pipeline | null = null
    private _redrawData: (() => void) | null = null

    private recalculateSpectrogramParams = () => {
        const chartConfig = this.props.context.chartConfig
        const maxFrequency = chartConfig.spectrogramMaxFreq
        const calculationPeriod = chartConfig.spectrogramCalculationPeriod
        
        this._baseFrequency = 1/ chartConfig.spectrogramCalculationPeriod
        
        this._numFrequencies = Math.round(maxFrequency * calculationPeriod) + 1
        const numPeriods = Math.floor(chartConfig.showTimePeriodSec / calculationPeriod)
        this._maxSpectrogramValues = numPeriods * this._numFrequencies
        this.resetData()
    }

    private resetData = () => {
        this._spectrogramValues = new Array(this._maxSpectrogramValues).fill(MID_VALUE) // Gray color
    }

    private resetPipelineAndRedraw = () => {
        const engineClient = this.props.context.engineClient
        const channelNum = this.props.electrode
        const context = this.props.context
        const chartConfig = context.chartConfig

        this._pipeline?.delete().then(() => {})
        this._pipeline = null
        this.resetData()

        const pipelineBase = buildPipelineBase(context, channelNum)

        engineClient.createPipeline([
            ...pipelineBase.baseFilters,
            {
                'name': 'SpectrogramFilter',
                'samplesPerSec': pipelineBase.outSamplesPerSec,
                'calculationPeriod': chartConfig.spectrogramCalculationPeriod,
                'maxFreq': chartConfig.spectrogramMaxFreq
            }

        ]).then(pipeline => {
            // If the user quickly changed settings a bunch of times, 
            // another pipeline may have appeared here while we were waiting for the
            // request to complete.
            this._pipeline?.delete().then(() => {})
            this._pipeline = null
            this.resetData()
    
            this._pipeline = pipeline
            pipeline.onData(this.onData)
            this.redrawChart()
        })
    }

    private onData = (newValues: number[]) => {
        // The data should always arrive in multiples of this._numFrequencies.
        // If it doesn't, then the UI and the engine are out of sync.
        // TODO: check that ^ 

        if (newValues.length >= this._maxSpectrogramValues) {
            // Trim some values on the off chance that we got sent too many
            const numToRemove = newValues.length - this._maxSpectrogramValues
            newValues.splice(0, numToRemove)
            this._spectrogramValues = newValues
        
        } else {
            const numToRemove = 
                Math.max(0, this._spectrogramValues.length + newValues.length - this._maxSpectrogramValues)

            this._spectrogramValues.splice(0, numToRemove)
            this._spectrogramValues.push(...newValues)
        }

        this._redrawData?.()
    }

    private formatXTick = (timeSec: number) : string => {
        const showTimePeriodSec = this.props.context.chartConfig.showTimePeriodSec

        if (showTimePeriodSec > 4) {
            return d3.format('.2s')(timeSec) + ' s'

        } else {
            return d3.format(',.2r')(timeSec * 1000) + ' ms'
        }
    }

    private chartWidth = () => {
        if (this.props.hideAxes) {
            return this._width
        }

        return this._width - L_PADDING - R_PADDING
    }

    private chartHeight = () => {
        if (this.props.hideAxes) {
            return this._height
        }

        return this._height - BOTTOM_PADDIG
    }

    private leftPadding = () => {
        if (this.props.hideAxes) {
            return 0
        } else {
            return L_PADDING
        }
    }

    private recalculateChartDimensions = () => {
        if (!this._rootDivRef) {
            return
        }

        // Set the new dimensions for the drawing area.
        const availableDrawingArea = this._rootDivRef.getBoundingClientRect()
        this._width = Math.floor(availableDrawingArea.width)
        this._height = Math.floor(availableDrawingArea.height) - 1
    }

    private redrawChart = () => {
        if (!this._canvasElement) {
            return
        }

        const chartWidth = this.chartWidth()
        const chartHeight = this.chartHeight()
        const chartConfig = this.props.context.chartConfig
        const maxValues = this._maxSpectrogramValues
        const maxFrequencies = this._numFrequencies
        const numPeriods = maxValues / this._numFrequencies
        const highestFrequecy = maxFrequencies * this._baseFrequency

        const leftPadding = this.leftPadding()

        const blockWidth = chartWidth / numPeriods
        const blockHeight = chartHeight / maxFrequencies

        // Mapping domain to range for each axis.
        const periodToX = (periodNum: number) => {
            // Need -0.5 to align the lines to pixels: https://stackoverflow.com/a/8696641/602114
            return leftPadding + periodNum * blockWidth - 0.5
        }

        const freqIndexToY = (freqNum: number) => {
            // Y is measured top to bottom
            // Need -0.5 to align the lines to pixels: https://stackoverflow.com/a/8696641/602114
            return blockHeight * (maxFrequencies - freqNum) - 0.5
        }

        // Prep the context for drawing.
        const canvas = d3.select(this._canvasElement)
        canvas.attr('width', this._width)
            .attr('height', this._height)
        
        const context = this._canvasElement.getContext('2d')

        if (!context) {
            console.error('Canvas context was null or undefined')
            return
        }

        context.clearRect(0, 0, this._width, this._height)

        // Draw the axes.
        const axisLine = (x1: number, y1: number, x2: number, y2: number) => {
            context.lineWidth = 1
            context.strokeStyle = AXIS_COLOR
            context.beginPath()
            context.moveTo(x1, y1)
            context.lineTo(x2, y2)
            context.stroke()
        }

        const xLeft = periodToX(0) - 1
        const xRight = periodToX(numPeriods)
        const yTop = freqIndexToY(maxFrequencies)
        const yBottom = freqIndexToY(0) + 1

        axisLine(xLeft, yTop, xLeft, yBottom)
        axisLine(xLeft, yBottom, xRight, yBottom)

        // Draw the x ticks
        const xTick = (axisFraction: number, drawTick: boolean, drawText: boolean) => {
            // Round to aligh to pixels
            const x = Math.round(chartWidth * axisFraction) + leftPadding - 0.5

            if (drawTick) {
                axisLine(x, yBottom, x, yBottom + 3)
            }

            if (drawText) {
                const actualTime = chartConfig.showTimePeriodSec * axisFraction
                const tickText = this.formatXTick(actualTime)
                context.fillStyle = 'black'
                context.font = '10px sans-serif'
                const textWidth = context.measureText(tickText)
                context.fillText(tickText, x - textWidth.width/2, yBottom + 12)
            }
        }

        xTick(0, false, true)
        xTick(0.25, true, false)
        xTick(0.5, true, true)
        xTick(0.75, true, false)
        xTick(1, true, true)

        // Draw the y ticks
        const yTick = (freq: number) => {
            const y = freqIndexToY(freq / this._baseFrequency)
            axisLine(xLeft, y, xLeft - 3, y)
            const tickText = "" + freq
            context.fillStyle = 'black'
            context.font = '10px sans-serif'
            const textWidth = context.measureText(tickText)
            context.fillText(tickText, xLeft - textWidth.width - 5, y + 3)
        }

        for (let freq = 100; freq < highestFrequecy; freq += 100) {
            yTick(freq)
        }

        yTick(60)

        this._redrawData = () => {
            // Draw the data.
            for (let i = 0; i < this._spectrogramValues.length; i++) {
                const freqIndex = i % maxFrequencies
                const period = Math.floor(i / maxFrequencies)
                const x = periodToX(period)
                const y = freqIndexToY(freqIndex + 1)

                context.fillStyle = spectrogramColor(this._spectrogramValues[i])
                context.fillRect(x, y, blockWidth, blockHeight)
            }
        }

        this._redrawData()
    }

}

