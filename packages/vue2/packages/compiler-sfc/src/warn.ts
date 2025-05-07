// 用于记录哪些消息已经被警告过，防止重复输出
const hasWarned: Record<string, boolean> = {}

/**
 * warnOnce函数 - 只在非生产环境且首次遇到时输出一次警告信息
 * @param {string} msg - 要输出的警告消息
 */
export function warnOnce(msg: string) {
  // 检查是否在Node.js环境且NODE_ENV为'production'
  const isNodeProd =
    typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
  // 只有在非生产环境 并且 该消息之前没有被警告过时，才执行警告
  if (!isNodeProd && !hasWarned[msg]) {
    // 标记该消息为已警告
    hasWarned[msg] = true
    // 调用实际的warn函数输出消息
    warn(msg)
  }
}

/**
 * warn函数 - 以特定格式输出警告信息到控制台
 * @param {string} msg - 要输出的警告消息
 */
export function warn(msg: string) {
  // 使用console.warn输出格式化的警告
  // \x1b[...] 是ANSI转义码，用于在支持的终端中添加颜色和样式
  console.warn(
    // 设置样式：加粗(1)，黄色(33)
    // *   `\x1b[1m`: **加粗**
    // *   `\x1b[33m`: **黄色** 文本
    // *   `\x1b[0m`: **重置**所有样式和颜色
    `\x1b[1m\x1b[33m[@vue/compiler-sfc]\x1b[0m\x1b[33m ${msg}\x1b[0m\n`
    // \x1b[0m 重置所有样式
    // \n 在末尾添加换行符
  )
}
