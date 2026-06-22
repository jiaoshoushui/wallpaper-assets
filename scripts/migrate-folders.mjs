/**
 * 一次性迁移：pc/dongman 等拼音目录 → pc/动漫 等中文目录
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SLUG_TO_CATEGORY = {
  dongman: '动漫',
  dongwu: '动物',
  fengjing: '风景',
  renwu: '人物',
  youxi: '游戏',
  qita: '其他',
}

const DEVICES = ['pc', 'phone']

async function moveFiles(srcDir, destDir) {
  let moved = 0
  try {
    const entries = await fs.readdir(srcDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const src = path.join(srcDir, entry.name)
      const dest = path.join(destDir, entry.name)
      if (entry.isDirectory()) continue
      try {
        await fs.access(dest)
        console.warn(`  skip (exists): ${path.relative(ROOT, dest)}`)
        continue
      } catch {
        // dest free
      }
      await fs.rename(src, dest)
      moved++
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') return 0
    throw err
  }
  return moved
}

async function removeIfEmpty(dir) {
  try {
    const entries = await fs.readdir(dir)
    const remaining = entries.filter((n) => n !== '.gitkeep')
    if (remaining.length === 0) {
      await fs.rm(dir, { recursive: true, force: true })
      return true
    }
  } catch {
    return false
  }
  return false
}

async function main() {
  let total = 0
  for (const device of DEVICES) {
    for (const [slug, category] of Object.entries(SLUG_TO_CATEGORY)) {
      const srcDir = path.join(ROOT, device, slug)
      const destDir = path.join(ROOT, device, category)
      await fs.mkdir(destDir, { recursive: true })
      const n = await moveFiles(srcDir, destDir)
      if (n > 0) {
        console.log(`  ${device}/${slug} → ${device}/${category}: ${n} files`)
        total += n
      }
      await removeIfEmpty(srcDir)
    }
  }
  console.log(`[migrate] moved ${total} wallpapers, removed empty slug folders`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
