/**
 * This script simulates OpenMEA sending samples over UDP.
 * 
 * To run: 
 *     node udptest.js
 */

const dgram = require('dgram')

const NUM_SOCKETS = 1
const NUM_CHANNELS_PER_SOCKET = 18
const NUM_CHANNELS = NUM_SOCKETS * NUM_CHANNELS_PER_SOCKET
const NUM_CONTROL_REPLY_DWORDS = 2
const NUM_DWORDS_PER_BLOCK = NUM_CHANNELS_PER_SOCKET + NUM_CONTROL_REPLY_DWORDS
const BASE_PORT = 5052

const SAMPLES_PER_SEC = 20_000

const AC_NOISE_AMPLITUDE = 100
const AC_PROB_OF_SPIKE = 0.1 / SAMPLES_PER_SEC
const AC_SPIKE_AVE_AMPLITUDE = 50_000
const AC_SPIKE_NOISE = 500
const AC_SPIKE_DECAY = 0.87
const AC_SPIKE_RAMP_RATE = 0.05
const AC_STOP_SPIKE_WHEN_BELOW = 100

const AC_SINE_60HZ_AMPLITUDE = 70
const AC_SINE_60HZ_FREQ = 59.95

const MAX_VALUES_PER_PACKET = 100
const CHIP_ID = 32
const CHANNEL_OFFSET = 0xb

console.log("======= starting =======")

// These will be used to help generate new values.
const lastAcValues = []
for (let i = 0; i < NUM_CHANNELS; i++) {
    lastAcValues.push(0)
}

const spikeValueRemaining = []
for (let i = 0; i < NUM_CHANNELS; i++) {
    spikeValueRemaining.push(0)
}

// Set up the sockets on which we'll send UDP packets with samples
const sockets = []
const socketsReadyPromises = []

for (let i = 0; i < NUM_SOCKETS; i++) {
    const socket = dgram.createSocket('udp4')
    sockets.push(socket)

    const socketReadyPromise = new Promise((resolve, reject) => {
        socket.connect(BASE_PORT + i, '127.0.0.1', () => resolve())
    })
    socketsReadyPromises.push(socketReadyPromise)
}

Promise.all(socketsReadyPromises).then(() => {
    console.log("Sockets ready. Emitting values...")
    emmitNewValues()
})

// Emitting data
let lastEmittedTime = Date.now()
let totalSamples = 0
let totalPackets = 0
const startTime = Date.now()

const emmitNewValues = () => {
    const now = Date.now()
    const shouldBeAtSamples = Math.round((now - startTime) * SAMPLES_PER_SEC / 1000)
    const samplesNeeded = shouldBeAtSamples - totalSamples

    // We shouldn't send more than 8192 bytes of data.
    const samplesToEmit = Math.min(MAX_VALUES_PER_PACKET, samplesNeeded)
    const bufferSize = samplesToEmit * NUM_DWORDS_PER_BLOCK * 4

    if (samplesToEmit == 0) {
        setImmediate(emmitNewValues)
        return
    }

    console.log(`${Date.now()}: Emitting ${samplesToEmit} values`)
    const sineNoise = generate60HzNoise()

    for (let socketNum = 0; socketNum < NUM_SOCKETS; socketNum++) {
        const firstChannel = socketNum * NUM_CHANNELS_PER_SOCKET
        let bufferOffset = 0

        const arrayBuffer = new ArrayBuffer(bufferSize)
        const buffer = Buffer.from(arrayBuffer)
    
        for (let sampleNum = 0; sampleNum < samplesToEmit; sampleNum++) {
            const sineNoise = generate60HzNoise(totalSamples + sampleNum)

            for (let i = 0; i < NUM_DWORDS_PER_BLOCK; i++) {
                // const channelMetadata = (channelId << 8) + socketNum
                const channelId = (i + CHANNEL_OFFSET) % NUM_DWORDS_PER_BLOCK

                if (channelId >= NUM_CHANNELS_PER_SOCKET) {
                    // Signal that this is not a sample
                    buffer.writeUInt16LE(1 << 5, bufferOffset)

                    // Dummy "CHIP_ID" command response
                    buffer.writeUInt16LE(CHIP_ID, bufferOffset + 2)
                } else {
                    // Sample format: 
                    //    bit position: 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 
                    //                  f e d c b a 9 8 7 6 5 4 3 2 1 0 f e d c b a 9 8 7 6 5 4 3 2 1 0
                    //                 |            AC sample          |      nothing      |  chan ID  |
                    const firstTwoBytes = channelId
                    buffer.writeUInt16LE(firstTwoBytes, bufferOffset)

                    const acSample = generateAcSample(lastAcValues[firstChannel + channelId], firstChannel + channelId) + sineNoise
                    lastAcValues[firstChannel + channelId] = acSample
                    buffer.writeUInt16LE((acSample + 32768), bufferOffset + 2)
                }

                bufferOffset += 4
            }
        }

        // console.log(`  Sending on socket: ${socketNum}`)
        sockets[socketNum].send(buffer)
    }

    totalSamples += samplesToEmit
    totalPackets++
    const samplesPerSec = 1000 * totalSamples / (now - startTime)
    const packetsPerSec = 1000 * totalPackets / (now - startTime)
    console.log(`  samplesPerSec: ${samplesPerSec}; packetsPerSec: ${packetsPerSec}`)

    lastEmittedTime = now
    setImmediate(emmitNewValues)
}

const generateAcSample = (prevSample, channelNum) => {
    // Spike?
    if (spikeValueRemaining[channelNum] == 0 && Math.random() < AC_PROB_OF_SPIKE) {
        spikeValueRemaining[channelNum] = 
            Math.round(AC_SPIKE_AVE_AMPLITUDE - AC_SPIKE_NOISE + 2 * AC_SPIKE_NOISE * Math.random())
    }

    let spikeAddedValue = 0

    if (spikeValueRemaining[channelNum] != 0) {
        spikeAddedValue = spikeValueRemaining[channelNum] * AC_SPIKE_RAMP_RATE
        spikeValueRemaining[channelNum] -= spikeAddedValue

        if (spikeValueRemaining[channelNum] < AC_STOP_SPIKE_WHEN_BELOW) {
            spikeValueRemaining[channelNum] = 0
        }
    }

    // Spike decay + regular noise
    const noise = -AC_NOISE_AMPLITUDE + 2 * AC_NOISE_AMPLITUDE * Math.random()
    return Math.round(prevSample * AC_SPIKE_DECAY + spikeAddedValue + noise)
}

const generate60HzNoise = (sampleNum) => {
    const elapsedTime = sampleNum / SAMPLES_PER_SEC
    let sineNoise = 0

    for (let i = 1; i < 6; i++) {
        sineNoise += (1/Math.pow(i, 2)) * AC_SINE_60HZ_AMPLITUDE * Math.sin(elapsedTime * AC_SINE_60HZ_FREQ * i * 2 * Math.PI)
    }

    return sineNoise
}

