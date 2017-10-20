/**
 * storage命名空间
 * @enum
 */

import localforage from 'localforage'
import sessionStorageWrapper from '../utils/localforage-sessionstoragewrapper'

export default {
  SESSIONSTORAGE: sessionStorageWrapper._driver,
  LOCALSTORAGE: localforage.LOCALSTORAGE,
  INDEXEDDB: localforage.INDEXEDDB,
  WEBSQL: localforage.WEBSQL,
}