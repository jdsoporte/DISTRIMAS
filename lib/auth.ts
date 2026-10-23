import { supabase } from './supabase'
import { Usuario, AccionesModulo } from './types'

// Columnas de usuarios que se pueden leer desde el navegador (password_hash no).
// Para TypeScript se declara como el select original, asi el tipo del resultado no cambia.
export const USUARIO_SELECT = 'id, nombre, documento, telefono, usuario, perfil_id, activo, primer_ingreso, created_at, perfil:perfiles(*)' as unknown as '*, perfil:perfiles(*)'

export async function login(usuario: string, password: string): Promise<{ data: Usuario | null, error: string | null }> {
  // La contrasena se valida en la base (funcion login, bcrypt); nunca se descarga
  const { data, error } = await supabase.rpc('login', { p_usuario: usuario, p_password: password })

  if (error || !data) return { data: null, error: 'Usuario o contrasena incorrectos' }

  localStorage.setItem('distrimas_user', JSON.stringify(data))
  return { data: data as Usuario, error: null }
}

export function getSession(): Usuario | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('distrimas_user')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function logout() {
  localStorage.removeItem('distrimas_user')
}

export function hasPermission(usuario: Usuario, modulo: string, accion: keyof AccionesModulo = 'ver'): boolean {
  if (usuario.perfil?.nombre === 'Administrador') return true
  const permisos = usuario.perfil?.permisos
  if (!permisos) return false
  const modPermisos = permisos[modulo as keyof typeof permisos]
  if (!modPermisos) return false
  return modPermisos[accion] === true
}
