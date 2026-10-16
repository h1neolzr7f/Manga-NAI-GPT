# Smoke 167 — v1.6.7 新手界面回归 Desu 画风

本机实拍（`http://127.0.0.1:8770`，Playwright + Chrome），浅色主题强调色 `#b8573c`、背景 `#f3efe2`。

- `home-light.png` — 平铺任务格 + 浅分隔标签（常用 / 进阶 / 专业）+「新」角标
- `home-tip.png` — 右下角紧凑更新提示（非全屏导览）
- `home-dark.png` — 深色主题

自动化：`node scripts/ui-166-novice-test.cjs`（断言无重分区标题、有 rail / tip）。
