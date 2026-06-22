/**
 * 创建 pc/、phone/ 下全部中文分类文件夹（可重复运行）
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const CATEGORIES = ['人物', '动物', '风景', '动漫', '游戏', '其他']
const DEVICES = ['pc', 'phone']

async function main() {
  for (const device of DEVICES) {
    for (const category of CATEGORIES) {
      const dir = path.join(ROOT, device, category)
      await fs.mkdir(dir, { recursive: true })
      const keep = path.join(dir, '.gitkeep')
      try {
        await fs.access(keep)
      } catch {
        await fs.writeFile(keep, '', 'utf8')
      }
    }
  }
  console.log('[wallpaper-assets] folders ready:')
  for (const device of DEVICES) {
    console.log(`  ${device}/` + CATEGORIES.join(', '))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
