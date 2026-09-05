/* 残余 TDZ 扫描：defineExpose 引用的标识符必须在其 const/let/function 声明之后 */
const fs = require('fs');
const path = require('path');
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : (/\.(vue|js)$/.test(e.name) ? [path.join(d, e.name)] : []));
}
let issues = 0;
for (const f of walk(path.join(__dirname, '..', 'src'))) {
  const s = fs.readFileSync(f, 'utf8');
  const exposeIdx = s.indexOf('defineExpose(');
  if (exposeIdx !== -1) {
    const exposed = (s.slice(exposeIdx).match(/defineExpose\(\{([^}]*)\}\)/) || [])[1] || '';
    const names = exposed.split(',').map(x => x.trim()).filter(Boolean);
    for (const n of names) {
      const declIdx = s.search(new RegExp('const\\s+' + n + '\\s*='));
      if (declIdx === -1) { console.log(f, ': defineExpose 引用', n, '未找到声明'); issues++; }
      else if (declIdx > exposeIdx) { console.log(f, ': defineExpose(', n, ') 前置于声明 → TDZ!'); issues++; }
      else console.log(f, ': defineExpose(', n, ') OK（声明在前）');
    }
  }
}
console.log(issues === 0 ? 'TDZ 扫描：全部干净' : issues + ' 处需修');
process.exit(issues ? 1 : 0);
