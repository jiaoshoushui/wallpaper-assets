# wallpaper-assets

个人站 4K 壁纸图床（jsDelivr CDN）。

## 目录结构

```
4K/PC/          待处理 PC 壁纸（可建子目录：人物、动物、风景…）
4K/PHONE/       待处理手机壁纸
pc/             构建输出（WebP 4K）
phone/          构建输出
thumb/          缩略图
manifest.json   网站自动读取的索引（勿手改）
```

## 更新壁纸

1. 把图片放进 `4K/PC/` 或 `4K/PHONE/`（可按分类分子文件夹）
2. 运行：

```bash
npm install
npm run build
git add .
git commit -m "update wallpapers"
git push
```

3. 网站会从 `cdn.jsdelivr.net/gh/jiaoshoushui/wallpaper-assets@main/manifest.json` 自动拉取最新列表，**无需改主站代码**。

## 分类

自动识别 + 文件夹优先。支持：`人物` `动物` `风景` `动漫` `游戏` `其他`
