# @t3-oss/env-core — 类型安全的环境变量管理

[![NPM Version](https://img.shields.io/npm/v/%40t3-oss%2Fenv-core)](https://www.npmjs.com/package/@t3-oss/env-core)
[![JSR](https://jsr.io/badges/@t3-oss/env-core)](https://jsr.io/@t3-oss/env-core)

这是 t3-env 的框架无关核心包，让你能够以**完全类型安全**的方式管理环境变量。

> 完整文档请参见 <https://env.t3.gg>

---

## 目录

- [为什么需要它？](#为什么需要它)
- [安装](#安装)
- [快速上手](#快速上手)
- [API 详解](#api-详解)
  - [createEnv](#createenv)
  - [BaseOptions — 通用配置](#baseoptions--通用配置)
  - [LooseOptions / StrictOptions — 运行时变量来源](#looseoptions--strictoptions--运行时变量来源)
  - [ServerOptions / ClientOptions — 分端 Schema](#serveroptions--clientoptions--分端-schema)
  - [CreateSchemaOptions — 自定义合并 Schema](#createschemaoptions--自定义合并-schema)
- [内置预设（Presets）](#内置预设presets)
- [扩展预设](#扩展预设)
- [进阶示例](#进阶示例)
  - [空字符串视为 undefined](#空字符串视为-undefined)
  - [跳过验证（测试环境）](#跳过验证测试环境)
  - [自定义错误处理](#自定义错误处理)
  - [Strict 模式](#strict-模式)
  - [与 Valibot 配合使用](#与-valibot-配合使用)
  - [与 ArkType 配合使用](#与-arktype-配合使用)

---

## 为什么需要它？

在传统项目中，环境变量通常以 `process.env.MY_VAR` 的形式访问，存在以下问题：

- **无类型安全**：`process.env` 的所有值都是 `string | undefined`，需要手动断言
- **无校验**：启动时不知道哪些变量缺失或格式不对，直到运行时才会报错
- **客户端/服务端边界不清**：误将服务端密钥暴露给客户端代码

`@t3-oss/env-core` 通过 [Standard Schema](https://standardschema.dev) 规范，在**应用启动时**对所有环境变量进行验证，并利用 TypeScript 类型系统防止客户端访问服务端变量。

---

## 安装

```bash
# npm
npm i @t3-oss/env-core

# pnpm
pnpm add @t3-oss/env-core

# bun
bun add @t3-oss/env-core

# deno（JSR）
deno add jsr:@t3-oss/env-core
```

你还需要安装一个兼容 [Standard Schema](https://standardschema.dev) 的验证库，例如：

```bash
# Zod（推荐）
pnpm add zod

# Valibot
pnpm add valibot

# ArkType
pnpm add arktype
```

---

## 快速上手

### 基础用法（使用 Zod）

```ts
// src/env.ts
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  /**
   * 服务端环境变量 —— 不会暴露给客户端。
   * 在客户端访问时会抛出运行时错误。
   */
  server: {
    DATABASE_URL: z.url(),
    OPEN_AI_API_KEY: z.string().min(1),
    PORT: z.coerce.number().default(3000),
  },

  /**
   * 客户端环境变量 —— 必须以 clientPrefix 开头。
   * 服务端和客户端均可访问。
   */
  clientPrefix: "PUBLIC_",
  client: {
    PUBLIC_APP_URL: z.url(),
    PUBLIC_ANALYTICS_ID: z.string().optional(),
  },

  /**
   * 指定运行时环境变量的来源对象。
   * Node.js 项目通常使用 process.env；
   * Vite/Astro 项目使用 import.meta.env。
   */
  runtimeEnv: process.env,
});

// 在代码中使用（带完整类型提示）
console.log(env.DATABASE_URL);  // string（URL 格式）
console.log(env.PORT);          // number
console.log(env.PUBLIC_APP_URL); // string（URL 格式）
```

---

## API 详解

### `createEnv`

核心函数，接收配置对象并返回**只读的、经过验证的**环境变量对象。

```ts
function createEnv<...>(opts: EnvOptions<...>): CreateEnv<...>
```

#### 返回值

返回一个 `Readonly` 的代理对象：

- 访问已验证的变量时，返回经过 schema 解析后的类型化值
- 在客户端访问服务端变量时，默认抛出错误
- 访问不存在的属性时，返回 `undefined`

---

### `BaseOptions` — 通用配置

所有模式共享的基础选项：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `isServer` | `boolean` | `typeof window === "undefined"` | 是否为服务端环境 |
| `shared` | `StandardSchemaDictionary` | — | 服务端和客户端共享的变量（如 `NODE_ENV`） |
| `extends` | `Array<Record<string, unknown>>` | — | 扩展其他预设 |
| `onValidationError` | `(issues) => never` | 打印并抛出错误 | 验证失败时的回调 |
| `onInvalidAccess` | `(variable) => never` | 抛出错误 | 客户端访问服务端变量时的回调 |
| `skipValidation` | `boolean` | `false` | 跳过验证（用于测试或构建阶段） |
| `emptyStringAsUndefined` | `boolean` | `false` | 将空字符串 `""` 视为 `undefined` |

---

### `LooseOptions` / `StrictOptions` — 运行时变量来源

**LooseOptions**（宽松模式）使用 `runtimeEnv`：

```ts
// 允许传入包含额外键的对象，不验证是否所有 schema 中的键都存在
runtimeEnv: process.env
```

**StrictOptions**（严格模式）使用 `runtimeEnvStrict`：

```ts
// TypeScript 会检查是否明确提供了所有 schema 中定义的键
// 适用于 Next.js Edge Runtime、Cloudflare Workers 等会进行 tree-shaking 的环境
runtimeEnvStrict: {
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
}
```

---

### `ServerOptions` / `ClientOptions` — 分端 Schema

```ts
// 服务端变量——不允许以 clientPrefix 为前缀
server: {
  DATABASE_URL: z.string().url(),
  SECRET_KEY: z.string().min(32),
}

// 客户端变量——必须以 clientPrefix 为前缀
clientPrefix: "NEXT_PUBLIC_",
client: {
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_FEATURE_FLAG: z.enum(["on", "off"]).default("off"),
}
```

类型系统会在编译期阻止：
- 服务端变量使用客户端前缀
- 客户端变量缺少前缀

---

### `CreateSchemaOptions` — 自定义合并 Schema

通过 `createFinalSchema` 可以对合并后的 schema 进行进一步处理：

```ts
import * as z from "zod";
import { createEnv } from "@t3-oss/env-core";

export const env = createEnv({
  server: {
    PORT: z.coerce.number(),
  },
  runtimeEnv: process.env,
  // 自定义 schema 合并逻辑，可在此添加跨字段验证
  createFinalSchema: (shape, isServer) => {
    return z.object(shape).refine(
      (data) => (isServer ? data.PORT > 0 : true),
      { message: "PORT 必须为正整数" }
    );
  },
});
```

---

## 内置预设（Presets）

`@t3-oss/env-core` 提供了针对常见平台的内置预设（需使用对应验证库的子包，如 `presets-zod`）：

| 预设函数 | 说明 |
|----------|------|
| `vercel()` | Vercel 平台系统环境变量 |
| `neonVercel()` | Neon 数据库 × Vercel 集成变量 |
| `supabaseVercel()` | Supabase × Vercel 集成变量 |
| `railway()` | Railway 平台环境变量 |
| `render()` | Render 平台环境变量 |
| `fly()` | Fly.io 平台环境变量 |
| `netlify()` | Netlify 平台环境变量 |
| `coolify()` | Coolify 平台环境变量 |
| `uploadthing()` | UploadThing 服务变量 |
| `upstashRedis()` | Upstash Redis 服务变量 |
| `vite()` | Vite 框架内置变量（`MODE`、`DEV` 等） |
| `wxt()` | WXT 浏览器扩展框架变量 |

---

## 扩展预设

```ts
import { createEnv } from "@t3-oss/env-core";
import { vercel, upstashRedis } from "@t3-oss/env-core/presets-zod";
import * as z from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
  },
  clientPrefix: "PUBLIC_",
  client: {},
  runtimeEnv: process.env,
  // 使用 extends 引入预设中的变量
  extends: [vercel(), upstashRedis()],
});

// 现在可以访问预设中定义的所有变量
console.log(env.VERCEL_ENV);   // "development" | "preview" | "production" | undefined
console.log(env.UPSTASH_REDIS_REST_URL); // string
```

---

## 进阶示例

### 空字符串视为 undefined

`.env` 文件中 `PORT=` 这样的写法会产生空字符串，开启此选项后空字符串将被忽略，schema 中的 `default()` 也能正常生效：

```ts
export const env = createEnv({
  server: {
    PORT: z.coerce.number().default(3000),
    // .env 中写 PORT= 时，不开启此选项会抛出类型错误
    // 开启后会使用默认值 3000
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true, // ← 推荐新项目开启
});
```

---

### 跳过验证（测试环境）

在单元测试或 CI 构建中，可能无法提供完整的环境变量：

```ts
// vitest.setup.ts
process.env.SKIP_ENV_VALIDATION = "true";

// src/env.ts
export const env = createEnv({
  server: { DATABASE_URL: z.url() },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

---

### 自定义错误处理

```ts
export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
  },
  runtimeEnv: process.env,
  // 自定义验证失败的处理方式（例如集成错误上报）
  onValidationError: (issues) => {
    const messages = issues.map((i) => `  - ${i.path?.join(".")}: ${i.message}`).join("\n");
    console.error(`[env] 环境变量验证失败：\n${messages}`);
    process.exit(1);
  },
  // 自定义客户端访问服务端变量的处理方式
  onInvalidAccess: (variable) => {
    throw new Error(`[env] 安全警告：客户端不允许访问服务端变量 "${variable}"`);
  },
});
```

---

### Strict 模式

适用于 Next.js Edge Runtime、Cloudflare Workers 等会对 `process.env` 进行 tree-shaking 的环境：

```ts
// src/env.ts（Next.js 示例）
export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    AUTH_SECRET: z.string().min(32),
  },
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_API_URL: z.url(),
  },
  // 严格模式：TypeScript 强制要求列出所有变量
  runtimeEnvStrict: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
});
```

---

### 共享变量（server 和 client 均可访问）

```ts
export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
  },
  clientPrefix: "PUBLIC_",
  client: {
    PUBLIC_SENTRY_DSN: z.url().optional(),
  },
  // shared 中的变量服务端和客户端都能访问，无需前缀
  shared: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  runtimeEnv: process.env,
});

// 客户端也能访问
console.log(env.NODE_ENV); // "development" | "test" | "production"
```

---

### 与 Valibot 配合使用

```ts
import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

export const env = createEnv({
  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
    PORT: v.pipe(v.string(), v.transform(Number), v.number()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

---

### 与 ArkType 配合使用

```ts
import { createEnv } from "@t3-oss/env-core";
import { type } from "arktype";

export const env = createEnv({
  server: {
    DATABASE_URL: type("string.url"),
    PORT: type("string.integer.parse"),
  },
  runtimeEnv: process.env,
});
```

---

## 工作原理

1. `createEnv` 被调用时，合并 `server`、`client`、`shared` 三个 schema 字典
2. 使用 [Standard Schema](https://standardschema.dev) 接口对 `runtimeEnv` 中的值进行验证
3. 验证通过后，通过 `Proxy` 包装结果对象：
   - 客户端访问无前缀变量时，触发 `onInvalidAccess`
   - `__esModule`、`$$typeof` 等特殊属性被屏蔽
4. 最终返回类型完整、只读的环境变量对象
