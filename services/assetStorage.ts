

export interface StoredAsset {
  id: string;
  type: 'video' | 'audio' | 'image';
  blob: Blob;
  createdAt: Date;
  name?: string;
}

export const assetStorage = {
  dbName: 'ViralVideoDB',
  storeName: 'assets',
  version: 1,

  async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  },

  async saveAsset(type: 'video' | 'audio' | 'image', blob: Blob, name?: string): Promise<string> {
    const db = await this.getDB();
    // ID format: asset://type_timestamp_random
    const timestamp = Date.now();
    const id = `asset://${type}_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Store metadata along with blob
    const record = {
      blob,
      name,
      createdAt: timestamp
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(record, id);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  },

  async getAsset(id: string): Promise<Blob | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(undefined);
          return;
        }
        // Handle both legacy Blob format and new object format
        if (result instanceof Blob) {
           resolve(result);
        } else if (result.blob instanceof Blob) {
           resolve(result.blob);
        } else {
           resolve(undefined);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  async listAssets(): Promise<StoredAsset[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      // Use cursor to get keys and values
      const request = store.openCursor();
      const assets: StoredAsset[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const id = cursor.key as string;
          const value = cursor.value;
          
          // Parse metadata from ID
          // asset://type_timestamp_random
          const parts = id.replace('asset://', '').split('_');
          const type = parts[0] as 'video' | 'audio' | 'image';
          const timestampFromId = parseInt(parts[1]);

          let blob: Blob;
          let createdAt: Date;
          let name: string | undefined;

          if (value instanceof Blob) {
            blob = value;
            createdAt = new Date(timestampFromId);
          } else {
            blob = value.blob;
            name = value.name;
            createdAt = new Date(value.createdAt || timestampFromId);
          }

          if (blob instanceof Blob) {
            assets.push({
              id,
              type,
              blob,
              createdAt,
              name
            });
          }
          cursor.continue();
        } else {
          // Sort by newest first
          resolve(assets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  async deleteAsset(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};