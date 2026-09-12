/**
 * Vault 文件常量与校验（toolcalling-vault-design.md 3.1，前端拦截口径）
 *
 * 与 B 约定：单文件 20MB、每用户 500MB、类型白名单（svg/视频/exe/zip 一律拒，
 * svg 防 XSS）。前端先拦一道给出人话理由，后端 magic bytes 校验仍是最终防线。
 */

/** 单文件上限 20MB */
export const VAULT_MAX_BYTES = 20 * 1024 * 1024

/** 总配额 500MB（mock 态展示口径，真值以 B 返回 quota 为准） */
export const VAULT_TOTAL_BYTES = 500 * 1024 * 1024

/** 类型白名单（扩展名，后端白名单一致；实际放行以后端 magic bytes 为准） */
export const VAULT_WHITELIST = ['pdf', 'docx', 'txt', 'md', 'csv', 'jpg', 'png', 'webp', 'gif', 'mp3', 'wav', 'm4a']

/** 明确拒绝类型的专属理由（比白名单兜底更具体） */
const DENIED_REASONS = {
  svg: '.svg 可能携带脚本（防 XSS）· 不支持保管',
  exe: '可执行文件不可保管',
  dll: '可执行文件不可保管',
  bat: '可执行文件不可保管',
  sh: '可执行文件不可保管',
  zip: '压缩包暂不支持',
  rar: '压缩包暂不支持',
  '7z': '压缩包暂不支持',
  tar: '压缩包暂不支持',
  gz: '压缩包暂不支持',
  mp4: '视频暂不支持 · 音频可存',
  mov: '视频暂不支持 · 音频可存',
  avi: '视频暂不支持 · 音频可存',
  mkv: '视频暂不支持 · 音频可存',
  webm: '视频暂不支持 · 音频可存',
}

/** 扩展名 → 大类（vault 页筛选三档 + 图标族） */
const CATEGORY_MAP = {
  pdf: 'document', docx: 'document', txt: 'document', md: 'document', csv: 'document',
  jpg: 'image', png: 'image', webp: 'image', gif: 'image',
  mp3: 'audio', wav: 'audio', m4a: 'audio',
}

/** 大类中文名 */
export const CATEGORY_LABELS = { document: '文档', image: '图片', audio: '音频' }

/**
 * 取文件扩展名（无点 / 末尾点返回 ''）
 * @param {string} name
 * @returns {string}
 */
export function fileExt(name) {
  if (!name || typeof name !== 'string') return ''
  const idx = name.lastIndexOf('.')
  if (idx <= 0 || idx === name.length - 1) return ''
  return name.slice(idx + 1).toLowerCase()
}

/**
 * 扩展名 → 大类（未知返回 null）
 * @param {string} ext
 * @returns {'document'|'image'|'audio'|null}
 */
export function categoryOf(ext) {
  return CATEGORY_MAP[ext] || null
}

/**
 * 展示名兜底（元数据榨取真实现由 B 在上传瞬间做：PDF Title / docx 属性 / ID3 / EXIF；
 * 前端只做 filename → 可读名的清洗：去扩展名 + 下划线转空格）
 * @param {string} name
 * @returns {string}
 */
export function deriveDisplayName(name) {
  const ext = fileExt(name)
  const base = ext ? name.slice(0, name.length - ext.length - 1) : (name || '')
  const cleaned = base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || '未命名文件'
}

/**
 * 大类 → 中文名（未知回落"文件"）
 * @param {'document'|'image'|'audio'|null} category
 * @returns {string}
 */
export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || '文件'
}

/**
 * 字节数 → 展示（B/KB/MB，MB 保留 1 位）
 * @param {number} n
 * @returns {string}
 */
export function formatBytes(n) {
  const num = Number(n)
  if (!Number.isFinite(num) || num < 0) return '—'
  if (num < 1024) return `${Math.round(num)}B`
  if (num < 1024 * 1024) return `${Math.round(num / 1024)}KB`
  return `${(num / 1024 / 1024).toFixed(1)}MB`
}

/**
 * 前端上传校验（任务 2：20MB 拦截 + 白名单 + 拒绝类专属理由）
 * @param {File} file
 * @returns {{ ok: boolean, reason?: string, ext: string, category: 'document'|'image'|'audio'|null }}
 */
export function validateVaultFile(file) {
  const ext = fileExt(file?.name)
  if (!ext) {
    return { ok: false, reason: '无法识别文件类型 · 需要带扩展名的文件', ext, category: null }
  }
  if (DENIED_REASONS[ext]) {
    return { ok: false, reason: DENIED_REASONS[ext], ext, category: null }
  }
  if (!VAULT_WHITELIST.includes(ext)) {
    return {
      ok: false,
      reason: `不支持 .${ext} · 可存：${VAULT_WHITELIST.join(' / ')}`,
      ext,
      category: null,
    }
  }
  if (!file.size) {
    return { ok: false, reason: '空文件无法保管', ext, category: CATEGORY_MAP[ext] }
  }
  if (file.size > VAULT_MAX_BYTES) {
    return {
      ok: false,
      reason: `超过单文件 20MB 上限（当前 ${formatBytes(file.size)}）`,
      ext,
      category: CATEGORY_MAP[ext],
    }
  }
  return { ok: true, ext, category: CATEGORY_MAP[ext] }
}
