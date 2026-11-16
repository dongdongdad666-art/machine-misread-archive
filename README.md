# 机器误读档案馆

一个把旧物的机器解读、人的补述与可复现生成作品并置的 React + Vite 网站。

## EdgeOne Pages 迁移

本仓库保留当前线上版本，部署请使用 [EdgeOne 配置说明](docs/EDGEONE.md)。构建命令 `npm run build:edgeone`，输出目录 `dist`；三个 API 已适配 Node 云函数。需要将原 Vercel 的服务端环境变量填入 Pages，真实密钥不得提交到 Git。下方 Vercel 说明保留用于原平台兼容与历史验证。

## 本地验证

```bash
npm ci
npm run validate:deployment
npm run lint
npm test
npm run build
npm run test:e2e
```

## Vercel 配置

Vercel Functions 位于新加坡 `sin1`，以贴近 DashScope 与 Supabase 的数据服务。SPA 重写只处理非 `/api/*` 的页面请求；API、上传物与私有来源路径都返回 `Cache-Control: no-store`，不会被部署层缓存或建立搜索索引。

在 Vercel 项目的 Production、Preview 和 Development 环境中设置以下服务器变量：

| 变量 | 用途 |
| --- | --- |
| `DASHSCOPE_API_KEY` | DashScope API 密钥。 |
| `DASHSCOPE_BASE_URL` | DashScope 兼容 API 基址。 |
| `SUPABASE_URL` | Supabase 项目地址。 |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅限服务端使用的 Supabase 服务角色密钥。 |
| `QUOTA_SALT` | 用于散列访客配额标识的长随机值。 |

这些值都不得以 `VITE_` 前缀命名或写入客户端构建变量。复制 `.env.example` 到本地 `.env` 后填入真实值；不要提交 `.env`。

## 发布检查

先运行“本地验证”中的全部命令。只有得到明确的生产发布授权后，才可以执行：

```bash
vercel --prod
```

获得生产 URL 后，运行只读线上冒烟测试；它覆盖首页、创建页、档案馆、案例页、一个种子档案详情页，以及三个 API 的可达健康状态：

```bash
PLAYWRIGHT_BASE_URL=<production-url> npm run test:e2e -- tests/e2e/live-smoke.spec.ts
```
