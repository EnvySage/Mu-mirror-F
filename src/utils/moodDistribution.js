/** Preserve the full denominator when a compact legend groups less common moods. */
export function moodDistribution(daily, limit = 5) {
  const totals = new Map()
  for (const day of daily) for (const item of day.moods || []) {
    const count = Math.max(0, Number(item.count) || 0)
    if (count) totals.set(item.mood, (totals.get(item.mood) || 0) + count)
  }
  const sorted = [...totals].sort((a, b) => b[1] - a[1])
  const total = sorted.reduce((sum, [, count]) => sum + count, 0)
  const top = sorted.slice(0, limit)
  if (sorted.length > limit) top.push(['other', sorted.slice(limit).reduce((sum, [, count]) => sum + count, 0)])
  let offset = 0
  return top.map(([key, count]) => {
    const share = count / total * 100
    const segment = { key, count, share, pct: Math.round(share), offset }
    offset -= share
    return segment
  })
}
