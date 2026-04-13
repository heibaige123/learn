import { AsyncLocalStorage } from 'node:async_hooks'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { ipcMain } from 'electron'

// Base context for IPC methods
/**
 * IPC 方法的基础上下文
 * 这个接口定义了 IPC 方法处理函数中可用的上下文信息，包括发送者的 WebContents 和 IPC 事件对象。
 * 在 IPC 方法处理函数中，可以通过 getIpcContext() 函数来获取当前的 IPC 上下文，从而访问发送者的信息和事件对象。
 */
export interface IpcContext {
  sender: WebContents
  event: IpcMainInvokeEvent
}

// AsyncLocalStorage for context management
/**
 * 用于上下文管理的 AsyncLocalStorage
 * 这个 AsyncLocalStorage 实例用于在 IPC 方法处理函数中存储和访问 IPC 上下文信息。
 * 每当一个 IPC 方法被调用时，都会创建一个新的上下文并将其存储在 AsyncLocalStorage 中，
 * 这样在方法执行过程中就可以通过 getIpcContext() 函数来访问该上下文。
 */
const contextStorage = new AsyncLocalStorage<IpcContext>()

// Get current IPC context from AsyncLocalStorage
/**
 * 获取当前的 IPC 上下文
 * 这个函数会从 AsyncLocalStorage 中获取当前的 IPC 上下文，如果没有上下文可用，则抛出一个错误。
 * 这个函数应该在 IPC 方法处理函数中调用，以便访问发送者的信息和事件对象。
 * @returns 当前的 IPC 上下文
 */
export function getIpcContext(): IpcContext {
  const context = contextStorage.getStore()
  if (!context) {
    throw new Error(
      'IPC context is not available. Make sure this is called within an IPC handler.',
    )
  }
  return context
}

// Metadata storage for decorated methods
/**
 * 用于存储装饰器方法元数据的 WeakMap
 * 这个 WeakMap 用于在类的构造函数和方法之间存储装饰器方法的元数据。
 * 当一个方法被 @IpcMethod 装饰时，它会将方法名存储在这个 WeakMap 中，以便在实例化服务类时能够自动注册这些方法为 IPC 处理函数。
 * 由于使用了 WeakMap，当类的构造函数不再被引用时，相关的元数据也会被垃圾回收，从而避免内存泄漏。
 */
const methodMetadata = new WeakMap<any, Map<string, string>>()

// Decorator for IPC methods
/**
 * IPC 方法的装饰器
 * 这个装饰器用于标记一个类的方法为 IPC 方法。当一个方法被 @IpcMethod 装饰时，它会将该方法的名称存储在 methodMetadata 中，以便在实例化服务类时能够自动注册这些方法为 IPC 处理函数。
 * 使用示例：
 * ```typescript
 *    class AppService extends IpcService {
 *        static groupName = 'app'
 * 
 *        @IpcMethod()
 *        async getVersion() {
 *            return '1.0.0'
 *        }
 *     }
 * ```
 * 在这个示例中，getVersion 方法被 @IpcMethod 装饰，这意味着它将被自动注册为 IPC 处理函数，频道为 'app.getVersion'。
 * @returns 装饰器函数
 */
export function IpcMethod() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const { constructor } = target

    if (!methodMetadata.has(constructor)) {
      methodMetadata.set(constructor, new Map())
    }

    const methods = methodMetadata.get(constructor)!
    methods.set(propertyKey, propertyKey)

    return descriptor
  }
}

// Handler registry for IPC methods
/**
 * IPC 方法的处理器注册表
 * 这个类是一个单例，用于注册 IPC 方法的处理函数，并提供一个方法来向渲染器发送事件。
 * registerMethod 方法用于注册一个 IPC 方法的处理函数，确保同一频道不会被重复注册。
 * sendToRenderer 方法用于向指定的 WebContents 发送 IPC 消息，频道和数据由调用者指定。
 * 通过使用这个类，开发者可以集中管理 IPC 方法的注册和事件发送，从而简化 IPC 服务的实现。
 */
export class IpcHandler {
  private static instance: IpcHandler
  private registeredChannels = new Set<string>()

  static getInstance(): IpcHandler {
    if (!IpcHandler.instance) {
      IpcHandler.instance = new IpcHandler()
    }
    return IpcHandler.instance
  }

  
  registerMethod<TOutput>(
    channel: string,
    handler: (...args: any[]) => Promise<TOutput> | TOutput,
  ) {
    if (this.registeredChannels.has(channel)) {
      return // Already registered
    }

    this.registeredChannels.add(channel)

    ipcMain.handle(
      channel,
      async (event: IpcMainInvokeEvent, ...args: any[]) => {
        const context: IpcContext = {
          sender: event.sender,
          event,
        }

        try {
          return await contextStorage.run(context, () => handler(...args))
        } catch (error) {
          console.error(`Error in IPC method ${channel}:`, error)
          throw error
        }
      },
    )
  }

  // Send events to renderer
  /**
   * 向渲染器发送事件
   * 这个方法用于向指定的 WebContents 发送 IPC 消息，频道和数据由调用者指定。
   * @param webContents 目标 WebContents
   * @param channel IPC 频道
   * @param data 发送的数据
   */
  sendToRenderer<T = any>(webContents: WebContents, channel: string, data: T) {
    webContents.send(channel, data)
  }
}

// Base class for IPC service groups
/**
 * IPC 服务组的基类
 * 这个抽象类提供了一个基础实现，用于定义 IPC 服务组。每个服务组都应该继承这个类，并定义一个静态只读属性 groupName 来指定服务组的名称。
 * 在构造函数中，基类会调用 registerMethods() 方法来自动注册所有被 @IpcMethod 装饰的方法为 IPC 处理函数。
 * 通过继承这个基类，开发者可以轻松地创建新的 IPC 服务组，并且不需要手动注册每个方法，只需要使用 @IpcMethod 装饰器标记方法即可。
 * 使用示例：
 * ```typescript
 * class AppService extends IpcService {
 *   static groupName = 'app'
 * 
 *   @IpcMethod()
 *   async getVersion() {
 *     return '1.0.0'
 *   }
 * }
 * ```
 * 在这个示例中，AppService 继承了 IpcService，并定义了 groupName 为 'app'。
 * getVersion 方法被 @IpcMethod 装饰，这意味着它将被自动注册为 IPC 处理函数，频道为 'app.getVersion'。
 */
export abstract class IpcService {
  protected handler = IpcHandler.getInstance()
  static readonly groupName: string

  constructor() {
    this.registerMethods()
  }

  protected registerMethods(): void {
    const { constructor } = this
    const methods = methodMetadata.get(constructor)

    if (methods) {
      methods.forEach((methodName, propertyKey) => {
        const method = (this as any)[propertyKey]
        if (typeof method === 'function') {
          this.registerMethod(methodName, method.bind(this))
        }
      })
    }
  }

  protected registerMethod<TOutput>(
    methodName: string,
    handler: (...args: any[]) => Promise<TOutput> | TOutput,
  ) {
    const groupName = (this.constructor as typeof IpcService).groupName
    const channel = `${groupName}.${methodName}`
    this.handler.registerMethod(channel, handler)
  }
}

// Service constructor with groupName
/**
 * 服务构造函数接口
 * 这个接口定义了一个服务构造函数的类型，要求它必须具有一个静态只读属性 groupName，用于指定服务所属的组名。
 * 这个接口用于 createServices 函数中，以确保传入的服务构造函数符合预期的结构，从而能够正确地创建服务实例并注册 IPC 方法。
 */
export interface IpcServiceConstructor {
  new (): IpcService
  readonly groupName: string
}

// Create services function that infers types from service constructors
/**
 * 创建服务函数，能够从服务构造函数中推断类型
 * 这个函数接受一个服务构造函数的数组，并返回一个包含所有服务实例的对象，键是服务组名，值是对应的服务实例。
 * 通过使用 TypeScript 的类型推断功能，createServices 函数能够自动推断出每个服务组的实例类型，从而在使用时提供类型安全和自动补全的好处。
 * 使用示例：
 * ```typescript
 * const services = createServices([AppService, UserService])
 * // services 的类型将会是 { app: AppService, user: UserService }
 * ``` 
 * @param serviceConstructors 
 * @returns 
 */
export function createServices<T extends readonly IpcServiceConstructor[]>(
  serviceConstructors: T,
): CreateServicesResult<T> {
  const services = {} as any

  for (const ServiceConstructor of serviceConstructors) {
    const instance = new ServiceConstructor()
    const groupName = ServiceConstructor.groupName

    if (!groupName) {
      throw new Error(
        `Service ${ServiceConstructor.name} must define a static readonly groupName property`,
      )
    }

    services[groupName] = instance
  }

  return services
}

// Helper type for createServices return type
/**
 * 创建服务结果的类型
 * 这个类型会根据传入的服务构造函数数组，自动推断出每个服务组的实例类型，并将它们组合成一个对象类型，键是服务组名，值是对应的实例类型。
 * 例如，如果传入的服务构造函数数组包含两个服务：AppService 和 UserService，它们分别定义了 groupName 为 'app' 和 'user'，那么 CreateServicesResult 的结果类型将会是：
 * {
 *   app: AppService,
 *   user: UserService
 * }
 * 这样做的目的是为了让 createServices 函数能够返回一个具有正确类型的服务对象，使得在使用时能够获得类型安全和自动补全的好处。
 */
type CreateServicesResult<T extends readonly IpcServiceConstructor[]> = {
  [K in T[number] as K['groupName']]: InstanceType<K>
}
