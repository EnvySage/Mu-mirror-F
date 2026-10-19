export function resolvePresentationMode(override, width) {
  if (override === 'desktop' || override === 'mobile') return override
  return width < 900 ? 'mobile' : 'desktop'
}
