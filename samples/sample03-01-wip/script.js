

function Main() {
    xnew(Input);

    xnew(({ node }) => {
        const width = 800;
        const height = 600;
        node.nestElement({ tag: 'canvas', width, height, style: 'width: 100%; height: 100%; vertical-align: bottom; object-fit: contain;' });

        const renderer = PIXI.autoDetectRenderer({ view: node.element, width, height, background: '#000000' });
        const screen = { container: new PIXI.Container(), width, height };

        xnew(Title, { screen });

        return {
            update: () => {
                renderer.render(screen.container)
            },
        };
    });
}

function Input({ }) {
    if (navigator.userAgent.match(/iPhone|iPad|Android.+Mobile/)) {
        xnew({ style: 'position: absolute; left: 0px; bottom: 0px; z-index: 10;' }, xnex.AnalogStick, { size: 160 }, ({ node }) => {
            node.on('stickstart stickmove', (event, ex) => {
                node.emit('#move', { vector: ex.vector });
            });
        });

        xnew({ style: 'position: absolute; right: 20px; bottom: 20px; z-index: 10;' }, xnex.CircleButton);

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

function Title({ node, screen }) {
    
    const text = new PIXI.Text('touch start', new PIXI.TextStyle({ fill: '#FFFFFF' }));
    text.x = screen.width / 2;
    text.y = screen.height / 2;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    screen.container.addChild(text);

    node.on('click', () => {
        xnew(node.parent, Game, { screen })
        node.finalize();
    })
    return {
        finalize: () => {
            screen.container.removeChild(text);
        }
    }
}

function Game({ node, screen }) {
    const scene = screen.container.addChild(new PIXI.Container());
    
    const enemys = xnew(Enemys, { screen, scene });
    const player = xnew(Player, { screen, scene });


    node.on('#gameover', () => {
        xnew(node.parent, GameOver, { screen })
        node.finalize();
    });

    return {
        update: () => {
        },
        finalize: () => {
            scene.removeChild(container);
        },
    };
}

function GameOver({ node, screen }) {
  
    const text = new PIXI.Text('game over');
    text.x = screen.width / 2;
    text.y = screen.height / 2;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    screen.container.addChild(text);

    node.on('click', () => {
        xnew(node.parent, Title, { screen })
        node.finalize();
    });
    return {
        finalize: () => {
            screen.container.removeChild(text);
        }
    }
}

function Player({ node, screen, scene }) {

    const object = scene.addChild(new PIXI.Container());
    const graphics = object.addChild(new PIXI.Graphics());
    graphics.beginFill(0xEA1E63);
    graphics.drawRect(-10, -10, 20, 20);
    graphics.endFill();

    object.x = screen.width / 2;
    object.y = screen.height / 2;

    let velocity = { x: 0, y: 0 };
    node.on('#move', ({ vector }) => {
        velocity = vector;
    });
    return {
        update: () => {
            object.x += velocity.x * 4;
            object.y += velocity.y * 4;
            object.x = Math.max(0, Math.min(screen.width, object.x));
            object.y = Math.max(0, Math.min(screen.height, object.y));
        },
        finalize: () => {
            container.removeChild(object);
        },

        position: {
            get: () => { return { x: object.x, y: object.y }; },
        },
    };
}

function Enemys({ node, screen, scene }) {
    let delay = 100;
    const addEnemy = () => {
        xnew(Enemy, { screen, scene });
        node.setTimer(delay, addEnemy);
    }
    addEnemy();

}

function Enemy({ node, screen, scene }) {
    const texture = PIXI.Texture.from('enemy.png');
    const texture1 = new PIXI.Texture(texture, new PIXI.Rectangle(0, 0, 32, 32));

    const object = scene.addChild(new PIXI.Container());

    const sprite = new PIXI.Sprite();
    sprite.texture = texture1;
    sprite.anchor.set(0.5);
    object.addChild(sprite);

    object.x = Math.random() * screen.width;
    object.y = -10;

    function detectCollision() {

    }
    return {
        update: () => {
            object.y += 2;
            if (object.y > screen.height) {
                node.finalize();
            }
        },
        finalize: () => {
            scene.removeChild(object);
        },
    };
}