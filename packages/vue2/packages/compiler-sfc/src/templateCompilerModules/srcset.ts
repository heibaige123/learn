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

export default (transformAssetUrlsOptions?: TransformAssetUrlsOptions) => ({
  postTransformNode: (node: ASTNode) => {
    transform(node, transformAssetUrlsOptions)
  }
})

// http://w3c.github.io/html/semantics-embedded-content.html#ref-for-image-candidate-string-5
const escapedSpaceCharacters = /( |\\t|\\n|\\f|\\r)+/g

function transform(
  node: ASTNode,
  transformAssetUrlsOptions?: TransformAssetUrlsOptions
) {
  if (node.type !== 1 || !node.attrs) {
    return
  }

  if (node.tag === 'img' || node.tag === 'source') {
    node.attrs.forEach(attr => {
      if (attr.name === 'srcset') {
        // same logic as in transform-require.js
        const value = attr.value
        const isStatic =
          value.charAt(0) === '"' && value.charAt(value.length - 1) === '"'
        if (!isStatic) {
          return
        }

        const imageCandidates: ImageCandidate[] = value
          .slice(1, -1)
          .split(',')
          .map(s => {
            // The attribute value arrives here with all whitespace, except
            // normal spaces, represented by escape sequences
            const [url, descriptor] = s
              .replace(escapedSpaceCharacters, ' ')
              .trim()
              .split(' ', 2)
            return {
              require: urlToRequire(url, transformAssetUrlsOptions),
              descriptor
            }
          })

        // "require(url1)"
        // "require(url1) 1x"
        // "require(url1), require(url2)"
        // "require(url1), require(url2) 2x"
        // "require(url1) 1x, require(url2)"
        // "require(url1) 1x, require(url2) 2x"
        const code = imageCandidates
          .map(
            ({ require, descriptor }) =>
              `${require} + "${descriptor ? ' ' + descriptor : ''}, " + `
          )
          .join('')
          .slice(0, -6)
          .concat('"')
          .replace(/ \+ ""$/, '')

        attr.value = code
      }
    })
  }
}
