# 🗺️ 旅行助手 Travel Assistant

> 智能旅行规划工具：输入多个目的地，自动规划最优游览路线、标注地图、推荐周边景点

## ✨ 功能特性

- 📍 多地点地图标注
- 🔄 最优游览顺序规划（最近邻算法）
- 📏 地点间距离计算
- ⭐ 周边景点推荐
- 🗺️ 高德地图集成（无需翻墙）

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/arno52hjy/travel-assistant.git
cd travel-assistant
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置 API Key
复制 `.env.example` 为 `.env`，填入高德地图 API Key：
VITE_AMAP_KEY=你的高德JS_API_Key
VITE_AMAP_SCODE=你的高德安全密钥
> 申请地址：https://lbs.amap.com

### 4. 启动项目
```bash
npm run dev
```

## 🛠️ 技术栈
- React + TypeScript + Vite
- 高德地图 JS API 1.4
- Tailwind CSS

## 📝 License
MIT