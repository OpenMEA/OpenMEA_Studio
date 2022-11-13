import * as d3 from 'd3'
import { AppContext } from './renderer/AppContext'
import { PipelineElement } from './renderer/engine/Pipeline'

export type KeysMatching<T, V> = {[K in keyof T]-?: T[K] extends V ? K : never}[keyof T]

export function formatSI(num: number) : string {
    let str = d3.format('.3s')(num)

    // Replace trailing zeros.
    str = str.replace(".00", "")
    str = str.replace(/\.0(\[a-zA-Z])?$/, '$1')
    return str
}

export function parseSI(value: string): [number , boolean] {
    // Some libraries produce `−` (0x2212) instead of the usual `-` (0x2d)
    value = value.replace('−', '-')

    // Must be a number followed by an optional letter.
    if (!value.match(/^-?(\d*\.\d+|\d+)[a-zA-Zµ]?$/)) {
        return [NaN, false]
    }

    let suffix = value.substr(-1)

    if (!isNaN(parseInt(suffix))) {
        const parsed = parseFloat(value)

        if (isNaN(parsed) || !isFinite(parsed)) {
            return [NaN, false]
        }

        return [parsed, true]
    }

    let multiplier = 1

    if (suffix == 'T')
        multiplier = 1000_000_000_000
    else if (suffix == 'G')
        multiplier = 1000_000_000
    else if (suffix == 'M')
        multiplier = 1000_000
    else if (suffix == 'k')
        multiplier = 1000
    else if (suffix == 'm')
        multiplier = 1/1000
    else if (suffix == 'u' || suffix == 'µ')
        multiplier = 1/1000_000
    else if (suffix == 'n')
        multiplier = 1/1000_000_000
    else if (suffix == 'p')
        multiplier = 1/1000_000_000_000
    else if (suffix == 'f')
        multiplier = 1/1000_000_000_000_000
    else
        return [NaN, false]

    const numValue = value.substr(0, value.length - 1)
    const parsed = parseFloat(numValue)

    if (isNaN(parsed) || !isFinite(parsed)) {
        return [NaN, false]
    }

    return [parsed * multiplier, true]
}

/**
 * Finds a multiple of `multipleOfFreq` argument that is close to `fromFreq` while trying to keep
 * the greatest common denominator of the restult and `fromFreq` as large as possible.   
 */
export function toNearbyFreqMultiple(fromFreq: number, multipleOfFreq: number) {
    if (multipleOfFreq == 0 || isNaN(multipleOfFreq)) {
        return fromFreq
    }

    // Reduce the order of magnitude of fromFreq.
    const targetMagnitude = 2;
    const reduceMagnitudeBy = Math.floor(Math.log10(fromFreq)) - targetMagnitude
    const reducedFromFreq = fromFreq / (10 ** reduceMagnitudeBy)

    // Find the nearest multiple of multipleOfFreq.
    const divided = Math.round(reducedFromFreq / multipleOfFreq)
    const nearestMultiple = divided * multipleOfFreq

    // Resize back to the original magnitude.
    const result = nearestMultiple * (10 ** reduceMagnitudeBy)
    return result
}

export interface BasePipeline {
    baseFilters: PipelineElement[]
    outSamplesPerSec: number
}

export function buildPipelineBase(context: AppContext, electrodeNum: number): BasePipeline {
    const deviceProps = context.deviceManager.deviceProps
    
    const combFilterConfig = context.combFilterConfig
    const samplesPerSec = context.deviceState.samplesPerSec
    const resampleToFreq = toNearbyFreqMultiple(samplesPerSec, combFilterConfig.freq)

    const baseFilters: PipelineElement[] = [
        `electrodes[${electrodeNum}].ac`,
        {
            name: 'BandFilter',
            ...context.bandFilterConfig
        }
    ]

    if (deviceProps!!.canSampleDC) {
        const acDcMixConfig = context.acDcMixConfig
        
        baseFilters.push({
            name: 'AddAnotherSeriesFilter',
            addSeriesName: `electrodes[${electrodeNum}].dc`,
            thisSeriesFactor: acDcMixConfig.acMultiplier,
            otherSeriesFactor: acDcMixConfig.dcMultiplier
        })
    }

    if (combFilterConfig.freq != 0) {
        baseFilters.push({
            name: 'ResamplingFilter',
            inSampleRate: samplesPerSec,
            outSampleRate: resampleToFreq
        })
        
        for (let i = 0; i < combFilterConfig.order; i++) {
            baseFilters.push({
                name: 'CombFilter',
                ...context.combFilterConfig,
                samplesPerSec: resampleToFreq
            })
        }
    }

    return {
        baseFilters: baseFilters,
        outSamplesPerSec: resampleToFreq
    }
}

