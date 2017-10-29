// 私有方法集合
import localforage from 'localforage'
import validation from '@~lisfan/validation'
import _ from './utils'
import DATA_TYPE from '../enums/data-types'
import DRIVERS_REFLECTOR from '../enums/drivers-reflector'
import sessionStorageWrapper from './localforage-sessionstoragewrapper'

// 增加新的sessionStorage驱动器
const definedSessionDriverPromise = localforage.defineDriver(sessionStorageWrapper)

export default {
  /**
   * localforage实例工厂
   *
   * @ignore
   * @param {object} options - 配置项
   * @returns {LocalForage}
   */
  localforageFactory(options) {
    return localforage.createInstance({
      ...options,
      driver: options.driver && options.driver.length > 0 ? options.driver : localForageDefaultDriver,
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
  readyInit(self) {
    return new Promise((resolve) => {
      self._storage.ready().then(async () => {
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
        return DATA_TYPE.UNDEFINED + 'undefined'
      case 'date':
        return DATA_TYPE.DATE + data.getTime()
      case 'regexp':
        return DATA_TYPE.REGEXP + data.toString()
      case 'function':
        return DATA_TYPE.FUNCTION + data.toString()
      case 'number':
        if (validation.isNaN(data)) {
          // 处理是NaN的情况
          return DATA_TYPE.NAN + 'NaN'
        } else if (!validation.isFinite(data) && data > 0) {
          // 处理是NaN的情况
          return DATA_TYPE.INFINITY + 'Infinity'
        } else if (!validation.isFinite(data) && data < 0) {
          // 处理是NaN的情况
          return DATA_TYPE.INFINITY + '-Infinity'
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
    /* eslint-enable no-eval*/
  }
}