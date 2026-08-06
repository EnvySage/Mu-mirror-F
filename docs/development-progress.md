# Mu-mirror-F 开发进度跟踪

> 最后更新：2026-08-05（更新：添加记录创建功能）

## 项目概述

- **项目名称**：Mu-mirror-F（AI 日记前端）
- **技术栈**：Vue 3 + Vite + Pinia + Vue Router
- **后端地址**：localhost:9005
- **GitHub**：https://github.com/EnvySage/Mu-mirror-F.git

---

## 已完成功能

### 1. 认证系统（2026-08-05）

| 状态 | 功能 | 说明 |
|------|------|------|
| ✅ | 登录页面 | 统一登录/注册页面，Tab 切换 |
| ✅ | 注册功能 | 调用 `POST /api/auth/register` |
| ✅ | 登录功能 | 调用 `POST /api/auth/login`，获取 JWT Token |
| ✅ | Token 存储 | localStorage 存储 Token 和用户信息 |
| ✅ | 路由守卫 | 未登录自动跳转登录页 |
| ✅ | 退出登录 | 设置页面添加退出按钮 |
| ⚠️ | 后端 403 | 后端安全配置问题，需后端修复 |

**新增文件：**
- `src/api/request.js` - axios 实例 + 拦截器
- `src/api/auth.js` - 认证 API 封装

**修改文件：**
- `src/stores/auth.js` - 重写为后端 API 认证
- `src/views/auth/WelcomeView.vue` - 统一登录/注册页面
- `src/router/index.js` - 更新路由配置
- `src/views/SettingsView.vue` - 添加退出登录按钮
- `vite.config.js` - 添加 API 代理配置

**删除文件：**
- `src/views/auth/UnlockView.vue` - 移除旧的本地密码解锁

### 2. 记录模块（2026-08-05）

| 状态 | 功能 | 说明 |
|------|------|------|
| ✅ | 创建记录 | 调用 `POST /records`，支持标题/内容/类型/心情/关键词 |
| ✅ | 记录表单 | 弹窗表单，包含所有字段 |
| ✅ | 类型选择 | 8种内容类型（待办/想法/学习/计划/笔记/工作/社交/健康） |
| ✅ | 心情标签 | 8种心情选择，支持多选 |
| ✅ | 关键词 | 支持添加多个关键词标签 |

**新增文件：**
- `src/api/records.js` - 记录 API 封装
- `src/components/organisms/RecordFormModal.vue` - 记录表单弹窗

**修改文件：**
- `src/components/templates/MainLayout.vue` - 集成新表单组件

---

## 待办任务

### 高优先级

| 状态 | 任务 | 说明 |
|------|------|------|
| ⏳ | 修复后端 403 | 后端需配置 CSRF/CORS/Security |
| ⏳ | Token 过期处理 | 401 时自动跳转登录 |

### 中优先级

| 状态 | 任务 | 说明 |
|------|------|------|
| ⏳ | 用户信息展示 | 显示当前登录用户名 |
| ⏳ | 修改密码 | 用户设置中添加修改密码功能 |

### 低优先级

| 状态 | 任务 | 说明 |
|------|------|------|
| ⏳ | 记住我功能 | 长期 Token 存储 |
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
| `/records` | POST | ✅ 已对接 | `src/api/records.js` |
| `/records` | GET | ⏳ 未使用 | - |
| `/records/{id}` | GET | ⏳ 未使用 | - |
| `/records/{id}` | PUT | ⏳ 未使用 | - |
| `/records/{id}` | DELETE | ⏳ 未使用 | - |

### 其他模块

| 模块 | 状态 | 说明 |
|------|------|------|
| 记录模块 | ✅ 已对接创建接口 | 创建记录表单已完成 |
| 日历模块 | ⏳ 待开发 | 日历视图 |
| AI 镜像 | ⏳ 待开发 | AI 对话功能 |
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

---

## 变更日志

### 2026-08-05

- ✅ 安装 axios
- ✅ 创建记录 API 封装（records.js）
- ✅ 创建记录表单弹窗组件（RecordFormModal.vue）
- ✅ 集成表单到主布局
- ✅ 支持8种内容类型选择
- ✅ 支持8种心情标签选择
- ✅ 支持关键词标签管理
- ✅ 创建 API 服务层（request.js + auth.js）
- ✅ 重写 auth store 使用后端 JWT 认证
- ✅ 创建统一登录/注册页面
- ✅ 移除旧的本地密码解锁逻辑
- ✅ 更新路由配置
- ✅ 添加设置页退出登录按钮
- ✅ 配置 Vite 代理和 nginx 转发
- ✅ 推送到 GitHub

---

## 相关文档

- [前端框架规范](./2026-07-27-frontend-framework-spec.md)
- [AI 服务设计](../Mu-mirror-B/docs/2026-08-04-ai-service-design.md)（后端项目）
