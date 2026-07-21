import {
    Camera, EventTouch, Graphics, Mask, Node, Tween, UITransform, Vec2, Vec3, tween,
} from 'cc';
import {
    AUX_LINE_COLOR, CELL_SIZE, MOVE_SPEED,
    PANEL_WHITE, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN,
} from '../config/GameConst';
import { LevelDef } from '../config/LevelData';
import { ArrowEntity } from './ArrowEntity';
import { ArrowFactory } from './ArrowFactory';

export type BoardCallbacks = {
    onBlocked: (arrow: ArrowEntity) => void;
    onCleared: (arrow: ArrowEntity) => void;
    onBoardEmpty: () => void;
};

const PANEL_SIZE = 640;
const PANEL_HALF = 310;

/**
 * 棋盘：白底 + Mask 裁剪；整段箭头沿朝向平滑滑出；点击取最近箭头。
 */
export class BoardController {
    readonly root: Node;
    readonly panel: Node;
    readonly content: Node;

    private _maskNode: Node;
    private _arrows: ArrowEntity[] = [];
    private _level: LevelDef | null = null;
    private _originX = 0;
    private _originY = 0;
    private _cellSize = CELL_SIZE;
    private _callbacks: BoardCallbacks;
    private _auxOn = false;
    private _auxG: Graphics | null = null;
    private _auxNode: Node | null = null;
    private _arrowLayer: Node;
    private _zoom = ZOOM_DEFAULT;
    private _inputBound = false;
    private _touchMoved = false;
    private _touchStart = new Vec2();
    private _disposed = false;

    constructor(parent: Node, callbacks: BoardCallbacks) {
        this._callbacks = callbacks;

        this.root = new Node('BoardRoot');
        parent.addChild(this.root);
        this.root.addComponent(UITransform).setContentSize(PANEL_SIZE, PANEL_SIZE);

        this.panel = new Node('BoardPanel');
        this.root.addChild(this.panel);
        this.panel.addComponent(UITransform).setContentSize(PANEL_SIZE, PANEL_SIZE);
        const panelG = this.panel.addComponent(Graphics);
        panelG.fillColor = PANEL_WHITE;
        panelG.roundRect(-PANEL_SIZE * 0.5, -PANEL_SIZE * 0.5, PANEL_SIZE, PANEL_SIZE, 24);
        panelG.fill();

        this._maskNode = new Node('BoardMask');
        this.panel.addChild(this._maskNode);
        this._maskNode.addComponent(UITransform).setContentSize(PANEL_SIZE - 8, PANEL_SIZE - 8);
        const mask = this._maskNode.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_RECT;

        this.content = new Node('Content');
        this._maskNode.addChild(this.content);
        this.content.addComponent(UITransform).setContentSize(PANEL_SIZE, PANEL_SIZE);
        this.content.setScale(this._zoom, this._zoom, 1);

        // 辅助线层在下，箭头层在上（避免虚线挡箭头）
        const auxNode = new Node('AuxLines');
        this.content.addChild(auxNode);
        this._auxG = auxNode.addComponent(Graphics);
        this._auxNode = auxNode;

        this._arrowLayer = new Node('ArrowLayer');
        this.content.addChild(this._arrowLayer);
        this._arrowLayer.addComponent(UITransform).setContentSize(PANEL_SIZE, PANEL_SIZE);
    }

    get zoom(): number { return this._zoom; }
    get arrows(): ArrowEntity[] { return this._arrows; }

    setAux(on: boolean): void {
        this._auxOn = on;
        this._drawAux();
    }

    toggleAux(): boolean {
        this._auxOn = !this._auxOn;
        this._drawAux();
        return this._auxOn;
    }

    setZoom(z: number): void {
        this._zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
        if (this.content && this.content.isValid) {
            this.content.setScale(this._zoom, this._zoom, 1);
            this.content.setPosition(0, 0, 0);
        }
    }

    loadLevel(level: LevelDef): void {
        this.clear();
        this._level = level;
        // 自适应格子：大关卡仍装进白框
        const fit = Math.floor(Math.min(560 / level.cols, 560 / level.rows));
        this._cellSize = Math.max(16, Math.min(CELL_SIZE, fit));
        const w = level.cols * this._cellSize;
        const h = level.rows * this._cellSize;
        this._originX = -w * 0.5;
        this._originY = -h * 0.5;

        if (this._auxNode) this._auxNode.setSiblingIndex(0);
        this._arrowLayer.setSiblingIndex(1);

        level.arrows.forEach((def, i) => {
            const arrow = ArrowFactory.create(i, def, this._arrowLayer);
            arrow.setCellSize(this._cellSize);
            arrow.redrawWithOrigin(this._originX, this._originY);
            this._arrows.push(arrow);
        });

        this.content.setPosition(0, 0, 0);
        this.setZoom(ZOOM_DEFAULT);
        this._drawAux();
        this._bindInput();
    }

    clear(): void {
        this._arrows.forEach((a) => {
            if (a.node?.isValid) Tween.stopAllByTarget(a.node);
            a.destroy();
        });
        this._arrows = [];
        if (this._auxG) this._auxG.clear();
    }

    /** 滑出结束后从棋盘移除并销毁箭头节点 */
    private _removeArrow(arrow: ArrowEntity): void {
        if (arrow.node?.isValid) {
            Tween.stopAllByTarget(arrow.node);
        }
        arrow.moving = false;
        const idx = this._arrows.indexOf(arrow);
        if (idx >= 0) this._arrows.splice(idx, 1);
        arrow.destroy();
        this._drawAux();
    }

    hintMovable(): ArrowEntity | null {
        this._arrows.forEach((a) => a.setHint(false));
        const target = this._arrows.find((a) => !a.isMoving && this.isPathClear(a));
        if (target) target.setHint(true);
        this._drawAux();
        return target ?? null;
    }

    clearHints(): void {
        this._arrows.forEach((a) => a.setHint(false));
    }

    isPathClear(arrow: ArrowEntity): boolean {
        if (!this._level) return false;
        const d = arrow.delta;
        let x = arrow.head.x + d.x;
        let y = arrow.head.y + d.y;
        const guard = this._level.cols + this._level.rows + 2;
        for (let i = 0; i < guard; i++) {
            if (x < 0 || y < 0 || x >= this._level.cols || y >= this._level.rows) {
                return true;
            }
            if (this._isOccupiedByOthers(x, y, arrow.id)) {
                return false;
            }
            x += d.x;
            y += d.y;
        }
        return true;
    }

    private _isOccupiedByOthers(x: number, y: number, selfId: number): boolean {
        for (const a of this._arrows) {
            if (a.id === selfId || a.isMoving) continue;
            if (a.occupies(x, y)) return true;
        }
        return false;
    }

    private _bindInput(): void {
        if (this._inputBound || !this.panel || !this.panel.isValid) return;
        this._inputBound = true;
        this.panel.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.panel.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.panel.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.panel.on(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    private _unbindInput(): void {
        if (!this._inputBound) return;
        this._inputBound = false;
        if (this.panel && this.panel.isValid) {
            this.panel.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
            this.panel.off(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
            this.panel.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
            this.panel.off(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
        }
    }

    private _onTouchStart(e: EventTouch): void {
        this._touchMoved = false;
        e.getUILocation(this._touchStart);
    }

    private _onTouchMove(e: EventTouch): void {
        const cur = e.getUILocation();
        if (Math.abs(cur.x - this._touchStart.x) + Math.abs(cur.y - this._touchStart.y) > 12) {
            this._touchMoved = true;
        }
    }

    private _onTouchEnd(e: EventTouch): void {
        if (this._touchMoved || this._disposed) return;
        this._tryClick(e);
    }

    /**
     * 精确点选：在所有箭头中选「距离最近」且在阈值内的那个。
     * 修复：原先按创建顺序/格子命中，邻箭热区重叠时会点错并狂扣心。
     */
    private _tryClick(e: EventTouch): void {
        const local = this._eventToContentLocal(e);

        const cellX = Math.floor((local.x - this._originX) / this._cellSize);
        const cellY = Math.floor((local.y - this._originY) / this._cellSize);

        let best: ArrowEntity | null = null;
        let bestDist = Number.POSITIVE_INFINITY;

        for (const arrow of this._arrows) {
            if (arrow.isMoving) continue;
            const d = arrow.distanceToLocal(local);
            if (d < bestDist) {
                bestDist = d;
                best = arrow;
            }
        }

        // 格子精确命中优先（避免邻箭抢点）
        for (const arrow of this._arrows) {
            if (arrow.isMoving) continue;
            if (arrow.occupies(cellX, cellY)) {
                best = arrow;
                bestDist = 0;
                break;
            }
        }

        if (!best) return;
        if (bestDist > best.hitThreshold()) return;

        this._onArrowClicked(best);
    }

    private _eventToContentLocal(e: EventTouch): Vec2 {
        const uiLoc = e.getUILocation();
        const panelUI = this.panel.getComponent(UITransform)!;
        const localInPanel = new Vec3();
        panelUI.convertToNodeSpaceAR(new Vec3(uiLoc.x, uiLoc.y, 0), localInPanel);

        if (Math.abs(localInPanel.x) > 2000 || Math.abs(localInPanel.y) > 2000) {
            const cam = this._findUICamera();
            if (cam) {
                const screen = e.getLocation();
                const world = new Vec3();
                cam.screenToWorld(new Vec3(screen.x, screen.y, 0), world);
                this.panel.inverseTransformPoint(localInPanel, world);
            }
        }

        const z = this._zoom || 1;
        const cp = this.content.position;
        return new Vec2((localInPanel.x - cp.x) / z, (localInPanel.y - cp.y) / z);
    }

    private _findUICamera(): Camera | null {
        const scene = this.root?.scene;
        if (!scene) return null;
        return scene.getComponentInChildren(Camera);
    }

    private _onArrowClicked(arrow: ArrowEntity): void {
        this.clearHints();
        if (!this.isPathClear(arrow)) {
            arrow.setGrey(true);
            this._drawAux();
            this._callbacks.onBlocked(arrow);
            return;
        }
        this._startSlideOut(arrow);
    }

    /**
     * 沿朝向逐格滑出（网格步进 + 重绘）：
     * 整段占格每次 +dir，弯道外形不变，但运动轴始终是箭头朝向的直线（参考视频1）。
     * 不用节点整体 tween，避免弯箭头像「整块飞出去」。
     */
    private _startSlideOut(arrow: ArrowEntity): void {
        if (!this._level) return;
        arrow.moving = true;
        arrow.setGrey(false);
        // 滑出过程中不再占用阻挡（与规则一致：移动穿透）
        this._drawAux();

        const d = arrow.delta;
        const level = this._level;
        const stepSec = Math.max(0.035, this._cellSize / MOVE_SPEED);

        const doStep = () => {
            if (this._disposed || !arrow.node || !arrow.node.isValid) return;

            // 所有格子沿朝向平移一格
            for (const c of arrow.cells) {
                c.x += d.x;
                c.y += d.y;
            }

            // 仍在缓冲区内的保留；全部离开可视范围则消除
            const margin = level.cols + level.rows + 2;
            let w = 0;
            for (let i = 0; i < arrow.cells.length; i++) {
                const c = arrow.cells[i];
                if (
                    c.x >= -margin && c.y >= -margin &&
                    c.x < level.cols + margin && c.y < level.rows + margin
                ) {
                    arrow.cells[w++] = c;
                }
            }
            arrow.cells.length = w;

            const stillVisible = arrow.cells.some((c) =>
                c.x >= -1 && c.y >= -1 && c.x <= level.cols && c.y <= level.rows,
            );

            if (!stillVisible || arrow.cells.length === 0) {
                this._removeArrow(arrow);
                this._callbacks.onCleared(arrow);
                if (this._arrows.length === 0) {
                    this._callbacks.onBoardEmpty();
                }
                return;
            }

            arrow.redrawWithOrigin(this._originX, this._originY);
            this._drawAux();

            tween(arrow.node)
                .delay(stepSec)
                .call(doStep)
                .start();
        };

        doStep();
    }

    /**
     * 虚线辅助线：
     * - 画在箭头下层
     * - 截断到下一个阻挡格（或框边）
     * - 按箭头 id 错开虚线相位，避免同向重叠变成粗实线
     */
    private _drawAux(): void {
        const g = this._auxG;
        if (!g) return;
        g.clear();
        if (!this._auxOn || !this._level) return;

        if (this._auxNode && this._auxNode.isValid) this._auxNode.setSiblingIndex(0);
        if (this._arrowLayer && this._arrowLayer.isValid) this._arrowLayer.setSiblingIndex(1);

        g.strokeColor = AUX_LINE_COLOR;
        g.lineWidth = 1.5;
        const half = PANEL_HALF;
        const dash = 7;
        const gap = 7;

        for (const arrow of this._arrows) {
            if (arrow.isMoving || arrow.cells.length === 0) continue;
            const head = arrow.head;
            const d = arrow.delta;

            // 起点：箭头前方
            let sx = this._originX + (head.x + 0.5) * this._cellSize + d.x * this._cellSize * 0.55;
            let sy = this._originY + (head.y + 0.5) * this._cellSize + d.y * this._cellSize * 0.55;

            // 终点：框边，或第一个阻挡格的中心前
            let ex = sx;
            let ey = sy;
            let cx = head.x + d.x;
            let cy = head.y + d.y;
            let blocked = false;
            const guard = this._level.cols + this._level.rows + 2;
            for (let i = 0; i < guard; i++) {
                if (cx < 0 || cy < 0 || cx >= this._level.cols || cy >= this._level.rows) {
                    const edge = this._rayToPanelEdge(sx, sy, d.x, d.y, half);
                    if (edge) { ex = edge.x; ey = edge.y; }
                    break;
                }
                if (this._isOccupiedByOthers(cx, cy, arrow.id)) {
                    // 停在阻挡格外侧
                    ex = this._originX + (cx + 0.5) * this._cellSize - d.x * this._cellSize * 0.5;
                    ey = this._originY + (cy + 0.5) * this._cellSize - d.y * this._cellSize * 0.5;
                    blocked = true;
                    break;
                }
                cx += d.x;
                cy += d.y;
            }
            if (!blocked && (ex === sx && ey === sy)) {
                const edge = this._rayToPanelEdge(sx, sy, d.x, d.y, half);
                if (edge) { ex = edge.x; ey = edge.y; }
            }

            const total = Math.hypot(ex - sx, ey - sy);
            if (total < 2) continue;
            const ux = (ex - sx) / total;
            const uy = (ey - sy) / total;

            // 相位错开，同向重叠不会叠成粗实线
            const phase = ((arrow.id * 5) % (dash + gap));
            let t = phase;
            // 若相位落在 gap 内，跳到下一段 dash
            if (t > dash) t = t - gap;
            if (t < 0) t = 0;

            while (t < total) {
                const t2 = Math.min(total, t + dash);
                if (t2 > t) {
                    g.moveTo(sx + ux * t, sy + uy * t);
                    g.lineTo(sx + ux * t2, sy + uy * t2);
                    g.stroke();
                }
                t = t2 + gap;
            }
        }
    }

    private _rayToPanelEdge(x: number, y: number, dx: number, dy: number, half: number): { x: number; y: number } | null {
        if (dx === 0 && dy === 0) return null;
        let t = Infinity;
        if (dx > 0) t = Math.min(t, (half - x) / dx);
        if (dx < 0) t = Math.min(t, (-half - x) / dx);
        if (dy > 0) t = Math.min(t, (half - y) / dy);
        if (dy < 0) t = Math.min(t, (-half - y) / dy);
        if (!isFinite(t) || t < 0) return null;
        t = Math.max(0, t - 2);
        return { x: x + dx * t, y: y + dy * t };
    }

    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;
        try { this._unbindInput(); } catch (e) { console.warn('[Board] unbind', e); }
        try { this.clear(); } catch (e) { console.warn('[Board] clear', e); }
        try {
            if (this.root && this.root.isValid) this.root.destroy();
        } catch (e) { console.warn('[Board] destroy', e); }
    }
}

