# StarryMidiVisualizer

基于 Node.js 开发的 MIDI 可视化渲染器，支持包括 Android 在内的多种平台。

[![Node.js](https://img.shields.io/badge/-Node.js-44cc11?style=flat-square&logo=Node.js)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/starry-midi-visualizer?style=flat-square)](https://www.npmjs.com/package/starry-midi-visualizer)
[![GitHub](https://img.shields.io/github/license/StarSky919/starry-midi-visualizer?style=flat-square)](https://github.com/StarSky919/starry-midi-visualizer/blob/main/LICENSE)

## 安装

### 准备工作

#### Windows / Linux / macOS

1. 下载并安装 [Node.js](https://nodejs.org/) (最低 v18，建议使用 LTS 版本)。

2. 安装 Yarn。

```bash
# 安装 Yarn
npm install -g yarn
```

3. 下载并安装 [FFmpeg](https://ffmpeg.org/)，确保其在命令行中可用。

```bash
# 检查 FFmpeg 版本
ffmpeg -version
```

#### Android

1. 下载并安装 [Termux](https://github.com/termux/termux-app)。

2. 在 Termux 中依次执行以下命令 (若加载速度过慢，请使用 `termux-change-repo` 更换国内源)：

```bash
# 更新软件包
pkg update && pkg upgrade

# 安装必要的依赖和运行环境
pkg install openssl nodejs-lts python3 libpixman libcairo pango xorgproto libexpat ffmpeg

# 防止 node-gyp 报错
mkdir ~/.gyp && echo "{'variables':{'android_ndk_path':''}}" > ~/.gyp/include.gypi

# 安装 Yarn
npm install -g yarn
```

### 选择安装方式

#### 全局安装 (推荐)

- 提供命令行工具

- 在任意目录下快捷使用

```bash
yarn global add starry-midi-visualizer
```

#### 作为依赖 (尚未完善)

- 安装到 Node.js 项目中

- 通过 API 进行二次开发

```bash
yarn add starry-midi-visualizer
```

## 使用方法

全局安装后，可以使用 `smv` 命令。

若不提供参数，程序将会扫描并列出当前目录下的所有 .mid 文件以供选择。

```
Usage:
  smv [options] [arguments]

Options:
  -h, --help                 print help (this message)
  -v, --version              print version
  -r, --resolution <value>   output video resolution (default: 1920x1080)
  -f, --framerate <fps>      output video framerate (default: 60)
  --crf <value>              ffmpeg crf (default: 16)
  -o, --output <path>        output video file (default: <input filename>.mp4)
  -b, --bgcolor <hex>        background color (default: 0x000000)
  -k, --keyh <pixels>        keyboard height (default: 156)
  -l, --line <hex>           shows a colored line on keyboard
  -c, --colormode <mode>     note color based on 'channel' or 'track' (default: channel)
  --border                   apply borders to notes and disable highlight
  -s, --notespeed <ratio>    pixPerTick = vHeight / 2 / TPQN * <ratio> (default: 1)
  -t, --starttime <seconds>  set the start time offset (default: -1)
  -d, --duration <seconds>   set the cut duration

Examples:
  smv song.mid
  smv -r 2560x1440 -k 208 -s 1.5
  smv song.mid -b 0xC0C0C0 --border -o ../Videos/song.mp4
```

### 设置内存限制

Node.js 默认的内存限制在 1 GB 左右，能够加载约 800 万音符的 MIDI 文件。设置环境变量可以提升此限制。

> 以下命令设置的环境变量只在当前 Shell 窗口有效。若需要永久生效，请使用 `setx` 命令 (Windows) 或是修改配置文件。

#### Windows

```bash
# 设置内存限制为 8192 MB
set NODE_OPTIONS="--max-old-space-size=8192"
```

#### Linux / macOS / Android

```bash
# 设置内存限制为 4096 MB
export NODE_OPTIONS="--max-old-space-size=4096"
```

## API 参考

🤔