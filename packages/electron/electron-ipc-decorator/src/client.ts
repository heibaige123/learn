import type { IpcRenderer } from 'electron'

/**
 * 创建一个 IPC 代理对象，使得可以通过调用方法的方式来发送 IPC 消息。
 * 例如，调用 `proxy.app.getVersion()` 会发送一个 IPC 消息到主进程，频道为 `app.getVersion`。
 * 
 * @template IpcServices 定义了 IPC 服务的结构，键是服务组名，值是包含方法的对象。
 * @param ipc IPC 渲染器实例，用于发送消息。
 * @returns 返回一个 IPC 代理对象，通过调用方法发送 IPC 消息。
 */
export function createIpcProxy<IpcServices extends Record<string, any>>(
  ipc: IpcRenderer | null,
): IpcServices | null {
  if (!ipc) {
    return null
  }

  return new Proxy({} as IpcServices, {
    get(target, groupName: string) {
      return new Proxy(
        {},
        {
          get(_, methodName: string) {
            return (...args: any[]) => {
              const channel = `${groupName}.${methodName}`
              return ipc.invoke(channel, ...args)
            }
          },
        },
      )
    },
  })
}
