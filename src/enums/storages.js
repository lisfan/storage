import LOCALFORAGE_DRIVERS from './localforage-drivers'

/**
 * localforage 驱动器与内置离线存储器的映射关系
 */
export default {
  [LOCALFORAGE_DRIVERS.SESSIONSTORAGE]: 'sessionStorage',
  [LOCALFORAGE_DRIVERS.LOCALSTORAGE]: 'localStorage',
  [LOCALFORAGE_DRIVERS.INDEXEDDB]: 'indexedDB',
  [LOCALFORAGE_DRIVERS.WEBSQL]: 'webSQL'
}