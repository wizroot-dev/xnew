//----------------------------------------------------------------------------------------------------
// function xnew (parent, element, ...content)
//
// parent  : node: object (in many cases, this is omitted and set automatically)
// element : two pattern
//           1. html element or window: object (e.g. document.querySelector('#hoge'))
//           2. attributes to create a html element: object (e.g. { tag: 'div', style: '' })
// content : two pattern
//           a. innerHTML: string
//           b. component: function, props: object
//----------------------------------------------------------------------------------------------------

export function xnew(...args) {
    let counter = 0;

    const parent = assign((target) => target instanceof Node || target === null);
    const element = assign((target) => target instanceof Element || target === window || (typeof target === 'object' && target !== null));
    const content = args.slice(counter);

    function assign(check) {
        return (args.length > counter && (check(args[counter]) || args[counter] === undefined)) ? args[counter++] : undefined;
    }
    return new Node(parent, element, ...content);
}

//----------------------------------------------------------------------------------------------------
// node
//----------------------------------------------------------------------------------------------------

export class Node {
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
    
    //----------------------------------------------------------------------------------------------------
    // basic
    //----------------------------------------------------------------------------------------------------
    
    _extend(component, props) {
        const defines = Node.wrap(this, component.bind(this), props ?? {}, Object.assign({}, this._.defines ?? {}));

        if (typeof defines === 'object' && defines !== null) {
            Object.keys(defines).forEach((key) => {
                if (['promise', 'start', 'animate', 'stop', 'finalize'].includes(key)) {
                    this._.defines[key] = defines[key];
                } else if (this._.defines[key] || !this[key]) {
                    if (typeof defines[key] === 'object' || typeof defines[key] === 'function') {
                        this._.defines[key] = defines[key];

                        const object = typeof defines[key] === 'object' ? defines[key] : { value: defines[key] };

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
                    } else {
                        console.error(`xnew define error: "${key}" is improper format.`);
                    }
                } else {
                    console.error(`xnew define error: "${key}" already exists.`);
                }
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
            
            // callback
            this._.timerIds?.forEach((id) => {
                this.clearCallback(id);
            });

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

    //----------------------------------------------------------------------------------------------------
    // utilities
    //----------------------------------------------------------------------------------------------------
  
    nestElement(attributes, inner) {
        this.element = this.element.appendChild(createElementWithAttributes(attributes, inner));
    }

    setTimer(delay, callback, ...args) {
        if (this._.phase !== 'finalized' && this._.phase !== 'before finalize') {
            return this._setTimer(delay, callback, ...args);
        }
    }

    _setTimer(delay, callback, ...args) {
        const data = { id: null, counter: 0 };

        const func = () => {
            const response = Node.wrap(this, callback, { delay, counter: data.counter }, ...args);
            data.counter++;
            if (response === true) {
                data.id = setTimeout(func, delay);
            }
        };
        data.id = setTimeout(func, delay);

        const id = Node.timerId++;
        this._.timerIds = this._.timerIds ?? new Map;
        this._.timerIds.set(id, data);
        return id;
    }

    clearTimer(id) {
        if (this._.timerIds?.has(id)) {
            const data = this._.timerIds.get(id);
            clearTimeout(data.id);
            this._.timerIds.delete(id);
        }
    }

    //----------------------------------------------------------------------------------------------------
    // event method
    //----------------------------------------------------------------------------------------------------
   
    _subListener(type, listener) {
        this._.listeners_wrapper = this._.listeners_wrapper ?? new Map();
        if (this._.listeners_wrapper.has(listener) === false) {
            this._.listeners_wrapper.set(listener, (...args) => this.emit(type, ...args));
        }
        return this._.listeners_wrapper.get(listener);
    }

    on(type, listener, options) {
        if (this._.phase !== 'finalized' && this._.phase !== 'before finalize') {
            if (typeof type === 'string' && type.split(' ').length > 1) {
                type.split(' ').forEach((type) => this._on(type, listener, options));
            } else {
                this._on(type, listener, options);
            }
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
        if (this._.phase !== 'finalized' && this._.phase !== 'before finalize') {
            if (typeof type === 'string' && type.split(' ').length > 1) {
                type.split(' ').forEach((type) => this._off(type, listener));
            } else {
                this._off(type, listener);
            }
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
        if (this._.phase !== 'finalized' && this._.phase !== 'before finalize') {
            if (type[0] === '#') {
                let node = this;
                while (node.parent) node = node.parent;
                node._downEmit(type, ...args);
                node._selfEmit(type, ...args);
            } else {
                this._selfEmit(type, ...args);
            }
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
            node._downEmit(type, ...args);
            node._selfEmit(type, ...args);
        });
    }
    
    static timerId = 0;
    
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

