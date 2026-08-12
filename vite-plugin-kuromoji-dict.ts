import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const DICT_URL_PREFIX = '/kuromoji-dict/'

/** Serve / copy Kuromoji IPADIC gzip dictionaries from node_modules. */
export function kuromojiDictPlugin(): Plugin {
  const dictRoot = path.resolve('node_modules/@patdx/kuromoji/dict')

  function sendDict(fileName: string, res: import('http').ServerResponse) {
    const safe = path.basename(fileName)
    const filePath = path.join(dictRoot, safe)
    if (!filePath.startsWith(dictRoot) || !fs.existsSync(filePath)) {
      res.statusCode = 404
      res.end('Not found')
      return
    }
    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    fs.createReadStream(filePath).pipe(res)
  }

  return {
    name: 'kuromoji-dict',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith(DICT_URL_PREFIX)) {
          next()
          return
        }
        sendDict(url.slice(DICT_URL_PREFIX.length), res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith(DICT_URL_PREFIX)) {
          next()
          return
        }
        sendDict(url.slice(DICT_URL_PREFIX.length), res)
      })
    },
    closeBundle() {
      const outDir = path.resolve('dist/kuromoji-dict')
      fs.mkdirSync(outDir, { recursive: true })
      for (const name of fs.readdirSync(dictRoot)) {
        if (!name.endsWith('.gz')) continue
        fs.copyFileSync(path.join(dictRoot, name), path.join(outDir, name))
      }
    },
  }
}
