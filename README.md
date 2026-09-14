# 俄罗斯方块 (Tetris)

经典俄罗斯方块游戏，支持键盘和手机触摸操作，可打包成 Android APK。

**在线试玩：** 打开 [https://leitian2026.github.io/tetris-game/](https://leitian2026.github.io/tetris-game/)（开启 GitHub Pages 后可用）

---

## 游戏功能

- 完整的 7 种方块（I / J / L / O / S / T / Z）
- 幽灵阴影预览落点
- 下一个方块预览
- 分数 / 等级 / 消除行数
- 等级越高下落越快
- 经典计分规则
- 暂停 / 重开

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

## 快速开始（网页版）

直接用浏览器打开 `index.html` 即可游玩，无需安装任何依赖。

---

## 打包成 Android APK

有 3 种推荐方式：

### 方法一：使用 PWA Builder（最简单，推荐）

1. 先把本仓库部署到任意静态托管（GitHub Pages / Vercel / Cloudflare Pages 等）
2. 打开 [https://www.pwabuilder.com/](https://www.pwabuilder.com/)
3. 输入你的网站地址，点击 **Start**
4. 选择 **Android** → **Generate Package**
5. 下载生成的 `.apk` 或 `.aab` 文件

### 方法二：使用 Capacitor（本地打包）

```bash
# 1. 安装依赖
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. 初始化
npx cap init "Tetris" "com.leitian.tetris" --web-dir .

# 3. 添加 Android 平台
npx cap add android

# 4. 同步文件
npx cap sync

# 5. 用 Android Studio 打开并打包
npx cap open android
```

在 Android Studio 中：`Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`

### 方法三：使用 Cordova

```bash
npm install -g cordova
cordova create tetris-app com.leitian.tetris Tetris
cd tetris-app
# 把本仓库的 index.html、game.js、manifest.json、sw.js 复制到 www 目录
cordova platform add android
cordova build android
```

生成的 APK 位于：`platforms/android/app/build/outputs/apk/`

---

## 开启 GitHub Pages（推荐先做）

1. 打开仓库 Settings → Pages
2. Source 选择 `Deploy from a branch`
3. Branch 选 `main`，文件夹选 `/ (root)`
4. 保存后等待 1～2 分钟
5. 访问：`https://leitian2026.github.io/tetris-game/`

开启后就可以用 PWA Builder 一键生成 APK。

---

## 项目结构

```
tetris-game/
├── index.html      # 主页面 + 样式
├── game.js         # 游戏核心逻辑
├── manifest.json   # PWA 配置
├── sw.js           # Service Worker（离线缓存）
└── README.md
```

---

## License

MIT
