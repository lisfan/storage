/**
 * 各个数据单元项实例
 * TODO 后期进行剥离
 *
 * @class
 */

export default class DataItem {
  $description = '' // 该数据单元项的描述
  $initTimeStamp = undefined // 实例初始化时间戳（与$updateTimeStamp比较时使用该项进行比较，判断是否过期）
  $updateTimeStamp = undefined // 该数据的更新时间戳
  $data = undefined // 该数据单元项的数据
  $maxAge = undefined // 该数据单元项的存活时间

  /**
   * 构造函数
   * @param {object} options - 配置参数
   */
  constructor(options) {
    this.$description = options.description
    this.$maxAge = options.maxAge // 如果未指定有效时间，则取默认值
    this.$data = options.data

    const timeStamp = Date.now()
    this.$initTimeStamp = timeStamp // 该数据初次存储的时间戳

    if (options.updateTimeStamp) {
      this.$updateTimeStamp = options.updateTimeStamp
    } else {
      this.$updateTimeStamp = timeStamp // 该数据初次存储的时间戳
    }
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