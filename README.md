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

首次登录后建议走「修改密码」(顶栏「修改密码」入口,M3 已补 UI)。

## 目录结构

```
src/
├── main.tsx              入口
├── App.tsx               bootstrap session + Router
├── router.tsx            createBrowserRouter 配置 + 守卫
├── index.css             Tailwind + CSS variables
├── lib/utils.ts          cn() + formatDate + maskCodeTail + copyToClipboard + downloadCsv
├── lib/labels.ts         tier / status / kind / bill 状态中文标签
├── api/
│   ├── client.ts         fetch wrapper + ApiClientError + 401 handler
│   ├── auth.ts           login / logout / fetchMe / changePassword
│   ├── users.ts          listUsers / getUserDetail / revoke / update tier
│   ├── audit.ts          listAudit / auditSummary
│   ├── codes.ts          issueCodes / lookupCode
│   ├── bills.ts          listBills / getBillDetail
│   └── metrics.ts        fetchMetricsSummary
├── store/session.ts      zustand: me / login / logout / clear
├── components/
│   ├── Layout.tsx        左侧 nav + 顶栏(修改密码/登出) + outlet
│   ├── ChangePasswordDialog.tsx   修改密码弹窗
│   └── ui/               Button / Input / Label / Card / Badge (shadcn style)
└── pages/
    ├── Login.tsx         登录页
    ├── Dashboard.tsx     仪表盘(KPI + 图表 + 最近 audit)
    ├── Users.tsx         用户管理(搜索/加余额/强制下线/改 tier)
    ├── Codes.tsx         凭证签发(签发/查码/撤销/复制)
    ├── Bills.tsx         账单管理(筛选/详情展开/导出)
    ├── Audit.tsx         审计日志(过滤/详情/导出)
    ├── Admins.tsx        账号管理(owner only:建号/锁定/重置密码)
    └── NotFound.tsx      404
```

## 路由

| Path | 守卫 | 说明 |
|------|------|------|
| `/login` | guest only | 登录页 |
| `/` | ProtectedLayout | Dashboard |
| `/users` | ProtectedLayout | 用户管理(列表/搜索/加余额/强制下线/改 tier/导出) |
| `/codes` | ProtectedLayout | 凭证签发(签发/查码/撤销/复制/导出) |
| `/bills` | ProtectedLayout | 账单管理(筛选/详情展开/导出) |
| `/audit` | ProtectedLayout | 审计日志(过滤/详情/导出) |
| `/admins` | ProtectedLayout + ownerOnly | 账号管理(建号/锁定/重置密码/删除) |

## 当前阶段交付

**M2(2026-08-05)**:登录页 + Dashboard(KPI 卡片 / 7 日行为柱状图 / 账单状态 / 最近 audit,60s 自动刷新)。

**M3(2026-08-06)**:在 M2 基础上补齐:
- 用户管理 / 凭证签发 / 账单管理 / 审计日志 / 账号管理(owner only)五大页面
- 顶栏「修改密码」入口(调 `/v1/admin/auth/change-password`)
- 用户 / 凭证 / 审计 / 账单 CSV 导出(UTF-8 BOM,Excel 直开)
- 复制按钮兼容非 HTTPS 内网访问(clipboard API 回退 execCommand)
