---

# Obsidian 的 Dify 同步插件

一个可将 Obsidian 笔记自动同步至 Dify 知识库的插件，具备智能内容哈希功能，可避免不必要的重复上传。

## 功能特色

* **手动同步**：点击侧边栏的同步按钮或使用命令面板
* **自动同步**：可设置每隔 5-120 分钟自动同步
* **智能内容检测**：通过内容哈希比较，仅同步已修改的文件
* **视觉反馈**：状态栏显示同步状态与最后同步时间
* **文件夹过滤**：可选择仅同步指定文件夹
* **错误处理**：提供清晰的错误信息和状态提示

## 安装方法

1. 将插件文件复制到你的 Obsidian 仓库的插件文件夹中：

   ```
   .obsidian/plugins/dify-sync-plugin/
   ```

2. 插件文件夹中应包含：

   * `main.js`（由 `main.ts` 编译而来）
   * `manifest.json`
   * `styles.css`

3. 打开 Obsidian 设置 > 社区插件，启用该插件

## 配置说明

前往设置 > Dify Sync Plugin 进行如下配置：

### 必填项

* **Dify API 密钥**：用于认证的 Dify API Key
* **Dify 知识库 ID**：你希望同步到的目标知识库 ID
* **Dify API 地址**：你部署的 Dify 服务地址，例如 `http://localhost:5000`

### 可选项

* **Obsidian 文件夹路径**：要同步的特定文件夹（留空则同步所有笔记）
* **启用自动同步**：是否开启定时自动同步
* **同步间隔**：自动同步的时间间隔（单位：分钟，范围 5-120）

## 使用方法

### 手动同步

* 点击左侧工具栏的同步图标
* 使用命令面板输入 “Sync to Dify Knowledge Base”
* 在插件设置页面点击 “立即同步” 按钮

### 自动同步

1. 在插件设置中启用 “自动同步”
2. 设置你希望的同步间隔
3. 插件将按设定间隔自动执行同步操作

### 状态监控

* 在右下角状态栏查看同步状态
* 绿色文本表示同步成功
* 红色文本表示出现错误
* 时间戳显示上一次同步时间

## 工作原理

1. **内容哈希**：插件会为每个文件的内容创建哈希值
2. **变更检测**：仅在文件内容或修改时间发生变更时才同步
3. **API 集成**：使用 `/v1/datasets/{id}/document/create_by_text` 接口上传文件
4. **自动向量化**：Dify 会自动处理并向量化上传的内容

## 故障排查

### 常见问题

**提示 "Cannot find module 'obsidian'" 错误**

* 请确保你使用正确的构建工具编译插件
* 运行 `npm run build` 编译 TypeScript

**同步失败，出现 HTTP 错误**

* 检查 Dify API 地址是否填写正确且可访问
* 确保 API 密钥具备所需权限
* 确认知识库 ID 是否有效

**文件没有同步**

* 检查是否启用了文件夹过滤
* 确保要同步的是 Markdown 文件（.md）
* 查看控制台日志以获取详细错误信息

### 调试模式

按下 `Ctrl+Shift+I` 打开开发者控制台，可查看详细同步日志与错误信息。

## 开发指南

### 构建插件

1. 安装依赖：

   ```bash
   npm install
   ```

2. 开发环境构建：

   ```bash
   npm run dev
   ```

3. 生产环境构建：

   ```bash
   npm run build
   ```

### 文件结构

```
dify-sync-plugin/
├── main.ts             # 插件主逻辑代码
├── manifest.json       # 插件配置清单
├── package.json        # Node.js 依赖
├── tsconfig.json       # TypeScript 配置
├── styles.css          # 插件样式文件
├── esbuild.config.mjs  # 构建配置文件
└── README.md           # 本文档
```

## API 兼容性

本插件基于 Dify API v1 构建，确保你的 Dify 部署支持以下功能：

* `/v1/datasets/{dataset_id}/document/create_by_text` 接口
* Bearer Token 身份认证
* 高质量内容向量化技术

## 许可证

MIT License — 欢迎修改与自由分发。

## 贡献方式

1. Fork 本仓库
2. 创建新的功能分支
3. 编写并提交你的修改
4. 充分测试
5. 提交 Pull Request（合并请求）

## 技术支持

如遇问题或有功能建议，请优先查看控制台日志，并在反馈时附上详细错误信息。

---
