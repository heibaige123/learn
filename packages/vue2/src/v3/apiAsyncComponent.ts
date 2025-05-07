import { warn, isFunction, isObject } from 'core/util'

/**
 * 异步组件的选项接口
 */
interface AsyncComponentOptions {
  /** 组件加载函数，返回一个 Promise，最终解析为组件对象 */
  loader: Function

  /** （可选）加载时显示的组件 */
  loadingComponent?: any

  /** （可选）加载失败时显示的组件 */
  errorComponent?: any

  /** （可选）显示 loadingComponent 之前的延迟（毫秒） */
  delay?: number

  /** （可选）加载超时时间（毫秒），超时后显示 errorComponent */
  timeout?: number

  /** （可选）是否启用 Suspense 支持（默认 true） */
  suspensible?: boolean

  /**
   * 加载出错时的错误处理回调
   * @param error 当前错误对象
   * @param retry 调用此函数会重试加载
   * @param fail 调用此函数会终止加载并显示 errorComponent
   * @param attempts 当前重试次数
   */
  onError?: (
    error: Error,
    retry: () => void,
    fail: () => void,
    attempts: number
  ) => any
}

/**
 * 异步组件工厂类型
 * 返回一个对象，包含异步组件的 Promise 及相关配置
 */
type AsyncComponentFactory = () => {
  /** 组件加载 Promise */
  component: Promise<any>
  /** （可选）加载时显示的组件 */
  loading?: any
  /** （可选）加载失败时显示的组件 */
  error?: any
  /** （可选）显示 loadingComponent 之前的延迟（毫秒） */
  delay?: number
  /** （可选）加载超时时间（毫秒） */
  timeout?: number
}

/**
 * v3 兼容的异步组件 API。
 * @internal 该类型在 <root>/types/v3-define-async-component.d.ts 中手动声明，
 * 因为它依赖于已有的手动类型定义。
 *
 * @param source 可以是一个异步加载函数，也可以是 AsyncComponentOptions 配置对象
 * @returns 返回一个 AsyncComponentFactory 工厂函数，调用后返回异步组件相关配置
 */
export function defineAsyncComponent(
  source: (() => any) | AsyncComponentOptions
): AsyncComponentFactory {
  if (isFunction(source)) {
    source = { loader: source } as AsyncComponentOptions
  }

  // 解构配置项，设置默认值
  const {
    loader, // 必须，异步加载组件的函数
    loadingComponent, // 可选，加载时显示的组件
    errorComponent, // 可选，加载失败时显示的组件
    delay = 200, // 可选，显示 loadingComponent 前的延迟，默认 200ms
    timeout, // 可选，加载超时时间，未定义则永不超时
    suspensible = false, // 可选，是否支持 Suspense，Vue2 不支持，默认 false
    onError: userOnError // 可选，用户自定义错误处理回调
  } = source

  // Vue2 不支持 suspensible，开发环境下给出警告
  if (__DEV__ && suspensible) {
    warn(
      `The suspensible option for async components is not supported in Vue2. It is ignored.`
    )
  }

  // 缓存当前的加载 Promise，避免重复请求
  let pendingRequest: Promise<any> | null = null

  // 记录重试次数
  let retries = 0
  // 重试函数，每次重试会清空 pendingRequest 并重新 load
  const retry = () => {
    retries++
    pendingRequest = null
    return load()
  }

  // 真正的加载函数，返回一个 Promise
  const load = (): Promise<any> => {
    let thisRequest: Promise<any>
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        loader()
          .catch(err => {
            // 统一错误对象类型
            err = err instanceof Error ? err : new Error(String(err))
            // 如果用户自定义了 onError 回调，则交给用户处理
            if (userOnError) {
              return new Promise((resolve, reject) => {
                // 用户可调用 retry() 或 fail() 控制流程
                const userRetry = () => resolve(retry())
                const userFail = () => reject(err)
                userOnError(err, userRetry, userFail, retries + 1)
              })
            } else {
              // 没有自定义错误处理则直接抛出
              throw err
            }
          })
          .then((comp: any) => {
            // 如果当前请求不是最新的 pendingRequest，则返回最新的 pendingRequest
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest
            }
            // 开发环境下警告：如果 loader 返回 undefined
            if (__DEV__ && !comp) {
              warn(
                `Async component loader resolved to undefined. ` +
                  `If you are using retry(), make sure to return its return value.`
              )
            }
            // 支持 ES module 的 default 导出
            if (
              comp &&
              (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
            ) {
              comp = comp.default
            }
            // 开发环境下校验返回值类型
            if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`)
            }
            return comp
          }))
    )
  }

  // 返回一个工厂函数，调用后返回异步组件相关配置
  return () => {
    const component = load()

    return {
      component, // 组件加载 Promise
      delay, // loadingComponent 延迟时间
      timeout, // 超时时间
      error: errorComponent, // 错误组件
      loading: loadingComponent // 加载组件
    }
  }
}
