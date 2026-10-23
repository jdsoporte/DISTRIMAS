"use client"
import { useEffect, useState } from "react"
import { getSession } from "@/lib/auth"
import { descargarParaOffline, enviarPendientes } from "@/lib/offline-sync"
import { contarPendientes, leerDato } from "@/lib/offline-db"

// Cada cuánto se vuelve a bajar el catálogo completo para uso sin señal
const VIGENCIA_MS = 15 * 60 * 1000
// Espera antes de sincronizar, para que la pantalla cargue primero
const ESPERA_INICIAL_MS = 3000

async function syncVencida(userId: string): Promise<boolean> {
  const ultima = await leerDato<string>("ultima_sync")
  if (!ultima) return true
  // Si en este celular entró otro usuario, sus datos (ruta, clientes) no sirven
  if ((await leerDato<string>("sync_usuario")) !== userId) return true
  // La ruta guardada es la del día: si cambió el día, se vuelve a bajar
  const dia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  if (dia(new Date(ultima)) !== dia(new Date())) return true
  return Date.now() - new Date(ultima).getTime() > VIGENCIA_MS
}

type Estado = "ok" | "offline" | "sync" | "listo"

export default function OfflineSync() {
  const [estado, setEstado] = useState<Estado>("ok")
  const [pendientes, setPendientes] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let activo = true

    async function sincronizar(forzar = false) {
      const user = getSession()
      if (!user?.id) return
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (activo) { setEstado("offline"); setVisible(true) }
        actualizarPendientes()
        return
      }
      // 1) Enviar lo que quedó pendiente sin señal
      const enviados = await enviarPendientes()
      // 2) Refrescar los datos guardados: solo vendedores (el admin no trabaja sin señal)
      //    y solo si la última descarga ya tiene más de 15 minutos
      const esAdmin = user.perfil?.nombre === "Administrador"
      if (esAdmin || !(forzar || await syncVencida(user.id))) {
        if (activo) { setEstado("ok"); setVisible(false) }
        actualizarPendientes()
        return
      }
      if (activo) { setEstado("sync"); setVisible(true) }
      const ok = await descargarParaOffline(user.id)
      if (!activo) return
      setEstado(ok ? "listo" : "ok")
      actualizarPendientes()
      if (enviados > 0) {
        setEstado("listo")
      }
      // El aviso "listo" desaparece solo a los 4 segundos
      setTimeout(() => { if (activo) setVisible(false) }, 4000)
    }

    async function actualizarPendientes() {
      const n = await contarPendientes()
      if (activo) setPendientes(n)
    }

    function alConectar() { sincronizar(true) }
    function alDesconectar() { setEstado("offline"); setVisible(true) }

    const espera = setTimeout(() => sincronizar(), ESPERA_INICIAL_MS)
    window.addEventListener("online", alConectar)
    window.addEventListener("offline", alDesconectar)
    return () => {
      activo = false
      clearTimeout(espera)
      window.removeEventListener("online", alConectar)
      window.removeEventListener("offline", alDesconectar)
    }
  }, [])

  if (!visible && pendientes === 0) return null

  let bg = "#16a34a", texto = "Datos listos para trabajar sin conexión"
  if (estado === "offline") { bg = "#d97706"; texto = "Sin conexión — puedes seguir trabajando con los datos guardados" }
  else if (estado === "sync") { bg = "#1e3a5f"; texto = "Guardando datos para uso sin conexión..." }
  else if (estado === "ok") { bg = "#16a34a"; texto = "" }

  if (pendientes > 0) {
    texto = (texto ? texto + " · " : "") + `${pendientes} pendiente${pendientes !== 1 ? "s" : ""} por enviar`
  }
  if (!texto) return null

  return (
    <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "16px", zIndex: 9999, background: bg, color: "white", fontSize: "13px", fontWeight: 600, padding: "9px 16px", borderRadius: "99px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", maxWidth: "92vw", textAlign: "center" }}>
      {texto}
    </div>
  )
}
