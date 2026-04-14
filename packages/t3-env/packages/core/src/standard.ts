/**
 * Standard Schema 接口。
 * 这是跨验证库的通用规范，Zod、Valibot、ArkType 等均实现了此接口。
 * @see https://standardschema.dev
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** Standard Schema 核心属性，包含版本号、厂商名、验证函数和类型信息。 */
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  /** Standard Schema 核心属性接口，定义了规范所要求的最小实现结构。 */
  export interface Props<Input = unknown, Output = Input> {
    /** Standard Schema 规范版本号，固定为 1。 */
    readonly version: 1;
    /** 实现此规范的验证库名称，如 "zod"、"valibot"、"arktype"。 */
    readonly vendor: string;
    /** 验证函数，接受未知输入并返回成功或失败结果（支持异步）。 */
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    /** 携带输入/输出类型信息的类型标记，供 TypeScript 类型推导使用。 */
    readonly types?: Types<Input, Output> | undefined;
  }

  /** 验证函数的返回值类型，为成功结果或失败结果的联合类型。 */
  export type Result<Output> = SuccessResult<Output> | FailureResult;

  /** 验证成功时的结果接口，包含类型化的输出值。 */
  export interface SuccessResult<Output> {
    /** 经过 schema 解析后的类型化输出值。 */
    readonly value: Output;
    /** 验证成功时 issues 不存在（undefined），用于区分成功和失败结果。 */
    readonly issues?: undefined;
  }

  /** 验证失败时的结果接口，包含所有验证错误。 */
  export interface FailureResult {
    /** 验证失败时产生的错误列表，每项对应一个字段验证错误。 */
    readonly issues: ReadonlyArray<Issue>;
  }

  /** 单个验证错误的描述接口。 */
  export interface Issue {
    /** 人类可读的错误消息，如 "Invalid url"、"Required"。 */
    readonly message: string;
    /** 出错字段的路径（如 `["server", "DATABASE_URL"]`），顶层字段时可能为空。 */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  /** 路径段接口，用于描述嵌套字段的访问路径。 */
  export interface PathSegment {
    /** 路径段的键名，可以是字符串、数字或 Symbol。 */
    readonly key: PropertyKey;
  }

  /** 携带 TypeScript 输入/输出类型信息的接口，供类型推导使用。 */
  export interface Types<Input = unknown, Output = Input> {
    /** Schema 的输入类型（验证前的原始类型）。 */
    readonly input: Input;
    /** Schema 的输出类型（验证并转换后的类型）。 */
    readonly output: Output;
  }

  /** 从 Standard Schema 实例推导其输入类型的工具类型。 */
  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema["~standard"]["types"]
  >["input"];

  /** 从 Standard Schema 实例推导其输出类型的工具类型。 */
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema["~standard"]["types"]
  >["output"];
}

/**
 * Standard Schema 字典类型，值为 Standard Schema 验证器的键值对映射。
 * `createEnv` 中的 server/client/shared 选项均使用此类型。
 */
export type StandardSchemaDictionary<
  Input = Record<string, unknown>,
  Output extends Record<keyof Input, unknown> = Input,
> = {
  [K in keyof Input]-?: StandardSchemaV1<Input[K], Output[K]>;
};

export namespace StandardSchemaDictionary {
  /** 从字典中推导所有 schema 的输入类型。 */
  export type InferInput<T extends StandardSchemaDictionary> = {
    [K in keyof T]: StandardSchemaV1.InferInput<T[K]>;
  };
  /** 从字典中推导所有 schema 的输出类型，用于生成 createEnv 返回值的最终类型。 */
  export type InferOutput<T extends StandardSchemaDictionary> = {
    [K in keyof T]: StandardSchemaV1.InferOutput<T[K]>;
  };
}

/**
 * 断言 Standard Schema 的验证结果是同步的（非 Promise）。
 * 若验证结果是 Promise，说明使用了异步验证器，t3-env 不支持此情况，直接抛出错误。
 *
 * @param value - 验证函数的返回值（可能是同步结果或 Promise）
 * @param message - 若为 Promise 时抛出的错误消息
 */
export function ensureSynchronous<T>(value: T | Promise<T>, message: string): asserts value is T {
  if (value instanceof Promise) {
    throw new Error(message);
  }
}

/**
 * 对 Standard Schema 字典中的每个字段分别执行验证，并汇总所有错误。
 * 这是 `createEnv` 内部使用的默认验证逻辑（未提供 `createFinalSchema` 时）。
 *
 * @param dictionary - 字段名到 Standard Schema 验证器的映射对象
 * @param value - 待验证的原始对象（通常为 process.env）
 * @returns Standard Schema 格式的验证结果：成功时含 value，失败时含 issues 数组
 */
export function parseWithDictionary<TDict extends StandardSchemaDictionary>(
  dictionary: TDict,
  value: Record<string, unknown>,
): StandardSchemaV1.Result<StandardSchemaDictionary.InferOutput<TDict>> {
  const result: Record<string, unknown> = {};  // 收集所有字段验证通过的输出值
  const issues: StandardSchemaV1.Issue[] = [];  // 收集所有字段验证失败的错误信息
  for (const key in dictionary) {
    // 对每个字段单独调用 Standard Schema 的 validate 方法
    const propResult = dictionary[key]["~standard"].validate(value[key]);

    // 确保验证是同步的（t3-env 不支持异步验证器）
    ensureSynchronous(propResult, `Validation must be synchronous, but ${key} returned a Promise.`);

    if (propResult.issues) {
      // 将字段错误添加到全局 issues 列表，并把字段名前置到错误路径
      issues.push(
        ...propResult.issues.map((issue) => ({
          ...issue,
          message: issue.message, // https://github.com/t3-oss/t3-env/pull/346
          path: [key, ...(issue.path ?? [])],  // 前置字段名，使路径完整（如 ["DATABASE_URL"]）
        })),
      );
      continue;
    }
    // 字段验证通过，保存解析后的值（可能经过 transform/default 处理）
    result[key] = propResult.value;
  }
  // 若存在任何字段错误，返回失败结果
  if (issues.length) {
    return { issues };
  }
  // 所有字段验证通过，返回成功结果
  return { value: result as never };
}
