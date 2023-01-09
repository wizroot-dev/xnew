
//----------------------------------------------------------------------------------------------------
// device 
//----------------------------------------------------------------------------------------------------

export const device = (() => {
    return {
        isMobile: () => {
            return navigator.userAgent.match(/iPhone|iPad|Android.+Mobile/);
        },
        hasTouch: () => {
            return window.ontouchstart !== undefined && navigator.maxTouchPoints > 0;
        },
    };
})();


//----------------------------------------------------------------------------------------------------
// sound 
//----------------------------------------------------------------------------------------------------

export const audio = (() => {
    const context = new (window.AudioContext || window.webkitAudioContext);

    const audio = {};
    Object.defineProperties(audio, {
        context: {
            get: () => context,
        },
        connect: {
            value: (list) => new connect(list),
        },
        create: {
            value: (props) => new Effect(props),
        },
        load: {
            value: (path) => new Music(path),
        },
    });
    return audio;

    function connect(list) {
        Object.keys(list).forEach((key) => {
            const [type, props, ...to] = list[key];
            if (context[`create${type}`]) {
                const node = context[`create${type}`]();
                this[key] = node;

                Object.keys(props).forEach((name) => {
                    if (node[name] !== undefined) {
                        if (node[name].value !== undefined) {
                            node[name].value = props[name];
                        } else {
                            node[name] = props[name];
                        }
                    }
                });
            }
        });

        Object.keys(list).forEach((key) => {
            const [type, props, ...to] = list[key];
            if (this[key]) {
                const node = this[key];
                to.forEach((to) => {
                    if (this[to]) {
                        node.connect(this[to]);
                    } else if (to === 'destination') {
                        console.log(audio.context.destination)+
                        node.connect(audio.context.destination);
                    }
                });
            }
        });
    }

    function createAudioNode(name, input = null, output = null) {
        const node = context[`create${name}`]();
        if (input) input.connect(node);
        if (output) node.connect(output);
        return node;
    }

    function StandardNode({ volume = null, pan = null, echo = null, reverb = null } = {}) {
        const nodes = {};

        if (echo) {
            echo = Object.assign({ delay: 300, feedback: 0.3 }, (typeof echo === 'object' && echo !== null) ? echo : {});
        }
        if (reverb) {
            reverb = Object.assign({ duration: 2000, decay: 2 }, (typeof reverb === 'object' && reverb !== null) ? reverb : {});
        }

        // volumeNode
        {
            nodes.volumeNode = createAudioNode('Gain');
            nodes.volumeNode.gain.value = volume;
        }
        
        // volumeNode -> panNode -> destination
        if (context.createStereoPanner){
            nodes.panNode = createAudioNode('StereoPanner', nodes.volumeNode);
            nodes.panNode.pan.value = pan;
        } else {
            nodes.panNode = createAudioNode('Panner', nodes.volumeNode);
            nodes.panNode.setPosition(pan, 0, 1 - Math.abs(pan));
        }

        // volumeNode -> convolverNode -> panNode
        if (reverb) {
            nodes.convolverNode = createAudioNode('Convolver', nodes.volumeNode, nodes.panNode);
            nodes.convolverNode.buffer = impulseResponse(reverb);
        }

        // volumeNode -> delayNode(feelbackNode ->filterNode ->delayNode) -> panNode
        if (echo) {
            nodes.delayNode = createAudioNode('Delay', nodes.volumeNode, nodes.panNode);
            nodes.delayNode = context.createDelay();
            nodes.delayNode.delayTime.value = echo.delay / 1000;
            
            nodes.feedbackNode = createAudioNode('Gain', nodes.delayNode, nodes.delayNode);
            nodes.feedbackNode.gain.value = echo.feedback;
            nodes.delayNode.connect(nodes.feedbackNode);
            // if (echo.filter > 0) {
            //     nodes.filterNode = context.createBiquadFilter();
            //     nodes.filterNode.frequency.value = echo.filter;
            //     nodes.feedbackNode.connect(nodes.filterNode);
            //     nodes.filterNode.connect(nodes.delayNode);
            // } else {
            //     nodes.feedbackNode.connect(nodes.delayNode);
            // }
        }

        this.fade = (duration, volume, wait = 0) => {
            nodes.volumeNode.gain.linearRampToValueAtTime(nodes.volumeNode.gain.value, context.currentTime + wait / 1000);
            nodes.volumeNode.gain.linearRampToValueAtTime(volume, context.currentTime + (wait + duration) / 1000);
        };

        Object.defineProperties(this, {
            input: {
                get: () => nodes.volumeNode,
            },
            output: {
                get: () => nodes.panNode,
            },
            volume: {
                set: (value) => nodes.volumeNode.gain.value = value,
                get: () => nodes.volumeNode.gain.value,
            },
            pan: {
                set: (value) => nodes.panNode.pan.value = value,
                get: () => nodes.panNode.pan.value,
            },
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

        let sourceNode = null;
        let standardNode = null;
        let startTime = 0;
        let state = { volume: 1.0, pan: 0.0 };

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
            pan: {
                set: (value) => {
                    state.pan = value;
                    if (standardNode) standardNode.pan = value;
                },
                get: () => {
                    return standardNode ? standardNode.pan : state.pan;
                },
            },
        });
    
        this.play = ({ offset = 0, volume = null, pan = null, loop = false, fadeIn = null, echo = null, reverb = null } = {}) => {           
            if (this.isReady() === false) return;
            this.pause();

            startTime = context.currentTime;
            state.volume = volume ?? state.volume;
            state.pan = pan ?? state.pan;

            sourceNode = createAudioNode('BufferSource');
            sourceNode.buffer = data.buffer;
            sourceNode.playbackRate.value = 1;
            
            standardNode = new StandardNode({ volume: state.volume, pan: state.pan, echo, reverb });
            sourceNode.connect(standardNode.input);
            standardNode.output.connect(context.destination)

            if (fadeIn) {
                standardNode.volume = 0;
                this.fade(fadeIn. state.volume);
            }
            sourceNode.loop = loop;
            sourceNode.start(0, offset);
        };
    
        this.pause = ({ fadeOut = 0.0, } = {}) => {
            if (sourceNode) {
                if (fadeOut) {
                    standardNode.fade(fadeOut, 0);
                }
                setTimeout(() => sourceNode.stop(0), fadeOut);

                state.volume = standardNode.volume;
                return (context.currentTime - startTime) % data.buffer.duration;
            }
        };

    };

    function Effect2({ type = 'sine', frequency = 200, start = 0, stop = 1, envelope = null, pitchBend = [], echo = null, reverb = null }) {
    }
    function Effect({
        waveform = 'sine',  //waveform type: "sine", "triangle", "square", "sawtooth"
        frequency = 200,    //The sound's fequency pitch in Hertz
        attack = 0,              //The time, in seconds, to fade the sound in
        decay = 1,               //The time, in seconds, to fade the sound out
        volume = 1,         //The sound's maximum volume
        pan = 0,            //The speaker pan. left: -1, middle: 0, right: 1
        wait = 0,                //The time, in seconds, to wait before playing the sound
        pitchBend = null,     //The number of Hz in which to bend the sound's pitch down
        dissonance = 0,          //A value in Hz. It creates 2 dissonant frequencies above and below the target pitch
        echo = null,                //An array: [delayTimeInSeconds, feedbackTimeInSeconds, filterValueInHz]
        reverb = null,              //An array: [durationInSeconds, decayRateInSeconds, reverse]
        timeout = 2,             //A number, in seconds, which is the maximum duration for sound effects
    }){
        let standardNode = null;
        this.play = () => {

            const oscillator = context.createOscillator();
            oscillator.type = waveform;
            oscillator.frequency.value = frequency;
        
            standardNode = new StandardNode({ volume, pan, echo, reverb });
            oscillator.connect(standardNode.input);
            standardNode.output.connect(context.destination);

            // if (attack) {
            //     standardNode.volume = 0;
            //     standardNode.fade(attack. volume, wait);
            // }
            standardNode.fade(decay, 0, wait + attack);

            if (pitchBend){
                oscillatorNode.frequency.linearRampToValueAtTime(frequency, context.currentTime + wait / 1000);
                oscillatorNode.frequency.linearRampToValueAtTime(frequency + pitchBend, context.currentTime +(wait + attack + decay) / 1000);
            }
            if (dissonance > 0){
                const d1 = context.createOscillator();
                const d2 = context.createOscillator();
        
                //Connect the oscillators to the gain and destination nodes
                d1.connect(standardNode.input);
                d2.connect(standardNode.input);
        
                //Set the waveform to "sawtooth" for a harsh effect
                d1.type = "sawtooth";
                d2.type = "sawtooth";
        
                //Make the two oscillators play at frequencies above and
                //below the main sound's frequency. Use whatever value was
                //supplied by the `dissonance` argument
                d1.frequency.value = frequency + dissonance;
                d2.frequency.value = frequency - dissonance;
        
                play(d1);
                play(d2);
            }
        
            //Play the sound
            play(oscillator);
        
            //The `play` function
            function play(node) {
                node.start(context.currentTime + wait / 1000);
        
                node.stop(context.currentTime + (wait + timeout) / 1000);
            }        
        } 
    }
    
    function impulseResponse({ duration, decay }) {
        const length = context.sampleRate * duration / 1000;
        const impulse = context.createBuffer(2, length, context.sampleRate);
    
        const ch0 = impulse.getChannelData(0);
        const ch1 = impulse.getChannelData(1);
        for (let i = 0; i < length; i++) {
            ch0[i] = (2 * Math.random() - 1) * Math.pow(1 - i / length, decay);
            ch1[i] = (2 * Math.random() - 1) * Math.pow(1 - i / length, decay);
        }
        return impulse;
    }
})();