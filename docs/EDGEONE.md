# EdgeOne Pages 部署

此仓库迁移当前 Vercel 线上版本，保持原有页面、档案、创作和投稿流程。没有引入后续的邮箱登录、公众补述或档案生长功能。原来的 Vercel 服务可继续保留。

## 导入 GitHub

仓库：`dongdongdad666-art/machine-misread-archive`

| Pages 配置项 | 填写值 |
| --- | --- |
| 生产分支 | `codex/edgeone-migration` |
| 框架 | Other / 其他 |
| 根目录 | 留空，使用仓库根目录 |
| 安装命令 | `npm ci --no-audit --no-fund` |
| 构建命令 | `npm run build:edgeone` |
| 输出目录 | `dist` |
| Node.js | `22.21.1`（22 系列） |
| 加速区域 | 全球可用区（不含中国大陆） |

`edgeone.json` 已包含构建、SPA 路由和缓存规则；`cloud-functions/api/` 包含三个 Node 云函数。云端构建日志应同时出现静态构建和 Node functions 构建成功。

这次图片随 Git 一起部署，不需要 COS 地址或前端资源环境变量。

## 服务端环境变量

在原 Vercel 项目的 Settings → Environment Variables 找到现有配置；在新的 Pages 项目 Settings / 设置 → Environment Variables / 环境变量新增同名值。为需要测试的预览环境和正式生产环境分别启用，保存后重新部署。

| 名称 | 应填写的值 |
| --- | --- |
| `DASHSCOPE_API_KEY` | 原项目使用的 DashScope API Key |
| `DASHSCOPE_BASE_URL` | 原项目的模型服务地址，须与 Key 所属区域一致 |
| `SUPABASE_URL` | 原项目的 Supabase 地址 |
| `SUPABASE_SERVICE_ROLE_KEY` | 原项目服务端 service_role 密钥 |
| `QUOTA_SALT` | 沿用原项目的值，保持访客配额标识稳定 |

如果 Vercel 还设置了以下变量，也原样迁移：

- `DASHSCOPE_VISION_MODEL`
- `DASHSCOPE_MODEL_SNAPSHOT`
- `DASHSCOPE_EMBEDDING_MODEL`

未设置的模型变量会沿用源码默认值，见 `.env.example`。不要因更换部署平台而顺便更换模型区域、版本或数据库。继续使用现有 Supabase，不重复执行初始化 SQL。

这些变量都是服务端配置，名称不能加 `VITE_`。不要把真实值写进代码、GitHub、截图或聊天。仓库只提供没有密钥的 `.env.example`。

## 上线检查

1. 打开预览地址，检查首页、公共档案、挑战、个人残差下载。
2. 直接打开 `/archive/seed-old-dictionary-01` 并刷新，确认 SPA 子路由可用。
3. 浏览器访问 `/api/analyze`、`/api/gap`、`/api/submit`：配置齐全时 GET 应返回 JSON 和 HTTP 405；503 + `SERVER_NOT_CONFIGURED` 表示缺少服务端变量；若返回网页 HTML，检查函数构建和路由。
4. 用一张可公开的测试图片执行一次真实 AI 分析，再验证语义差异计算。真实调用会使用原服务额度；实际投稿会写入现有数据库，提交前确认内容和授权选项。
5. 预览功能正常后再绑定自定义域名，例如 `misread.szydym.com`，按 Pages 显示的 CNAME 配置 DNS 并完成 HTTPS。
6. 域名验收后再修改 IJane 作品集链接。

原有预设档案和挑战无需服务端密钥；实时创作、分析和投稿需要密钥与外部服务可用。不要只验证首页就认为全部后端已迁移。

## 验证范围

迁移时本地 `npm run verify`：165 项测试通过；EdgeOne 官方 CLI 成功打包三个 Node 路由；对真实打包产物执行 9 项 HTTP 检查；31 项浏览器检查通过。23 个线上公开文件中22个逐字节一致，剩下的 `sw.js` 仅预缓存清单顺序不同，内容及修订号相同。

本地验收禁止外部模型/数据库请求，尚不能证明腾讯云实际运行环境到 DashScope/Supabase 的连通性。需要按上面的上线步骤补验。

官方参考：[Node Functions](https://pages.edgeone.ai/document/node-functions)、[edgeone.json](https://pages.edgeone.ai/document/edgeone-json)。
