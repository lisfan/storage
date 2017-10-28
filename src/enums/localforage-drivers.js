import localforage from 'localforage'
import sessionStorageWrapper from '../utils/localforage-sessionstoragewrapper'

/**
 * localforage 驱动器常量枚举
 * @enum
 */
export default {
  SESSIONSTORAGE: sessionStorageWrapper._driver,
  LOCALSTORAGE: localforage.LOCALSTORAGE,
  INDEXEDDB: localforage.INDEXEDDB,
  WEBSQL: localforage.WEBSQL,
}