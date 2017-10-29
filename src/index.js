/**
 * @file 离线存储控制器
 * @author lisfan <goolisfan@gmail.com>
 * @version 1.1.0
 * @licence MIT
 */

import Logger from '@~lisfan/logger'

Logger.configRules({
  'good': true
})
import localforage from 'localforage'
import validation from '@~lisfan/validation'
import _ from './utils/utils'

import DATA_TYPES from './enums/data-types'
import STORAGE_DRIVERS from './enums/storage-drivers'
import LOCALFORAGE_DRIVERS from './enums/localforage-drivers'
import DRIVERS_REFLECTOR from './enums/drivers-reflector'

import sessionStorageWrapper from './utils/localforage-sessionstoragewrapper'
import DataItem from './models/data-item'

// 增加新的sessionStorage驱动器
const definedSessionDriverPromise = localforage.defineDriver(sessionStorageWrapper)

// localForage默认配置项
const localForageDefaultConfig = localforage._defaultConfig

/* eslint-disable max-len */
// localForage默认驱动器列表，同时优先选择sessionStorage存储
const localForageDefaultDriver = [LOCALFORAGE_DRIVERS.SESSIONSTORAGE].concat(localForageDefaultConfig._driver)

/* eslint-enable max-len */

const _actions = {
  /**
   * localforage实例工厂
   *
   * @ignore
   * @param {object} options - 配置项
   * @returns {LocalForage}
   */
  localforageFactory(options) {
    // 验证驱动器列表是否至少有一个支持
    const drivers = options.driver.length > 0
      ? options.driver
      : localForageDefaultDriver

    let supportDriver = drivers.some((driver) => {
      return localforage.supports(driver)
    })

    if (!supportDriver) {
      throw new Error('当前浏览器不支持 ${xxx} 离线存储')
    }

    return localforage.createInstance({
      ...options,
      driver: drivers
    })
  },
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
    /* eslint-disable max-len */
    const storageDrivers = this.transformDriver(_.castArray(self.$options.driver))
    /* eslint-enable max-len */

    self._storeMapStorage = await this.createStoreMapStorage(self, storageDrivers)

    self._storage = await this.createStorage(self, storageDrivers)

    return this.readyInit(self)
  },
  /**
   * 创建存储storeMap的localforage实例
   * - 用来存储各个DataItem实例
   * - 该离线存储器的实例配置driver值参考用户自定义的驱动器
   * - 目的是避免使用自身数据库进行存储storeMap，而引来的一些不必要的麻烦
   * - 比如，如果直接放置在自身属性上，会占用一个存储项，且部分api调用时，还需要排除该项
   *
   * @since 1.0.0
   * @param {Storage} self - Stoarge实例
   * @returns {Promise}
   */
  createStoreMapStorage(self, storageDrivers) {
    // 异步加载，确保自定义driver已经加载完毕
    return definedSessionDriverPromise.then(() => {
      return this.localforageFactory({
        name: 'STORE_MAP',
        driver: storageDrivers
      })
    })
  },
  /**
   * 创建存储数据的localforage实例
   *
   * @since 1.0.0
   * @param {Storage} self - Stoarge实例
   * @returns {Promise}
   */
  createStorage(self, storageDrivers) {
    // 异步加载，确保自定义driver已经加载完毕
    return definedSessionDriverPromise.then(() => {
      return this.localforageFactory({
        ...self.$options,
        driver: storageDrivers
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
  async readyInit(self) {
    await self._storage.ready().then(async () => {
      const localforageConfig = self._storage._config
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
    })

    return Promise.resolve()
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
    return self._storage.length().then((length) => {
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
    return self._storeMapStorage.ready(() => {
      return self._storeMapStorage.getItem(self.$name).then((data) => {
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
          timeStamp: dataItem.$timeStamp,
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
        self._storeMapStorage.ready(() => {
          self._storeMapStorage.setItem(self.$name, filteredStoreMap)
        })
      }
    })
  },
  /**
   * 转换storage驱动器和localforage驱动器的映射关系
   *
   * @since 1.0.0
   * @param {string[]} dirver - storage驱动器列表或localforage驱动器列表
   * @returns {symbol[]}
   */
  transformDriver(drivers) {
    const transformedDriver = drivers.map((driver) => {
      return DRIVERS_REFLECTOR[driver]
    })

    // 移除假值
    return _.compact(transformedDriver)
  },

  /**
   * 转换成可离线存储的格式
   *
   * @since 1.0.0
   * @param {*} data - 任意数据
   * @returns {*}
   */
  transformStorageDate(data) {
    switch (validation.typeof(data)) {
      case 'undefined':
        return DATA_TYPES.UNDEFINED + 'undefined'
      case 'date':
        return DATA_TYPES.DATE + data.getTime()
      case 'regexp':
        return DATA_TYPES.REGEXP + data.toString()
      case 'function':
        return DATA_TYPES.FUNCTION + data.toString()
      case 'number':
        if (validation.isNaN(data)) {
          // 处理是NaN的情况
          return DATA_TYPES.NAN + 'NaN'
        } else if (!validation.isFinite(data) && data > 0) {
          // 处理是NaN的情况
          return DATA_TYPES.INFINITY + 'Infinity'
        } else if (!validation.isFinite(data) && data < 0) {
          // 处理是NaN的情况
          return DATA_TYPES.INFINITY + '-Infinity'
        }

        // 其他情况的number直接返回
        return data
      default:
        return data
    }
  },
  /**
   * 解析数据时的正则匹配模式
   * @since 1.0.0
   */
  PARSE_DATA_REGEXP: /^\[storage ([^\]#]+)\]#([\s\S]+)$/,
  /**
   * 解析要存储的值
   *
   * @since 1.0.0
   * @param {*} data - 任意数据
   * @returns {*}
   */
  parseStorageDate(data) {
    let type
    let value

    if (validation.isString(data) && data.startsWith('[storage')) {
      const matched = data.match(this.PARSE_DATA_REGEXP)

      if (matched) {
        type = matched[1]
        value = matched[2]
      }
    }

    /* eslint-disable no-eval*/
    switch (type) {
      case 'undefined':
        return undefined
      case 'date':
        return new Date(Number(value))
      case 'regexp':
        return eval(`(${value})`)
      case 'function':
        return eval(`(${value})`)
      case 'nan':
        return eval(`(${value})`)
      case 'infinity':
        return eval(`(${value})`)
      default:
        return data
    }
  },
  /* eslint-enable no-eval*/
  /**
   * 过滤时效还未超时的数据
   */
  filterInvalidData(self) {
    let storeMap = {}

    // 导师步解析数据，过滤已过期数据
    return self._storage.iterate((data, name, index) => {
      const dataItem = self.$storeMap[name]
      if (dataItem.isOutdated()) {
        self.removeItem(name)
      } else {
        // 解析数据类型
        dataItem.fillData(_actions.parseStorageDate(data))
        storeMap[name] = dataItem
      }
    }).then(() => {
      return storeMap
    })
  }
}

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
    driver: _actions.transformDriver(localForageDefaultDriver),
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

    this._ready = _actions.init(this)
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
    return this._storage.setItem(name, _actions.transformStorageDate(data)).then(async () => {
      await _actions.computedLength(this)
      // 将当前的原始值返回
      return data
    })
  }

  // /**
  //  * 更新数据项数据
  //  * 会更新数据单元项实例的更新时间戳
  //  *
  //  * @deprecated 1.1.0
  //  * @since 1.0.0
  //  * @param {string} name - 数据项名称
  //  * @param {*} data - 任意数据
  //  * @returns {Promise}
  //  */
  // updateItem(name, data) {
  //   // 判断是否已存在该项
  //   const dataItem = this.$storeMap[name]
  //
  //   // 若未存在，则进行初始化
  //   if (!(dataItem instanceof DataItem)) {
  //     return this.setItem(name, data)
  //   }
  //
  //   // 若已存在，则只更新数据
  //   dataItem.updateData(data)
  //
  //   return this._storage.setItem(name, _actions.transformStorageDate(data)).then(() => {
  //     return data
  //   })
  // }

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
      data = _actions.parseStorageDate(data)
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

    return this._storage.clear()
  }

  // /**
  //  * 获取指定序号的数据项键名
  //  * [注]该API在使用localStorage存储时行为会有点怪异，不准确
  //  *
  //  * @deprecated 1.1.0
  //  * @since 1.0.0
  //  * @param {number} keyIndex - 序号
  //  * @returns {Promise}
  //  */
  // key(keyIndex) {
  //   return this._storage.key(keyIndex)
  // }

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
   * @param {function} iteratorCallback - 迭代函数，迭代函数若返回了具体的值，则提前退出，且返回值将作为resolved的结果值
   * @returns {Promise}
   */
  iterate(iteratorCallback) {
    return _actions.filterInvalidData(this).then((storeMap) => {
      let result

      Object.entries(storeMap).every(([name, dataItem], index) => {
        result = iteratorCallback(dataItem.$data, name, index + 1)

        return validation.isUndefined(result)
      })

      return result
    })
  }
}

export { Storage }

// 导出默认Storage实例
export default new Storage()
