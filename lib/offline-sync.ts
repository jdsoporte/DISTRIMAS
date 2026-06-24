// Baja los datos necesarios para trabajar sin senal y los guarda en el celular.
// Se llama cuando la app carga con senal.

import { supabase } from "./supabase"
import { guardarDato, leerPendientes, quitarPendiente } from "./offline-db"

const rel = (v: any) => Array.isArray(v) ? v[0] : v

async function traerTodo(tabla: string, columnas: string, filtro?: (q: any) => any) {
  const acumulado: any[] = []
  let desde = 0
  const TAM = 1000
  while (true) {
    let q = supabase.from(tabla).select(columnas).range(desde, desde + TAM - 1)
    if (filtro) q = filtro(q)
    const { data, error } = await q
    if (error || !data || data.length === 0) break
    acumulado.push(...data)
    if (data.length < TAM) break
    desde += TAM
  }
  return acumulado
}

export async function descargarParaOffline(userId: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false
  if (!userId) return false

  try {
    const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }))
    const diaCol = ahora.getDay()
    const quincena = ahora.getDate() <= 15 ? 1 : 2

    // Ruta asignada hoy
    const { data: asig } = await supabase.from("asignaciones_ruta")
      .select("ruta_id, descanso, ruta:rutas(nombre)")
      .eq("usuario_id", userId).eq("dia_semana", diaCol).eq("quincena", quincena).maybeSingle()

    // Clientes de la ruta del dia
    let clientes: any[] = []
    if (asig?.ruta_id) {
      clientes = await traerTodo(
        "clientes",
        "id, codigo, nombre, razon_social, nit, municipio, direccion, telefono, ruta_id",
        (q) => q.eq("ruta_id", asig.ruta_id).order("nombre")
      )
    }

    // Productos activos (con precio e IVA)
    const productos = await traerTodo(
      "productos",
      "id, codigo, nombre, unidad, precio, stock, iva, grupo, activo",
      (q) => q.eq("activo", true).order("nombre")
    )

    // Configuracion
    const { data: config } = await supabase.from("configuraciones").select("*").limit(1).maybeSingle()

    await guardarDato("ruta_dia", { ruta_id: asig?.ruta_id || null, descanso: !!asig?.descanso, nombre: rel(asig?.ruta)?.nombre || "" })
    await guardarDato("clientes", clientes)
    await guardarDato("productos", productos)
    await guardarDato("config", config || null)
    await guardarDato("ultima_sync", new Date().toISOString())

    return true
  } catch {
    return false
  }
}

// Envia a la nube los pedidos y visitas que se crearon sin senal.
// Es idempotente: si se reintenta, no duplica (usa el id generado en el celular).
export async function enviarPendientes(): Promise<number> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0
  const pendientes = await leerPendientes()
  let enviados = 0

  for (const p of pendientes) {
    try {
      if (p.tipo === "pedido") {
        const data = p.payload as { pedido: any; items: any[] }
        const { error: e1 } = await supabase.from("pedidos").upsert(data.pedido)
        if (e1) continue // se queda en la cola para reintentar luego
        await supabase.from("pedido_items").delete().eq("pedido_id", data.pedido.id)
        if (data.items && data.items.length > 0) {
          const filas = data.items.map((i) => ({ ...i, pedido_id: data.pedido.id }))
          const { error: e2 } = await supabase.from("pedido_items").insert(filas)
          if (e2) continue
        }
        await quitarPendiente(p.id)
        enviados++
      } else if (p.tipo === "visita") {
        const { error } = await supabase.from("visitas").upsert(p.payload as any, { onConflict: "cliente_id,usuario_id,fecha" })
        if (error) continue
        await quitarPendiente(p.id)
        enviados++
      } else if (p.tipo === "cierre") {
        const { error } = await supabase.from("cierres_ruta").upsert(p.payload as any, { onConflict: "usuario_id,fecha" })
        if (error) continue
        await quitarPendiente(p.id)
        enviados++
      }
    } catch {
      // Si algo falla, se queda en la cola y se reintenta en la proxima sincronizacion
    }
  }
  return enviados
}
