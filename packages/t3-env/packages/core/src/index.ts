/**
 * t3-env 核心包。
 * 提供 `createEnv` 函数，用于创建类型安全的环境变量 schema。
 * @module
 */
import type { StandardSchemaDictionary, StandardSchemaV1 } from "./standard.ts";
import { ensureSynchronous, parseWithDictionary } from "./standard.ts";

export type {
  /**
   * The Standard Schema Interface
   * @see https://github.com/standard-schema/standard-schema
   * @internal
   */
  StandardSchemaV1,
  /**
   * A record with values being Standard Schema validators
   * @see https://github.com/standard-schema/standard-schema
   * @internal
   */
  StandardSchemaDictionary,
};

/**
 * 类型错误占位符，在 TypeScript 编译期产生可读的错误信息。
 * 当 schema 中某个键不符合前缀约束时，会用此类型替换字段类型，使 IDE 显示友好错误。
 * @internal
 */
type ErrorMessage<T extends string> = T;

/**
 * 将复杂的交叉类型"拍平"为单一对象类型，改善 IDE 中的类型提示可读性。
 * @internal
 */
type Simplify<T> = {
  [P in keyof T]: T[P];
} & {};

/**
 * 提取类型 T 中值类型包含 undefined 的所有键名。
 * 用于将可选字段从必填字段中区分出来。
 * @internal
 */
type PossiblyUndefinedKeys<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

/**
 * 将类型 T 中值可为 undefined 的键变为可选（`?:`），其余键保持必填。
 * 用于生成 createEnv 返回值的类型，使带 default() 的字段变为可选。
 * @internal
 */
type UndefinedOptional<T> = Partial<Pick<T, PossiblyUndefinedKeys<T>>> &
  Omit<T, PossiblyUndefinedKeys<T>>;

/**
 * 将类型 T 的所有键设为 never（不可赋值），用于在联合类型中互斥地禁止某些选项。
 * 例如：当只传 server 时，禁止同时传入 client/clientPrefix 字段。
 * @internal
 */
type Impossible<T extends Record<string, any>> = Partial<Record<keyof T, never>>;

/**
 * 去除 Readonly 修饰，将只读类型转换为可变类型。
 * 用于 Reduce 类型中合并预设对象时消除 readonly 约束。
 * @internal
 */
type Mutable<T> = T extends Readonly<infer U> ? U : T;

/**
 * 将一组 Record 类型数组递归合并为单一对象类型，数组靠前的键优先（后面的同名键被忽略）。
 * 用于合并 extends 预设与主 schema 的返回类型。
 * @internal
 */
type Reduce<TArr extends Record<string, unknown>[], TAcc = object> = TArr extends []
  ? TAcc
  : TArr extends [infer Head, ...infer Tail]
    ? Tail extends Record<string, unknown>[]
      ? Mutable<Head> & Omit<Reduce<Tail, TAcc>, keyof Head>
      : never
    : never;

/**
 * 传递给 `createEnv` 函数的通用基础配置项。
 * `LooseOptions` 和 `StrictOptions` 均继承此接口。
 */
export interface BaseOptions<
  TShared extends StandardSchemaDictionary,
  TExtends extends Array<Record<string, unknown>>,
> {
  /**
   * 判断当前运行环境是否为服务端。
   * 默认逻辑：`typeof window === "undefined"` 或在 Deno 环境中。
   * 在 SSR 框架（如 Next.js）中通常无需手动设置。
   * @default typeof window === "undefined"
   */
  isServer?: boolean;

  /**
   * 服务端和客户端共享的环境变量 schema。
   * 适合存放构建工具注入的变量（如 `NODE_ENV`、`VERCEL_URL`），
   * 这些变量无需前缀，客户端和服务端均可访问。
   */
  shared?: TShared;

  /**
   * 扩展内置预设（如 `vercel()`、`upstashRedis()` 等）。
   * 传入的预设返回值会被合并到最终环境变量对象中，并体现在返回类型上。
   */
  extends?: TExtends;

  /**
   * 环境变量验证失败时的回调函数。
   * 默认行为：打印错误信息并抛出异常，终止应用启动。
   * 可自定义为发送告警通知或调用 `process.exit(1)`。
   * @param issues - Standard Schema 返回的验证错误详情数组
   */
  onValidationError?: (issues: readonly StandardSchemaV1.Issue[]) => never;

  /**
   * 客户端代码尝试访问服务端专属环境变量时的回调函数。
   * 默认行为：抛出运行时错误，防止服务端密钥泄露给客户端。
   * @param variable - 被非法访问的变量名
   */
  onInvalidAccess?: (variable: string) => never;

  /**
   * 是否跳过环境变量验证。
   * 在单元测试或 CI 构建等场景下，完整的环境变量可能不可用，可将此项设为 `true`。
   * 跳过验证时直接返回原始 `runtimeEnv` 对象，不进行类型解析。
   * @default false
   */
  skipValidation?: boolean;

  /**
   * 是否将空字符串 `""` 视为 `undefined`。
   *
   * 默认情况下，库会将环境变量原样传给验证器，导致两个常见问题：
   * 1. `.env` 中 `PORT=`（空字符串）会让数字类型 schema 报类型错误
   * 2. `.env` 中 `DOMAIN=`（空字符串）会让带 `default()` 的 schema 无法使用默认值
   *
   * 开启此选项后，所有空字符串会在验证前被删除，从而触发 schema 的 `optional()` 或 `default()` 逻辑。
   * 新项目推荐始终设为 `true`。
   */
  emptyStringAsUndefined?: boolean;
}

/**
 * 宽松模式运行时选项。使用 `runtimeEnv` 提供环境变量来源。
 *
 * 此模式**不校验** `runtimeEnv` 中是否包含了 schema 里定义的所有键，
 * 适用于 Node.js 服务端等可以完整访问 `process.env` 的环境。
 * 如果你的框架会进行静态分析和 tree-shaking（如 Next.js Edge Runtime），
 * 请改用 `StrictOptions`。
 */
export interface LooseOptions<
  TShared extends StandardSchemaDictionary,
  TExtends extends Array<Record<string, unknown>>,
> extends BaseOptions<TShared, TExtends> {
  runtimeEnvStrict?: never;

  /**
   * 运行时环境变量的来源对象。
   * - Node.js 项目：`process.env`
   * - Vite / Astro 项目：`import.meta.env`
   * - Cloudflare Workers：`env`（来自 fetch handler 参数）
   *
   * 与 `runtimeEnvStrict` 不同，此字段不要求列出所有 schema 中定义的键。
   */
  // 与 runtimeEnvStrict 不同，此项不强制要求所有变量都已显式提供。
  runtimeEnv: Record<string, string | boolean | number | undefined>;
}

/**
 * 严格模式运行时选项。使用 `runtimeEnvStrict` 提供环境变量来源。
 *
 * TypeScript 会在编译期检查 `runtimeEnvStrict` 对象是否**精确包含**了
 * schema 中所有定义的键（不多不少）。适用于：
 * - Next.js Edge Runtime
 * - Cloudflare Workers
 * - 任何会对 `process.env` 进行 tree-shaking 的构建工具
 *
 * 漏掉任意一个键都会产生 TypeScript 编译错误。
 */
export interface StrictOptions<
  TPrefix extends string | undefined,
  TServer extends StandardSchemaDictionary,
  TClient extends StandardSchemaDictionary,
  TShared extends StandardSchemaDictionary,
  TExtends extends Array<Record<string, unknown>>,
> extends BaseOptions<TShared, TExtends> {
  /**
   * 严格模式下的运行时环境变量来源对象。
   * 类型系统会强制要求此对象包含且仅包含 schema 中所有定义的键。
   * 适用于 Next.js Edge Runtime、Cloudflare Workers 等会进行静态分析的环境。
   *
   * @example
   * ```ts
   * runtimeEnvStrict: {
   *   DATABASE_URL: process.env.DATABASE_URL,
   *   NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
   * }
   * ```
   */
  runtimeEnvStrict: Record<
    | {
        [TKey in keyof TClient]: TPrefix extends undefined
          ? never
          : TKey extends `${TPrefix}${string}`
            ? TKey
            : never;
      }[keyof TClient]
    | {
        [TKey in keyof TServer]: TPrefix extends undefined
          ? TKey
          : TKey extends `${TPrefix}${string}`
            ? never
            : TKey;
      }[keyof TServer]
    | {
        [TKey in keyof TShared]: TKey extends string ? TKey : never;
      }[keyof TShared],
    string | boolean | number | undefined
  >;
  runtimeEnv?: never;
}

/**
 * 客户端环境变量配置接口。
 * 与 `clientPrefix` 选项配合使用，在类型层面和运行时均强制要求
 * 所有客户端变量以指定前缀开头。
 *
 * 常见前缀示例：
 * - Next.js：`NEXT_PUBLIC_`
 * - Nuxt：`NUXT_PUBLIC_`
 * - Vite：`VITE_`
 * - 通用：`PUBLIC_`
 */
export interface ClientOptions<
  TPrefix extends string | undefined,
  TClient extends StandardSchemaDictionary,
> {
  /**
   * 客户端变量必须携带的前缀字符串。
   * 类型层面和运行时均会强制校验——不带此前缀的键会产生 TypeScript 编译错误。
   * @example "NEXT_PUBLIC_" | "PUBLIC_" | "VITE_"
   */
  clientPrefix: TPrefix;

  /**
   * 客户端环境变量的 schema 定义。
   * 键名必须以 `clientPrefix` 开头，否则会产生 TypeScript 类型错误。
   * 客户端和服务端均可访问这些变量。
   *
   * @example
   * ```ts
   * client: {
   *   NEXT_PUBLIC_API_URL: z.url(),
   *   NEXT_PUBLIC_FEATURE_FLAG: z.enum(["on", "off"]).default("off"),
   * }
   * ```
   */
  client: Partial<{
    [TKey in keyof TClient]: TKey extends `${TPrefix}${string}`
      ? TClient[TKey]
      : ErrorMessage<`${TKey extends string ? TKey : never} is not prefixed with ${TPrefix}.`>;
  }>;
}

/**
 * 服务端环境变量配置接口。
 * 此处定义的变量仅在服务端可访问，客户端访问时会触发 `onInvalidAccess`。
 * 当设置了 `clientPrefix` 时，服务端变量的键名不允许以该前缀开头。
 */
export interface ServerOptions<
  TPrefix extends string | undefined,
  TServer extends StandardSchemaDictionary,
> {
  /**
   * 服务端环境变量的 schema 定义。
   * 在此定义的变量只有服务端才能访问，适合存储数据库连接串、API 密钥等敏感信息。
   * 键名不得以 `clientPrefix` 开头（若已设置），否则会产生 TypeScript 编译错误。
   *
   * @example
   * ```ts
   * server: {
   *   DATABASE_URL: z.url(),
   *   JWT_SECRET: z.string().min(32),
   *   SMTP_HOST: z.string(),
   * }
   * ```
   */
  server: Partial<{
    [TKey in keyof TServer]: TPrefix extends undefined
      ? TServer[TKey]
      : TPrefix extends ""
        ? TServer[TKey]
        : TKey extends `${TPrefix}${string}`
          ? ErrorMessage<`${TKey extends `${TPrefix}${string}`
              ? TKey
              : never} should not prefixed with ${TPrefix}.`>
          : TServer[TKey];
  }>;
}

/**
 * 自定义 schema 合并逻辑的配置接口。
 * 通常不需要使用此接口，仅在需要对合并后的 schema 进行跨字段验证或额外转换时使用。
 */
export interface CreateSchemaOptions<
  TServer extends StandardSchemaDictionary,
  TClient extends StandardSchemaDictionary,
  TShared extends StandardSchemaDictionary,
  TFinalSchema extends StandardSchemaV1<{}, {}>,
> {
  /**
   * 自定义 schema 合并函数。
   * 接收合并后的 schema 字典和当前运行环境标志，返回最终用于验证的 Standard Schema 对象。
   * 可用于添加跨字段的 `refine` 验证或自定义数据转换逻辑。
   *
   * @param shape - 合并后的 server + client + shared schema 字典
   * @param isServer - 当前是否为服务端环境
   * @returns 用于执行最终验证的 Standard Schema 实例
   */
  createFinalSchema?: (shape: TServer & TClient & TShared, isServer: boolean) => TFinalSchema;
}

export type ServerClientOptions<
  TPrefix extends string | undefined,
  TServer extends StandardSchemaDictionary,
  TClient extends StandardSchemaDictionary,
> =
  | (ClientOptions<TPrefix, TClient> & ServerOptions<TPrefix, TServer>)
  | (ServerOptions<TPrefix, TServer> & Impossible<ClientOptions<never, never>>)
  | (ClientOptions<TPrefix, TClient> & Impossible<ServerOptions<never, never>>);

export type EnvOptions<
  TPrefix extends string | undefined,
  TServer extends StandardSchemaDictionary,
  TClient extends StandardSchemaDictionary,
  TShared extends StandardSchemaDictionary,
  TExtends extends Array<Record<string, unknown>>,
  TFinalSchema extends StandardSchemaV1<{}, {}>,
> = (
  | (LooseOptions<TShared, TExtends> & ServerClientOptions<TPrefix, TServer, TClient>)
  | (StrictOptions<TPrefix, TServer, TClient, TShared, TExtends> &
      ServerClientOptions<TPrefix, TServer, TClient>)
) &
  CreateSchemaOptions<TServer, TClient, TShared, TFinalSchema>;

type TPrefixFormat = string | undefined;
type TServerFormat = StandardSchemaDictionary;
type TClientFormat = StandardSchemaDictionary;
type TSharedFormat = StandardSchemaDictionary;
type TExtendsFormat = Array<Record<string, unknown>>;

export type DefaultCombinedSchema<
  TServer extends TServerFormat,
  TClient extends TClientFormat,
  TShared extends TSharedFormat,
> = StandardSchemaV1<
  {},
  UndefinedOptional<StandardSchemaDictionary.InferOutput<TServer & TClient & TShared>>
>;

export type CreateEnv<
  TFinalSchema extends StandardSchemaV1<{}, {}>,
  TExtends extends TExtendsFormat,
> = Readonly<Simplify<Reduce<[StandardSchemaV1.InferOutput<TFinalSchema>, ...TExtends]>>>;

/**
 * 创建类型安全的环境变量对象。
 *
 * 此函数在应用启动时对所有环境变量进行验证，并返回一个只读的代理对象。
 * - 服务端变量在客户端访问时会抛出运行时错误
 * - 验证失败时默认打印错误并抛出异常，阻止应用启动
 * - 返回值具有完整的 TypeScript 类型推导
 *
 * @param opts - 包含 server/client/shared schema 及运行时配置的选项对象
 * @returns 只读的、经过验证的环境变量对象
 *
 * @example
 * ```ts
 * import { createEnv } from "@t3-oss/env-core";
 * import * as z from "zod";
 *
 * export const env = createEnv({
 *   server: { DATABASE_URL: z.url(), API_KEY: z.string().min(1) },
 *   clientPrefix: "PUBLIC_",
 *   client: { PUBLIC_APP_URL: z.url() },
 *   shared: { NODE_ENV: z.enum(["development", "test", "production"]) },
 *   runtimeEnv: process.env,
 *   emptyStringAsUndefined: true,
 * });
 *
 * // 类型化访问
 * env.DATABASE_URL;  // string
 * env.PUBLIC_APP_URL; // string
 * env.NODE_ENV;      // "development" | "test" | "production"
 * ```
 */
export function createEnv<
  TPrefix extends TPrefixFormat,
  TServer extends TServerFormat = NonNullable<unknown>,
  TClient extends TClientFormat = NonNullable<unknown>,
  TShared extends TSharedFormat = NonNullable<unknown>,
  const TExtends extends TExtendsFormat = [],
  TFinalSchema extends StandardSchemaV1<{}, {}> = DefaultCombinedSchema<TServer, TClient, TShared>,
>(
  opts: EnvOptions<TPrefix, TServer, TClient, TShared, TExtends, TFinalSchema>,
): CreateEnv<TFinalSchema, TExtends> {
  // 优先使用 runtimeEnvStrict（严格模式），其次 runtimeEnv（宽松模式），最后回退到 process.env
  const runtimeEnv = opts.runtimeEnvStrict ?? opts.runtimeEnv ?? process.env;

  // 是否将空字符串视为 undefined，默认关闭
  const emptyStringAsUndefined = opts.emptyStringAsUndefined ?? false;
  if (emptyStringAsUndefined) {
    // 遍历运行时环境变量，删除所有空字符串值，使 schema 的 optional()/default() 能正常工作
    for (const [key, value] of Object.entries(runtimeEnv)) {
      if (value === "") {
        delete runtimeEnv[key];
      }
    }
  }

  // 若配置了 skipValidation，直接返回原始 runtimeEnv，跳过所有验证和类型解析
  const skip = !!opts.skipValidation;
  if (skip) {
    if (opts.extends) {
      // 同时对所有扩展预设禁用验证，保持行为一致
      for (const preset of opts.extends) {
        preset.skipValidation = true;
      }
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    return runtimeEnv as any;
  }

  // 提取各端的 schema 字典，若未定义则回退为空对象
  const _client = typeof opts.client === "object" ? opts.client : {};
  const _server = typeof opts.server === "object" ? opts.server : {};
  const _shared = typeof opts.shared === "object" ? opts.shared : {};
  // 判断当前是否为服务端环境：window 不存在，或运行在 Deno 中
  const isServer = opts.isServer ?? (typeof window === "undefined" || "Deno" in window);

  // 根据运行环境组合最终的 schema 字典：
  // 服务端：server + shared + client（服务端可访问所有变量）
  // 客户端：client + shared（客户端只能访问带前缀的变量和共享变量）
  const finalSchemaShape = isServer
    ? {
        ..._server,
        ..._shared,
        ..._client,
      }
    : {
        ..._client,
        ..._shared,
      };

  // 若提供了自定义 schema 合并函数则使用它，否则使用内置的字典解析器
  const finalSchema = opts.createFinalSchema?.(finalSchemaShape as never, isServer);
  const parsed =
    finalSchema?.["~standard"].validate(runtimeEnv) ??
    parseWithDictionary(finalSchemaShape, runtimeEnv);

  // 确保验证是同步执行的（Standard Schema 允许异步，但此处不支持）
  ensureSynchronous(parsed, "Validation must be synchronous");

  // 验证失败回调：默认打印错误并抛出异常，阻止应用继续启动
  const onValidationError =
    opts.onValidationError ??
    ((issues) => {
      console.error("❌ Invalid environment variables:", issues);
      throw new Error("Invalid environment variables");
    });

  // 非法访问回调：客户端访问服务端变量时触发，默认抛出运行时错误
  const onInvalidAccess =
    opts.onInvalidAccess ??
    (() => {
      throw new Error("❌ Attempted to access a server-side environment variable on the client");
    });

  // 若存在验证错误，调用错误回调（函数签名为 never，必然终止执行）
  if (parsed.issues) {
    return onValidationError(parsed.issues);
  }

  /**
   * 判断某个属性名是否属于"服务端专属"访问。
   * - 未设置 clientPrefix 时，所有属性均视为服务端属性
   * - 设置了 clientPrefix 时，不以该前缀开头且不在 shared 中的属性视为服务端属性
   */
  const isServerAccess = (prop: string) => {
    if (!opts.clientPrefix) return true;
    return !prop.startsWith(opts.clientPrefix) && !(prop in _shared);
  };
  /**
   * 判断当前访问是否合法。
   * 服务端环境可以访问所有属性；客户端只能访问非服务端属性。
   */
  const isValidServerAccess = (prop: string) => {
    return isServer || !isServerAccess(prop);
  };
  /**
   * 判断是否应忽略某个属性（如 ES module 内部标记），避免代理拦截干扰模块系统。
   */
  const ignoreProp = (prop: string) => {
    return prop === "__esModule" || prop === "$$typeof";
  };

  // 将所有扩展预设的属性合并到基础对象中（预设在前，主 schema 解析值在后，后者优先）
  const extendedObj = (opts.extends ?? []).reduce((acc, curr) => {
    return Object.assign(acc, curr);
  }, {});
  // 将预设对象与验证后的 schema 解析值合并，主 schema 的值会覆盖同名预设值
  const fullObj = Object.assign(extendedObj, parsed.value);

  // 使用 Proxy 包装最终对象，实现服务端/客户端访问控制
  const env = new Proxy(fullObj, {
    get(target, prop) {
      // 非字符串属性（如 Symbol）直接返回 undefined
      if (typeof prop !== "string") return undefined;
      // 忽略模块系统内部属性（__esModule、$$typeof 等）
      if (ignoreProp(prop)) return undefined;
      // 客户端尝试访问服务端变量时，触发 onInvalidAccess 回调
      if (!isValidServerAccess(prop)) return onInvalidAccess(prop);
      return Reflect.get(target, prop);
    },
    // 暂未实现 set 拦截（只读约束），未来可能重新考虑：
    // https://github.com/t3-oss/t3-env/pull/111#issuecomment-1682931526
    // set(_target, prop) {
    //   // Readonly - this is the error message you get from assigning to a frozen object
    //   throw new Error(
    //     typeof prop === "string"
    //       ? `Cannot assign to read only property ${prop} of object #<Object>`
    //       : `Cannot assign to read only property of object #<Object>`
    //   );
    // },
  });

  return env as any;
}
