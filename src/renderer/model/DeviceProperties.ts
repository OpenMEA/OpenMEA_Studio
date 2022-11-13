export class DeviceProperties {
    name: string = ""
    canRecordToFile: boolean = false
    canStimulate: boolean = false
    canControlSampling: boolean = false
    canControlReplay: boolean = false
    canSampleDC: boolean = false
    numElectrodes: number = 0
    numElectrodeRows: number = 0
    electrodeMap: (number|null)[] = []
    electrodeExistsMap: boolean[] = []
    electrodeNames: (string|null)[] = []

    constructor(init?: Partial<DeviceProperties>) {
        if (!init) {
            return
        }

        Object.assign(this, init)
    }
}

