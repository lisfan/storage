let getSerializerPromiseCache;
function getSerializerPromise(localForageInstance) {
  if (getSerializerPromiseCache) {
    return getSerializerPromiseCache;
  }
  if (!localForageInstance ||
      typeof localForageInstance.getSerializer !== 'function') {
    return Promise.reject(new Error('localforage.getSerializer() was not available! ' +
        'localforage v1.4+ is required!'));
  }
  getSerializerPromiseCache = localForageInstance.getSerializer();
  return getSerializerPromiseCache;
}
function getCallback() {
  if (arguments.length &&
      typeof arguments[arguments.length - 1] === 'function') {
    return arguments[arguments.length - 1];
  }
}
function executeCallback(promise, callback) {
  if (callback) {
    promise.then(function (result) {
      callback(null, result);
    }, function (error) {
      callback(error);
    });
  }
  return promise;
}
function isSessionStorageValid() {
  try {
    return (typeof sessionStorage !== 'undefined' &&
        'setItem' in sessionStorage &&
        !!sessionStorage.setItem);
  }
  catch (e) {
    return false;
  }
}
function normalizeKey(key) {
  if (typeof key !== 'string') {
    console.warn(`${key} used as a key, but it is not a string.`);
    key = String(key);
  }
  return key;
}

function _getKeyPrefix(options, defaultConfig) {
  let keyPrefix = options.name + '/';
  if (options.storeName !== defaultConfig.storeName) {
    keyPrefix += options.storeName + '/';
  }
  return keyPrefix;
}
function checkIfStorageThrows(storage) {
  const storageTestKey = '_localforage_support_test';
  try {
    storage.setItem(storageTestKey, 'true');
    storage.removeItem(storageTestKey);
    return false;
  }
  catch (e) {
    return true;
  }
}
function _isStorageUsable(storage) {
  return !checkIfStorageThrows(storage) || storage.length > 0;
}
function _initStorage(options = {}) {
  const dbInfo = Object.assign({}, options, { db: sessionStorage, keyPrefix: _getKeyPrefix(options, this._defaultConfig) });
  if (!_isStorageUsable(dbInfo.db)) {
    return Promise.reject();
  }
  this._dbInfo = dbInfo;
  return getSerializerPromise(this).then(serializer => {
    dbInfo.serializer = serializer;
});
}
function clear(callback) {
  const promise = this.ready().then(() => {
    const { db: store, keyPrefix } = this._dbInfo;
  for (let i = store.length - 1; i >= 0; i--) {
    const key = store.key(i) || '';
    if (key.indexOf(keyPrefix) === 0) {
      store.removeItem(key);
    }
  }
});
  executeCallback(promise, callback);
  return promise;
}
function getItem(key, callback) {
  key = normalizeKey(key);
  const promise = this.ready().then(() => {
    const { db: store, keyPrefix, serializer } = this._dbInfo;
  const result = store.getItem(keyPrefix + key);
  if (!result) {
    return result;
  }
  return serializer.deserialize(result);
});
  executeCallback(promise, callback);
  return promise;
}
function iterate(iterator, callback) {
  const promise = this.ready().then(() => {
    const { db: store, keyPrefix, serializer } = this._dbInfo;
  const keyPrefixLength = keyPrefix.length;
  const length = store.length;
  let iterationNumber = 1;
  for (let i = 0; i < length; i++) {
    const key = store.key(i) || '';
    if (key.indexOf(keyPrefix) !== 0) {
      continue;
    }
    const storeValue = store.getItem(key);
    const value = storeValue
        ? serializer.deserialize(storeValue)
        : null;
    const iteratorResult = iterator(value, key.substring(keyPrefixLength), iterationNumber++);
    if (iteratorResult !== void 0) {
      return iteratorResult;
    }
  }
});
  executeCallback(promise, callback);
  return promise;
}
function key(keyIndex, callback) {
  const promise = this.ready().then(() => {
    const { db: store, keyPrefix } = this._dbInfo;
  let result;
  try {
    result = store.key(keyIndex) || null;
  }
  catch (error) {
    result = null;
  }
  if (!result) {
    return result;
  }
  return result.substring(keyPrefix.length);
});
  executeCallback(promise, callback);
  return promise;
}
function keys(callback) {
  const promise = this.ready().then(() => {
    const { db: store, keyPrefix } = this._dbInfo;
  const length = store.length;
  const keys = [];
  for (let i = 0; i < length; i++) {
    const itemKey = store.key(i) || '';
    if (itemKey.indexOf(keyPrefix) === 0) {
      keys.push(itemKey.substring(keyPrefix.length));
    }
  }
  return keys;
});
  executeCallback(promise, callback);
  return promise;
}
function length(callback) {
  const promise = this.keys().then(keys => keys.length);
  executeCallback(promise, callback);
  return promise;
}
function removeItem(key, callback) {
  key = normalizeKey(key);
  const promise = this.ready().then(() => {
    const { db: store, keyPrefix } = this._dbInfo;
  store.removeItem(keyPrefix + key);
});
  executeCallback(promise, callback);
  return promise;
}
function setItem(key, value, callback) {
  key = normalizeKey(key);
  const promise = this.ready().then(() => {
    if (value === undefined) {
    value = null;
  }
  const originalValue = value;
  const { db: store, keyPrefix, serializer } = this._dbInfo;
  return new Promise((resolve, reject) => {
    serializer.serialize(value, (value, error) => {
      if (error) {
        reject(error);
        return;
      }
      try {
        store.setItem(keyPrefix + key, value);
  resolve(originalValue);
}
catch (e) {
    if (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      reject(e);
    }
    reject(e);
  }
});
});
});
  executeCallback(promise, callback);
  return promise;
}
function dropInstance(dbInstanceOptions, callback) {
  callback = getCallback.apply(this, arguments);
  const options = (typeof dbInstanceOptions !== 'function' && dbInstanceOptions) || {};
  if (!options.name) {
    const currentConfig = this.config();
    options.name = options.name || currentConfig.name;
    options.storeName = options.storeName || currentConfig.storeName;
  }
  let promise;
  if (!options.name) {
    promise = Promise.reject('Invalid arguments');
  }
  else {
    try {
      const keyPrefix = !options.storeName
          ? `${options.name}/`
          : _getKeyPrefix(options, this._defaultConfig);
      const { db: store } = this._dbInfo;
      for (let i = store.length - 1; i >= 0; i--) {
        const key = store.key(i) || '';
        if (key.indexOf(keyPrefix) === 0) {
          store.removeItem(key);
        }
      }
      promise = Promise.resolve();
    }
    catch (e) {
      promise = Promise.reject(e);
    }
  }
  executeCallback(promise, callback);
  return promise;
}
const sessionStorageWrapper = {
  _driver: 'sessionStorageWrapper',
  _initStorage,
  _support: isSessionStorageValid(),
  iterate,
  getItem,
  setItem,
  removeItem,
  clear,
  length,
  key,
  keys,
  dropInstance,
};

export default sessionStorageWrapper;
