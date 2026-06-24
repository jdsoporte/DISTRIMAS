// Baja los datos necesarios para trabajar sin senal y los guarda en el celular.
// Se llama cuando la app carga con senal.

import { supabase } from "./supabase"
import { guardarDato } from "./offline-db"

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
        
