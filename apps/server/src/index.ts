import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createProfile, type Profile, type Thread } from '@threader/core'
import { FsStore, defaultHome } from '@threader/store/fs'

/**
 * Thin local server (ADR-0005). File I/O only — no thread logic lives here, and none
 * should ever be added: a splitting rule in this file is a rule the CLI and desktop
 * builds would not get.
 *
 * Binds to 127.0.0.1. Ids from the request are validated by the store before they
 * reach the filesystem.
 */

// Deliberately NOT `PORT`: dev runners set that for the web app, and the two servers
// would fight over the same port.
const PORT = Number(process.env['THREADER_SERVER_PORT'] ?? 5174)
const HOST = '127.0.0.1'

const store = new FsStore(defaultHome())

/** The profile threads point at until Stage 5 makes profiles editable. */
const DEFAULT_PROFILE_ID = 'default'

async function ensureDefaultProfile(): Promise<void> {
  if (await store.getProfile(DEFAULT_PROFILE_ID)) return
  const profile = createProfile(
    { name: 'Main', handle: '@you' },
    { ids: () => DEFAULT_PROFILE_ID },
  )
  await store.putProfile(profile)
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(json),
  })
  res.end(json)
}

async function readBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    // A thread is text. Anything this large is a mistake or an attack.
    if (size > 5_000_000) throw new Error('body too large')
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
}

type Route = { method: string; pattern: RegExp; handle: (m: RegExpMatchArray, req: IncomingMessage) => Promise<[number, unknown]> }

const routes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/health$/,
    handle: async () => [200, { ok: true, home: store.home }],
  },
  {
    method: 'GET',
    pattern: /^\/api\/threads$/,
    handle: async () => [200, await store.listThreads()],
  },
  {
    method: 'GET',
    pattern: /^\/api\/threads\/([^/]+)$/,
    handle: async (m) => {
      const thread = await store.getThread(decodeURIComponent(m[1]!))
      return thread ? [200, thread] : [404, { error: 'not found' }]
    },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/threads\/([^/]+)$/,
    handle: async (m, req) => {
      const id = decodeURIComponent(m[1]!)
      const thread = await readBody<Thread>(req)
      if (thread.id !== id) return [400, { error: 'id mismatch' }]
      await store.putThread(thread)
      return [200, { ok: true }]
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/threads\/([^/]+)\/rename$/,
    handle: async (m, req) => {
      const { title } = await readBody<{ title?: string }>(req)
      if (typeof title !== 'string') return [400, { error: 'title required' }]
      await store.renameThread(decodeURIComponent(m[1]!), title)
      return [200, { ok: true }]
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/threads\/([^/]+)$/,
    handle: async (m) => {
      await store.deleteThread(decodeURIComponent(m[1]!))
      return [200, { ok: true }]
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/profiles$/,
    handle: async () => [200, await store.listProfiles()],
  },
  {
    method: 'PUT',
    pattern: /^\/api\/profiles\/([^/]+)$/,
    handle: async (m, req) => {
      const id = decodeURIComponent(m[1]!)
      const profile = await readBody<Profile>(req)
      if (profile.id !== id) return [400, { error: 'id mismatch' }]
      await store.putProfile(profile)
      return [200, { ok: true }]
    },
  },
]

const server = createServer((req, res) => {
  void (async () => {
    const path = (req.url ?? '').split('?')[0] ?? ''
    const method = req.method ?? 'GET'

    for (const route of routes) {
      const match = path.match(route.pattern)
      if (!match) continue
      if (route.method !== method) continue
      try {
        const [status, body] = await route.handle(match, req)
        send(res, status, body)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // Path-escape and unsafe-id attempts land here. They are client errors, and
        // worth seeing in the log.
        console.error(`${method} ${path} → ${message}`)
        send(res, 400, { error: message })
      }
      return
    }

    send(res, 404, { error: 'not found' })
  })()
})

await store.init()
await ensureDefaultProfile()

server.on('error', (error) => {
  console.error(`threader server failed to bind ${HOST}:${PORT} — ${error.message}`)
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  console.log(`threader server → http://${HOST}:${PORT}  (home: ${store.home})`)
})
