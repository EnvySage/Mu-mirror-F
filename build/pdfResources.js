import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// PDF.js resources stay on our own origin, including CJK maps and font data.
// Enumerated paths also prevent the dev middleware from exposing arbitrary files.
export function pdfResources() {
  const assets = new Map()
  for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    const folder = new URL(`../node_modules/pdfjs-dist/${directory}/`, import.meta.url)
    for (const name of readdirSync(folder)) {
      if (!/\.(bcmap|pfb|ttf|wasm|icc)$/i.test(name) && !/^LICENSE/i.test(name)) continue
      assets.set(`pdf-resources/${directory}/${name}`, fileURLToPath(new URL(name, folder)))
    }
  }
  return {
    name: 'local-pdf-resources',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const key = (req.url || '').split('?')[0].replace(/^\//, '')
        const path = assets.get(key)
        if (!path) return next()
        res.setHeader('Content-Type', key.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream')
        res.end(readFileSync(path))
      })
    },
    generateBundle() {
      for (const [fileName, path] of assets) this.emitFile({ type: 'asset', fileName, source: readFileSync(path) })
    },
  }
}
