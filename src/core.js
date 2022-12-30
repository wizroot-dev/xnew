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
// function xfind (key)
//
// key  : string
//         ex 'hoge'
//         ex 'hoge fuga'
//----------------------------------------------------------------------------------------------------

export function xfind(key) {
    const set = new Set();
    key.split(' ').forEach((k) => {
        if (k !== '' && Node.map.has(k)) {
            Node.map.get(k).forEach((node) => set.add(node));
        }
    });
    return [...set];
}


//----------------------------------------------------------------------------------------------------
// node
//----------------------------------------------------------------------------------------------------

export class Node {
    constructor(parent, element, ...content) {
        // internal data
        this._ = {};

        this._.phase = 'stop';     // [stop ->start ->...] stop ->finalize
        this._.tostart = false;
        this._.resolve = false;

        this._.defines = {};
        this._.listeners = new Map();
        
        // parent Node class
        this.parent = parent instanceof Node ? parent : Node.current.node;
        this.parent?._.children.add(this);

        this._.children = new Set();

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
                this._extend(content[i++], (typeof content[i] === 'object' && content[i] !== null) ? content[i++] : {});
            } else if (typeof content[i] === 'string' && this._.base !== this.element) {
                this.element.innerHTML = content[0];
            }
        }

        // animation
        if (this.parent === null) {
            this._.frameId = requestAnimationFrame(ticker.bind(this));

            function ticker() {
                this._update();
                this._.frameId = requestAnimationFrame(ticker.bind(this));
            }
        }
    }
    
    //----------------------------------------------------------------------------------------------------
    // basic
    //----------------------------------------------------------------------------------------------------
    
    _extend(component, props) {
        const defines = Node.wrap(this, component, Object.assign(props ?? {}, { node: this }));

        if (typeof defines === 'object' && defines !== null) {
            Object.keys(defines).forEach((key) => {
                if (key === 'promise'){
                    if (defines[key] instanceof Promise) {
                        this._.defines[key] = defines[key];
                    } else {
                        console.error(`xnew define error: "${key}" is improper format.`);
                    }
                } else if (['start', 'update', 'stop', 'finalize'].includes(key)) {
                    if (typeof defines[key] === 'function') {
                        this._.defines[key] = defines[key];
                    } else {
                        console.error(`xnew define error: "${key}" is improper format.`);
                    }
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

        this.promise.then((response) => { this._.resolve = true; return response; });
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
        if (this._.phase === 'stop' && (this.parent === null || this.parent._.phase === 'start') && this._.resolve === true && this._.tostart === true) {
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
        this._.tostart === true ? this._start() : this._stop();

        this._.children.forEach((node) => node._update());
    
        if (this._.phase === 'start') {
            Node.wrap(this, this._.defines.update);
        }
    }

    finalize() {
        if (this._.phase !== 'finalize') {
            this._stop();

            this._.phase = 'finalize';
            [...this._.children].forEach((node) => node.finalize());
            
            Node.wrap(this, this._.defines.finalize);

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
            
            // key
            this.key = '';

            // relation
            this.parent?._.children.delete(this);
        }
    }

    isStarted() {
        return this._.phase === 'start';
    }

    isStopped() {
        return this._.phase === 'stop';
    }

    isFinalized() {
        return this._.phase === 'finalize';
    }

    //----------------------------------------------------------------------------------------------------
    // element
    //----------------------------------------------------------------------------------------------------        
  
    nestElement(attributes, inner) {
        this.element = this.element.appendChild(createElementWithAttributes(attributes, inner));
    }

    //----------------------------------------------------------------------------------------------------
    // timer
    //----------------------------------------------------------------------------------------------------        
  
    setTimer(delay, callback, repeat = false) {
        if (this._.phase !== 'finalized' && this._.phase !== 'before finalize') {
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
    }

    clearTimer(id) {
        if (this._.timerIds?.has(id)) {
            clearTimeout(this._.timerIds.get(id).timeout);
            this._.timerIds.delete(id);
        }
    }

    //----------------------------------------------------------------------------------------------------
    // key
    //----------------------------------------------------------------------------------------------------
   
    set key(key) {
        if (typeof key !== 'string') return;

        (this._.key ?? '').split(' ').forEach((k) => {
            if (k !== '') {
                Node.map.get(k).delete(this)
            }
        });

        this._.key = '';

        const tmp = new Set();
        key.split(' ').forEach((k) => {
            if (k !== '' && !tmp.has(k)) {
                tmp.add(k);
                if (!Node.map.has(k)) Node.map.set(k, new Set);
                Node.map.get(k).add(this);
                this._.key += k + ' ';    
            }
        });
    }

    get key() {
        return this._.key ?? '';
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

    static map = new Map();
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

