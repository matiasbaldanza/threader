import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

/**
 * Starts the local server and the web app together.
 *
 * Both children are launched with an explicitly chosen Node binary rather than
 * whatever `node` resolves to. The version on PATH depends on the shell that started
 * us — a login shell, an editor's task runner, a launchd agent — and they do not
 * agree. Vite 6 on Node 17 fails with a confusing error about `node:fs/promises` not
 * exporting `constants`, which says nothing about the real problem.
 *
 * The server's TypeScript runs through tsx's CLI entry point directly, for the same
 * reason: the `.bin/tsx` shim would re-introduce the PATH dependency via its shebang.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Vite 6 and tsx both want a modern Node; below this the failures are cryptic. */
const MIN = [20, 19]

function satisfies(version) {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number)
  return major > MIN[0] || (major === MIN[0] && minor >= MIN[1])
}

function nvmBin(version) {
  return join(homedir(), '.nvm/versions/node', `v${version.replace(/^v/, '')}`, 'bin/node')
}

/**
 * Prefers the version pinned in .nvmrc, so `pnpm dev` behaves the same everywhere,
 * then falls back to whatever is running us, then to the newest installed version
 * that is new enough.
 */
function pickNode() {
  const pinned = readFileSync(join(root, '.nvmrc'), 'utf8').trim()
  const pinnedBin = nvmBin(pinned)
  if (satisfies(pinned) && existsSync(pinnedBin)) return pinnedBin

  if (satisfies(process.versions.node)) return process.execPath

  try {
    const best = readdirSync(join(homedir(), '.nvm/versions/node'))
      .filter((v) => satisfies(v))
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
      )
      .pop()
    if (best && existsSync(nvmBin(best))) {
      console.log(`[threader] .nvmrc asks for v${pinned}, which is not installed; using ${best}`)
      return nvmBin(best)
    }
  } catch {
    // No nvm directory at all — fall through to the error below.
  }

  console.error(
    `[threader] Need Node >= ${MIN.join('.')} to run the dev servers.\n` +
      `Running under ${process.versions.node}, and v${pinned} from .nvmrc is not installed.\n` +
      `Run \`nvm install\` in this directory.`,
  )
  process.exit(1)
}

const node = pickNode()
const children = []
let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) child.kill('SIGTERM')
  process.exit(0)
}

function start(name, args) {
  const child = spawn(node, args, { cwd: root, stdio: 'inherit' })
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

start('server', [
  join(root, 'apps/server/node_modules/tsx/dist/cli.mjs'),
  'watch',
  join(root, 'apps/server/src/index.ts'),
])
start('web', [
  join(root, 'apps/web/node_modules/vite/bin/vite.js'),
  join(root, 'apps/web'),
])
