
document.addEventListener('DOMContentLoaded', function() {
    xnew(function () {
        xnew(Input);
        xnew(Main);
    });
});

function Input() {
    if (xnex.device.isMobile()) {
        const stick = xnew({ style: 'position: absolute; left: 0px; bottom: 0px; z-index: 10;' }, xnex.AnalogStick, { size: 160 });
        const button = xnew({ style: 'position: absolute; right: 20px; bottom: 20px; z-index: 10;' }, xnex.CircleButton);

        stick.on('analogstickstart analogstickmove', (event, ex) => {
            stick.emit('#move', { vector: ex.vector });
        });
    } else {
        const keyboard = xnew(xnex.Keyboard);
        
        keyboard.on('keydown', (event, ex) => {
            if (event.repeat) return;
            const list = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
            if (list.includes(event.key)) {
                const x = (ex.keys[list[0]] ? -1 : 0) + (ex.keys[list[1]] ? +1 : 0);
                const y = (ex.keys[list[2]] ? -1 : 0) + (ex.keys[list[3]] ? +1 : 0);
                win.emit('#move', { vector: { x, y } });
            }
        });
    }
}

function Main() {
    const [width, height] = [800, 600];

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


function Title({ scene }) {
    this.nest({ tag: 'div', style: 'position: absolute; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;' });
    const text = xnew({ style: 'font-size: 30px; cursor: pointer;' }, 'start');
    
    this.on('click', () => {
        xnew(this.parent, Game, { scene })
        this.finalize();
    })
}

function Game({ scene }) {
    const container = scene.addChild(new PIXI.Container());

    const object = container.addChild(new PIXI.Container());
    const graphics = object.addChild(new PIXI.Graphics());
    graphics.beginFill(0xEA1E63);
    graphics.drawRect(-100, -100, 200, 200);
    graphics.endFill();
   
    Player
    return {
        animate: () => {
            object.rotation += 0.01;
        },
        finalize: () => {
            scene.removeChild(object);
        },
    };
}

function Player({}) {

}