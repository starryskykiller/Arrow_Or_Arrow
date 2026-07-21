/**
 * 关卡生成器（开发用）：逆向放置保证可解，偏折线，输出 LevelDef JSON。
 * 运行：node tools/gen_levels.js
 */
const fs = require('fs');
const path = require('path');

function key(x, y) { return `${x},${y}`; }

function neighbors(x, y) {
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
}

function inBoard(x, y, cols, rows) {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

/** 从空位长出一条折线 polyomino，尽量转弯 */
function growPolyomino(occ, cols, rows, maxLen, preferBend) {
  const empties = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!occ.has(key(x, y))) empties.push({ x, y });
    }
  }
  if (!empties.length) return null;

  // 随机起点
  const start = empties[(Math.random() * empties.length) | 0];
  const cells = [{ x: start.x, y: start.y }];
  occ.add(key(start.x, start.y));

  let lastDir = null;
  while (cells.length < maxLen) {
    const cur = cells[cells.length - 1];
    const opts = neighbors(cur.x, cur.y)
      .filter(([nx, ny]) => inBoard(nx, ny, cols, rows) && !occ.has(key(nx, ny)))
      .map(([nx, ny]) => ({ x: nx, y: ny, dx: nx - cur.x, dy: ny - cur.y }));
    if (!opts.length) break;

    let pick;
    if (preferBend && lastDir && opts.length > 1) {
      const bends = opts.filter((o) => o.dx !== lastDir.dx || o.dy !== lastDir.dy);
      const pool = bends.length ? bends : opts;
      pick = pool[(Math.random() * pool.length) | 0];
    } else {
      pick = opts[(Math.random() * opts.length) | 0];
    }
    cells.push({ x: pick.x, y: pick.y });
    occ.add(key(pick.x, pick.y));
    lastDir = { dx: pick.dx, dy: pick.dy };
  }

  if (cells.length < 2) {
    // 回滚
    cells.forEach((c) => occ.delete(key(c.x, c.y)));
    return null;
  }
  return cells;
}

function dirFromCells(cells) {
  const a = cells[cells.length - 2];
  const b = cells[cells.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 1) return { x: 1, y: 0 };
  if (dx === -1) return { x: -1, y: 0 };
  if (dy === 1) return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

function pathClear(cells, occSelf, cols, rows) {
  const d = dirFromCells(cells);
  let x = cells[cells.length - 1].x + d.x;
  let y = cells[cells.length - 1].y + d.y;
  for (let i = 0; i < cols + rows + 2; i++) {
    if (!inBoard(x, y, cols, rows)) return true;
    if (occSelf.has(key(x, y))) return false;
    x += d.x;
    y += d.y;
  }
  return true;
}

function countBends(cells) {
  let b = 0;
  for (let i = 2; i < cells.length; i++) {
    const d1x = cells[i - 1].x - cells[i - 2].x;
    const d1y = cells[i - 1].y - cells[i - 2].y;
    const d2x = cells[i].x - cells[i - 1].x;
    const d2y = cells[i].y - cells[i - 1].y;
    if (d1x !== d2x || d1y !== d2y) b++;
  }
  return b;
}

/**
 * 逆向生成：每次加入一条「当前可滑出」的箭头，保证可解。
 */
function generateLevel(id, cols, rows, targetFill, bendBias) {
  const occ = new Map(); // key -> arrowIndex in result (building reverse)
  const arrows = [];
  const targetCells = Math.floor(cols * rows * targetFill);
  let guard = 0;

  while (occ.size < targetCells && guard++ < targetCells * 40) {
    const maxLen = 3 + ((Math.random() * (cols > 10 ? 10 : 7)) | 0);
    const tmpOcc = new Set(occ.keys());
    const cells = growPolyomino(tmpOcc, cols, rows, maxLen, Math.random() < bendBias);
    if (!cells) continue;

    // 占位集合（不含本箭）用于通路检测
    const others = new Set(occ.keys());
    // grow 已写入 tmpOcc，需从 others 视角：others = occ
    if (!pathClear(cells, others, cols, rows)) {
      continue; // 当前不可出，丢弃（保持逆向可解）
    }

    // 接受
    const idx = arrows.length;
    cells.forEach((c) => occ.set(key(c.x, c.y), idx));
    arrows.push({ cells });
  }

  // 逆向放置顺序的逆序 = 通关顺序；数据本身不需反转，因为每条加入时都可出
  // 但后加入的挡前面的：通关时应先后加入的（后放的挡路，先消后放的）
  // 加入顺序 A1, A2, A3：A3 加入时通路相对 A1+A2 为空方向；A2 加入时相对 A1。
  // 通关顺序应为 A3, A2, A1（后放先消）。存盘时反转数组。
  arrows.reverse();

  return {
    id,
    cols,
    rows,
    arrows: arrows.map((a) => ({
      cells: a.cells.map((c) => ({ x: c.x, y: c.y })),
    })),
  };
}

function validate(level) {
  const errors = [];
  const occ = new Map();
  level.arrows.forEach((arrow, ai) => {
    if (arrow.cells.length < 2) errors.push(`short ${ai}`);
    for (let i = 1; i < arrow.cells.length; i++) {
      const a = arrow.cells[i - 1];
      const b = arrow.cells[i];
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) errors.push(`adj ${ai}`);
    }
    arrow.cells.forEach((c) => {
      const k = key(c.x, c.y);
      if (c.x < 0 || c.y < 0 || c.x >= level.cols || c.y >= level.rows) errors.push(`oob ${ai}`);
      if (occ.has(k)) errors.push(`ov ${k}`);
      occ.set(k, ai);
    });
  });
  return errors;
}

function isSolvable(level) {
  const arrows = level.arrows.map((a) => a.cells.map((c) => ({ ...c })));
  let n = 0;
  while (arrows.length && n++ < 500) {
    const occ = new Map();
    arrows.forEach((cells, i) => cells.forEach((c) => occ.set(key(c.x, c.y), i)));
    let idx = -1;
    for (let i = 0; i < arrows.length; i++) {
      const others = new Set([...occ.keys()].filter((k) => occ.get(k) !== i));
      if (pathClear(arrows[i], others, level.cols, level.rows)) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return false;
    arrows.splice(idx, 1);
  }
  return arrows.length === 0;
}

function bendRatio(level) {
  let bent = 0;
  level.arrows.forEach((a) => {
    if (countBends(a.cells) > 0) bent++;
  });
  return level.arrows.length ? bent / level.arrows.length : 0;
}

function fillRatio(level) {
  let n = 0;
  level.arrows.forEach((a) => (n += a.cells.length));
  return n / (level.cols * level.rows);
}

// 难度曲线：尺寸与填充、折线偏好递增
const SPECS = [];
for (let i = 1; i <= 30; i++) {
  let cols, rows, fill, bend;
  if (i <= 3) {
    cols = 8; rows = 8; fill = 0.45; bend = 0.55;
  } else if (i <= 7) {
    cols = 10; rows = 10; fill = 0.55; bend = 0.7;
  } else if (i <= 15) {
    cols = 12; rows = 12; fill = 0.68; bend = 0.82;
  } else if (i <= 22) {
    cols = 14; rows = 14; fill = 0.75; bend = 0.88;
  } else {
    cols = 16; rows = 16; fill = 0.82; bend = 0.92;
  }
  // 第 8 关起强制较高密度
  if (i >= 8 && fill < 0.65) fill = 0.68;
  SPECS.push({ id: i, cols, rows, fill, bend });
}

const levels = [];
for (const spec of SPECS) {
  let best = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const lv = generateLevel(spec.id, spec.cols, spec.rows, spec.fill, spec.bend);
    const errs = validate(lv);
    if (errs.length) continue;
    if (!isSolvable(lv)) continue;
    const br = bendRatio(lv);
    const fr = fillRatio(lv);
    if (fr < spec.fill * 0.75) continue;
    if (!best || br > bendRatio(best) || (br === bendRatio(best) && fr > fillRatio(best))) {
      best = lv;
    }
    if (br >= spec.bend * 0.85 && fr >= spec.fill * 0.9) break;
  }
  if (!best) {
    // 放宽再试
    for (let attempt = 0; attempt < 120; attempt++) {
      const lv = generateLevel(spec.id, spec.cols, spec.rows, Math.max(0.4, spec.fill - 0.1), spec.bend);
      if (validate(lv).length) continue;
      if (!isSolvable(lv)) continue;
      best = lv;
      break;
    }
  }
  if (!best) throw new Error(`Failed level ${spec.id}`);
  levels.push(best);
  console.log(
    `L${spec.id}: ${best.cols}x${best.rows} arrows=${best.arrows.length} fill=${fillRatio(best).toFixed(2)} bend=${bendRatio(best).toFixed(2)}`,
  );
}

const outPath = path.join(__dirname, '..', 'assets', 'script', 'config', 'levels_generated.json');
fs.writeFileSync(outPath, JSON.stringify(levels, null, 0), 'utf8');
console.log('Wrote', outPath, 'count', levels.length);
