import { xnew } from './core';

//--------------------------------------------------------------------------------
// screen
//--------------------------------------------------------------------------------

export function Screen({ width, height, objectFit = 'contain' }) {
    this.nestElement({ style: 'position: relative; width: 100%; height: 100%; overflow: hidden;' });
    this.nestElement({ style: 'position: absolute; inset: 0; margin: auto; ' });
    this.nestElement({ style: 'position: relative; width: 100%; height: 100%; ' });
    const outer = this.element.parentElement;

    const canvas = xnew({ tag: 'canvas', width, height, style: 'position: absolute; width: 100%; height: 100%; vertical-align: bottom;' });

    let scale = 1.0;
    if (['fill', 'contain', 'cover'].includes(objectFit)) {
        const win = xnew(window);
        win.on('resize', () => {
            const aspect = width / height;
            const parentWidth = outer.parentElement.clientWidth;
            const parentHeight = outer.parentElement.clientHeight;

            let style = { width: '100%', height: '100%', top: '0px', left: '0px' };
            if (objectFit === 'contain') {
                if (parentWidth < parentHeight * aspect) {
                    style.height = Math.floor(parentWidth / aspect) + 'px';
                } else {
                    style.width = Math.floor(parentHeight * aspect) + 'px';
                }
            } else if (objectFit === 'cover') {
                if (parentWidth < parentHeight * aspect) {
                    style.width = Math.floor(parentHeight * aspect) + 'px';
                    style.left = Math.floor((parentWidth - parentHeight * aspect) / 2) + 'px';
                    style.right = 'auto';
                } else {
                    style.height = Math.floor(parentWidth / aspect) + 'px';
                    style.top = Math.floor((parentHeight - parentWidth / aspect) / 2) + 'px';
                    style.bottom = 'auto';
                }
            }
            Object.assign(outer.style, style);
        });
        win.emit('resize');
    }

    return {
        canvas: { get: () => canvas.element },
        scale: { get: () => scale }
    }
}


//--------------------------------------------------------------------------------
// draw event
//--------------------------------------------------------------------------------

export function DrawEvent({ }) {
    const base = xnew();
    const win = xnew(window);
    const self = this;

    let [id, start, end] = [null, null, null];
    base.on('mousedown touchstart', down);

    function down (event) {
        if (id !== null) return;
        const position = getPosition(event, id = getId(event));
        start = position;
        end = position;
        self.emit('drawstart', event, { type: 'drawstart', id, start, end, });
        win.on('mousemove touchmove', move);
        win.on('mouseup touchend', up);
    };
    function move (event) {
        const position = getPosition(event, id);
        const delta = { x: position.x - end.x, y: position.y - end.y };
        end = position;
        self.emit('drawmove', event, { type: 'drawmove', id, start, end, delta, });
    };
    function up (event) {
        const position = getPosition(event, id);
        self.emit('drawend', event, { type: 'drawend', id, position, });
        [id, start, end] = [null, null, null];
        win.off();
    };

    function getId(event) {
        if (event.pointerId !== undefined) {
            return event.pointerId;
        } else if (event.changedTouches !== undefined) {
            return event.changedTouches[event.changedTouches.length - 1].identifier;
        } else {
            return null;
        }
    }
    function getPosition(event, id) {
        let original = null;
        if (event.pointerId !== undefined) {
            if (id === event.pointerId) original = event;
        } else if (event.changedTouches !== undefined) {
            for (let i = 0; i < event.changedTouches.length; i++) {
                if (id === event.changedTouches[i].identifier) original = event.changedTouches[i];
            }
        } else {
            original = event;
        }

        const rect = self.element.getBoundingClientRect();
        return (original?.clientX && original?.clientY) ? { x: original.clientX - rect.left, y: original.clientY - rect.top } : { x: 0, y: 0 };
    }
}


//--------------------------------------------------------------------------------
// audio 
//--------------------------------------------------------------------------------

let AUDIO_CONTEXT = null;
let AUDIO_GAIN_NODE = null;

function _AudioContext() {
    AUDIO_CONTEXT = AUDIO_CONTEXT ?? (new (window.AudioContext || window.webkitAudioContext)());
    return AUDIO_CONTEXT;
}
function _AudioGainNode() {
    AUDIO_GAIN_NODE = AUDIO_GAIN_NODE ?? _AudioContext().createGain();
    return AUDIO_GAIN_NODE;
}

export function Audio({ url }) {
    this.stop();
    let buffer, source;

    return {
        promise: fetch(url)
            .then((response) => response.arrayBuffer())
            .then((response) => _AudioContext().decodeAudioData(response))
            .then((response) => buffer = response),
        start: () => {
            source = _AudioContext().createBufferSource();
            source.buffer = buffer;
            source.connect(_AudioGainNode()).connect(_AudioContext().destination);
            source.start(0);
        },
        stop: () => {
            source.stop();
        }
    }
}

export function AudioController() {
    const node = _AudioGainNode();
    
    return {
        volume: {
            set: (value) => node.gain.value = value,
            get: () => node.gain.value,
        }
    }
}

//--------------------------------------------------------------------------------
// analog stick
//--------------------------------------------------------------------------------

export function AnalogStick({ size = 160, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 }) {
    this.nestElement({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; user-select: none; overflow: hidden;`, });

    const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
    const strokeStyle = `stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)}; stroke-linejoin: round;`;

    xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; ${fillStyle} ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50 10 40 20 60 20"></polygon>
        <polygon points="50 90 40 80 60 80"></polygon>
        <polygon points="10 50 20 40 20 60"></polygon>
        <polygon points="90 50 80 40 80 60"></polygon>
    `);
    const target = xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; ${fillStyle} ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="20"></circle>
    `);

    const draw = xnew(DrawEvent);

    draw.on('drawstart drawmove', (event, ex) => {
        const phase = ex.type.substring(4); // start or move

        event.preventDefault();
        event.stopPropagation();

        target.element.style.filter = 'brightness(90%)';

        const [x, y] = [ex.end.x - size / 2, ex.end.y - size / 2];
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
        this.emit('stick' + phase, event, { type: 'stick' + phase, vector });
        [target.element.style.left, target.element.style.top] = [vector.x * size / 4 + 'px', vector.y * size / 4 + 'px'];
    });

    draw.on('drawend', (event, ex) => {
        target.element.style.filter = '';

        const vector = { x: 0, y: 0 };

        this.emit('stickend', event, { type: 'stickend', vector });
        [target.element.style.left, target.element.style.top] = [vector.x * size / 4 + 'px', vector.y * size / 4 + 'px'];
    });
}


//--------------------------------------------------------------------------------
// circle button
//--------------------------------------------------------------------------------

export function CircleButton({ size = 80, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 }) {
    this.nestElement({ style: `position: relative; width: ${size}px; height: ${size}px;`, });

    const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
    const strokeStyle = `stroke-linejoin: round; stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)};`;

    const target = xnew({ tag: 'svg', style: `width: 100%; height: 100%; cursor: pointer; user-select: none; ${fillStyle} ${strokeStyle}`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="40"></circle>
    `);

    const win = xnew(window);

    let state = 0;
    target.on('touchstart mousedown', (event) => {
        if (state === 0) {
            state = 1;
            target.element.style.filter = 'brightness(90%)';
            this.emit('buttondown', event);
        }
    });
    win.on('touchend mouseup', (event) => {
        if (state === 1) {
            state = 0;
            target.element.style.filter = '';
            this.emit('buttonup', event);
        }
    });
}
