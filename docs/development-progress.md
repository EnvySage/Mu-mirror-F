# Mu-mirror-F 开发进度跟踪

> 最后更新：2026-08-07（下午）
> 最新提交：`8b7e46c` feat: 完成记录模块 CRUD 接口对接

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
| ✅ | 获取记录列表 | `GET /records`，返回所有未删除记录 |
| ✅ | 获取记录详情 | `GET /records/{id}` |
| ✅ | 删除记录 | `DELETE /records/{id}`，软删除 |
| ✅ | 审核通过 | `POST /records/{id}/approve`，可修改标签 |
| ✅ | 审核拒绝 | `POST /records/{id}/reject`，软删除不入 RAG |
| ✅ | 记录状态展示 | processing/pending_review/done/failed 状态区分 |
| ✅ | 审核界面 | 待审核记录可修改标题/类型/情绪/关键词 |
| ✅ | 失败重试 | 失败记录可重新尝试或删除 |

**修改文件：**
- `src/api/records.js` - 更新 API 接口，移除 updateRecord，添加 approveRecord/rejectRecord
- `src/api/request.js` - 添加 camelCase → snake_case 字段名自动转换
- `src/stores/records.js` - 对接真实 API，支持 CRUD 和审核操作
- `src/utils/time.js` - 修复日期解析，兼容后端 `"2026-08-07 06:22:58"` 格式
- `src/views/RecordsView.vue` - 添加加载状态，onMounted 获取数据
- `src/views/CalendarView.vue` - onMounted 获取数据
- `src/views/MirrorView.vue` - onMounted 获取数据
- `src/components/molecules/RecordCard.vue` - 支持 pending_review/failed 状态展示
- `src/components/organisms/DetailPanel.vue` - 完整审核流程（通过/拒绝）和失败处理
- `src/components/organisms/RecordFormModal.vue` - 使用 store 创建记录

---

## 待办任务

### 高优先级

| 状态 | 任务 | 说明 |
|------|------|------|
| ⏳ | 修复后端 403 | 后端需配置 CSRF/CORS/Security |

### 中优先级

| 状态 | 任务 | 说明 |
|------|------|------|
| ⏳ | Token 刷新机制 | 当前过期需重登，后续可加 Refresh Token |
| ⏳ | 用户信息展示 | 显示当前登录用户名 |
| ⏳ | 记录轮询更新 | processing 状态记录需要轮询获取最新状态 |

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
| `/records/{id}` | DELETE | ✅ 已对接 | `src/api/records.js` → `src/stores/records.js` |
| `/records/{id}/approve` | POST | ✅ 已对接 | `src/api/records.js` → `src/stores/records.js` |
| `/records/{id}/reject` | POST | ✅ 已对接 | `src/api/records.js` → `src/stores/records.js` |

> **设计说明**：根据系统设计，没有通用的 `PUT /records/{id}` 更新接口。记录审核通过后即锁定不可修改，审核阶段是唯一的修改窗口，通过 `/approve` 接口提交修改后的标签。

### 其他模块

| 模块 | 状态 | 说明 |
|------|------|------|
| 记录模块 | ✅ CRUD + 审核完成 | 增删改查 + 审核流程 |
| 日历模块 | ⏳ 待开发 | 日历视图（UI 已有） |
| AI 镜像 | ⏳ 待开发 | AI 对话功能（UI 已有） |
| 设置模块 | ⏳ 待开发 | 用户设置 |

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

### 记录状态流转（2026-08-07）

**状态定义**：
- `processing` - AI 正在处理
- `pending_review` - 等待用户审核
- `done` - 审核通过，记录锁定
- `failed` - 处理失败
- `rejected` - 审核拒绝（软删除）

**审核流程**：
1. 用户提交 → status=processing
2. AI 处理完成 → status=pending_review
3. 用户审核：
   - 通过 → Embedding → status=done（锁定）
   - 拒绝 → 软删除（不入 RAG）

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

### 2026-08-07

- ✅ 更新 records API 接口，移除 updateRecord，添加 approveRecord/rejectRecord
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
