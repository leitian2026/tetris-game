# 俄罗斯方块 (Tetris)

经典俄罗斯方块游戏，支持键盘和手机触摸操作，**支持 GitHub Actions 自动构建 APK**。

**仓库地址：** https://github.com/leitian2026/tetris-game

---

## 下载 APK（推荐）

仓库已配置自动构建，按以下步骤下载：

1. 打开仓库的 [**Actions**](https://github.com/leitian2026/tetris-game/actions) 页面
2. 点击最新的一次 **Build Android APK** 运行记录
3. 在页面底部 **Artifacts** 区域下载 `tetris-debug-apk`
4. 解压后得到 `.apk` 文件，传到手机安装即可

> 如果还没有构建记录，点击 Actions 页面右侧的 **Run workflow** 手动触发一次。

---

## 游戏功能

- 完整的 7 种方块（I / J / L / O / S / T / Z）
- 幽灵阴影预览落点
- 下一个方块预览
- 分数 / 等级 / 消除行数
- 等级越高下落越快
- 经典计分规则
- 暂停 / 重开
- 手机触摸手势 + 虚拟按钮

### 操作方式

| 操作 | 键盘 | 触摸 |
|------|------|------|
| 左移 | ← / A | 左滑 / 左按钮 |
| 右移 | → / D | 右滑 / 右按钮 |
| 加速下落 | ↓ / S | 下滑 / 下按钮 |
| 旋转 | ↑ / W / 空格 | 短按屏幕 / 旋转按钮 |
| 一键落地 | Enter | 上滑 / 一键下落按钮 |
| 暂停 | P | 暂停按钮 |
| 重开 | R | 重开按钮 |

---

## 网页版试玩

直接用浏览器打开 `index.html` 即可，无需安装依赖。

也可开启 GitHub Pages：
1. 仓库 Settings → Pages
2. Source 选 `main` 分支，文件夹选 `/ (root)`
3. 访问：`https://leitian2026.github.io/tetris-game/`

---

## 本地打包 APK（可选）

```bash
git clone https://github.com/leitian2026/tetris-game.git
cd tetris-game
npm install

# 准备网页资源
mkdir -p www
cp index.html game.js manifest.json sw.js www/

# 添加 Android 并构建
npx cap add android
npx cap sync
cd android && ./gradlew assembleDebug
```

生成的 APK 路径：
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 项目结构

```
tetris-game/
├── index.html                    # 主页面 + 样式
├── game.js                       # 游戏核心逻辑
├── manifest.json                 # PWA 配置
├── sw.js                         # Service Worker
├── package.json                  # 依赖（Capacitor）
├── capacitor.config.json         # Capacitor 配置
├── .github/workflows/build-apk.yml  # 自动构建 APK
└── README.md
```

---

## License

MIT
