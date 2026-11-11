// 模板引用未 import 组件扫描（编译期查不出、运行时才炸的坑）
const fs = require('fs')
const path = require('path')
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : (e.name.endsWith('.vue') ? [path.join(d, e.name)] : []))
}
let bad = 0
for (const f of walk('src/views').concat(walk('src/components'))) {
  const s = fs.readFileSync(f, 'utf8')
  const imports = new Set([...s.matchAll(/import\s+(\w+)\s+from/g)].map(m => m[1]))
  const builtins = new Set(['RouterView', 'RouterLink', 'Teleport', 'Transition', 'TransitionGroup', 'KeepAlive', 'Suspense'])
  const tplStart = s.indexOf('<template>')
  if (tplStart === -1) continue
  const tpl = s.slice(tplStart)
  const tags = [...tpl.matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map(m => m[1])
  for (const t of new Set(tags)) {
    if (!imports.has(t) && !builtins.has(t)) { bad++; console.log(f.split('src')[1], '→', t, '未 import') }
  }
}
console.log(bad ? bad + ' 处需修' : '全部干净')
