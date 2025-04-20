import { noop, extend } from 'shared/util'
import { warn as baseWarn, tip } from 'core/util/debug'
import { generateCodeFrame } from './codeframe'
import type { Component } from 'types/component'
import { CompilerOptions } from 'types/compiler'

/**
 * 编译函数的结果类型，包含渲染函数和静态渲染函数数组。
 *
 * @property render 渲染函数，用于生成虚拟 DOM。
 * @property staticRenderFns 静态渲染函数数组，用于优化静态内容的渲染。
 */
type CompiledFunctionResult = {
  render: Function
  staticRenderFns: Array<Function>
}

/**
 * 创建一个新的函数实例。
 * @param code - 包含函数体的代码字符串。
 * @param errors - 用于存储错误信息的数组。
 * @returns 如果代码有效，返回一个新的函数实例；否则返回一个空操作函数 (noop)。
 */
function createFunction(code, errors) {
  try {
    return new Function(code)
  } catch (err: any) {
    errors.push({ err, code })
    return noop
  }
}

/**
 * 负责创建将模板字符串转换为可执行渲染函数的编译器。这个函数是模板编译过程的最后一步，也是连接编译器和运行时的关键桥梁。
 * @param compile
 * @returns
 */
export function createCompileToFunctionFn(compile: Function): Function {
  /**
   * 编译结果的缓存对象，用于存储模板编译后的结果。
   */
  const cache = Object.create(null)

  return function compileToFunctions(
    /**
     * 模板字符串，包含需要编译的 HTML 模板。
     */
    template: string,
    /**
     * 编译选项，用于自定义编译行为。
     */
    options?: CompilerOptions,
    /**
     * Vue 组件实例，用于在开发环境中提供警告上下文。
     */
    vm?: Component
  ): CompiledFunctionResult {
    options = extend({}, options)
    const warn = options.warn || baseWarn
    delete options.warn

    /* istanbul ignore if */
    if (__DEV__) {
      // 检测可能的 CSP 限制
      try {
        new Function('return 1')
      } catch (e: any) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
              'environment with Content Security Policy that prohibits unsafe-eval. ' +
              'The template compiler cannot work in this environment. Consider ' +
              'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
              'templates into render functions.'
          )
        }
      }
    }

    // 检查缓存
    /**
     * 缓存的键值，根据模板和分隔符生成。
     */
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    if (cache[key]) {
      return cache[key]
    }

    // 编译模板
    /**
     * 编译后的结果对象，包含渲染函数和静态渲染函数。
     */
    const compiled = compile(template, options)

    // 检查编译错误和提示
    if (__DEV__) {
      if (compiled.errors && compiled.errors.length) {
        if (options.outputSourceRange) {
          compiled.errors.forEach(e => {
            warn(
              `Error compiling template:\n\n${e.msg}\n\n` +
                generateCodeFrame(template, e.start, e.end),
              vm
            )
          })
        } else {
          warn(
            `Error compiling template:\n\n${template}\n\n` +
              compiled.errors.map(e => `- ${e}`).join('\n') +
              '\n',
            vm
          )
        }
      }
      if (compiled.tips && compiled.tips.length) {
        if (options.outputSourceRange) {
          compiled.tips.forEach(e => tip(e.msg, vm))
        } else {
          compiled.tips.forEach(msg => tip(msg, vm))
        }
      }
    }

    // 将代码转换为函数
    /**
     * 编译结果对象，包含渲染函数和静态渲染函数。
     */
    const res: any = {}
    /**
     * 函数生成过程中的错误列表。
     */
    const fnGenErrors: any[] = []
    res.render = createFunction(compiled.render, fnGenErrors)
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    // 检查函数生成错误
    /* istanbul ignore if */
    if (__DEV__) {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
            fnGenErrors
              .map(
                ({ err, code }) => `${(err as any).toString()} in\n\n${code}\n`
              )
              .join('\n'),
          vm
        )
      }
    }

    return (cache[key] = res)
  }
}
