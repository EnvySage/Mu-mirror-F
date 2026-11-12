export function parseCitations(content, sources, vaultRefs) {
  const text = content || ''
  const list = sources && sources.length ? sources : []
  const refs = vaultRefs && vaultRefs.length ? vaultRefs : []
  if (!list.length && !refs.length) return [{ type: 'text', value: text }]
  const out = []
  // [n] 与 [Fn] 一次扫完；排除 markdown 链接形态 [n](url)
  const re = /\[(F?)(\d{1,3})\](?!\()/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
    const n = Number(m[2])
    if (m[1]) {
      out.push({ type: 'vault', n, ref: refs.find(r => Number(r.n) === n) || null })
    } else {
      out.push({ type: 'cite', n, source: findSource(list, n) })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

export function findSource(sources, n) {
  const byN = sources.find(s => Number(s.n) === n)
  if (byN) return byN
  if (sources.some(s => s.n != null)) return null // 新契约数据缺 n 就是真缺，别用下标凑
  return sources[n - 1] || null
}

export function citeTitle(s) {
  return `${s.date} · ${s.quote.slice(0, 24)}…`
}
