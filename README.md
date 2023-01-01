# xnew
Simple library for component based programing.  
Useful for creating apps and games with dynamic scenes.

## Setup
- via cdn  
  
```
<script src="https://unpkg.com/xnew@0.2.x/dist/xnew.js"></script>
```

- via npm
```
npm install xnew
```
```
import { xnew } from 'xnew'
```
## Features
Before describing the specifications, let's first look the features with some samples.

### Component based  
The following sample creates a button element that count clicks. Component based description like this, is easy to manage and extend programs because each function can be managed independently.

```
const button = xnew(MyButton, { text: 'click me!' });

// ...

// component
function MyButton({ node, text }) {
    node.nestElement({ tag: 'button', style: 'padding: 8px;' }, text);
    let counter = 0;
    node.on('click', () => {
        node.element.textContent = ++counter + ' clicked!';
    })
}
```

### Collaboration with rendering libraries
Works well with rendering libraries like three.js and pixi.js. The following samples creates a animating object using three.js and pixi.js.

![three](./images/three.gif)

```
// create canvas and setup three.js
xnew(() => {
    const width = 800, height = 450;
    const canvas = xnew({ tag: 'canvas', width, height });

    const renderer = new THREE.WebGLRenderer({ canvas: canvas.element });

    const camera = new THREE.PerspectiveCamera(45, width / height);
    camera.position.set(0, 0, +100);

    const scene = new THREE.Scene();

    xnew(MyCube, { scene });

    return {
        update: () => {
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
        update: () => {
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
xnew(() => {
    const width = 800, height = 450;
    const canvas = xnew({ tag: 'canvas', width, height });

    const renderer = PIXI.autoDetectRenderer({ view: canvas.element, width, height });
    const scene = new PIXI.Container();
    scene.x = width / 2;
    scene.y = height / 2;
    
    xnew(MyBox, { scene });

    return {
        update: () => {
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
        update: () => {
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
function xnew (parent, element, ...content)

parent : node (in many cases, this is omitted and set automatically)
element: two patterns
          1. html element or window: object (e.g. document.querySelector('#hoge'))
          2. attributes to create a html element: object (e.g. { tag: 'div', style: '' })
content: two patterns
          a. innerHTML: string
          b. component: function, +props: object
```

As shown above, xnew accepts arguments (`parent`, `element`, `content`).  

- **`parent`** is a parameter that is set as the parent node. In many cases, it is omitted, and set automatically. It is set when you intentionally want to bind to another node (described later).
- **`element`** is a parameter for html element to associate with new node. If you omit this parameter, new node's element inherits the parent node's element. If there is no parent node, it inherits `document.body` element.
- **`content`** is a parameter that set the behavior of the node. There are two patterns. First pattern is innerHTML for new element. Second pattern is component function and its properties.  

### Parent-child relationship
If you call `xnew` like nesting, created nodes have a parent-child relationship. Child nodes hold a pointer to parent node. and Child node `element` is set based on the parent node's `element`.

```
<body>
<div id="hoge"></div>

<script>
    const node1 = xnew(document.querySelector('#hoge'), ({ node }) => {
        // node.parent: null
        // node.element: hoge

        const node2 = xnew(({ node }) => {
            // node.parent: node1
            // node.element: hoge (equal to parent's element)
        });

        const node3 = xnew({ tag: 'div', id: 'fuga' }, ({ node }) => {
            // node.parent: node1
            // node.element: fuga (as a child element of hoge)
        });

        const node4 = xnew(({ node }) => {
            // create new element and replace node.element
            node.nestElement({ tag: 'div', id: 'piyo' };

            // node.parent: node1
            // node.element: piyo (as a child element of hoge)
        });
    });
</script>
</body>
```

### System functions 
nodes has some system functions for basic control. You can define the detail in the response of the component function.

```
const node = xnew(({ node }) => {

    return {
        promise: new Promise((resolve, reject) => {
            // update will not start until this promise is resolved.
        }), 
        start: () => {
            // fires before animation starts.
        },
        update: () => {
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
node.finalize(); // current node and the child nodes will be deleted 

node.isStarted();   // return boolean 
node.isStopped();   // ...
node.isFinalized(); // ...
```

- By default, nodes automatically calls start when there are created. If you want to avoid it, call `node.stop()` inside the component function.


### Original functions
You can define original functions unless the function is already defined.
```
const node = xnew(({ node }) =>  {
    let counter = 0;

    return {
        countUp: () => {
            counter++;
        },
        // setter getter
        counter: {
            set: (value) => counter = value, 
            get: () => counter,
        },
    }
});

node.countUp(); // 0 -> 1
node.counter = 2;       // setter
const x = node.counter; // getter

```
- Avoid using name starting with an underscore `_`, because it is used as internal function of nodes.

### Event listener
You can set the event listener using `on`, and fire original event using `emit`.
```
const node = xnew(({ node }) => {
    node.on('click', (event) => {
        // fires when the element is clicked.
    });

    // original event
    node.on('myevent', (data) => {
        // fires when emit('myevent') is called.
    });

    // node.off(); // unset all listeners in the node
    // node.off('myevent'); // unset 'myevent'
});

node.emit('myevent', data); 
```
- `emit('myevent')` emits only to self node, and not to other nodes.
- If you add `#` token (ex. `emit('#myevent')`), it emit to all nodes. this message can be received by using `on('#myevent')`.

### Timer
By using a timer, you can set a function to be executed after a specified time.
```
const deley = 1000; // 1000 [ms]

// run only once
xnew(({ node }) =>  {
    const id = node.setTimer(delay, () => {
        // ...
    });
});

// run repeatedly
xnew(({ node }) =>  {
    const id = node.setTimer(delay, () => {
        // ...
    }, true);
});

```
- Timers can be canceled by calling `clearTimer(id)` using the id.
- Timers are automatically canceled when the node's `finalize` method is called.


### Parent node
If you want to intentionally change the parent node, set first argument of `xnew`. For example, it is set in cases such as scene changes, where you want to create a sibling node in a node.

```
const root = xnew(({ node }) =>  {
    xnew(Scene1);
});

function Scene1 ({ node }) {
    return {
        nextScene: () => {
            xnew(node.parent, Scene2); // node.parent == root
            node.finalize();
        },
    }

    // case1 : xnew(Scene2) or xnew(node, Scene2)
    //         root -> 'Scene1' -> 'Scene2'
    // 
    // case2 : xnew(node.parent, Scene2)
    //         root -> 'Scene1'
    //              -> 'Scene2'
}

function Scene2 ({ node }) {
    // ...
}

```
- If you don't set the parent node, Scene2 node will also be deleted when `node.finalize()` is called because Scene2 node is a child of Scene1 node.