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
    const text = new PIXI.Text('touch start', { fill: '#FFFFFF' });
    text.x = screen.width / 2;
    text.y = screen.height / 2;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    stage.addChild(text);

    node.on('click keydown', () => {
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
        node.setTimer(1000, () => {
            node.on('click keydown', () => {
                xnew(node.parent, Title, { screen, stage })
                node.finalize();
            })
        });
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

    const texture = PIXI.Texture.from('01-texture.png');
    const sprite = new PIXI.AnimatedSprite([new PIXI.Texture(texture, new PIXI.Rectangle(0, 0, 32, 32)), new PIXI.Texture(texture, new PIXI.Rectangle(32, 0, 32, 32))]);
    object.addChild(sprite);
    sprite.animationSpeed = 0.01;
    sprite.play();
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
            object.x = Math.max(10, Math.min(screen.width - 10, object.x));
            object.y = Math.max(10, Math.min(screen.height - 10, object.y));

            for (const enemy of xfind('enemy')) {
                const dx = node.object.x - enemy.object.x;
                const dy = node.object.y - enemy.object.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 15) {
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
    graphics.beginFill(0x22FFFF, 1);
    graphics.drawEllipse(0, 0, 2, 12);
    graphics.endFill();

    return {
        start: () => {
            seShot();
        },
        update: () => {
            object.y -= 8;
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
    const texture = PIXI.Texture.from('01-texture.png');
    const textures = [
        new PIXI.Texture(texture, new PIXI.Rectangle(0, 32, 32, 32)),
        new PIXI.Texture(texture, new PIXI.Rectangle(32, 32, 32, 32)),
        new PIXI.Texture(texture, new PIXI.Rectangle(64, 32, 32, 32)),
    ];
    sprite.texture = textures[0];
    let counter = 0;
    node.setTimer(100, () => {
        sprite.texture = textures[counter++ % 3];
    }, true);

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
            seClash(value);
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
    sprite.texture = new PIXI.Texture(PIXI.Texture.from('01-texture.png'), new PIXI.Rectangle(0, 64, 32, 32));
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
    text.y = position.y;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    node.emit('#scoreup', value);
    scene.addChild(text);
    node.setTimer(1000, () => node.finalize());

    let counter = 0;
    return {
        update: () => {
            text.y = position.y - 50 * Math.exp(-counter / 20) * Math.abs(Math.sin(Math.PI * (counter * 10) / 180)); 
            counter++;
        },
        finalize: () => {
            scene.removeChild(text);
        }
    }
}

function Score({ node, screen, scene }) {
    let score = 0;

    const scoreText = new PIXI.Text(`score ${score}`, { fontSize: 16, fill: '#FFFF22' });
    scoreText.x = screen.width;
    scoreText.y = 0;
    scoreText.pivot.x = scoreText.width;
    scoreText.pivot.y = 0;
    scene.addChild(scoreText);

    node.on('#scoreup', (value) => {
        scoreText.text = `score ${score += value}`;
        scoreText.pivot.x = scoreText.width;
    });
}

// waveform 'sine', 'triangle', 'square', 'sawtooth'
function soundEffect({ frequency, waveform = 'sine', volume = 0.2, atack = 0.0, decay = 0.2, pitchBelnd = 0, offset = 0.0 }) {
    const oscillatorNode = new Tone.Oscillator(frequency, waveform);
    const volumeNode = new Tone.Gain(0.0).toDestination();
    oscillatorNode.connect(volumeNode);

    const start = Tone.now() + offset;
    volumeNode.gain.linearRampToValueAtTime(volume, start + atack);
    volumeNode.gain.linearRampToValueAtTime(0.0, start + atack + decay);

    oscillatorNode.frequency.linearRampToValueAtTime(Math.max(10, oscillatorNode.frequency.value + pitchBelnd), start + atack + decay);
    oscillatorNode.start(start).stop(start + atack + decay);
}

function seShot() {
    soundEffect({ frequency: 1500, waveform: 'triangle', volume: 0.1, decay: 0.2, pitchBelnd: -1000 });
}
function seClash(value) {
    
    soundEffect({ frequency: 580 + value, waveform: 'triangle', volume: 0.1, decay: 0.10, pitchBelnd: 0 });
    soundEffect({ frequency: 1080 + value, waveform: 'triangle', volume: 0.07, decay: 0.20, pitchBelnd: 0, offset: 0.05 });
    soundEffect({ frequency: 1280 + value, waveform: 'triangle', volume: 0.05, decay: 0.20, pitchBelnd: 0, offset: 0.1 });
}