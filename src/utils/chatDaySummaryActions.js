/** Resolve candidate cards for a summary without duplicating the open session's cards. */
export function resolveDaySummaryActions({ summary, activeSessionId, actionsById = {}, getSessionActions = () => [] }) {
  const sourceSessionId = summary?.sourceSessionId || summary?.source_session_id
  if (!sourceSessionId || String(sourceSessionId) === String(activeSessionId || '')) return []

  const proposals = Array.isArray(summary?.actions) ? summary.actions : getSessionActions(sourceSessionId)
  return proposals
    .map(action => actionsById[action.id] || action)
    .filter(action => action?.kind === 'memory.accept')
}
