/**
 * @classdesc 数据单元类
 *
 * @class
 */
class DataItem {
  /**
   * 默认配置选项
   *
   * @since 1.0.0
   *
   * @static
   * @readonly
   * @memberOf DataItem
   *
   * @type {object}
   * @property {string} description='' - 数据单元项描述
   * @property {number} maxAge=-1 - 数据单元项的存活时间，单位毫秒，可选值：小于0的值=永久存活（默认）、0=不缓存、大于0的值=可存活时间
   */
  static options = {
    description: '', // 该数据单元项的描述
    maxAge: -1 // 该数据单元项的存活时间
  }

  /**
   * 更新默认配置项
   *
   * @since 1.0.0
   *
   * @static
   *
   * @see DataItem.options
   *
   * @param {object} options - 其他配置选项见{@link DataItem.options}
   *
   * @returns {DataItem}
   */
  static config(options) {
    // 不调用localforage.config，希望这里的config只是针对Storage类的配置更新
    DataItem.options = {
      ...DataItem.options,
      options
    }

    return this
  }

  /**
   * 构造函数
   *
   * @see DataItem.options
   *
   * @param {object} options - 其他配置选项见{@link DataItem.options}
   * @param {*} [options.data] - 数据单元关联的值，若未指定值，则值为undefined
   * @param {number} [options.timeStamp=Date.now()] - 数据初始存储时间戳，若未指定，默认使用当前时间
   */
  constructor(options) {
    this.$options = {
      ...DataItem.options,
      timeStamp: Date.now(),
      ...options
    }

    this.$data = this.$options.data
    this.$timeStamp = this.$options.timeStamp
  }

  /**
   * 实例初始配置项
   *
   * @since 1.0.0
   *
   * @readonly
   *
   * @type {object}
   */
  $options = undefined

  /**
   * 获取实例的数据更新时间
   * 若实例配置选项中提供了timeStamp选项，则使用该值
   * 否则使用当前时间戳
   *
   * @since 1.0.0
   *
   * @readonly
   *
   * @type {number}
   */
  $timeStamp = undefined

  /**
   * 获取实例的描述配置项
   *
   * @since 1.0.0
   *
   * @getter
   * @readonly
   *
   * @type {string}
   */
  get $description() {
    return this.$options.description
  }

  /**
   * 获取实例的关联数据
   *
   * @since 1.0.0
   *
   * @readonly
   *
   * @type {*}
   */
  $data = undefined

  /**
   * 获取实例的存活时间配置项
   *
   * @since 1.0.0
   *
   * @getter
   * @readonly
   *
   * @type {number}
   */
  get $maxAge() {
    return this.$options.maxAge
  }

  /**
   * 覆盖数据，进行整个数据对象的覆盖
   *
   * @since 1.0.0
   *
   * @param {*} data - 任意数据类型
   *
   * @returns {DataItem}
   */
  fillData(data) {
    this.$data = data
    return this
  }

  /**
   * 更新数据，是进行整个数据对象的覆盖，同时更新$timeStamp实例属性
   *
   * @since 1.0.0
   *
   * @param {*} data - 任意数据类型
   *
   * @returns {DataItem}
   */
  updateData(data) {
    this.$timeStamp = Date.now()
    return this.fillData(data)
  }

  /**
   * 验证当前数据项是否已过期
   *
   * @since 1.1.0
   *
   * @returns {boolean}
   */
  isOutdated() {
    return this.$maxAge > 0 && (this.$timeStamp + this.$maxAge) < Date.now()
  }
}

export default DataItem