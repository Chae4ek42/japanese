import fs from 'node:fs'
import path from 'node:path'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'

const API_PATH = '/api/app-state'

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: Connect.ServerResponse, status: number, body: unknown) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

function createAppStateMiddleware(stateFile: string): Connect.NextHandleFunction {
  ensureDir(stateFile)

  return async (req, res, next) => {
    const url = req.url?.split('?')[0] ?? ''
    if (url !== API_PATH) {
      next()
      return
    }

    try {
      if (req.method === 'GET') {
        if (!fs.existsSync(stateFile)) {
          res.statusCode = 204
          res.setHeader('Cache-Control', 'no-store')
          res.end()
          return
        }
        const raw = fs.readFileSync(stateFile, 'utf8')
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(raw)
        return
      }

      if (req.method === 'PUT' || req.method === 'POST') {
        const body = await readBody(req)
        if (!body.trim()) {
          sendJson(res, 400, { error: 'empty body' })
          return
        }
        JSON.parse(body) // validate
        ensureDir(stateFile)
        fs.writeFileSync(stateFile, body, 'utf8')
        sendJson(res, 200, { ok: true })
        return
      }

      if (req.method === 'DELETE') {
        if (fs.existsSync(stateFile)) {
          fs.unlinkSync(stateFile)
        }
        sendJson(res, 200, { ok: true })
        return
      }

      res.statusCode = 405
      res.setHeader('Allow', 'GET, PUT, POST, DELETE')
      res.end('Method Not Allowed')
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'app-state storage failed',
      })
    }
  }
}

function attach(server: ViteDevServer | PreviewServer, stateFile: string) {
  server.middlewares.use(createAppStateMiddleware(stateFile))
}

/** Shared app state on disk so every browser on the LAN sees the same data. */
export function sharedAppStatePlugin(rootDir = process.cwd()): Plugin {
  const stateFile = path.resolve(rootDir, '.data', 'app-state.json')

  return {
    name: 'shared-app-state',
    configureServer(server) {
      attach(server, stateFile)
    },
    configurePreviewServer(server) {
      attach(server, stateFile)
    },
  }
}
