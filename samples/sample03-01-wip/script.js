

function Main() {
    xnew(Input);

    xnew(xnex.Screen, { width: 800, height: 600 }, function ({ node }) {
        const renderer = PIXI.autoDetectRenderer({ view: node.canvas, width: node.width, height: node.height, background: '#000000', backgroundAlpha: 0.1 });

        const scene = new PIXI.Container();
        xnew(Title, { scene, width: node.width, height: node.height });

        return {
            animate: () => {
                renderer.render(scene)
            },
        };
    });
}

function Input({ node }) {
    if (navigator.userAgent.match(/iPhone|iPad|Android.+Mobile/)) {
        const stick = xnew({ style: 'position: absolute; left: 0px; bottom: 0px; z-index: 10;' }, xnex.AnalogStick, { size: 160 });
        const button = xnew({ style: 'position: absolute; right: 20px; bottom: 20px; z-index: 10;' }, xnex.CircleButton);

        stick.on('stickstart stickmove', (event, ex) => {
            stick.emit('#move', { vector: ex.vector });
        });
    } else {
        xnew(window, function ({ node }) {
            const keys = {};
            node.on('keydown', (event) => {
                keys[event.key] = 1;
                keyChange();
            });
            node.on('keyup', (event) => {
                keys[event.key] = 0;
                keyChange();
            });

            function keyChange() {
                const x = (keys['ArrowLeft'] ? -1 : 0) + (keys['ArrowRight'] ? +1 : 0);
                const y = (keys['ArrowUp'] ? -1 : 0) + (keys['ArrowDown'] ? +1 : 0);
                node.emit('#move', { vector: { x, y } });
            }
        });
    }
}

function Title({ node, scene, width, height }) {
    
    const text = new PIXI.Text('touch start');
    text.x = width / 2;
    text.y = height / 2;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    scene.addChild(text);

    node.on('click', () => {
        xnew(node.parent, Game, { scene, width, height })
        node.finalize();
    })
    return {
        finalize: () => {
            scene.removeChild(text);
        }
    }
}

function Game({ node, scene, width, height }) {
    const container = scene.addChild(new PIXI.Container());
    
    const player = xnew(Player, { container, width, height });

    let delay = 100;

    const addEnemy = () => {
        const enemy = xnew(Enemy, { container, width, height, player });
        node.setTimer(delay, addEnemy);
    }
    addEnemy();

    node.on('#gameover', () => {
        xnew(node.parent, GameOver, { scene, width, height })
        node.finalize();
    });

    return {
        animate: () => {
        },
        finalize: () => {
            scene.removeChild(object);
        },
    };
}

function GameOver({ node, scene, width, height }) {
  
    const text = new PIXI.Text('game over');
    text.x = width / 2;
    text.y = height / 2;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    scene.addChild(text);

    node.on('click', () => {
        xnew(node.parent, Title, { scene, width, height })
        node.finalize();
    });
    return {
        finalize: () => {
            scene.removeChild(text);
        }
    }
}

function Player({ node, container, width, height }) {

    const object = container.addChild(new PIXI.Container());
    const graphics = object.addChild(new PIXI.Graphics());
    graphics.beginFill(0xEA1E63);
    graphics.drawRect(-10, -10, 20, 20);
    graphics.endFill();

    object.x = width / 2;
    object.y = height / 2;

    let velocity = { x: 0, y: 0 };
    node.on('#move', ({ vector }) => {
        velocity = vector;
    });
    return {
        animate: () => {
            object.x += velocity.x * 4;
            object.y += velocity.y * 4;
            object.x = Math.max(0, Math.min(width, object.x));
            object.y = Math.max(0, Math.min(height, object.y));
        },
        finalize: () => {
            container.removeChild(object);
        },

        position: {
            get: () => { return { x: object.x, y: object.y }; },
        },
    };
}

function Enemy({ node, container, width, height, player }) {

    const object = container.addChild(new PIXI.Container());
    const graphics = object.addChild(new PIXI.Graphics());
    graphics.beginFill(0x221E63);
    graphics.drawRect(-10, -10, 20, 20);
    graphics.endFill();

    object.x = Math.random() * width;
    object.y = -10;

    function detectCollision() {

    }
    return {
        animate: () => {
            object.y += 2;
            if (object.y > height) {
                node.finalize();
            }
        },
        finalize: () => {
            container.removeChild(object);
        },
    };
}