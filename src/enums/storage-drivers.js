/**
 * storage 驱动器常量枚举
 *
 * @enum {string}
 */
export default {
  SESSIONSTORAGE: Symbol('SESSIONSTORAGE'),
  LOCALSTORAGE: Symbol('LOCALSTORAGE'),
  INDEXEDDB: Symbol('INDEXEDDB'),
  WEBSQL: Symbol('WEBSQL'),
}