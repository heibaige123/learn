// If the type T accepts type "any", output type Y, otherwise output type N.
// https://stackoverflow.com/questions/49927523/disallow-call-with-any/49928360#49928360
/**
 * 判断类型 T 是否为 any 类型。
 * 如果 T 是 any 类型，则返回类型 Y；否则返回类型 N。
 *
 * @template T - 要检查的类型。
 * @template Y - 如果 T 是 any 类型，则返回的类型。
 * @template N - 如果 T 不是 any 类型，则返回的类型。
 */
export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N
