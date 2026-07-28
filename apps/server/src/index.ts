import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

/**
 * Thin local server (ADR-0005). File I/O and OS integrations only — no thread
 * logic ever lives here. Real routes arrive in Stage 4.
 *
 * Binds to 127.0.0.1 only, and every future path-taking endpoint must resolve
 * its argument and refuse anything outside THREADER_HOME.
 */
export const THREADER_HOME = resolve(
  process.env['THREADER_HOME'] ?? resolve(homedir(), 'threader'),
)

const PORT = Number(process.env['PORT'] ?? 5174)
const HOST = '127.0.0.1'

const server = createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, home: THREADER_HOME }))
    return
  }

  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

server.listen(PORT, HOST, () => {
  console.log(`threader server → http://${HOST}:${PORT}  (home: ${THREADER_HOME})`)
})
