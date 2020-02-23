const deep = require('deep-get-set');
const objectPath = require('object-path');
const flatten = require('flat');
const clone = require('clone');
const isEqual = require('lodash.isequal');
const storageManager = require('@hkube/storage-manager');

class StorageAdapter {
    init(options) {
        this.enableCache = options.enableCache;
        this.storageCache = Object.create(null);
        this.oldStorage = null;
    }

    async input(input, storage, tracerStart) {
        const result = clone(input);
        const flatObj = flatten(input);
        if (!this.isStorageEqual(storage, this.oldStorage)) {
            this.storageCache = Object.create(null);
        }
        this.oldStorage = storage;

        const promiseDataExtractors = Object.entries(flatObj).map(async ([objPath, value]) => {
            if (typeof value === 'string' && value.startsWith('$$')) {
                const key = value.substring(2);
                const link = storage[key];
                let data = null;
                if (Array.isArray(link.storageInfo)) {
                    data = await Promise.all(link.storageInfo.map(a => a && this.wrappedGetFromStorage(a, tracerStart)));
                    if (link.path) {
                        data = data.map(d => deep(d, link.path));
                    }
                }
                else {
                    data = await this.wrappedGetFromStorage(link.storageInfo, tracerStart);
                    if (link.path) {
                        data = deep(data, link.path);
                    }
                    if (Number.isInteger(link.index)) {
                        data = data[link.index];
                    }
                }
                deep(result, objPath, data);
            }
        });

        await Promise.all(promiseDataExtractors);
        return result;
    }

    async output(options) {
        const { output, jobId, taskId } = options;
        const data = output === undefined ? null : output;
        const result = await storageManager.hkube.put({ jobId, taskId, data });
        return result;
    }

    createStoragePath(options) {
        const { jobId, taskId } = options;
        return storageManager.hkube.createPath({ jobId, taskId });
    }

    createMetadata({ nodeName, data, savePaths }) {
        const object = { [nodeName]: data };
        const paths = savePaths || [];
        const metadata = Object.create(null);
        paths.forEach((p) => {
            const value = objectPath.get(object, p, 'DEFAULT');
            if (value !== 'DEFAULT') {
                this._setMetadata(value, p, metadata);
            }
        });
        return metadata;
    }

    _setMetadata(value, path, metadata) {
        metadata[path] = Array.isArray(value)
            ? { type: 'array', size: value.length }
            : { type: typeof (value) };
    }

    async wrappedGetFromStorage(info, trace) {
        if (this.enableCache) {
            const cached = this.storageCache[info.path];
            if (cached) {
                return cached;
            }
        }
        const data = await storageManager.get(info, trace);
        if (this.enableCache) {
            this.storageCache[info.path] = data;
        }
        return data;
    }

    isStorageEqual(storage1, storage2) {
        if (storage1 && storage2) {
            const links1 = Object.values(storage1).map(s => s.storageInfo.path).sort();
            const links2 = Object.values(storage2).map(s => s.storageInfo.path).sort();
            return isEqual(links1, links2);
        }

        return storage1 === storage2;
    }
}

module.exports = new StorageAdapter();
