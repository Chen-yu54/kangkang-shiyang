/**
 * scripts/build-recipes.js
 * 从 knowledge/card_meta.csv 生成云函数用的精简 recipes.json
 *
 * 用法：
 *   node scripts/build-recipes.js ../康康食养AI_V2.0_源码工程包/knowledge/card_meta.csv
 *   node scripts/build-recipes.js <csv路径> <输出路径>
 */
const fs = require('fs');
const path = require('path');

const FIELD_ALIAS = {
  id: ['id', '编号', '菜品id', '菜品编号', 'code'],
  name: ['name', '菜名', '名称', '菜品名称'],
  cuisine: ['cuisine', '菜系', '系别'],
  terms: ['terms', '节气', '当令节气', 'term'],
  mainIngredients: ['mainIngredients', '主料', '食材', 'ingredients', 'main_ingredients'],
  method: ['method', '做法', '烹饪方式', '工艺'],
  caution: ['caution', '注意', '注意事项', '禁忌', '提示'],
  allergen: ['allergen', '过敏原', '致敏物'],
  ageSuitable: ['ageSuitable', '适宜人群', '适合人群', 'age_suitable'],
  costLevel: ['costLevel', '成本档', '成本', 'cost_level', '价格档'],
  difficulty: ['difficulty', '难度', '难度等级'],
  evidence: ['evidence', '证据等级', '证据', '证据级别'],
};

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}

function normKey(k) {
  return String(k || '').trim().toLowerCase().replace(/[\s_-]/g, '');
}

function buildHeaderMap(header) {
  const map = {};
  const normed = header.map((h) => ({ raw: h, key: normKey(h) }));
  Object.keys(FIELD_ALIAS).forEach((field) => {
    const aliases = FIELD_ALIAS[field].map(normKey);
    const found = normed.find((h) => aliases.indexOf(h.key) >= 0);
    if (found) map[field] = header.indexOf(found.raw);
  });
  return map;
}

function splitList(v) {
  if (v === undefined || v === null) return [];
  return String(v)
    .split(/[,，、;；|\/\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function main() {
  const csvPath = process.argv[2];
  const outPath =
    process.argv[3] || path.join(__dirname, '..', 'cloudfunctions', 'aiqa', 'data', 'recipes.json');

  if (!csvPath) {
    console.error('用法: node scripts/build-recipes.js <card_meta.csv 路径> [输出路径]');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error('找不到 CSV：' + csvPath);
    process.exit(1);
  }

  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  if (rows.length < 2) {
    console.error('CSV 内容为空');
    process.exit(1);
  }

  const header = rows[0];
  const map = buildHeaderMap(header);
  const missing = ['id', 'name'].filter((f) => map[f] === undefined);
  if (missing.length) {
    console.error('CSV 缺少必要列：' + missing.join(', ') + '\n实际表头：' + header.join(' | '));
    process.exit(1);
  }

  const get = (row, field) => (map[field] === undefined ? '' : String(row[map[field]] || '').trim());

  const out = [];
  const seen = new Set();
  const skipped = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    const id = get(r, 'id');
    const name = get(r, 'name');
    if (!id || !name) {
      skipped.push(i + 1);
      continue;
    }
    if (seen.has(id)) {
      skipped.push(i + 1);
      continue;
    }
    seen.add(id);
    out.push({
      id,
      name,
      cuisine: get(r, 'cuisine') || '广府',
      terms: splitList(get(r, 'terms')),
      mainIngredients: splitList(get(r, 'mainIngredients')),
      method: get(r, 'method'),
      caution: get(r, 'caution'),
      allergen: splitList(get(r, 'allergen')),
      ageSuitable: splitList(get(r, 'ageSuitable')).length
        ? splitList(get(r, 'ageSuitable'))
        : ['长者', '成人', '儿童'],
      costLevel: Number(get(r, 'costLevel')) || 2,
      difficulty: Number(get(r, 'difficulty')) || 2,
      evidence: (get(r, 'evidence') || 'B').toUpperCase().charAt(0),
    });
  }

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('✅ 生成 ' + out.length + ' 道菜 → ' + outPath);
  if (skipped.length) console.log('⚠️ 跳过 ' + skipped.length + ' 行（缺 id/name 或 id 重复）：第 ' + skipped.slice(0, 20).join(',') + ' 行');

  const noIngredient = out.filter((x) => !x.mainIngredients.length).length;
  if (noIngredient) console.log('⚠️ ' + noIngredient + ' 道菜没有主料，忌口过滤会失效，建议补全');
}

main();
