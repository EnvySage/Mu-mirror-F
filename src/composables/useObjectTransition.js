/** Locate a source card without cloning it or starting an unrelated animation. */
export function findObjectSource(type, id) {
  return [...document.querySelectorAll('[data-object-source]')]
    .find(node => node.dataset.objectSource === type && node.dataset.objectId === String(id)) || null
}
