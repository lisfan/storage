/**
 * storage与localforage的命名空间的反射关系
 * @enum
 */
/**
 * storage与localforage的命名空间的映射关系
 * @enum
 */
import STORAGE_DRIVERS from './storage-drivers'
import LOCALFORAGE_DRIVERS from './localforage-drivers'

export default {
  [STORAGE_DRIVERS.SESSIONSTORAGE]: LOCALFORAGE_DRIVERS._driver,
  [STORAGE_DRIVERS.LOCALSTORAGE]: LOCALFORAGE_DRIVERS.LOCALSTORAGE,
  [STORAGE_DRIVERS.INDEXEDDB]: LOCALFORAGE_DRIVERS.INDEXEDDB,
  [STORAGE_DRIVERS.WEBSQL]: LOCALFORAGE_DRIVERS.WEBSQL,
}