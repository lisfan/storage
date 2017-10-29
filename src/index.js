/**
 * @file 离线存储控制器
 * @author lisfan <goolisfan@gmail.com>
 * @version 1.1.0
 * @licence MIT
 */

import localforage from 'localforage'

import validation from '@~lisfan/validation'
import actions from './utils/actions'

import DataItem from './models/data-item'

import STORAGE_DRIVERS from './enums/storage-drivers'
import LOCALFORAGE_DRIVERS from './enums/localforage-drivers'
import DRIVERS_REFLECTOR from './enums/drivers-reflector'

// localForage默认配置项
const localForageDefaultConfig = localforage._defaultConfig

/* eslint-disable max-len */
// localForage默认驱动器列表，同时优先选择sessionStorage存储
const localForageDefaultDriver = [LOCALFORAGE_DRIVERS.SESSIONSTORAGE].concat(localForageDefaultConfig._driver)

/* eslint-enable max-len */

/**
 * @description
 * - storage只会管理存储通过其 API 创建的离线数据，不管理其他自定义的存储数据（数据项会加上命名空间前缀）
 * - storage实例会单独建立一个映射表来管理数据单元与数据的映射关系
 *
 * @classdesc 离线存储类
 * @class
 */
class Storage {
  /**
   * sessionStorage驱动器
   *
   * @since 1.0.0
   * @memberOf Storage
   */
  static SESSIONSTORAGE = STORAGE_DRIVERS.SESSIONSTORAGE
  /**
   * indexedDB驱动器
   *
   * @since 1.0.0
   * @memberOf Storage
   */
  static INDEXEDDB = STORAGE_DRIVERS.INDEXEDDB
  /**
   * webSQL驱动器
   *
   * @since 1.0.0
   * @memberOf Storage
   */
  static WEBSQL = STORAGE_DRIVERS.WEBSQL
  /**
   * localStorage驱动器
   *
   * @since 1.0.0
   * @memberOf Storage
   */
  static LOCALSTORAGE = STORAGE_DRIVERS.LOCALSTORAGE

  /**
   * 默认配置选项
   *
   * @since 1.0.0
   * @static
   * @memberOf Storage
   * @property {number} maxAge=-1 - 数据可存活时间，默认永久缓存
   * @property {array} driver=[Storage.SESSIONSTORAGE,Storage.INDEXEDDB,Storage.WEBSQL,Storage.LOCALSTORAGE] -
   *   离线存储器的驱动器优先选择列表
   * @property {string} name='storage' - 离线存储器命名空间
   * @property {string} description='' - 离线存储器描述，取localforage的默认值
   * @property {number} size=4980736 - 离线存储器的大小，仅webSQL有效，取localforage的默认值
   * @property {string} storeName=4980736 - 离线存储器的数据库名称，仅indexedDB和WebSQL有效，取localforage的默认值
   */
  static options = {
    maxAge: -1,
    driver: actions.transformDriver(localForageDefaultDriver),
    name: 'storage',
    description: localForageDefaultConfig.description,
    size: localForageDefaultConfig.size,
    storeName: localForageDefaultConfig.storeName,
  }

  /**
   * 更新默认配置选项
   *
   * @since 1.0.0
   * @static
   * @param {object} options - 配置选项
   * @param {number} [options.maxAge] - 数据可存活时间
   * @param {array|string} [options.driver] - 离线存储器的驱动器
   * @param {string} [options.name] - 离线存储器命名空间
   * @param {string} [options.description]- 离线存储器描述
   * @param {number} [options.size]- 离线存储器的大小
   * @param {string} [options.storeName] - 离线存储器的数据库名称
   */
  static config(options) {
    const ctor = this

    // 不调用localforage.config，希望这里的config只是针对Storage类的配置更新
    ctor.options = {
      ...ctor.options,
      options
    }
  }

  /**
   * 判断浏览器是否支持对应的离线存储驱动器
   *
   * @since 1.0.0
   * @param {symbol} driver - 驱动器常量
   * @returns {Promise}
   */
  static supports(driver) {
    return localforage.supports(DRIVERS_REFLECTOR[driver])
  }

  /**
   * 构造函数
   *
   * @param {object} options - 配置参数
   * @param {number} [options.maxAge] - 数据可存活时间（毫秒单位），可选值有：0=不缓存，小于0的值=永久缓存（默认），大于0的值=可存活时间
   * @param {array|string} [options.driver] -
   *   离线存储器的驱动器，可选值有:Storage.SESSIONSTORAGE、Storage.INDEXEDDB、Storage.WEBSQL、Storage.LOCALSTORAGE
   * @param {string} [options.name] - 离线存储器命名空间
   * @param {string} [options.description]- 离线存储器描述
   * @param {number} [options.size]- 离线存储器的大小
   * @param {string} [options.storeName] - 离线存储器的数据库名称
   */
  constructor(options) {
    const ctor = this.constructor
    this.$options = {
      ...ctor.options,
      ...options
    }

    this._ready = actions.init(this)
  }

  /**
   * 实例关联的存储storeMap的localforage实例
   *
   * @since 1.0.0
   * @private
   * @readonly
   */
  _storeMapStorage = undefined

  /**
   * 实例关联的localforage实例
   *
   * @since 1.0.0
   * @private
   * @readonly
   */
  _storage = undefined

  /**
   * 实例的完全初始化
   *
   * @since 1.0.0
   * @private
   * @readonly
   */
  _ready = undefined

  /**
   * 实例的数据与存活时间映射关系表
   *
   * @since 1.0.0
   * @readonly
   */
  $storeMap = {}

  /**
   * 实例的数据存活时长
   *
   * @since 1.0.0
   * @readonly
   */
  $maxAge = undefined

  /**
   * 实例配置项
   *
   * @since 1.0.0
   * @readonly
   */
  $options = undefined

  /**
   * 实例的驱动器类型
   *
   * @since 1.0.0
   * @readonly
   */
  $driver = undefined

  /**
   * 实例的命名空间
   *
   * @since 1.0.0
   * @readonly
   */
  $name = undefined

  /**
   * 实例的描述
   *
   * @since 1.0.0
   * @readonly
   */
  $description = undefined

  /**
   * 实例的数据库大小
   *
   * @since 1.0.0
   * @readonly
   */
  $size = undefined

  /**
   * 实例的数据库名称
   *
   * @since 1.0.0
   * @readonly
   */
  $storeName = undefined

  /**
   * 实例的数据项长度
   *
   * @since 1.0.0
   * @readonly
   */
  $length = 0

  /**
   * 获取实例的数据项长度，实例$length属性的别名属性
   *
   * @since 1.0.0
   * @getter
   * @readonly
   * @returns {number}
   */
  get length() {
    return this.$length || 0
  }

  /**
   * 设置实例的数据项长度
   *
   * @since 1.0.0
   * @setter
   * @ignore
   */
  // set length(value) {
  // }

  /**
   * 确保实例已初始化完成
   *
   * @since 1.0.0
   * @returns {Promise}
   */
  ready() {
    return this._ready
  }

  /**
   * 获取当前实例的驱动器常量
   * [注] 确保实例已初始化完成，否则取不到值
   *
   * @since 1.0.0
   * @returns {Promise}
   */
  driver() {
    return this.$driver
  }

  /**
   * 存储数据项到离线存储器
   *
   * @since 1.0.0
   * @param {string} name - 数据项名称
   * @param {*} data - 任意数据
   * @param {object} options - 自定义存储单元实例的配置选项
   * @param {number} [options.maxAge] - 数据单元项可存活时间（毫秒单位）
   * @param {string} [options.description]- 数据单元项描述
   * @returns {Promise}
   */
  setItem(name, data, options = {}) {
    const maxAge = validation.isNumber(options.maxAge) ? options.maxAge : this.$maxAge

    // 若时效性为0，则不存储到store中，直接返回结果
    if (maxAge === 0) {
      return Promise.resolve(data)
    }

    // 往storeMap中插入一条记录
    // [误]判断$store是否已存在，若已存在，则进行更新数据，若不存在，则初始化
    // [新]该方法将进行覆盖，重新需实例化
    this.$storeMap[name] = new DataItem({
      ...options,
      maxAge, // 默认取storage上的存活时间
      data,
      name: name // 名称强制指定为setItem的name参数
    })

    // 针对几种数据类型，进行转换
    // 几种localforage不支持的值进行转换
    return this._storage.setItem(name, actions.transformStorageDate(data)).then(async () => {
      await actions.computedLength(this)
      // 将当前的原始值返回
      return data
    })
  }

  /**
   * 更新数据项数据
   * 会更新数据单元项实例的更新时间戳
   *
   * @deprecated 1.1.0
   * @since 1.0.0
   * @param {string} name - 数据项名称
   * @param {*} data - 任意数据
   * @returns {Promise}
   */
  updateItem(name, data) {
    // 判断是否已存在该项
    const dataItem = this.$storeMap[name]

    // 若未存在，则进行初始化
    if (!(dataItem instanceof DataItem)) {
      return this.setItem(name, data)
    }

    // 若已存在，则只更新数据
    dataItem.updateData(data)

    return this._storage.setItem(name, actions.transformStorageDate(data)).then(() => {
      return data
    })
  }

  /**
   * 获取指定数据项数据
   *
   * @since 1.0.0
   * @param {string} name - 数据项名称
   * @returns {Promise}
   */
  getItem(name) {
    const dataItem = this.$storeMap[name]

    // 如果DataItem实例不存在，或者DataItem实例的maxAge属性不存在
    if (!dataItem || !validation.isNumber(dataItem.$maxAge)) {
      return Promise.reject('outdate')
    }

    // maxAge的值大于0
    if (dataItem.isOutdated()) {
      // 移除数据
      this.removeItem(name)

      return Promise.reject('outdate')
    }

    // 优化性能
    // 若数据还在存活期，且已绑定在了storeMap上，则忽略从离线存储中取出再解析的过程
    if (!validation.isUndefined(dataItem.$data)) {
      return Promise.resolve(dataItem.$data)
    }

    return this._storage.getItem(name).then((data) => {
      // 解析数据类型
      data = actions.parseStorageDate(data)
      dataItem.fillData(data)

      return data
    })
  }

  /**
   * 移除数据项
   *
   * @since 1.0.0
   * @param {string} name - 数据项名称
   * @returns {Promise}
   */
  removeItem(name) {
    this.$storeMap[name] = null
    delete this.$storeMap[name]

    return this._storage.removeItem(name).then(async () => {
      await actions.computedLength(this)
    })
  }

  /**
   * 清空所有数据项
   *
   * @since 1.0.0
   * @returns {Promise}
   */
  clear() {
    this.$storeMap = {}
    this.$length = 0

    return this._storage.clear()
  }

  /**
   * 获取指定序号的数据项键名
   * [注]该API在使用localStorage存储时行为会有点怪异，不准确
   *
   * @deprecated 1.1.0
   * @since 1.0.0
   * @param {number} keyIndex - 序号
   * @returns {Promise}
   */
  key(keyIndex) {
    return this._storage.key(keyIndex)
  }

  /**
   * 获取所有时效性活的数据的键列表
   *
   * @since 1.0.0
   * @returns {Promise}
   */
  keys() {
    return Promise.resolve().then(() => {
      let keys = []
      Object.entries(this.$storeMap).forEach(([name, dataItem]) => {
        if (dataItem.isOutdated()) {
          this.removeItem(name)
        } else {
          keys.push(name)
        }
      })

      return keys
    })
  }

  /**
   * 迭代所有数据项
   *
   * @since 1.0.0
   * @param {function} iteratorCallback - 迭代函数
   * @returns {Promise}
   */
  iterate(iteratorCallback) {
    // return Promise.resolve().then(() => {
    //   let keys = []
    //   Object.entries(this.$storeMap).forEach(([name, dataItem]) => {
    //     if (dataItem.isOutdated()) {
    //       this.removeItem(name)
    //     } else {
    //       keys.push(name)
    //     }
    //   })
    //
    //   return keys
    // })

    return this._storage.iterate(iteratorCallback)
  }
}

export { Storage }

// 导出默认Storage实例
export default new Storage()
