function main() {
    xnew(() => {
        const screen = xnew(xn.Screen, { width: 400, height: 300 });
        
        const renderer = PIXI.autoDetectRenderer({ view: screen.canvas, width: screen.width, height: screen.height });
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
    if (1 || xutil.device.isMobile()) {
        const stick = xnew({ style: 'position: absolute; left: 0px; bottom: 0px; z-index: 10;' }, xn.AnalogStick, { size: 160 });
        stick.on('start move end', (event, ex) => {
            event.stopPropagation();
            node.emit('#move', { x: ex.vector.x * 0.7, y: ex.vector.y * 0.7 });
        });
        stick.on('click', (event) => {
            event.stopPropagation();
        });

        const button = xnew({ style: 'position: absolute; right: 20px; bottom: 20px; z-index: 10;' }, xn.CircleButton);
        button.on('down up', (event, ex) => {
            event.stopPropagation();
            node.emit('#shot', ex.type === 'down');
        });
    } else {
        const keyState = {};
        node.on('keydown keyup', (event) => {
            keyState[event.key] = event.type === 'keydown';

            const x = (keyState['ArrowLeft'] ? -1 : 0) + (keyState['ArrowRight'] ? +1 : 0);
            const y = (keyState['ArrowUp'] ? -1 : 0) + (keyState['ArrowDown'] ? +1 : 0);

            node.emit('#move', { x, y });
            node.emit('#shot', keyState[' ']);
        });
    }
}

function Title({ node, screen, stage }) {
    const text = new PIXI.Text('touch start', { fill: '#FFFFFF' });
    text.x = screen.width / 2;
    text.y = screen.height / 2;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    stage.addChild(text);

    node.on('click', () => {
        xnew(node.parent, GameMain, { screen, stage })
        node.finalize();
    });
    return {
        finalize: () => {
            stage.removeChild(text);
        }
    }
}

function GameMain({ node, screen, stage }) {
    const scene = stage.addChild(new PIXI.Container());
    xnew(Score, { screen, scene });

    const id = node.setTimer(500, () => {
        xnew(Enemy, { screen, scene });
    }, true);

    xnew(Player, { screen, scene });

    node.on('#gameover', () => {
        node.clearTimer(id);
        xnew(GameOver, { screen, scene });

        node.on('click', () => {
            xnew(node.parent, Title, { screen, stage })
            node.finalize();
        })
    });

    return {
        update: () => {
        },
        finalize: () => {
            stage.removeChild(scene);
        },
    };
}

function GameOver({ node, screen, scene }) {
    const text = new PIXI.Text('game over', { fill: '#FFFFFF' });
    text.x = screen.width / 2;
    text.y = screen.height / 2;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    scene.addChild(text);

    return {
        finalize: () => {
            scene.removeChild(text);
        }
    }
}

function Player({ node, screen, scene }) {
    const object = new PIXI.Container();
    scene.addChild(object);
    const sprite = new PIXI.Sprite();
    object.addChild(sprite);

    sprite.texture = new PIXI.Texture(PIXI.Texture.from('texture.png'), new PIXI.Rectangle(0, 0, 32, 32));
    sprite.anchor.set(0.5);

    object.x = screen.width / 2;
    object.y = screen.height / 2;

    let velocity = { x: 0, y: 0 };
    node.on('#move', (vector) => { velocity = vector; });

    let shot = false;
    let stanby = true;
    node.on('#shot', (flag) => { shot = flag; });

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
                    node.die();
                }
            }
            
            if (shot && stanby) {
                xnew(Bullet, { screen, scene, position: { x: object.x, y: object.y } });
                stanby = false;
                node.setTimer(200, () => { stanby = true; });
            }
        },
        die: () => {
            node.emit('#gameover');
            node.finalize();
        },
        finalize: () => {
            scene.removeChild(object);
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
    graphics.drawCircle(0, 0, 3);
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

    const object = scene.addChild(new PIXI.Container());
    const sprite = new PIXI.Sprite();
    sprite.texture = new PIXI.Texture(PIXI.Texture.from('texture.png'), new PIXI.Rectangle(32, 0, 32, 32));
    sprite.anchor.set(0.5);
    object.addChild(sprite);

    const x = Math.random() * screen.width;
    object.x = x
    object.y = -10;

    const a = Math.PI * (Math.random() * 90 + 45) / 180;
    const v = (Math.random() * 2 + 1);
    const velocity = { x: v * Math.cos(a), y: v * Math.sin(a)};

    return {
        update: () => {
            if (object.x < 10) velocity.x = Math.abs(velocity.x);
            if (object.x >= screen.width - 10) velocity.x = -Math.abs(velocity.x);
            if (object.y < 10) velocity.y = Math.abs(velocity.y);
            if (object.y >= screen.height - 10) velocity.y = -Math.abs(velocity.y);

            object.x += velocity.x;
            object.y += velocity.y;
        },
        die: (value = 1) => {
            const position = { x: object.x, y: object.y };
            for(let i = 0; i < 3; i++) {
                xnew(node.parent, Star, { screen, scene, position, value });
            }
            xnew(node.parent, ScoreUp, { screen, scene, position, value });

            node.finalize();
        },
        finalize: () => {
            scene.removeChild(object);
        },
        object: { get: () => object },
    };
}

function Star({ node, screen, scene, position, value = 1 }) {
    const object = scene.addChild(new PIXI.Container());
    object.x = position.x;
    object.y = position.y;

    const sprite = new PIXI.Sprite();
    sprite.texture = new PIXI.Texture(PIXI.Texture.from('texture.png'), new PIXI.Rectangle(64, 0, 32, 32));
    sprite.anchor.set(0.5);
    object.addChild(sprite);

    const vector = { x: (2 * Math.random() - 1) * 3, y: (2 * Math.random() - 1) * 3 };
    node.setTimer(800, () => node.finalize());

    let counter = 0;
    return {
        update: () => {
            object.x += vector.x;
            object.y += vector.y;
            object.rotation = counter++ / 10;

            for (const enemy of xfind('enemy')) {
                const dx = node.object.x - enemy.object.x;
                const dy = node.object.y - enemy.object.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 15) {
                    enemy.die(value * 2);
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

function ScoreUp({ node, screen, scene, position, value = 1 }) {
    const text = new PIXI.Text(`+ ${value}`, { fontSize: 16, fill: '#FFFF22' });
    text.x = position.x;
    text.y = position.x;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    node.emit('#scoreup', value);
    scene.addChild(text);
    node.setTimer(1000, () => node.finalize());

    let counter = 0;
    return {
        update: () => {
            text.y = position.y - 30 * Math.exp(-counter / 20) * Math.abs(Math.sin(Math.PI * (counter * 10) / 180)); 
            counter++;
        },
        finalize: () => {
            scene.removeChild(text);
        }
    }
}

function Score({ node, screen, scene }) {
    let score = 0;

    const text = new PIXI.Text(`score ${score}`, { fontSize: 16, fill: '#FFFF22' });
    text.x = screen.width;
    text.y = 0;
    text.pivot.x = text.width;
    text.pivot.y = 0;
    scene.addChild(text);
    node.on('#scoreup', (value) => {
        text.text = `score ${score += value}`;
        text.pivot.x = text.width;
    });
}

