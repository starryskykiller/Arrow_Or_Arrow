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
 * 棋盘：白底 + Mask 裁剪；箭头沿自身折线路径蛇行滑出；点击取最近箭头。
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
            Tween.stopAllByTarget(a);
            if (a.node?.isValid) Tween.stopAllByTarget(a.node);
            a.destroy();
        });
        this._arrows = [];
        if (this._auxG) this._auxG.clear();
    }

    /** 滑出结束后从棋盘移除并销毁箭头节点 */
    private _removeArrow(arrow: ArrowEntity): void {
        Tween.stopAllByTarget(arrow);
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
     * 沿自身折线路径蛇行滑出（对齐参考视频1）：
     * - 头沿朝向直线延伸离开棋盘
     * - 身/尾跟随原折线轨道前进（弯折点留在原地，箭头「流过」弯道）
     * - 外形逐渐被拉直到朝向直线上，而不是整段刚体平移
     */
    private _startSlideOut(arrow: ArrowEntity): void {
        if (!this._level) return;
        arrow.moving = true;
        arrow.setGrey(false);

        const d = arrow.delta;
        const cs = this._cellSize;
        const ox = this._originX;
        const oy = this._originY;
        const toPt = (c: { x: number; y: number }) => ({
            x: ox + (c.x + 0.5) * cs,
            y: oy + (c.y + 0.5) * cs,
        });

        // 轨道 = 原折线（尾→头）+ 沿朝向延伸足够远
        const path: { x: number; y: number }[] = arrow.cells.map((c) => toPt(c));
        const headCell = arrow.cells[arrow.cells.length - 1];
        const bodyCells = arrow.cells.length;
        const extend = this._level.cols + this._level.rows + bodyCells + 6;
        for (let i = 1; i <= extend; i++) {
            path.push(toPt({ x: headCell.x + d.x * i, y: headCell.y + d.y * i }));
        }

        // 滑出后不再占格阻挡
        arrow.cells = [];
        this._drawAux();

        const cum: number[] = [0];
        for (let i = 1; i < path.length; i++) {
            cum.push(
                cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y),
            );
        }
        const bodyLen = cum[bodyCells - 1];
        // 只需滑到整段离开白框即可，避免拖太久
        const headPt = path[bodyCells - 1];
        const half = PANEL_HALF + cs;
        let clearAlong = bodyLen + cs * 2;
        if (d.x > 0) clearAlong = (half - headPt.x) + bodyLen + cs;
        else if (d.x < 0) clearAlong = (headPt.x + half) + bodyLen + cs;
        else if (d.y > 0) clearAlong = (half - headPt.y) + bodyLen + cs;
        else if (d.y < 0) clearAlong = (headPt.y + half) + bodyLen + cs;
        const maxTravel = cum[cum.length - 1] - bodyLen;
        const travel = Math.max(cs, Math.min(maxTravel, clearAlong));
        const duration = travel / MOVE_SPEED;

        const sampleAt = (dist: number): { x: number; y: number } => {
            const clamped = Math.max(0, Math.min(cum[cum.length - 1], dist));
            let i = 1;
            while (i < cum.length && cum[i] < clamped) i++;
            const i0 = i - 1;
            const i1 = Math.min(path.length - 1, i);
            const seg = cum[i1] - cum[i0];
            const t = seg > 1e-6 ? (clamped - cum[i0]) / seg : 0;
            return {
                x: path[i0].x + (path[i1].x - path[i0].x) * t,
                y: path[i0].y + (path[i1].y - path[i0].y) * t,
            };
        };

        const sampleBody = (headDist: number): { x: number; y: number }[] => {
            const steps = Math.max(12, bodyCells * 5);
            const pts: { x: number; y: number }[] = [];
            for (let i = 0; i <= steps; i++) {
                const dist = headDist - bodyLen + (bodyLen * i) / steps;
                if (dist >= 0) pts.push(sampleAt(dist));
            }
            return pts.length >= 2 ? pts : [sampleAt(headDist), sampleAt(headDist)];
        };

        const finish = () => {
            if (this._disposed) return;
            this._removeArrow(arrow);
            this._callbacks.onCleared(arrow);
            if (this._arrows.length === 0) {
                this._callbacks.onBoardEmpty();
            }
        };

        if (!arrow.node || !arrow.node.isValid) {
            finish();
            return;
        }

        arrow.slideT = 0;
        const updateDraw = () => {
            if (this._disposed || !arrow.node || !arrow.node.isValid) return;
            const headDist = bodyLen + travel * arrow.slideT;
            arrow.redrawPolyline(sampleBody(headDist));
        };
        updateDraw();

        tween(arrow)
            .to(duration, { slideT: 1 }, {
                onUpdate: updateDraw,
            })
            .call(finish)
            .start();
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

