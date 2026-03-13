type CachedImageEntry = {
  url: string
  dataUrl: string
  savedAt: number
  lastAccessed: number
  size: number
}
/// fix for images 
// URL -> cached images, in case of expired links
const DB_NAME = "nekoimgs"
const DB_VERSION = 1
const STORE_NAME = "images"
const MAX_ENTRIES = 200

let dbPromise: Promise<IDBDatabase | null> | null = null

const openDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null)
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "url" })
          store.createIndex("lastAccessed", "lastAccessed")
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    })
  }

  return dbPromise
}

const pruneCache = async (db: IDBDatabase) => {
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const countReq = store.count()

    countReq.onsuccess = () => {
      const count = countReq.result
      if (count <= MAX_ENTRIES) {
        return
      }

      const excess = count - MAX_ENTRIES
      const index = store.index("lastAccessed")
      let removed = 0
      index.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
        if (!cursor || removed >= excess) return
        cursor.delete()
        removed += 1
        cursor.continue()
      }
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
}

export const getCachedImage = async (url: string): Promise<string | null> => {
  const db = await openDb()
  if (!db) return null

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(url)

    req.onsuccess = () => {
      const entry = req.result as CachedImageEntry | undefined
      if (!entry?.dataUrl) {
        resolve(null)
        return
      }
      const nextEntry: CachedImageEntry = {
        ...entry,
        lastAccessed: Date.now(),
      }
      store.put(nextEntry)
      resolve(entry.dataUrl)
    }

    req.onerror = () => resolve(null)
  })
}

export const setCachedImage = async (url: string, dataUrl: string): Promise<void> => {
  const db = await openDb()
  if (!db) return

  const now = Date.now()
  const entry: CachedImageEntry = {
    url,
    dataUrl,
    savedAt: now,
    lastAccessed: now,
    size: dataUrl.length,
  }

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })

  await pruneCache(db)
}
