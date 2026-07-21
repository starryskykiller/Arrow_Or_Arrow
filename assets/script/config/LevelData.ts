import { PACKED_LEVELS } from './LevelPack';

/** 格子坐标，原点在棋盘左下，x 向右，y 向上 */
export type Cell = { x: number; y: number };

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface ArrowDef {
    /** 从尾到头的连续格子（相邻正交），最后一个为箭头头部 */
    cells: Cell[];
}

export interface LevelDef {
    id: number;
    cols: number;
    rows: number;
    arrows: ArrowDef[];
}

export function dirFromCells(cells: Cell[]): Dir {
    const a = cells[cells.length - 2];
    const b = cells[cells.length - 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 1) return 'right';
    if (dx === -1) return 'left';
    if (dy === 1) return 'up';
    return 'down';
}

export function dirToDelta(dir: Dir): Cell {
    switch (dir) {
        case 'up': return { x: 0, y: 1 };
        case 'down': return { x: 0, y: -1 };
        case 'left': return { x: -1, y: 0 };
        case 'right': return { x: 1, y: 0 };
    }
}

export function getLevelCount(): number {
    return PACKED_LEVELS.length;
}

export function getLevelDef(level: number): LevelDef {
    const idx = Math.min(PACKED_LEVELS.length - 1, Math.max(0, (level | 0) - 1));
    const base = PACKED_LEVELS[idx];
    return {
        id: level,
        cols: base.cols,
        rows: base.rows,
        arrows: base.arrows.map((a) => ({
            cells: a.cells.map((c) => ({ x: c.x, y: c.y })),
        })),
    };
}

/** 校验关卡格子不重叠（开发期自检） */
export function validateLevel(level: LevelDef): string[] {
    const errors: string[] = [];
    const occ = new Map<string, number>();
    level.arrows.forEach((arrow, ai) => {
        if (arrow.cells.length < 2) {
            errors.push(`arrow ${ai} too short`);
        }
        for (let i = 1; i < arrow.cells.length; i++) {
            const a = arrow.cells[i - 1];
            const b = arrow.cells[i];
            const manhattan = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
            if (manhattan !== 1) {
                errors.push(`arrow ${ai} cells not adjacent at ${i}`);
            }
        }
        arrow.cells.forEach((c) => {
            if (c.x < 0 || c.y < 0 || c.x >= level.cols || c.y >= level.rows) {
                errors.push(`arrow ${ai} out of board ${c.x},${c.y}`);
            }
            const key = `${c.x},${c.y}`;
            if (occ.has(key)) {
                errors.push(`overlap at ${key}: ${occ.get(key)} & ${ai}`);
            }
            occ.set(key, ai);
        });
    });
    return errors;
}
