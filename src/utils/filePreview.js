const types = {
  md: ['markdown', 'text/markdown'], txt: ['text', 'text/plain'], csv: ['csv', 'text/csv'],
  pdf: ['pdf', 'application/pdf'], docx: ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  jpg: ['image', 'image/jpeg'], jpeg: ['image', 'image/jpeg'], png: ['image', 'image/png'],
  webp: ['image', 'image/webp'], gif: ['image', 'image/gif'],
  mp3: ['audio', 'audio/mpeg'], wav: ['audio', 'audio/wav'], m4a: ['audio', 'audio/mp4'],
}

export function previewType(item, mime = '') {
  const ext = String(item?.file_type || item?.fileType || item?.original_name || item?.originalName || item?.display_name || item?.displayName || '').split('.').pop().toLowerCase()
  const found = types[ext] || Object.values(types).find(([, type]) => type === mime.split(';')[0])
  return { kind: found?.[0] || 'unsupported', mime: found?.[1] || mime, extension: ext || 'FILE' }
}

/** Bounded RFC 4180-style reader; cells always render as text, never HTML. */
export function parseCsv(source, maxRows = 201, maxColumns = 50) {
  const text = String(source).replace(/^\uFEFF/, '')
  const rows = []
  let row = [], cell = '', quoted = false, truncated = false
  const pushCell = () => { if (row.length < maxColumns) row.push(cell); else truncated = true; cell = '' }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++ }
      else if (quoted || !cell) quoted = !quoted
      else cell += char
    } else if (char === ',' && !quoted) pushCell()
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++
      pushCell(); rows.push(row); row = []
      if (rows.length >= maxRows) { truncated ||= i < text.length - 1; break }
    } else cell += char
  }
  if (rows.length < maxRows && (cell || row.length)) { pushCell(); rows.push(row) }
  const columns = Math.max(0, ...rows.map(row => row.length))
  return { rows: rows.map(row => Array.from({ length: columns }, (_, i) => row[i] || '')), truncated, malformed: quoted }
}

export async function docxHtml(blob) {
  const [{ default: mammoth }, { default: purify }] = await Promise.all([import('mammoth/mammoth.browser'), import('dompurify')])
  const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() }, { externalFileAccess: false, styleMap: ["p[style-name='Title'] => h1:fresh"] })
  // Sanitize before inserting content. Embedded raster images only; never load
  // remote tracking images or allow document-defined scripts/styles/frames.
  const cleaner = purify(window)
  cleaner.addHook('uponSanitizeAttribute', (node, data) => {
    if (node.tagName === 'IMG' && data.attrName === 'src' && !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(data.attrValue)) data.keepAttr = false
  })
  const html = cleaner.sanitize(result.value, {
    ALLOWED_TAGS: ['p','h1','h2','h3','h4','h5','h6','strong','em','b','i','u','s','br','hr','blockquote','ul','ol','li','table','thead','tbody','tr','td','th','sup','sub','a','img'],
    ALLOWED_ATTR: ['href','src','alt','colspan','rowspan'],
  })
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('img').forEach(img => {
    if (!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(img.getAttribute('src') || '')) img.remove()
  })
  document.querySelectorAll('a').forEach(link => {
    if (!/^(https?:\/\/|mailto:|#)/i.test(link.getAttribute('href') || '')) link.removeAttribute('href')
    link.setAttribute('target', '_blank'); link.setAttribute('rel', 'noopener noreferrer')
  })
  return document.body.innerHTML
}
