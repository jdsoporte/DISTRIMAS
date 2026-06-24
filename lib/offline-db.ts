// Motor de almacenamiento local del celular (IndexedDB).
// Guarda datos para leer sin senal (clientes, productos, etc.)
// y una cola de "pendientes" (pedidos/visitas creados sin senal).
// Todo corre solo en el navegador; en el servidor no hace nada.

const DB_NAME = "distrimas-offline"
const DB_VERSION = 1

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      reject(new Error("Almacenamiento local no disponible"))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains("datos")) db.createObjectStore("datos")
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ----- Datos para lectura offline (clave -> valor) -----
export async function guardarDato(clave: string, valor: unknown): Promise<boolean> {
  try {
    const db = await abrir()
    return await new Promise((resolve) => {
      const tx = db.transaction("datos", "readwrite")
      tx.objectStore("datos").put(valor, clave)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch { return false }
}

export async function leerDato<T>(clave: string): Promise<T | null> {
  try {
    const db = await abrir()
    return await new Promise((resolve) => {
      const tx = db.transaction("datos", "readonly")
      const req = tx.objectStore("datos").get(clave)
      req.onsuccess = () => resolve((req.result as T) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch { return null }
}

// ----- Cola de pendientes (outbox) -----
export interface Pendiente {
  id: string          // uuid generado en el celular (para no duplicar al enviar)
  tipo: "pedido" | "visita" | "cierre" | "ubicacion"
  payload: unknown    // datos a enviar
  creado: string      // fecha ISO
}

export async function agregarPendiente(item: Pendiente): Promise<boolean> {
  try {
    const db = await abrir()
    return await new Promise((resolve) => {
      const tx = db.transaction("outbox", "readwrite")
      tx.objectStore("outbox").put(item)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch { return false }
}

export async function leerPendientes(): Promise<Pendiente[]> {
  try {
    const db = await abrir()
    return await new Promise((resolve) => {
      const tx = db.transaction("outbox", "readonly")
      const req = tx.objectStore("outbox").getAll()
      req.onsuccess = () => resolve((req.result as Pendiente[]) || [])
      req.onerror = () => resolve([])
    })
  } catch { return [] }
}

export async function quitarPendiente(id: string): Promise<boolean> {
  try {
    const db = await abrir()
    return await new Promise((resolve) => {
      const tx = db.transaction("outbox", "readwrite")
      tx.objectStore("outbox").delete(id)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch { return false }
}

export async function contarPendientes(): Promise<number> {
  const p = await leerPendientes()
  return p.length
}
