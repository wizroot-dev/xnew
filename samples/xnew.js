(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.window = global.window || {}));
})(this, (function (exports) { 'use strict';

  //----------------------------------------------------------------------------------------------------
  // function xnew (parent, element, ...content)
  //
  // parent  : node (in many cases, this is omitted and set automatically)
  // element : two pattern
  //           1. html element or window: object (e.g. document.querySelector('#hoge'))
  //           2. attributes to create a html element: object (e.g. { tag: 'div', style: '' })
  // content : two pattern
  //           a. innerHTML: string
  //           b. component: function, props: object
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
  // key  : string (ex 'hoge', 'hoge fuga')
  //----------------------------------------------------------------------------------------------------

  function xfind(key) {
      const set = new Set;
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

          this._.phase = 'initialize';  // initialize ->[stop ->start ->...] stop ->finalize
          this._.tostart = false;
          this._.resolve = false;

          this._.defines = {};
          this._.listeners = new Map;
          
          // parent Node class
          this.parent = parent instanceof Node ? parent : Node.current.node;

          this.parent?._.children.add(this);
          this._.children = new Set;

          if (element instanceof Element || element === window) {
              this._.base = element;
              this.element = this._.base;
          } else if (isObject(element)) {
              this._.base = this.parent ? this.parent.element : document.body;
              this.element = this._.base.appendChild(createElementWithAttributes(element));
          } else {
              this._.base = this.parent ? this.parent.element : document.body;
              this.element = this._.base;
          }

          // global data
          this.global = this.parent?.global ?? {};

          // auto start
          this.start();

          if (content.length > 0) {
              if (isFunction(content[0])) {
                  this._extend(content[0], isObject(content[1]) ? content[1] : {});
              } else if (isString(content[0]) && this._.base !== this.element) {
                  this.element.innerHTML = content[0];
              }
          }

          this.promise.then((response) => { this._.resolve = true; return response; });

          // animation
          if (this.parent === null) {
              this._.frameId = requestAnimationFrame(ticker.bind(this));

              function ticker() {
                  this._update();
                  this._.frameId = requestAnimationFrame(ticker.bind(this));
              }
          }

          this._.phase = 'stop';
      }
      
      //----------------------------------------------------------------------------------------------------
      // basic
      //----------------------------------------------------------------------------------------------------
      
      _extend(component, props) {
          const defines = Node.wrap(this, component, Object.assign(props ?? {}, { node: this }));
          if (isObject(defines) === false) return;

          Object.keys(defines).forEach((key) => {
              if (['promise', 'start', 'update', 'stop', 'finalize'].includes(key) || this[key] === undefined) {
                  const value = defines[key];
                  if ((key === 'promise' && value instanceof Promise)){
                      this._.defines[key] = value;
                  } else if (['start', 'update', 'stop', 'finalize'].includes(key) && isFunction(value)) {
                      this._.defines[key] = value;
                  } else if (this[key] === undefined && (isObject(value) || isFunction(value))) {
                      this._.defines[key] = value;

                      const object = isObject(value) ? value : { value };

                      let descripters = {};
                      Object.keys(object).forEach((key) => {
                          const value = object[key];
                          descripters[key] = isFunction(value) ? (...args) => Node.wrap(this, value, ...args) : value;
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
          if (this._.phase === 'stop' && (this.parent === null || this.parent.isStarted()) && this._.resolve === true && this._.tostart === true) {
              this._.phase = 'start';
              this._.children.forEach((node) => node._start());
              Node.wrap(this, this._.defines.start);
          }
      }

      _stop() {
          if (this._.phase === 'start') {
              this._.phase = 'stop';
              this._.children.forEach((node) => node._stop());
              Node.wrap(this, this._.defines.stop);
          }
      }

      _update() {
          if (this._.phase === 'finalize') return;

          this._.tostart === true ? this._start() : this._stop();

          this._.children.forEach((node) => node._update());
      
          if (this._.phase === 'start') {
              Node.wrap(this, this._.defines.update);
          }
      }

      finalize() {
          this._stop();
          if (this._.phase === 'finalize') return;

          this._.phase = 'finalize';
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
          if (this.element !== null && this.element !== this._.base) {
              let target = this.element;
              while (target.parentElement !== null && target.parentElement !== this._.base) { target = target.parentElement; }
              if (target.parentElement === this._.base) {
                  this._.base.removeChild(target);
              }
          }
          
          // relation
          this.parent?._.children.delete(this);
      }

      isStarted() {
          return this._.phase === 'start';
      }

      isStopped() {
          return this._.phase !== 'start';
      }

      isFinalized() {
          return this._.phase === 'finalize';
      }

      //----------------------------------------------------------------------------------------------------
      // element
      //----------------------------------------------------------------------------------------------------        
    
      nestElement(attributes, inner) {
          if (this._.phase === 'initialize') {
              this.element = this.element.appendChild(createElementWithAttributes(attributes, inner));
          }
      }

      //----------------------------------------------------------------------------------------------------
      // timer
      //----------------------------------------------------------------------------------------------------        
    
      static timerId = 0;
    
      setTimer(delay, callback, repeat = false) {
          if (this._.phase === 'finalize') return null;

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

          this._.timerIds = this._.timerIds ?? new Map;
          this._.timerIds.set(data.id, data);
          return data.id;
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
     
      static keyMap = new Map;

      set key(key) {
          // clear
          (this._.key ?? '').split(' ').forEach((k) => {
              if (k !== '') {
                  Node.keyMap.get(k).delete(this);
              }
          });
          this._.key = '';

          if (isString(key) === false) return;

          key.split(' ').forEach((k) => {
              if (k !== '') {
                  if (Node.keyMap.has(k) === false) Node.keyMap.set(k, new Set);
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
     
      static typeMap = new Map;
   
      _subListener(type, listener) {
          this._.listeners_wrapper = this._.listeners_wrapper ?? new Map;
          if (this._.listeners_wrapper.has(listener) === false) {
              this._.listeners_wrapper.set(listener, (...args) => this.emit(type, ...args));
          }
          return this._.listeners_wrapper.get(listener);
      }

      on(type, listener, options) {
          if (isString(type) === true && isFunction(listener) === true) {
              if (type.split(' ').length > 1) {
                  type.split(' ').forEach((type) => this._on(type, listener, options));
              } else {
                  this._on(type, listener, options);
              }
          }
      }

      _on(type, listener, options) {
          if (this._.listeners.has(type) === false) this._.listeners.set(type, new Set);
          if (this._.listeners.get(type).has(listener) === false) {
              this._.listeners.get(type).add(listener);
              this.element?.addEventListener(type, this._subListener(type, listener), options ?? { passive: false });
          }
          if (Node.typeMap.has(type) === false) Node.typeMap.set(type, new Set);
          if (Node.typeMap.get(type).has(this) === false) {
              Node.typeMap.get(type).add(this);
          }
      }

      off(type, listener) {
          if (isString(type) === true && type.split(' ').length > 1) {
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

                  this.element?.removeEventListener(type, this._subListener(type, listener));
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
          if (this._.phase === 'finalize') return;

          if (isString(type) === true) {
              if (type[0] === '#') {
                  if (Node.typeMap.has(type)) {
                      Node.typeMap.get(type).forEach((node) => node._emit(type, ...args));
                  }
              } else {
                  this._emit(type, ...args);
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
          if (key === 'style') {
              if (isString(value)) {
                  element.style = value;
              } else if (isObject(value)){
                  Object.assign(element.style, value);
              }
          } else if (key === 'className') {
              if (isString(value)) {
                  element.classList.add(...value.split(' '));
              }
          } else if (key === 'class') {
              console.warn('"class" is not available. Use "className" instead.');
          } else if (key !== 'tag') {
              element.setAttribute(key, value);
          }
      });
      if (innerHTML) {
          element.innerHTML = innerHTML;
      }
      return element;
  }

  function isString(value) {
      return typeof value === 'string' && value !== '';
  }

  function isFunction(value) {
      return typeof value === 'function';
  }

  function isObject(value) {
      return typeof value === 'object' && value !== null;
  }

  //----------------------------------------------------------------------------------------------------
  // env 
  //----------------------------------------------------------------------------------------------------

  const env = (() => {

      return new class {
          isMobile() {
              return navigator.userAgent.match(/iPhone|iPad|Android.+Mobile/);
          }
          hasTouch() {
              return window.ontouchstart !== undefined && navigator.maxTouchPoints > 0;
          }
      };
  })();

  var util = {
    __proto__: null,
    env: env
  };

  //----------------------------------------------------------------------------------------------------
  // screen
  //----------------------------------------------------------------------------------------------------

  function Screen({ node, width, height, objectFit = 'contain', pixelated = true }) {
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
      base.on('mousedown touchstart', start);

      function start(event) {
          if (id !== null) return;
          const position = getPosition(event, id = getId(event));

          position1 = position;
          position2 = position;

          const type = 'start';
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

          const type = 'end';
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

      draw.on('start move', (event, ex) => {
          event.preventDefault();
          event.stopPropagation();

          target.element.style.filter = 'brightness(90%)';

          const [x, y] = [ex.end.x - size / 2, ex.end.y - size / 2];
          const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
          const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
          const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
          node.emit(ex.type, event, { type: ex.type, vector });
          [target.element.style.left, target.element.style.top] = [vector.x * size / 4 + 'px', vector.y * size / 4 + 'px'];
      });

      draw.on('end', (event, ex) => {
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
              node.emit('down', event);
          }
      });
      win.on('touchend mouseup', (event) => {
          if (state === 1) {
              state = 0;
              target.element.style.filter = '';
              node.emit('up', event);
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

  exports.Node = Node;
  exports.xfind = xfind;
  exports.xn = extensions;
  exports.xnew = xnew;
  exports.xutil = util;

}));
