// File: /src/lib/videoStorage.ts

const DB_NAME = 'FamilyStreamVideoDB';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment.'));
  }

  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event: any) => {
        dbInstance = event.target.result;
        resolve(dbInstance!);
      };

      request.onerror = (event: any) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    } catch (e) {
      reject(e);
    }
  });
}

// Active Object URLs to revoke on cleanup or tab close
const activeObjectUrls = new Map<string, string>();

// Robust in-memory cache to solve any race conditions, latency, or sandboxed iframe storage limitations
const memoryCache = new Map<string, Blob>();

export const videoStorage = {
  /**
   * Save a video file/Blob directly to IndexedDB.
   */
  async saveVideo(mediaIdOrEpisodeId: string, file: Blob): Promise<void> {
    // Always store in memory cache first as instant fallback/cache
    memoryCache.set(mediaIdOrEpisodeId, file);

    try {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const request = store.put(file, mediaIdOrEpisodeId);

        tx.oncomplete = () => {
          // Revoke any existing object URL for this ID
          if (activeObjectUrls.has(mediaIdOrEpisodeId)) {
            URL.revokeObjectURL(activeObjectUrls.get(mediaIdOrEpisodeId)!);
            activeObjectUrls.delete(mediaIdOrEpisodeId);
          }
          resolve();
        };

        tx.onerror = (event: any) => {
          reject(tx.error || event.target.error);
        };

        request.onerror = (event: any) => {
          reject(event.target.error);
        };
      });
    } catch (err) {
      console.warn(`IndexedDB saveVideo failed, continuing with in-memory cache for ${mediaIdOrEpisodeId}:`, err);
    }
  },

  /**
   * Retrieve a stored video blob.
   */
  async getVideo(id: string): Promise<Blob | null> {
    // Check memory cache first (instant & guarantees retrieval even if indexedDB transaction isn't committed or is disabled)
    if (memoryCache.has(id)) {
      return memoryCache.get(id) || null;
    }

    try {
      const db = await getDB();
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = (event: any) => {
          reject(event.target.error);
        };
      });

      if (blob) {
        // Cache it in memory for future fast lookups
        memoryCache.set(id, blob);
      }
      return blob;
    } catch (err) {
      console.warn(`IndexedDB getVideo failed for ${id}:`, err);
      return null;
    }
  },

  /**
   * Delete a stored video.
   */
  async deleteVideo(id: string): Promise<void> {
    memoryCache.delete(id);

    try {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);

        tx.oncomplete = () => {
          if (activeObjectUrls.has(id)) {
            URL.revokeObjectURL(activeObjectUrls.get(id)!);
            activeObjectUrls.delete(id);
          }
          resolve();
        };

        tx.onerror = (event: any) => {
          reject(tx.error || event.target.error);
        };

        request.onerror = (event: any) => {
          reject(event.target.error);
        };
      });
    } catch (err) {
      console.warn(`IndexedDB deleteVideo failed for ${id}:`, err);
    }
  },

  /**
   * Check if a video exists in the DB.
   */
  async hasVideo(id: string): Promise<boolean> {
    if (memoryCache.has(id)) {
      return true;
    }
    const video = await this.getVideo(id);
    return video !== null;
  },

  /**
   * Generate (or return cached) URL for playing the video.
   * Standard URL or blob URL.
   */
  async getPlayableUrl(id: string, fallbackUrl?: string): Promise<string> {
    try {
      const blob = await this.getVideo(id);
      if (blob) {
        // If we already have a generated URL, reuse or update it
        if (activeObjectUrls.has(id)) {
          return activeObjectUrls.get(id)!;
        }
        const objectUrl = URL.createObjectURL(blob);
        activeObjectUrls.set(id, objectUrl);
        return objectUrl;
      }
    } catch (err) {
      console.warn(`Failed to retrieve video Blob from IndexedDB/Memory for ${id}:`, err);
    }
    return fallbackUrl || '';
  }
};
