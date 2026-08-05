const PREFIX = 'mirror_'

/**
 * @param {string} key
 * @returns {string | null}
 */
export function getStorage(key) {
  return localStorage.getItem(PREFIX + key)
}

/**
 * @param {string} key
 * @param {string} value
 */
export function setStorage(key, value) {
  localStorage.setItem(PREFIX + key, value)
}

/**
 * @param {string} key
 */
export function removeStorage(key) {
  localStorage.removeItem(PREFIX + key)
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function hasStorage(key) {
  return localStorage.getItem(PREFIX + key) !== null
}
