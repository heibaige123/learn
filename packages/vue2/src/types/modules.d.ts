/**
 * 声明模块 'de-indent'，用于去除字符串的缩进。
 */
declare module 'de-indent' {
  /**
   * 默认导出函数，用于去除输入字符串的缩进。
   * @param input 输入的字符串
   * @returns 去除缩进后的字符串
   */
  export default function deindent(input: string): string
}

declare namespace jasmine {
  /**
   * 自定义匹配器，用于断言是否触发了警告。
   */
  interface Matchers<T> {
    /**
     * 断言方法，检查是否触发了警告。
     */
    toHaveBeenWarned(): void

    /**
     * 断言方法，检查是否触发了提示。
     */
    toHaveBeenTipped(): void
  }

  /**
   * 自定义匹配器，用于处理类数组对象的断言。
   */
  interface ArrayLikeMatchers<T> {
    /**
     * 断言方法，检查是否触发了警告。
     */
    toHaveBeenWarned(): void

    /**
     * 断言方法，检查是否触发了提示。
     */
    toHaveBeenTipped(): void
  }
}
