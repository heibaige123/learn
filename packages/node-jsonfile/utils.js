/**
 * 将 JavaScript 对象转换为带有可自定义格式选项的 JSON 字符串。
 *
 * @param {Object} obj - 要转换为字符串的对象。
 * @param {Object} [options] - 字符串化的可选配置。
 * @param {string} [options.EOL='\n'] - 输出中使用的行尾字符。
 * @param {boolean} [options.finalEOL=true] - 是否在字符串末尾附加一个行尾字符。
 * @param {Function|null} [options.replacer=null] - 一个函数，用于改变字符串化过程的行为，或者一个字符串和数字的数组，用作白名单以选择/过滤对象中要包含在 JSON 字符串中的属性。
 * @param {number|string} [options.spaces] - 用于缩进的空格数量，或用于缩进的字符串（例如 '\t'）。
 * @returns {string} 根据提供的选项格式化的对象的 JSON 字符串表示。
 */
function stringify (obj, { EOL = '\n', finalEOL = true, replacer = null, spaces } = {}) {
  const EOF = finalEOL ? EOL : ''
  const str = JSON.stringify(obj, replacer, spaces)

  return str.replace(/\n/g, EOL) + EOF
}

/**
 * 从字符串或缓冲区的开头移除字节顺序标记（BOM）。
 * 这是必要的，因为如果未指定编码，JSON.parse 会将其转换为 UTF-8 字符串。
 *
 * @param {string|Buffer} content - 要处理的内容，可以是字符串或缓冲区。
 * @returns {string} 移除 BOM 后的内容。
 */
function stripBom (content) {
  // we do this because JSON.parse would convert it to a utf8 string if encoding wasn't specified
  if (Buffer.isBuffer(content)) content = content.toString('utf8')
  return content.replace(/^\uFEFF/, '')
}

module.exports = { stringify, stripBom }
