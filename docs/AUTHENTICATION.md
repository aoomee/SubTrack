# 认证概述

本文档解释了订阅管理系统在从API密钥检查迁移到基于会话登录后的认证工作原理。

## 高层设计

- **基于会话的认证**：后端使用 `express-session` 在成功登录后颁发仅限HTTP的Cookie。该Cookie仅存储会话ID；生产环境会话保存在同一个 SQLite 数据库中，开发环境使用内存存储。
- **单一管理员账户**：通过环境变量配置一个管理员用户。所有发送到 `/api/**` 或 `/api/protected/**` 的请求必须来自经过认证的会话。
- **前端保护**：React应用在启动时获取当前会话（`GET /api/auth/me`），并在检查完成之前阻止所有受保护的路由。
- **通知系统集成**：所有通知相关的配置和管理功能都通过相同的会话认证系统进行保护，确保只有认证用户才能配置和使用通知功能。

## 配置

在 `.env` 文件中设置以下环境变量（后端根目录或项目根目录，具体取决于部署方式）：

```
SESSION_SECRET=your_random_session_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
# 可选：精细化会话 Cookie 行为与代理配置
# TRUST_PROXY=1
# SESSION_COOKIE_SECURE=auto
# SESSION_COOKIE_SAMESITE=lax
```

首次创建管理员时，服务器会从 `ADMIN_PASSWORD` 派生 bcrypt 哈希并写入 SQLite。登录始终校验数据库中的哈希，不依赖进程内缓存。

其他注意事项：

- `SESSION_SECRET` 必须是一个长随机字符串，以确保会话Cookie无法被伪造。生产环境缺失时服务会拒绝启动；开发与测试环境仍会生成临时密钥。
- 生产环境首次创建管理员时必须提供 `ADMIN_PASSWORD` 或 `ADMIN_PASSWORD_HASH`，不会再回退到 `admin/admin`。
- 如需让不同域名上的前端调用 API，可使用逗号分隔的 `CORS_ORIGINS` 明确列出允许的来源；同源部署无需配置。
- 登录接口默认限制为每个客户端每15分钟10次失败，可通过 `LOGIN_RATE_LIMIT_MAX` 和 `LOGIN_RATE_LIMIT_WINDOW_MS` 调整。
- `ADMIN_PASSWORD_HASH`（如果提供）优先于明文密码。它应是使用成本≥12生成的bcrypt哈希值。
- 密钥轮换：已有管理员不会仅因修改环境变量而被覆盖；请使用修改密码接口或 `rotate-admin-password.js` 脚本。现有会话在到期前仍然有效。
- `TRUST_PROXY`：当后端部署在反向代理、负载均衡或 CDN（如 Nginx、Caddy、Cloudflare）之后时，需要设置代理层级（例如单层代理设为 `1`）。未设置时 `secure` Cookie 可能无法生效，从而导致浏览器丢弃 `sid`。
- `SESSION_COOKIE_SECURE`：控制 `express-session` 的 `cookie.secure` 行为。默认 `auto`（生产环境自动开启）。当在 HTTP 内网或需要覆盖默认行为时，可显式设为 `true` 或 `false`。
- `SESSION_COOKIE_SAMESITE`：控制 `SameSite` 策略（`lax`/`strict`/`none`）。若前端通过跨站点的 HTTPS 域名访问，需要设为 `none` 并配合 `SESSION_COOKIE_SECURE=true`。


## SESSION_SECRET 与 ADMIN_PASSWORD_HASH 生成方法

### SESSION_SECRET 生成方法

- 推荐使用高强度随机字符串，长度不少于 32 字节。
- 可通过如下命令生成：

```bash
openssl rand -base64 48
```

- 生成后将结果粘贴到 `.env` 文件的 `SESSION_SECRET` 变量中。

### ADMIN_PASSWORD_HASH 生成方法

有两种方式：

#### 方式A：系统自动生成（推荐）

1. 在 `.env` 中设置明文 `ADMIN_PASSWORD`，如：

   ```bash
   ADMIN_PASSWORD=your_secure_password
   ```

2. 启动后端服务；系统会将生成的哈希直接存入 SQLite，不会把哈希写入日志。

3. 确认首次登录成功后，可删除明文 `ADMIN_PASSWORD` 并重启服务。

#### 方式B：手动离线生成

- 使用 bcrypt 工具（如 Node.js、Python、在线工具等），成本因子建议 ≥ 12。

- Node.js 示例：

  ```js
  // 安装 bcryptjs
  npm install -g bcryptjs
  // 生成哈希
  npx bcryptjs your_secure_password 12
  ```

- 将生成的哈希粘贴到 `.env` 的 `ADMIN_PASSWORD_HASH`。

### 安全建议

- 切勿将 `.env` 文件提交到版本控制。
- 仅保留 `ADMIN_PASSWORD_HASH`，删除明文 `ADMIN_PASSWORD`。
- `SESSION_SECRET` 和 `ADMIN_PASSWORD_HASH` 建议通过安全渠道管理和注入。
- 详细流程和常见问题见本文件其余章节。



## ADMIN_PASSWORD 与 ADMIN_PASSWORD_HASH 使用指南

本系统使用单一管理员账户。管理员密码有两种配置方式：明文 `ADMIN_PASSWORD` 与哈希 `ADMIN_PASSWORD_HASH`，两者的优先级与生效时机如下。

- 优先级：`ADMIN_PASSWORD_HASH` > `ADMIN_PASSWORD`
- 引导流程：数据库迁移脚本会创建 `users` 表，并通过 `server/config/authCredentials.js` 中的 `createAdminUserManager()` 将默认管理员写入数据库。如果仅提供了 `ADMIN_PASSWORD`，会即时生成 bcrypt 哈希后再写入。
- 登录校验：`/api/auth/login` 会通过 `UserService` 查询数据库中的管理员记录，并使用 `bcrypt.compare(plain, storedHash)` 验证。

### 首次启动与推荐生产流程

1. 在 `.env` 中设置：
   - `SESSION_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`（明文，仅首次创建时使用）或 `ADMIN_PASSWORD_HASH`
2. 执行 `npm run db:init` 或启动后端。迁移会创建 `users` 表并写入管理员账户。
3. 如使用明文密码，哈希会直接写入 SQLite；确认首次登录后删除明文 `ADMIN_PASSWORD`。
4. 重启后端后将只依赖数据库中的哈希。后续不会自动覆盖。

示例：

首次启动（开发/临时）

```
SESSION_SECRET=change_me_to_a_long_random_string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
```

固化为生产（推荐）

```
SESSION_SECRET=long_random_string_generated_once
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2a$12$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
# 删除 ADMIN_PASSWORD
```

### 为什么重启时哈希不会变化？

环境变量仅用于首次创建管理员。管理员已经存在时，重启不会重新生成或覆盖数据库中的哈希，因此更新镜像不会改变现有密码。

### 运行时是否会再读取 `.env` 或重新生成？

登录流程直接查询 SQLite 数据库，不缓存凭证。运行 `rotate-admin-password` 脚本或通过已登录会话修改密码后，数据库中的密码才会变化。

### 密码轮换（更改管理员密码）

- 方式 A（脚本执行，推荐）：
  1) 运行 `node server/scripts/rotate-admin-password.js --password new_secure_password`。
  2) 记录脚本输出的哈希，更新 `.env` 中的 `ADMIN_PASSWORD_HASH`，删除明文密码。
  3) （如需）重启后端进程以载入新的环境变量。

- 方式 B（离线生成哈希）：
  - 使用 bcrypt 工具以成本因子 ≥ 12 生成哈希，再执行 `node server/scripts/rotate-admin-password.js --hash '<bcryptHash>'` 写入现有数据库。

注意：轮换后，已建立的会话在到期前仍然有效；新登录将使用新哈希进行校验。

### 运维与安全建议

- 为 `SESSION_SECRET` 设置稳定且足够随机的值。生产环境缺失时服务会拒绝启动；开发环境的临时密钥会导致重启后会话失效。
- 生产环境默认使用 SQLite 持久化 session；如果部署多个应用实例，应改用 Redis 等共享存储。
- 切勿将 `.env` 提交到版本控制。使用环境注入或密钥管理服务（KMS/Secrets Manager）。
- 仅保留 `ADMIN_PASSWORD_HASH`，删除明文 `ADMIN_PASSWORD`，减少凭证暴露面。
- 通过 HTTPS 提供服务，确保 Cookie 的 `secure` 标志生效。

### 常见问题（FAQ）

- 需要每次重启都修改 `.env` 吗？
  - 不需要。环境密码只用于首次创建管理员；后续密码以数据库记录为准。

- 首次启动会把密码哈希打印到日志吗？
  - 不会；哈希只写入 SQLite。旧版本日志中的哈希应视作敏感信息。

- 同时设置了 `ADMIN_PASSWORD` 和 `ADMIN_PASSWORD_HASH` 会怎样？
  - 系统优先使用 `ADMIN_PASSWORD_HASH`，忽略明文。生产推荐仅保留哈希。

- 修改 `.env` 中的管理员密码后为什么没有生效？
  - 为防止部署时意外覆盖已修改的密码，环境凭证只用于首次创建管理员。已有数据库请使用修改密码接口或轮换脚本。

## 后端流程

1. **会话中间件（`server/middleware/session.js`）**
   - 配置 `express-session`：
     - Cookie名称 `sid`
     - 12小时最大有效期
     - `httpOnly=true`
     - 当 `NODE_ENV=production` 时，`secure=true`
     - `sameSite=lax`
   - 加载 `SESSION_SECRET`；仅开发与测试环境会在缺失时生成临时密钥。

2. **凭证初始化（`server/config/authCredentials.js`）**
   - 读取 `ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH` 和 `ADMIN_PASSWORD`。
   - 仅当数据库中还没有管理员且两个密码变量都不存在时，生产进程会显示明确错误并退出。
   - 如果仅提供 `ADMIN_PASSWORD`，会使用bcrypt对其进行哈希处理并记录指导信息以持久化哈希值。

3. **认证路由（`server/routes/auth.js`）**
   - `POST /api/auth/login` 使用 `bcrypt.compare` 验证用户名和密码，并将 `{ username, role: 'admin' }` 存储在 `req.session.user` 中。
   - `POST /api/auth/logout` 销毁会话并清除Cookie。
   - `GET /api/auth/me` 返回当前会话用户或在未认证时返回 `401`。

4. **路由保护（`server/middleware/requireLogin.js`）**
   - 所有挂载在 `/api` 和 `/api/protected` 下的路由都会应用此中间件。任何没有 `req.session.user` 的请求都会收到 `401 认证要求`。
   - 公共端点（例如 `/api/auth/login`、静态资源）在保护中间件之前挂载。

5. **数据库和调度器启动**
   - 不受认证重构影响；诸如汇率轮询等任务在会话中间件注册后立即运行，因此它们在经过认证的API模型下操作，无需特殊处理。

## 前端流程

1. 在应用挂载时，`useAuthStore.fetchMe()` 调用 `GET /api/auth/me` 获取凭证（`fetch` 使用 `credentials: 'include'`）。
2. `App.tsx` 等待认证存储完成初始化后再渲染受保护的路由。在此之前会显示加载动画。如果没有用户，会重定向到 `/login`。
3. 登录页面将凭证发送到 `/api/auth/login`。成功后会重新获取 `/api/auth/me`，存储用户信息，并导航到仪表盘。
4. 登出触发 `POST /api/auth/logout` 并清除本地状态；用户在下一次路由变更时被返回到 `/login`。

## Cookie行为与安全性

- Cookie限定于后端的来源（`/api`）。前端代码不会直接操作它们。
- 在通过HTTPS部署的生产环境中，`secure: true` 确保Cookie仅通过TLS传输。
- 会话生命周期限制为12小时。如果浏览器清除会话Cookie，则关闭浏览器会提前结束会话。
- 生产环境会话默认保存在 SQLite 的 `sessions` 表中，服务器重启后仍然有效。开发环境的内存会话会在进程退出后清空。

## 故障模式与排查

- **每个请求都返回401**：确认登录会话有效并保持稳定的 `SESSION_SECRET`；全新数据库还需要 `ADMIN_PASSWORD_HASH` 或 `ADMIN_PASSWORD` 创建管理员。
- **重启后意外登出**：发生在未明确配置 `SESSION_SECRET` 的情况下。设置固定密钥以维护会话连续性。
- **更改密码后无法登录**：运行 `rotate-admin-password.js` 安全重置数据库密码；仅修改已有部署的环境变量不会覆盖数据库记录。
- **前端卡在加载动画**：表明 `/api/auth/me` 请求失败。检查浏览器网络标签中的401响应以及后端日志中的配置错误。
