# wallpaper-assets

个人站 4K 壁纸图床（jsDelivr CDN）。

## 更新壁纸（只需 3 步）

1. 把图片丢进对应分类文件夹（见下方目录）
2. `git add` → `commit` → `push`
3. GitHub Actions 自动转换 WebP、生成缩略图、更新 `manifest.json`；约 1–3 分钟后刷新网站即可

**壁纸名称 = 文件名**（不含扩展名）。例如 `pc/动漫/凉宫春日.jpg` → 网站显示「凉宫春日」。

## 分类文件夹

```
pc/人物/    pc/动物/    pc/风景/    pc/动漫/    pc/游戏/    pc/其他/
phone/人物/ phone/动物/ phone/风景/ phone/动漫/ phone/游戏/ phone/其他/
```

首次克隆后运行一次（已预创建可跳过）：

```bash
npm run init
```

支持格式：`.jpg` `.jpeg` `.png` `.webp`（push 后 CI 会转成 WebP 并生成缩略图）。

## 本地命令

```bash
npm run init      # 创建全部分类文件夹
npm run build     # 本地转换 + 更新 manifest
npm run sync      # 仅重写 manifest（不转换图片）
```

## 注意

- `manifest.json` 由脚本自动生成，**不要手改**
- 旧版拼音目录（如 `pc/dongman/`）仍兼容，建议新图用中文文件夹
- 网站通过 jsDelivr 读取本仓库，push 到 `main` 后生效
