# wallpaper-assets

个人站 4K 壁纸图床（jsDelivr CDN）。

## 一键部署（推荐）

把图片丢进分类文件夹后，任选一种方式部署：

| 方式 | 操作 |
|------|------|
| **双击 (Windows)** | 运行 `deploy.bat`；若乱码改用 `deploy.ps1` 或 `deploy.cmd` |
| **命令行** | `npm run deploy` |
| **自定义说明** | `npm run deploy -- -m "新增手机动漫壁纸"` |

脚本会自动：`build` → `git add` → `commit` → `push` → GitHub Actions 二次同步。

预览不提交：`npm run deploy -- --dry-run`

## 更新壁纸

1. 把图片丢进对应分类文件夹
2. 运行一键部署（见上）
3. 刷新网站壁纸页

**壁纸名称 = 文件名**（不含扩展名）。例如 `pc/动漫/凉宫春日.jpg` → 网站显示「凉宫春日」。

若文件名是乱码 hash，可运行 `npm run rename` 按 git 历史中的原始文件名提取场景名并重命名（需先保留 `scripts/.old-manifest.json` 或由脚本从 git 拉取）。

## 分类文件夹

```
pc/人物/    pc/动物/    pc/风景/    pc/动漫/    pc/游戏/    pc/其他/
phone/人物/ phone/动物/ phone/风景/ phone/动漫/ phone/游戏/ phone/其他/
```

首次克隆后运行一次（已预创建可跳过）：

```bash
npm run init
```

支持格式：`.jpg` `.jpeg` `.png` `.webp`

## 本地命令

```bash
npm run init          # 创建全部分类文件夹
npm run build         # 本地转换 + 更新 manifest
npm run sync          # 仅重写 manifest（不转换图片）
npm run rename:dry    # 预览按场景重命名
npm run rename        # 按场景重命名并重算分类
npm run deploy        # 一键 build + commit + push
npm run deploy -- -m "说明"   # 自定义 commit 信息
npm run deploy -- --dry-run   # 仅构建，不提交
```

## 注意

- `manifest.json` 由脚本自动生成，**不要手改**
- 网站 manifest 走 GitHub raw，push 后几乎即时；图片 CDN 约 1–3 分钟
