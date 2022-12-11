# xnew
Simple component based library.  
Useful for creating apps or games with dynamic scenes.

## Installation
- via cdn  
  
```
<script src="https://unpkg.com/xnew@0.1.0/dist/xnew.js"></script>
```

- via npm
```
npm install xnew
```

## Features
Before describing the specifications, let's first look the features with some samples.

### Component based  
The following sample creates a button element that count up when clicked. You can manage it as a separate component. 

```
const button = xnew(MyButton, { text: 'click me!' });

// ...

// component function
function MyButton({ text }) {
    this.nest({ tag: 'button', style: 'padding: 8px;' }, text);
    let counter = 0;
    this.on('click', () => {
        this.element.textContent = ++counter + ' clicked!';
    })
}
```

### Cooperation with rendering libraries
Works well with rendering libraries like three.js and pixi.js. The following samples creates a animating object using three.js and pixi.js.

![three](./images/three.gif)

```
// create canvas and setup three.js
xnew(function () {
    const [width, height] = [800, 450];
    const canvas = xnew({ tag: 'canvas', width, height });

    const renderer = new THREE.WebGLRenderer({ canvas: canvas.element });

    const camera = new THREE.PerspectiveCamera(45, width / height);
    camera.position.set(0, 0, +100);

    const scene = new THREE.Scene();

    xnew(MyCube, { scene });

    return {
        animate: () => {
            renderer.render(scene, camera);
        },
    };
});
```

```
// create a cube and animate
function MyCube({ scene }) {
    const geometry = new THREE.BoxGeometry(40, 40, 40);
    const material = new THREE.MeshNormalMaterial();
    const object = new THREE.Mesh(geometry, material);
    scene.add(object);

    return {
        animate: () => {
            object.rotation.y += 0.01;
        },
        finalize: () => {
            scene.remove(object);
        },
    };
}

```

![pixi](./images/pixi.gif)
```
// create canvas and setup pixi.js
xnew(function() {
    const [width, height] = [800, 450];
    const canvas = xnew({ tag: 'canvas', width, height });

    const renderer = PIXI.autoDetectRenderer({ view: canvas.element, width, height });
    const scene = new PIXI.Container();
    scene.x = width / 2;
    scene.y = height / 2;
    
    xnew(MyBox, { scene });

    return {
        animate: () => {
            renderer.render(scene)
        },
    };
});
```

```
// create a box and animate
function MyBox({ scene }) {
    const object = scene.addChild(new PIXI.Container());
    const graphics = object.addChild(new PIXI.Graphics());
    graphics.beginFill(0xEA1E63);
    graphics.drawRect(-80, -80, 160, 160);
    graphics.endFill();
    
    return {
        animate: () => {
            object.rotation += 0.01;
        },
        finalize: () => {
            scene.removeChild(object);
        },
    };
}
```


## Specification

### Overview of `xnew`
`xnew` create a object, we call it 'node'. 

```
// function xnew (parent, element, content)
// 
// parent  : node: object
// element : html element, window or attributes to create it: object
// content : two pattern
//           1. innerHTML: string
//           2. component: function, props: object
```

As shown above, xnew accepts arguments `parent`, `element`, `content`.  

- `parent` is a parameter that is set as the parent node. In many cases, it is omitted, and set automatically. so the details are described later.
- `element` is a parameter for element to associate with new node. If you omit this parameter, new node's element inherits the parent node's element. If there is no parent node, it inherits `document.body` element.
- `content` is the content of the node. There are two patterns. First pattern is innerHTML for new element. Second pattern is component function and its properties.  
**Note that you have to use `function` keyword as component function, not `() => {} (arrow function)`**. This is because to bind `this` pointer in the function.

### #1
If you call `xnew` like nesting, created nodes have a parent-child relationship.
```
<body>
<div id="hoge"></div>

<script>
    const node1 = xnew(document.querySelector('#hoge'), function () {
        this;         // node1
        this.parent;  // null
        this.element; // hoge

        const node2 = xnew(function () {
            this;         // node2
            this.parent;  // node1
            this.element; // hoge (equal to parent's element)
        });

        const node3 = xnew({ tag: 'div', id: 'fuga' }, function () {
            this;         // node3
            this.parent;  // node1
            this.element; // fuga (new element as a child element of hoge)
        });

        const node4 = xnew(function () {
            // create new element and replace this.element
            this.nest({ tag: 'div', id: 'piyo' };

            this;         // node4
            this.parent;  // node1
            this.element; // piyo (new element as a child element of hoge)
        });
    });

    const node5 = xnew(function () {
        this;         // node5
        this.parent;  // null
        this.element; // document.body
    });
</script>
</body>
```
- If you omit `element`, new node's element is set automatically (e.g. node2, node4, node5). 
- `this` pointer is a different value depending on where it is used.


### #2
New node has several functions available by default. You can define the detail using thre response of component function.

```
const node = xnew(function () {

    return {
        promise: new Promise((resolve, reject) => {
            // animate will not start until this promise is resolved.
        }), 
        start: () => {
            // fires before animation starts.
        },
        animate: (time) => {
            // executed repeatedly
        },
        stop: () => {
            // fires before animation stops.
        },
        finalize: () => {
            // fires when node.finalize() is called
            // note that it is also called automatically when parent node finalizes.
        },
    }
});

node.start();    // start animation
node.stop();     // stop animation
node.finalize(); // created element and child nodes will be deleted 

node.isStarted();   // return boolean 
node.isStopped();   // ...
node.isFinalized(); // ...

```

- By default, nodes automatically calls start. If you want to avoid this, call `this.stop()` inside the component function.


### #3
You can define original functions for new node.
```
const node = xnew(function () {
    let counter = 0;

    return {
        countUp: () => {
            counter++;
        },
        counter: {
            set: (value) => counter = value, 
            get: () => counter,
        },
    }
});

node.countUp(); // 0 -> 1
node.counter++  // 1 -> 2

```
- Existing functions cannot be overwritten.

### #4
You can set the event listener using `on`, and fire original event using `emit`.
```
const node = xnew(function () {
    this.on('click', (event) => {
        // fires when the element is clicked.
    });

    this.on('myevent', (data) => {
        // fires when emit('myevent') is called.
    });

    // this.off(); // unset all listeners
    // this.off('myevent'); // unset 'myevent'
});

node.emit('myevent', data); 
```
- `emit('myevent')` emits only to self node, and not to other nodes.
- If you add `#` token, `emit('#myevent')` emit to all nodes connected by parent-child relationship. this message can be received by using `on('#myevent')`.

### #5
If you want to intentionally change the parent node, set first argument of `xnew`. For example, it is set in cases such as scene changes, where you want to create a sibling node in a node.

```
const root = xnew(function () {
    xnew(Scene1);
});

function Scene1 () {
    return {
        nextScene: () => {
            xnew(this.parent, Scene2); // this.parent == root
            this.finalize();
        },
    }

    // case1 : xnew(Scene2) or xnew(this, Scene2)
    //         root -> 'Scene1' -> 'Scene2'
    // 
    // case2 : xnew(this.parent, Scene2)
    //         root -> 'Scene1'
    //              -> 'Scene2'
}

function Scene2 () {
    // ...
}

```
- If you don't set the parent node, Scene2 node will also be deleted when `this.finalize()` is called because Scene2 node is a child of Scene1 node.