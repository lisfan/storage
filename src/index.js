/**
 * @file 离线存储控制器
 * @author lisfan <goolisfan@gmail.com>
 * @version 1.1.0
 * @licence MIT
 */

import localforage from 'localforage'
import sessionStorageWrapper from './utils/localforage-sessionstoragewrapper'

import validation from '@~lisfan/validation'
import _ from './utils/lodash-simple'
import utils from './utils/utils'

import DataItem from './models/data-item'

import STORAGE_DRIVERS from './enums/storage-drivers'
import DRIVERS_REFLECTOR from './enums/localforage-drivers-reflector'

// localForage默认配置项
const localForageDefaultConfig = localforage._defaultConfig

/* eslint-disable max-len */
const localForageDefaultDriver = [sessionStorageWrapper._driver].concat(localForageDefaultConfig._driver)
/* eslint-enable max-len */

/**
 * localforage实例工厂
 *
 * @ignore
 * @param {object} options - 配置项
 * @returns {LocalForage}
 */
const localforageFactory = function (options) {
  return localforage.createInstance({
    driver: localForageDefaultDriver,
    ...options,
  })
}

// 定义驱动器Promise
const defineDriverPromise = localforage.defineDriver(sessionStorageWrapper)

// 创建一个名为storeMap的实例，用来存储各个DataItem实例
// - 目的是避免使用自身数据库进行存储storeMap，而引来的一些不必要的麻烦
// - 比如，如果直接放置在自身属性上，会占用一个存储项，且部分api调用时，还需要排除该项
const STORE_MAP_NAMESPACE = 'STORE_MAP'
let storeMapStorage // 只保持一个实例即可，不重复创建

// 创建storeMap的localforage实例
const storeMapStoragePromise = function () {
  return defineDriverPromise.then(() => {
    if (!storeMapStorage) {
      return localforageFactory({
        name: STORE_MAP_NAMESPACE
      })
    }

    return storeMapStorage
  })
}

// 私有方法集合
const _actions = {
  /**
   * storage实例初始化
   * 1. 创建localforage实例
   * 2. 填充localforage实例初始化完成后的storage实例数据
   *
   * @since 1.0.0
   * @async
   * @param {Storage} self - Stoarge实例
   * @return {Promise}
   */
  async init(self) {
    await this.createInstance(self)
    return this.readyInit(self)
  },
  /**
   * 创建storage实例
   *
   * @since 1.0.0
   * @param {Storage} self - Stoarge实例
   * @returns {Promise}
   */
  createInstance(self) {
    /* eslint-disable max-len */
    const storageDrivers = utils.transformStorageDriverToLocalforageDriver(_.castArray(self.$options.driver))
    /* eslint-enable max-len */

    // 异步加载，确保自定义driver已经加载完毕
    return defineDriverPromise.then(() => {
      self.$storage = localforageFactory({
        ...self.$options,
        // 如果driver不存在，则使用默认driver
        driver: storageDrivers.length > 0 ? storageDrivers : localForageDefaultDriver
      })
    })
  },
  /**
   * localforage实例完全初始化后，对storage实例进行完全初始化处理
   *
   * @since 1.0.0
   * @param {Storage} self - Stoarge实例
   * @returns {Promise}
   */
  readyInit(self) {
    return new Promise((resolve) => {
      self.$storage.ready().then(async () => {
        const localforageConfig = self.$storage._config
        self.$driver = DRIVERS_REFLECTOR[localforageConfig.driver]
        self.$name = localforageConfig.name
        self.$description = localforageConfig.description
        self.$storeName = localforageConfig.storeName
        self.$size = localforageConfig.size

        self.$maxAge = self.$options.maxAge

        // （优先）等待数据长度计算
        await this.computedLength(self)
        // 解析离线存储中的storemap
        await this.parseStoreMap(self)

        // 绑定事件(必须等待上两个完成)
        this.bindRecordStoreMapEvent(self)

        resolve()
      })
    })
  },
  /**
   * 计算数据长度长度
   * [误]每次调用会影响数据项长度的API后，重新计算length的长度
   * [误]由于计算长度是调用其他异步api的，为了提升性能，采用手动计算方式处理
   * 因为会发生setItem覆盖数据值的情况，手动计算不会准确
   *
   * @since 1.0.0
   * @param {Storage} self - Stoarge实例
   * @returns {number}
   */
  computedLength(self) {
    return self.$storage.length().then((length) => {
      self.$length = length
    })
  },
  /**
   * 调用该方法时，确保localforage实例已完全初始化
   * 解析默认存在的storeMap，且存在数据项长度大于0
   *
   * @since 1.0.0
   * @async
   * @param {Storage} self - Stoarge实例
   * @returns {Promise}
   */
  async parseStoreMap(self) {
    return storeMapStoragePromise().then((storage) => {
      return storage.getItem(self.$name).then((data) => {
        // 若以存在，且数据项长度大于0
        if (data && self.length > 0) {
          self.$storeMap = _.mapValues(data, (options) => {
            return new DataItem(options)
          })
        } else {
          self.$storeMap = {}
        }
      })
    })
  },
  /**
   * 过滤梳理storeMap的数据单元实例列表
   *
   * @since 1.0.0
   * @param {Storage} self - Stoarge实例
   * @returns {DataItem[]}
   */
  filterStoreMap(self) {
    let storeMap = {}
    Object.entries(self.$storeMap).forEach(([key, dataItem]) => {
      // 过滤maxAge不存在的DataItem实例
      if (validation.isNumber(dataItem.$maxAge)) {
        storeMap[key] = {
          description: dataItem.$description,
          updateTimeStamp: dataItem.$updateTimeStamp,
          maxAge: dataItem.$maxAge,
        }
      }
    })

    return storeMap
  },
  /**
   * 绑定标签页离开事件
   * [旧]每次调用会影响数据项长度的API后，重新记录一次storeMap
   * 需要排除数据的记录，只保存对象上的一些数据而已
   * [新]优化性能，只有在离开页面的时候才进行一次存储
   *
   * @since 1.0.0
   * @param {Storage} self - Stoarge实例
   */
  bindRecordStoreMapEvent(self) {
    window.addEventListener('beforeunload', () => {
      const filteredStoreMap = this.filterStoreMap(self)
      const filteredStoreMapLength = Object.keys(filteredStoreMap).length
      if (filteredStoreMapLength > 0) {
        storeMapStoragePromise().then((storage) => {
          storage.setItem(self.$name, filteredStoreMap)
        })
      }
    })
  },
}

/**
 * 离线存储类
 * 1. storage只会管理存储通过其 API 创建的离线数据，不管理其他自定义的存储数据（数据项会加上命名空间前缀）
 * 2. storage实例会单独建立一个映射表来管理数据单元与数据的映射关系
 *
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
    driver: utils.transformLocalforageDriverToStorageDriver(localForageDefaultDriver),
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
   *   离线存储器的驱动器，可选值有:Storage.SESSIONSTORAGE,Storage.INDEXEDDB,Storage.WEBSQL,Storage.LOCALSTORAGE
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

    this._ready = _actions.init(this)
  }

  // $options = undefined // 实例配置选项
  // $driver = undefined // 实例选择的驱动器类型
  // $name = undefined // 实例的命名空间
  // $description = undefined // 实例描述
  // $size = undefined // 实例数据库大小，仅针对webSQL
  // $storeName = undefined // 实例数据库名称，仅针对webSQL和indexedDB
  // $length = undefined // 已存储数据项的数量
  // $maxAge = undefined // 数据可存活多长时间，毫秒单位
  // $storage = undefined // 实例的关联的localforage实例
  $storeMap = {} // 数据存储映射表

  // 私有成员(避免使用)
  // _ready = undefined

  /**
   * 获取数据库数据项的长度
   */
  get length() {
    return this.$length || 0
  }

  // readonly
  set length(value) {
  }

  /**
   * 实例已初始化完成
   *
   * @since 1.0.0
   * @returns {Promise}
   */
  ready() {
    return this._ready
  }

  /**
   * 获取当前实例的驱动器常量
   **
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
   * @param {string} key - 数据项名称
   * @param {*} data - 任意数据
   * @param {object} options - 自定义存储单元的配置选项
   * @param {number} [options.maxAge] - 数据单元项可存活时间（毫秒单位）
   * @param {string} [options.description]- 数据单元项描述
   * @returns {Promise}
   */
  setItem(key, data, options = {}) {
    // 往storeMap中插入一条记录
    // [误]判断$store是否已存在，若已存在，则进行更新数据，若不存在，则初始化
    // [新]该方法将进行覆盖，重新需实例化
    this.$storeMap[key] = new DataItem({
      ...options,
      maxAge: validation.isNumber(options.maxAge) ? options.maxAge : this.$maxAge, // 默认取storage上的存活时间
      name: key, // 名称强制指定为setItem的key参数
      data
    })

    // 针对几种数据类型，进行转换
    // 几种localforage不支持的值进行转换
    return this.$storage.setItem(key, utils.transformStorageDate(data)).then(async () => {
      await _actions.computedLength(this)
      // 将当前的原始值返回
      return data
    })
  }

  /**
   * 更新数据项数据
   *
   * @since 1.0.0
   * @param {string} key - 数据项名称
   * @param {*} data - 任意数据
   * @returns {Promise}
   */
  updateItem(key, data) {
    // 判断是否已存在该项
    const dataItem = this.$storeMap[key]

    // 若未存在，则进行初始化
    if (!(dataItem instanceof DataItem)) {
      return this.setItem(key, data)
    }

    // 若已存在，则只更新数据
    dataItem.updateData(data)

    return this.$storage.setItem(key, utils.transformStorageDate(data)).then(() => {
      return data
    })
  }

  /**
   * 获取指定数据项数据
   * 若离线存储器中取不到值，会进入rejected('notfound')
   * 若离线存储器中值已过期，会进入rejected('outdated')
   *
   * @since 1.0.0
   * @param {string} key - 数据项名称
   * @returns {Promise}
   */
  getItem(key) {
    const nowTimeStamp = Date.now()

    const dataItem = this.$storeMap[key]

    // 如果DataItem实例不存在，或者DataItem实例的maxAge属性不存在时
    if (!dataItem || !validation.isNumber(dataItem.$maxAge)) {
      return Promise.reject('notfound')
    }

    // maxAge的值大于0
    if (dataItem.$maxAge === 0
      || (dataItem.$maxAge > 0 && (dataItem.$updateTimeStamp + dataItem.$maxAge) < nowTimeStamp)) {
      dataItem.fillData(undefined)

      return Promise.reject('outdated')
    }

    // 优化性能
    // 若数据还在存活期，且已绑定在了storeMap上，则忽略从离线存储中取出再解析的过程
    if (!validation.isUndefined(dataItem.$data)) {
      return Promise.resolve(dataItem.$data)
    }

    return this.$storage.getItem(key).then((data) => {
      data = utils.parseStorageDate(data)
      dataItem.fillData(data)

      return data
    })
  }

  /**
   * 移除数据项
   *
   * @since 1.0.0
   * @param {string} key - 数据项名称
   * @returns {Promise}
   */
  removeItem(key) {
    this.$storeMap[key] = null
    delete this.$storeMap[key]

    return this.$storage.removeItem(key).then(async () => {
      await _actions.computedLength(this)
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

    return this.$storage.clear()
  }

  /**
   * 获取指定序号的数据项键名
   * [注]该API在使用localStorage存储时行为会有点怪异，不准确
   *
   * @since 1.0.0
   * @param {number} keyIndex - 序号
   * @returns {Promise}
   */
  key(keyIndex) {
    return this.$storage.key(keyIndex)
  }

  /**
   * 获取所有数据的键列表
   *
   * @since 1.0.0
   * @returns {Promise}
   */
  keys() {
    return this.$storage.keys()
  }

  /**
   * 迭代所有数据项
   *
   * @since 1.0.0
   * @param {function} iteratorCallback - 迭代函数
   * @returns {Promise}
   */
  iterate(iteratorCallback) {
    return this.$storage.iterate(iteratorCallback)
  }
}

export { Storage }

// 导出默认Storage实例
export default new Storage()
