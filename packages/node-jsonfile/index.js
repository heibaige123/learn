let _fs
try {
  _fs = require('graceful-fs')
} catch (_) {
  _fs = require('fs')
}
const universalify = require('universalify')
const { stringify, stripBom } = require('./utils')

/**
 * 异步读取 JSON 文件并将其内容解析为 JavaScript 对象。
 *
 * @param {string} file - 要读取的 JSON 文件的路径。
 * @param {Object|string} [options={}] - 读取文件的选项。如果提供的是字符串，则视为编码。
 * @param {string} [options.encoding] - 读取文件时使用的编码。默认为 'utf8'。
 * @param {Object} [options.fs] - 要使用的自定义 `fs` 实现。默认为内置的 `fs` 模块。
 * @param {boolean} [options.throws=true] - 如果文件内容无法解析为 JSON，是否抛出错误。
 * @param {Function} [options.reviver] - 在返回解析的 JSON 对象之前，用于转换该对象的函数。
 * @returns {Promise<Object|null>} 一个 Promise，解析为解析后的 JSON 对象，或者在解析失败且 `options.throws` 为 `false` 时解析为 `null`。
 * @throws {Error} 如果文件无法读取，或者其内容无法解析为 JSON 且 `options.throws` 为 `true`。
 */
async function _readFile (file, options = {}) {
  if (typeof options === 'string') {
    options = { encoding: options }
  }

  const fs = options.fs || _fs

  const shouldThrow = 'throws' in options ? options.throws : true

  let data = await universalify.fromCallback(fs.readFile)(file, options)

  data = stripBom(data)

  let obj
  try {
    obj = JSON.parse(data, options ? options.reviver : null)
  } catch (err) {
    if (shouldThrow) {
      err.message = `${file}: ${err.message}`
      throw err
    } else {
      return null
    }
  }

  return obj
}

const readFile = universalify.fromPromise(_readFile)
/**
 * 同步读取 JSON 文件并将其内容解析为 JavaScript 对象。
 *
 * @param {string} file - 要读取的 JSON 文件的路径。
 * @param {Object|string} [options={}] - 读取文件的选项。如果提供的是字符串，则视为编码。
 * @param {string} [options.encoding] - 读取文件时使用的编码。默认为 'utf8'。
 * @param {Object} [options.fs] - 要使用的自定义 `fs` 实现。默认为内置的 `fs` 模块。
 * @param {boolean} [options.throws=true] - 如果文件内容无法解析为 JSON，是否抛出错误。
 * @param {Function} [options.reviver] - 在返回解析的 JSON 对象之前，用于转换该对象的函数。
 * @returns {Object|null} 解析后的 JSON 对象，或者在解析失败且 `options.throws` 为 `false` 时返回 `null`。
 * @throws {Error} 如果文件无法读取，或者其内容无法解析为 JSON 且 `options.throws` 为 `true`。
 */
function readFileSync (file, options = {}) {
  if (typeof options === 'string') {
    options = { encoding: options }
  }

  const fs = options.fs || _fs

  const shouldThrow = 'throws' in options ? options.throws : true

  try {
    let content = fs.readFileSync(file, options)
    content = stripBom(content)
    return JSON.parse(content, options.reviver)
  } catch (err) {
    if (shouldThrow) {
      err.message = `${file}: ${err.message}`
      throw err
    } else {
      return null
    }
  }
}

/**
 * 异步写入 JSON 对象到文件。
 *
 * @param {string} file - 要写入的文件路径。
 * @param {Object} obj - 要写入的 JSON 对象。
 * @param {Object} [options={}] - 写入文件的选项。
 * @param {Object} [options.fs] - 要使用的自定义 `fs` 实现。默认为内置的 `fs` 模块。
 * @returns {Promise<void>} 一个 Promise，表示写入操作的完成。
 * @throws {Error} 如果写入文件失败。
 */
async function _writeFile (file, obj, options = {}) {
  const fs = options.fs || _fs

  const str = stringify(obj, options)

  await universalify.fromCallback(fs.writeFile)(file, str, options)
}

const writeFile = universalify.fromPromise(_writeFile)

/**
 * 同步写入 JSON 对象到文件。
 *
 * @param {string} file - 要写入的文件路径。
 * @param {Object} obj - 要写入的 JSON 对象。
 * @param {Object} [options={}] - 写入文件的选项。
 * @param {Object} [options.fs] - 要使用的自定义 `fs` 实现。默认为内置的 `fs` 模块。
 * @returns {void}
 * @throws {Error} 如果写入文件失败。
 */
function writeFileSync (file, obj, options = {}) {
  const fs = options.fs || _fs

  const str = stringify(obj, options)
  // not sure if fs.writeFileSync returns anything, but just in case
  return fs.writeFileSync(file, str, options)
}

/**
 * JSON 文件操作工具。
 */
const jsonfile = {
  readFile,
  readFileSync,
  writeFile,
  writeFileSync
}

module.exports = jsonfile
