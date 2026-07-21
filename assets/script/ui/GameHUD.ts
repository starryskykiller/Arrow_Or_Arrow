import { Color, Label, Node, Sprite, UITransform } from 'cc';
import { BG_BLUE, DESIGN_H, DESIGN_W, MAX_HEARTS, ZOOM_MAX, ZOOM_MIN } from '../config/GameConst';
import {
    createNode, drawFill, formatTime, loadSpriteFrame, makeButton, makeLabel, makeSprite,
} from './UIFactory';

export type HudHandlers = {
    onSettings: () => void;
    onHint: () => void;
    onAux: () => void;
    onZoom: (z: number) => void;
};

/**
 * 主界面 HUD：顶栏（设置/关卡/心/计时）+ 底栏（提示/缩放/辅助线）
 * 风格贴近参考图浅蓝扁平 UI；缺图标处用 Graphics + 文字补齐。
 */
export class GameHUD {
    readonly root: Node;
    private _levelLabel: Label;
    private _timeLabel: Label;
    private _hearts: Node[] = [];
    private _zoomLabel: Label;
    private _zoom = 1;
    private _handlers: HudHandlers;

    constructor(parent: Node, handlers: HudHandlers) {
        this._handlers = handlers;
        this.root = createNode('HUD', parent, DESIGN_W, DESIGN_H);
        drawFill(this.root, BG_BLUE, DESIGN_W, DESIGN_H);

        // 顶栏背景条
        const topBar = createNode('TopBar', this.root, DESIGN_W, 180);
        topBar.setPosition(0, DESIGN_H * 0.5 - 90, 0);
        drawFill(topBar, new Color(200, 222, 240, 255), DESIGN_W, 180);

        // 设置按钮
        const settingsBtn = makeButton(topBar, 'SettingsBtn', 64, 64, () => this._handlers.onSettings());
        settingsBtn.setPosition(-DESIGN_W * 0.5 + 56, 30, 0);
        drawFill(settingsBtn, Color.WHITE, 64, 64, 14);
        makeLabel(settingsBtn, '设', 28, new Color(80, 100, 130));
        void this._tryIcon(settingsBtn, 'texture/btn_settings', 56, 56);

        // 关卡
        this._levelLabel = makeLabel(topBar, '关卡1', 34, new Color(40, 60, 90), 'LevelLabel');
        this._levelLabel.node.setPosition(0, 40, 0);

        // 心
        const heartsRow = createNode('Hearts', topBar, 200, 48);
        heartsRow.setPosition(0, 0, 0);
        for (let i = 0; i < MAX_HEARTS; i++) {
            const h = createNode(`H${i}`, heartsRow, 40, 40);
            h.setPosition((i - 1) * 48, 0, 0);
            drawFill(h, new Color(230, 70, 80, 255), 36, 32, 8);
            makeLabel(h, '♥', 26, Color.WHITE);
            this._hearts.push(h);
            void this._tryIcon(h, 'texture/heart', 40, 40, true);
        }

        // 计时
        this._timeLabel = makeLabel(topBar, '02:00', 26, new Color(60, 80, 110), 'TimeLabel');
        this._timeLabel.node.setPosition(0, -40, 0);

        // 底栏
        const botBar = createNode('BottomBar', this.root, DESIGN_W, 160);
        botBar.setPosition(0, -DESIGN_H * 0.5 + 80, 0);
        drawFill(botBar, new Color(200, 222, 240, 255), DESIGN_W, 160);

        // 提示
        const hintBtn = makeButton(botBar, 'HintBtn', 88, 88, () => this._handlers.onHint());
        hintBtn.setPosition(-220, 10, 0);
        drawFill(hintBtn, new Color(255, 200, 60, 255), 80, 80, 40);
        makeLabel(hintBtn, '提示', 22, new Color(90, 60, 10)).node.setPosition(0, -50, 0);

        // 缩放
        const zoomBox = createNode('ZoomBox', botBar, 280, 50);
        zoomBox.setPosition(0, 10, 0);
        drawFill(zoomBox, new Color(180, 205, 230, 255), 280, 40, 20);

        const zoomMinus = makeButton(zoomBox, 'Z-', 44, 44, () => this._changeZoom(-0.1));
        zoomMinus.setPosition(-110, 0, 0);
        makeLabel(zoomMinus, '－', 30, new Color(40, 70, 100));

        this._zoomLabel = makeLabel(zoomBox, '100%', 22, new Color(40, 70, 100), 'ZoomPct');
        this._zoomLabel.node.setPosition(0, 0, 0);

        const zoomPlus = makeButton(zoomBox, 'Z+', 44, 44, () => this._changeZoom(0.1));
        zoomPlus.setPosition(110, 0, 0);
        makeLabel(zoomPlus, '＋', 30, new Color(40, 70, 100));

        // 辅助线
        const auxBtn = makeButton(botBar, 'AuxBtn', 88, 88, () => this._handlers.onAux());
        auxBtn.setPosition(220, 10, 0);
        drawFill(auxBtn, new Color(70, 180, 170, 255), 80, 80, 40);
        makeLabel(auxBtn, '辅助线', 22, new Color(20, 70, 70)).node.setPosition(0, -50, 0);
    }

    private async _tryIcon(parent: Node, path: string, w: number, h: number, clearChildren = false): Promise<void> {
        const sf = await loadSpriteFrame(path);
        if (!sf) return;
        if (clearChildren) parent.removeAllChildren();
        const icon = createNode('Icon', parent, w, h);
        const sp = icon.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = sf;
        icon.getComponent(UITransform)!.setContentSize(w, h);
    }

    setLevel(level: number): void {
        this._levelLabel.string = `关卡${level}`;
    }

    setTime(sec: number): void {
        this._timeLabel.string = formatTime(sec);
    }

    setHearts(n: number): void {
        for (let i = 0; i < this._hearts.length; i++) {
            this._hearts[i].active = i < n;
        }
    }

    setZoomDisplay(z: number): void {
        this._zoom = z;
        this._zoomLabel.string = `${Math.round(z * 100)}%`;
    }

    private _changeZoom(delta: number): void {
        const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this._zoom + delta));
        this.setZoomDisplay(z);
        this._handlers.onZoom(z);
    }

    /** 棋盘挂载点（屏幕中央偏上） */
    getBoardSlot(): { x: number; y: number } {
        return { x: 0, y: 20 };
    }
}
