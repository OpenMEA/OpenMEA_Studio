import React from "react"
import * as d3 from "d3"
import { AppContext } from "../../AppContext"
import { NumberValue } from "d3"
import { Pipeline } from "../../engine/Pipeline"
import { buildPipelineBase } from "client/Utils"

const L_PADDING = 40
const R_PADDING = 20
const BOTTOM_PADDIG = 20

export interface TimeSeriesChartProps {
    context: AppContext,
    electrode: number
    hideAxes?: boolean
    hideGridlines?: boolean
}

export interface TimeSeriesChartState {
}

export class TimeSeriesChart extends React.Component<TimeSeriesChartProps, TimeSeriesChartState> {
    constructor(props: TimeSeriesChartProps) {
        super(props)

        // Initialize
        this._maxSubsamples = this.chartWidth()
    }
    
    render = () => {
        return <div style={{width: '100%', height: '100%'}} ref={ref => this._rootDivRef = ref}>
            <svg ref={(ref) => this._svgRef = ref}>
            </svg>
        </div>
    }

    componentDidMount = () => {
        this.recalculateChartDimensions()
        this.resetPipelineAndRedraw()
    }

    componentDidUpdate = (prevProps : TimeSeriesChartProps) => {
        let resetPipelineAndRedraw = false
        let redrawDataOnly = false
        let redrawChart = false

        const oldChannel = prevProps.electrode
        const newChannel = this.props.electrode

        if (newChannel != oldChannel) {
            resetPipelineAndRedraw = true
        }

        const oldContext = prevProps.context
        const newContext = this.props.context
        const oldChartConfig = oldContext.chartConfig
        const newChartConfig = newContext.chartConfig

        if (oldChartConfig.showTimePeriodSec != newChartConfig.showTimePeriodSec) {
            this.recalculateChartDimensions()
            resetPipelineAndRedraw = true
        }

        if (oldContext.lastFilterConfigChangeTimestamp != newContext.lastFilterConfigChangeTimestamp) {
            resetPipelineAndRedraw = true
        }

        if (oldChartConfig.showMaxVolts != newChartConfig.showMaxVolts
            || oldChartConfig.showMinVolts != newChartConfig.showMinVolts) {

            redrawChart = true
        }

        if (oldContext.lastResizeTimestamp != newContext.lastResizeTimestamp) {
            if (this._rootDivRef) {
                this.recalculateChartDimensions()
                resetPipelineAndRedraw = true
            }
        } else if (oldContext.deviceState.lastResetTime != newContext.deviceState.lastResetTime) {
            this.resetData()
            redrawDataOnly = true
        }

        if (redrawDataOnly && this._line) {
            this._d3DataPath?.datum(this._subsamples).attr('d', this._line)
        }

        if (resetPipelineAndRedraw) {
            this.resetPipelineAndRedraw()
        }

        if (redrawChart) {
            this.redrawChart()
        }
    }

    componentWillUnmount = () => {
        this._pipeline?.delete()
    }

    // ==================== Private ====================
    private _rootDivRef : Element | null = null
    private _svgRef : SVGElement | null = null
    private _d3DataPath : d3.Selection<SVGPathElement, number[], null, undefined> | null = null
    private _line : d3.Line<number> | null = null

    private _width = 500
    private _height = 300

    private _maxSubsamples: number
    private _subsamples: number[] = []

    private _pipeline: Pipeline | null = null

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
                'name': 'SubsamplingFilter',
                'samplesPerSec': pipelineBase.outSamplesPerSec,
                'maxSubsamples': this._maxSubsamples,
                'windowLengthSec': chartConfig.showTimePeriodSec
            }

        ]).then(pipeline => {
            // If the user quickly changed settings a bunch of times, 
            // another pipeline may have appeared here while we were waiting for the
            // request to complete.
            this._pipeline?.delete().then(() => {})
            this._pipeline = null
            this.resetData()
    
            this._pipeline = pipeline
            pipeline.onData(this.onNewSubsamples)
            this.redrawChart()
        })
    }

    private onNewSubsamples = (newSubsamples: number[]) => {
        if (newSubsamples.length >= this._maxSubsamples) {
            // The subsamples were entirely recalculated by the  engine.
            const numToCopy = Math.min(this._maxSubsamples, newSubsamples.length)
            const copyFrom = newSubsamples.length - numToCopy
            this._subsamples = newSubsamples.slice(copyFrom)

        } else {
            // Incremental update.
            const numToRemove = 
                Math.max(this._subsamples.length + newSubsamples.length - this._maxSubsamples, 0)
            
            this._subsamples.splice(0, numToRemove)
            this._subsamples.push(...newSubsamples)
        }

        // Redraw the chart
        if (this._line) {
            this._d3DataPath?.datum(this._subsamples).attr('d', this._line)
        }
    }

    private formatXTick = (d: NumberValue, i: number) : string => {
        if (i % 2 != 0 || this.props.hideAxes) {
            return ''
        }

        const timeSpan = this.props.context.chartConfig.showTimePeriodSec

        if (timeSpan > 4) {
            const tickSec = d.valueOf() * timeSpan / this._maxSubsamples
            return d3.format('.2s')(tickSec) + ' s'

        } else {
            const tickMSec = d.valueOf() * timeSpan / this._maxSubsamples * 1000
            return d3.format(',.2r')(tickMSec) + ' ms'
        }
    }

    private formatYTick = (d: NumberValue, i: number) : string => {
        if (i % 2 == 0 || this.props.hideAxes) {
            return ''
        }

        const volts = d.valueOf()
        const chartConfig = this.props.context.chartConfig
        const range = chartConfig.showMaxVolts - chartConfig.showMinVolts

        if (range >= 1.5) {
            return d3.format(',.2r')(volts) + ' V'
        }

        if (range >= 0.0015) {
            return d3.format(',.2r')(volts * 1000) + ' mV'
        }

        return d3.format(',.2r')(volts * 1000_000) + ' μV'
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

    private redrawChart = () => {
        const props = this.props
        const chartConfig = props.context.chartConfig
        const chartWidth = this.chartWidth()
        const chartHeight = this.chartHeight()
        const maxSamples = this._maxSubsamples

        const leftPadding = this.leftPadding()

        // Clear anything that was drawn previously and prep to draw.
        const svg = d3.select(this._svgRef)
        svg.html('')
        svg.attr('width', this._width)
            .attr('height', this._height)

        // Build the axes and gridlines.
        const xScale = d3.scaleLinear()
                        .domain([0, maxSamples])
                        .range([leftPadding, leftPadding + chartWidth])

        const yRange = [
            chartConfig.showMinVolts,
            chartConfig.showMaxVolts
        ]
        const yScale = d3.scaleLinear().domain(yRange).range([chartHeight, 0])

        const xTicks = [
            0,
            maxSamples / 4,
            maxSamples / 2,
            maxSamples * 3 / 4,
            maxSamples,
        ]

        const xAxis = d3.axisBottom(xScale)
            .tickValues(xTicks)
            .tickSizeInner(0)
            .tickSizeOuter(0)
            .tickPadding(chartHeight/2 + 5)
            .tickFormat(this.formatXTick)

        const yAxis = d3.axisLeft(yScale)
            .ticks(7)
            .tickSizeInner(props.hideGridlines ? 0 : -chartWidth)
            .tickSizeOuter(0)
            .tickFormat(this.formatYTick)

        svg.append('g')
            .attr('class', 'xAxis')
            .attr('transform', `translate(0, ${chartHeight/2})`)
            .call(xAxis)

        svg.append('g')
            .attr('class', 'yAxis')
            .attr('transform', `translate(${leftPadding}, 0)`)
            .call(yAxis)
            .call(g => g.selectAll('.tick line')
                .attr('stroke', 'lightgray'))
            .call(g => g.select('.domain').remove())

        if (!props.hideGridlines) {
        // Draw the vertical gridlines. Since the x-axis is drawn in the middle,
        // d3 won't just give them to us for free like it does with the horizontal gridlines.
            svg.selectAll('g.xAxis g.tick')
                .append('line')
                .attr('stroke', 'lightgray')
                .attr('x1', 0)
                .attr('y1', chartHeight/2)
                .attr('x2', 0)
                .attr('y2', -chartHeight/2)
        }

        // Draw the data.
        this._line = d3.line<number>()
            .x((d, i) => xScale(i))
            .y(d => yScale(d))

        this._d3DataPath = svg.append('path')
            .attr('class', 'line data')
            .style('stroke', 'blue')
            .style('fill', 'none')
            .datum(this._subsamples)
    }

    private recalculateChartDimensions = () => {
        if (!this._rootDivRef) {
            return
        }

        // Set the new dimensions for the drawing area.
        const availableDrawingArea = this._rootDivRef.getBoundingClientRect()
        this._width = Math.floor(availableDrawingArea.width)
        this._height = Math.floor(availableDrawingArea.height) - 1
        
        this._maxSubsamples = this.chartWidth() * 2

        if (this._maxSubsamples <= 0) {
            this._maxSubsamples = 10
        }

        this.resetData()
    }

    private resetData = () => {
        this._subsamples = new Array(this._maxSubsamples).fill(0)
    }
}