/**
 * 壁纸图床构建：按 pc/、phone/ 子文件夹分类，文件名即壁纸名称
 *
 *   npm run init     创建全部分类文件夹
 *   npm run build    转换图片 + 缩略图 + manifest.json
 *   npm run sync     仅扫描 pc/ phone/ 重写 manifest（不转换）
 *
 * 用法：把图片丢进对应文件夹后 push，GitHub Actions 会自动 build 并更新 manifest
 *
 *   pc/动漫/凉宫春日.jpg
 *   phone/人物/某某.png
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const FORCE = process.argv.includes('--force')
const MANIFEST_ONLY = process.argv.includes('--manifest-only')

const DEVICES = [
  { key: 'pc', maxWidth: 3840, quality: 86 },
  { key: 'phone', maxWidth: 1440, quality: 84 },
]

const CATEGORIES = ['人物', '动物', '风景', '动漫', '游戏', '其他']
const CATEGORY_SLUG = {
  人物: 'renwu',
  动物: 'dongwu',
  风景: 'fengjing',
  动漫: 'dongman',
  游戏: 'youxi',
  其他: 'qita',
}

const SLUG_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_SLUG).map(([label, slug]) => [slug, label]),
)

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])

function titleFromFilename(filePath) {
  const base = path.basename(filePath)
  const ext = path.extname(base)
  return decodeURIComponent(base.slice(0, base.length - ext.length)).trim()
}

function categoryFromFolder(folderName) {
  if (CATEGORIES.includes(folderName)) return folderName
  return SLUG_TO_CATEGORY[folderName] ?? null
}

function makeId(deviceKey, category, relPath) {
  const slug = CATEGORY_SLUG[category]
  const hash = createHash('md5').update(`${deviceKey}:${relPath}`).digest('hex').slice(0, 8)
  return `${deviceKey}-${slug}-${hash}`
}

async function walkImages(dir, base = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkImages(full, base)))
    } else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) {
      files.push({
        abs: full,
        rel: path.relative(base, full).replace(/\\/g, '/'),
      })
    }
  }
  return files
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function fileStatSafe(file) {
  try {
    return await fs.stat(file)
  } catch {
    return null
  }
}

async function ensureThumb(fullAbs, thumbAbs) {
  const thumbStat = await fileStatSafe(thumbAbs)
  const fullStat = await fs.stat(fullAbs)
  if (!FORCE && thumbStat && thumbStat.mtimeMs >= fullStat.mtimeMs) return

  await ensureDir(path.dirname(thumbAbs))
  await sharp(fullAbs)
    .rotate()
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toFile(thumbAbs)
}

async function convertToWebp(abs, outAbs, maxWidth, quality) {
  const meta = await sharp(abs).metadata()
  const width = meta.width ?? 0
  let pipeline = sharp(abs).rotate()
  if (width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true })
  }
  await ensureDir(path.dirname(outAbs))
  await pipeline.webp({ quality, effort: 4 }).toFile(outAbs)
  return sharp(outAbs).metadata()
}

/** 处理 pc/、phone/ 分类子文件夹内的图片 */
async function buildFromDeviceFolders(device, convert = true) {
  const deviceRoot = path.join(ROOT, device.key)
  try {
    await fs.access(deviceRoot)
  } catch {
    return []
  }

  const items = []
  const images = await walkImages(deviceRoot, deviceRoot)

  for (const { abs, rel } of images) {
    const parts = rel.split('/')
    if (parts.length < 2) continue

    const folderName = parts[0]
    const category = categoryFromFolder(folderName)
    if (!category) continue

    const slug = CATEGORY_SLUG[category]
    const ext = path.extname(rel).toLowerCase()
    const title = titleFromFilename(rel)
    const baseName = path.basename(rel, path.extname(rel))
    const webpFileName = `${baseName}.webp`
    const webpAbs = path.join(deviceRoot, folderName, webpFileName)

    if (ext !== '.webp') {
      const webpAlready = await fileStatSafe(webpAbs)
      if (webpAlready) continue
    }

    const webpRel = `${folderName}/${webpFileName}`
    const thumbRel = `thumb/${device.key}/${slug}/${webpFileName}`
    const thumbAbs = path.join(ROOT, thumbRel)
    const fullRel = `${device.key}/${webpRel}`.replace(/\\/g, '/')
    const id = makeId(device.key, category, fullRel)

    if (ext !== '.webp') {
      if (!convert) continue
      const sourceStat = await fs.stat(abs)
      const outStat = await fileStatSafe(webpAbs)
      if (!FORCE && outStat && outStat.mtimeMs >= sourceStat.mtimeMs) {
        // already converted
      } else {
        await convertToWebp(abs, webpAbs, device.maxWidth, device.quality)
      }
    } else if (path.resolve(abs) !== path.resolve(webpAbs)) {
      // webp with non-.webp extension edge case — use as-is
    } else if (convert && FORCE) {
      await convertToWebp(abs, webpAbs, device.maxWidth, device.quality)
    }

    const webpPath = ext === '.webp' ? abs : webpAbs
    const webpExists = await fileStatSafe(webpPath)
    if (!webpExists) continue

    await ensureThumb(webpPath, thumbAbs)

    const meta = await sharp(webpPath).metadata()
    const fileStat = await fs.stat(webpPath)
    items.push({
      id,
      title,
      device: device.key,
      category,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      sizeBytes: fileStat.size,
      thumb: thumbRel,
      full: fullRel,
      source: rel,
    })
  }

  return items
}

async function writeManifest(items) {
  const deduped = new Map()
  for (const item of items) {
    deduped.set(item.full, item)
  }
  const list = [...deduped.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  const manifest = {
    version: new Date().toISOString(),
    categories: CATEGORIES,
    devices: ['pc', 'phone'],
    items: list,
  }
  await fs.writeFile(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  return list.length
}

async function main() {
  if (MANIFEST_ONLY) {
    console.log('[wallpaper-assets] sync — scan pc/ phone/')
    const items = []
    for (const device of DEVICES) {
      items.push(...(await buildFromDeviceFolders(device, false)))
    }
    const count = await writeManifest(items)
    console.log(`[wallpaper-assets] done — ${count} wallpapers → manifest.json`)
    return
  }

  console.log('[wallpaper-assets] build', FORCE ? '(force)' : '(incremental)')
  const items = []
  for (const device of DEVICES) {
    const batch = await buildFromDeviceFolders(device, true)
    console.log(`  ${device.key}: ${batch.length} wallpapers`)
    items.push(...batch)
  }
  const count = await writeManifest(items)
  console.log(`[wallpaper-assets] done — ${count} wallpapers → manifest.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
