/**
 * 离线存储控制器
 *
 * 模块性质：工具模块
 * 作用范围：pc、mobile
 * 依赖模块：utils/env
 * 来源项目：扫码点单H5
 * 初始发布日期：2017-09-29 10:00
 * 最后更新日期：2017-05-25 20:00
 *
 * ## 特性
 * - 底层依赖了[localforage](https://localforage.github.io/localForage/#localforage)插件，并自封装了一个 sessionStorage-driver
 * - storage是提供的大多数方法都是异步的，部分实例上的属性数据需要等待完全初始化完成才能获取的到，
 * 所以为了确保它已经完全初始化，需将逻辑代码写在调用ready()方法后的resolved函数里
 * - storage提供的API模仿localforage-like风格，但增减了一些，同时也可能更改了部分方法的表现，但大致上还是可以参考文档localforage的文档的
 * - 支持localforage所有全局配置项参数，各配置参数作用也是相同的，但细微之处会有差异，且额外扩展了一些新的配置项，同时支持自定义数据存储单元的配置项
 *  - 额外扩展了如下配置选项
 *    - 数据存储有效期控制(maxAge)：默认数据可存活时间（毫秒单位），可选值有：0=不缓存，小于0的值=永久缓存（默认），大于0的值=可存活时间
 * 除了`driver`外的
 * - 与 localforage 模块的的一些区别
 *    - 驱动器的常量值变化，改成以下对应的值，且作为了是类的静态属性成员
 *      - Storage.SESSIONSTORAGE: 使用sessionstorage存储（默认优先选择该项）
 *      - Storage.LOCALSTORAGE: 使用localstorage存储
 *      - Storage.INDEXEDDB: 使用indexedDB存储
 *      - Storage.WEBSQL: 使用webSQL存储
 *    - 驱动器的默认使用顺序变更：根据浏览器支持情况，优先选择sessionStorage，之后再根据localforage的默认值走
 *    - Storage实例移除类似localforage API末尾的callback形参
 *    - Storage.supports方法作为静态方法成员，而不是像localforage#supports方法作为实例方法成员
 *    - Storage中不存在像localforage#setDriver、localforage#createInstance、localforage#defineDriver等API
 *    - Storage#length作为一个实例属性值，而不是像localforage#length作为一个异步方法
 *    - 增加了一个Storage#updateItem方法（仅用于更新数据，表示数据进行了更新且更新时间设置为最新）
 *    - Storage#getItem方法取的值若不存在时，将进入reject，抛出'not found'，而不是返回null
 * - 扩展支持的一些新的数据类型存储
 *    - 默认支持localforage支持的如下数据类型存储
 *     - null
 *     - Number
 *     - String
 *     - Array
 *     - Object
 *     - Blob
 *     - ArrayBuffer
 *     - Float32Array
 *     - Float64Array
 *     - Int8Array
 *     - Int16Array
 *     - Int32Array
 *     - Uint8Array
 *     - Uint8ClampedArray
 *     - Uint16Array
 *     - Uint32Array
 *    - 在此基础上又扩充了对如下数据类型的存储（因为在某些实际的使用场景中还是需要用的到，内部存储时将使用了如下格式进行存储）
 *     - undefined => [storage undefined]#undefined
 *     - NaN => [storage nan]#NaN
 *     - Infinity => [storage infinity]#Infinity
 *     - -Infinity => [storage infinity]#-Infinity
 *     - new Date() => [storage date]#1507600033804
 *     - /regexp/g => [storage regexp]#/regexp/g
 *     - new RegExp('regexp', 'g') => [storage regexp]#/regexp/g
 *     - function(){} => [storage function]#function(){}
 *     - new Function('a', 'b', 'return a+b') => [storage function]#function anonymous(){}
 *    - 不对以下数据类型进行存储
 *     - Symbol
 *     - Error
 *
 * ## Changelog
 *
 * ## TODO
 *
 * ## Usage
 * ``` js
 *
 * ```
 *
 * @since 3.0.0
 * @version 1.0.0
 */

import localforage from 'localforage'
import sessionStorageWrapper from './utils/localforage-sessionstoragewrapper'

import validation from '@~lisfan/validation'
import _ from './utils/lodash-personal.js'
import utils from './utils/utils.js'

import DataItem from './models/data-item'

import STORAGE_DRIVERS from './enums/storage-drivers'
import LOCALFORAGE_DRIVERS_REFLECTOR from './enums/localforage-drivers-reflector'
import STORAGE_DRIVERS_REFLECTOR from './enums/localforage-drivers-reflector'

// localForage默认配置项
const localForageDefaultConfig = localforage._defaultConfig

/* eslint-disable max-len */
const localForageDefaultDriver = [sessionStorageWrapper._driver].concat(localForageDefaultConfig._driver)
/* eslint-enable max-len */

/**
 * 默认生成localforage实例工厂
 * @param {object} options - 配置项
 * @returns {LocalForage} 返回一个实例
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

// storeMap实例Promise
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
   * 实例初始化
   * 1. 创建localforage实例
   * 2. 填充localforage实例初始化完成后的storage实例数据
   * @param {Storage} self - Stoarge实例
   * @return {Promise} - 返回初始化结果
   */
  async init(self) {
    await this.createInstance(self)
    return this.readyInit(self)
  },
  /**
   * 创建驱动器实例
   * @param {Storage} self - Stoarge实例
   * @returns {Promise} - 返回实例创建结果
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
   * @param {Storage} self - Stoarge实例
   * @returns {Promise} - 返回实例完全初始化结果
   */
  readyInit(self) {
    return new Promise((resolve) => {
      self.$storage.ready().then(async () => {
        const localforageConfig = self.$storage._config
        self.$driver = LOCALFORAGE_DRIVERS_REFLECTOR[localforageConfig.driver]
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
   * [误]每次调用会影响数据项长度的API后，重新计算length的长度
   * [误]由于计算长度是调用其他异步api的，为了提升性能，采用手动计算方式处理
   * 因为会发生setItem覆盖数据值的情况，手动计算不会准确
   * @param {Storage} self - Stoarge实例
   * @returns {number} - 返回当前数据项长度
   */
  computedLength(self) {
    return self.$storage.length().then((length) => {
      self.$length = length
    })
  },
  /**
   * 调用该项时，确保localforage实例已完全初始化
   * 解析默认存在的storeMap
   * 且不是sessionstorage已被清除的状态
   * @param {Storage} self - Stoarge实例
   * @returns {Promise} - 返回解析结果
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
   * 过滤梳理storeMap
   * @param {Storage} self - Stoarge实例
   * @returns {DataItem[]} - 返回梳理后的数据单元实例列表
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
   * [旧]每次调用会影响数据项长度的API后，重新记录一次storeMap
   * 需要排除数据的记录，只保存对象上的一些数据而已
   * [新]优化性能，只有在离开页面的时候才进行一次存储
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

/* eslint-disable require-jsdoc */
/**
 * 离线存储控制器
 * 1. storage只会管理存储通过其 API 创建的离线数据，会加入命名空间前缀，不管理其他自定义的存储数据
 * 2. storage实例会单独建立一个映射表来管理数据单元与数据的映射关系
 * @class Storage
 */
export class Storage {
  // 静态成员
  static SESSIONSTORAGE = STORAGE_DRIVERS.SESSIONSTORAGE
  static INDEXEDDB = STORAGE_DRIVERS.INDEXEDDB
  static WEBSQL = STORAGE_DRIVERS.WEBSQL
  static LOCALSTORAGE = STORAGE_DRIVERS.LOCALSTORAGE

  /**
   * 默认配置项
   *
   * @static
   */
  static options = {
    maxAge: -1, // 默认数据可存活时间（毫秒单位），可选值有：0=不缓存，小于0的值=永久缓存（默认），大于0的值=可存活时间
    /**
     * 默认storage驱动器优先选择列表
     * @returns {array} - 返回默认storage驱动器列表
     */
    driver: utils.transformLocalforageDriverToStorageDriver(localForageDefaultDriver),
    name: 'storage', // 默认命名空间
    description: localForageDefaultConfig.description, // 默认描述
    size: localForageDefaultConfig.size, // 默认数据库大小，仅WebSQL有效
    storeName: localForageDefaultConfig.storeName, // 默认数据库名称，仅indexedDB和WebSQL有效
  }

  /**
   * 更新默认配置项
   * @static
   * @param {object} options - 配置参数
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
   * storage实例是否已完全初始化是否已实例化完成
   * @static
   * @param {symbol} driver - 驱动器是否被支持
   * @returns {Promise} 实例化完成
   */
  static supports(driver) {
    return localforage.supports(STORAGE_DRIVERS_REFLECTOR[driver])
  }

  /**
   * 构造函数
   * @param {object} options - 配置参数
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
   * storage实例是否已完全初始化是否已实例化完成
   * @returns {Promise} 实例化完成
   */
  ready() {
    return this._ready
  }

  /**
   * 获取当前实例的驱动器
   * 获取之前确保已经完全实例化
   * todo 引入装饰器，确保实例的属性值都是不可被更改的
   * @returns {Promise} 实例化完成
   */
  driver() {
    return this.$driver
  }

  /**
   * 设置指定数据项
   * @param {string} key - 数据项名称
   * @param {*} data - 存储数据
   * @param {object} options - 自定义配置项
   * @returns {Promise} - 返回存储指定数据项Promise
   */
  setItem(key, data, options) {
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
   * 更新指定数据项数据
   * @param {string} key - 数据项名称
   * @param {*} data - 存储数据
   * @returns {Promise} - 返回存储指定数据项Promise
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
   * 获取指定数据项
   * 若已过期，则会返回reject
   * @param {string} key - 数据项名称
   * @returns {Promise} - 返回指定数据项Promise
   */
  getItem(key) {
    const nowTimeStamp = Date.now()

    const dataItem = this.$storeMap[key]

    // 如果DataItem实例不存在，或者DataItem实例的maxAge属性不存在时
    if (!dataItem || !validation.isNumber(dataItem.$maxAge)) {
      return Promise.reject('not found')
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
   * @param {string} key - 数据项名称
   * @returns {Promise} - 返回移除结果
   */
  removeItem(key) {
    this.$storeMap[key] = null
    delete this.$storeMap[key]

    return this.$storage.removeItem(key).then(async () => {
      await _actions.computedLength(this)
    })
  }

  /**
   * 清空数据项
   * @returns {Promise} - 返回清空结果
   */
  clear() {
    // 重置
    this.$storeMap = {}
    this.$length = 0

    return this.$storage.clear()
  }

  /**
   * 获取数据库数据项的长度
   * 该API在使用localStorage存储时行为会有点怪异，不准确
   * @param {number} keyIndex - 索引序号
   * @returns {Promise} 返回结果
   */
  key(keyIndex) {
    return this.$storage.key(keyIndex)
  }

  /**
   * 获取数据库数据项的长度
   * @returns {Promise} 返回结果
   */
  keys() {
    return this.$storage.keys()
  }

  /**
   * 获取数据库数据项的长度
   * @param {function} iteratorCallback - 迭代函数
   * @returns {Promise} 返回结果
   */
  iterate(iteratorCallback) {
    return this.$storage.iterate(iteratorCallback)
  }
}

// 导出默认Storage实例
export default new Storage()
