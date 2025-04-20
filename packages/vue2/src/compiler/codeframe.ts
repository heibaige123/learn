const range = 2

/**
 * 在编译错误发生时生成一个带有错误标记的代码片段展示
 * @param source 源代码字符串
 * @param start 错误的起始位置 (默认为0)
 * @param end 错误的结束位置 (默认为整个源码长度)
 * @returns 显示错误发生的位置
 */
export function generateCodeFrame(
  source: string,
  start: number = 0,
  end: number = source.length
): string {
  // 分割源码为行数组
  const lines = source.split(/\r?\n/)
  let count = 0
  // 初始化计数器和结果数组
  const res: string[] = []
  // 遍历每一行查找错误所在位置
  for (let i = 0; i < lines.length; i++) {
    count += lines[i].length + 1
    if (count >= start) {
      // 生成上下文展示
      for (let j = i - range; j <= i + range || end > count; j++) {
        if (j < 0 || j >= lines.length) continue
        // 添加行号和代码内容
        res.push(
          `${j + 1}${repeat(` `, 3 - String(j + 1).length)}|  ${lines[j]}`
        )
        const lineLength = lines[j].length
        if (j === i) {
          // push underline
          // 计算错误起始位置的缩进
          const pad = start - (count - lineLength) + 1
          // 计算需要标记的长度
          const length = end > count ? lineLength - pad : end - start
          // 添加下划线行，用 ^ 标记错误位置
          res.push(`   |  ` + repeat(` `, pad) + repeat(`^`, length))
        } else if (j > i) {
          // 处理跨行错误
          if (end > count) {
            const length = Math.min(end - count, lineLength)
            res.push(`   |  ` + repeat(`^`, length))
          }
          count += lineLength + 1
        }
      }
      break
    }
  }
  return res.join('\n')
}

/**
 * 重复指定的字符串 `str`，重复次数为 `n`。
 *
 * @param str 要重复的字符串
 * @param n 重复的次数
 * @returns 重复后的字符串
 */
function repeat(str: string, n: number) {
  let result = ''
  if (n > 0) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-line
      if (n & 1) result += str
      n >>>= 1
      if (n <= 0) break
      str += str
    }
  }
  return result
}
