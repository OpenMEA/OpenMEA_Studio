export interface BandFilterConfig {
    samplesPerSec: number
    
    lowOrder: number
    low3dbFreq: number
    lowRp: number
    lowRs: number
    lowFType: string

    highOrder: number
    high3dbFreq: number
    highRp: number
    highRs: number
    highFType: string
}