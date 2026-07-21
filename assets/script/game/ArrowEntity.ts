import { Graphics, Node, UITransform, Vec2, Vec3 } from 'cc';
import { ARROW_COLOR, ARROW_GREY, ARROW_HINT, CELL_SIZE, HIT_PAD } from '../config/GameConst';
import { ArrowDef, Cell, Dir, dirFromCells, dirToDelta } from '../config/LevelData';

/**
 * 箭头实体：折线通道 + 三角箭头头。
 * 移动时整段沿朝向平移滑出（与主流箭头消除玩法一致）。
 */
export class ArrowEntity {
    readonly id: number;
    /** 占格（可在滑出时整体平移） */
    cells: Cell[];
    private _facing: Dir;
    readonly node: Node;

    private _g: Graphics;
    private _grey = false;
    private _moving = false;
    private _hint = false;
    private _originX = 0;
    private _originY = 0;
    private _cellSize = CELL_SIZE;

    constructor(id: number, def: ArrowDef, parent: Node) {
        this.id = id;
        this.cells = def.cells.map((c) => ({ x: c.x, y: c.y }));
        this._facing = dirFromCells(this.cells);

        this.node = new Node(`Arrow_${id}`);
        parent.addChild(this.node);
        this.node.addComponent(UITransform).setContentSize(CELL_SIZE * 2, CELL_SIZE * 2);
        this._g = this.node.addComponent(Graphics);
    }

    setCellSize(size: number): void {
        this._cellSize = Math.max(12, size);
        const ui = this.node.getComponent(UITransform);
        if (ui) ui.setContentSize(this._cellSize * 2, this._cellSize * 2);
    }

    get isGrey(): boolean { return this._grey; }
    get isMoving(): boolean { return this._moving; }
    set moving(v: boolean) { this._moving = v; }

    get dir(): Dir { return this._facing; }

    get head(): Cell {
        return this.cells[this.cells.length - 1];
    }

    get delta(): Cell {
        return dirToDelta(this._facing);
    }

    cellToLocal(c: Cell): Vec3 {
        return new Vec3(
            this._originX + (c.x + 0.5) * this._cellSize,
            this._originY + (c.y + 0.5) * this._cellSize,
            0,
        );
    }

    setGrey(v: boolean): void {
        this._grey = v;
        this._hint = false;
        this.redraw();
    }

    setHint(v: boolean): void {
        this._hint = v;
        this.redraw();
    }

    occupies(x: number, y: number): boolean {
        return this.cells.some((c) => c.x === x && c.y === y);
    }

    /**
     * 到折线/箭头的最短距离（用于精确点选：选最近者，避免邻箭抢点）
     */
    distanceToLocal(local: Vec2): number {
        if (this._moving || this.cells.length === 0) return Number.POSITIVE_INFINITY;
        const pts = this.cells.map((c) => this.cellToLocal(c));
        let minD = Number.POSITIVE_INFINITY;
        for (let i = 1; i < pts.length; i++) {
            const d = distToSegment(local.x, local.y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
            if (d < minD) minD = d;
        }
        const head = pts[pts.length - 1];
        const tipD = Math.hypot(local.x - head.x, local.y - head.y);
        if (tipD < minD) minD = tipD;
        return minD;
    }

    /** 是否点中（配合全局「最近箭头」策略） */
    hitThreshold(): number {
        const lw = Math.max(8, this._cellSize * 0.42);
        return lw * 0.5 + HIT_PAD;
    }

    redrawWithOrigin(originX: number, originY: number): void {
        this._originX = originX;
        this._originY = originY;
        this.redraw();
    }

    redraw(): void {
        const g = this._g;
        g.clear();
        if (this.cells.length < 1) return;

        const lw = Math.max(8, this._cellSize * 0.42);
        const color = this._grey ? ARROW_GREY : (this._hint ? ARROW_HINT : ARROW_COLOR);
        g.lineWidth = lw;
        g.strokeColor = color;
        g.fillColor = color;

        const pts = this.cells.map((c) => ({
            x: this._originX + (c.x + 0.5) * this._cellSize,
            y: this._originY + (c.y + 0.5) * this._cellSize,
        }));

        const d = this.delta;
        const ux = d.x;
        const uy = d.y;

        if (pts.length >= 2) {
            const head = pts[pts.length - 1];
            const pullBack = lw * 0.55;
            const endX = head.x - ux * pullBack;
            const endY = head.y - uy * pullBack;

            g.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length - 1; i++) {
                g.lineTo(pts[i].x, pts[i].y);
            }
            g.lineTo(endX, endY);
            g.stroke();
        }

        const head = pts[pts.length - 1];
        const tipLen = lw * 1.45;
        const tipW = lw * 1.35;
        const px = -uy;
        const py = ux;
        const tipX = head.x + ux * (lw * 0.4);
        const tipY = head.y + uy * (lw * 0.4);
        const baseX = head.x - ux * tipLen * 0.55;
        const baseY = head.y - uy * tipLen * 0.55;

        g.moveTo(tipX, tipY);
        g.lineTo(baseX + px * tipW * 0.5, baseY + py * tipW * 0.5);
        g.lineTo(baseX - px * tipW * 0.5, baseY - py * tipW * 0.5);
        g.close();
        g.fill();
    }

    destroy(): void {
        if (this.node && this.node.isValid) {
            this.node.destroy();
        }
    }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
