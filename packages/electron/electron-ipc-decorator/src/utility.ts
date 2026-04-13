// Extract method signatures from service class
/**
 * 工具类型：从服务类中提取方法签名
 * 这个类型会检查服务类中的每个成员，如果是一个方法，则提取其参数和返回类型，并将其转换为一个新的函数类型，返回值始终是一个 Promise。
 * 如果方法没有参数，则返回一个不带参数的函数类型；如果方法有一个参数，则返回一个带有该参数的函数类型；如果方法有多个参数，则返回一个带有所有参数的函数类型。
 * 这个工具类型使得我们能够自动从服务类中生成 IPC 服务接口，无论服务类使用的是旧的对象格式还是新的 createServices 格式。
 */
export type ExtractServiceMethods<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any
    ? K
    : never]: T[K] extends (...args: infer Args) => infer Output
    ? Args extends []
      ? () => AlwaysPromise<Output>
      : Args extends [infer Input]
        ? (input: Input) => AlwaysPromise<Output>
        : (...args: Args) => AlwaysPromise<Output>
    : never;
};

/**
 * 工具类型：将所有方法的返回值转换为 Promise
 * 这个类型会将服务类中的每个方法的返回值类型转换为一个 Promise 类型，无论原始方法的返回值是什么。
 * 这样做的目的是为了确保所有 IPC 服务方法的返回值都是 Promise，以便在 IPC 调用中能够正确处理异步结果。
 */
type AlwaysPromise<T> = Promise<Awaited<T>>;

// TypeScript utility type to automatically merge IPC services
// This version works with both the old object format and new createServices format

/**
 * 工具类型：自动合并 IPC 服务
 * 这个类型会检查 IPC 服务对象中的每个成员，如果是一个类的构造函数，则提取该类中的方法签名；如果是一个普通对象，则直接提取其方法签名。
 * 这样做的目的是为了支持两种不同的服务定义方式：一种是使用类来定义服务，另一种是直接使用对象来定义服务。无论哪种方式，都能够正确地提取方法签名并生成 IPC 服务接口。
 */
export type MergeIpcService<T> = {
  [K in keyof T]: T[K] extends new (...args: any[]) => infer Instance
    ? ExtractServiceMethods<Instance>
    : T[K] extends infer Instance
      ? ExtractServiceMethods<Instance>
      : never;
};
