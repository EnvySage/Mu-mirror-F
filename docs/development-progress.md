# Mu-mirror-F 开发进度跟踪

> 最后更新：2026-08-12
> 最新提交：`9b8099e`

## 项目概述

- **项目名称**：Mu-mirror-F（AI 日记前端）
- **技术栈**：Vue 3 + Vite + Pinia + Vue Router
- **后端地址**：localhost:9005
- **接口文档**：http://localhost:9005/api/swagger-ui/index.html
- **GitHub**：https://github.com/EnvySage/Mu-mirror-F.git

---

## 已完成功能

### 1. 认证系统（2026-08-05）

| 状态 | 功能 | 说明 |
|------|------|------|
| ✅ | 登录页面 | 统一登录/注册页面，Tab 切换 |
| ✅ | 注册功能 | 调用 `POST /api/auth/register` |
| ✅ | 登录功能 | 调用 `POST /api/auth/login`，获取 JWT Token |
| ✅ | Token 存储 | localStorage 存储 Token + 过期时间 |
| ✅ | Token 过期验证 | 刷新页面时检查 Token 是否过期 |
| ✅ | Bearer 认证 | 请求头 `Authorization: Bearer <token>` |
| ✅ | 路由守卫 | 未登录自动跳转登录页 |
| ✅ | 退出登录 | 设置页面添加退出按钮 |
| ✅ | 401 处理 | Token 无效时自动清除并跳转 |
| ⚠️ | 后端 403 | 后端安全配置问题，需后端修复 |

### 2. 记录模块 CRUD（2026-08-07）

| 状态 | 功能 | 说明 |
|------|------|------|
| ✅ | 创建记录 | `POST /records`，用户只需输入内容 |
| ✅ | 获取记录列表 | `GET /records`，支持分页和筛选 |
| ✅ | 获取记录详情 | `GET /records/{id}` |
| ✅ | 更新记录 | `PUT /records/{id}`，审查状态下修改标签 |
| ✅ | 删除记录 | `DELETE /records/{id}`，软删除 |
| ✅ | 确认审查完成 | `PUT /records/{id}/confirm`，状态改为 done |
| ✅ | 记录状态展示 | processing/reviewing/done/failed 状态区分 |
| ✅ | 审核界面 | 审查记录可修改标题/类型/情绪/关键词 |
| ✅ | 失败重试 | 失败记录可重新尝试或删除 |

### 3. 模型配置模块（2026-08-10）

| 状态 | 功能 | 说明 |
|------|------|------|
| ✅ | 获取用户配置 | `GET /settings`，API Key 脱敏返回 |
| ✅ | 更新用户配置 | `PUT /settings`，部分更新 |
| ✅ | 测试 AI 连接 | `POST /settings/test-ai` |
| ✅ | 测试数据库连接 | `POST /settings/test-db` |
| ✅ | 配置页面 | 支持编辑提供商/API Key/模型/地址 |
| ✅ | Embedding 配置 | 支持本地/API 模式切换 |

### 4. Toast 提示系统（2026-08-11）

| 状态 | 功能 | 说明 |
|------|------|------|
| ✅ | Toast Store | 全局 toast 状态管理，支持 info/success/warning/error |
| ✅ | ToastContainer 组件 | 顶部居中显示，动画流畅，移动端适配 |
| ✅ | 写日记拦截 | 模型配置不完整时显示 warning toast 并跳转设置页 |

### 5. 模型协议选择（2026-08-11）

| 状态 | 功能 | 说明 |
|------|------|------|
| ✅ | 协议选择器 | 支持 OpenAI / Anthropic 两种协议 |
| ✅ | AI 提供商字段 | 保留 ai_provider 字段的 UI |
| ✅ | 配置完整性检查 | 写日记前检查 ai_protocol、ai_api_key、ai_model |

**修改文件（2026-08-11）：**
- `src/stores/toast.js` - 新增 toast store
- `src/components/organisms/ToastContainer.vue` - 新增 toast 容器组件
- `src/stores/settings.js` - 添加 ai_protocol 字段和 isModelConfigComplete 计算属性
- `src/views/SettingsView.vue` - 添加模型协议选择器和 AI 提供商 UI
- `src/components/organisms/WriteModal.vue` - 替换 confirm 为 toast 提示
- `src/components/organisms/RecordFormModal.vue` - 替换 confirm 为 toast 提示
- `src/components/templates/MainLayout.vue` - 集成 ToastContainer，启动时获取配置

**修改文件（2026-08-10）：**
- `src/api/settings.js` - 新增设置 API 封装
- `src/api/records.js` - 更新接口：approveRecord→updateRecord+confirmReview，状态名改为 reviewing
- `src/stores/settings.js` - 对接真实 API，支持获取/更新/测试
- `src/stores/records.js` - 更新状态名和方法，适配新接口
- `src/views/SettingsView.vue` - 重写设置页面，支持编辑配置和测试连接
- `src/components/molecules/RecordCard.vue` - 状态名更新为 reviewing
- `src/components/organisms/DetailPanel.vue` - 审核流程改为 update+confirm

---

## 待办任务

### 高优先级

| 状态 | 任务 | 说明 |
|------|------|------|
| ⏳ | 记录轮询更新 | processing 状态记录需要轮询获取最新状态 |

### 中优先级

| 状态 | 任务 | 说明 |
|------|------|------|
| ⏳ | 日历导航功能 | 按月加载记录，日历标记有记录日期，点击筛选列表 |
| ⏳ | Token 刷新机制 | 当前过期需重登，后续可加 Refresh Token |
| ⏳ | 记录查询优化 | 对接分页参数，支持日期筛选 |

### 低优先级

| 状态 | 任务 | 说明 |
|------|------|------|
| ⏳ | 修改密码 | 用户设置中添加修改密码功能 |
| ⏳ | 第三方登录 | 微信/GitHub OAuth |

---

## API 接口对接状态

### 认证模块 (`/api/auth`)

| 接口 | 方法 | 状态 | 前端调用位置 |
|------|------|------|-------------|
| `/api/auth/register` | POST | ✅ 已对接 | `src/api/auth.js` |
| `/api/auth/login` | POST | ✅ 已对接 | `src/api/auth.js` |
| `/api/auth/status` | GET | ⏳ 未使用 | - |
| `/api/auth/me` | GET | ⏳ 未使用 | - |

### 记录模块 (`/records`)

| 接口 | 方法 | 状态 | 前端调用位置 |
|------|------|------|-------------|
| `/records` | POST | ✅ 已对接 | `src/api/records.js` → `src/stores/records.js` |
| `/records` | GET | ✅ 已对接 | `src/api/records.js` → `src/stores/records.js` |
| `/records/{id}` | GET | ✅ 已对接 | `src/api/records.js` → `src/stores/records.js` |
| `/records/{id}` | PUT | ✅ 已对接 | `src/api/records.js` → `src/stores/records.js` |
| `/records/{id}` | DELETE | ✅ 已对接 | `src/api/records.js` → `src/stores/records.js` |
| `/records/{id}/confirm` | PUT | ✅ 已对接 | `src/api/records.js` → `src/stores/records.js` |

> **日历功能待办**：`GET /records` 需要支持 `start` 和 `end` 查询参数，用于按月加载记录。

> **设计说明**：
> - `PUT /records/{id}` 用于在审查状态下更新标签（标题/摘要/类型/情绪/关键词）
> - `PUT /records/{id}/confirm` 用于确认审查完成，状态改为 done 并锁定
> - 审核流程：update（修改标签）→ confirm（确认完成）
> - 拒绝等同于删除（软删除）

### 用户配置模块 (`/settings`)

| 接口 | 方法 | 状态 | 前端调用位置 |
|------|------|------|-------------|
| `/settings` | GET | ✅ 已对接 | `src/api/settings.js` → `src/stores/settings.js` |
| `/settings` | PUT | ✅ 已对接 | `src/api/settings.js` → `src/stores/settings.js` |
| `/settings/test-ai` | POST | ✅ 已对接 | `src/api/settings.js` → `src/stores/settings.js` |
| `/settings/test-db` | POST | ✅ 已对接 | `src/api/settings.js` → `src/stores/settings.js` |

### 其他模块

| 模块 | 状态 | 说明 |
|------|------|------|
| 记录模块 | ✅ CRUD + 审核完成 | 增删改查 + 审核流程 |
| 设置模块 | ✅ 配置管理完成 | AI 模型/Embedding/审核模式配置 |
| 日历模块 | ⏳ 待开发 | 日历视图（UI 已有） |
| AI 镜像 | ⏳ 待开发 | AI 对话功能（UI 已有） |

---

## 本地开发环境

### 启动命令

```bash
# 前端开发服务器
npm run dev

# 访问地址
http://localhost:5173  # Vite 直连
http://localhost       # Nginx 代理
```

### Nginx 配置

- 配置文件：`C:\Users\cheng\Desktop\claude\own\nginx-1.30.4\conf\nginx.conf`
- 前端代理：`/` → `http://[::1]:5173`
- 后端代理：`/api/` → `http://127.0.0.1:9005/api/`

---

## 已知问题

### 1. 后端 403 Forbidden（2026-08-05）

**现象**：所有 API 请求返回 403

**原因**：后端 Spring Security 配置问题

**解决方案**：
```java
// SecurityConfig.java
http.csrf(csrf -> csrf.disable());
http.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/auth/login", "/api/auth/register").permitAll()
    .anyRequest().authenticated()
);
http.cors(cors -> cors.configurationSource(...));
```

### 2. Vite IPv6 监听（2026-08-05）

**现象**：Nginx 无法连接 Vite 开发服务器

**原因**：Vite 只监听 IPv6 地址

**解决方案**：Nginx 配置使用 `http://[::1]:5173`

### 3. 后端返回 camelCase 字段名（2026-08-07）✅ 已解决

**现象**：后端返回 `createdAt`、`contentType`，前端期望 `created_at`、`content_type`

**解决方案**：在 `src/api/request.js` 响应拦截器中自动转换

### 4. 日期格式不兼容（2026-08-07）✅ 已解决

**现象**：后端返回 `"2026-08-07 06:22:58"`，`new Date()` 解析为 Invalid Date

**解决方案**：在 `src/utils/time.js` 中添加 `parseDate()` 函数，将空格替换为 `T`

---

## 设计决策记录

### Token 管理策略（2026-08-06）

**当前方案**：Access Token + 过期时间存储
- 登录后存储 `token` 和 `token_expires` 到 localStorage
- 每次刷新页面检查是否过期
- 过期后清除状态，跳转登录页
- 401 错误时自动清除并跳转

**未实现**：Refresh Token 机制
- 当前 Token 过期必须重新登录
- 后续如需支持，需后端新增 `/api/auth/refresh` 接口

### 记录状态流转（2026-08-10 更新）

**状态定义**：
- `processing` - AI 正在处理
- `reviewing` - 等待用户审核（原 pending_review）
- `done` - 审核通过，记录锁定
- `failed` - 处理失败

**审核流程**：
1. 用户提交 → status=processing
2. AI 处理完成 → status=reviewing
3. 用户审核：
   - 修改标签（PUT /records/{id}）
   - 确认完成（PUT /records/{id}/confirm）→ Embedding → status=done（锁定）
   - 拒绝（DELETE /records/{id}）→ 软删除（不入 RAG）

### 模型配置管理（2026-08-10）

**接口设计**：
- `GET /settings` - 获取配置，API Key 脱敏返回
- `PUT /settings` - 部分更新，只传需要修改的字段
- `POST /settings/test-ai` - 测试 AI 连接
- `POST /settings/test-db` - 测试数据库连接

**配置字段**：
- ai_protocol: openai/anthropic（模型协议，默认 anthropic）
- ai_provider: openai/zhipu/qwen（AI 提供商）
- ai_api_key: 明文传入，后端加密存储
- ai_base_url: 可选，留空使用默认
- ai_model: 模型名称
- embedding_source: local/api
- embedding_model: Embedding 模型名
- review_mode: manual/auto

### 后端兼容性处理（2026-08-07）

**问题 1：字段命名风格**
- 后端返回 camelCase：`createdAt`、`contentType`、`userReviewed`
- 前端使用 snake_case：`created_at`、`content_type`、`user_reviewed`
- **解决方案**：在 `request.js` 响应拦截器中自动转换

**问题 2：日期格式**
- 后端返回：`"2026-08-07 06:22:58"`（空格分隔）
- `new Date()` 无法解析（需要 `T` 分隔符）
- **解决方案**：在 `time.js` 中添加 `parseDate()` 函数，将空格替换为 `T`

---

## 变更日志

### 2026-08-12

- ✅ 修复情绪标签 key 与后端不一致问题（exhausted/tired, expecting/anticipation, stressed/pressure）
- ✅ 移除已完成记录的删除按钮（只有审核阶段才能删除）
- ✅ 设计日历导航功能（按月加载、视觉标记、交互逻辑）
- ✅ 更新设计文档：新增 2.2.7 日历导航章节、API 查询参数说明

### 2026-08-11

- ✅ 创建 Toast 提示系统（toast store + ToastContainer 组件）
- ✅ 添加模型协议选择功能（OpenAI / Anthropic）
- ✅ 添加 AI 提供商字段 UI
- ✅ 写日记前检查模型配置完整性，不完整时显示 toast 提示
- ✅ 替换丑陋的 confirm 弹窗为优雅的 toast 提示
- ✅ 更新开发进度文档

### 2026-08-10

- ✅ 创建 settings API 封装（`src/api/settings.js`）
- ✅ 更新 records API，接口改为 updateRecord + confirmReview，状态名改为 reviewing
- ✅ 更新 settings store 对接真实 API，支持获取/更新/测试连接
- ✅ 更新 records store 适配新接口
- ✅ 重写 SettingsView 页面，支持编辑 AI 配置和测试连接
- ✅ 更新 RecordCard 状态名 pending_review → reviewing
- ✅ 更新 DetailPanel 审核流程：update（修改标签）→ confirm（确认完成）
- ✅ 更新开发进度文档

### 2026-08-07

- ✅ 更新 records API 接口，添加 approveRecord/rejectRecord
- ✅ 更新 records store 对接真实 API
- ✅ 更新 RecordsView/CalendarView/MirrorView 页面 onMounted 获取数据
- ✅ 更新 RecordCard 组件支持 pending_review/failed 状态展示
- ✅ 更新 DetailPanel 组件实现完整审核流程
- ✅ 更新 RecordFormModal 使用 store 创建记录
- ✅ 修复日期解析问题，兼容后端 `"2026-08-07 06:22:58"` 格式
- ✅ 添加响应拦截器自动转换 camelCase 为 snake_case
- ✅ 更新开发进度文档
- ✅ 提交并推送到 GitHub（commit `8b7e46c`）

### 2026-08-06

- ✅ 添加 Token 过期验证逻辑
- ✅ 请求头添加 Bearer 前缀
- ✅ 更新开发进度文档

### 2026-08-05

- ✅ 安装 axios
- ✅ 创建 API 服务层（request.js + auth.js）
- ✅ 重写 auth store 使用后端 JWT 认证
- ✅ 创建统一登录/注册页面
- ✅ 移除旧的本地密码解锁逻辑
- ✅ 更新路由配置
- ✅ 添加设置页退出登录按钮
- ✅ 配置 Vite 代理和 nginx 转发
- ✅ 创建记录 API 封装（records.js）
- ✅ 创建记录表单弹窗组件（RecordFormModal.vue）
- ✅ 集成表单到主布局
- ✅ 用户只需输入内容，AI 自动生成标题/摘要/标签
- ✅ 推送到 GitHub

---

## 相关文档

- [前端框架规范](./2026-07-27-frontend-framework-spec.md)
- [AI 日记镜子设计文档](./2026-07-23-ai-diary-mirror-design.md)
- [AI 服务设计](../Mu-mirror-B/docs/2026-08-04-ai-service-design.md)（后端项目）
