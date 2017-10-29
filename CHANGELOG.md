# CHANGELOG 更新日志

## v1.1.0-rc
### 2017.10.29
- [remove] 移除了key方法
- [remove] 移除了updateItem方法，使用API的数量更接近原生
- [feature] 时效性为0的数据不存储
- [refactor] 修改DateItem类，更改$timeStamp实例属性的逻辑
- [refactor] 修改iterate()方法的逻辑，过滤掉已失效数据
- [refactor] 存储实例的数据映射表的localforage也选择了与实例同样配置参数的driver

## v1.0.0-rc
### 2017.10.20
- 代码迁移 && 代码分割
- [optimize] DataItem 类优化

### 2017.10.14
- [refactor] 初始构建
