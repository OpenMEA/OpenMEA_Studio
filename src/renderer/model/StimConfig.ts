import { INIT_SAMPLES_PER_SEC } from "client/Constants";

export class StimConfig {
    stimStepSizeIndex: number = 6 // 1 uA
    maxFrequency: number = INIT_SAMPLES_PER_SEC

    pulseType: PulseType = PulseType.BIPHASIC
    pulseConfig: PulseConfig = new BiphasicStimulationConfig()

    loopForever: boolean = false

    electrodesByPulse: number[][] = [[]]
}

export enum PulseType {
    WAV_FILES = 'wav_files',
    BIPHASIC = 'biphasic'
}

export class WavStimulationConfig {
    filePaths: string[] = []
}

export class BiphasicStimulationConfig {
    phase1Duration: number = 0.001
    interphaseDuration: number = 0
    phase2Duration: number = 0.001

    phase1Current: number = 0
    phase2Current: number = 0
}

export type PulseConfig = WavStimulationConfig | BiphasicStimulationConfig

export function isWavFile(pulseConfig: PulseConfig): pulseConfig is WavStimulationConfig {
    return (pulseConfig as WavStimulationConfig).filePaths !== undefined
}

export function isBiphasic(pulseConfig: PulseConfig): pulseConfig is BiphasicStimulationConfig {
    return (pulseConfig as BiphasicStimulationConfig).phase1Duration !== undefined
}