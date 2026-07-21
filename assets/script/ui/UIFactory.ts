import {
    Button, Color, Graphics, Label, Node, Sprite, SpriteFrame,
    UITransform, Widget, resources, BlockInputEvents,
} from 'cc';

export function createNode(name: string, parent?: Node, w = 100, h = 100): Node {
    const n = new Node(name);
    if (parent) parent.addChild(n);
    n.addComponent(UITransform).setContentSize(w, h);
    return n;
}

export function addWidget(node: Node, flags: number, opts: Partial<{
    left: number; right: number; top: number; bottom: number;
    horizontalCenter: number; verticalCenter: number;
}> = {}): Widget {
    const w = node.getComponent(Widget) || node.addComponent(Widget);
    w.alignFlags = flags;
    if (opts.left !== undefined) w.left = opts.left;
    if (opts.right !== undefined) w.right = opts.right;
    if (opts.top !== undefined) w.top = opts.top;
    if (opts.bottom !== undefined) w.bottom = opts.bottom;
    if (opts.horizontalCenter !== undefined) w.horizontalCenter = opts.horizontalCenter;
    if (opts.verticalCenter !== undefined) w.verticalCenter = opts.verticalCenter;
    w.updateAlignment();
    return w;
}

export function drawFill(node: Node, color: Color, w: number, h: number, radius = 0): Graphics {
    const g = node.getComponent(Graphics) || node.addComponent(Graphics);
    g.clear();
    g.fillColor = color;
    if (radius > 0) g.roundRect(-w * 0.5, -h * 0.5, w, h, radius);
    else g.rect(-w * 0.5, -h * 0.5, w, h);
    g.fill();
    return g;
}

export function makeLabel(parent: Node, text: string, fontSize = 28, color = Color.BLACK, name = 'Label'): Label {
    const n = createNode(name, parent, 200, fontSize + 10);
    const label = n.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.NONE;
    return label;
}

export function makeButton(parent: Node, name: string, w: number, h: number, onClick: () => void): Node {
    const n = createNode(name, parent, w, h);
    const btn = n.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 0.95;
    n.on(Button.EventType.CLICK, onClick);
    return n;
}

export function loadSpriteFrame(path: string): Promise<SpriteFrame | null> {
    return new Promise((resolve) => {
        resources.load(path + '/spriteFrame', SpriteFrame, (err, sf) => {
            if (!err && sf) {
                resolve(sf);
                return;
            }
            resources.load(path, SpriteFrame, (err2, sf2) => {
                resolve(err2 ? null : sf2);
            });
        });
    });
}

export async function makeSprite(parent: Node, path: string, w: number, h: number, name = 'Sprite'): Promise<Node> {
    const n = createNode(name, parent, w, h);
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    n.getComponent(UITransform)!.setContentSize(w, h);
    const sf = await loadSpriteFrame(path);
    if (sf) sp.spriteFrame = sf;
    return n;
}

export function makeOverlay(parent: Node, onBlock = true): Node {
    const n = createNode('Overlay', parent, 720, 1280);
    drawFill(n, new Color(0, 0, 0, 160), 720, 1280);
    if (onBlock) n.addComponent(BlockInputEvents);
    const w = n.addComponent(Widget);
    w.alignFlags = 45;
    w.left = w.right = w.top = w.bottom = 0;
    return n;
}

export function formatTime(sec: number): string {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}
