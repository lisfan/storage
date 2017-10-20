/*
 * 工具辅助函数
 */
import DATA_TYPE from '../enums/data-types'
import _ from './lodash-personal'
import validation from '@~lisfan/validation'

import LOCALFORAGE_DRIVERS_REFLECTOR from '../enums/localforage-drivers-reflector'
import STORAGE_DRIVERS_REFLECTOR from '../enums/localforage-drivers-reflector'

export default {
  /**
   * 转换storage驱动器列表为localforage驱动器列表
   * @param {string[]} localforageDriver - localforage驱动器列表
   * @returns {symbol[]} - 返回storage驱动器列表
   */
  transformLocalforageDriverToStorageDriver(localforageDriver) {
    const storageDriver = localforageDriver.map((driver) => {
      return LOCALFORAGE_DRIVERS_REFLECTOR[driver]
    })

    // 移除假值
    return _.compact(storageDriver)
  },
  /**
   * 转换storage驱动器列表为localforage驱动器列表
   * @param {symbol[]} storageDriver - storage驱动器列表
   * @returns {string[]} - 返回localforage驱动器列表
   */
  transformStorageDriverToLocalforageDriver(storageDriver) {
    const localforageDriver = storageDriver.map((driver) => {
      return STORAGE_DRIVERS_REFLECTOR[driver]
    })

    // 移除假值
    return _.compact(localforageDriver)
  },

  /**
   * 转换成可离线存储的格式
   * @param {*} data - 任意数据
   * @returns {*} - 转换之后能被离线存储的格式
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
  // 解析时的正则
  PARSE_DATA_REGEXP: /^\[storage ([^\]#]+)\]#([\s\S]+)$/,
  /**
   * 解析存储的值
   * @param {*} data - 任意数据
   * @returns {*} - 返回解析后的数据
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