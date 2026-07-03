"use client"
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Producto } from "@/lib/types"
import { useTheme } from "@/lib/theme-context"
import { getSession } from "@/lib/auth"
import * as XLSX from "xlsx"

const EMPTY: Partial<Producto> = { codigo: "", nombre: "", descripcion: "", unidad: "Und", precio: 0, stock: 0, stock_minimo: 10, grupo: "", iva: 0, costo: 0, oferta: false, activo: true }

interface ImportResumen { nuevos: number; actualizados: number; errores: number; total: number; avisos: string[] }

export default function InventarioPage() {
  const theme = useTheme()
  const isAdmin = getSession()?.perfil?.nombre === "Administrador"
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [buscar, setBuscar] = useState("")
  const [filtro, setFiltro] = useState<"todos" | "bajo" | "ok">("todos")

  // Import state
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null)
  const [archivoData, setArchivoData]     = useState<ArrayBuffer | null>(null)
  const [procesando, setProcesando]       = useState(false)
  const [progreso, setProgreso]           = useState(0)
  const [resumen, setResumen]             = useState<ImportResumen | null>(null)
  const [importError, setImportError]     = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const ivaFileRef = useRef<HTMLInputElement>(null)
  const [ivaProcesando, setIvaProcesando] = useState(false)
  const [ivaResumen, setIvaResumen] = useState("")

  const costoFileRef = useRef<HTMLInputElement>(null)
  const [costoProcesando, setCostoProcesando] = useState(false)
  const [costoResumen, setCostoResumen] = useState("")

  useEffect(() => {
    load()
    let t: ReturnType<typeof setTimeout> | undefined
    const recargarAgrupado = () => { if (t) clearTimeout(t); t = setTimeout(load, 800) }
    const canal = supabase.channel("inventario-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "productos" }, recargarAgrupado)
      .subscribe()
    return () => { if (t) clearTimeout(t); supabase.removeChannel(canal) }
  }, [])

  async function load() {
    setLoading(true)
    const TAM = 1000
    let desde = 0
    let todos: Producto[] = []
    while (true) {
      const { data, error } = await supabase
        .from("productos").select("*").order("nombre")
        .range(desde, desde + TAM - 1)
      if (error || !data || data.length === 0) break
      todos = todos.concat(data)
      setProductos([...todos]) // mostramos lo que va llegando
      setLoading(false)        // quitamos "Cargando" apenas llega el primer bloque
      if (data.length < TAM) break
      desde += TAM
    }
    setProductos(todos)
    setLoading(false)
  }

  function abrir(p?: Producto) {
    setError("")
    setEditando(p ? p.id : null)
    setForm(p ? { ...p } : { ...EMPTY })
    setModal(true)
  }

  function cerrar() { setModal(false); setEditando(null); setError("") }

  async function guardar() {
    if (!form.nombre?.trim()) return setError("El nombre es requerido")
    if (!form.codigo?.trim()) return setError("El código es requerido")
    setSaving(true); setError("")
    const payload = { ...form, precio: Number(form.precio), stock: Number(form.stock), stock_minimo: Number(form.stock_minimo), iva: Number(form.iva), costo: Number(form.costo) }
    const { error: err } = editando
      ? await supabase.from("productos").update(payload).eq("id", editando)
      : await supabase.from("productos").insert(payload)
    setSaving(false)
    if (err) return setError(err.message)
    cerrar()
  }

  // Importa un archivo (codigo + IVA) y marca el IVA de cada producto por codigo
  async function importarCostos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (costoFileRef.current) costoFileRef.current.value = ""
    if (!file) return
    setCostoProcesando(true); setCostoResumen("")
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      if (rows.length === 0) { setCostoResumen("El archivo está vacío o no tiene datos."); setCostoProcesando(false); return }

      const col = (r: Record<string, unknown>, ...keys: string[]) => {
        for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k]
        return undefined
      }

      // Agrupar codigos por su valor de costo (para actualizar en bloque)
      const porCosto: Record<string, string[]> = {}
      let sinCodigo = 0, costoInvalido = 0
      for (const r of rows) {
        const codigo = String(col(r, "codigo", "Codigo", "CODIGO", "cod", "Cod", "COD") ?? "").trim()
        const costoRaw = col(r, "costo", "Costo", "COSTO", "valor", "Valor", "VALOR", "precio_compra", "PRECIO_COMPRA")
        if (!codigo) { sinCodigo++; continue }
        const costo = Number(String(costoRaw ?? 0).toString().replace(/[^\d.-]/g, ""))
        if (isNaN(costo)) { costoInvalido++; continue }
        ;(porCosto[costo] ||= []).push(codigo)
      }

      if (Object.keys(porCosto).length === 0) {
        setCostoProcesando(false)
        setCostoResumen("No se encontraron filas válidas. Revisa que el archivo tenga una columna de código y una de costo.")
        return
      }

      let actualizados = 0
      for (const [costo, codigos] of Object.entries(porCosto)) {
        for (let i = 0; i < codigos.length; i += 400) {
          const bloque = codigos.slice(i, i + 400)
          const { count, error: err } = await supabase.from("productos")
            .update({ costo: Number(costo) }, { count: "exact" }).in("codigo", bloque)
          if (err) { setCostoProcesando(false); setCostoResumen("Error al actualizar el costo: " + err.message); return }
          actualizados += count || 0
        }
      }

      setCostoProcesando(false)
      let txt = `✓ ${actualizados} producto(s) con su costo cargado.`
      if (sinCodigo > 0) txt += ` ${sinCodigo} fila(s) sin código se omitieron.`
      if (costoInvalido > 0) txt += ` ${costoInvalido} fila(s) con costo inválido se omitieron.`
      setCostoResumen(txt)
      load()
    } catch {
      setCostoProcesando(false)
      setCostoResumen("No se pudo leer el archivo. Asegúrate de que sea un Excel válido.")
    }
  }

  function descargarPlantillaCostos() {
    const ejemplo = [{ CODIGO: "0026", COSTO: 5200 }, { CODIGO: "0103", COSTO: 21000 }]
    const ws = XLSX.utils.json_to_sheet(ejemplo)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Costos")
    XLSX.writeFile(wb, "plantilla_costos.xlsx")
  }

  async function importarIVA(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (ivaFileRef.current) ivaFileRef.current.value = ""
    if (!file) return
    setIvaProcesando(true); setIvaResumen("")
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      if (rows.length === 0) { setIvaResumen("El archivo está vacío o no tiene datos."); setIvaProcesando(false); return }

      const col = (r: Record<string, unknown>, ...keys: string[]) => {
        for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k]
        return undefined
      }

      // Agrupar codigos por su valor de IVA (para actualizar en bloque)
      const porIva: Record<string, string[]> = {}
      let sinCodigo = 0, ivaInvalido = 0
      for (const r of rows) {
        const codigo = String(col(r, "codigo", "Codigo", "CODIGO", "cod", "Cod", "COD") ?? "").trim()
        const ivaRaw = col(r, "iva", "Iva", "IVA", "porcentaje", "Porcentaje", "PORCENTAJE", "%")
        if (!codigo) { sinCodigo++; continue }
        const iva = Number(ivaRaw ?? 0)
        if (isNaN(iva)) { ivaInvalido++; continue }
        ;(porIva[iva] ||= []).push(codigo)
      }

      if (Object.keys(porIva).length === 0) {
        setIvaProcesando(false)
        setIvaResumen("No se encontraron filas válidas. Revisa que el archivo tenga una columna de código y una de IVA.")
        return
      }

      let actualizados = 0
      for (const [iva, codigos] of Object.entries(porIva)) {
        for (let i = 0; i < codigos.length; i += 400) {
          const bloque = codigos.slice(i, i + 400)
          const { count, error: err } = await supabase.from("productos")
            .update({ iva: Number(iva) }, { count: "exact" }).in("codigo", bloque)
          if (err) { setIvaProcesando(false); setIvaResumen("Error al actualizar el IVA: " + err.message); return }
          actualizados += count || 0
        }
      }

      setIvaProcesando(false)
      let txt = `✓ ${actualizados} producto(s) marcados con su IVA.`
      if (sinCodigo > 0) txt += ` ${sinCodigo} fila(s) sin código se omitieron.`
      if (ivaInvalido > 0) txt += ` ${ivaInvalido} fila(s) con IVA inválido se omitieron.`
      setIvaResumen(txt)
      load()
    } catch {
      setIvaProcesando(false)
      setIvaResumen("No se pudo leer el archivo. Asegúrate de que sea un Excel válido.")
    }
  }

  async function toggleActivo(p: Producto) {
    await supabase.from("productos").update({ activo: !p.activo }).eq("id", p.id)
  }

  async function toggleOferta(p: Producto) {
    await supabase.from("productos").update({ oferta: !p.oferta }).eq("id", p.id)
    load()
  }

  function seleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoNombre(file.name)
    setResumen(null)
    setImportError("")
    file.arrayBuffer().then(buf => setArchivoData(buf))
  }

  function limpiarImport() {
    setArchivoNombre(null)
    setArchivoData(null)
    setResumen(null)
    setImportError("")
    setProgreso(0)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function procesarExcel() {
    if (!archivoData) return
    setProcesando(true); setProgreso(0); setResumen(null); setImportError("")

    const wb = XLSX.read(archivoData)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

    // Validacion: archivo sin filas
    if (rows.length === 0) {
      setProcesando(false)
      setImportError("El archivo esta vacio o no tiene datos en la primera hoja. Revisa el archivo y vuelve a intentar.")
      return
    }

    const col = (r: Record<string, unknown>, ...keys: string[]) => {
      for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k]
      return undefined
    }

    const filas = rows.map((r, idx) => {
      const precioRaw = col(r, "precio", "Precio", "PRECIO", "pv1_mn", "Pv1_mn", "PV1_MN")
      const stockRaw  = col(r, "stock", "Stock", "STOCK", "can_mn", "Can_mn", "CAN_MN")
      return {
        excelFila:    idx + 2,
        codigo:       String(col(r, "codigo", "Codigo", "CODIGO") ?? "").trim(),
        nombre:       String(col(r, "nombre", "Nombre", "NOMBRE", "articulo", "Articulo", "ARTICULO") ?? "").trim(),
        descripcion:  String(col(r, "descripcion", "Descripcion", "DESCRIPCION") ?? "").trim(),
        unidad:       String(col(r, "unidad", "Unidad", "UNIDAD") ?? "Und").trim(),
        precio:       Number(precioRaw ?? 0),
        stock:        Number(stockRaw ?? 0),
        stock_minimo: Number(col(r, "stock_minimo", "StockMinimo", "STOCK_MINIMO") ?? 10),
        grupo:        String(col(r, "grupo", "Grupo", "GRUPO", "gru", "Gru", "GRU") ?? "").trim(),
        precioInvalido: precioRaw !== undefined && isNaN(Number(precioRaw)),
        stockInvalido:  stockRaw !== undefined && isNaN(Number(stockRaw)),
      }
    })

    // Validacion: ninguna fila tiene codigo -> columna codigo ausente o mal nombrada
    if (filas.every(f => !f.codigo)) {
      setProcesando(false)
      setImportError("No se encontro la columna de codigo. Asegurate de que el archivo tenga una columna llamada CODIGO en la primera fila.")
      return
    }

    // Avisos previos (no detienen la importacion, solo informan)
    const avisos: string[] = []
    const sinCodigo = filas.filter(f => !f.codigo).map(f => f.excelFila)
    if (sinCodigo.length > 0)
      avisos.push(`${sinCodigo.length} fila(s) sin codigo fueron omitidas (fila ${sinCodigo.slice(0, 8).join(", ")}${sinCodigo.length > 8 ? "..." : ""}).`)
    const precioMalo = filas.filter(f => f.codigo && f.precioInvalido).map(f => f.excelFila)
    if (precioMalo.length > 0)
      avisos.push(`${precioMalo.length} producto(s) con precio invalido se guardaron en 0 (fila ${precioMalo.slice(0, 8).join(", ")}${precioMalo.length > 8 ? "..." : ""}).`)
    const stockMalo = filas.filter(f => f.codigo && f.stockInvalido).map(f => f.excelFila)
    if (stockMalo.length > 0)
      avisos.push(`${stockMalo.length} producto(s) con cantidad invalida se guardaron en 0 (fila ${stockMalo.slice(0, 8).join(", ")}${stockMalo.length > 8 ? "..." : ""}).`)
    const validas = filas.filter(f => f.codigo)
    const codigosDuplicados = validas.map(f => f.codigo).filter((c, i, arr) => arr.indexOf(c) !== i)
    if (codigosDuplicados.length > 0)
      avisos.push(`Hay codigos repetidos en el archivo (${[...new Set(codigosDuplicados)].slice(0, 8).join(", ")}). Se uso el ultimo valor de cada uno.`)

    const LOTE = 20
    let nuevos = 0, actualizados = 0, errores = 0
    const total = filas.length

    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE)

      for (const fila of lote) {
        if (!fila.codigo) { errores++; continue }
        const precio = isNaN(fila.precio) ? 0 : fila.precio
        const stock = isNaN(fila.stock) ? 0 : fila.stock

        const { data: existe } = await supabase
          .from("productos").select("id").eq("codigo", fila.codigo).maybeSingle()

        if (existe) {
          const { error: err } = await supabase.from("productos")
            .update({ stock, precio, grupo: fila.grupo, updated_at: new Date().toISOString() })
            .eq("codigo", fila.codigo)
          if (err) errores++; else actualizados++
        } else {
          const { error: err } = await supabase.from("productos").insert({
            codigo: fila.codigo, nombre: fila.nombre || fila.codigo,
            descripcion: fila.descripcion, unidad: fila.unidad || "Und",
            precio, stock,
            stock_minimo: isNaN(fila.stock_minimo) ? 10 : (fila.stock_minimo || 10), grupo: fila.grupo, activo: true,
          })
          if (err) errores++; else nuevos++
        }
      }

      setProgreso(Math.round(Math.min(i + LOTE, total) / total * 100))
    }

    setProcesando(false)
    setResumen({ nuevos, actualizados, errores, total, avisos })
    load()
  }

  function exportarExcel() {
    const datos = productos.map(p => ({ Codigo: p.codigo, Nombre: p.nombre, Grupo: p.grupo, Descripcion: p.descripcion, Unidad: p.unidad, Precio: p.precio, Stock: p.stock, StockMinimo: p.stock_minimo, Activo: p.activo ? "Sí" : "No" }))
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Inventario")
    XLSX.writeFile(wb, "inventario_distrimas.xlsx")
  }

  function descargarPlantilla() {
    const ejemplo = [{ CODIGO: "0043", ARTICULO: "BIG BOM BABY CARITA FELIZ X48", GRU: "001", CAN_MN: 105, PV1_MN: 7600 }]
    const ws = XLSX.utils.json_to_sheet(ejemplo)
    ws["!cols"] = [{ wch: 10 }, { wch: 36 }, { wch: 8 }, { wch: 10 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Inventario")
    XLSX.writeFile(wb, "plantilla_inventario.xlsx")
  }

  const stockBajo = productos.filter(p => p.activo && p.stock < p.stock_minimo).length

  const filtrados = productos.filter(p => {
    const q = buscar.toLowerCase()
    const coincide = p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
    if (filtro === "bajo") return coincide && p.stock < p.stock_minimo && p.activo
    if (filtro === "ok") return coincide && p.stock >= p.stock_minimo
    return coincide
  })

  const f = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))
  const inp = { background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "8px", color: theme.text, fontSize: "14px", padding: "10px 12px", outline: "none", width: "100%", boxSizing: "border-box" as const }
  const lbl = { display: "block", fontSize: "11px", fontWeight: "bold" as const, color: theme.muted, textTransform: "uppercase" as const, letterSpacing: "0.7px", marginBottom: "6px" }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Inventario</h2>
          <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>{productos.length} productos · <span style={{ color: stockBajo > 0 ? "#f59e0b" : "#22c55e" }}>{stockBajo} con stock bajo</span> · Tiempo real</p>
        </div>
        <div className="page-header-btns">
          <button onClick={exportarExcel} style={{ padding: "10px 16px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "13px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Exportar Excel</button>
          <button onClick={descargarPlantilla} style={{ padding: "10px 16px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "13px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Descargar plantilla</button>
          {isAdmin && <button onClick={() => ivaFileRef.current?.click()} disabled={ivaProcesando} style={{ padding: "10px 16px", background: "rgba(215,38,56,0.1)", color: "#D72638", fontWeight: 600, fontSize: "13px", borderRadius: "8px", border: "none", cursor: "pointer", opacity: ivaProcesando ? 0.6 : 1 }}>{ivaProcesando ? "Importando IVA..." : "Importar IVA"}</button>}
          <input ref={ivaFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={importarIVA} style={{ display: "none" }} />
          {isAdmin && <button onClick={() => costoFileRef.current?.click()} disabled={costoProcesando} style={{ padding: "10px 16px", background: "rgba(215,38,56,0.1)", color: "#D72638", fontWeight: 600, fontSize: "13px", borderRadius: "8px", border: "none", cursor: "pointer", opacity: costoProcesando ? 0.6 : 1 }}>{costoProcesando ? "Importando costos..." : "Importar costos"}</button>}
          <input ref={costoFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={importarCostos} style={{ display: "none" }} />
          {isAdmin && <button onClick={descargarPlantillaCostos} style={{ padding: "10px 16px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "13px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Plantilla costos</button>}
          <button onClick={() => abrir()} style={{ padding: "10px 20px", background: "#D72638", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer" }}>+ Producto</button>
        </div>
      </div>

      {costoResumen && (
        <div style={{ background: costoResumen.startsWith("✓") ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${costoResumen.startsWith("✓") ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.3)"}`, color: costoResumen.startsWith("✓") ? "#22c55e" : "#d97706", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "16px" }}>{costoResumen}</div>
      )}

      {ivaResumen && (
        <div style={{ background: ivaResumen.startsWith("✓") ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${ivaResumen.startsWith("✓") ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.3)"}`, color: ivaResumen.startsWith("✓") ? "#22c55e" : "#d97706", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "16px" }}>{ivaResumen}</div>
      )}

      {/* Panel importación — solo admin */}
      {isAdmin && (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "20px 24px", marginBottom: "16px" }}>

          {/* Encabezado */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "rgba(215,38,56,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>📥</div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: theme.text, margin: 0 }}>Importar inventario desde Excel</p>
              <p style={{ fontSize: "11px", color: theme.muted, margin: 0 }}>Solo actualiza stock y precio de existentes · Nunca borra productos</p>
            </div>
          </div>

          {/* Zona de selección */}
          {!archivoNombre ? (
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "10px", padding: "28px 20px",
              background: theme.cardAlt, borderRadius: "10px",
              border: `2px dashed ${theme.border}`,
              cursor: "pointer", transition: "border-color 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#D72638")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = theme.border)}
            >
              <span style={{ fontSize: "32px" }}>📂</span>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "14px", fontWeight: 600, color: theme.text, margin: "0 0 4px" }}>Seleccionar archivo Excel</p>
                <p style={{ fontSize: "12px", color: theme.muted, margin: 0 }}>Formatos soportados: .xlsx, .xls</p>
              </div>
              <div style={{ padding: "8px 20px", background: "#D72638", color: "white", fontWeight: 700, fontSize: "13px", borderRadius: "8px" }}>
                Elegir archivo
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={seleccionarArchivo} style={{ display: "none" }} />
            </label>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

              {/* Archivo seleccionado */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: "rgba(215,38,56,0.06)", borderRadius: "10px", border: "1px solid rgba(215,38,56,0.2)" }}>
                <span style={{ fontSize: "22px" }}>📄</span>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: theme.text, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{archivoNombre}</p>
                  <p style={{ fontSize: "11px", color: theme.muted, margin: 0 }}>Listo para procesar</p>
                </div>
                {!procesando && (
                  <button onClick={limpiarImport} style={{ background: "none", border: `1px solid ${theme.border}`, borderRadius: "6px", cursor: "pointer", color: theme.muted, fontSize: "12px", padding: "4px 10px", whiteSpace: "nowrap" }}>
                    Cambiar
                  </button>
                )}
              </div>

              {/* Botón procesar */}
              {!procesando && !resumen && (
                <button onClick={procesarExcel} style={{
                  width: "100%", padding: "12px",
                  background: "#D72638", color: "white",
                  fontWeight: 700, fontSize: "14px", borderRadius: "10px",
                  border: "none", cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(215,38,56,0.3)",
                }}>
                  Procesar importación →
                </button>
              )}
            </div>
          )}

          {/* Barra de progreso */}
          {procesando && (
            <div style={{ marginTop: "16px", padding: "16px", background: theme.cardAlt, borderRadius: "10px", border: `1px solid ${theme.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, color: theme.text, marginBottom: "10px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#D72638", animation: "pulse 1s infinite" }} />
                  Procesando filas...
                </span>
                <span style={{ color: "#D72638" }}>{progreso}%</span>
              </div>
              <div style={{ height: "10px", background: theme.bg, borderRadius: "99px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progreso}%`, background: "linear-gradient(90deg, #D72638, #a01c29)", borderRadius: "99px", transition: "width 0.4s ease" }} />
              </div>
            </div>
          )}

          {/* Resumen final */}
          {resumen && (
            <div style={{ marginTop: "16px" }}>
              {/* Banner éxito/advertencia */}
              <div style={{
                padding: "12px 16px", borderRadius: "10px", marginBottom: "12px",
                background: resumen.errores === resumen.total ? "rgba(215,38,56,0.08)" : "rgba(34,197,94,0.08)",
                border: `1px solid ${resumen.errores === resumen.total ? "rgba(215,38,56,0.25)" : "rgba(34,197,94,0.25)"}`,
              }}>
                <p style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 2px", color: resumen.errores === resumen.total ? "#D72638" : "#16a34a" }}>
                  {resumen.errores === resumen.total ? "✗ No se pudo importar ningún registro" : "✓ Importación completada"}
                </p>
                <p style={{ fontSize: "12px", color: theme.muted, margin: 0 }}>
                  {resumen.errores === resumen.total
                    ? "Verifica que el archivo tenga la columna 'codigo' en la primera fila."
                    : `Se procesaron ${resumen.total} filas del archivo.`}
                </p>
              </div>

              {/* Tarjetas resumen */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginBottom: "12px" }}>
                <div style={{ padding: "12px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "10px", textAlign: "center" }}>
                  <p style={{ fontSize: "22px", fontWeight: 800, color: "#22c55e", margin: "0 0 2px" }}>{resumen.nuevos}</p>
                  <p style={{ fontSize: "11px", color: theme.muted, margin: 0, fontWeight: 600 }}>Nuevos</p>
                </div>
                <div style={{ padding: "12px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "10px", textAlign: "center" }}>
                  <p style={{ fontSize: "22px", fontWeight: 800, color: "#D72638", margin: "0 0 2px" }}>{resumen.actualizados}</p>
                  <p style={{ fontSize: "11px", color: theme.muted, margin: 0, fontWeight: 600 }}>Actualizados</p>
                </div>
                <div style={{ padding: "12px", background: resumen.errores > 0 ? "rgba(215,38,56,0.08)" : theme.cardAlt, border: `1px solid ${resumen.errores > 0 ? "rgba(215,38,56,0.2)" : theme.border}`, borderRadius: "10px", textAlign: "center" }}>
                  <p style={{ fontSize: "22px", fontWeight: 800, color: resumen.errores > 0 ? "#D72638" : theme.muted, margin: "0 0 2px" }}>{resumen.errores}</p>
                  <p style={{ fontSize: "11px", color: theme.muted, margin: 0, fontWeight: 600 }}>Errores</p>
                </div>
                <div style={{ padding: "12px", background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: "10px", textAlign: "center" }}>
                  <p style={{ fontSize: "22px", fontWeight: 800, color: theme.text, margin: "0 0 2px" }}>{resumen.total}</p>
                  <p style={{ fontSize: "11px", color: theme.muted, margin: 0, fontWeight: 600 }}>Total filas</p>
                </div>
              </div>

              {resumen.avisos.length > 0 && (
                <div style={{ padding: "12px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "10px", marginBottom: "12px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "#f59e0b", margin: "0 0 6px" }}>Avisos de validación</p>
                  {resumen.avisos.map((a, idx) => (
                    <p key={idx} style={{ fontSize: "12px", color: theme.muted, margin: "0 0 4px", lineHeight: 1.4 }}>• {a}</p>
                  ))}
                </div>
              )}

              <button onClick={limpiarImport} style={{ width: "100%", padding: "10px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "13px", borderRadius: "10px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>
                Nueva importación
              </button>
            </div>
          )}

          {importError && (
            <div style={{ marginTop: "14px", padding: "10px 14px", background: "rgba(215,38,56,0.08)", border: "1px solid rgba(215,38,56,0.25)", borderRadius: "8px" }}>
              <p style={{ color: "#D72638", fontSize: "13px", fontWeight: 600, margin: "0 0 2px" }}>✗ Error al procesar</p>
              <p style={{ color: theme.muted, fontSize: "12px", margin: 0 }}>{importError}</p>
            </div>
          )}

          <p style={{ fontSize: "11px", color: theme.muted, margin: "12px 0 0" }}>
            Columnas requeridas: <code>codigo</code>, <code>nombre</code>, <code>precio</code>, <code>stock</code> — opcionales: <code>descripcion</code>, <code>unidad</code>, <code>stock_minimo</code>
          </p>
        </div>
      )}

      <div className="filtros-wrap" style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar producto o código..." style={{ ...inp, maxWidth: "280px" }} />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {(["todos", "bajo", "ok"] as const).map(f2 => (
            <button key={f2} onClick={() => setFiltro(f2)} style={{ padding: "8px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, background: filtro === f2 ? "#D72638" : theme.cardAlt, color: filtro === f2 ? "white" : theme.muted }}>
              {f2 === "todos" ? "Todos" : f2 === "bajo" ? "Stock bajo" : "Stock OK"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", overflow: "hidden" }}>
        <div className="tabla-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {["Código", "Nombre", "Grupo", "Unidad", "Precio", "IVA", "Sin IVA", "Costo", "Margen", "Stock", "Mín.", "Estado", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.7px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} style={{ padding: "40px", textAlign: "center", color: theme.muted }}>Cargando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={13} style={{ padding: "40px", textAlign: "center", color: theme.muted }}>No hay productos</td></tr>
              ) : filtrados.map(p => {
                const bajo = p.activo && p.stock < p.stock_minimo
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${theme.border}`, background: bajo ? "rgba(245,158,11,0.04)" : "transparent" }}>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted, fontFamily: "monospace" }}>{p.codigo}</td>
                    <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: 500, color: theme.text }}>{p.nombre}{p.oferta && <span style={{ marginLeft: "8px", padding: "2px 7px", borderRadius: "5px", fontSize: "10px", fontWeight: 800, background: "#D72638", color: "white", verticalAlign: "middle" }}>OFERTA</span>}</td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted, fontFamily: "monospace" }}>{p.grupo}</td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted }}>{p.unidad}</td>
                    <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: 600, color: theme.text }}>${p.precio.toLocaleString("es-CO")}</td>
                    <td style={{ padding: "12px 16px", fontSize: "13px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, background: (p.iva || 0) > 0 ? "rgba(215,38,56,0.12)" : theme.cardAlt, color: (p.iva || 0) > 0 ? "#D72638" : theme.muted }}>{p.iva || 0}%</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted }}>${Math.round(p.precio / (1 + (p.iva || 0) / 100)).toLocaleString("es-CO")}</td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.text }}>${Math.round(p.costo || 0).toLocaleString("es-CO")}</td>
                    <td style={{ padding: "12px 16px", fontSize: "13px" }}>
                      {(() => {
                        const sinIva = p.precio / (1 + (p.iva || 0) / 100)
                        const costo = p.costo || 0
                        const margen = sinIva - costo
                        const pct = sinIva > 0 ? (margen / sinIva) * 100 : 0
                        if (costo <= 0) return <span style={{ color: theme.muted }}>—</span>
                        const color = margen < 0 ? "#D72638" : "#16a34a"
                        return <span style={{ color, fontWeight: 600 }}>${Math.round(margen).toLocaleString("es-CO")} <span style={{ fontSize: "11px", opacity: 0.8 }}>({pct.toFixed(0)}%)</span></span>
                      })()}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontWeight: "bold", fontSize: "15px", color: bajo ? "#f59e0b" : "#22c55e" }}>{p.stock}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted }}>{p.stock_minimo}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, background: bajo ? "rgba(245,158,11,0.12)" : p.activo ? "rgba(34,197,94,0.12)" : theme.cardAlt, color: bajo ? "#f59e0b" : p.activo ? "#22c55e" : theme.muted }}>
                        {bajo ? "Stock bajo" : p.activo ? "OK" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="acciones-wrap">
                        <button onClick={() => abrir(p)} style={{ padding: "6px 12px", background: theme.cardAlt, color: theme.text, fontSize: "12px", borderRadius: "6px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Editar</button>
                        <button onClick={() => toggleOferta(p)} style={{ padding: "6px 12px", background: p.oferta ? "rgba(215,38,56,0.12)" : theme.cardAlt, color: p.oferta ? "#D72638" : theme.muted, fontSize: "12px", fontWeight: 600, borderRadius: "6px", border: p.oferta ? "none" : `1px solid ${theme.border}`, cursor: "pointer" }}>
                          {p.oferta ? "Quitar oferta" : "Marcar oferta"}
                        </button>
                        <button onClick={() => toggleActivo(p)} style={{ padding: "6px 12px", background: p.activo ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)", color: p.activo ? "#f59e0b" : "#22c55e", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer" }}>
                          {p.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ background: theme.card, border: `1px solid ${theme.border}`, padding: "24px", maxWidth: "480px" }}>
            <h3 style={{ fontSize: "17px", fontWeight: "bold", margin: "0 0 20px", color: theme.text }}>{editando ? "Editar producto" : "Nuevo producto"}</h3>
            {error && <div style={{ background: "rgba(215,38,56,0.1)", border: "1px solid rgba(215,38,56,0.25)", color: "#D72638", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
            <div style={{ display: "grid", gap: "14px" }}>
              <div className="form-grid-1-2">
                <div><label style={lbl}>Código</label><input style={inp} value={form.codigo} onChange={e => f("codigo", e.target.value)} placeholder="PRD-001" /></div>
                <div><label style={lbl}>Nombre</label><input style={inp} value={form.nombre} onChange={e => f("nombre", e.target.value)} placeholder="Arroz Diana 5kg" /></div>
              </div>
              <div><label style={lbl}>Descripción</label><input style={inp} value={form.descripcion} onChange={e => f("descripcion", e.target.value)} placeholder="Descripción del producto" /></div>
              <div><label style={lbl}>Grupo</label><input style={inp} value={form.grupo} onChange={e => f("grupo", e.target.value)} placeholder="001" /></div>
              <div className="form-grid-3">
                <div><label style={lbl}>Unidad</label>
                  <select style={inp} value={form.unidad} onChange={e => f("unidad", e.target.value)}>
                    {["Und", "Cja", "Blt", "Kg", "Lt", "Par"].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Precio (con IVA)</label><input style={inp} type="number" value={form.precio} onChange={e => f("precio", e.target.value)} min={0} /></div>
                <div><label style={lbl}>Stock actual</label><input style={inp} type="number" value={form.stock} onChange={e => f("stock", e.target.value)} min={0} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={lbl}>IVA</label>
                  <select style={{ ...inp, cursor: "pointer" }} value={form.iva} onChange={e => f("iva", e.target.value)}>
                    <option value={0}>Sin IVA (0%)</option>
                    <option value={5}>5%</option>
                    <option value={19}>19%</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Precio sin IVA</label>
                  <div style={{ ...inp, background: theme.card, color: theme.muted, display: "flex", alignItems: "center" }}>
                    ${Math.round(Number(form.precio || 0) / (1 + Number(form.iva || 0) / 100)).toLocaleString("es-CO")}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div><label style={lbl}>Costo (sin IVA)</label><input style={inp} type="number" value={form.costo} onChange={e => f("costo", e.target.value)} min={0} /></div>
                <div>
                  <label style={lbl}>Margen</label>
                  <div style={{ ...inp, background: theme.card, display: "flex", alignItems: "center" }}>
                    {(() => {
                      const sinIva = Number(form.precio || 0) / (1 + Number(form.iva || 0) / 100)
                      const costo = Number(form.costo || 0)
                      const margen = sinIva - costo
                      const pct = sinIva > 0 ? (margen / sinIva) * 100 : 0
                      if (costo <= 0) return <span style={{ color: theme.muted }}>Carga el costo</span>
                      return <span style={{ color: margen < 0 ? "#D72638" : "#16a34a", fontWeight: 600 }}>${Math.round(margen).toLocaleString("es-CO")} ({pct.toFixed(0)}%)</span>
                    })()}
                  </div>
                </div>
              </div>
              <div><label style={lbl}>Stock mínimo</label><input style={inp} type="number" value={form.stock_minimo} onChange={e => f("stock_minimo", e.target.value)} min={0} /></div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer", color: theme.text }}>
                <input type="checkbox" checked={form.activo} onChange={e => f("activo", e.target.checked)} /> Activo
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer", color: theme.text }}>
                <input type="checkbox" checked={!!form.oferta} onChange={e => f("oferta", e.target.checked)} /> En oferta
              </label>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button onClick={cerrar} style={{ flex: 1, padding: "11px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{ flex: 1, padding: "11px", background: "#D72638", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Guardando..." : editando ? "Guardar cambios" : "Crear producto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
