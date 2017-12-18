/**
 * 由于localforage不支持某些数据类型，所以为了保存不支持的数据类型
 * 需要对值进行约定值的存储格式，以便能够记录
 * - undefined
 * - date
 * - regexp
 * - function
 * - Infinity
 * - NaN
 *
 * @enum {string}
 */
export default {
  UNDEFINED: '[storage undefined]#',
  DATE: '[storage date]#',
  REGEXP: '[storage regexp]#',
  FUNCTION: '[storage function]#',
  INFINITY: '[storage infinity]#',
  NAN: '[storage nan]#',
}