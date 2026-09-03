# Mirror 前端框架规范

> 版本：v1.1
> 日期：2026-07-27
> 状态：待审核

---

## 一、技术栈选型

### 1.1 核心框架

| 技术 | 版本 | 用途 | 选型理由 |
|------|------|------|----------|
| **Vue 3** | 3.5+ | UI 框架 | 组合式 API，JavaScript 支持好 |
| **Vite** | 6.x | 构建工具 | 快速 HMR，原生 ESM |
| **JavaScript** | ES2020+ | 开发语言 | 灵活快速，原型已用纯 JS 实现 |
| **Pinia** | 2.x | 状态管理 | Vue 3 官方推荐，支持组合式写法 |
| **Vue Router** | 4.x | 路由 | 认证流程 + 页面导航 |

### 1.2 UI 方案

**不使用 Element Plus。** 原因：原型设计是 Apple 风格（圆角、磨砂玻璃、极简），Element Plus 的设计语言（扁平、蓝色系、紧凑）与之冲突，覆盖样式的工作量比自建还大。

**不使用 Tailwind CSS。** 原因：原型已有完整的 CSS 样式体系（设计令牌、组件样式、响应式断点、动画），直接用 CSS 自定义属性 + scoped 样式还原原型即可，引入 Tailwind 反而增加抽象层和维护成本。

推荐方案：

| 技术 | 用途 |
|------|------|
| **CSS 自定义属性** | 从原型提取的设计令牌（颜色、圆角、阴影、字体），全局统一 |
| **Scoped CSS** | 组件级样式，直接从原型 `.class` 映射到 Vue 组件 |
| **自建组件库** | 基于原型提取的组件，保持 Apple 设计一致性 |
| **@vueuse/core** | 工具函数（useMediaQuery、useStorage、useDebounceFn 等） |
| **axios** | HTTP 请求封装 |

### 1.3 可选依赖

| 技术 | 用途 | 是否必须 |
|------|------|----------|
| **vue-markdown** | 渲染 AI 回答中的 markdown | P1 阶段再加 |
| **chart.js** / **echarts** | 活动统计可视化 | P2 阶段再加 |
| **@vueuse/core** | 响应式工具函数 | 推荐一开始就加 |

---

## 二、项目目录结构

```
mirror-frontend/
├── public/                          # 静态资源
│   └── favicon.svg
├── src/
│   ├── api/                         # API 请求层
│   │   ├── index.js                 # axios 实例 + 拦截器
│   │   ├── auth.js                  # 认证相关 API
│   │   ├── records.js               # 记录相关 API
│   │   ├── mirror.js                # 镜子画像 API
│   │   ├── chat.js                  # 对话相关 API
│   │   ├── summaries.js             # 总结相关 API
│   │   ├── settings.js              # 配置相关 API
│   │   └── inspiration.js           # 灵感 API
│   │
│   ├── assets/                      # 构建时处理的资源
│   │   └── styles/
│   │       ├── variables.css        # 设计令牌（CSS 自定义属性）
│   │       ├── base.css             # 全局重置 + 基础样式
│   │       ├── components.css       # 全局组件样式（标签、按钮、卡片等原型样式）
│   │       └── transitions.css      # 动画/过渡定义
│   │
│   ├── components/                  # 组件（按原子设计分层）
│   │   ├── atoms/                   # 原子：最小不可分割的 UI 单元
│   │   │   ├── MButton.vue          # 按钮（primary/secondary/icon）
│   │   │   ├── MTag.vue             # 标签（type/mood/keyword/processing）
│   │   │   ├── MInput.vue           # 输入框（text/password）
│   │   │   ├── MTextarea.vue        # 文本域（自动增高）
│   │   │   ├── MToggle.vue          # 开关
│   │   │   ├── MCheckbox.vue        # 复选框
│   │   │   ├── MIcon.vue            # 图标（SVG 内联）
│   │   │   ├── MAvatar.vue          # 头像
│   │   │   ├── MDivider.vue         # 分隔线
│   │   │   ├── MDateSeparator.vue   # 日期分隔
│   │   │   ├── MEmptyState.vue      # 空状态
│   │   │   └── MSectionLabel.vue    # 大写标签（"AI 模型" 等）
│   │   │
│   │   ├── molecules/               # 分子：由原子组成的可复用单元
│   │   │   ├── RecordCard.vue       # 记录卡片
│   │   │   ├── CalendarDay.vue      # 日历日期格子
│   │   │   ├── ChatMessage.vue      # 聊天气泡
│   │   │   ├── ReviewTag.vue        # 审核标签（可选中）
│   │   │   ├── ReviewField.vue      # 审核字段（标签 + 标题）
│   │   │   ├── SettingsItem.vue     # 设置项（图标 + 文字 + 右侧控件）
│   │   │   ├── PortraitSection.vue  # 画像维度区块
│   │   │   ├── MoodBar.vue          # 情绪分布条
│   │   │   ├── StatBlock.vue        # 统计数字块
│   │   │   ├── ProcessingStep.vue   # 处理步骤指示
│   │   │   ├── WelcomeFeature.vue   # 欢迎页特性项
│   │   │   ├── StrengthBar.vue      # 密码强度条
│   │   │   └── CalendarLegend.vue   # 日历图例
│   │   │
│   │   ├── organisms/               # 组织：较大的功能区块
│   │   │   ├── AppSidebar.vue       # 桌面侧边栏
│   │   │   ├── BottomNav.vue        # 移动端底部导航
│   │   │   ├── PageHeader.vue       # 页面标题栏（磨砂玻璃）
│   │   │   ├── RecordList.vue       # 记录列表（日期分组）
│   │   │   ├── CalendarWidget.vue   # 日历组件（迷你/完整两种模式）
│   │   │   ├── MirrorHero.vue       # 镜子顶部渐变横幅
│   │   │   ├── PortraitGrid.vue     # 画像维度网格
│   │   │   ├── ChatSection.vue      # 对话区域（消息列表 + 输入框）
│   │   │   ├── SettingsGrid.vue     # 设置分组网格
│   │   │   ├── WriteModal.vue       # 写日记模态框
│   │   │   ├── DetailPanel.vue      # 记录详情滑入面板
│   │   │   ├── ProcessingView.vue   # AI 处理中动画
│   │   │   ├── ReviewView.vue       # 标签审核视图
│   │   │   └── AuthCard.vue         # 认证卡片容器
│   │   │
│   │   └── templates/               # 模板：整页布局壳
│   │       ├── MainLayout.vue       # 主布局（侧边栏 + 内容区 + 底部导航）
│   │       └── AuthLayout.vue       # 认证布局（居中卡片）
│   │
│   ├── composables/                 # 组合式函数（逻辑复用）
│   │   ├── useAuth.js               # 认证状态 + token 管理
│   │   ├── useRecords.js            # 记录 CRUD + 处理状态轮询
│   │   ├── useMirror.js             # 镜子画像
│   │   ├── useChat.js               # 对话管理
│   │   ├── useCalendar.js           # 日历逻辑（月份切换、日期选择）
│   │   ├── useReview.js             # 标签审核流程
│   │   ├── useResponsive.js         # 响应式断点检测
│   │   └── useProcessing.js         # AI 处理步骤动画
│   │
│   ├── constants/                   # 常量定义
│   │   ├── tags.js                  # 内容类型、情绪、状态的完整定义
│   │   └── index.js                 # 其他常量
│   │
│   ├── router/                      # 路由配置
│   │   └── index.js                 # 路由定义 + 导航守卫
│   │
│   ├── stores/                      # Pinia 状态管理
│   │   ├── auth.js                  # 认证状态
│   │   ├── records.js               # 记录数据
│   │   ├── mirror.js                # 镜子画像
│   │   ├── chat.js                  # 对话数据
│   │   ├── settings.js              # 配置数据
│   │   └── ui.js                    # UI 状态（当前页、弹窗、响应式）
│   │
│   ├── utils/                       # 工具函数
│   │   ├── time.js                  # timeAgo、formatDate 等
│   │   ├── storage.js               # localStorage 封装（token、设置）
│   │   └── text.js                  # 文本截断、关键词提取等
│   │
│   ├── views/                       # 页面视图（路由级别组件）
│   │   ├── auth/
│   │   │   ├── WelcomeView.vue      # 欢迎页（首次使用）
│   │   │   └── UnlockView.vue       # 解锁页（密码验证）
│   │   ├── RecordsView.vue          # 记录页（列表 + 详情）
│   │   ├── CalendarView.vue         # 日历页（移动端）
│   │   ├── MirrorView.vue           # 镜子页（画像 + 对话）
│   │   └── SettingsView.vue         # 设置页
│   │
│   ├── App.vue                      # 根组件
│   └── main.js                      # 入口文件
│
├── index.html                       # HTML 入口
├── vite.config.js                   # Vite 配置
├── jsconfig.json                    # JavaScript 配置（路径别名等）
├── package.json
├── .env                             # 默认环境变量
├── .env.development                 # 开发环境
└── .env.production                  # 生产环境
```

---

## 三、组件设计规范

### 3.1 命名约定

| 类别 | 前缀 | 示例 |
|------|------|------|
| 原子组件 | `M`（Mirror） | `MButton`、`MTag`、`MInput` |
| 分子组件 | 无前缀，语义命名 | `RecordCard`、`ChatMessage` |
| 组织组件 | 无前缀，功能命名 | `AppSidebar`、`WriteModal` |
| 视图页面 | `View` 后缀 | `RecordsView`、`MirrorView` |
| 组合式函数 | `use` 前缀 | `useAuth`、`useRecords` |
| Store | 语义命名 | `auth`、`records`、`ui` |

### 3.2 原子组件规范

#### MButton

```
Props:
  - variant: 'primary' | 'secondary' | 'ghost' | 'icon'
  - size: 'sm' | 'md' | 'lg'
  - disabled: boolean
  - loading: boolean

Slots:
  - default（按钮文字）
  - icon（图标位置）

样式映射：
  primary  → 原型 .btn-primary（accent 背景，白字）
  secondary → 原型 .btn-secondary（bg 背景）
  ghost    → 无背景，hover 显示
  icon     → 纯图标按钮（如日历导航、发送）
```

#### MTag

```
Props:
  - variant: 'type' | 'mood' | 'keyword' | 'processing'
  - mood: 'happy' | 'calm' | 'anxious' | 'sad' | 'tired' | ... （当 variant=mood 时）
  - clickable: boolean

样式映射：
  type       → accent-light 背景（蓝紫色）
  mood       → 根据 mood 子类型变色：
               happy/satisfied/grateful → success-light（绿色）
               calm/excited/anticipation/bored/confused → accent-light（蓝紫）
               anxious → warning-light（橙色）
               sad/angry → danger-light（红色）
               tired → 紫色（#F3F0FF / #7C3AED）
  keyword    → 灰色背景，# 前缀
  processing → 蓝紫色，脉冲动画
```

#### MInput

```
Props:
  - type: 'text' | 'password'
  - modelValue: string
  - placeholder: string
  - error: string | null
  - disabled: boolean

Events:
  - update:modelValue

样式：原型 .form-input（14px padding，1.5px 边框，focus 有 accent 光环）
```

#### MToggle

```
Props:
  - modelValue: boolean

Events:
  - update:modelValue

样式：原型 .toggle（44x26 药丸，on 时 accent 背景 + 滑块右移）
```

#### MIcon

```
Props:
  - name: string （图标名称）
  - size: number （默认 20）

实现：内联 SVG，viewBox="0 0 24 24"，stroke-based
图标集：从原型中提取的所有 SVG 图标，建立名称 → SVG 路径映射表
```

#### MEmptyState

```
Props:
  - icon: string （图标名称）
  - title: string
  - description: string

样式：原型 .empty-state（居中，accent-light 圆形图标背景）
```

### 3.3 分子组件规范

#### RecordCard

```
Props:
  - record: Record

Events:
  - click

内部组成：
  MDateSeparator（可选）→
  .record-meta（MTag[type] + MTag[mood]* + 时间）→
  标题 →
  摘要（2行截断）→
  MTag[keyword]*

状态：
  processing → 显示脉冲 "AI 整理中" 标签，隐藏标题/摘要
  done       → 正常显示所有字段
  failed     → 显示错误提示 + 重试按钮
```

#### ChatMessage

```
Props:
  - message: Message

内部组成：
  气泡（user=右/蓝，ai=左/白）→
  来源引用列表（仅 ai 消息）

交互：
  - 点击来源链接 → 跳转到对应记录
```

#### SettingsItem

```
Props:
  - icon: string
  - iconBg: string （图标背景色）
  - label: string
  - description: string
  - action: 'chevron' | 'toggle' | 'custom'

Slots:
  - action（自定义右侧控件）

Events:
  - click（当 action=chevron 时）
```

#### PortraitSection

```
Props:
  - icon: string
  - iconBg: string
  - title: string

Slots:
  - default（卡片内容）
  - evidence（来源证据列表）
```

### 3.4 组织组件规范

#### AppSidebar

```
布局：
  header（Logo）→
  nav（记录/镜子/设置）→
  stats（数据概览 4 宫格）→
  calendar（迷你日历）→
  write-btn（写日记 CTA）→
  footer（用户头像）

从 stores/ui.ts 读取 currentPage，从 stores/records.ts 读取统计数据
响应式：仅 ≥900px 显示
```

#### BottomNav

```
布局：
  5 个 nav-item：记录 | 日历 | 写日记(凸起) | 镜子 | 设置

从 stores/ui.ts 读取 currentPage
响应式：仅 <900px 显示
```

#### WriteModal

```
Props:
  - visible: boolean

Events:
  - close
  - submit(content: string)

内部状态：
  - textarea 内容
  - 字符计数（0/500）
  - 提交按钮 enabled 状态

流程：
  打开 → 输入 → 提交 → 调用 stores/records.createRecord() → 关闭
```

#### DetailPanel

```
Props:
  - record: Record | null
  - visible: boolean

Events:
  - close
  - review(recordId) → 进入审核流程
  - retry(recordId) → 重新处理
  - confirm(reviewData) → 确认审核

内部模式：
  - processing → ProcessingView
  - done       → 详情展示
  - failed     → 错误 + 重试
  - reviewing  → ReviewView
```

---

## 四、状态管理设计（Pinia Stores）

### 4.1 store/ui.ts — UI 全局状态

```JavaScript
// 最小化的全局 UI 状态，其他数据由各自的 store 管理
interface UIState {
  currentPage: 'records' | 'calendar' | 'mirror' | 'settings'
  isMobile: boolean              // < 900px
  showWriteModal: boolean
  selectedRecordId: number | null
  detailMode: 'view' | 'review' | 'processing' | 'failed'
}
```

**职责：**
- 页面切换
- 弹窗开关
- 响应式断点检测（使用 @vueuse/core 的 useMediaQuery）
- 选中记录 ID

**不存放：** 记录数据、用户数据、设置数据（各自 store 管理）

### 4.2 store/auth.ts — 认证状态

```JavaScript
interface AuthState {
  hasUser: boolean
  needPassword: boolean
  isAuthenticated: boolean
  token: string | null
  tokenExpiresAt: number | null
}
```

**职责：**
- 启动时调用 `GET /api/auth/status` 初始化
- 登录/设置密码后存储 token
- Token 过期检测
- 提供 `authGuard` 给路由守卫

**持久化：** token 和 expiresAt 存 localStorage

### 4.3 store/records.ts — 记录数据

```JavaScript
interface RecordsState {
  records: Record[]
  loading: boolean
  error: string | null
}
```

**职责：**
- 记录列表 CRUD
- 新建记录后，轮询状态直到 `processing → done/failed`
- 审核确认后更新记录
- 提供按日期分组的计算属性

**关键方法：**
- `fetchRecords()` — 获取列表
- `createRecord(content)` — 创建记录（status=processing）
- `pollRecordStatus(id)` — 轮询处理状态
- `reviewRecord(id, reviewData)` — 提交审核
- `retryRecord(id)` — 重试失败记录

### 4.4 store/mirror.ts — 镜子画像

```JavaScript
interface MirrorState {
  profile: MirrorProfile | null
  generating: boolean
  error: string | null
}
```

**职责：**
- 获取/缓存画像
- 触发重新生成
- 按维度获取详细数据

### 4.5 store/chat.ts — 对话数据

```JavaScript
interface ChatState {
  sessions: ChatSession[]
  currentSessionId: string | null
  messages: Message[]
  loading: boolean
  sending: boolean
}
```

**职责：**
- 会话列表管理
- 当前会话的消息历史
- 发送消息（多轮对话，带 sessionId）
- 创建/删除会话

### 4.6 store/settings.ts — 配置数据

```JavaScript
interface SettingsState {
  settings: UserSettings | null
  loading: boolean
  aiTestResult: TestResult | null
  dbTestResult: TestResult | null
}
```

**职责：**
- 获取/更新配置
- 测试 AI 连接
- 测试数据库连接

---

## 五、路由设计

### 5.1 路由表

```JavaScript
const routes = [
  {
    path: '/',
    component: MainLayout,       // 主布局壳
    meta: { requiresAuth: true },
    children: [
      { path: '',           redirect: '/records' },
      { path: 'records',    component: RecordsView,    name: 'records' },
      { path: 'calendar',   component: CalendarView,   name: 'calendar' },
      { path: 'mirror',     component: MirrorView,     name: 'mirror' },
      { path: 'settings',   component: SettingsView,   name: 'settings' },
    ]
  },
  {
    path: '/auth',
    component: AuthLayout,       // 认证布局壳
    children: [
      { path: '',        redirect: '/auth/welcome' },
      { path: 'welcome', component: WelcomeView, name: 'welcome' },
      { path: 'unlock',  component: UnlockView,  name: 'unlock' },
    ]
  }
]
```

### 5.2 导航守卫逻辑

```
app 启动
  ↓
authStore.init()  →  GET /api/auth/status
  ↓
┌─ !hasUser        →  /auth/welcome  （首次使用）
├─ hasUser && needPassword  →  /auth/unlock  （需要密码）
└─ hasUser && !needPassword →  /records  （直接进入）
  ↓
登录成功后 → isAuthenticated = true → /records
```

**守卫实现：**
- 全局 `beforeEach`：检查 `authStore.isAuthenticated`，未认证则跳转 `/auth`
- `/auth` 路由：已认证则重定向到 `/records`

### 5.3 移动端路由适配

- 桌面端（≥900px）：`/records` 左右分栏（列表 + 详情）
- 移动端（<900px）：`/records` 仅列表，点击后 DetailPanel 滑入覆盖
- `/calendar` 路由仅在移动端有意义，桌面端可重定向到 `/records`

---

## 六、API 请求层设计

### 6.1 axios 实例（api/index.ts）

```
配置：
  - baseURL: 从 .env 读取（VITE_API_BASE_URL）
  - timeout: 15000ms
  - headers: Content-Type: application/json

请求拦截器：
  - 从 authStore 读取 token
  - 注入 Authorization: Bearer {token}

响应拦截器：
  - 401 → 清除 token，跳转 /auth/unlock
  - 500 → 统一错误提示
  - 其他 → 返回 response.data
```

### 6.2 API 模块划分

每个模块一个文件，导出函数：

```
api/auth.ts        → getStatus(), verify(), setup(), change(), clear()
api/records.ts     → list(), get(id), create(content), update(id, data), delete(id), review(id, data)
api/mirror.ts      → getProfile(), generate(), getDimension(dim)
api/chat.ts        → send(message, sessionId?), getSessions(), getSessionHistory(id), deleteSession(id)
api/summaries.ts   → list(), get(date), generate(date)
api/settings.ts    → get(), update(data), testAi(), testDb()
api/inspiration.ts → getInspiration(currentInput)
```

### 6.3 轮询机制

记录创建后，AI 异步处理。前端需要轮询状态：

```
createRecord(content)
  → 返回 { id, status: 'processing' }
  → 启动 pollRecordStatus(id)
    → 每 2 秒 GET /api/records/{id}
    → 直到 status !== 'processing'
    → 更新 store，停止轮询
    → 如果 status = 'done'，自动进入审核流程（取决于 review_mode）
    → 如果 status = 'failed'，显示错误
```

---

## 七、样式架构

### 7.1 CSS 自定义属性（设计令牌）

直接从原型 `mirror-prototype.html` 和 `mirror-auth.html` 提取，保持原始命名：

```css
/* variables.css — 设计令牌 */
:root {
  /* 颜色系统 */
  --bg: #F5F5F7;
  --surface: #FFFFFF;
  --text-primary: #1D1D1F;
  --text-secondary: #6E6E73;
  --text-tertiary: #AEAEB2;
  --accent: #4F46E5;
  --accent-light: #EEF0FF;
  --accent-hover: #4338CA;
  --border: #E8E8ED;
  --success: #34C759;
  --success-light: #E8F9ED;
  --warning: #FF9F0A;
  --warning-light: #FFF4E5;
  --danger: #FF3B30;
  --danger-light: #FFE5E3;
  --processing: #5856D6;
  --processing-light: #F0F0FF;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.1);

  /* 圆角 */
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-full: 9999px;

  /* 字体 */
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Noto Sans CJK SC", sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Consolas", monospace;

  /* 布局 */
  --nav-height: 60px;
  --sidebar-width: 280px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

### 7.2 全局基础样式

从原型提取的 reset + 基础排版：

```css
/* base.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; -webkit-tap-highlight-color: transparent; }
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text-primary);
  line-height: 1.6;
  overflow: hidden;
  height: 100dvh;
  width: 100vw;
}
```

### 7.3 全局组件样式

原型中可复用的 UI 元素样式，放在 `components.css` 中供全局使用：

```
标签：  .tag, .tag-type, .tag-mood, .tag-mood.anxious, .tag-mood.sad, .tag-mood.tired,
        .tag-processing, .keyword
按钮：  .btn, .btn-primary, .btn-secondary
输入：  .form-input, .form-input:focus, .form-input.error
开关：  .toggle, .toggle.on
复选：  .checkbox, .checkbox.checked
分隔：  .divider
空状态：.empty-state, .empty-icon, .empty-title, .empty-desc
日期分隔：.date-separator
卡片：  .record-card, .record-card:hover, .record-card.active
```

这些样式直接从原型 HTML 的 `<style>` 中提取，保持完全一致。

### 7.4 组件级样式

Vue 组件内部使用 `<style scoped>`，类名直接对应原型：

```vue
<template>
  <div class="record-card" @click="$emit('click')">
    <div class="record-meta">
      <span class="record-time">{{ timeAgo }}</span>
      <div class="record-tags">
        <span class="tag tag-type">{{ typeLabel }}</span>
      </div>
    </div>
    <div class="record-title">{{ record.title }}</div>
    <div class="record-summary">{{ record.summary }}</div>
  </div>
</template>

<style scoped>
/* 样式从原型的 .record-card 相关 CSS 直接复制 */
.record-card { background: var(--surface); border-radius: var(--radius-md); ... }
</style>
```

### 7.5 样式使用规则

| 场景 | 方式 | 示例 |
|------|------|------|
| 颜色、圆角、阴影 | CSS 变量 | `background: var(--accent)` |
| 布局、间距 | 直接写 CSS | `padding: 16px 18px; display: flex; gap: 8px;` |
| 组件样式 | `<style scoped>` | 从原型复制对应 `.class` |
| 全局标签/按钮 | `components.css` | `.tag`, `.btn-primary` |
| 响应式 | `@media (min-width: 900px)` | 与原型断点一致 |
| 动画 | `transitions.css` | `@keyframes fadeIn` |

### 7.6 响应式断点

与原型保持一致，仅一个断点：

```css
/* 桌面端 ≥900px */
@media (min-width: 900px) {
  .sidebar { display: flex; }
  .bottom-nav { display: none !important; }
  .page-title { font-size: 32px; }
  /* ... 其他桌面端样式 */
}

/* 移动端 <900px（默认） */
@media (max-width: 899px) {
  .sidebar-calendar { display: none !important; }
}
```

### 7.7 动画规范

所有动画定义在 `transitions.css` 中：

```
关键帧：
  @keyframes fadeIn       → 用于页面切换、审核视图出现
  @keyframes spin         → 处理中旋转圈
  @keyframes tagPulse     → processing 标签脉冲
  @keyframes dotPulse     → 处理步骤圆点脉冲
  @keyframes msgIn        → 聊天消息出现
  @keyframes slideInRight → 详情面板滑入

过渡：
  .page 切换    → opacity + translateY, 0.2s ease
  模态框        → opacity + scale, 0.3s cubic-bezier(0.32, 0.72, 0, 1)
  详情面板      → translateX, 0.35s cubic-bezier(0.32, 0.72, 0, 1)
  卡片 hover    → box-shadow + translateY, 0.15s ease
  标签选中      → border-color + background, 0.15s ease
  按钮点击      → transform scale(0.98), 0.15s
```

---

## 八、常量定义

### 8.1 constants/tags.ts

```JavaScript
// 内容类型（8 个）
export const CONTENT_TYPES = [
  { key: 'todo',     label: '待办', icon: '...' },
  { key: 'thought',  label: '感想', icon: '...' },
  { key: 'learning', label: '学习', icon: '...' },
  { key: 'plan',     label: '计划', icon: '...' },
  { key: 'note',     label: '随记', icon: '...' },
  { key: 'work',     label: '工作', icon: '...' },
  { key: 'social',   label: '社交', icon: '...' },
  { key: 'health',   label: '健康', icon: '...' },
] as const

// 情绪（13 个，分组）
export const MOOD_GROUPS = {
  positive: [
    { key: 'happy',        label: '开心', emoji: '😊' },
    { key: 'excited',      label: '兴奋', emoji: '🚀' },
    { key: 'satisfied',    label: '满足', emoji: '✨' },
    { key: 'grateful',     label: '感恩', emoji: '🙏' },
    { key: 'anticipation', label: '期待', emoji: '🌈' },
  ],
  neutral: [
    { key: 'calm',     label: '平静', emoji: '😐' },
    { key: 'bored',    label: '无聊', emoji: '😶' },
    { key: 'confused', label: '困惑', emoji: '🤔' },
  ],
  negative: [
    { key: 'anxious', label: '焦虑', emoji: '😰' },
    { key: 'sad',     label: '难过', emoji: '😢' },
    { key: 'angry',   label: '愤怒', emoji: '😠' },
    { key: 'tired',   label: '疲惫', emoji: '😫' },
    { key: 'pressure',label: '压力', emoji: '😤' },
  ],
} as const

// 情绪 → 标签颜色映射
export const MOOD_COLOR_MAP: Record<string, string> = {
  happy: 'success', satisfied: 'success', grateful: 'success',
  excited: 'accent', anticipation: 'accent', calm: 'accent',
  bored: 'accent', confused: 'accent',
  anxious: 'warning',
  sad: 'danger', angry: 'danger',
  tired: 'purple',
  pressure: 'warning',
}

// 记录状态标签（3 个，仅 todo/plan 有效）
export const STATUS_TAGS = [
  { key: 'pending',    label: '未开始' },
  { key: 'in_progress', label: '进行中' },
  { key: 'done',       label: '已完成' },
] as const

// 处理状态（3 个）
export const PROCESSING_STATUS = ['processing', 'done', 'failed'] as const

// 审核模式（3 个）
export const REVIEW_MODES = [
  { key: 'full_manual', label: '全手动', desc: '每条都审核' },
  { key: 'semi_auto',   label: '半自动', desc: 'AI 处理完确认（默认）' },
  { key: 'full_auto',   label: '全自动', desc: 'AI 直接保存' },
] as const
```

---

## 九、数据结构定义（JSDoc 注释）

> 不使用 TypeScript，用 JSDoc 注释 + IDE 类型推导提供类型提示。

### 9.1 数据结构：record

```JavaScript
export type ProcessingStatus = 'processing' | 'done' | 'failed'
export type ContentType = 'todo' | 'thought' | 'learning' | 'plan' | 'note' | 'work' | 'social' | 'health'
export type MoodKey = 'happy' | 'excited' | 'satisfied' | 'grateful' | 'anticipation'
  | 'calm' | 'bored' | 'confused'
  | 'anxious' | 'sad' | 'angry' | 'tired' | 'pressure'
export type StatusTag = 'pending' | 'in_progress' | 'done'

export interface Record {
  id: number
  content: string
  title: string | null
  summary: string | null
  content_type: ContentType | null
  mood: MoodKey[]
  processing_status: ProcessingStatus
  task_status: StatusTag | null      // 仅 todo/plan 有效
  user_reviewed: boolean
  keywords: string[]
  created_at: string
  updated_at: string
}

export interface ReviewData {
  title: string
  content_type: ContentType
  mood: MoodKey[]
  keywords: string[]
}
```

### 9.2 数据结构：mirror

```JavaScript
export interface MirrorProfile {
  id: number
  profile_json: MirrorProfileData
  generated_at: string
}

export interface MirrorProfileData {
  unfinished_tasks: string[]
  recent_learning: string[]
  mood_distribution: { mood: string; percentage: number }[]
  personal_tags: string[]
  life_rhythm: {
    active_hours: string
    recent_record_count: number
    frequency: string
  }
}
```

### 9.3 数据结构：chat

```JavaScript
export interface ChatSession {
  id: string           // UUID
  title: string | null
  last_message_at: string
  created_at: string
}

export interface Message {
  id: number
  session_id: string
  role: 'user' | 'assistant'
  content: string
  sources: SourceRef[] | null
  created_at: string
}

export interface SourceRef {
  record_id: number
  quote: string
  date: string
}
```

### 9.4 数据结构：auth

```JavaScript
export interface AuthStatus {
  needPassword: boolean
  hasUser: boolean
}

export interface AuthResult {
  success: boolean
  token: string | null
  expiresIn: number
}

export type ReviewMode = 'full_manual' | 'semi_auto' | 'full_auto'
```

### 9.5 数据结构：settings

```JavaScript
export interface UserSettings {
  id: string
  user_id: string
  access_password: string | null
  llm_api_url: string | null
  llm_api_key: string | null
  llm_model: string | null
  db_url: string | null
  review_mode: ReviewMode
  created_at: string
  updated_at: string
}
```

### 9.6 数据结构：api

```JavaScript
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface TestResult {
  success: boolean
  message: string
}
```

---

## 十、组合式函数设计

### 10.1 设计原则

- 每个 composable 封装一个完整的业务逻辑单元
- 内部调用对应的 store 和 api
- 返回响应式状态 + 操作方法
- 组件只需调用 composable，不直接操作 store/api

### 10.2 composables/useAuth.ts

```
返回：
  - hasUser: Ref<boolean>
  - needPassword: Ref<boolean>
  - isAuthenticated: Ref<boolean>
  - init(): Promise<void>          → 调用 /api/auth/status
  - login(password): Promise<void> → 验证密码 + 存 token
  - setup(password): Promise<void> → 设置密码
  - logout(): void                 → 清除 token
```

### 10.3 composables/useRecords.ts

```
返回：
  - records: Ref<Record[]>
  - loading: Ref<boolean>
  - groupedRecords: ComputedRef<{ date: string, items: Record[] }[]>
  - fetchRecords(): Promise<void>
  - createRecord(content: string): Promise<void>
  - reviewRecord(id: number, data: ReviewData): Promise<void>
  - retryRecord(id: number): Promise<void>
  - deleteRecord(id: number): Promise<void>
```

### 10.4 composables/useCalendar.ts

```
返回：
  - currentDate: Ref<Date>
  - selectedDate: Ref<Date | null>
  - calendarDays: ComputedRef<CalendarDay[]>
  - recordsForDate: ComputedRef<Record[]>
  - changeMonth(delta: number): void
  - selectDate(date: Date): void
```

### 10.5 composables/useProcessing.ts

```
返回：
  - currentStep: Ref<number>     → 0/1/2/3
  - stepStates: ComputedRef<('idle' | 'active' | 'done')[]>
  - startProcessing(): void      → 启动步骤动画序列
  - onComplete: () => void       → 完成回调

实现：setTimeout 链，每步 800ms
```

### 10.6 composables/useResponsive.ts

```
返回：
  - isMobile: ComputedRef<boolean>  → < 900px
  - isDesktop: ComputedRef<boolean> → ≥ 900px

实现：@vueuse/core 的 useMediaQuery('(min-width: 900px)')
```

---

## 十一、环境变量

### .env（默认）

```
VITE_API_BASE_URL=/api
VITE_APP_TITLE=Mirror
```

### .env.development

```
VITE_API_BASE_URL=http://localhost:8080/api
```

### .env.production

```
VITE_API_BASE_URL=/api
```

---

## 十二、开发规范约定

### 12.1 文件规范

| 规则 | 说明 |
|------|------|
| 组件文件名 | PascalCase（`RecordCard.vue`） |
| composable 文件名 | camelCase，use 前缀（`useRecords.js`） |
| store 文件名 | camelCase（`records.js`） |
| 常量文件名 | camelCase（`tags.js`） |
| 工具文件名 | camelCase（`time.js`） |

### 12.2 组件结构

每个 `.vue` 文件遵循统一结构：

```
<script setup>
  // 1. 导入
  // 2. Props 定义
  // 3. Emits 定义
  // 4. 组合式函数调用
  // 5. 本地状态
  // 6. 计算属性
  // 7. 方法
  // 8. 生命周期
</script>

<template>
  <!-- 模板 -->
</template>

<style scoped>
  /* 从原型对应 .class 复制样式 */
</style>
```

### 12.3 状态管理规则

| 数据类型 | 放在哪里 | 理由 |
|----------|----------|------|
| 全局 UI 状态 | stores/ui.ts | 跨页面共享 |
| 认证状态 | stores/auth.ts | 全局需要 |
| 记录数据 | stores/records.ts | 多页面引用 |
| 画像数据 | stores/mirror.ts | 独立模块 |
| 对话数据 | stores/chat.ts | 独立模块 |
| 配置数据 | stores/settings.ts | 独立模块 |
| 组件内部状态 | 组件 ref() | 不需要共享 |

### 12.4 样式优先级

1. **CSS 变量** — 颜色、圆角、阴影、字体（`var(--accent)` 等）
2. **`components.css`** — 全局可复用样式（`.tag`、`.btn-primary`、`.record-card` 等）
3. **`<style scoped>`** — 组件特有样式，从原型对应 `.class` 复制
4. **`variables.css`** — 设计令牌定义，仅修改一次
5. **`transitions.css`** — 全局动画定义

---

## 十三、开发顺序建议

### 第一步：项目初始化
- Vite 创建 Vue + JavaScript 项目
- 安装依赖（pinia、vue-router、axios、@vueuse/core）
- 从原型提取 CSS 变量 → `variables.css`
- 从原型提取全局样式 → `base.css` + `components.css` + `transitions.css`
- 搭建目录结构

### 第二步：基础层
- types/ — 所有类型定义
- constants/tags.ts — 常量
- api/index.ts — axios 实例
- stores/ui.ts + stores/auth.ts — 基础状态
- router/index.ts — 路由 + 守卫
- composables/useAuth.ts + composables/useResponsive.ts

### 第三步：原子组件
- MButton、MTag、MInput、MTextarea、MToggle、MCheckbox
- MIcon（图标集）、MAvatar、MEmptyState、MSectionLabel

### 第四步：布局模板
- MainLayout.vue（侧边栏 + 内容区 + 底部导航的响应式壳）
- AuthLayout.vue（居中卡片壳）
- AppSidebar.vue + BottomNav.vue + PageHeader.vue

### 第五步：认证流程
- WelcomeView.vue + UnlockView.vue
- AuthCard.vue + WelcomeFeature.vue + StrengthBar.vue
- 串联登录流程

### 第六步：记录功能（P0）
- stores/records.ts + api/records.ts
- composables/useRecords.ts + useProcessing.ts + useReview.ts
- RecordCard.vue + RecordList.vue
- WriteModal.vue + DetailPanel.vue + ProcessingView.vue + ReviewView.vue
- RecordsView.vue

### 第七步：镜子功能（P0）
- stores/mirror.ts + stores/chat.ts
- api/mirror.ts + api/chat.ts
- MirrorHero.vue + PortraitGrid.vue + PortraitSection.vue + MoodBar.vue
- ChatSection.vue + ChatMessage.vue
- MirrorView.vue

### 第八步：设置功能
- stores/settings.ts + api/settings.ts
- SettingsItem.vue + SettingsGrid.vue
- SettingsView.vue

### 第九步：日历功能
- composables/useCalendar.ts
- CalendarWidget.vue + CalendarDay.vue + CalendarLegend.vue
- CalendarView.vue

---

## 十四、变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-07-27 | v1.0 | 初始框架规范，覆盖技术选型、目录结构、组件设计、状态管理、路由、API 层、样式架构 |
| 2026-07-27 | v1.1 | 去除 Tailwind CSS，改用纯 CSS 自定义属性 + scoped 样式还原原型 Apple 风格 |
