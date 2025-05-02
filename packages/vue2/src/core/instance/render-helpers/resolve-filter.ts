/*
## Vue 过滤器系统中的应用

在 Vue 2 模板中，过滤器用于文本格式化，可以在两个位置使用：

1. 插值表达式中：
   ```html
   {{ message | capitalize }}
   ```

2. `v-bind` 表达式中：
   ```html
   <div v-bind:id="rawId | formatId"></div>
   ```

当模板被编译时，这些过滤器表达式会转换为对 `resolveFilter` 的调用，例如：

```javascript
// {{ message | capitalize }}
// 被编译为类似如下代码：
_s(_f("capitalize")(message))

// 其中 _f 是 resolveFilter 的别名
```

## 过滤器的特性

- **链式调用**: 过滤器可以串联使用 `{{ message | filterA | filterB }}`
- **接受参数**: 过滤器可以接收额外参数 `{{ message | filter('arg1', arg2) }}`
- **作用域**: 过滤器可以是局部的（组件内定义）或全局的（`Vue.filter` 注册）
*/

import { identity, resolveAsset } from 'core/util/index'

/**
 * Runtime helper for resolving filters
 */
/**
 * 解析过滤器的运行时辅助函数
 * @param id 过滤器的标识符（名称）
 * @returns 找到的过滤器函数，或默认的恒等函数
 */
export function resolveFilter(id: string): Function {
  return resolveAsset(this.$options, 'filters', id, true) || identity
}
