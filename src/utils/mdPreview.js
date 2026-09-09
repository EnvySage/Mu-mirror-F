/**
 * 轻量 Markdown 预览渲染器（FilePreviewModal 专用，零依赖 ~60 行）
 *
 * 支持语法集：标题 #~######、粗体、斜体、行内代码、
 * 围栏代码块、无序列表、有序列表、引用、链接、水平线、
 * 段落与软换行。不支持（预览降级为普通文本行，日志已声明）：表格、图片、任务列表、
 * 脚注、HTML 直写（被 escape 吞掉，属安全特性而非缺失）。
 *
 * 安全铁律（用户文件内容不可信）：
 *  1. 先对原文整体 HTML escape，再在其上套标签——注入的标签全部出自本渲染器模板，
 *     用户内容永远以纯文本形态出现（防 XSS）；
 *  2. 链接 href 白名单 scheme（http/https/mailto/相对路径/锚点），javascript: 等
 *     危险协议降级为纯文本；一律 target="_blank" rel="noopener"。
 */

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/**
 * HTML 转义（全部原文内容必经的第一道工序）
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ESC_MAP[c])
}

/**
 * 链接协议白名单（安全：封死 javascript:/data: 等向量）
 * @param {string} url
 * @returns {string} 合法返回原文，非法返回 ''（调用方降级为纯文本）
 */
function safeUrl(url) {
  const u = String(url || '').trim()
  return /^(https?:\/\/|mailto:|\/|#)/i.test(u) ? u : ''
}

/**
 * 行内语法：粗体 / 斜体 / 行内代码 / 链接
 * 行内代码先摘出占位（\x00N\x00 控制符包裹，与正文字符空间零重叠——
 * 纯数字空格占位会把正文 " 0 " 误替换成代码），最后统一回填
 * @param {string} s 已 escape 的行文本
 * @returns {string}
 */
function renderInline(s) {
  const codes = []
  let out = String(s).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${c}</code>`)
    return `\x00${codes.length - 1}\x00`
  })
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__([^_]+)__(?=$|[^\w])/g, '$1<strong>$2</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w\\])_([^_\n]+)_(?=$|[^\w])/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
      const u = safeUrl(url)
      return u ? `<a href="${u}" target="_blank" rel="noopener">${text}</a>` : m
    })
  return out.replace(/\x00(\d+)\x00/g, (_, i) => codes[Number(i)] || '')
}

/**
 * Markdown → HTML（块级逐行状态机；输入已整体 escape）
 * @param {string} md 原始 markdown 文本
 * @returns {string} 安全 HTML（配合 v-html 使用）
 */
export function renderMarkdown(md) {
  const lines = escapeHtml(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let para = []
  let i = 0

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(renderInline).join('<br>')}</p>`)
      para = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // 围栏代码块 ```（语言标记忽略，内容保持 escape 后原样）
    if (/^```/.test(line)) {
      flushPara()
      const buf = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i])
        i += 1
      }
      i += 1 // 消费收尾 ```（缺失则到文末）
      out.push(`<pre><code>${buf.join('\n')}</code></pre>`)
      continue
    }
    // 水平线（--- *** ___，三个以上）
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara()
      out.push('<hr>')
      i += 1
      continue
    }
    // 标题 #~######
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      flushPara()
      const lv = h[1].length
      out.push(`<h${lv}>${renderInline(h[2])}</h${lv}>`)
      i += 1
      continue
    }
    // 引用（escape 后 > 为 &gt;；连续行合并一块）
    if (/^\s*&gt;/.test(line)) {
      flushPara()
      const buf = []
      while (i < lines.length && /^\s*&gt;/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*&gt;\s?/, ''))
        i += 1
      }
      out.push(`<blockquote>${buf.map(renderInline).join('<br>')}</blockquote>`)
      continue
    }
    // 无序列表 - / * / +
    if (/^\s*[-*+]\s+/.test(line)) {
      flushPara()
      const items = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`)
        i += 1
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }
    // 有序列表 1. / 1)
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushPara()
      const items = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+[.)]\s+/, ''))}</li>`)
        i += 1
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }
    // 空行 → 段落结束
    if (!line.trim()) {
      flushPara()
      i += 1
      continue
    }
    para.push(line)
    i += 1
  }
  flushPara()
  return out.join('\n')
}
