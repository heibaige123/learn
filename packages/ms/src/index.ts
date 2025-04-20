// Helpers.
/**
 * 基础单位：秒
 * 1秒 = 1000毫秒
 */
const s = 1000;
/**
 * 基础单位：分钟
 * 1分钟 = 60秒
 */
const m = s * 60;
/**
 * 基础单位：小时
 * 1小时 = 60分钟
 */
const h = m * 60;
/**
 * 基础单位：天
 * 1天 = 24小时
 */
const d = h * 24;
/**
 * 基础单位：周
 * 1周 = 7天
 */
const w = d * 7;
/**
 * 基础单位：年
 * 1年 = 365.25天（考虑闰年）
 */
const y = d * 365.25;

/**
 * 表示可用于时间计算的时间单位字符串。
 * 
 * @remarks
 * 包含单复数形式以及常用缩写。
 * 
 * 年:
 * - 'Years'(年复数), 'Year'(年单数), 'Yrs'(年复数缩写), 'Yr'(年单数缩写), 'Y'(年简写)
 * 
 * 周:
 * - 'Weeks'(周复数), 'Week'(周单数), 'W'(周简写)
 * 
 * 天:
 * - 'Days'(天复数), 'Day'(天单数), 'D'(天简写)
 * 
 * 小时:
 * - 'Hours'(小时复数), 'Hour'(小时单数), 'Hrs'(小时复数缩写), 'Hr'(小时单数缩写), 'H'(小时简写)
 * 
 * 分钟:
 * - 'Minutes'(分钟复数), 'Minute'(分钟单数), 'Mins'(分钟复数缩写), 'Min'(分钟单数缩写), 'M'(分钟简写)
 * 
 * 秒:
 * - 'Seconds'(秒复数), 'Second'(秒单数), 'Secs'(秒复数缩写), 'Sec'(秒单数缩写), 's'(秒简写)
 * 
 * 毫秒:
 * - 'Milliseconds'(毫秒复数), 'Millisecond'(毫秒单数), 'Msecs'(毫秒复数缩写), 'Msec'(毫秒单数缩写), 'Ms'(毫秒简写)
 * 
 * @type {string} Unit - 表示各种时间单位的字符串字面量类型
 */
type Unit =
  | 'Years'
  | 'Year'
  | 'Yrs'
  | 'Yr'
  | 'Y'
  | 'Weeks'
  | 'Week'
  | 'W'
  | 'Days'
  | 'Day'
  | 'D'
  | 'Hours'
  | 'Hour'
  | 'Hrs'
  | 'Hr'
  | 'H'
  | 'Minutes'
  | 'Minute'
  | 'Mins'
  | 'Min'
  | 'M'
  | 'Seconds'
  | 'Second'
  | 'Secs'
  | 'Sec'
  | 's'
  | 'Milliseconds'
  | 'Millisecond'
  | 'Msecs'
  | 'Msec'
  | 'Ms';

/**
 * 表示任意大小写形式的时间单位类型。
 * 
 * @remarks
 * 包含以下形式：
 * - 原始形式 (如 'Year', 'Month' 等)
 * - 全大写形式 (如 'YEAR', 'MONTH' 等)
 * - 全小写形式 (如 'year', 'month' 等)
 */
type UnitAnyCase = Unit | Uppercase<Unit> | Lowercase<Unit>;

/**
 * 表示合法的时间字符串值类型。
 * 
 * @remarks
 * 可以是以下三种形式之一：
 * - 纯数字字符串 (如 '100')
 * - 数字加单位 (如 '100ms', '5d')
 * - 数字加空格加单位 (如 '100 ms', '5 days')
 * 
 * 其中单位可以是任意大小写形式。
 */
export type StringValue =
  | `${number}`
  | `${number}${UnitAnyCase}`
  | `${number} ${UnitAnyCase}`;

interface Options {
  /**
   * 设置为 `true` 使用详细格式化。默认为 `false`。
   */
  long?: boolean;
}

/**
 * 解析或格式化给定的值。
 *
 * @param value - 要转换的字符串或数字
 * @param options - 转换的选项
 * @throws 如果 `value` 不是非空字符串或数字则抛出错误
 */
function msFn(value: StringValue, options?: Options): number;
function msFn(value: number, options?: Options): string;
function msFn(value: StringValue | number, options?: Options): number | string {
  try {
    if (typeof value === 'string') {
      return parse(value);
    } else if (typeof value === 'number') {
      return format(value, options);
    }
    throw new Error('提供给 ms() 的值必须是字符串或数字。');
  } catch (error) {
    const message = isError(error)
      ? `${error.message}. value=${JSON.stringify(value)}`
      : '发生了未知错误。';
    throw new Error(message);
  }
}

/**
 * 解析给定的字符串并返回毫秒数。
 *
 * @param str - 要解析为毫秒的字符串
 * @returns 解析后的毫秒值，如果字符串无法解析则返回 `NaN`
 */
export function parse(str: string): number {
  // 输入必须是字符串类型
  // 字符串长度必须大于 0（非空）
  // 字符串长度不能超过 100 个字符（防止潜在的性能问题）
  if (typeof str !== 'string' || str.length === 0 || str.length > 100) {
    throw new Error(
      '提供给 ms.parse() 的值必须是长度在 1 到 99 之间的字符串。',
    );
  }

  // value：捕获数值部分，支持整数、小数和负数
  // type：捕获可选的时间单位部分
  const match =
    /^(?<value>-?(?:\d+)?\.?\d+) *(?<type>milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
      str,
    );
  // Named capture groups need to be manually typed today.
  // https://github.com/microsoft/TypeScript/issues/32098
  const groups = match?.groups as { value: string; type?: string } | undefined;
  if (!groups) {
    return NaN;
  }
  const n = parseFloat(groups.value);
  const type = (groups.type || 'ms').toLowerCase() as Lowercase<Unit>;
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'weeks':
    case 'week':
    case 'w':
      return n * w;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      // This should never occur.
      throw new Error(
        `The unit ${type as string} was matched, but no matching case exists.`,
      );
  }
}

/**
 * 解析给定的 StringValue 并返回毫秒数。
 *
 * @param value - 要解析为毫秒的值 StringValue
 * @returns 解析后的毫秒值，如果字符串无法解析则返回 `NaN`
 */
export function parseStrict(value: StringValue): number {
  return parse(value);
}

// eslint-disable-next-line import/no-default-export
export default msFn;

/**
 * `ms` 的短格式。
 */
function fmtShort(ms: number): StringValue {
  const msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return `${Math.round(ms / d)}d`;
  }
  if (msAbs >= h) {
    return `${Math.round(ms / h)}h`;
  }
  if (msAbs >= m) {
    return `${Math.round(ms / m)}m`;
  }
  if (msAbs >= s) {
    return `${Math.round(ms / s)}s`;
  }
  return `${ms}ms`;
}

/**
 * `ms` 的长格式。
 */
function fmtLong(ms: number): StringValue {
  const msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return plural(ms, msAbs, d, 'day');
  }
  if (msAbs >= h) {
    return plural(ms, msAbs, h, 'hour');
  }
  if (msAbs >= m) {
    return plural(ms, msAbs, m, 'minute');
  }
  if (msAbs >= s) {
    return plural(ms, msAbs, s, 'second');
  }
  return `${ms} ms`;
}

/**
 * 将给定的整数格式化为字符串。
 *
 * @param ms - 毫秒数
 * @param options - 转换选项
 * @returns 格式化后的字符串
 */
export function format(ms: number, options?: Options): string {
  if (typeof ms !== 'number' || !isFinite(ms)) {
    throw new Error('提供给 ms.format() 的值必须是数字类型。');
  }
  return options?.long ? fmtLong(ms) : fmtShort(ms);
}

/**
 * 复数形式辅助函数。
 * 
 * @param ms - 毫秒数
 * @param msAbs - 毫秒数的绝对值
 * @param n - 转换基数（如天数、小时数等的毫秒表示）
 * @param name - 时间单位名称
 * @returns 格式化后的时间字符串
 */
function plural(
  ms: number,
  msAbs: number,
  n: number,
  name: string,
): StringValue {
  const isPlural = msAbs >= n * 1.5;
  return `${Math.round(ms / n)} ${name}${isPlural ? 's' : ''}` as StringValue;
}

/**
 * 错误类型的类型守卫函数。
 *
 * @param value - 要测试的值
 * @returns 如果提供的值是一个类似 Error 的对象，则返回 `true`
 */
function isError(value: unknown): value is Error {
  return typeof value === 'object' && value !== null && 'message' in value;
}
