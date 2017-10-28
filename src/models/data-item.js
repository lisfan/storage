/**
 * 数据单元类
 * @ignore
 * @class
 */
class DataItem {
  /**
   * 默认配置选项
   *
   * @since 1.0.0
   * @memberOf DataItem
   * @static
   * @property {string} description='' - 数据单元项描述
   * @property {number} maxAge=-1 - 数据单元项的存活时间
   */
  static options = {
    description: '', // 该数据单元项的描述
    maxAge: -1 // 该数据单元项的存活时间
  }

  /**
   * 更新默认配置项
   *
   * @since 1.0.0
   * @static
   * @param {object} options - 配置参数
   * @param {string} [options.description] - 数据单元项描述
   * @param {number} [options.maxAge] - 数据单元项的存活时间
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
   * 构造函数
   * @param {object} options - 配置参数
   * @param {*} [options.data] - 数据单元关联的值，若未指定值，则值为undefined
   * @param {string} [options.description] - 数据单元项描述
   * @param {number} [options.maxAge] - 数据单元项的存活时间，单位毫秒，可选值：小于0的值=永久存活（默认）、0=不缓存、大于0的值=可存活时间
   */
  constructor(options) {
    const ctor = this.constructor

    this.$options = {
      ...ctor.options,
      ...options
    }

    // this.$description = options.description
    // this.$maxAge = options.maxAge // 如果未指定有效时间，则取默认值
    // this.$data = options.data

    const timeStamp = Date.now()
    this.$initTimeStamp = timeStamp

    if (options.updateTimeStamp) {
      this.$updateTimeStamp = options.updateTimeStamp
    } else {
      this.$updateTimeStamp = timeStamp
    }
  }

  /**
   * 实例配置项
   *
   * @since 1.0.0
   * @readonly
   */
  $options = undefined

  /**
   * 实例初始化时间戳（与$updateTimeStamp进行比较，判断是否过期）
   *
   * @since 1.0.0
   * @readonly
   */
  $initTimeStamp = undefined

  /**
   * 每次数据更新时更新该时间戳
   *
   * @since 1.0.0
   * @readonly
   */
  $updateTimeStamp = undefined

  /**
   * 获取实例的描述配置项
   *
   * @since 1.0.0
   * @getter
   * @readonly
   * @returns {string}
   */
  get $description() {
    return this.$options.description
  }

  /**
   * 设置实例的描述配置项
   *
   * @since 1.0.0
   * @setter
   * @readonly
   * @ignore
   */
  set $description(value) {
  }

  /**
   * 获取实例的关联数据
   *
   * @since 1.0.0
   * @getter
   * @readonly
   * @returns {*}
   */
  get $data() {
    return this.$options.data
  }

  /**
   * 设置实例的关联数据
   *
   * @since 1.0.0
   * @setter
   * @readonly
   * @ignore
   */
  set $data(value) {
  }

  /**
   * 获取实例的存活时间配置项
   *
   * @since 1.0.0
   * @getter
   * @readonly
   * @returns {number}
   */
  get $maxAge() {
    return this.$options.maxAge
  }

  /**
   * 设置实例的存活时间配置项
   *
   * @since 1.0.0
   * @setter
   * @readonly
   * @ignore
   */
  set $maxAge(value) {
  }

  /**
   * 覆盖数据，进行整个数据对象的覆盖
   *
   * @since 1.0.0
   * @param {*} data - 任意数据类型
   * @returns {DataItem}
   */
  fillData(data) {
    this.$data = data
    return this
  }

  /**
   * 更新数据，是进行整个数据对象的覆盖，同时更新$updateTimeStamp实例属性
   *
   * @since 1.0.0
   * @param {*} data - 任意数据类型
   * @returns {DataItem}
   */
  updateData(data) {
    this.fillData(data)
    this.$updateTimeStamp = Date.now()

    return this
  }
}

export default DataItem