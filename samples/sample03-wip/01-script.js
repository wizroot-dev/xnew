function main() {
    xnew(({ node }) => {
        const screen = xnew(xn.Screen, { width: 400, height: 300 });
        
        const renderer = PIXI.autoDetectRenderer({ view: screen.canvas, width: screen.width, height: screen.height });
        const stage = new PIXI.Container();

        xnew(Input);
        xnew(Background, { screen, stage });
        xnew(Title, { screen, stage });

        return {
            update: () => {
                renderer.render(stage)
            },
        };
    });
}

function Input({ node }) {
    if (xutil.device.isMobile()) {
        const stick = xnew({ style: 'position: absolute; left: 0px; bottom: 0px; z-index: 10;' }, xn.AnalogStick, { size: 160 });
        stick.on('down move up', (event, ex) => {
            node.emit('#move', { x: ex.vector.x * 0.7, y: ex.vector.y * 0.7 });
        });

        const button = xnew({ style: 'position: absolute; right: 20px; bottom: 20px; z-index: 10;' }, xn.CircleButton);
        button.on('down up', (event, ex) => {
            node.emit('#shot', ex.type === 'down');
        });
    } 
    
    const keyState = {};
    node.on('keydown keyup', (event) => {
        keyState[event.key] = event.type === 'keydown';

        const x = (keyState['ArrowLeft'] ? -1 : 0) + (keyState['ArrowRight'] ? +1 : 0);
        const y = (keyState['ArrowUp'] ? -1 : 0) + (keyState['ArrowDown'] ? +1 : 0);

        node.emit('#move', { x, y });
        node.emit('#shot', keyState[' ']);
    });
}

function Background({ node, screen, stage }) {
    const background = stage.addChild(new PIXI.Container());

    for (let i = 0; i < 100; i++) xnew(Dot);

    function Dot({ node, init = true }) {
        const object = background.addChild(new PIXI.Container());
        object.x = Math.random() * screen.width;
        object.y = init ? Math.random() * screen.height : -10;

        const velocity = Math.random() + 0.1;
        const graphics = object.addChild(new PIXI.Graphics());
        graphics.lineStyle(0);
        graphics.beginFill(0xFFFFFF, 1);
        graphics.drawCircle(0, 0, 1);
        graphics.endFill();
    
        return {
            update: () => {
                object.y += velocity;
                if (object.y > screen.height) {
                    xnew(node.parent, Dot, { init: false });
                    node.finalize();
                }
            },
            finalize: () => {
                background.removeChild(object);
            },
        };
    }
}

function Title({ node, screen, stage }) {
    const text = bindObject(stage, new PIXI.Text('touch start', { fill: 0xFFFFFF }));
    text.x = screen.width / 2;
    text.y = screen.height / 2;
    text.anchor.set(0.5);

    node.on('click keydown', () => {
        xnew(node.parent, GameMain, { screen, stage })
        node.finalize();
    });
}

function GameMain({ node, screen, stage }) {
    const scene = bindObject(stage, new PIXI.Container());
    
    xnew(Score, { screen, scene });
    xnew(Player, { screen, scene });
    const id = node.setTimer(500, () => xnew(Enemy, { screen, scene }), true);

    node.on('#gameover', () => {
        node.clearTimer(id);
        xnew(GameOver, { screen, scene });

        node.setTimer(1000, () => {
            node.on('click keydown', () => {
                xnew(node.parent, Title, { screen, stage })
                node.finalize();
            })
        });
    });
}

function GameOver({ node, screen, scene }) {
    const text = bindObject(scene, new PIXI.Text('game over', { fill: 0xFFFFFF }));
    text.x = screen.width / 2;
    text.y = screen.height / 2;
    text.anchor.set(0.5);
}

function Player({ node, screen, scene }) {
    const object = bindObject(scene, new PIXI.Container());

    const texture = PIXI.Texture.from('01-texture.png');
    const textures = [
        new PIXI.Texture(texture, new PIXI.Rectangle(0, 0, 32, 32)),
        new PIXI.Texture(texture, new PIXI.Rectangle(32, 0, 32, 32)),
    ];

    const sprite = new PIXI.AnimatedSprite(textures);
    object.addChild(sprite);
    sprite.animationSpeed = 0.1;
    sprite.anchor.set(0.5);
    sprite.play();

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
            object.x = Math.max(10, Math.min(screen.width - 10, object.x));
            object.y = Math.max(10, Math.min(screen.height - 10, object.y));

            for (const enemy of xfind('enemy')) {
                if (enemy.distance(object) < 15) {
                    enemy.clash();
                    node.finalize();
                }
            }
            
            if (shot && stanby) {
                xnew(Bullet, { screen, scene, position: { x: object.x, y: object.y } });
                stanby = false;
                node.setTimer(200, () => { stanby = true; });
            }
        },
        finalize: () => {
            node.emit('#gameover');
        },
    };
}

function Bullet({ node, screen, scene, position }) {
    const object = bindObject(scene, new PIXI.Container());
    object.x = position.x;
    object.y = position.y;

    const graphics = object.addChild(new PIXI.Graphics());
    graphics.lineStyle(0);
    graphics.beginFill(0x22FFFF, 1);
    graphics.drawEllipse(0, 0, 2, 12);
    graphics.endFill();

    soundShot();

    return {
        update: () => {
            object.y -= 8;
            if (object.y < 0) node.finalize();
         
            for (const enemy of xfind('enemy')) {
                if (enemy.distance(object) < 15) {
                    enemy.clash();
                    node.finalize();
                    break;
                }
            }
        },
    };
}

function Enemy({ node, screen, scene }) {
    node.key = 'enemy';

    const object = bindObject(scene, new PIXI.Container());

    const texture = PIXI.Texture.from('01-texture.png');
    const textures = [
        new PIXI.Texture(texture, new PIXI.Rectangle(0, 32, 32, 32)),
        new PIXI.Texture(texture, new PIXI.Rectangle(32, 32, 32, 32)),
        new PIXI.Texture(texture, new PIXI.Rectangle(64, 32, 32, 32)),
    ];

    const sprite = new PIXI.AnimatedSprite(textures);
    object.addChild(sprite);
    sprite.animationSpeed = 0.1;
    sprite.anchor.set(0.5);
    sprite.play();

    const x = Math.random() * screen.width;
    object.x = x
    object.y = 0;

    const v = Math.random() * 2 + 1;
    const a = Math.random() * (Math.PI / 2) + Math.PI / 4;
    const velocity = { x: v * Math.cos(a), y: v * Math.sin(a)};

    return {
        update: () => {
            if (object.x < 10) velocity.x = +Math.abs(velocity.x);
            if (object.x >= screen.width - 10) velocity.x = -Math.abs(velocity.x);
            if (object.y < 10) velocity.y = +Math.abs(velocity.y);
            if (object.y >= screen.height - 10) velocity.y = -Math.abs(velocity.y);

            object.x += velocity.x;
            object.y += velocity.y;
        },
        clash: (value = 1) => {
            soundClash(value);
            const position = { x: object.x, y: object.y };
            for(let i = 0; i < 4; i++) {
                xnew(node.parent, Star, { screen, scene, position, value });
            }
            xnew(node.parent, ScoreUp, { screen, scene, position, value });

            node.finalize();
        },
        distance: (target) => {
            const dx = target.x - object.x;
            const dy = target.y - object.y;
            return distance = Math.sqrt(dx * dx + dy * dy);
        },
    };
}

function Star({ node, screen, scene, position, value = 1 }) {
    const object = bindObject(scene, new PIXI.Container());
    object.x = position.x;
    object.y = position.y;

    const sprite = new PIXI.Sprite();
    sprite.texture = new PIXI.Texture(PIXI.Texture.from('01-texture.png'), new PIXI.Rectangle(0, 64, 32, 32));
    sprite.anchor.set(0.5);
    object.addChild(sprite);

    const v = Math.random() * 3;
    const a = Math.random() * 2 * Math.PI;
    const velocity = { x: v * Math.cos(a), y: v * Math.sin(a)};

    node.setTimer(800, () => node.finalize());

    let counter = 0;
    return {
        update: () => {
            object.x += velocity.x;
            object.y += velocity.y;
            object.rotation = counter++ / 10;

            for (const enemy of xfind('enemy')) {
                if (enemy.distance(object) < 15) {
                    enemy.clash(value * 2);
                    node.finalize();
                    break;
                }
            }
        },
    };
}

function ScoreUp({ node, screen, scene, position, value = 1 }) {
    const text = bindObject(scene, new PIXI.Text(`+ ${value}`, { fontSize: 16, fill: '#FFFF22' }));
    text.x = position.x;
    text.y = position.y;
    text.anchor.set(0.5);

    node.emit('#scoreup', value);
    node.setTimer(1000, () => node.finalize());

    let counter = 0;
    return {
        update: () => {
            text.y = position.y - 50 * Math.exp(-counter / 20) * Math.abs(Math.sin(Math.PI * (counter * 10) / 180)); 
            counter++;
        },
    }
}

function Score({ node, screen, scene }) {
    let sum = 0;

    const score = bindObject(scene, new PIXI.Text(`score ${sum}`, { fontSize: 16, fill: '#FFFF22' }));
    score.x = screen.width;
    score.y = 0;
    score.anchor.set(1.0, 0.0);

    node.on('#scoreup', (value) => {
        score.text = `score ${sum += value}`;
    });
}

function soundShot() {
    xutil.audio.create({ frequency: 1000, type: 'square', volume: 0.1, envelope: { attack: 0.1, decay: 0.1, sustain: 0.1, release: 0.3 }, pitchBend: [-1000] }).play(0.0, 0.3);
}
function soundClash(value) {
    xutil.audio.create({ frequency:  700 + value, type: 'triangle', volume: 0.10, envelope: { attack: 0.0, decay: 0.1, sustain: 0.1, release: 0.1 } }).play(0.0, 0);
    xutil.audio.create({ frequency:  900 + value, type: 'triangle', volume: 0.07, envelope: { attack: 0.0, decay: 0.1, sustain: 0.1, release: 0.1 } }).play(0.1, 0);
    xutil.audio.create({ frequency: 1100 + value, type: 'triangle', volume: 0.05, envelope: { attack: 0.0, decay: 0.1, sustain: 0.1, release: 0.1 } }).play(0.2, 0);
}

function bindObject(parent, object) {
    parent.addChild(object);

    xnew(() => {
        return {
            finalize: () => parent.removeChild(object)
        }
    });
    return object;
}
