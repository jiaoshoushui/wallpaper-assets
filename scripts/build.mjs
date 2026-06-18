/**
 * 从 4K/PC、4K/PHONE（或子目录分类）生成 WebP + 缩略图 + manifest.json
 *
 * 用法：
 *   npm run build          增量（跳过未变化的源文件）
 *   npm run build:force    全量重建
 *
 * 分类目录（可选，优先级高于自动识别）：
 *   4K/PC/人物/xxx.jpg
 *   4K/PHONE/动漫/xxx.jpg
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const FORCE = process.argv.includes('--force')

const DEVICES = [
  { key: 'pc', sourceDir: '4K/PC', maxWidth: 3840, quality: 86 },
  { key: 'phone', sourceDir: '4K/PHONE', maxWidth: 1440, quality: 84 },
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

const KEYWORDS = [
  ['动物', /cat|dog|fox|bird|wolf|dragon|tiger|bear|animal|panda|猫|狗|狐|龙|兽|鸟|虎/i],
  ['人物', /girl|boy|portrait|beauty|model|woman|man|少女|少年|人像|cos|角色/i],
  ['风景', /landscape|mountain|sea|ocean|sky|forest|lake|sunset|cityscape|夜景|风景|山|海|林|湖/i],
  ['游戏', /game|genshin|honkai|zelda|lol|原神|崩坏|游戏|王者/i],
  ['动漫', /anime|manga|illust|upscayl|wallpaper|动漫|二次元|番/i],
]

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])

function guessCategory(relativePath, width, height, device) {
  const folderParts = relativePath.split(/[/\\]/).map((p) => p.trim())
  for (const part of folderParts) {
    if (CATEGORIES.includes(part)) return part
  }

  const name = relativePath.toLowerCase()
  for (const [cat, re] of KEYWORDS) {
    if (re.test(name)) return cat
  }

  if (device === 'phone' && height > width * 1.15) return '人物'
  if (width > height * 1.35) return '风景'
  return '动漫'
}

async function walkImages(dir, base = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
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

function makeId(deviceKey, category, rel) {
  const slug = CATEGORY_SLUG[category]
  const hash = createHash('md5').update(`${deviceKey}:${rel}`).digest('hex').slice(0, 8)
  return `${deviceKey}-${slug}-${hash}`
}

function makeTitle(category, rel) {
  const raw = path.basename(rel, path.extname(rel))
  const cleaned = decodeURIComponent(raw)
    .replace(/@\d+w[^.]*$/i, '')
    .replace(/\.(jpg|jpeg|png|webp)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (/[\u4e00-\u9fff]/.test(cleaned) && cleaned.length >= 2 && cleaned.length <= 24) {
    return cleaned
  }
  if (/upscayl|realesrgan/i.test(cleaned)) return `${category}壁纸（增强）`
  return `${category}壁纸`
}

async function convertOne({ abs, rel, device, cfg }) {
  const meta = await sharp(abs).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const category = guessCategory(rel, width, height, device.key)
  const slug = CATEGORY_SLUG[category]
  const id = makeId(device.key, category, rel)
  const fileName = `${id}.webp`

  const outFull = path.join(ROOT, device.key, slug, fileName)
  const outThumb = path.join(ROOT, 'thumb', device.key, slug, fileName)

  const sourceStat = await fs.stat(abs)
  const outStat = await fileStatSafe(outFull)
  if (!FORCE && outStat && outStat.mtimeMs >= sourceStat.mtimeMs) {
    const thumbMeta = await sharp(outFull).metadata()
    return {
      id,
      title: makeTitle(category, rel),
      device: device.key,
      category,
      width: thumbMeta.width ?? width,
      height: thumbMeta.height ?? height,
      thumb: path.relative(ROOT, outThumb).replace(/\\/g, '/'),
      full: path.relative(ROOT, outFull).replace(/\\/g, '/'),
      source: rel,
      skipped: true,
    }
  }

  await ensureDir(path.dirname(outFull))
  await ensureDir(path.dirname(outThumb))

  let fullPipeline = sharp(abs).rotate()
  if (width > cfg.maxWidth) {
    fullPipeline = fullPipeline.resize({ width: cfg.maxWidth, withoutEnlargement: true })
  }
  await fullPipeline.webp({ quality: cfg.quality, effort: 4 }).toFile(outFull)

  await sharp(abs)
    .rotate()
    .resize({ width: 520, withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toFile(outThumb)

  const outMeta = await sharp(outFull).metadata()

  return {
    id,
    title: makeTitle(category, rel),
    device: device.key,
    category,
    width: outMeta.width ?? width,
    height: outMeta.height ?? height,
    thumb: path.relative(ROOT, outThumb).replace(/\\/g, '/'),
    full: path.relative(ROOT, outFull).replace(/\\/g, '/'),
    source: rel,
    skipped: false,
  }
}

async function cleanOutput() {
  for (const dir of ['pc', 'phone', 'thumb']) {
    await fs.rm(path.join(ROOT, dir), { recursive: true, force: true })
  }
}

async function main() {
  console.log('[wallpaper-assets] build start', FORCE ? '(force)' : '(incremental)')
  if (FORCE) await cleanOutput()

  const items = []
  for (const device of DEVICES) {
    const sourceRoot = path.join(ROOT, device.sourceDir)
    try {
      await fs.access(sourceRoot)
    } catch {
      console.log(`  skip ${device.sourceDir} (not found)`)
      continue
    }

    const images = await walkImages(sourceRoot)
    console.log(`  ${device.key}: ${images.length} source files`)

    for (let i = 0; i < images.length; i++) {
      try {
        const item = await convertOne({
          abs: images[i].abs,
          rel: images[i].rel,
          device,
          cfg: device,
        })
        items.push(item)
      } catch (err) {
        console.warn(`    skip corrupt: ${images[i].rel}`, err instanceof Error ? err.message : err)
      }
      if ((i + 1) % 25 === 0 || i + 1 === images.length) {
        console.log(`    ${device.key}: ${i + 1}/${images.length}`)
      }
    }
  }

  items.sort((a, b) => a.id.localeCompare(b.id))

  const manifest = {
    version: new Date().toISOString(),
    categories: CATEGORIES,
    devices: ['pc', 'phone'],
    items,
  }

  await fs.writeFile(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`[wallpaper-assets] done — ${items.length} wallpapers → manifest.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
