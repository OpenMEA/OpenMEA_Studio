import { ChartConfig } from "client/renderer/model/ChartConfig";
import { PythonInstallerRendererProxy } from "client/services/python-installer/PythonInstallerRendererProxy";
import { DeviceManager } from "./DeviceManager";
import { EngineClient } from "./engine/EngineClient";
import { AcDcMixConfig } from "./model/AcDcMixConfig";
import { BandFilterConfig } from "./model/BandFilterConfig";
import { CombFilterConfig } from "./model/CombFilterConfig";
import { DeviceState } from "./model/DeviceState";
import { SaveFileConfig } from "./model/SaveFileConfig";
import { StimConfig } from "./model/StimConfig";

export enum PythonInstallState {
    UNKNOWN,
    INSTALLED,
    NOT_INSTALLED
}

export interface AppContext {
    engineClient: EngineClient
    isEngineReady: boolean
    pythonInstaller: PythonInstallerRendererProxy
    pythonInstallState: PythonInstallState
    deviceManager: DeviceManager

    selectedElectrode: number
    deviceState: DeviceState

    chartConfig: ChartConfig
    acDcMixConfig: AcDcMixConfig
    bandFilterConfig: BandFilterConfig
    combFilterConfig: CombFilterConfig
    saveFileConfig: SaveFileConfig | null
    stimConfig: StimConfig

    lastResizeTimestamp: number
    lastFilterConfigChangeTimestamp: number

    setChartConfig: (chartConfig: ChartConfig) => void
    setAcDcMixConfig: (config: AcDcMixConfig) => void
    setBandFilterConfig: (config: BandFilterConfig) => void
    setCombFilterConfig: (config: CombFilterConfig) => void
    setSaveFileConfig: (config: SaveFileConfig) => Promise<void>
    setStimConfig: (config: StimConfig) => void

    setSelectedElectrode: (channel: number) => void
    notifyLayoutChanged: () =>  void
}