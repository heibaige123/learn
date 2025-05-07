import config from 'core/config'
import { addHandler, addProp, getBindingAttr } from 'compiler/helpers'
import { genComponentModel, genAssignmentCode } from 'compiler/directives/model'
import { ASTDirective, ASTElement, ASTModifiers } from 'types/compiler'

let warn

// in some cases, the event used has to be determined at runtime
// so we used some reserved tokens during compile.
/**
 * 用于range类型输入框的特殊标记
 */
export const RANGE_TOKEN = '__r'
/**
 * 用于checkbox和radio类型输入框的特殊标记
 */
export const CHECKBOX_RADIO_TOKEN = '__c'

/**
 * 处理v-model指令的主要函数
 * @param {ASTElement} el - 抽象语法树元素节点
 * @param {ASTDirective} dir - 指令对象，包含v-model的相关信息
 * @param {Function} _warn - 警告函数，用于在开发环境中发出警告
 * @returns {boolean | undefined} - 返回true表示需要在运行时处理该指令，false表示不需要
 */
export default function model(
  el: ASTElement,
  dir: ASTDirective,
  _warn: Function
): boolean | undefined {
  warn = _warn
  const value = dir.value
  const modifiers = dir.modifiers
  const tag = el.tag
  const type = el.attrsMap.type

  if (__DEV__) {
    // inputs with type="file" are read only and setting the input's
    // value will throw an error.
    if (tag === 'input' && type === 'file') {
      warn(
        `<${el.tag} v-model="${value}" type="file">:\n` +
          `File inputs are read only. Use a v-on:change listener instead.`,
        el.rawAttrsMap['v-model']
      )
    }
  }

  if (el.component) {
    genComponentModel(el, value, modifiers)
    // component v-model doesn't need extra runtime
    return false
  } else if (tag === 'select') {
    genSelect(el, value, modifiers)
  } else if (tag === 'input' && type === 'checkbox') {
    genCheckboxModel(el, value, modifiers)
  } else if (tag === 'input' && type === 'radio') {
    genRadioModel(el, value, modifiers)
  } else if (tag === 'input' || tag === 'textarea') {
    genDefaultModel(el, value, modifiers)
  } else if (!config.isReservedTag(tag)) {
    genComponentModel(el, value, modifiers)
    // component v-model doesn't need extra runtime
    return false
  } else if (__DEV__) {
    warn(
      `<${el.tag} v-model="${value}">: ` +
        `v-model is not supported on this element type. ` +
        "If you are working with contenteditable, it's recommended to " +
        'wrap a library dedicated for that purpose inside a custom component.',
      el.rawAttrsMap['v-model']
    )
  }

  // ensure runtime directive metadata
  return true
}

/**
 * 为复选框元素生成v-model相关代码
 * @param {ASTElement} el - 抽象语法树元素节点
 * @param {string} value - v-model绑定的表达式值
 * @param {ASTModifiers | null} modifiers - 修饰符对象，如.number等
 */
function genCheckboxModel(
  el: ASTElement,
  value: string,
  modifiers?: ASTModifiers | null
) {
  const number = modifiers && modifiers.number
  const valueBinding = getBindingAttr(el, 'value') || 'null'
  const trueValueBinding = getBindingAttr(el, 'true-value') || 'true'
  const falseValueBinding = getBindingAttr(el, 'false-value') || 'false'
  addProp(
    el,
    'checked',
    `Array.isArray(${value})` +
      `?_i(${value},${valueBinding})>-1` +
      (trueValueBinding === 'true'
        ? `:(${value})`
        : `:_q(${value},${trueValueBinding})`)
  )
  addHandler(
    el,
    'change',
    `var $$a=${value},` +
      '$$el=$event.target,' +
      `$$c=$$el.checked?(${trueValueBinding}):(${falseValueBinding});` +
      'if(Array.isArray($$a)){' +
      `var $$v=${number ? '_n(' + valueBinding + ')' : valueBinding},` +
      '$$i=_i($$a,$$v);' +
      `if($$el.checked){$$i<0&&(${genAssignmentCode(
        value,
        '$$a.concat([$$v])'
      )})}` +
      `else{$$i>-1&&(${genAssignmentCode(
        value,
        '$$a.slice(0,$$i).concat($$a.slice($$i+1))'
      )})}` +
      `}else{${genAssignmentCode(value, '$$c')}}`,
    null,
    true
  )
}

/**
 * 为单选按钮元素生成v-model相关代码
 * @param {ASTElement} el - 抽象语法树元素节点
 * @param {string} value - v-model绑定的表达式值
 * @param {ASTModifiers | null} modifiers - 修饰符对象，如.number等
 */
function genRadioModel(
  el: ASTElement,
  value: string,
  modifiers?: ASTModifiers | null
) {
  const number = modifiers && modifiers.number
  let valueBinding = getBindingAttr(el, 'value') || 'null'
  valueBinding = number ? `_n(${valueBinding})` : valueBinding
  addProp(el, 'checked', `_q(${value},${valueBinding})`)
  addHandler(el, 'change', genAssignmentCode(value, valueBinding), null, true)
}

/**
 * 为select元素生成v-model相关代码
 * @param {ASTElement} el - 抽象语法树元素节点
 * @param {string} value - v-model绑定的表达式值
 * @param {ASTModifiers | null} modifiers - 修饰符对象，如.number等
 */
function genSelect(
  el: ASTElement,
  value: string,
  modifiers?: ASTModifiers | null
) {
  const number = modifiers && modifiers.number
  const selectedVal = `
      Array.prototype.filter
        .call($event.target.options, function(o) {
          return o.selected
        })
        .map(function(o) {
          var val = "_value" in o
            ? o._value
            : o.value;
          return ${number ? '_n(val)' : 'val'}
        })`

  let code = `var $$selectedVal = ${selectedVal};`
  const assignment = '$event.target.multiple ? $$selectedVal : $$selectedVal[0]'
  code = `${code} ${genAssignmentCode(value, assignment)}`
  addHandler(el, 'change', code, null, true)
}

/**
 * 为默认输入元素(input和textarea)生成v-model相关代码
 * @param {ASTElement} el - 抽象语法树元素节点
 * @param {string} value - v-model绑定的表达式值
 * @param {ASTModifiers | null} modifiers - 修饰符对象，如.lazy、.number、.trim等
 * @returns {boolean | void} - 函数执行结果
 */
function genDefaultModel(
  el: ASTElement,
  value: string,
  modifiers?: ASTModifiers | null
): boolean | void {
  // 获取输入元素的type属性值（如text、number、password等）
  const type = el.attrsMap.type

  // warn if v-bind:value conflicts with v-model
  // except for inputs with v-bind:type
  if (__DEV__) {
    // 检查是否同时使用了`:value`(或`v-bind:value`)和`v-model`
    // `v-model`内部已经包含了对value的绑定，再额外添加`:value`会造成冲突
    const value = el.attrsMap['v-bind:value'] || el.attrsMap[':value']
    const typeBinding = el.attrsMap['v-bind:type'] || el.attrsMap[':type']
    if (value && !typeBinding) {
      const binding = el.attrsMap['v-bind:value'] ? 'v-bind:value' : ':value'
      warn(
        `${binding}="${value}" conflicts with v-model on the same element ` +
          'because the latter already expands to a value binding internally',
        el.rawAttrsMap[binding]
      )
    }
  }

  // - **lazy**: 懒更新，使用change事件而非input事件
  // - **number**: 将输入值转换为数字类型
  // - **trim**: 自动去除输入值的首尾空格
  const { lazy, number, trim } = modifiers || {}
  // 决定是否需要添加中文输入法(IME)组合输入保护
  const needCompositionGuard = !lazy && type !== 'range'
  // - **作用**：确定使用哪种事件来更新数据
  // - **三种情况**：
  //   - 使用了`.lazy`修饰符：使用`change`事件（失焦或按回车时触发）
  //   - 输入类型是`range`：使用特殊标记`RANGE_TOKEN`（即`__r`）
  //   - 其他情况：使用`input`事件（即时更新）
  const event = lazy ? 'change' : type === 'range' ? RANGE_TOKEN : 'input'

  let valueExpression = '$event.target.value'
  if (trim) {
    valueExpression = `$event.target.value.trim()`
  }
  if (number) {
    valueExpression = `_n(${valueExpression})`
  }

  let code = genAssignmentCode(value, valueExpression)
  if (needCompositionGuard) {
    code = `if($event.target.composing)return;${code}`
  }

  addProp(el, 'value', `(${value})`)
  addHandler(el, event, code, null, true)
  if (trim || number) {
    // 强制更新视图，确保在失焦时应用修饰符效果
    addHandler(el, 'blur', '$forceUpdate()')
  }
}
