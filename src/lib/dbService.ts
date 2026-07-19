import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  increment 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth, isFirebaseEnabled } from './firebase';
import { MediaItem, AppConfig, UserAccount, Profile, PlaybackHistory, CustomList } from '../types';
import { DEFAULT_MEDIA_ITEMS } from '../data/defaultMedia';

export function deduplicateHistory(history: PlaybackHistory[]): PlaybackHistory[] {
  if (!history || !Array.isArray(history)) return [];
  const seen = new Set<string>();
  return history.filter(h => {
    // Treat undefined, null, and empty string episode IDs the same
    const epId = h.episodeId || '';
    const key = `${h.mediaId}-${epId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Local storage keys
const LOCAL_USERS_KEY = 'familystream_users';
const LOCAL_CURRENT_USER_ID = 'familystream_current_uid';
const LOCAL_MEDIA_ITEMS_KEY = 'familystream_media';
const LOCAL_CONFIG_KEY = 'familystream_config';

const DEFAULT_CATEGORIES = ['Filmes', 'Séries', 'Documentários', 'Vídeos da família', 'Infantil', 'Música', 'Outros'];

const DEFAULT_CONFIG: AppConfig = {
  platformName: 'FamilyStream',
  primaryColor: '#E50914', // Classic streaming red
  defaultTheme: 'dark',
  language: 'pt-BR',
  storageProvider: 'local',
  categories: DEFAULT_CATEGORIES
};

// Help initialize default local items if they don't exist
function getLocalMediaItems(): MediaItem[] {
  const local = localStorage.getItem(LOCAL_MEDIA_ITEMS_KEY);
  if (!local) {
    localStorage.setItem(LOCAL_MEDIA_ITEMS_KEY, JSON.stringify(DEFAULT_MEDIA_ITEMS));
    return DEFAULT_MEDIA_ITEMS;
  }
  return JSON.parse(local);
}

function saveLocalMediaItems(items: MediaItem[]) {
  localStorage.setItem(LOCAL_MEDIA_ITEMS_KEY, JSON.stringify(items));
}

// Check local storage for configs
function getLocalConfig(): AppConfig {
  const local = localStorage.getItem(LOCAL_CONFIG_KEY);
  if (!local) {
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG));
    return DEFAULT_CONFIG;
  }
  const parsed = JSON.parse(local) as AppConfig;
  if (!parsed.categories) {
    parsed.categories = DEFAULT_CATEGORIES;
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(parsed));
  }
  return parsed;
}

function saveLocalConfig(config: AppConfig) {
  localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
}

// Helper to recursively strip undefined values before saving to Firestore, as Firestore setDoc throws on undefined
function cleanObjectForFirestore<T>(obj: T): T {
  const clean = (val: any): any => {
    if (val === null || val === undefined) {
      return null;
    }
    if (Array.isArray(val)) {
      return val.map(clean);
    }
    if (typeof val === 'object') {
      const cleanedObj: any = {};
      for (const key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key) && val[key] !== undefined) {
          cleanedObj[key] = clean(val[key]);
        }
      }
      return cleanedObj;
    }
    return val;
  };
  return clean(obj) as T;
}

export const dbService = {
  // CONFIGURATIONS
  async getConfig(): Promise<AppConfig> {
    if (isFirebaseEnabled && db) {
      try {
        const configRef = doc(db, 'settings', 'global_config');
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          const data = snap.data() as AppConfig;
          if (!data.categories) {
            data.categories = DEFAULT_CATEGORIES;
          }
          return data;
        } else {
          // Initialize in firestore
          const conf = getLocalConfig();
          await setDoc(configRef, cleanObjectForFirestore(conf));
          return conf;
        }
      } catch (err) {
        console.warn('Firestore config fetch failed, using local.', err);
      }
    }
    return getLocalConfig();
  },

  async saveConfig(config: AppConfig): Promise<void> {
    saveLocalConfig(config);
    if (isFirebaseEnabled && db) {
      try {
        const configRef = doc(db, 'settings', 'global_config');
        await setDoc(configRef, cleanObjectForFirestore(config), { merge: true });
      } catch (err) {
        console.error('Failed to save config to Firestore:', err);
      }
    }
  },

  // MEDIA ITEMS (VIDEOS)
  async getMediaItems(): Promise<MediaItem[]> {
    const defaultIdsToPurge = [
      'sintel-2010', 'big-buck-bunny', 'tears-of-steel', 
      'natal-familia-2025', 'ferias-praia-2025', 'as-aventuras-dos-primos', 
      'documentario-vida-selvagem', 'pocket-show-rock-2025'
    ];

    // Clean up local storage from defaults
    const local = localStorage.getItem(LOCAL_MEDIA_ITEMS_KEY);
    if (local) {
      try {
        let parsed = JSON.parse(local) as MediaItem[];
        const hasDefaults = parsed.some(item => defaultIdsToPurge.includes(item.id));
        if (hasDefaults) {
          parsed = parsed.filter(item => !defaultIdsToPurge.includes(item.id));
          localStorage.setItem(LOCAL_MEDIA_ITEMS_KEY, JSON.stringify(parsed));
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (isFirebaseEnabled && db) {
      try {
        const colRef = collection(db, 'videos');
        const snap = await getDocs(colRef);
        const items: MediaItem[] = [];
        
        if (!snap.empty) {
          for (const docSnap of snap.docs) {
            const id = docSnap.id;
            if (defaultIdsToPurge.includes(id)) {
              // Purge from Firestore
              try {
                await deleteDoc(doc(db, 'videos', id));
              } catch (delErr) {
                console.error(`Failed to delete default video ${id} from Firestore:`, delErr);
              }
            } else {
              items.push({ id, ...docSnap.data() } as MediaItem);
            }
          }
          return items;
        } else {
          // Empty DB, defaults is empty as well
          const defaults = getLocalMediaItems();
          const cleanDefaults = defaults.filter(item => !defaultIdsToPurge.includes(item.id));
          for (const item of cleanDefaults) {
            await setDoc(doc(db, 'videos', item.id), cleanObjectForFirestore(item));
          }
          return cleanDefaults;
        }
      } catch (err) {
        console.warn('Firestore videos fetch failed, using local.', err);
      }
    }
    
    return getLocalMediaItems().filter(item => !defaultIdsToPurge.includes(item.id));
  },

  async saveMediaItem(item: MediaItem): Promise<void> {
    const items = getLocalMediaItems();
    const index = items.findIndex(i => i.id === item.id);
    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }
    saveLocalMediaItems(items);

    if (isFirebaseEnabled && db) {
      try {
        await setDoc(doc(db, 'videos', item.id), cleanObjectForFirestore(item), { merge: true });
      } catch (err) {
        console.error('Failed to save media to Firestore:', err);
      }
    }
  },

  async deleteMediaItem(id: string): Promise<void> {
    const items = getLocalMediaItems().filter(i => i.id !== id);
    saveLocalMediaItems(items);

    if (isFirebaseEnabled && db) {
      try {
        await deleteDoc(doc(db, 'videos', id));
      } catch (err) {
        console.error('Failed to delete media from Firestore:', err);
      }
    }
  },

  async incrementViews(id: string): Promise<void> {
    const items = getLocalMediaItems();
    const item = items.find(i => i.id === id);
    if (item) {
      item.views = (item.views || 0) + 1;
      saveLocalMediaItems(items);
    }

    if (isFirebaseEnabled && db) {
      try {
        await updateDoc(doc(db, 'videos', id), {
          views: increment(1)
        });
      } catch (err) {
        console.error('Failed to increment views in Firestore:', err);
      }
    }
  },

  // USER ACCOUNTS
  async getUserAccount(uid: string): Promise<UserAccount | null> {
    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'users', uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as UserAccount;
          if (data && data.email && data.email.toLowerCase() === 'jadsoncutrim10@gmail.com' && data.role !== 'admin') {
            data.role = 'admin';
            await setDoc(docRef, { role: 'admin' }, { merge: true });
          }
          if (data && data.history) {
            data.history = deduplicateHistory(data.history);
          }
          return data;
        }
      } catch (err) {
        console.error('Failed to fetch user from Firestore:', err);
      }
    }

    // Local Storage fallback
    const localUsers = localStorage.getItem(LOCAL_USERS_KEY);
    if (localUsers) {
      const users: UserAccount[] = JSON.parse(localUsers);
      const matched = users.find(u => u.uid === uid) || null;
      if (matched && matched.email && matched.email.toLowerCase() === 'jadsoncutrim10@gmail.com' && matched.role !== 'admin') {
        matched.role = 'admin';
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
      }
      if (matched && matched.history) {
        matched.history = deduplicateHistory(matched.history);
      }
      return matched;
    }
    return null;
  },

  async saveUserAccount(user: UserAccount, skipRemote: boolean = false): Promise<void> {
    if (user.email && user.email.toLowerCase() === 'jadsoncutrim10@gmail.com') {
      user.role = 'admin';
    }
    
    if (user.history) {
      user.history = deduplicateHistory(user.history);
    }
    
    // Save locally
    const localUsersStr = localStorage.getItem(LOCAL_USERS_KEY);
    let users: UserAccount[] = localUsersStr ? JSON.parse(localUsersStr) : [];
    const index = users.findIndex(u => u.uid === user.uid);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));

    if (!skipRemote && isFirebaseEnabled && db) {
      try {
        await setDoc(doc(db, 'users', user.uid), cleanObjectForFirestore(user), { merge: true });
      } catch (err) {
        console.error('Failed to save user account to Firestore:', err);
      }
    }
  },

  // AUTH STATE LISTENER
  subscribeToAuth(callback: (user: FirebaseUser | null) => void) {
    if (isFirebaseEnabled && auth) {
      return onAuthStateChanged(auth, callback);
    } else {
      // Offline/Local Auth Simulation polling or event
      const checkLocalAuth = () => {
        const currentUid = localStorage.getItem(LOCAL_CURRENT_USER_ID);
        if (currentUid) {
          const localUsersStr = localStorage.getItem(LOCAL_USERS_KEY);
          const users: UserAccount[] = localUsersStr ? JSON.parse(localUsersStr) : [];
          const matched = users.find(u => u.uid === currentUid);
          if (matched) {
            callback({
              uid: matched.uid,
              email: matched.email,
              emailVerified: true,
            } as any);
            return;
          }
        }
        callback(null);
      };

      // Poll periodically/trigger immediately
      setTimeout(checkLocalAuth, 100);
      window.addEventListener('storage', checkLocalAuth);
      return () => {
        window.removeEventListener('storage', checkLocalAuth);
      };
    }
  }
};
