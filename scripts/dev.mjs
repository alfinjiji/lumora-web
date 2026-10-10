import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const children = [
  spawn(
    process.execPath,
    ['--env-file-if-exists=.env.local', 'server/index.mjs'],
    { stdio: 'inherit', detached: process.platform !== 'win32' },
  ),
  spawn(
    process.execPath,
    [resolve('node_modules/vite/bin/vite.js'), ...process.argv.slice(2)],
    { stdio: 'inherit', detached: process.platform !== 'win32' },
  ),
]
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.pid) continue
    try {
      if (process.platform === 'win32') child.kill('SIGTERM')
      else process.kill(-child.pid, 'SIGTERM')
    } catch (error) { if (error.code !== 'ESRCH') throw error }
  }
  process.exitCode = code
}
for (const child of children) {
  child.on('exit', (code) => stop(code || 0))
  child.on('error', () => stop(1))
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
