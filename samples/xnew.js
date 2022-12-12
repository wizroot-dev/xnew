(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.window = global.window || {}));
})(this, (function (exports) { 'use strict';

  //--------------------------------------------------------------------------------
  // function xnew (parent, element, ...content)
  //
  // parent  : node: object
  // element : html element, window or attributes to create it: object
  // content : two pattern
  //           1. innerHTML: string
  //           2. component: function, props: object
  //--------------------------------------------------------------------------------

  function xnew(...args) {
      let counter = 0;

      const parent = assign((target) => target instanceof Node || target === null);
      const element = assign((target) => target instanceof Element || target === window || (typeof target === 'object' && target !== null));
      const content = args.slice(counter);

      function assign(check) {
          return (args.length > counter && (check(args[counter]) || args[counter] === undefined)) ? args[counter++] : undefined;
      }
      return new Node(parent, element, ...content);
  }


  //--------------------------------------------------------------------------------
  // node
  //--------------------------------------------------------------------------------

  class Node {
      constructor(parent, element, ...content) {
          // internal data
          this._ = {};
          this._.children = new Set();  // child nodes
          this._.phase = 'stopped';     // [stopped ->before start ->started ->before stop ->...] ->before finalize ->finalized
          this._.defines = {};
          this._.listeners = new Map();
          
          // parent Node class
          this.parent = parent instanceof Node ? parent : Node.current.node;
          this.parent?._.children.add(this);

          if (element instanceof Element || element === window) {
              this._.base = element;
              this.element = this._.base;
          } else if (typeof element === 'object' && element !== null) {
              this._.base = this.parent ? this.parent.element : document.body;
              this.element = this._.base.appendChild(createElementWithAttributes(element));
          } else {
              this._.base = this.parent ? this.parent.element : document.body;
              this.element = this._.base;
          }

          // global data
          this.global = this.parent?.global ?? {};

          this.start();
          if (content.length > 0) {
              let i = 0;
              if (typeof content[i] === 'function') {
                  this.extend(content[i++], (typeof content[i] === 'object' && content[i] !== null) ? content[i++] : {});
                  if (typeof content[i] === 'function') {
                      this.extend(content[i++], (typeof content[i] === 'object' && content[i] !== null) ? content[i++] : {});
                  }
              } else if (typeof content[i] === 'string' && this._.base !== this.element) {
                  this.element.innerHTML = content[0];
              }
          }

          // animation
          if (this.parent === null) {
              this._.frameId = requestAnimationFrame(ticker.bind(this));

              function ticker() {
                  this._animate(this._.start ? (this._.start - new Date().getTime()) : 0);
                  this._.frameId = requestAnimationFrame(ticker.bind(this));
              }
          }
      }
      
      //--------------------------------------------------------------------------------
      // basic
      //--------------------------------------------------------------------------------
      
      _extend(component, props) {
          const defines = Node.wrap(this, component.bind(this), props ?? {}, Object.assign({}, this._.defines ?? {}));

          if (typeof defines === 'object' && defines !== null) {
              Object.keys(defines).forEach((key) => {
                  if (['promise', 'start', 'animate', 'stop', 'finalize'].includes(key)) ; else if (this._.defines[key] || !this[key]) {
                      if (typeof defines[key] === 'object') {
                          const object = defines[key];
                          let descripters = {};
                          Object.keys(object).forEach((key) => {
                              const value = object[key];
                              if (['value', 'set', 'get'].includes(key) && typeof value === 'function') {
                                  descripters[key] = (...args) => Node.wrap(this, value, ...args);
                              } else {
                                  descripters[key] = value;
                              }
                          });
                          Object.defineProperty(this, key, descripters);
                      } else if (typeof defines[key] === 'function') {
                          const func = defines[key];
                          Object.defineProperty(this, key, { value: (...args) => Node.wrap(this, func, ...args) });
                      } else {
                          console.error(`xnew define error: "${key}: value" is improper format.`);
                          return;
                      }
                  } else {
                      console.error(`xnew define error: "${key}" already exists.`);
                      return;
                  }
                  this._.defines[key] = defines[key];
              });
          }
      }

      extend(component, props) {
          if (this._.phase === 'before stop' || this._.phase === 'stopped' || this._.phase === 'before start') {
              this._extend(component, props);
          }
      }

      get promise() {
          return this._.defines.promise ?? Promise.resolve();
      }

      start() {
          if (this._.phase === 'before stop' || this._.phase === 'stopped') {
              this._.phase = 'before start';
              setTimeout(() => this.promise.then(() => this._start()), 0);
          }
      }

      _start() {
          if (this._.phase === 'before start') {
              this._.start = new Date().getTime();
              Node.wrap(this, this._.defines.start);
              this._.phase = 'started';
          }
      }

      _animate(time) {
          if (this._.phase === 'started') {
              this._.children.forEach((node) => node._animate(time));
              Node.wrap(this, this._.defines.animate, time);
          }
      }

      stop() {
          if (this._.phase === 'before start') {
              this._.phase = 'stopped';
          } else if (this._.phase === 'started') {
              this._.phase = 'before stop';
              this._stop();
          }
      }

      _stop() {
          if (this._.phase === 'before stop') {
              Node.wrap(this, this._.defines.stop);
              this._.phase = 'stopped';
          }
      }

      finalize() {
          this.stop();
          if (this._.phase !== 'before finalize' && this._.phase !== 'finalized') {
              this._.phase = 'before finalize';
              this._finalize();
          }
      }

      _finalize() {
          if (this._.phase === 'before finalize') {

              this._.children.forEach((node) => node.finalize());
              Node.wrap(this, this._.defines.finalize);

              this.off();

              // animation
              if (this._.frameId) {
                  cancelAnimationFrame(this._.frameId);
              }

              if (this.element !== null && this.element !== this._.base) {
                  let target = this.element;
                  while (target.parentElement !== null && target.parentElement !== this._.base) { target = target.parentElement; }
                  if (target.parentElement === this._.base) {
                      this._.base.removeChild(target);
                  }
              }
              this._.phase = 'finalized';
          }
      }

      isStarted() {
          return this._.phase === 'started';
      }

      isStopped() {
          return this._.phase === 'stopped';
      }

      isFinalized() {
          return this._.phase === 'finalized';
      }

      //--------------------------------------------------------------------------------
      // utilities
      //--------------------------------------------------------------------------------
    
      nestElement(attributes, inner) {
          this.element = this.element.appendChild(createElementWithAttributes(attributes, inner));
      }

      setCallback(callback, delay, limit = 0) {
          let id;
          const response = {
              counter: 0,
              clear: () => {
                  if (this._.callbackIds.has(id)) {
                      limit === 1 ? clearTimeout(id) : clearInterval(id);
                      this._.callbackIds.delete(id);
                  }
              }
          };
          if (limit === 1) {
              id = setTimeout(() => {
                  Node.wrap(this, callback, response.counter++);
                  response.clear();
              }, delay);
          } else {
              id = setInterval(() => {
                  if (limit === 0 || response.counter < limit) {
                      Node.wrap(this, callback, response.counter++);
                  }
                  if (limit !== 0 && response.counter >= limit) {
                      response.clear();
                  }
              }, delay);    
          }
          this._.callbackIds = this._.callbackIds ?? new Set;
          this._.callbackIds.add(id);

          return response;
      }

      //--------------------------------------------------------------------------------
      // event method
      //--------------------------------------------------------------------------------
     
      _subListener(type, listener) {
          this._.listeners_wrapper = this._.listeners_wrapper ?? new Map();
          if (this._.listeners_wrapper.has(listener) === false) {
              this._.listeners_wrapper.set(listener, (...args) => this.emit(type, ...args));
          }
          return this._.listeners_wrapper.get(listener);
      }

      on(type, listener, options) {
          if (typeof type === 'string' && type.split(' ').length > 1) {
              type.split(' ').forEach((type) => this._on(type, listener, options));
          } else {
              this._on(type, listener, options);
          }
      }

      _on(type, listener, options) {
          if (typeof type === 'string' && type !== '') {
              if (typeof listener === 'function') {
                  if (this._.listeners.has(type) === false) this._.listeners.set(type, new Set());
                  if (this._.listeners.get(type).has(listener) === false) {
                      this._.listeners.get(type).add(listener);
                      this.element?.addEventListener(type, this._subListener(type, listener), options ?? { passive: false });
                  }
              }
          }
      }

      off(type, listener) {
          if (typeof type === 'string' && type.split(' ').length > 1) {
              type.split(' ').forEach((type) => this._off(type, listener));
          } else {
              this._off(type, listener);
          }
      }

      _off(type, listener) {
          if (typeof type === 'string' && type !== '') {
              if (typeof listener === 'function') {
                  if (this._.listeners.has(type) === true && this._.listeners.get(type).has(listener) === true) {
                      this._.listeners.get(type).delete(listener);
                      this.element?.removeEventListener(type, this._subListener(type, listener));
                  }
              } else if (listener === null || listener === undefined) {
                  if (this._.listeners.has(type) === true) {
                      this._.listeners.delete(type);
                  }
              }
          } else if (type === null || type === undefined) {
              this._.listeners.forEach((set, type) => this._off(type, listener));
          }
      }

      _listeners(type, listener) {
          if (typeof type === 'string') {
              if (typeof listener === 'function') {
                  if (this._.listeners.has(type) === true && this._.listeners.get(type).has(listener) === true) {
                      return [listener];
                  }
              } else if (listener === null || listener === undefined) {
                  if (this._.listeners.has(type) === true) {
                      return [...this._.listeners.get(type)];
                  }
              }
          }
          return [];
      }

      emit(type, ...args) {
          if (type[0] === '#') {
              let node = this;
              while (node.parent) node = node.parent;
              node._downEmit(type, ...args);
              node._selfEmit(type, ...args);
          } else {
              this._selfEmit(type, ...args);
          }
      }

      _selfEmit(type, ...args) {
          const listeners = this._listeners(type);
          if (listeners.length > 0) {
              Node.wrap(this, () => listeners.forEach((listener) => listener(...args)));
          }
      }

      _downEmit(type, ...args) {
          this._.children.forEach((node) => {
              node._selfEmit(type, ...args);
              node._downEmit(type, ...args);
          });
      }
      
      static current = { node: null, parent: null };

      static wrap(node, func, ...args) {
          let response = undefined;
          if (node === Node.current) {
              response = func?.(...args);
          } else {
              try {
                  Node.current = { node, parent: Node.current };
                  response = func?.(...args);
              } catch (e) {
                  throw e;
              } finally {
                  Node.current = Node.current.parent;
              }
          }
          return response;
      }
  }

  function createElementWithAttributes(attributes, innerHTML = null) {

      const element = (() => {
          if (attributes.tag == 'svg') {
              return document.createElementNS('http://www.w3.org/2000/svg', attributes.tag);
          } else {
              return document.createElement(attributes.tag ?? 'div');
          }
      })();
      
      Object.keys(attributes).forEach((key) => {
          const value = attributes[key];
          if (key === 'style'){
              if (typeof value === 'string') {
                  element.style = value;
              } else if (typeof value === 'object'){
                  Object.assign(element.style, value);
              }
          } else if (key === 'className') {
              if (typeof value === 'string') {
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

  //--------------------------------------------------------------------------------
  // screen
  //--------------------------------------------------------------------------------

  function Screen({ width, height, objectFit = 'contain' }) {
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

  function DrawEvent({ }) {
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
      }    function move (event) {
          const position = getPosition(event, id);
          const delta = { x: position.x - end.x, y: position.y - end.y };
          end = position;
          self.emit('drawmove', event, { type: 'drawmove', id, start, end, delta, });
      }    function up (event) {
          const position = getPosition(event, id);
          self.emit('drawend', event, { type: 'drawend', id, position, });
          [id, start, end] = [null, null, null];
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

  function Audio({ url }) {
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

  function AudioController() {
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

  function AnalogStick({ size = 160, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 }) {
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

  function CircleButton({ size = 80, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 }) {
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

  var extensions = {
    __proto__: null,
    Screen: Screen,
    DrawEvent: DrawEvent,
    Audio: Audio,
    AudioController: AudioController,
    AnalogStick: AnalogStick,
    CircleButton: CircleButton
  };

  exports.xnew = xnew;
  exports.xnex = extensions;

}));
