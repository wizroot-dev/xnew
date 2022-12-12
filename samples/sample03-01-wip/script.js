
document.addEventListener('DOMContentLoaded', function() {
    xnew(Main);
});

function Main() {
    const [width, height] = [800, 600];

    xnew(Input);

    xnew(xnex.Screen, { width, height }, function () {
        const renderer = PIXI.autoDetectRenderer({ view: this.canvas, width, height, background: '#000000', backgroundAlpha: 0.1 });
        const scene = new PIXI.Container();
        xnew(Title, { scene, width, height });

        return {
            animate: () => {
                renderer.render(scene)
            },
        };
    });
}

function Input() {
    if (navigator.userAgent.match(/iPhone|iPad|Android.+Mobile/)) {
        const stick = xnew({ style: 'position: absolute; left: 0px; bottom: 0px; z-index: 10;' }, xnex.AnalogStick, { size: 160 });
        const button = xnew({ style: 'position: absolute; right: 20px; bottom: 20px; z-index: 10;' }, xnex.CircleButton);

        stick.on('stickstart stickmove', (event, ex) => {
            stick.emit('#move', { vector: ex.vector });
        });
    } else {
        const win = xnew(window);
        const keys = {};
        win.on('keydown', (event) => {
            keys[event.key] = 1;
            keyChange();
        });
        win.on('keyup', (event) => {
            keys[event.key] = 0;
            keyChange();
        });
        
        function keyChange() {
            const x = (keys['ArrowLeft'] ? -1 : 0) + (keys['ArrowRight'] ? +1 : 0);
            const y = (keys['ArrowUp'] ? -1 : 0) + (keys['ArrowDown'] ? +1 : 0);
            win.emit('#move', { vector: { x, y } });
        }
    }
}
function Title({ scene, width, height }) {
    // this.nest({ tag: 'div', style: 'position: absolute; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;' });
    // const text = xnew({ style: 'font-size: 30px; cursor: pointer;' }, 'start');
    
    const style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 36,
        fontStyle: 'italic',
        fontWeight: 'bold',
        fill: ['#ffffff', '#00ff99'], // gradient
        stroke: '#4a1850',
        strokeThickness: 5,
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowBlur: 4,
        dropShadowAngle: Math.PI / 6,
        dropShadowDistance: 6,
        wordWrap: true,
        wordWrapWidth: 440,
        lineJoin: 'round',
    });
    
    const text = new PIXI.Text('touch start', style);
    text.x = width / 2;
    text.y = height / 2;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    scene.addChild(text);

    this.on('click', () => {
        xnew(this.parent, Game, { scene, width, height })
        this.finalize();
    })
    return {
        finalize: () => {
            scene.removeChild(text);
        }
    }
}

function Game({ scene, width, height }) {
    const container = scene.addChild(new PIXI.Container());
    
    const player = xnew(Player, { container, width, height });

    let delay = 100;

    const addEnemy = () => {
        const enemy = xnew(Enemy, { container, width, height, player });
        //this.callback(addEnemy, delay, 1);
    }
    addEnemy();

    this.on('#gameover', () => {
        xnew(this.parent, GameOver, { scene, width, height })
        this.finalize();
    });

    return {
        animate: () => {
        },
        finalize: () => {
            scene.removeChild(object);
        },
    };
}
function GameOver({ scene, width, height }) {
    
  
    const style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 36,
        fontStyle: 'italic',
        fontWeight: 'bold',
        fill: ['#ffffff', '#00ff99'], // gradient
        stroke: '#4a1850',
        strokeThickness: 5,
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowBlur: 4,
        dropShadowAngle: Math.PI / 6,
        dropShadowDistance: 6,
        wordWrap: true,
        wordWrapWidth: 440,
        lineJoin: 'round',
    });
    
    const text = new PIXI.Text('game over', style);
    text.x = width / 2;
    text.y = height / 2;
    text.pivot.x = text.width / 2;
    text.pivot.y = text.height / 2;

    scene.addChild(text);

    this.on('click', () => {
        xnew(this.parent, Title, { scene, width, height })
        this.finalize();
    })
    return {
        finalize: () => {
            scene.removeChild(text);
        }
    }
}

function Player({ container, width, height }) {

    const object = container.addChild(new PIXI.Container());
    const graphics = object.addChild(new PIXI.Graphics());
    graphics.beginFill(0xEA1E63);
    graphics.drawRect(-10, -10, 20, 20);
    graphics.endFill();

    object.x = width / 2;
    object.y = height / 2;

    let velocity = { x: 0, y: 0 };
    this.on('#move', ({ vector }) => {
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

function Enemy({ container, width, height, player }) {

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
                this.finalize();
            }
        },
        finalize: () => {
            container.removeChild(object);
        },
    };
}