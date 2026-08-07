# Prismatica Admin

Prismatica 的运营管理后台(2026-08-06 P0-B 重构完成)。

- **栈**:React 18 + TypeScript + Vite + Tailwind CSS + shadcn 风格组件 + recharts + zustand + react-router
- **后端**:本仓库 `PrismaticaAPI/`(`/admin/*` + `/v1/admin/*`)
- **状态**:内测 · P0 阶段

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

- **方式一**:`export ADMIN_BOOTSTRAP_PASSWORD='YourP@ssw0rd'` → 用该密码登录
- **方式二**:不指定 → 自动生成 24 字节随机密码并打印到 stderr,务必捕获并立即修改

首次登录后建议走「修改密码」(顶栏「修改密码」入口)。

## 目录结构

```
src/
├── main.tsx                       入口
├── App.tsx                        bootstrap session + Router
├── router.tsx                     createBrowserRouter + 守卫
├── index.css                      Tailwind + CSS variables
├── lib/
│   ├── utils.ts                   cn() + formatDate + maskCodeTail + copyToClipboard
│   │                              + downloadCsv + downloadTextFile
│   ├── labels.ts                  tier / status / kind / bill 状态中文标签
│   └── errorMessages.ts           错误码 → 用户文案映射(P0-B M1)
├── api/
│   ├── client.ts                  fetch wrapper + ApiClientError + 401 handler
│   │                              + 幂等 GET 自动重试(5xx/NETWORK, 250ms×2 次退避)
│   ├── auth.ts                    login / logout / fetchMe / changePassword
│   ├── users.ts                   listUsers / getUserDetail / getUserSubscriptions
│   │                              / getUserDevices / getUserLedger
│   │                              / revokeUserDevice / updateUser / grantBalance
│   │                              / revokeUserSessions
│   ├── audit.ts                   listAudit / auditSummary
│   ├── codes.ts                   issueCodes / listCodes / revokeCode / lookupCode
│   ├── bills.ts                   listBills / getBillDetail
│   └── metrics.ts                 fetchMetricsSummary
│                                  + fetchSubscriptionDistribution + fetchCodesKpi
├── store/
│   ├── session.ts                 zustand: me / login / logout / clear
│   ├── users.ts                   zustand: 列表 + 多维筛选 + 详情缓存
│   ├── codes.ts                   zustand: 列表 + 筛选 + 签发向导草稿 + 最近批次
│   └── bills.ts                   zustand: 列表 + 筛选 + 详情缓存
├── components/
│   ├── Layout.tsx                 左侧 nav + 顶栏 + Toast 容器
│   ├── ChangePasswordDialog.tsx   修改密码弹窗
│   ├── Toast.tsx                  全局 toast(zustand 广播 + 自动消失)
│   ├── UserDetailDrawer.tsx       抽屉式用户详情(5 个 tab + 写操作)
│   ├── BillDetailDrawer.tsx       抽屉式账单详情
│   └── ui/                        Button / Input / Label / Card / Badge
└── pages/
    ├── Login.tsx                  登录页
    ├── Dashboard.tsx              仪表盘(KPI + 订阅分布饼图 + 兑换码看板 + 最近 audit)
    ├── Users.tsx                  用户管理(多维筛选/分页/抽屉详情/CSV 导出)
    ├── Codes.tsx                  凭证签发(向导/列表/查码/TXT 下载/CSV 导出)
    ├── Bills.tsx                  账单管理(筛选/抽屉详情/CSV 导出)
    ├── Audit.tsx                  审计日志(过滤/详情/CSV 导出)
    ├── Admins.tsx                 账号管理(owner only)
    └── NotFound.tsx               404
```

## 路由

| Path | 守卫 | 说明 |
|------|------|------|
| `/login` | guest only | 登录页 |
| `/` | ProtectedLayout | Dashboard |
| `/users` | ProtectedLayout | 用户管理(列表/筛选/分页/抽屉详情/CSV 导出) |
| `/codes` | ProtectedLayout | 凭证签发(向导/查码/TXT 下载/CSV 导出) |
| `/bills` | ProtectedLayout | 账单管理(筛选/抽屉详情/CSV 导出) |
| `/audit` | ProtectedLayout | 审计日志(过滤/详情/CSV 导出) |
| `/admins` | ProtectedLayout + ownerOnly | 账号管理(建号/锁定/重置密码/删除) |

## 接口对照表(P0-B)

下表列出本后台所有调用的后端接口,与 `PrismaticaAPI/app/routers/admin_*.py` 一一对应。

### 鉴权

| Method | Path | 用途 | 调用方 |
|--------|------|------|--------|
| POST | `/v1/admin/auth/login` | 用户名密码登录(写 cookie) | `useSessionStore.login` |
| POST | `/v1/admin/auth/logout` | 登出(清 cookie) | `useSessionStore.logout` |
| GET | `/v1/admin/auth/me` | 拉当前管理员 | `useSessionStore.bootstrap` |
| POST | `/v1/admin/auth/change-password` | 修改密码 | `ChangePasswordDialog` |

### Users

| Method | Path | 用途 | 调用方 |
|--------|------|------|--------|
| GET | `/v1/admin/users` | 列表(支持 `status` / `tier` / `q` / `registeredAfter` / `registeredBefore` / `cursor` / `limit`) | `UsersPage` + `useUsersStore.loadList` |
| GET | `/v1/admin/users/{id}` | 详情 | `UserDetailDrawer` + `useUsersStore.refreshDetail` |
| GET | `/v1/admin/users/{id}/subscriptions` | 该用户订阅列表 | `UserDetailDrawer` Subscription tab |
| GET | `/v1/admin/users/{id}/devices` | 该用户设备列表 | `UserDetailDrawer` Devices tab |
| POST | `/v1/admin/users/{id}/devices/{deviceId}/revoke` | 撤销设备 | `UserDetailDrawer` Devices tab |
| GET | `/v1/admin/users/{id}/ledger` | 该用户账本(余额变动) | `UserDetailDrawer` Balance / Ledger tab |
| PATCH | `/v1/admin/users/{id}` | 改 tier / status | `UserDetailDrawer` Info tab |
| POST | `/v1/admin/users/{id}/grant` | 手动赠送积分 | `UserDetailDrawer` Info tab |
| POST | `/v1/admin/users/{id}/revoke-sessions` | 强制下线 | `UserDetailDrawer` Info tab |

### Codes(凭证)

| Method | Path | 用途 | 调用方 |
|--------|------|------|--------|
| POST | `/v1/admin/codes` | 批量签发(invite / trial / recharge + `note`) | `CodesPage` IssueDialog |
| GET | `/v1/admin/codes` | 列表(支持 `kind` / `status` / `cursor` / `limit`) | `CodesPage` + `useCodesStore.loadList` |
| POST | `/v1/admin/codes/{codeHash}/revoke` | 撤销单码 | `CodesPage` 行操作 |
| GET | `/v1/admin/codes/lookup` | 明文 → 元数据查询 | `CodesPage` LookupDialog |

### Bills(账单)

| Method | Path | 用途 | 调用方 |
|--------|------|------|--------|
| GET | `/v1/admin/bills` | 列表(支持 `status` / `userId` / `days` / `cursor` / `limit`) | `BillsPage` + `useBillsStore.loadList` |
| GET | `/v1/admin/bills/{id}` | 详情 | `BillDetailDrawer` |

### Audit

| Method | Path | 用途 | 调用方 |
|--------|------|------|--------|
| GET | `/v1/admin/audit` | 列表(支持 `action` / `actor` / `targetUser` / `days` / `cursor` / `limit`) | `AuditPage` |
| GET | `/v1/admin/audit/summary` | 近 N 日 action 分布 | `AuditPage` + `DashboardPage` |

### Metrics(Dashboard)

| Method | Path | 用途 | 调用方 |
|--------|------|------|--------|
| GET | `/v1/admin/metrics/summary` | 顶部 KPI 卡片 | `DashboardPage` |
| GET | `/v1/admin/metrics/subscription-distribution` | 订阅分布饼图 | `DashboardPage` |
| GET | `/v1/admin/metrics/codes-kpi` | 兑换码看板(active/issued/consumed/revoked) | `DashboardPage` |

### Export(CSV,带 cookie 直返 text/csv)

| Method | Path | 用途 | 调用方 |
|--------|------|------|--------|
| GET | `/v1/admin/export/users.csv` | 用户列表导出(带筛选) | `UsersPage` |
| GET | `/v1/admin/export/codes.csv` | 凭证列表导出(带筛选) | `CodesPage` |
| GET | `/v1/admin/export/bills.csv` | 账单列表导出(带筛选) | `BillsPage` |
| GET | `/v1/admin/export/audit.csv` | 审计日志导出(带筛选) | `AuditPage` |

### Admins(账号管理 · owner only)

| Method | Path | 用途 | 调用方 |
|--------|------|------|--------|
| GET | `/v1/admin/admins` | 管理员列表 | `AdminsPage` |
| POST | `/v1/admin/admins` | 新建管理员 | `AdminsPage` |
| PATCH | `/v1/admin/admins/{id}` | 改角色 / 状态 / 重置密码 | `AdminsPage` |

## 测试

```bash
# vitest + RTL(单元 + 组件测试)
npm run test          # 跑一遍
npm run test:watch    # watch 模式

# typecheck
npm run typecheck

# 构建产物(产物 dist/ 与 dist.zip 同步)
npm run build
```

当前覆盖(61 用例,全绿):

- `src/lib/__tests__/errorMessages.test.ts` — 10 用例(已知码 / 未知码 / HTTP 兜底)
- `src/lib/__tests__/utils.test.ts` — 3 用例(CSV Blob 下载 / 401 统一处理 / 嵌套错误 envelope)
- `src/api/__tests__/client.test.ts` — 5 用例(GET 重试 / 401 / envelope 解析)
- `src/store/__tests__/users.test.ts` — 15 用例(筛选/分页竞态/详情缓存/写操作/force 刷新)
- `src/store/__tests__/codes.test.ts` — 8 用例(签发/撤销/查询/批次缓存/请求竞态)
- `src/store/__tests__/bills.test.ts` — 9 用例(筛选/分页竞态/详情缓存/错误处理)
- `src/components/__tests__/Toast.test.tsx` — 5 用例(渲染/自动消失/手动关闭)
- `src/components/__tests__/UserDetailDrawer.test.tsx` — 4 用例(5 个 tab 渲染 / 余额触发账本 / 强制刷新)
- `src/pages/__tests__/Dashboard.test.tsx` — 2 用例(模块级容错 / 旧请求不覆盖新数据)

## 当前阶段交付

**M1(2026-08-06 P0-B)**:基础设施
- zustand 域 store:`users` / `codes` / `bills`
- `lib/errorMessages.ts` 错误码映射(覆盖设计 §6.1 全部 code)
- `apiRequest` 幂等 GET 自动重试(5xx / NETWORK,250ms 指数退避,最多 2 次)
- 全局 Toast(`components/Toast.tsx`,zustand 广播 + 自动消失)

**M2(2026-08-06)**:Users 多维筛选 + 分页 + CSV 导出
- 筛选条:status / tier / 关键词 / 注册起止日期
- 分页:cursor
- CSV 导出:带当前筛选条件(后端加 BOM,Excel 直开)

**M3(2026-08-06)**:UserDetailDrawer(5 个 tab + 写操作)
- tab:`基本信息` / `订阅` / `余额` / `设备` / `账本`
- 操作:改 tier / 改 status / 强制下线 / 手动赠送 / 撤销设备
- 写操作走 toast 反馈 + 后端 `audit_log`

**M4(2026-08-06)**:Codes 批量签发 + TXT 下载 + 查码
- 向导:kind / count / expireDays / note + 模板参数
- 签发成功后弹出明文码(一次性展示 + 复制 / 下载 TXT)
- 列表筛选(kind / status)+ 分页 + 撤销
- 单码查询(`lookup`)
- CSV 导出(带筛选)

**M5(2026-08-06)**:Bills 列表 + 抽屉式详情 + CSV 导出
- 筛选:status / days / userId
- 抽屉式详情:全部字段 + 余额变动 + 资源用量
- CSV 导出(带筛选)

**M6(2026-08-06)**:Dashboard 订阅分布 + 兑换码看板
- 顶部 KPI 新增「活跃兑换码」卡片
- 订阅分布饼图(按 tier,中文标签)
- 兑换码看板(7 日签发 / 使用 / 撤销 + 当前有效总数)

**M7(2026-08-06)**:vitest + RTL + 单元测试
- 5 个测试文件,38 用例,全绿
- `vitest.config.ts` / `vitest.setup.ts` / `tsconfig.json` 同步支持测试全局类型
- 包脚本 `npm run test` / `npm run test:watch`