export interface ChartConfig {
    samplesPerSec: number
    
    streamMaxVolts: number
    streamMinVolts: number
    showTimePeriodSec: number
    showMaxVolts: number
    showMinVolts: number
    arrangeChannels: ArrangeChannels

    spectrogramMaxFreq: number
    spectrogramCalculationPeriod: number

    notchFilter60Hz: boolean
}

export enum ArrangeChannels {
    BY_NUMBER, BY_POSITION
}