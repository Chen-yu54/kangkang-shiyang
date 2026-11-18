global.getApp = () => ({ getFontStyle: () => '', getElderMode: () => false });
let pageObj = null;
global.Page = (o) => { pageObj = o; };
require('./miniprogram/pages/foodsafety/foodsafety.js');

const data = {};
const inst = Object.assign({}, pageObj.data, {
  setData(o) { Object.assign(data, o); },
});
Object.assign(data, pageObj.data);
pageObj.onLoad.call(inst);

const errs = [];
function ck(cond, msg) { if (!cond) errs.push(msg); }
function has(obj, keys, label) {
  keys.forEach((k) => ck(obj && obj[k] !== undefined && obj[k] !== null, label + ' missing ' + k));
}

has(data, ['scope','lead','ov','months','monthFirst','monthLast','topProblem','topStage','pen','insp','icons'], 'data');
has(data.scope, ['region','from','to','organ','penaltyNote'], 'scope');
ck(data.lead && data.lead.length > 10, 'lead empty');
ck(data.ov.length === 4, 'ov not 4');
data.ov.forEach((x,i)=>has(x,['key','num','unit','label','note'],'ov['+i+']'));

ck(data.insp.problems.length > 0, 'problems empty');
data.insp.problems.forEach((x,i)=>has(x,['key','name','n','pct','w'],'problems['+i+']'));
data.insp.stages.forEach((x,i)=>has(x,['key','name','n','pct'],'stages['+i+']'));
data.insp.ingredients.forEach((x,i)=>has(x,['name','n'],'ingredients['+i+']'));
data.insp.latest.forEach((x,i)=>has(x,['no','date','title','declared','count'],'latest['+i+']'));
data.months.forEach((x,i)=>has(x,['label','n','h'],'months['+i+']'));
ck(data.monthFirst.label && data.monthLast.label, 'monthFirst/Last empty');

has(data.pen, ['food','total','other','pending','amountWan','amountMaxWan','cases'], 'pen');
data.pen.cases.forEach((x,i)=>has(x,['tag','date','cause','basis','action','doc'],'cases['+i+']'));

JSON.stringify(data).replace(/undefined|NaN/g, (m)=>{ errs.push('bad literal '+m); return m; });
const dump = JSON.stringify(data);
ck(!/\{[a-zA-Z]/.test(dump.replace(/\{\{.*?\}\}/g,'')), 'possible unresolved placeholder in data');

const fs = require('fs');
const wxml = fs.readFileSync('miniprogram/pages/foodsafety/foodsafety.wxml','utf8');
const tops = [...new Set([...wxml.matchAll(/\{\{([a-zA-Z][a-zA-Z0-9_]*)[.\[]/g)].map(m=>m[1]))];
const skip = new Set(['item','index','true','false','elderMode','pageStyle']);
tops.forEach(k=>{ if (!skip.has(k)) ck(Object.prototype.hasOwnProperty.call(data,k), 'wxml top var not in data: '+k); });

const wxss = fs.readFileSync('miniprogram/pages/foodsafety/foodsafety.wxss','utf8');
const classes = new Set();
for (const m of wxml.matchAll(/class="([^"]*)"/g)) {
  m[1].replace(/\{\{.*?\}\}/g,'').split(/\s+/).forEach(c=>{ if(c) classes.add(c); });
}
const missing = [...classes].filter(c => !wxss.includes('.'+c));
ck(missing.length === 0, 'wxss missing classes: ' + missing.join(','));

console.log('=== summary ===');
console.log('lead:', data.lead);
console.log('ov:', data.ov.map(x=>x.num+(x.unit||'')+' '+x.label).join(' | '));
console.log('problems:', data.insp.problems.map(p=>p.name+' '+p.n+'/'+p.pct+'%/'+p.w).join(' | '));
console.log('stages:', data.insp.stages.map(p=>p.name+' '+p.n+'/'+p.pct+'%').join(' | '));
console.log('ingredients:', data.insp.ingredients.map(p=>p.name+' '+p.n).join(' | '));
console.log('months:', data.months.map(m=>m.label+':'+m.n).join(' '));
console.log('latest:', data.insp.latest.map(n=>n.no+' '+n.date+' 通告'+n.declared+'/收录'+n.count).join(' | '));
console.log('pen:', data.pen.food+'起 合计'+data.pen.amountWan+'万 最高'+data.pen.amountMaxWan+'万 共'+data.pen.total+'份(其他'+data.pen.other+'/待判定'+data.pen.pending+')');
console.log('cases:', data.pen.cases.map(c=>c.tag+' '+c.date).join(' | '));
console.log('wxml top vars:', tops.join(','));
console.log('classes:', classes.size, 'missing:', missing.length ? missing.join(',') : 'none');
console.log(errs.length ? 'ERRORS:\n - '+errs.join('\n - ') : 'ALL CHECKS PASS');
process.exit(errs.length ? 1 : 0);
