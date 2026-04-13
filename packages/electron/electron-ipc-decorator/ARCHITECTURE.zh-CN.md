# electron-ipc-decorator 架构说明

## 1. 项目定位

`electron-ipc-decorator` 是一个面向 Electron 的轻量级 IPC 抽象层，目标不是替代 Electron 原生通信模型，而是在 `ipcMain.handle` / `ipcRenderer.invoke` 之上补齐三类能力：

1. 以装饰器方式声明主进程可暴露的方法。
2. 以服务分组方式组织 IPC 通道。
3. 以 TypeScript 类型工具自动推导渲染进程代理接口。

这个库的设计重心是“减少样板代码”，而不是提供完整框架。它没有容器、没有生命周期系统、没有依赖注入框架，也没有复杂的序列化层。整个实现非常薄，核心只是把“声明方法”“注册通道”“生成客户端代理”三件事串起来。

## 2. 对外能力边界

从包导出来看，公共 API 很克制：

- 根入口 `src/index.ts` 导出：`IpcMethod`、`IpcService`、`createServices`、`getIpcContext`
- 根入口导出类型：`IpcContext`、`IpcServiceConstructor`、`MergeIpcService`、`ExtractServiceMethods`
- 子路径入口 `src/client.ts` 导出：`createIpcProxy`

这说明它实际上分成两侧：

- 主进程侧：声明服务、注册处理器、按需读取上下文。
- 渲染进程侧：创建代理对象，通过 `invoke` 调用主进程方法。

库内部还有 `IpcHandler` 这样的辅助类，但它没有从公共入口重新导出，说明作者希望调用方主要围绕“服务类 + 装饰器 + 代理”这一套固定用法工作，而不是直接操纵底层注册器。

## 3. 总体分层

虽然这个项目体量很小，但分层其实很清楚，可以拆成四层。

### 3.1 公开接口层

- `src/index.ts`
- `src/client.ts`

这层负责决定包的外部使用方式。根入口对应主进程建模能力，`./client` 子入口对应渲染进程代理能力。

### 3.2 主进程运行时层

- `src/base.ts`

这是整个项目的核心。它同时承担：

- IPC 上下文管理。
- 装饰器元数据存储。
- 通道注册。
- 服务基类。
- 服务实例工厂。

也就是说，这个仓库的绝大多数运行时行为都集中在一个文件里。

### 3.3 类型映射层

- `src/utility.ts`

这一层不参与运行时行为，只负责在编译期把主进程服务类型转换成渲染进程代理类型。项目“TypeScript-first”的价值主要体现在这里。

### 3.4 验证层

- `src/base.test.ts`
- `src/client.test.ts`
- `src/index.test.ts`
- `src/utility.test.ts`

测试覆盖了运行时和类型层两部分，尤其是类型测试，直接体现了库作者对“自动推导”这件事的重视。

## 4. 核心设计思想

这个库围绕一个非常稳定的协议建模：

- 服务组名：`groupName`
- 方法名：被 `@IpcMethod()` 装饰的方法名
- 通道名：`<groupName>.<methodName>`

例如：

- 服务组 `app`
- 方法 `getVersion`
- 最终通道 `app.getVersion`

无论主进程注册还是渲染进程调用，双方都使用这个协议。也就是说，整个库的“架构核心”并不复杂，本质上就是把同一命名规则在两侧对齐：

1. 主进程根据类定义自动注册 `ipcMain.handle(channel, handler)`。
2. 渲染进程根据属性访问自动构造 `ipcRenderer.invoke(channel, ...args)`。

类型系统再在这个基础上补全参数和返回值推导。

## 5. 主进程侧架构

主进程所有关键能力都在 `src/base.ts` 中。

### 5.1 IpcContext 与上下文注入

主进程方法并不把 `IpcMainInvokeEvent` 作为显式参数传入，而是定义了：

- `IpcContext`
- `getIpcContext()`

其中 `IpcContext` 至少包含：

- `sender: WebContents`
- `event: IpcMainInvokeEvent`

上下文存储依赖 `AsyncLocalStorage<IpcContext>`。注册后的 IPC 处理器在真正执行用户方法前，会先构建当前请求上下文，再通过 `contextStorage.run(context, () => handler(...args))` 执行目标方法。

这带来两个效果：

1. 用户方法签名可以保持干净，只关注自己的业务参数。
2. 当业务确实需要访问发送方或原始事件时，再通过 `getIpcContext()` 按需读取。

这是这个项目相较早期“把 context 当第一个参数传进去”的最大结构变化。上下文从“显式参数耦合”变成了“运行时环境注入”。

### 5.2 装饰器元数据存储

`@IpcMethod()` 的实现非常轻量。它没有做复杂反射，只做一件事：

- 把被装饰的方法名记录到 `WeakMap<constructor, Map<propertyKey, methodName>>` 中。

这里的关键信息有两点：

1. 元数据是按“类构造函数”维度存储，而不是按实例存储。
2. 当前实现中 `methodName` 和 `propertyKey` 相同，没有自定义别名功能。

因此，装饰器的职责不是改变方法，而是为后续实例化时的“自动注册”提供一张方法清单。

### 5.3 IpcHandler：全局注册器

`IpcHandler` 是内部单例，负责真正调用 `ipcMain.handle`。它有两个核心成员：

- `instance`：单例实例。
- `registeredChannels`：已注册通道集合。

`registerMethod(channel, handler)` 的行为是：

1. 如果通道已存在，直接跳过。
2. 否则记录通道名。
3. 调用 `ipcMain.handle(channel, async (event, ...args) => { ... })`。
4. 在包装层中创建 `IpcContext`。
5. 用 `AsyncLocalStorage` 运行真实业务处理函数。
6. 捕获异常并输出错误日志，然后继续抛出给 Electron IPC。

这个包装层是主进程侧的真正运行时边界。所有被装饰的方法最终都会流经这里。

### 5.4 IpcService：服务基类

`IpcService` 是主进程服务的抽象父类。它约束了一个核心约定：

- 子类必须定义静态 `groupName`

它的构造函数会立即调用 `registerMethods()`，这意味着：

- 一旦实例化服务，注册过程就会立刻发生。
- 服务是否“对外可用”，取决于它是否已经被实例化。

`registerMethods()` 会：

1. 读取当前类构造函数在 `methodMetadata` 中记录的方法。
2. 遍历每个装饰过的方法。
3. 取实例上的同名属性。
4. 如果它仍然是函数，则绑定 `this` 后注册。

这里的 `bind(this)` 很重要，因为 Electron 调用处理函数时不会自动保留类实例上下文。如果不绑定，实例属性和实例方法之间的协作会失效。

### 5.5 createServices：服务实例工厂

`createServices()` 接收服务构造函数数组，返回按 `groupName` 建立的对象，例如：

```ts
{
  app: AppServiceInstance,
  user: UserServiceInstance,
}
```

它同时承担两种职责：

1. 运行时：批量实例化服务并返回对象。
2. 类型层：通过泛型把数组中的构造器映射成精确对象类型。

这个函数本身逻辑很简单，但它是连接“类定义”和“类型推导”的关键桥梁。大多数用户会用它来生成一份服务实例对象，再通过 `MergeIpcService<typeof services>` 推出渲染进程代理类型。

## 6. 渲染进程侧架构

渲染进程侧几乎全部逻辑都在 `src/client.ts`，设计非常薄。

### 6.1 createIpcProxy 的运行时模型

`createIpcProxy(ipc)` 做了两件事：

1. 如果 `ipc` 不可用，直接返回 `null`。
2. 否则返回一个双层 `Proxy`。

第一层 `Proxy` 拦截服务组访问：

- `proxy.app`
- `proxy.user`

第二层 `Proxy` 拦截方法访问：

- `proxy.app.getVersion`
- `proxy.user.getProfile`

最终返回的函数会在调用时构造通道名：

- `${groupName}.${methodName}`

然后执行：

- `ipc.invoke(channel, ...args)`

也就是说，渲染进程端没有预生成任何固定代理对象，它是纯动态的“按访问路径懒构造调用器”。

### 6.2 运行时动态与编译期静态分离

这里一个非常重要的架构点是：

- 运行时代理对象几乎不做校验。
- 真正的约束主要来自 TypeScript 类型参数。

比如在运行时，任何 `proxy.anyGroup.anyMethod()` 都可以被调用；是否安全、是否存在，全靠调用端传入的 `IpcServices` 泛型约束和主进程是否真的注册了对应通道。

这意味着它是一个“类型优先、运行时最小化”的设计。

## 7. 类型系统设计

`src/utility.ts` 是这个包的重要价值来源。它解决的问题是：

- 主进程方法可能是同步函数，也可能是异步函数。
- 但渲染进程通过 `ipcRenderer.invoke()` 调用后，最终语义总是异步的。

因此类型映射层做了统一处理。

### 7.1 ExtractServiceMethods

`ExtractServiceMethods<T>` 会从服务实例类型中提取“函数成员”，忽略普通属性，然后做两步变换：

1. 保留参数列表。
2. 把返回值包装成 `Promise<Awaited<T>>`。

这样可以同时兼容：

- 主进程同步方法 `(): string`
- 主进程异步方法 `(): Promise<string>`

映射后都会统一成渲染进程可感知的：

- `(): Promise<string>`

### 7.2 MergeIpcService

`MergeIpcService<T>` 用来把多个服务合并成一个“客户端可调用接口”。它兼容两种输入形式：

1. 服务构造器对象。
2. 服务实例对象。

这使它既能用于老的对象定义方式，也能用于新的 `createServices()` 返回值。

例如：

```ts
type IpcServices = MergeIpcService<typeof services>
```

最后得到的就是渲染进程代理的准确类型形状。

## 8. 典型调用链

从主进程到渲染进程，一次完整调用链如下。

### 8.1 启动阶段

1. 开发者定义服务类，继承 `IpcService`。
2. 用 `@IpcMethod()` 标注要暴露的方法。
3. 调用 `createServices([ServiceA, ServiceB])`。
4. 每个服务在构造时自动执行 `registerMethods()`。
5. 每个方法被注册成 `ipcMain.handle('<group>.<method>', wrapper)`。

### 8.2 调用阶段

1. 渲染进程调用 `createIpcProxy<IpcServices>(ipcRenderer)`。
2. 业务代码执行 `proxy.app.getVersion()`。
3. 代理构造通道 `app.getVersion`。
4. `ipcRenderer.invoke('app.getVersion')` 发往主进程。
5. `ipcMain.handle` 包装器收到事件并建立 `IpcContext`。
6. 包装器在 `AsyncLocalStorage` 范围内调用真实服务方法。
7. 服务方法如有需要，可通过 `getIpcContext()` 读取 `sender` / `event`。
8. 返回值或异常通过 Electron 原生 IPC 机制返回渲染进程。

## 9. 测试体现出的设计约束

从测试可以总结出几个明确的行为约束：

- `getIpcContext()` 只能在 IPC 处理函数上下文中调用，否则抛错。
- 同一通道不会重复注册。
- 被记录到元数据里的成员如果实例化时不再是函数，会被跳过注册。
- 没有被 `@IpcMethod()` 标记的方法不会暴露。
- 客户端代理支持任意参数个数，参数原样透传给 `ipc.invoke()`。
- 类型工具会自动过滤非函数属性，并把返回值统一 Promise 化。

这些约束共同定义了这个库的最小心智模型：

- 运行时只负责“通道转发”。
- 类型层负责“可用性提示和调用约束”。

## 10. 关键优点

### 10.1 实现非常薄

核心逻辑集中，几乎没有额外抽象层，适合小中型 Electron 应用快速接入。

### 10.2 上下文解耦

通过 `AsyncLocalStorage` 注入上下文，让服务方法签名更自然，不需要把 IPC 框架参数污染到所有业务方法里。

### 10.3 类型体验好

渲染进程代理不需要手写接口，只要主进程服务类型定义正确，就能自动推导。

### 10.4 服务分组清晰

通过 `groupName` 把通道命名约定显式化，避免大型应用中 IPC 命名散乱。

## 11. 当前架构的限制

### 11.1 通道命名不可定制

`@IpcMethod()` 当前只能记录原方法名，不能指定别名、版本号前缀或自定义通道名模板。

### 11.2 缺少注销机制

`IpcHandler` 只处理注册，不处理卸载或重注册。这对长期运行的应用通常够用，但不适合需要动态装载/卸载模块的场景。

### 11.3 重复组名没有显式冲突检测

`createServices()` 返回对象时如果组名重复，后写入的实例会覆盖前者，而 `IpcHandler` 又会阻止同名通道重复注册。这种组合在逻辑上可能形成“对象被覆盖，但注册器仍沿用第一次注册的处理器”的歧义。

### 11.4 groupName 校验时机偏后

`createServices()` 是先实例化，再检查 `groupName` 是否存在。对于不符合约束的服务类，这意味着错误是在实例构造之后才暴露，而不是构造前。

### 11.5 客户端代理几乎没有运行时防护

渲染进程端所有属性访问都能生成调用器。若类型定义和主进程实际注册不一致，错误只能在运行时 IPC 调用阶段暴露。

### 11.6 仅覆盖 invoke/handle 模型

当前库主要面向请求-响应式 IPC，不直接抽象事件订阅、广播、流式通信或双向回调协议。虽然内部 `IpcHandler` 有 `sendToRenderer()`，但它不在公共入口中，不构成主要 API 设计的一部分。

## 12. 适合的使用场景

这个架构最适合：

- Electron 中等规模应用。
- 主进程服务边界比较清晰的项目。
- 希望在渲染进程侧获得完整类型提示的 TypeScript 项目。
- 以 `invoke/handle` 为主的请求式 IPC 交互。

它不特别适合：

- 需要复杂权限控制或参数校验的 IPC 框架化场景。
- 需要动态卸载服务或动态命名空间管理的插件系统。
- 主要以事件流为核心而不是请求响应的通信模型。

## 13. 如果继续演进，最自然的方向

如果这个项目继续扩展，最合理的增强点通常会是：

1. 为 `@IpcMethod()` 增加自定义通道别名能力。
2. 在 `createServices()` 中增加组名冲突检测。
3. 增加注册注销能力和更明确的生命周期管理。
4. 在公共 API 中补充事件发送/订阅抽象，而不仅限于 `invoke/handle`。
5. 为主进程服务增加参数校验或权限钩子。

## 14. 一句话总结

`electron-ipc-decorator` 的架构本质上是“以类和装饰器声明主进程服务，以 `group.method` 协议注册 IPC，以类型工具映射渲染进程代理”的一层薄封装。它的优势不在复杂度，而在克制和直接，适合作为 Electron 项目中一套清晰、轻量、类型友好的 IPC 基础设施。