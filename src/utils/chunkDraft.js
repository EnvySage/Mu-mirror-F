export function createChunkDraft(original = '') {
  return { original, value: original }
}

export function updateChunkDraft(draft, value) {
  return { original: draft.original, value: String(value ?? '') }
}

export function discardChunkDraft(draft) {
  return { original: draft.original, value: draft.original }
}

export function hasChunkDraftChanges(draft) {
  return draft.value !== draft.original
}
