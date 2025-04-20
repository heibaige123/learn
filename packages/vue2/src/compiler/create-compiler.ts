import { extend } from 'shared/util'
import { CompilerOptions, CompiledResult, WarningMessage } from 'types/compiler'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

/**
 * 创建一个编译器的创建函数。
 * @param baseCompile 基础编译函数，用于将模板字符串编译为抽象语法树（AST）。
 * @returns 一个函数，用于创建编译器实例。
 */
export function createCompilerCreator(baseCompile: Function): Function {
  return function createCompiler(baseOptions: CompilerOptions) {
    /**
     * 编译模板字符串为编译结果。
     * @param template 模板字符串。
     * @param options 可选的编译选项，用于覆盖基础选项。
     * @returns 编译结果，包括生成的代码、错误和提示信息。
     */
    function compile(
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      const finalOptions = Object.create(baseOptions)
      /**
       * 存储编译过程中产生的错误信息。
       */
      const errors: WarningMessage[] = []
      /**
       * 存储编译过程中产生的提示信息。
       */
      const tips: WarningMessage[] = []

      let warn = (
        msg: WarningMessage,
        range: { start: number; end: number },
        tip: string
      ) => {
        ;(tip ? tips : errors).push(msg)
      }

      if (options) {
        if (__DEV__ && options.outputSourceRange) {
          // $flow-disable-line
          const leadingSpaceLength = template.match(/^\s*/)![0].length

          warn = (
            msg: WarningMessage | string,
            range: { start: number; end: number },
            tip: string
          ) => {
            const data: WarningMessage = typeof msg === 'string' ? { msg } : msg
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength
              }
            }
            ;(tip ? tips : errors).push(data)
          }
        }
        // 合并自定义模块
        if (options.modules) {
          finalOptions.modules = (baseOptions.modules || []).concat(
            options.modules
          )
        }
        // 合并自定义指令
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // 复制其他选项
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key as keyof CompilerOptions]
          }
        }
      }

      finalOptions.warn = warn

      const compiled = baseCompile(template.trim(), finalOptions)
      if (__DEV__) {
        detectErrors(compiled.ast, warn)
      }
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }

    return {
      compile,
      /**
       * 将模板编译为渲染函数。
       * @param compile 编译函数。
       * @returns 渲染函数的创建方法。
       */
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
