# Prismatica Admin

Prismatica 的运营管理后台(2026-08-05 M2 上线)。

- **栈**:React 18 + TypeScript + Vite + Tailwind CSS + shadcn 风格组件 + recharts + zustand + react-router
- **后端**:本仓库 `PrismaticaAPI/`(`/admin/*` + `/v1/admin/*`)
- **状态**:内测

## 快速启动

```bash
# 1. 装依赖(node 18+ 推荐)
pnpm install   # 或 npm install / yarn

# 2. 启动后端(在 PrismaticaAPI/ 目录下)
uv sync
cp .env.example .env   # 配置 ADMIN_BOOKSTRAP_PASSWORD / ADMIN_COOKIE_SECRET / DB
python -m app.main

# 3. 启动前端(在本目录)
pnpm dev
# 访问 http://localhost:5173
```

Vite dev server 已配置 proxy: `/admin` 与 `/v1` 自动转发到 `http://127.0.0.1:8000`,浏览器无 CORS 问题。

如果需要指向其他后端,设置 `VITE_API_BASE_URL=http://your-host:port`(不要带末尾 /)。

### 默认管理员账号

启动后端时若 `admin_users` 表为空,自动 seed 账号 `root`:

- **方式一**:`export ADMIN_BOOKSTRAP_PASSWORD='YourP@ssw0rd'` → 用该密码登录
- **方式二**:不指定 → 自动生成 24 字节随机密码并打印到 stderr,务必捕获并立即修改

首次登录后建议走「修改密码」(M2 已留接口 `/admin/me/change-password`,UI 后续补)。

## 目录结构

```
src/
├── main.tsx              入口
├── App.tsx               bootstrap session + Router
├── router.tsx            createBrowserRouter 配置 + 守卫
├── index.css             Tailwind + CSS variables
├── lib/utils.ts          cn() + formatDate + maskCodeTail
├── api/
│   ├── client.ts         fetch wrapper + ApiClientError + 401 handler
│   ├── auth.ts           login / logout / fetchMe / changePassword
│   ├── users.ts          listUsers / getUserDetail / revoke / update tier
│   ├── audit.ts          listAudit / auditSummary
│   ├── codes.ts          issueCodes / lookupCode
│   └── metrics.ts        fetchMetricsSummary
├── store/session.ts      zustand: me / login / logout / clear
├── components/
│   ├── Layout.tsx        左侧 nav + 顶栏 + outlet
│   └── ui/               Button / Input / Label / Card / Badge (shadcn style)
└── pages/
    ├── Login.tsx         登录页
    ├── Dashboard.tsx     仪表盘(KPI + 图表 + 最近 audit)
    └── NotFound.tsx      404
```

## 路由

| Path | 守卫 | 说明 |
|------|------|------|
| `/login` | guest only | 登录页 |
| `/` | ProtectedLayout | Dashboard |
| `/users` | ProtectedLayout | 用户管理(下阶段) |
| `/codes` | ProtectedLayout | 凭证签发(下阶段) |
| `/audit` | ProtectedLayout | 审计日志(下阶段) |

## 当前阶段交付

仅完成 **登录页 + Dashboard 页**(M2 §4.4 第 5~6 步);用户管理/凭证签发/审计页面是后续阶段的实现,路由已占位。

Dashboard 展示:
- 4 个 KPI 卡片:用户总数 / 7 日活跃 / 7 日 grant 总额 / 待结算账单
- 1 个柱状图:近 7 日 admin 行为分布(来自 audit-summary)
- 1 个进度条:账单状态(settled / refunded)
- 1 个表格:最近 8 条 audit 日志

每 60s 自动静默刷新一次,顶部「刷新」按钮手动刷新。
