# Frontend Design System - SecurityWeb

本文档记录 SecurityWeb 前端的完整设计逻辑，是所有新功能设计的参考标准。

---

## 1. 整体设计原则

### 1.1 Terminal 黑客美学

整个网站采用 **Terminal 黑客美学**风格，核心特点：

- **绿色主调** - 使用 `--terminal-green` 作为主强调色
- **命令行界面** - 融入 `$` 提示符、命令风格输出
- **Monospace 字体** - 数字、时间、状态使用等宽字体
- **扫描线条纹** - 装饰性背景效果
- **网格背景** - 营造技术感
- **发光效果** - hover 时的渐变发光边框
- **脉冲动画** - 活跃状态的指示灯效果

### 1.2 设计优先级

1. **功能性优先** - 所有 UI 必须服务於功能
2. **一致性** - 严格遵循本设计系统
3. **极简主义** - 只添加必要的装饰
4. **现代感** - 使用最新 CSS 技术 (OKLCH、Tailwind v4)

---

## 2. 颜色系统

### 2.1 OKLCH 色彩空间

使用 OKLCH 颜色格式，便于色相/亮度/饱和度分离：

```css
/* 格式: oklch(L C H) */
oklch(0.72 0.19 145)  /* L=亮度, C=饱和度, H=色相 */
```

### 2.2 基础颜色

| 变量 | 浅色模式 | 深色模式 | 用途 |
|------|----------|----------|------|
| `--background` | `oklch(0.985 0 0)` | `oklch(0.11 0 0)` | 页面主背景 |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.92 0 0)` | 文字主色 |
| `--card` | `oklch(1 0 0)` | `oklch(0.15 0 0)` | 卡片背景 |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.92 0 0)` | 卡片文字 |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.22 0 0)` | 次级背景 |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.65 0 0)` | 次级文字 |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 8%)` | 边框 |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 12%)` | 输入框 |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.72 0.19 145)` | 聚焦环 |

### 2.3 模块主题色

| 模块 | CSS 变量 | 浅色模式 | 深色模式 | HSL 色相 |
|------|---------|----------|----------|----------|
| SOC | `--color-soc` | `oklch(0.65 0.16 220)` | `oklch(0.72 0.18 220)` | 蓝色 220° |
| Threat | `--color-threat` | `oklch(0.65 0.2 25)` | `oklch(0.75 0.22 25)` | 红色 25° |
| Pentest | `--color-pentest` | `oklch(0.6 0.18 150)` | `oklch(0.7 0.2 150)` | 绿色 150° |

### 2.4 Terminal 强调色

| 变量 | 值 | 用途 |
|------|------|------|
| `--terminal-green` | `oklch(0.72 0.19 145)` | 主强调、成功、安全状态 |
| `--terminal-amber` | `oklch(0.75 0.18 75)` | 警告、待处理状态 |

### 2.5 使用方式

```tsx
// CSS 变量引用
className="text-[var(--terminal-green)]"
className="bg-[var(--soc)]/10"
className="border-[var(--border)]"

// Tailwind 兼容写法
className="bg-[--terminal-green]"
```

---

## 3. 布局系统

### 3.1 AppShell 架构

```
AppShell
├── Sidebar (固定宽度 ~16rem/64px，移动端可折叠)
│   ├── Logo + 品牌名
│   ├── 导航菜单 (动态生成)
│   └── 底部 (主题切换 / 设置 / 版本号)
└── MainContent (弹性宽度)
    └── page (动画过渡切换)
```

### 3.2 响应式断点

```css
/* 默认: 移动优先 */
grid-cols-1        /* 手机 */
sm:grid-cols-2      /* 小平板 */
lg:grid-cols-3      /* 大平板 */
xl:grid-cols-4      /* 桌面 */
```

### 3.3 间距系统

使用 Tailwind 标准间距，保持一致：

- `p-4` / `p-5` / `p-6` - 内边距
- `gap-2` / `gap-4` / `gap-6` - 间隙
- `space-y-2` / `space-y-4` / `space-y-6` - 垂直间距

---

## 4. 组件规范

### 4.1 卡片组件

**基础结构：**

```tsx
<div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
  {/* 内容 */}
</div>
```

**Hover 效果：**

```tsx
<div className="group hover:border-[var(--terminal-green)]/50 transition-all duration-300">
  {/* 背景渐变 */}
  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-[var(--terminal-green)]/5 to-transparent" />
</div>
```

**扫描线效果（可选）：**

```tsx
<div className="absolute inset-0 pointer-events-none overflow-hidden">
  <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.02)_50%)] bg-[length:100%_4px]" />
</div>
```

### 4.2 角落装饰（模块卡片）

```tsx
<div className="absolute top-0 right-0 w-20 h-20 overflow-hidden">
  <div className="absolute top-0 right-0 w-[1px] h-8 bg-gradient-to-l from-[var(--terminal-green)]/30 to-transparent" />
  <div className="absolute top-0 right-0 h-[1px] w-8 bg-gradient-to-b from-[var(--terminal-green)]/30 to-transparent" />
</div>
```

### 4.3 状态指示点

```tsx
<div className="w-2 h-2 rounded-full bg-green-500" />           // 完成
<div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />  // 进行中
<div className="w-2 h-2 rounded-full bg-red-500" />            // 失败
```

### 4.4 模块图标背景

```tsx
// SOC - 蓝色
<div className="bg-[var(--soc)]/10 text-[var(--soc)]">

// Threat - 红色
<div className="bg-[var(--threat)]/10 text-[var(--threat)]">

// Pentest - 绿色
<div className="bg-[var(--pentest)]/10 text-[var(--pentest)]">
```

---

## 5. 动画系统

### 5.1 页面切换动画

```css
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.4s ease-out forwards;
}
```

### 5.2 交错动画

```tsx
// 列表项交错延迟
animation-delay: ${index * 50}ms

// 卡片交错
animation-delay: ${delay}ms  /* 0, 100, 200ms */
```

### 5.3 脉冲发光

```css
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 8px oklch(0.72 0.19 145 / 0.4);
  }
  50% {
    box-shadow: 0 0 16px oklch(0.72 0.19 145 / 0.6);
  }
}
```

### 5.4 光标闪烁

```css
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

---

## 6. 阴影系统

### 6.1 阴影层级

```css
.shadow-card           /* 微弱 - 基础卡片 */
.shadow-card-elevated  /* 适中 - 主要操作 */
.shadow-floating     /* 强烈 - 浮层/弹窗 */
.shadow-glow-green   /* 绿发光 - Terminal 效果 */
.shadow-glow-amber   /* 黄发光 - 警告效果 */
.shadow-inner        /* 内阴影 - inset元素 */
```

### 6.2 发光效果

```css
box-shadow: 0 0 20px oklch(0.72 0.19 145 / 0.3);
```

---

## 7. 字体系统

### 7.1 字体选择

- **主字体** - `--font-sans` (系统无衬线)
- **等宽字体** - `--font-mono` (数字、代码、状态)

### 7.2 使用场景

```tsx
// 数字、统计
className="text-3xl font-bold font-mono"

// 时间、状态
className="text-xs font-mono"

// 命令风格
<div>$ system status --all</div>
```

---

## 8. 页面设计模式

### 8.1 仪表板页面 (Dashboard)

**布局：**
```
Header (标题区 + 即时时钟)
  ↓
Stats Row (统计卡片)
  ↓
Main Grid (2/3 + 1/3)
  ├── Left: 模块卡片 + 活动列表
  └── Right: 系统状态 + 快速操作
  ↓
Footer (装饰)
```

**视觉元素：**
- 网格背景装饰
- 扫描线条纹
- 渐变中线
- 命令提示符 `$`

### 8.2 分析工作区 (Analysis Workspace)

**布局：**
```
Top Bar (进度条 + 操作按钮)
  ↓
Content Area (弹性滚动)
  ├── Upload Section
  ├── Steps Timeline
  └── Threat Summary Card
```

**状态管理：**
- `useStepStore` (Zustand)
- 轮询更新 `pollSession()`

### 8.3 侧边栏 (Sidebar)

**结构：**
```
Logo
  ↓
Nav Items (可展开子菜单)
  ↓
Theme Toggle
  ↓
Settings Link
  ↓
Version
```

---

## 9. 状态管理

### 9.1 StepStore (Zustand)

```typescript
interface StepStore {
  // 状态
  steps: Step[];
  messages: Message[];
  currentSessionId: string | null;
  isExecuting: boolean;
  currentModule: ModuleType;
  theme: 'light' | 'dark';

  // 操作
  setCurrentModule: (module: ModuleType) => void;
  setCurrentSessionId: (id: string) => void;
  setSteps: (steps: Step[]) => void;
  startExecution: () => void;
  stopExecution: () => void;
  resetAll: () => void;
  toggleTheme: () => void;
}
```

---

## 10. API 调用模式

### 10.1 轮询模式

```typescript
// 启动轮询
const cleanup = pollSession(sessionId, module, (session) => {
  syncSessionToStore(session);
});

// 清理轮询
cleanupRef.current?.();
cleanupRef.current = cleanup;
```

### 10.2 消息发送

```typescript
// 发送用户消息
addMessage({ role: 'user', content: text });

// 接收 AI 回复
const response = await api.module.sendMessage(sessionId, text);
addMessage({ role: 'assistant', content: response.message.content });
```

---

## 11. 设计检查清单

### 新页面设计必须检查：

- [ ] 使用本设计系统的颜色变量
- [ ] 卡片使用 `rounded-xl border bg-card` 结构
- [ ] hover 添加 `group hover:border-terminal-green/50` 效果
- [ ] 统计数据使用 `font-mono`
- [ ] 动画使用 `animate-fade-in-up`
- [ ] 列表使用交错延迟 `animation-delay: ${index * 50}ms`
- [ ] Terminal 页面使用命令风格 `$` 装饰
- [ ] 响应式使用正确的断点
- [ ] 移动端 hamburger 菜单 + overlay
- [ ] 模块色使用对应的 CSS 变量

---

## 12. 示例代码

### 12.1 统计卡片

```tsx
function StatCard({ label, value, icon, color }: Props) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 hover:border-[var(--terminal-green)]/50 transition-all duration-300">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-[var(--terminal-green)]/5 to-transparent" />
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase">{label}</span>
        <div className={cn('p-2 rounded-lg', color)}>{icon}</div>
      </div>
      <span className="text-3xl font-bold font-mono">{value}</span>
    </div>
  );
}
```

### 12.2 模块入口卡片

```tsx
function ModuleCard({ title, description, href, icon, color, stats, delay }: Props) {
  return (
    <Link href={href} className="group relative block overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 hover:border-[var(--terminal-green)]/50 transition-all duration-500 animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden">
        <div className="absolute top-0 right-0 w-[1px] h-8 bg-gradient-to-l from-[var(--terminal-green)]/30 to-transparent" />
        <div className="absolute top-0 right-0 h-[1px] w-8 bg-gradient-to-b from-[var(--terminal-green)]/30 to-transparent" />
      </div>
      <div className={cn('inline-flex p-3 rounded-xl mb-4', color)}>{icon}</div>
      <h3 className="text-lg font-semibold group-hover:text-[var(--terminal-green)]">{title}</h3>
      <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
    </Link>
  );
}
```

---

## 13. 相关文件

- `frontend/src/app/globals.css` - 全局样式、颜色变量
- `frontend/src/app/page.tsx` - Dashboard 首页
- `frontend/src/components/layout/AppShell.tsx` - 布局壳
- `frontend/src/components/layout/Sidebar.tsx` - 侧边导航
- `frontend/src/components/layout/MainContent.tsx` - 主内容区
- `frontend/src/stores/stepStore.ts` - 状态管理

---

本文档应作为所有前端开发的参考。新功能设计前请先阅读此文档以确保一致性。