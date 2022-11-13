export const MAX_SAMPLES = 100_000
export const INIT_SAMPLES_PER_SEC = 20_000

export const AXIS_COLOR = 'lightgray'

export const RESCALING_FILTER_CONFIG = {
    name: 'RescalingFilter',
    offset: -32768,
    multiplier: 0.195 / 1000 / 1000
}

// ============== OpenMEA electrode config ==================
export const NUM_OPENMEA_ELECTRODES = 64

export const OPENMEA_ELECTRODE_MAP = [
    NaN, 0x3e, 0x3c, 0x39, 0x36, 0x33, 0x31, NaN,
    0x02, 0x01, 0x3d, 0x38, 0x37, 0x32, 0x2e, 0x2d,
    0x04, 0x03, 0x00, 0x3a, 0x35, 0x30, 0x2c, 0x2b,
    0x07, 0x06, 0x05, 0x3b, 0x34, 0x2a, 0x29, 0x28,
    0x08, 0x09, 0x0a, 0x14, 0x1b, 0x25, 0x26, 0x27,
    0x0b, 0x0c, 0x10, 0x15, 0x1a, 0x20, 0x23, 0x24,
    0x0d, 0x0e, 0x12, 0x17, 0x18, 0x1d, 0x21, 0x22,
    NaN, 0x11, 0x13, 0x16, 0x19, 0x1c, 0x1e, NaN
]

export const OPENMEA_ELECTRODE_EXISTS = [
    false, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true,
    false, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true,
    false, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true,
    false, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true,
]

export const OPENMEA_ELECTRODE_NAMES: (string|null)[] = new Array(NUM_OPENMEA_ELECTRODES).fill(null)

for (let i = 0; i < OPENMEA_ELECTRODE_MAP.length; i++) {
    const columns = Math.ceil(Math.sqrt(NUM_OPENMEA_ELECTRODES))
    const rows = Math.ceil(NUM_OPENMEA_ELECTRODES / columns)
    const row = i % rows
    const column = Math.floor(i / rows)
    const position = row * columns + column

    const electrodeNum = OPENMEA_ELECTRODE_MAP[position]

    if (isNaN(electrodeNum)) continue

    OPENMEA_ELECTRODE_NAMES[electrodeNum] = "" + (((column + 1) * 10) + row + 1)
}

// ============== Neuroprobe electrode config ==================

export const NUM_NEUROPROBE_ELECTRODES = 18

export const NEUROPROBE_ELECTRODE_MAP = [
    17, 0,
     8, 9,
    16, 1,
     7, 10,
    15, 2,
     6, 11,
    14, 3,
     5, 12,
    13, 4,
]

export const NEUROPROBE_ELECTRODE_EXISTS = [
    true, true, true, true, true, true, true, true, true, 
    true, true, true, true, true, true, true, true, true
]

export const NEUROPROBE_ELECTRODE_NAMES: (string|null)[] = new Array(NUM_OPENMEA_ELECTRODES).fill(null)

for (let i = 0; i < NEUROPROBE_ELECTRODE_MAP.length; i++) {
    NEUROPROBE_ELECTRODE_NAMES[i] = "" + (i + 8)
}
// ============== Stim config ==================
export const STIM_STEP_SIZES = [
    0.000_000_01,
    0.000_000_02,
    0.000_000_05,
    0.000_000_1,
    0.000_000_2,
    0.000_000_5,
    0.000_001,
    0.000_002,
    0.000_005,
    0.000_01,
]

export const MAX_SAMPLES_PER_SEC = 40_000

export const PULSE_COLORS = [
    'red',
    'blue',
    'green',
    'yellow',
    'purple',
    'pink'
]