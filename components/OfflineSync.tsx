"use client"
import { useEffect, useState } from "react"
import { getSession } from "@/lib/auth"
import { descargarParaOffline } from "@/lib/offline-sync"
import { contarPendientes } from "@/lib/offline-db"

type Estado = "ok" | "offline" | "sync" | "listo"

export default function OfflineSync() {
  const [estado, setEstado] = useState<Estado>("ok")
  const [pendientes, setPendientes] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let activo = true

    async function sincronizar() {
      const user = getSession()
      if (!user?.id) return
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (activo) { setEstado("offline"); setVisible(true) }
        actualizarPendientes()
        return
      }
      if (activo) { setEstado("sync"); setVisible(true) }
      const ok = await descargarParaOffline(user.id)
      if (!activo) return
      setEstado(ok ? "listo" : "ok")
      actualizarPendientes()
      // El aviso "listo" desaparece solo a los 4 segundos
      setTimeout(() => { if (activo) setVisible(false) }, 4000)
    }

    async function actualizarPendientes() {
      const n = await contarPendientes()
      if (activo) setPendientes(n)
    }

    function alConectar() { setEstado("sync"); setVisible(true); sincronizar() }
    function alDesconectar() { setEstado("offline"); setVisible(true) }

    sincronizar()
    window.addEventListener("online", alConectar)
    window.addEventListener("offline", alDesconectar)
    return () => {
      activo = false
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

