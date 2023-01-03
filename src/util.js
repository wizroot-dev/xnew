
//----------------------------------------------------------------------------------------------------
// env 
//----------------------------------------------------------------------------------------------------

export const env = (() => {

    return new class {
        isMobile() {
            return navigator.userAgent.match(/iPhone|iPad|Android.+Mobile/);
        }
        hasTouch() {
            return window.ontouchstart !== undefined && navigator.maxTouchPoints > 0;
        }
    };
})();




//----------------------------------------------------------------------------------------------------
// audio 
//----------------------------------------------------------------------------------------------------

export const audio = (() => {
    const context = new (window.AudioContext || window.webkitAudioContext);
    const map = new Map();

    return new class {
        fetch(paths) {

        }
        make() {

        }
        load(path) {
            if (map.has(path)) return map.get(path);
            return new Audio(context, path);
        }
    };
})();

function Audio(context, path) {

    let audioBuffer = null;
    const promise = fetch(path)
        .then((response) => response.arrayBuffer())
        .then((response) => context.decodeAudioData(response))
        .then((response) => audioBuffer = response);

    const volumeNode = context.createGain();
    const panNode = context.createStereoPanner ? context.createStereoPanner() : context.createPanner();
    const delayNode = context.createDelay();
    const feedbackNode = context.createGain();
    const filterNode = context.createBiquadFilter();
    const convolverNode = context.createConvolver();
  
    let soundNode = null;
    let loop = false;
    let playing = false;

    let panValue = 0;
    let volumeValue = 1;

    let startTime = 0;

    let playbackRate = 1;

    let echo = false;
    let delayValue = 0.3;
    let feebackValue = 0.3;
    let filterValue = 0;

    let reverb = false;
    let reverbImpulse = null;

    Object.defineProperties(this, {
        isReady: {
            get:  () => audioBuffer ? true : false,
        },
        promise: {
            get: () => promise,
        }
    });
    this.play = (offset = 0) => {
        if (this.isReady === false) return;
        if (soundNode) {
            soundNode.stop(0);
        }

        // Set the start time (it will be `0` when the sound first starts.
        startTime = context.currentTime;

        //Create a sound node.
        soundNode = context.createBufferSource();

        //Set the sound node's buffer property to the loaded sound.
        soundNode.buffer = audioBuffer;

        //Set the playback rate
        soundNode.playbackRate.value = playbackRate;

        //Connect the sound to the pan, connect the pan to the
        //volume, and connect the volume to the destination.
        soundNode.connect(volumeNode);

        //If there's no reverb, bypass the convolverNode
        //If there is reverb, connect the `convolverNode` and apply
        //the impulse response
        if (reverb === true) {
            volumeNode.connect(convolverNode);
            convolverNode.connect(panNode);
            convolverNode.buffer = reverbImpulse;
        } else {
            volumeNode.connect(panNode);
        }

        //Connect the `panNode` to the destination to complete the chain.
        panNode.connect(context.destination);

        //Add optional echo.
        if (echo) {
            feedbackNode.gain.value = o.feebackValue;
            delayNode.delayTime.value = o.delayValue;
            filterNode.frequency.value = o.filterValue;

            //Create the delay loop, with optional filtering.
            delayNode.connect(feedbackNode);
            if (filterValue > 0) {
                feedbackNode.connect(filterNode);
                filterNode.connect(delayNode);
            } else {
                feedbackNode.connect(delayNode);
            }

            //Capture the sound from the main node chain, send it to the
            //delay loop, and send the final echo effect to the `panNode` which
            //will then route it to the destination.
            volumeNode.connect(o.delayNode);
            delayNode.connect(o.panNode);
        }

        //Will the sound loop? This can be `true` or `false`.
        soundNode.loop = loop;

        soundNode.start(0, offset);
    };

    this.pause = function () {
        if (soundNode) {
            soundNode.stop(0);
            return (context.currentTime - startTime) % audioBuffer.duration;
        }
    };

    // o.setEcho = function (delayValue, feedbackValue, filterValue) {
    //     if (delayValue === undefined) delayValue = 0.3;
    //     if (feedbackValue === undefined) feedbackValue = 0.3;
    //     if (filterValue === undefined) filterValue = 0;
    //     o.delayValue = delayValue;
    //     o.feebackValue = feedbackValue;
    //     o.filterValue = filterValue;
    //     o.echo = true;
    // };

    // o.setReverb = function (duration, decay, reverse) {
    //     if (duration === undefined) duration = 2;
    //     if (decay === undefined) decay = 2;
    //     if (reverse === undefined) reverse = false;
    //     o.reverbImpulse = impulseResponse(duration, decay, reverse, actx);
    //     o.reverb = true;
    // };

    // //A general purpose `fade` method for fading sounds in or out.
    // //The first argument is the volume that the sound should
    // //fade to, and the second value is the duration, in seconds,
    // //that the fade should last.
    // o.fade = function (endValue, durationInSeconds) {
    //     if (o.playing) {
    //         o.volumeNode.gain.linearRampToValueAtTime(
    //             o.volumeNode.gain.value, actx.currentTime
    //         );
    //         o.volumeNode.gain.linearRampToValueAtTime(
    //             endValue, actx.currentTime + durationInSeconds
    //         );
    //     }
    // };

    // //Fade a sound in, from an initial volume level of zero.

    // o.fadeIn = function (durationInSeconds) {

    //     //Set the volume to 0 so that you can fade
    //     //in from silence
    //     o.volumeNode.gain.value = 0;
    //     o.fade(1, durationInSeconds);

    // };

    // //Fade a sound out, from its current volume level to zero.
    // o.fadeOut = function (durationInSeconds) {
    //     o.fade(0, durationInSeconds);
    // };

    // //Volume and pan getters/setters.
    // Object.defineProperties(o, {
    //     volume: {
    //         get: function () {
    //             return o.volumeValue;
    //         },
    //         set: function (value) {
    //             o.volumeNode.gain.value = value;
    //             o.volumeValue = value;
    //         },
    //         enumerable: true, configurable: true
    //     },

    //     //The pan node uses the high-efficiency stereo panner, if it's
    //     //available. But, because this is a new addition to the
    //     //WebAudio spec, it might not be available on all browsers.
    //     //So the code checks for this and uses the older 3D panner
    //     //if 2D isn't available.
    //     pan: {
    //         get: function () {
    //             if (!actx.createStereoPanner) {
    //                 return o.panValue;
    //             } else {
    //                 return o.panNode.pan.value;
    //             }
    //         },
    //         set: function (value) {
    //             if (!actx.createStereoPanner) {
    //                 //Panner objects accept x, y and z coordinates for 3D
    //                 //sound. However, because we're only doing 2D left/right
    //                 //panning we're only interested in the x coordinate,
    //                 //the first one. However, for a natural effect, the z
    //                 //value also has to be set proportionately.
    //                 var x = value,
    //                     y = 0,
    //                     z = 1 - Math.abs(x);
    //                 o.panNode.setPosition(x, y, z);
    //                 o.panValue = value;
    //             } else {
    //                 o.panNode.pan.value = value;
    //             }
    //         },
    //         enumerable: true, configurable: true
    //     }
    // });
}

function soundEffect({
    frequencyValue = 200,      //The sound's fequency pitch in Hertz
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
    echo = false,                //An array: [delayTimeInSeconds, feedbackTimeInSeconds, filterValueInHz]
    reverb = false,              //An array: [durationInSeconds, decayRateInSeconds, reverse]
    timeout = false,             //A number, in seconds, which is the maximum duration for sound effects
}){

    //Set the default values
    if (reverse === undefined) reverse = false;
    if (randomValue === undefined) randomValue = 0;
    if (dissonance === undefined) dissonance = 0;
    if (echo === undefined) echo = undefined;
    if (reverb === undefined) reverb = undefined;
    if (timeout === undefined) timeout = undefined;

    //Create an oscillator, gain and pan nodes, and connect them
    //together to the destination
    var oscillator, volume, pan;
    oscillator = actx.createOscillator();
    volume = actx.createGain();
    if (!actx.createStereoPanner) {
        pan = actx.createPanner();
    } else {
        pan = actx.createStereoPanner();
    }
    oscillator.connect(volume);
    volume.connect(pan);
    pan.connect(actx.destination);

    //Set the supplied values
    volume.gain.value = volumeValue;
    if (!actx.createStereoPanner) {
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

    //The helper functions:

    function addReverb(volumeNode) {
        var convolver = actx.createConvolver();
        convolver.buffer = impulseResponse(reverb[0], reverb[1], reverb[2], actx);
        volumeNode.connect(convolver);
        convolver.connect(pan);
    }

    function addEcho(volumeNode) {

        //Create the nodes
        var feedback = actx.createGain(),
            delay = actx.createDelay(),
            filter = actx.createBiquadFilter();

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
            0, actx.currentTime + wait
        );
        volumeNode.gain.linearRampToValueAtTime(
            volumeValue, actx.currentTime + wait + attack
        );
    }

    //The `fadeOut` function
    function fadeOut(volumeNode) {
        volumeNode.gain.linearRampToValueAtTime(
            volumeValue, actx.currentTime + attack + wait
        );
        volumeNode.gain.linearRampToValueAtTime(
            0, actx.currentTime + wait + attack + decay
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
                actx.currentTime + wait
            );
            oscillatorNode.frequency.linearRampToValueAtTime(
                frequency - pitchBendAmount,
                actx.currentTime + wait + attack + decay
            );
        }

        //If `reverse` is false, make the note rise in pitch. Useful for
        //jumping sounds
        else {
            oscillatorNode.frequency.linearRampToValueAtTime(
                frequency,
                actx.currentTime + wait
            );
            oscillatorNode.frequency.linearRampToValueAtTime(
                frequency + pitchBendAmount,
                actx.currentTime + wait + attack + decay
            );
        }
    }

    //The `addDissonance` function
    function addDissonance() {

        //Create two more oscillators and gain nodes
        var d1 = actx.createOscillator(),
            d2 = actx.createOscillator(),
            d1Volume = actx.createGain(),
            d2Volume = actx.createGain();

        //Set the volume to the `volumeValue`
        d1Volume.gain.value = volumeValue;
        d2Volume.gain.value = volumeValue;

        //Connect the oscillators to the gain and destination nodes
        d1.connect(d1Volume);
        d1Volume.connect(actx.destination);
        d2.connect(d2Volume);
        d2Volume.connect(actx.destination);

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

    //The `play` function
    function play(node) {
        node.start(actx.currentTime + wait);

        //Oscillators have to be stopped otherwise they accumulate in
        //memory and tax the CPU. They'll be stopped after a default
        //timeout of 2 seconds, which should be enough for most sound
        //effects. Override this in the `soundEffect` parameters if you
        //need a longer sound
        node.stop(actx.currentTime + timeout + 2);
    }
}
