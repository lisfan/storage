/*
 * 模拟 lodash API
 */
import validation from '@~lisfan/validation'

export default {
  compact(arr) {
    return arr.filter((item) => {
      return !!item
    })
  },
  castArray(arr) {
    return validation.isArray(arr) ? arr : [arr]
  },
  mapValues(obj, iterate) {
    let newObj = {}

    Object.entries(obj).forEach(([key, value]) => {
      newObj[key] = iterate(value, key, obj)
    })

    return newObj
  }

}