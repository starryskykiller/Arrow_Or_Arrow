const fs = require('fs');
const levels = require('../assets/script/config/levels_generated.json');
// No import from LevelData — avoids LevelData <-> LevelPack circular dependency
const header =
  '/** auto-generated 30 maze levels - no imports to avoid cycles */\n' +
  'export const PACKED_LEVELS = ';
const out = 'd:/NewGame1/Arrow_Or_Arrow/assets/script/config/LevelPack.ts';
const content = header + JSON.stringify(levels) + ';\n';
fs.writeFileSync(out, content, { encoding: 'utf8' });
console.log('wrote', out, fs.statSync(out).size);
