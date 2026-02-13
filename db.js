/**
 * PFFP_DB - IndexedDB Manager + Sync Queue
 */
var PFFP_DB = (function () {
    var DB_NAME = 'PFFP_OfflineDB';
    var DB_VERSION = 2;
    var db = null;

    var STORES = {
        'farmers':                { keyPath: 'Farmer_ID' },
        'plots':                  { keyPath: 'Plot_Id' },
        'yearly_data':            { keyPath: 'Record_Id' },
        'users':                  { keyPath: null, keyCol: 'Staff ID' },
        'admin':                  { keyPath: 'Adm_ID' },
        'drop_values':            { keyPath: 'ID' },
        'species':                { keyPath: 'Species_ID' },
        'training_list':          { keyPath: 'Train_ID' },
        'sync_queue':             { keyPath: 'id', autoIncrement: true },
        'meta':                   { keyPath: 'key' }
    };

    var TABLE_TO_DATA_KEY = {
        'farmers':       'farmers',
        'plots':         'plots',
        'yearly_data':   'yearly',
        'users':         'user',
        'admin':         'admin',
        'drop_values':   'drop',
        'species':       'species',
        'training_list': 'trainingList'
    };

    function initDB() {
        return new Promise(function (resolve, reject) {
            if (db) { resolve(db); return; }
            var request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = function (e) {
                var database = e.target.result;
                // Clean up old stores on version upgrade
                var existing = Array.prototype.slice.call(database.objectStoreNames);
                existing.forEach(function (name) {
                    if (!STORES[name]) database.deleteObjectStore(name);
                });
                Object.keys(STORES).forEach(function (storeName) {
                    if (database.objectStoreNames.contains(storeName)) {
                        database.deleteObjectStore(storeName);
                    }
                    var cfg = STORES[storeName];
                    var opts = {};
                    if (cfg.keyPath) opts.keyPath = cfg.keyPath;
                    if (cfg.autoIncrement) opts.autoIncrement = true;
                    database.createObjectStore(storeName, opts);
                });
            };
            request.onsuccess = function (e) {
                db = e.target.result;
                console.log('IndexedDB opened:', DB_NAME);
                resolve(db);
            };
            request.onerror = function (e) {
                console.error('IndexedDB error:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    function saveAllToLocal(data) {
        return initDB().then(function (database) {
            var storeNames = Object.keys(TABLE_TO_DATA_KEY);
            var tx = database.transaction(storeNames.concat(['meta']), 'readwrite');
            storeNames.forEach(function (tableName) {
                var dataKey = TABLE_TO_DATA_KEY[tableName];
                var items = data[dataKey];
                if (items && items.length > 0) {
                    var store = tx.objectStore(tableName);
                    var cfg = STORES[tableName];
                    store.clear();
                    items.forEach(function (item) {
                        try {
                            if (cfg.keyPath) {
                                store.put(item);
                            } else if (cfg.keyCol && item[cfg.keyCol]) {
                                store.put(item, item[cfg.keyCol]);
                            }
                        } catch (e) { /* skip invalid */ }
                    });
                }
            });
            var metaStore = tx.objectStore('meta');
            metaStore.put({ key: 'lastSync', value: Date.now() });
            return new Promise(function (resolve, reject) {
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        });
    }

    function loadAllFromLocal() {
        return initDB().then(function (database) {
            var storeNames = Object.keys(TABLE_TO_DATA_KEY);
            var result = {};
            var promises = storeNames.map(function (tableName) {
                return new Promise(function (resolve, reject) {
                    var tx = database.transaction(tableName, 'readonly');
                    var store = tx.objectStore(tableName);
                    var req = store.getAll();
                    req.onsuccess = function () {
                        var dataKey = TABLE_TO_DATA_KEY[tableName];
                        result[dataKey] = req.result || [];
                        resolve();
                    };
                    req.onerror = function () { reject(req.error); };
                });
            });
            return Promise.all(promises).then(function () { return result; });
        });
    }

    function saveToLocal(tableName, record) {
        return initDB().then(function (database) {
            return new Promise(function (resolve, reject) {
                var tx = database.transaction(tableName, 'readwrite');
                var store = tx.objectStore(tableName);
                var cfg = STORES[tableName];
                if (cfg && !cfg.keyPath && cfg.keyCol && record[cfg.keyCol]) {
                    store.put(record, record[cfg.keyCol]);
                } else {
                    store.put(record);
                }
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        });
    }

    function deleteFromLocal(tableName, id) {
        return initDB().then(function (database) {
            return new Promise(function (resolve, reject) {
                var tx = database.transaction(tableName, 'readwrite');
                var store = tx.objectStore(tableName);
                store.delete(id);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        });
    }

    function addToSyncQueue(action) {
        action.timestamp = Date.now();
        return initDB().then(function (database) {
            return new Promise(function (resolve, reject) {
                var tx = database.transaction('sync_queue', 'readwrite');
                var store = tx.objectStore('sync_queue');
                store.add(action);
                tx.oncomplete = function () {
                    console.log('Added to sync queue:', action.action, action.table);
                    resolve();
                };
                tx.onerror = function () { reject(tx.error); };
            });
        });
    }

    function getSyncQueueCount() {
        return initDB().then(function (database) {
            return new Promise(function (resolve, reject) {
                var tx = database.transaction('sync_queue', 'readonly');
                var store = tx.objectStore('sync_queue');
                var req = store.count();
                req.onsuccess = function () { resolve(req.result); };
                req.onerror = function () { reject(req.error); };
            });
        });
    }

    function processSyncQueue(supabaseClient) {
        return initDB().then(function (database) {
            return new Promise(function (resolve, reject) {
                var tx = database.transaction('sync_queue', 'readonly');
                var store = tx.objectStore('sync_queue');
                var req = store.getAll();
                req.onsuccess = function () {
                    var queue = req.result || [];
                    if (queue.length === 0) { resolve({ synced: 0 }); return; }
                    console.log('Processing sync queue:', queue.length, 'items');
                    var synced = 0; var errors = 0;
                    function processNext(index) {
                        if (index >= queue.length) { resolve({ synced: synced, errors: errors }); return; }
                        var item = queue[index];
                        var promise;
                        if (item.action === 'upsert' && item.data) {
                            promise = supabaseClient.from(item.table).upsert(item.data, { onConflict: item.idCol });
                        } else if (item.action === 'delete' && item.id) {
                            promise = supabaseClient.from(item.table).delete().eq(item.idCol, item.id);
                        } else {
                            removeFromQueue(item.id).then(function () { processNext(index + 1); });
                            return;
                        }
                        promise.then(function (res) {
                            if (res.error) { errors++; } else { synced++; }
                            removeFromQueue(item.id).then(function () { processNext(index + 1); });
                        }).catch(function () { errors++; processNext(index + 1); });
                    }
                    processNext(0);
                };
                req.onerror = function () { reject(req.error); };
            });
        });
    }

    function removeFromQueue(id) {
        return initDB().then(function (database) {
            return new Promise(function (resolve, reject) {
                var tx = database.transaction('sync_queue', 'readwrite');
                var store = tx.objectStore('sync_queue');
                store.delete(id);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        });
    }

    function getLastSyncTime() {
        return initDB().then(function (database) {
            return new Promise(function (resolve, reject) {
                var tx = database.transaction('meta', 'readonly');
                var store = tx.objectStore('meta');
                var req = store.get('lastSync');
                req.onsuccess = function () { resolve(req.result ? req.result.value : null); };
                req.onerror = function () { reject(req.error); };
            });
        });
    }

    initDB().catch(function (err) { console.warn('IndexedDB init deferred:', err); });

    return {
        initDB: initDB,
        saveAllToLocal: saveAllToLocal,
        loadAllFromLocal: loadAllFromLocal,
        saveToLocal: saveToLocal,
        deleteFromLocal: deleteFromLocal,
        addToSyncQueue: addToSyncQueue,
        getSyncQueueCount: getSyncQueueCount,
        processSyncQueue: processSyncQueue,
        getLastSyncTime: getLastSyncTime
    };
})();
