# Storage 离线存储器

[API documentation](https://lisfan.github.io/storage/)

## Feature 特性

- 让离线存储支持存储更多的数据类型
- 为离线存储增加有效期，若已超过时效则不读取

## Detail 详情

- 底层依赖了[localforage](https://localforage.github.io/localForage/#localforage)模块，并且封装了让localforage支持`sessionStorage`存储的一个扩展插件，顺便修复了该插件iterate()方法的bug

- 提供的大多数方法都是异步的，部分实例上的属性数据需要等待完全初始化完成才能获取的到，所以为了确保它已经完全初始化，需将逻辑代码写在调用`ready()`方法后的`resolved`函数里

- 提供的API模仿`localforage-like`风格，但增减了一部分，同时也可能更改了部分方法的逻辑，但大致上还是可以参考文档localforage的文档的

- 支持`localforage`所有全局配置项参数，各配置参数作用也是相同的，但细微之处会有差异，且额外扩展了一些新的配置项，同时支持自定义数据存储单元的配置项

- 若maxAge设置的存活时间为0，则不会进行离线存储数据，且为了保证一个命名空间下所有的的数据时效性检测（同时移除已过期的数据），会很消耗性能，所以只针对于部分API操作进行了特殊处理，因此这部分API应该尽量少使用，如keys()和iterate()方法

- 额外扩展了如下配置选项
  - 数据存储有效期控制`maxAge`：默认数据可存活时间（毫秒单位），可选值有：0=不缓存，小于0的值=永久缓存（默认），大于0的值=可存活时间

- 与 `localforage` 模块的的一些区别
   - 驱动器的常量值变化，改成以下对应的值，且作为了是类的静态属性成员
     - `Storage.SESSIONSTORAGE`: 使用`sessionstorage`离线存储，默认项
     - `Storage.LOCALSTORAGE`: 使用`localstorage`离线存储
     - `Storage.INDEXEDDB`: 使用`indexedDB`离线存储
     - `Storage.WEBSQL`: 使用`webSQL`离线存储
   - 驱动器的默认使用顺序变更：根据浏览器支持情况，优先选择`sessionStorage`，之后再根据`localforage`的默认值选择
   - `Storage`实例移除类似`localforage` API末尾的`callback`形参
   - `Storage.supports`方法作为静态方法成员，而不是像`localforage#supports`方法作为实例方法成员
   - `Storage`中不存在像`localforage#setDriver`、`localforage#createInstance`、`localforage#defineDriver`等API
   - `Storage#length`作为一个实例属性值，而不是像`localforage#length`作为一个异步方法
   - `Storage#getItem`方法取的值若不存在时，将进入`reject`，抛出`not found`，而不是返回`null`
   - 移除了`Storage#key`方法
  - 扩展支持的一些新的数据类型存储
  - 默认支持`localforage`支持的如下数据类型存储
      - `null`
      - `Number`
      - `String`
      - `Array`
      - `Object`
      - `Blob`
      - `ArrayBuffer`
      - `Float32Array`
      - `Float64Array`
      - `Int8Array`
      - `Int16Array`
      - `Int32Array`
      - `Uint8Array`
      - `Uint8ClampedArray`
      - `Uint16Array`
      - `Uint32Array`
  - 在此基础上又扩充了对如下数据类型的存储（因为在某些实际的使用场景中还是需要用的到，内部存储时将使用了如下格式进行存储）
      - `undefined` => `[storage undefined]#undefined`
      - `NaN` => `[storage nan]#NaN`
      - `Infinity` => `[storage infinity]#Infinity`
      - `-Infinity` => `[storage infinity]#-Infinity`
      - `new Date()` => `[storage date]#1507600033804`
      - `/regexp/g` => `[storage regexp]#/regexp/g`
      - `new RegExp('regexp', 'g')` => `[storage regexp]#/regexp/g`
      - `function(){}`` => `[storage function]#function(){}`
      - `new Function('a', 'b', 'return a+b')` => `[storage function]#function anonymous(){}`
  - 不对以下数据类型进行存储
      - `Symbol`
      - `Error`

## Install 安装

```bash
npm install -S @~lisfan/storage
```

## Usage 起步

```js
import storage,{Storage} from '@~lisfan/storage'

// 在存值或取值前确保实例已完全初始化完成
storage.ready().then(()=>{
  // 设置值
  storage.setItem('someKey','someData').then((data)=>{
    // 设置成功
  })

  // 设置值存活有效期10秒钟
  storage.setItem('someKey','someData',{maxAge:10*1000}).then((data)=>{
  })
})


// 自定义存储器实例
const storageOther = new Storage({
  name: 'storageOther'
})

// 获取值
storageOther.ready().then(()=>{
  storageOther.getItem('someKey').then((data)=>{
    // 取到了值
  }).catch((err)=>{
    // err 为 'notfound'
    // 值不存在
    // err 为 'outdated'
    // 值过期
  })
})
```