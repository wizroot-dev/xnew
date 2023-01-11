
//----------------------------------------------------------------------------------------------------
// device 
//----------------------------------------------------------------------------------------------------

export const device = (() => {
    const device = {};
    Object.defineProperties(device, {
        isMobile: {
            value: () => {
                return navigator.userAgent.match(/iPhone|iPad|Android.+Mobile/);
            }
        },
        hasTouch: {
            value: () => {
                return window.ontouchstart !== undefined && navigator.maxTouchPoints > 0;
            }
        },
    });
    return device;
})();


//----------------------------------------------------------------------------------------------------
// audio 
//----------------------------------------------------------------------------------------------------

export const audio = (() => {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const store = new Map();

    const keymap = {
        'A0': 27.500, 'A#0': 29.135, 'B0': 30.868, 
        'C1': 32.703, 'C#1': 34.648, 'D1': 36.708, 'D#1': 38.891, 'E1': 41.203, 'F1': 43.654, 'F#1': 46.249, 'G1': 48.999, 'G#1': 51.913, 'A1': 55.000, 'A#1': 58.270, 'B1': 61.735, 
        'C2': 65.406, 'C#2': 69.296, 'D2': 73.416, 'D#2': 77.782, 'E2': 82.407, 'F2': 87.307, 'F#2': 92.499, 'G2': 97.999, 'G#2': 103.826, 'A2': 110.000, 'A#2': 116.541, 'B2': 123.471,
        'C3': 130.813, 'C#3': 138.591, 'D3': 146.832, 'D#3': 155.563, 'E3': 164.814, 'F3': 174.614, 'F#3': 184.997, 'G3': 195.998, 'G#3': 207.652, 'A3': 220.000, 'A#3': 233.082, 'B3': 246.942,
        'C4': 261.626, 'C#4': 277.183, 'D4': 293.665, 'D#4': 311.127, 'E4': 329.628, 'F4': 349.228, 'F#4': 369.994, 'G4': 391.995, 'G#4': 415.305, 'A4': 440.000, 'A#4': 466.164, 'B4': 493.883,
        'C5': 523.251, 'C#5': 554.365, 'D5': 587.330, 'D#5': 622.254, 'E5': 659.255, 'F5': 698.456, 'F#5': 739.989, 'G5': 783.991, 'G#5': 830.609, 'A5': 880.000, 'A#5': 932.328, 'B5': 987.767,
        'C6': 1046.502, 'C#6': 1108.731, 'D6': 1174.659, 'D#6': 1244.508, 'E6': 1318.510, 'F6': 1396.913, 'F#6': 1479.978, 'G6': 1567.982, 'G#6': 1661.219, 'A6': 1760.000, 'A#6': 1864.655, 'B6': 1975.533,
        'C7': 2093.005, 'C#7': 2217.461, 'D7': 2349.318, 'D#7': 2489.016, 'E7': 2637.020, 'F7': 2793.826, 'F#7': 2959.955, 'G7': 3135.963, 'G#7': 3322.438, 'A7': 3520.000, 'A#7': 3729.310, 'B7': 3951.066,
        'C8': 4186.009,
    };
    const notemap = {
        '1m': 4.000, '2n': 2.000, '4n': 1.000, '8n': 0.500, '16n': 0.250, '32n': 0.125,
    };

    const audio = {};
    Object.defineProperties(audio, {
        context: {
            get: () => context,
        },
        create: {
            value: (props) => new synth(props),
        },
        load: {
            value: (path) => new Music(path),
        },
    });
    return audio;

    function Connect(config) {

        Object.keys(config).forEach((key) => {
            if (Array.isArray(config[key])) {
                const [type, props, ...to] = config[key];
                if (audio.context[`create${type}`]) {
                    const node = audio.context[`create${type}`]();
                    this[key] = node;

                    Object.keys(props).forEach((name) => {
                        if (node[name] !== undefined) {
                            if (node[name]?.value !== undefined) {
                                node[name].value = props[name];
                            } else {
                                node[name] = props[name];
                            }
                        }
                    });
                }
            }
        });

        Object.keys(config).forEach((key) => {
            if (Array.isArray(config[key])) {
                const [type, props, ...to] = config[key];
                if (this[key]) {
                    const node = this[key];
                    to.forEach((to) => {
                        if (this[to]) {
                            node.connect(this[to]);
                        } else if (to === 'destination') {
                            node.connect(audio.context.destination);
                        }
                    });
                }
            }
        });
    }

    function Music(path) {
        let data = null;
        if (store.has(path)) {
            data = store.get(path);
        } else {
            data = {};
            data.buffer = null;
            data.promise = fetch(path)
                .then((response) => response.arrayBuffer())
                .then((response) => context.decodeAudioData(response))
                .then((response) => data.buffer = response)
                .catch(() => {
                    console.warn(`"${path}" could not be loaded.`)
                });
            store.set(path, data);
        }

        let startTime = null;

        const nodes = new Connect({
            source: ['BufferSource', {}, 'volume'],
            volume: ['Gain', { gain: 1.0 }, 'output'],
            output: ['Gain', { }, 'destination'],
        });
        
        Object.defineProperties(this, {
            isReady: {
                value: () => data.buffer ? true : false,
            },
            promise: {
                get: () => data.promise,
            },
            volume: {
                set: (value) => nodes.volume.gain.value = value,
                get: () => nodes.volume.gain.value,
            },
            loop: {
                set: (value) => nodes.source.loop = value,
                get: () => nodes.source.loop,
            },
            play: {
                value: () => {
                    if (startTime === null) {
                        if (this.isReady()) {
                            startTime = context.currentTime;
                            nodes.source.buffer = data.buffer;
                            nodes.source.playbackRate.value = 1;

                            nodes.source.start(audio.context.currentTime);
                        } else {
                            data.promise.then(() => { 
                                this.play();
                            });
                        }
                    }
                },
            },
            stop: {
                value: () => {
                    if (startTime !== null) {
                        nodes.source.stop(audio.context.currentTime);
        
                        return (context.currentTime - startTime) % data.buffer.duration;
                    }
                },
            }
        });
    };

    function synth({ waveform = 'sine', volume = 1.0, envelope = null, reverb = null }) {
        if (envelope) {
            envelope = Object.assign({ attack: 0.1, decay: 0.1, sustain: 0.0, release: 0.0 }, envelope);
        }
        if (reverb) {
            reverb = Object.assign({ duration: 0.1, decay: 2.0, mix: 0.5 }, reverb);
        }
        const nodes = new Connect({
            // oscillator: ['Oscillator', { type, frequency }, 'volume'],
            volume: ['Gain', { gain: volume }, 'gmain', 'convolver', 'delay'],
            gmain: ['Gain', { gain: 1.0 * (reverb ? (1.0 - reverb.mix) : 1.0) }, 'output'],

            output: ['Gain', { }, 'destination'],
            convolver: reverb ? ['Convolver', { buffer: impulseResponse(reverb) }, 'greverb'] : null,
            greverb: reverb ? ['Gain', { gain: reverb.mix }, 'output'] : null,
            // delay: echo ? ['Delay', { delayTime: echo.delay }, 'output', 'feedback'] : null,
            // feedback: echo ? ['Gain', { gain: echo.feedback }, 'delay'] : null,
        });

        Object.defineProperties(this, {
            stroke: {
                value: (frequency, duration, { wait = 0.0, pitchBend = [] } = {}) => {
                    frequency = isFinite(frequency) ? frequency : keymap[frequency];
                    const oscillator = audio.context.createOscillator();
                    oscillator.type = waveform;
                    oscillator.frequency.value = frequency;
                    oscillator.connect(nodes.volume);

                    const start = audio.context.currentTime + wait;
                    let stop = null;
                    if (envelope) {
                        envelope = Object.assign({ attack: 0.1, decay: 0.1, sustain: 0.0, release: 0.0 }, envelope);
                        duration = Math.max(duration, envelope.attack + envelope.decay);
                        nodes.volume.gain.value = 0.0;
                        nodes.volume.gain.linearRampToValueAtTime(0.0, start);
                        nodes.volume.gain.linearRampToValueAtTime(volume, start + envelope.attack);
                        nodes.volume.gain.linearRampToValueAtTime(volume * envelope.sustain, start + envelope.attack + envelope.decay);
                        nodes.volume.gain.linearRampToValueAtTime(volume * envelope.sustain, start + duration);
                        nodes.volume.gain.linearRampToValueAtTime(0.0, start + duration + envelope.release);
                        stop = start + duration + envelope.release;
                    } else {
                        nodes.volume.gain.value = volume;
                        stop = start + duration;
                    }
                    oscillator.start(start);
                    oscillator.stop(stop);
        
                    oscillator.frequency.linearRampToValueAtTime(frequency, start);
                    pitchBend.forEach((pitch, i) => {
                        oscillator.frequency.linearRampToValueAtTime(Math.max(10, frequency + pitch), start + (stop - start) * (i + 1) / pitchBend.length);
                    })
                },
            },
            volume: {
                set: (value) => nodes.volume.gain.value = value,
                get: () => nodes.volume.gain.value,
            },
        });
    }

    function impulseResponse({ duration, decay = 2.0 }) {
        const length = audio.context.sampleRate * duration;
        const impulse = audio.context.createBuffer(2, length, audio.context.sampleRate);
    
        const ch0 = impulse.getChannelData(0);
        const ch1 = impulse.getChannelData(1);
        for (let i = 0; i < length; i++) {
            ch0[i] = (2 * Math.random() - 1) * Math.pow(1 - i / length, decay);
            ch1[i] = (2 * Math.random() - 1) * Math.pow(1 - i / length, decay);
        }
        return impulse;
    }
})();