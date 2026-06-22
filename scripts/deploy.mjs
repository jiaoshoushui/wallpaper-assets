/**
 * One-click deploy: pull -> build -> commit -> push
 */
import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const TRACK = ['pc', 'phone', 'thumb', 'manifest.json']
const DEPLOY_FILES = [
  'scripts/deploy.mjs',
  'scripts/build.mjs',
  'scripts/init-folders.mjs',
  'deploy.bat',
  'deploy.cmd',
  'deploy.ps1',
  'deploy.sh',
  '.github/workflows/sync-wallpapers.yml',
  'package.json',
  'README.md',
]

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run')
  const skipBuild = argv.includes('--skip-build')
  const msgFlag = argv.findIndex((a) => a === '-m' || a === '--message')
  let message = `chore: deploy wallpapers ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
  if (msgFlag >= 0 && argv[msgFlag + 1]) {
    message = argv[msgFlag + 1]
  }
  return { dryRun, skipBuild, message }
}

function run(cmd, options = {}) {
  console.log(`\n> ${cmd}\n`)
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...options })
}

function capture(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function tryRun(cmd) {
  try {
    run(cmd)
    return true
  } catch {
    return false
  }
}

function getAddPaths() {
  const paths = [...TRACK]
  for (const file of DEPLOY_FILES) {
    if (fsSync.existsSync(path.join(ROOT, file))) paths.push(file)
  }
  return paths
}

function getWatchPaths() {
  return getAddPaths().join(' ')
}

function ensureGitRepo() {
  try {
    capture('git rev-parse --is-inside-work-tree')
  } catch {
    console.error('[deploy] not a git repository')
    process.exit(1)
  }
}

function getBranch() {
  return capture('git rev-parse --abbrev-ref HEAD')
}

function getChangeStatus() {
  return capture(`git status --porcelain -- ${getWatchPaths()}`)
}

function getUnpushedCount() {
  try {
    capture('git rev-parse --abbrev-ref @{u}')
    return Number.parseInt(capture('git rev-list --count @{u}..HEAD'), 10) || 0
  } catch {
    return 0
  }
}

function gitCommit(message) {
  const result = spawnSync('git', ['commit', '-m', message], { cwd: ROOT, stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error('git commit failed')
  }
}

function syncRemote(branch) {
  console.log('--- sync remote (pull --rebase) ---')
  if (!tryRun('git fetch origin')) {
    console.error('\n[deploy] git fetch failed, check network')
    process.exit(1)
  }

  const dirty = capture('git status --porcelain')
  let stashed = false
  if (dirty) {
    console.log('stash local changes...')
    run('git stash push -u -m "deploy-auto-stash"')
    stashed = true
  }

  const pulled = tryRun(`git pull --rebase origin ${branch}`)
  if (!pulled) {
    console.log('\n[deploy] rebase conflict, reset to origin and rebuild manifest...\n')
    tryRun('git rebase --abort')
    run(`git reset --soft origin/${branch}`)
    run('git reset')
  }

  if (stashed) {
    if (!tryRun('git stash pop')) {
      console.error('\n[deploy] stash pop conflict, run: git stash pop')
      process.exit(1)
    }
  }
}

function pushRemote(branch) {
  if (tryRun(`git push -u origin ${branch}`)) return

  console.log('\n[deploy] push rejected, sync and retry...\n')
  syncRemote(branch)

  if (!tryRun(`git push -u origin ${branch}`)) {
    console.error('\n[deploy] push failed, check network or run: git pull --rebase && git push')
    process.exit(1)
  }
}

async function printSummary() {
  try {
    const raw = await fs.readFile(path.join(ROOT, 'manifest.json'), 'utf8')
    const manifest = JSON.parse(raw)
    const items = manifest.items ?? []
    const pc = items.filter((i) => i.device === 'pc').length
    const phone = items.filter((i) => i.device === 'phone').length
    console.log('\n========================================')
    console.log('  deploy OK')
    console.log(`  total ${items.length} (PC ${pc} / phone ${phone})`)
    console.log('  manifest: GitHub raw (instant)')
    console.log('  images: CDN ~1-3 min')
    console.log('========================================\n')
  } catch {
    console.log('\n[deploy] push done\n')
  }
}

async function main() {
  const { dryRun, skipBuild, message } = parseArgs(process.argv.slice(2))
  ensureGitRepo()
  const branch = getBranch()

  console.log('\n[deploy] wallpaper-assets\n')

  console.log('--- 1/5 sync remote ---')
  if (!dryRun) syncRemote(branch)
  else console.log('[dry-run] skip')

  if (!skipBuild) {
    console.log('--- 2/5 build ---')
    run('npm run build')
  } else {
    console.log('--- 2/5 skip build ---')
  }

  console.log('--- 3/5 check changes ---')
  const status = getChangeStatus()
  if (!status) {
    if (getUnpushedCount() > 0) {
      console.log('unpushed commits, continue push...')
    } else {
      console.log('nothing to deploy')
      process.exit(0)
    }
  } else {
    console.log(status)
  }

  if (dryRun) {
    console.log('\n[dry-run] skip commit/push')
    process.exit(0)
  }

  if (status.length > 0) {
    console.log('--- 4/5 commit ---')
    run(`git add ${getAddPaths().join(' ')}`)
    gitCommit(message)
  } else {
    console.log('--- 4/5 skip commit ---')
  }

  console.log('--- 5/5 push ---')
  pushRemote(branch)

  await printSummary()
}

main().catch((err) => {
  console.error('[deploy] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
