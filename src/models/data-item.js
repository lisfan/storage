/**
 * 各个数据单元项实例
 * TODO 后期进行剥离
 *
 * @class
 */

export default class DataItem {
  /**
   * 默认配置选项
   * @enum
   */
  static options = {
    data: undefined, // 该数据单元项的数据
    description: '', // 该数据单元项的描述
    maxAge: -1 // 该数据单元项的存活时间
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

  // $options
  $initTimeStamp = undefined // 实例初始化时间戳（与$updateTimeStamp比较时使用该项进行比较，判断是否过期）
  $updateTimeStamp = undefined // 该数据的更新时间戳

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

    // this.$description = options.description
    // this.$maxAge = options.maxAge // 如果未指定有效时间，则取默认值
    // this.$data = options.data

    const timeStamp = Date.now()
    this.$initTimeStamp = timeStamp // 该数据初次存储的时间戳

    if (options.updateTimeStamp) {
      this.$updateTimeStamp = options.updateTimeStamp
    } else {
      this.$updateTimeStamp = timeStamp // 该数据初次存储的时间戳
    }
  }

  /**
   * 获取实例描述
   */
  get $description() {
    return this.$options.description
  }

  // readonly
  set $description(value) {
  }

  /**
   * 获取实例描述
   */
  get $data() {
    return this.$options.data
  }

  // readonly
  set $data(value) {
  }

  /**
   * 获取实例描述
   */
  get $maxAge() {
    return this.$options.maxAge
  }

  // readonly
  set $maxAge(value) {
  }

  /**
   * 覆盖数据
   * 更新数据时，是进行整个数据对象的覆盖
   * @param {*} data - 任意数据类型
   * @returns {DataItem} 返回实例自身
   */
  fillData(data) {
    this.$data = data
    return this
  }

  /**
   * 更新数据
   * 更新数据时，是进行整个数据对象的覆盖，同时更新时间戳
   * @param {*} data - 任意数据类型
   * @returns {DataItem} 返回实例自身
   */
  updateData(data) {
    this.fillData(data)
    this.$updateTimeStamp = Date.now()

    return this
  }
}