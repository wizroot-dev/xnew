(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.window = global.window || {}));
})(this, (function (exports) { 'use strict';

  //----------------------------------------------------------------------------------------------------
  // function xnew (parent, element, Component, props);
  // function xnew (parent, element, innerHTML);
  // 
  // - return
  //   - a new node: Node
  // 
  // - parent
  //   - a node set as parent: Node
  // 
  // - element
  //   - attributes to create html element: object
  //     (e.g. { tag: 'div', style: '' })
  //   - an existing html element or window: HTMLElement or Window
  //     (e.g. document.querySelector('#hoge'))
  // 
  // - Component: function
  // 
  // - props: object
  // 
  // - innerHTML: string
  //----------------------------------------------------------------------------------------------------

  function xnew(...args) {
      let counter = 0;

      const parent = assign((target) => target instanceof Node || target === null);
      const element = assign((target) => target instanceof Element || target === window || isObject(target));
      const content = args.slice(counter);

      function assign(check) {
          return (args.length > counter && (check(args[counter]) || args[counter] === undefined)) ? args[counter++] : undefined;
      }
      return new Node(parent, element, ...content);
  }

  //----------------------------------------------------------------------------------------------------
  // function xfind (key)
  //
  // - key
  //   - string (ex 'hoge', 'hoge fuga')
  //
  //----------------------------------------------------------------------------------------------------

  function xfind(key) {
      const set = new Set();
      key.split(' ').forEach((k) => {
          if (k !== '' && Node.keyMap.has(k)) {
              Node.keyMap.get(k).forEach((node) => set.add(node));
          }
      });
      return [...set];
  }


  //----------------------------------------------------------------------------------------------------
  // node
  //----------------------------------------------------------------------------------------------------

  class Node {
      constructor(parent, element, ...content) {
          // internal data
          this._ = {};

          // phase (null ->stopped ->started ->... ->stopped ->pre finalized ->finalized)
          this._.phase = null;  


          this._.tostart = false;
          this._.resolve = false;

          this._.defines = {};
          this._.listeners = new Map();
          
          // parent Node class
          this._.parent = parent instanceof Node ? parent : Node.current.node;

          this._.parent?._.children.add(this);
          this._.children = new Set();

          if (element instanceof Element || element === window) {
              this._.base = element;
              this._.element = this._.base;
          } else if (isObject(element)) {
              this._.base = this._.parent ? this._.parent._.element : document.body;
              this._.element = createElementWithAttributes(this._.base, element);
          } else {
              this._.base = this._.parent ? this._.parent._.element : document.body;
              this._.element = this._.base;
          }

          // shared data
          this._.shared = this._.parent?._.shared ?? {};

          // auto start
          this.start();

          // content
          if (content.length > 0) {
              if (isFunction(content[0])) {
                  this._extend(content[0], isObject(content[1]) ? content[1] : {});
              } else if (isValidString(content[0]) && this._.base !== this._.element) {
                  this._.element.innerHTML = content[0];
              }
          }

          this.promise.then((response) => { this._.resolve = true; return response; });

          // animation
          if (this._.parent === null) {
              this._.frameId = requestAnimationFrame(ticker.bind(this));

              function ticker() {
                  this._update();
                  this._.frameId = requestAnimationFrame(ticker.bind(this));
              }
          }

          this._.phase = 'stopped';
      }
      
      _extend(Component, props) {
          const defines = Node.wrap(this, Component, Object.assign(props, { node: this }));
          if (isObject(defines) === false) return;
          
          Object.keys(defines).forEach((key) => {
              if (['promise', 'start', 'update', 'stop', 'finalize'].includes(key) || this[key] === undefined) {
                  const value = defines[key];
                  if ((key === 'promise' && value instanceof Promise)) {
                      this._.defines[key] = value;
                  } else if (['start', 'update', 'stop', 'finalize'].includes(key) && isFunction(value)) {
                      this._.defines[key] = value;
                  } else if (this[key] === undefined && (isObject(value) || isFunction(value))) {
                      this._.defines[key] = value;

                      const object = isObject(value) ? value : { value };

                      let descripters = {};
                      Object.keys(object).forEach((key) => {
                          descripters[key] = isFunction(object[key]) ? (...args) => Node.wrap(this, object[key], ...args) : object[key];
                      });
                      Object.defineProperty(this, key, descripters);
                  } else {
                      console.error(`xnew define error: "${key}" is improper format.`);
                  }
              } else {
                  console.error(`xnew define error: "${key}" already exists.`);
              }
          });
      }

      //----------------------------------------------------------------------------------------------------
      // basic
      //----------------------------------------------------------------------------------------------------
      
      get parent() {
          return this._.parent;
      }

      get element() {
          return this._.element;
      }

      get shared() {
          return this._.shared;
      }

      get promise() {
          return this._.defines.promise ?? Promise.resolve();
      }

      start() {
          this._.tostart = true;
      }

      stop() {
          this._.tostart = false;
      }

      _start() {
          if (this._.phase === 'stopped' && (this._.parent === null || this._.parent.isStarted()) && this._.resolve === true && this._.tostart === true) {
              this._.phase = 'started';
              this._.children.forEach((node) => node._start());
              Node.wrap(this, this._.defines.start);
          }
      }

      _stop() {
          if (this._.phase === 'started') {
              this._.phase = 'stopped';
              this._.children.forEach((node) => node._stop());
              Node.wrap(this, this._.defines.stop);
          }
      }

      _update() {
          if (this._.phase === 'started' || this._.phase === 'stopped') {
              this._.tostart === true ? this._start() : this._stop();

              this._.children.forEach((node) => node._update());

              if (this._.phase === 'started') {
                  Node.wrap(this, this._.defines.update);
              }
          }
      }

      finalize() {
          this._stop();

          if (this._.phase === 'stopped') {
              this._.phase = 'pre finalized';

              [...this._.children].forEach((node) => node.finalize());
              
              Node.wrap(this, this._.defines.finalize);

              // key
              this.key = '';

              // event
              this.off();
              
              // animation
              if (this._.frameId) {
                  cancelAnimationFrame(this._.frameId);
              }
              
              // timer
              this._.timerIds?.forEach((id) => {
                  this.clearTimer(id);
              });

              // element
              if (this._.element !== null && this._.element !== this._.base) {
                  let target = this._.element;
                  while (target.parentElement !== null && target.parentElement !== this._.base) { target = target.parentElement; }
                  if (target.parentElement === this._.base) {
                      this._.base.removeChild(target);
                  }
              }
              
              // relation
              this._.parent?._.children.delete(this);

              this._.phase = 'finalized';
          }
      }

      isStarted() {
          return this._.phase === 'started';
      }

      isStopped() {
          return this._.phase !== 'started';
      }

      isFinalized() {
          return this._.phase === 'finalized';
      }

      //----------------------------------------------------------------------------------------------------
      // element
      //----------------------------------------------------------------------------------------------------        
    
      nestElement(attributes, inner) {
          if (this._.phase === null) {
              this._.element = createElementWithAttributes(this._.element, attributes, inner);
          }
      }

      //----------------------------------------------------------------------------------------------------
      // timer
      //----------------------------------------------------------------------------------------------------        
    
      static timerId = 0;
    
      setTimer(callback, delay = 1, repeat = false) {
          if (this._.phase === null || this._.phase === 'stopped' || this._.phase === 'started') {
              const data = { id: Node.timerId++, timeout: null };

              const func = () => {
                  Node.wrap(this, callback);
                  if (repeat) {
                      data.timeout = setTimeout(func, delay);
                  } else {
                      this._.timerIds.delete(data.id);
                  }
              };
              data.timeout = setTimeout(func, delay);

              this._.timerIds = this._.timerIds ?? new Map();
              this._.timerIds.set(data.id, data);
              return data.id;
          }
      }

      clearTimer(id) {
          if (this._.timerIds?.has(id) === true) {
              clearTimeout(this._.timerIds.get(id).timeout);
              this._.timerIds.delete(id);
          }
      }

      //----------------------------------------------------------------------------------------------------
      // key
      //----------------------------------------------------------------------------------------------------
     
      static keyMap = new Map();

      set key(key) {
          // clear
          (this._.key ?? '').split(' ').forEach((k) => {
              if (isValidString(k) === true) {
                  Node.keyMap.get(k).delete(this);
              }
          });
          this._.key = '';

          if (isValidString(key) === false) return;

          key.split(' ').forEach((k) => {
              if (isValidString(k) === true) {
                  if (Node.keyMap.has(k) === false) Node.keyMap.set(k, new Set());
                  if (Node.keyMap.get(k).has(this) === false) {
                      Node.keyMap.get(k).add(this);
                      this._.key += k + ' ';    
                  }
              }
          });
      }

      get key() {
          return this._.key ?? '';
      }

      //----------------------------------------------------------------------------------------------------
      // event method
      //----------------------------------------------------------------------------------------------------
     
      static typeMap = new Map();
   
      _subListener(type, listener) {
          this._.listeners_wrapper = this._.listeners_wrapper ?? new Map();
          if (this._.listeners_wrapper.has(listener) === false) {
              this._.listeners_wrapper.set(listener, (...args) => this.emit(type, ...args));
          }
          return this._.listeners_wrapper.get(listener);
      }

      on(type, listener, options) {
          if (isValidString(type) === true && isFunction(listener) === true) {
              if (type.split(' ').length > 1) {
                  type.split(' ').forEach((type) => this._on(type, listener, options));
              } else {
                  this._on(type, listener, options);
              }
          }
      }

      _on(type, listener, options) {
          if (this._.listeners.has(type) === false) this._.listeners.set(type, new Set());
          if (this._.listeners.get(type).has(listener) === false) {
              this._.listeners.get(type).add(listener);
              this._.element?.addEventListener(type, this._subListener(type, listener), options ?? { passive: false });
          }
          if (Node.typeMap.has(type) === false) Node.typeMap.set(type, new Set());
          if (Node.typeMap.get(type).has(this) === false) {
              Node.typeMap.get(type).add(this);
          }
      }

      off(type, listener) {
          if (isValidString(type) === true && type.split(' ').length > 1) {
              type.split(' ').forEach((type) => this._off(type, listener));
          } else if (type === null || type === undefined) {
              this._.listeners.forEach((set, type) => this._off(type, listener));
          }
      }

      _off(type, listener) {
          if (isFunction(listener)) {
              if (this._.listeners.has(type) === true && this._.listeners.get(type).has(listener) === true) {
                  this._.listeners.get(type).delete(listener);
                  if (this._.listeners.get(type).size === 0) this._.listeners.delete(type);

                  this._.element?.removeEventListener(type, this._subListener(type, listener));
              }
          } else if (listener === null || listener === undefined) {
              if (this._.listeners.has(type) === true) {
                  this._.listeners.delete(type);
              }
          }
          if (this._.listeners.has(type) === false) {
              if (Node.typeMap.has(type) === true) {
                  Node.typeMap.get(type).delete(this);
                  if (Node.typeMap.get(type).size === 0) Node.typeMap.delete(type);
              }
          }
      }

      emit(type, ...args) {
          if (this._.phase !== 'finalized') {
              if (isValidString(type) === true) {
                  if (type[0] === '#') {
                      if (Node.typeMap.has(type)) {
                          Node.typeMap.get(type).forEach((node) => node._emit(type, ...args));
                      }
                  } else {
                      this._emit(type, ...args);
                  }
              }
          }
      }

      _emit(type, ...args) {
          const listeners = this._.listeners.has(type) === true ? [...this._.listeners.get(type)] : [];
          if (listeners.length > 0) {
              Node.wrap(this, () => listeners.forEach((listener) => listener(...args)));
          }
      }
      
      static current = { prev: null, node: null };

      static wrap(node, func, ...args) {
          let response = undefined;
          if (node === Node.current) {
              response = func?.(...args);
          } else {
              try {
                  Node.current = { prev: Node.current, node };
                  response = func?.(...args);
              } catch (e) {
                  throw e;
              } finally {
                  Node.current = Node.current.prev;
              }
          }
          return response;
      }
  }

  function createElementWithAttributes(parent, attributes, innerHTML = null) {

      const element = (() => {
          if (attributes.tag == 'svg') {
              return document.createElementNS('http://www.w3.org/2000/svg', attributes.tag);
          } else {
              return document.createElement(attributes.tag ?? 'div');
          }
      })();
      if (parent) {
          parent.appendChild(element);
      }
      Object.keys(attributes).forEach((key) => {
          const value = attributes[key];
          if (key === 'style') {
              if (isValidString(value)) {
                  element.style = value;
              } else if (isObject(value)){
                  Object.assign(element.style, value);
              }
          } else if (key === 'class') {
              if (isValidString(value)) {
                  element.classList.add(...value.split(' '));
              }
          } else if (key !== 'tag') {
              element.setAttribute(key, value);
          }
      });
      if (innerHTML) {
          element.innerHTML = innerHTML;
      }
      return element;
  }

  function isValidString(value) {
      return typeof value === 'string' && value !== '';
  }

  function isFunction(value) {
      return typeof value === 'function';
  }

  function isObject(value) {
      return typeof value === 'object' && value !== null;
  }

  //----------------------------------------------------------------------------------------------------
  // device 
  //----------------------------------------------------------------------------------------------------

  const device = (() => {
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

  const audio = (() => {
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
                      console.warn(`"${path}" could not be loaded.`);
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
      }
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
                      });
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

  var util = {
    __proto__: null,
    device: device,
    audio: audio
  };

  //----------------------------------------------------------------------------------------------------
  // screen
  //----------------------------------------------------------------------------------------------------

  function Screen({ node, width = 640, height = 480, objectFit = 'contain', pixelated = true }) {
      node.nestElement({ style: 'position: relative; width: 100%; height: 100%; overflow: hidden;' });
      node.nestElement({ style: 'position: absolute; inset: 0; margin: auto;' });
      node.nestElement({ style: 'position: relative; width: 100%; height: 100%;' });
      const outer = node.element.parentElement;

      const canvas = xnew({ tag: 'canvas', width, height, style: 'position: absolute; width: 100%; height: 100%; vertical-align: bottom;' });
      
      if (pixelated === true) {
          canvas.element.style.imageRendering = 'pixelated';
      }

      if (['fill', 'contain', 'cover'].includes(objectFit)) {
          const win = xnew(window);
          win.on('resize', () => {
              const aspect = width / height;
              const parentWidth = outer.parentElement.clientWidth;
              const parentHeight = outer.parentElement.clientHeight;

              let style = { width: '100%', height: '100%', top: '0px', left: '0px' };
              if (objectFit === 'fill') ; else if (objectFit === 'contain') {
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
          width: { get: () => width },
          height: { get: () => height },
          canvas: { get: () => canvas.element },
      }
  }


  //----------------------------------------------------------------------------------------------------
  // draw event
  //----------------------------------------------------------------------------------------------------

  function DrawEvent({ node }) {
      const base = xnew();
      const win = xnew(window);

      let [id, position1, position2] = [null, null, null];
      base.on('mousedown touchstart', down);

      function down(event) {
          if (id !== null) return;
          const position = getPosition(event, id = getId(event));

          position1 = position;
          position2 = position;

          const type = 'down';
          node.emit(type, event, { type, id, start: position1, end: position2, });
          win.on('mousemove touchmove', move);
          win.on('mouseup touchend', end);
      }    function move(event) {
          const position = getPosition(event, id);
          const delta = { x: position.x - position2.x, y: position.y - position2.y };
          position2 = position;

          const type = 'move';
          node.emit(type, event, { type, id, start: position1, end: position2, delta, });
      }    function end(event) {
          const position = getPosition(event, id);
          position2 = position;

          const type = 'up';
          node.emit(type, event, { type, id, start: position1, end: position2, });
          [id, position1, position2] = [null, null, null];
          win.off();
      }
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

          const rect = node.element.getBoundingClientRect();
          return (original?.clientX && original?.clientY) ? { x: original.clientX - rect.left, y: original.clientY - rect.top } : { x: 0, y: 0 };
      }
  }


  //----------------------------------------------------------------------------------------------------
  // analog stick
  //----------------------------------------------------------------------------------------------------

  function AnalogStick({ node, size = 160, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 }) {
      node.nestElement({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; user-select: none; overflow: hidden;`, });

      const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
      const strokeStyle = `stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)}; stroke-linejoin: round;`;

      xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; ${fillStyle} ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50 10 40 20 60 20"></polygon>
        <polygon points="50 90 40 80 60 80"></polygon>
        <polygon points="10 50 20 40 20 60"></polygon>
        <polygon points="90 50 80 40 80 60"></polygon>
    `);
      const target = xnew({ tag: 'svg', name: 'target', style: `position: absolute; width: 100%; height: 100%; ${fillStyle} ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="20"></circle>
    `);

      const draw = xnew(DrawEvent);

      draw.on('down move', (event, ex) => {
          target.element.style.filter = 'brightness(90%)';

          const [x, y] = [ex.end.x - size / 2, ex.end.y - size / 2];
          const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
          const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
          const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
          node.emit(ex.type, event, { type: ex.type, vector });
          [target.element.style.left, target.element.style.top] = [vector.x * size / 4 + 'px', vector.y * size / 4 + 'px'];
      });

      draw.on('up', (event, ex) => {
          target.element.style.filter = '';

          const vector = { x: 0, y: 0 };

          node.emit(ex.type, event, { type: ex.type, vector });
          [target.element.style.left, target.element.style.top] = [vector.x * size / 4 + 'px', vector.y * size / 4 + 'px'];
      });
  }


  //----------------------------------------------------------------------------------------------------
  // circle button
  //----------------------------------------------------------------------------------------------------

  function CircleButton({ node, size = 80, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 }) {
      node.nestElement({ style: `position: relative; width: ${size}px; height: ${size}px;`, });

      const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
      const strokeStyle = `stroke-linejoin: round; stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)};`;

      const target = xnew({ tag: 'svg', name: 'target', style: `width: 100%; height: 100%; cursor: pointer; user-select: none; ${fillStyle} ${strokeStyle}`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="40"></circle>
    `);

      const win = xnew(window);

      let state = 0;
      target.on('touchstart mousedown', (event) => {
          if (state === 0) {
              state = 1;
              target.element.style.filter = 'brightness(90%)';
              node.emit('down', event, { type: 'down' });
          }
      });
      win.on('touchend mouseup', (event) => {
          if (state === 1) {
              state = 0;
              target.element.style.filter = '';
              node.emit('up', event, { type: 'up' });
          }
      });
  }

  var extensions = {
    __proto__: null,
    Screen: Screen,
    DrawEvent: DrawEvent,
    AnalogStick: AnalogStick,
    CircleButton: CircleButton
  };

  exports.xfind = xfind;
  exports.xn = extensions;
  exports.xnew = xnew;
  exports.xutil = util;

}));
