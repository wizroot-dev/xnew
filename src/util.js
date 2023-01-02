
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
            if (map.has(path)) {
                return map.get(path);
            } else {
                const data = { promise: null, buffer: null };
                data.promise = fetch(url)
                    .then((response) => response.arrayBuffer())
                    .then((response) => context.decodeAudioData(response))
                    .then((response) => data.buffer = response);
            }
        }
    };
})();


export function Audio({ node, urls }) {
    // let source = null;
    // let buffer;

    // const gain = _AudioContext().createGain();
    
    // const map = new Map();
    // urls.keys().forEach((key) => {
    //     const value = { promise: null, buffer: null };

    //     value.promise = fetch(urls[key])
    //         .then((response) => response.arrayBuffer())
    //         .then((response) => _AudioContext().decodeAudioData(response))
    //         .then((response) => value.buffer = response);
    //     map.set(key, value);
    // });

    // return {
    //     promise: fetch(url)
    //         .then((response) => response.arrayBuffer())
    //         .then((response) => _AudioContext().decodeAudioData(response))
    //         .then((response) => buffer = response),
    //     play: () => {
    //         if (buffer) {
    //             node.pause();
    //             source = _AudioContext().createBufferSource();
    //             source.buffer = buffer;
    //             source.connect(gain).connect(_AudioContext().destination);
    //             source.start(0);
    //         }
    //     },
    //     pause: () => {
    //         if (source) {
    //             source.stop();
    //             source = null;
    //         }
    //     },
    //     volume: {
    //         set: (value) => gain.gain.value = value,
    //         get: () => gain.gain.value,
    //     },
    // }
}
