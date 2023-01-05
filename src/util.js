
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
// audio 
//----------------------------------------------------------------------------------------------------

export const audio = (() => {
    const context = new (window.AudioContext || window.webkitAudioContext);
    const map = new Map();

    return { fetch, create, load };

    function create(){
        return new Effect(props);
    }
    function load(path){
        if (map.has(path)) {
            return new Audio(loadAudio(path));
        }
    }
    function fetch(paths) {
        (Array.isArray(paths) ? paths : [paths]).forEach((path) => {
            if (typeof path === 'string' && path !== '') {
                map.set(path, map.has(path) ? map.get(path) : new AudioData(path));
            }
        });
    }
    function loadAudio(path) {
        if (typeof path === 'string' && path !== '') {
            const data = map.has(path) ? map.get(path) : new AudioData(path);
            map.set(path, data);
            return data;
        }
    }

    function createAudioNode(name, { input = null, output = null } = {}) {
        const node = context[`create${name}`]();
        if (input) input.connect(node);
        if (output) node.connect(output);
        return node;
    }

    function AudioData(path) {
        this.buffer = null;
        this.promise = fetch(path)
            .then((response) => response.arrayBuffer())
            .then((response) => context.decodeAudioData(response))
            .then((response) => this.buffer = response)
            .catch(() => {
                console.warn(`"${path}" could not be loaded.`)
            });
    }


    function Audio(data) {
    
        let nodes = { sourceNode: null, };
        let state = { volume: 1.0, pan: 0.0, start: 0 };

        Object.defineProperties(this, {
            isReady: {
                value: () => data.buffer ? true : false,
            },
            promise: {
                get: () => data.promise,
            },
            volume: {
                set: (value) => {
                    state.volume = value;
                    if (nodes.volumeNode) nodes.volumeNode.gain.value = value;
                },
                get: () => {
                    return nodes.volumeNode ? nodes.volumeNode.gain.value : state.volume;
                },
            },
            pan: {
                set: (value) => {
                    state.pan = value;
                    if (nodes.panNode) nodes.panNode.pan.value = value;
                },
                get: () => {
                    return nodes.panNode ? nodes.panNode.pan.value : state.pan;
                },
            },
        });

        this.play = ({ offset = 0, volume = null, pan = null, loop = false, fadeIn = null, echo = null, reverb = null } = {}) => {           
            if (this.isReady() === false) return;
            this.pause();

            if (echo) {
                echo = Object.assign({ delay: 300, feedback: 0.3 }, (typeof echo === 'object' && echo !== null) ? echo : {});
            }
            if (reverb) {
                reverb = Object.assign({ duration: 2000, decay: 2 }, (typeof reverb === 'object' && reverb !== null) ? reverb : {});
            }
  
            state.volume = volume ?? state.volume;
            state.pan = Math.max(-1.0, Math.min(+1.0, pan)) ?? state.pan;
            state.start = context.currentTime;

            // sourceNode
            {
                nodes.sourceNode = createAudioNode('BufferSource');
                nodes.sourceNode.buffer = data.buffer;
                nodes.sourceNode.playbackRate.value = 1;
            }
            
            // sourceNode -> volumeNode
            {
                nodes.volumeNode = createAudioNode('Gain', { input: nodes.sourceNode });
                nodes.volumeNode.gain.value = state.volume;
            }
            
            // sourceNode -> volumeNode -> panNode -> destination
            if (context.createStereoPanner){
                nodes.panNode = createAudioNode('StereoPanner', { input: nodes.volumeNode, output: context.destination });
                nodes.panNode.pan.value = state.pan;
            } else {
                nodes.panNode = createAudioNode('Panner', { input: nodes.volumeNode, output: context.destination });
                nodes.panNode.setPosition(state.pan, 0, 1 - Math.abs(state.pan));
            }

            // volumeNode -> convolverNode -> panNode
            if (reverb) {
                nodes.convolverNode = createAudioNode('Convolver', { input: nodes.volumeNode, output: nodes.panNode });
                nodes.convolverNode.buffer = impulseResponse(reverb);
            }

            // volumeNode -> delayNode -> panNode
            // delayNode -> feedbackNode -> filterNode -> (loop)
            if (echo) {
                nodes.delayNode = createAudioNode('Delay', { input: nodes.volumeNode, output: nodes.panNode });
                nodes.delayNode = context.createDelay();
                nodes.delayNode.delayTime.value = echo.delay / 1000;
                
                nodes.feedbackNode = createAudioNode('Gain', { input: nodes.delayNode, output: nodes.delayNode});
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
            if (fadeIn) {
                nodes.volumeNode.gain.value = 0;
                this.fade(fadeIn, 1.0);
            }
            
            nodes.sourceNode.loop = loop;
            nodes.sourceNode.start(0, offset);
        };
    
        this.pause = ({ fadeOut = 0.0, } = {}) => {
            if (nodes.sourceNode) {
                const sourceNode = nodes.sourceNode;
                if (fadeOut) {
                    this.fade(fadeOut, 0);
                }
                setTimeout(() => sourceNode.stop(0), fadeOut);

                state.volume = nodes.volumeNode.gain.value;
                nodes = { sourceNode: null, };
                return (context.currentTime - state.start) % data.buffer.duration;
            }
        };

        this.fade = (duration, volume) => {
            if (nodes.volumeNode) {
                nodes.volumeNode.gain.linearRampToValueAtTime(nodes.volumeNode.gain.value, context.currentTime);
                nodes.volumeNode.gain.linearRampToValueAtTime(volume, context.currentTime + duration);
            }
        };
    };

    function Effect({
        frequencyValue = 200,    //The sound's fequency pitch in Hertz
        attack = 0,              //The time, in seconds, to fade the sound in
        decay = 1,               //The time, in seconds, to fade the sound out
        type = 'sine',                //waveform type: "sine", "triangle", "square", "sawtooth"
        volumeValue = 1,         //The sound's maximum volume
        panValue = 0,            //The speaker pan. left: -1, middle: 0, right: 1
        wait = 0,                //The time, in seconds, to wait before playing the sound
        pitchBendAmount = 0,     //The number of Hz in which to bend the sound's pitch down
        reverse = false,             //If `reverse` is true the pitch will bend up
        randomValue = 0,         //A range, in Hz, within which to randomize the pitch
        dissonance = 0,          //A value in Hz. It creates 2 dissonant frequencies above and below the target pitch
        echo = null,                //An array: [delayTimeInSeconds, feedbackTimeInSeconds, filterValueInHz]
        reverb = null,              //An array: [durationInSeconds, decayRateInSeconds, reverse]
        timeout = 2,             //A number, in seconds, which is the maximum duration for sound effects
    }){
    
        //Create an oscillator, gain and pan nodes, and connect them
        //together to the destination
        var oscillator, volume, pan;
        oscillator = context.createOscillator();
        volume = context.createGain();
        if (!context.createStereoPanner) {
            pan = context.createPanner();
        } else {
            pan = context.createStereoPanner();
        }
        oscillator.connect(volume);
        volume.connect(pan);
        pan.connect(context.destination);
    
        //Set the supplied values
        volume.gain.value = volumeValue;
        if (!context.createStereoPanner) {
            pan.setPosition(panValue, 0, 1 - Math.abs(panValue));
        } else {
            pan.pan.value = panValue;
        }
        oscillator.type = type;
    
        //Optionally randomize the pitch. If the `randomValue` is greater
        //than zero, a random pitch is selected that's within the range
        //specified by `frequencyValue`. The random pitch will be either
        //above or below the target frequency.
        var frequency;
        var randomInt = function (min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min
        };
        if (randomValue > 0) {
            frequency = randomInt(
                frequencyValue - randomValue / 2,
                frequencyValue + randomValue / 2
            );
        } else {
            frequency = frequencyValue;
        }
        oscillator.frequency.value = frequency;
    
        //Apply effects
        if (attack > 0) fadeIn(volume);
        fadeOut(volume);
        if (pitchBendAmount > 0) pitchBend(oscillator);
        if (echo) addEcho(volume);
        if (reverb) addReverb(volume);
        if (dissonance > 0) addDissonance();
    
        //Play the sound
        play(oscillator);
    
        //The `play` function
        function play(node) {
            node.start(context.currentTime + wait);
    
            //Oscillators have to be stopped otherwise they accumulate in
            //memory and tax the CPU. They'll be stopped after a default
            //timeout of 2 seconds, which should be enough for most sound
            //effects. Override this in the `soundEffect` parameters if you
            //need a longer sound
            node.stop(context.currentTime + wait + timeout);
        }
    
        function addReverb(volumeNode) {
            var convolver = context.createConvolver();
            convolver.buffer = impulseResponse(reverb[0], reverb[1], reverb[2], context);
            volumeNode.connect(convolver);
            convolver.connect(pan);
        }
    
        function addEcho(volumeNode) {
    
            //Create the nodes
            var feedback = context.createGain(),
                delay = context.createDelay(),
                filter = context.createBiquadFilter();
    
            //Set their values (delay time, feedback time and filter frequency)
            delay.delayTime.value = echo[0];
            feedback.gain.value = echo[1];
            if (echo[2]) filter.frequency.value = echo[2];
    
            //Create the delay feedback loop, with
            //optional filtering
            delay.connect(feedback);
            if (echo[2]) {
                feedback.connect(filter);
                filter.connect(delay);
            } else {
                feedback.connect(delay);
            }
    
            //Connect the delay loop to the oscillator's volume
            //node, and then to the destination
            volumeNode.connect(delay);
    
            //Connect the delay loop to the main sound chain's
            //pan node, so that the echo effect is directed to
            //the correct speaker
            delay.connect(pan);
        }
    
        //The `fadeIn` function
        function fadeIn(volumeNode) {
    
            //Set the volume to 0 so that you can fade
            //in from silence
            volumeNode.gain.value = 0;
    
            volumeNode.gain.linearRampToValueAtTime(
                0, context.currentTime + wait
            );
            volumeNode.gain.linearRampToValueAtTime(
                volumeValue, context.currentTime + wait + attack
            );
        }
    
        //The `fadeOut` function
        function fadeOut(volumeNode) {
            volumeNode.gain.linearRampToValueAtTime(
                volumeValue, context.currentTime + attack + wait
            );
            volumeNode.gain.linearRampToValueAtTime(
                0, context.currentTime + wait + attack + decay
            );
        }
    
        //The `pitchBend` function
        function pitchBend(oscillatorNode) {
            //If `reverse` is true, make the note drop in frequency. Useful for
            //shooting sounds
    
            //Get the frequency of the current oscillator
            var frequency = oscillatorNode.frequency.value;
    
            //If `reverse` is true, make the sound drop in pitch
            if (!reverse) {
                oscillatorNode.frequency.linearRampToValueAtTime(
                    frequency,
                    context.currentTime + wait
                );
                oscillatorNode.frequency.linearRampToValueAtTime(
                    frequency - pitchBendAmount,
                    context.currentTime + wait + attack + decay
                );
            }
    
            //If `reverse` is false, make the note rise in pitch. Useful for
            //jumping sounds
            else {
                oscillatorNode.frequency.linearRampToValueAtTime(
                    frequency,
                    context.currentTime + wait
                );
                oscillatorNode.frequency.linearRampToValueAtTime(
                    frequency + pitchBendAmount,
                    context.currentTime + wait + attack + decay
                );
            }
        }
    
        //The `addDissonance` function
        function addDissonance() {
    
            //Create two more oscillators and gain nodes
            var d1 = context.createOscillator(),
                d2 = context.createOscillator(),
                d1Volume = context.createGain(),
                d2Volume = context.createGain();
    
            //Set the volume to the `volumeValue`
            d1Volume.gain.value = volumeValue;
            d2Volume.gain.value = volumeValue;
    
            //Connect the oscillators to the gain and destination nodes
            d1.connect(d1Volume);
            d1Volume.connect(context.destination);
            d2.connect(d2Volume);
            d2Volume.connect(context.destination);
    
            //Set the waveform to "sawtooth" for a harsh effect
            d1.type = "sawtooth";
            d2.type = "sawtooth";
    
            //Make the two oscillators play at frequencies above and
            //below the main sound's frequency. Use whatever value was
            //supplied by the `dissonance` argument
            d1.frequency.value = frequency + dissonance;
            d2.frequency.value = frequency - dissonance;
    
            //Fade in/out, pitch bend and play the oscillators
            //to match the main sound
            if (attack > 0) {
                fadeIn(d1Volume);
                fadeIn(d2Volume);
            }
            if (decay > 0) {
                fadeOut(d1Volume);
                fadeOut(d2Volume);
            }
            if (pitchBendAmount > 0) {
                pitchBend(d1);
                pitchBend(d2);
            }
            if (echo) {
                addEcho(d1Volume);
                addEcho(d2Volume);
            }
            if (reverb) {
                addReverb(d1Volume);
                addReverb(d2Volume);
            }
            play(d1);
            play(d2);
        }
    

    }
    
    function impulseResponse({ duration, decay, reverse }) {
        const length = context.sampleRate * duration / 1000;
        const impulse = context.createBuffer(2, length, context.sampleRate);
    
        const ch0 = impulse.getChannelData(0);
        const ch1 = impulse.getChannelData(1);
        for (let i = 0; i < length; i++) {
            const n = reverse ? (length - i) : i;
            ch0[i] = (2 * Math.random() - 1) * Math.pow(1 - n / length, decay);
            ch1[i] = (2 * Math.random() - 1) * Math.pow(1 - n / length, decay);
        }
        return impulse;
    }
})();
