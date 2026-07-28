import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Starts the local server and the web app together, without going through pnpm — so
 * `pnpm dev` and the editor's preview runner take the same path, and neither depends
 * on which package manager version happens to be installed.
 *
 * The server runs its TypeScript through tsx rather than Node's built-in stripping,
 * because stripping does not rewrite the `.js` specifiers the workspace uses. It also
 * means the dev server does not care which Node version the shell happens to provide.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const children = []
let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) child.kill('SIGTERM')
  process.exit(0)
}

function start(name, command, args) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit' })
  child.on('error', (error) => {
    console.error(`[threader] could not start ${name}: ${error.message}`)
    shutdown()
  })
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`[threader] ${name} exited with code ${code}`)
    shutdown()
  })
  children.push(child)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// `watch` so server and store changes reload the same way Vite reloads the app.
start('server', join(root, 'apps/server/node_modules/.bin/tsx'), [
  'watch',
  join(root, 'apps/server/src/index.ts'),
])
start('web', process.execPath, [
  join(root, 'apps/web/node_modules/vite/bin/vite.js'),
  join(root, 'apps/web'),
])
