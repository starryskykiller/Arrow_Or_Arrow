import { Color } from 'cc';

export const DESIGN_W = 720;
export const DESIGN_H = 1280;

export const MAX_HEARTS = 3;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
export const ZOOM_DEFAULT = 1.0;

/** 第 1 关 2 分钟，之后每 3 关 +1 分钟 */
export function getLevelTimeSeconds(level: number): number {
    const lv = Math.max(1, level | 0);
    return 120 + Math.floor((lv - 1) / 3) * 60;
}

export const ARROW_COLOR = new Color(28, 48, 96, 255);
export const ARROW_GREY = new Color(160, 168, 180, 255);
export const ARROW_HINT = new Color(46, 180, 120, 255);
export const AUX_LINE_COLOR = new Color(100, 170, 220, 160);

export const BG_BLUE = new Color(210, 230, 245, 255);
export const PANEL_WHITE = new Color(255, 255, 255, 255);

/** 格子与线宽（调细，避免视觉过粗、点击热区重叠） */
export const CELL_SIZE = 26;
export const LINE_WIDTH = 11;
/** 整段滑出速度（像素/秒） */
export const MOVE_SPEED = 780;
/** 点击命中半宽容差（不宜过大，否则会点到邻箭） */
export const HIT_PAD = 2;

export const STORAGE_LEVEL = 'aoa_level';
export const STORAGE_SOUND = 'aoa_sound';
