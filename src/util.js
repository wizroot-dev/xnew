
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
    const audio = {};

    Object.defineProperties(audio, {
        context: {
            get: () => context,
        },
        create: {
            value: (props) => new SoundEffect(props),
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
        console.log(path);
        data.promise.then(() => console.log('loaded'));
        let startTime = null;
        let state = { volume: 1.0, };

        const nodes = new Connect({
            source: ['BufferSource', {}, 'volume'],
            volume: ['Gain', { gain: 1.0 }, 'output'],
            output: ['Gain', { }, 'destination'],
        });
        
        Object.defineProperties(this, {
            isReady: { value: () => data.buffer ? true : false, },
            promise: { get: () => data.promise, },
            volume: {
                set: (value) => { 
                    state.volume = value;
                    if (standardNode) standardNode.volume = value;
                },
                get: () => {
                    return standardNode ? standardNode.volume : state.volume;
                },
            },
            
        });
    
        this.play = (wait = 0.0, duration = null, loop = false) => {           
            if (this.isReady() === false) return;
            this.pause();

            startTime = context.currentTime;
            //state.volume = volume ?? state.volume;
            console.log(nodes);
            nodes.source.buffer = data.buffer;
            nodes.source.playbackRate.value = 1;
            
            nodes.source.loop = loop;
            nodes.source.start(audio.context.currentTime + wait);
        };
    
        this.pause = () => {
            if (startTime !== null) {
                nodes.source.stop(audio.context.currentTime);

                state.volume = nodes.volume.gain.value;
                return (context.currentTime - startTime) % data.buffer.duration;
            }
        };
    };

    function SoundEffect({ type = 'sine', frequency = 200, volume = 1.0, envelope = null, pitchBend = [], reverb = null }) {
        if (envelope) {
            envelope = Object.assign({ attack: 0.1, decay: 0.1, sustain: 0.0, release: 0.0 }, envelope);
        }
        if (reverb) {
            reverb = Object.assign({ duration: 0.1, decay: 2.0, mix: 0.5 }, reverb);
        }
        const nodes = new Connect({
            oscillator: ['Oscillator', { type, frequency }, 'volume'],
            volume: ['Gain', { gain: volume }, 'gmain', 'convolver', 'delay'],
            gmain: ['Gain', { gain: 1.0 * (reverb ? (1.0 - reverb.mix) : 1.0) }, 'output'],

            output: ['Gain', { }, 'destination'],
            convolver: reverb ? ['Convolver', { buffer: impulseResponse(reverb) }, 'greverb'] : null,
            greverb: reverb ? ['Gain', { gain: reverb.mix }, 'output'] : null,
            // delay: echo ? ['Delay', { delayTime: echo.delay }, 'output', 'feedback'] : null,
            // feedback: echo ? ['Gain', { gain: echo.feedback }, 'delay'] : null,
        });

        Object.defineProperties(this, {
            play: {
                value: (wait = 0.0, duration = 0.0) => {
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
                    nodes.oscillator.start(start);
                    nodes.oscillator.stop(stop);
        
                    nodes.oscillator.frequency.linearRampToValueAtTime(frequency, start);
                    pitchBend.forEach((pitch, i) => {
                        nodes.oscillator.frequency.linearRampToValueAtTime(Math.max(10, frequency + pitch), start + (stop - start) * (i + 1) / pitchBend.length);
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