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

export function xnew(...args) {
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
//     string (ex 'hoge', 'hoge fuga')
//
//----------------------------------------------------------------------------------------------------

export function xfind(key) {
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

export class Node {
    constructor(parent, element, ...content) {
        // internal data
        this._ = {};

        this._.phase = 'initialize';  // initialize ->[stop ->start ->...] ->stop ->finalize
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
        } else if (isObject(element)) {
            this._.base = this.parent ? this.parent.element : document.body;
            this.element = createElementWithAttributes(this._.base, element);
        } else {
            this._.base = this.parent ? this.parent.element : document.body;
            this.element = this._.base;
        }

        // shared data
        this._.shared = this.parent?._.shared ?? {};

        // auto start
        this.start();

        if (content.length > 0) {
            if (isFunction(content[0])) {
                this._extend(content[0], isObject(content[1]) ? content[1] : {});
            } else if (isValidString(content[0]) && this._.base !== this.element) {
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
            this.element = createElementWithAttributes(this.element, attributes, inner);
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

        this._.timerIds = this._.timerIds ?? new Map();
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
   
    static keyMap = new Map();

    set key(key) {
        // clear
        (this._.key ?? '').split(' ').forEach((k) => {
            if (isValidString(k) === true) {
                Node.keyMap.get(k).delete(this)
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
            this.element?.addEventListener(type, this._subListener(type, listener), options ?? { passive: false });
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
        // if (this._.phase === 'finalize') return;

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