function main() {
    xnew(() => {
        const screen = xnew(xn.Screen, { width: 800, height: 600 });

        const renderer = PIXI.autoDetectRenderer({ view: screen.canvas, width: screen.width, height: screen.height, background: '#000000' });
        const stage = new PIXI.Container();

        xnew(Input);
        xnew(Title, { screen, stage });

        return {
            update: () => {
                renderer.render(stage)
            },
        };
    });
}

function Input({ node }) {
    if (navigator.userAgent.match(/iPhone|iPad|Android.+Mobile/)) {
        const stick = xnew({ style: 'position: absolute; left: 0px; bottom: 0px; z-index: 10;' }, xn.AnalogStick, { size: 160 });
        stick.on('start move', (event, ex) => {
            stick.emit('#move', { vector: ex.vector });
        });

        const button = xnew({ style: 'position: absolute; right: 20px; bottom: 20px; z-index: 10;' }, xn.CircleButton);
        button.on('down', () => {
            node.emit('#shoton');
        })
        button.on('up', () => {
            node.emit('#shotoff');
        })
    } else {
        const keyState = {};
        node.on('keydown', (event) => {
            keyState[event.key] = 1;
            move();
            if (event.key === ' ') node.emit('#shot', true);
        });
        node.on('keyup', (event) => {
            keyState[event.key] = 0;
            move();
            if (event.key === ' ') node.emit('#shot', false);
        });

        function move() {
            const x = (keyState['ArrowLeft'] ? -1 : 0) + (keyState['ArrowRight'] ? +1 : 0);
            const y = (keyState['ArrowUp'] ? -1 : 0) + (keyState['ArrowDown'] ? +1 : 0);
            node.emit('#move', { vector: { x, y } });
        }
    }
}

function Title({ node, screen, stage }) {
    
    const text = new PIXI.Text('touch start', new PIXI.TextStyle({ fill: '#FFFFFF' }));
    text.x = screen.width / 2;
    text.y = screen.height / 2;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    stage.addChild(text);

    node.on('click', () => {
        xnew(node.parent, GameMain, { screen, stage })
        node.finalize();
    })
    return {
        finalize: () => {
            stage.removeChild(text);
        }
    }
}

function GameMain({ node, screen, stage }) {
    const scene = stage.addChild(new PIXI.Container());
    
    let delay = 100;
    const addEnemy = () => {
        xnew(Enemy, { screen, scene });
        node.setTimer(delay, addEnemy);
    }
    addEnemy();

    const player = xnew(Player, { screen, scene });

    node.on('#gameover', () => {
        xnew(node.parent, GameOver, { screen, stage })
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

function GameOver({ node, screen, stage }) {
  
    const text = new PIXI.Text('game over');
    text.x = screen.width / 2;
    text.y = screen.height / 2;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    stage.addChild(text);

    node.on('click', () => {
        xnew(node.parent, Title, { screen, stage })
        node.finalize();
    });
    return {
        finalize: () => {
            stage.removeChild(text);
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

    let shot = false;
    let stanby = true;
    node.on('#shot', (flag) => {
        shot = flag;
    });

    return {
        update: () => {
            object.x += velocity.x * 4;
            object.y += velocity.y * 4;
            object.x = Math.max(0, Math.min(screen.width, object.x));
            object.y = Math.max(0, Math.min(screen.height, object.y));

            for (const enemy of xfind('enemy')) {
                const dx = node.object.x - enemy.object.x;
                const dy = node.object.y - enemy.object.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 22) {
                    enemy.finalize();
                    break;
                }
            }
            
            if (shot && stanby) {
                xnew(Bullet, { screen, scene, position: { x: object.x, y: object.y } });
                stanby = false;
                node.setTimer(200, () => {
                    stanby = true;
                });
            }
        },
        finalize: () => {
            container.removeChild(object);
        },
        object: { get: () => object },
    };
}

function Bullet({ node, screen, scene, position }) {
    const object = scene.addChild(new PIXI.Container());
    object.x = position.x;
    object.y = position.y;

    const graphics = object.addChild(new PIXI.Graphics());
    graphics.lineStyle(0);
    graphics.beginFill(0xDE3249, 1);
    graphics.drawCircle(0, 0, 4);
    graphics.endFill();

    return {
        update: () => {
            object.y -= 10;
            if (object.y < 0) {
                node.finalize();
            }
            for (const enemy of xfind('enemy')) {
                const dx = node.object.x - enemy.object.x;
                const dy = node.object.y - enemy.object.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 15) {
                    enemy.die();
                    node.finalize();
                    break;
                }
            }
        },
        finalize: () => {
            scene.removeChild(object);
        },
        object: { get: () => object },
    };
}

function Enemy({ node, screen, scene }) {
    node.key = 'enemy';

    const texture = PIXI.Texture.from('enemy.png');
    const texture1 = new PIXI.Texture(texture, new PIXI.Rectangle(0, 0, 32, 32));

    const object = scene.addChild(new PIXI.Container());

    const sprite = new PIXI.Sprite();
    sprite.texture = texture1;
    sprite.anchor.set(0.5);
    object.addChild(sprite);

    const x = Math.random() * screen.width;
    object.x = x
    object.y = -10;

    function detectCollision() {

    }
    return {
        update: (time) => {
            object.y += 2;
            object.x = x + 50 * Math.sin(time / 1000);
            if (object.y > screen.height) {
                node.finalize();
            }
        },
        die: () => {
            for(let i = 0; i < 3; i++) {
                xnew(node.parent, Star, { screen, scene, position: { x: object.x, y: object.y } });
            }
            node.finalize();
        },
        finalize: () => {
            
            scene.removeChild(object);
        },
        object: { get: () => object },
    };
}

function Star({ node, screen, scene, position }) {
    const object = scene.addChild(new PIXI.Container());
    object.x = position.x;
    object.y = position.y;

    const graphics = object.addChild(new PIXI.Graphics());
    graphics.lineStyle(0);
    graphics.beginFill(0x35CC5A, 1);
    graphics.drawCircle(0, 0, 5);
    graphics.endFill();

    const vector = { x: (2 * Math.random() - 1) * 3, y: (2 * Math.random() - 1) * 3 };
    console.log(position, vector);
    node.setTimer(800, () => {
        node.finalize();
    })

    return {
        update: () => {
            object.x += vector.x;
            object.y += vector.y;

            for (const enemy of xfind('enemy')) {
                const dx = node.object.x - enemy.object.x;
                const dy = node.object.y - enemy.object.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 15) {
                    enemy.die();
                    node.finalize();
                    break;
                }
            }
        },
        finalize: () => {
            console.log('lost')
            scene.removeChild(object);
        },
        object: { get: () => object },
    };
}