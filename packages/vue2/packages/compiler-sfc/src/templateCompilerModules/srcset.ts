// vue compiler module for transforming `img:srcset` to a number of `require`s

import { urlToRequire } from './utils'
import { TransformAssetUrlsOptions } from './assetUrl'
import { ASTNode } from 'types/compiler'

/**
 * 表示 HTML 中 srcset 属性的每个候选项（image candidate）。
 * 它在 Vue 模板编译器中被用来处理 <img> 或 <source> 标签的 srcset 属性，
 * 将其解析为多个 require 调用
 * @example
```ts
  {
      type: 1,
      tag: 'img',
      attrs: [
        {
          name: 'srcset',
          value: `require('./image1.jpg') + " 1x, " + require('./image2.jpg') + " 2x"`
        }
      ]
  }
```
 */
interface ImageCandidate {
  /**
   * 表示资源路径的 require 调用
   */
  require: string
  /**
   * 表示资源的描述符（如 "1x", "2x", "100w" 等）
   */
  descriptor: string
}

/**
 * Vue模板资源URL转换插件
 * @param {TransformAssetUrlsOptions} transformAssetUrlsOptions - 资源URL转换选项
 * @returns {Object} 包含postTransformNode方法的转换器对象
 */
export default (transformAssetUrlsOptions?: TransformAssetUrlsOptions) => ({
  postTransformNode: (node: ASTNode) => {
    transform(node, transformAssetUrlsOptions)
  }
})

// http://w3c.github.io/html/semantics-embedded-content.html#ref-for-image-candidate-string-5
// 1.  **一个普通的空格字符** (` `)
// 2.  **字面上的反斜杠加小写t** (`\t`) - **注意：** 这不是匹配一个制表符(Tab)，而是匹配字符串中实际存在的 `\` 和 `t` 这两个字符。
// 3.  **字面上的反斜杠加小写n** (`\n`) - **注意：** 这不是匹配一个换行符，而是匹配字符串中实际存在的 `\` 和 `n` 这两个字符。
// 4.  **字面上的反斜杠加小写f** (`\f`) - **注意：** 这不是匹配一个换页符，而是匹配字符串中实际存在的 `\` 和 `f` 这两个字符。
// 5.  **字面上的反斜杠加小写r** (`\r`) - **注意：** 这不是匹配一个回车符，而是匹配字符串中实际存在的 `\` 和 `r` 这两个字符。
/** 查找并匹配字符串中**一个或多个连续**出现的**特定字符序列** */
const escapedSpaceCharacters = /( |\\t|\\n|\\f|\\r)+/g

/**
 * transform函数 - 处理AST节点中的资源URL，特别是srcset
 * @param {ASTNode} node - 当前正在处理的抽象语法树(AST)节点
 * @param {TransformAssetUrlsOptions} [transformAssetUrlsOptions] - 可选的资源URL转换配置选项
 */
function transform(
  node: ASTNode,
  transformAssetUrlsOptions?: TransformAssetUrlsOptions
) {
  // 1. 初始检查：确保是元素节点且有属性
  if (node.type !== 1 || !node.attrs) {
    // 如果不是元素节点 (type 1) 或者没有属性，则无需处理，直接返回
    return
  }

  // 目标标签检查：只处理<img>和<source>标签
  if (node.tag === 'img' || node.tag === 'source') {
    node.attrs.forEach(attr => {
      if (attr.name === 'srcset') {
        // same logic as in transform-require.js
        const value = attr.value
        // 静态值检查：确保值是静态字符串（以"开头和结尾）
        // 动态绑定 :srcset="..." 不在此处处理
        const isStatic =
          value.charAt(0) === '"' && value.charAt(value.length - 1) === '"'
        if (!isStatic) {
          return
        }

        // 解析srcset值：
        //    - 移除首尾引号
        //    - 按逗号分割成多个图像候选者 (image candidates)
        //    - 对每个候选者字符串进行处理
        const imageCandidates: ImageCandidate[] = value
          .slice(1, -1) // 移除首尾的 "
          .split(',') // 按 , 分割成数组，例如 ["./img.png 1x", " ./img2x.png 2x"]
          .map(s => {
            // 对每个候选者字符串 s 进行处理
            // 5.1 清理和分割候选者字符串：
            //     - 将转义的空白字符 (\t, \n 等字面量) 替换为普通空格
            //     - 移除首尾多余空格
            //     - 按第一个空格分割成 URL 和描述符 (descriptor) 两部分
            const [url, descriptor] = s
              .replace(escapedSpaceCharacters, ' ') // " ./img.png\t1x" -> " ./img.png 1x"
              .trim() // " ./img.png 1x" -> "./img.png 1x"
              .split(' ', 2) // "./img.png 1x" -> ["./img.png", "1x"]
            // "./img.png" -> ["./img.png"] (descriptor为undefined)

            // 转换URL并构造结果对象：
            //     - 调用 urlToRequire 将原始URL转换为模块请求格式 (例如 "require('./img.png')")
            //     - 保留原始的描述符
            return {
              require: urlToRequire(url, transformAssetUrlsOptions), // 核心转换步骤
              descriptor // 例如 "1x", "2x", "100w" 或 undefined
            }
          })

        // "require(url1)"
        // "require(url1) 1x"
        // "require(url1), require(url2)"
        // "require(url1), require(url2) 2x"
        // "require(url1) 1x, require(url2)"
        // "require(url1) 1x, require(url2) 2x"
        // 重构srcset属性值：
        //    目标是生成一个JavaScript字符串拼接表达式，例如：
        //    require('./img.png') + " 1x, " + require('./img2x.png') + " 2x"
        const code = imageCandidates
          .map(
            ({ require, descriptor }) =>
              // 对每个候选者，生成 "require(url)" + " [descriptor], " + 格式的字符串
              `${require} + "${descriptor ? ' ' + descriptor : ''}, " + `
            // 例如: "require('./img.png')" + " 1x, " +
            //       "require('./img2x.png')" + " 2x, " +
          )
          .join('') // 将所有片段连接起来
          .slice(0, -6) // 移除最后一个多余的 ", " + " (6个字符)
          .concat('"') // 在末尾添加一个引号，完成整个JS字符串表达式
          .replace(/ \+ ""$/, '') // 清理可能因最后一个描述符为空而产生的 " + """

        // 7. 更新AST节点的属性值：
        //    将原始的静态srcset字符串替换为新生成的JS代码字符串
        attr.value = code
      }
    })
  }
}
