export interface AccionesModulo {
  ver: boolean
  insertar: boolean
  actualizar: boolean
  eliminar: boolean
  cargar: boolean
  exportar: boolean
}

export interface Permisos {
  dashboard: Partial<AccionesModulo>
  pedidos: Partial<AccionesModulo>
  clientes: Partial<AccionesModulo>
  inventario: Partial<AccionesModulo>
  usuarios: Partial<AccionesModulo>
  perfiles: Partial<AccionesModulo>
  estadisticas: Partial<AccionesModulo>
}
export interface Perfil {
  id: string
  nombre: string
  descripcion: string
  permisos: Permisos
}
export interface Usuario {
  id: string
  nombre: string
  documento: string
  telefono: string
  usuario: string
  perfil_id: string
  activo: boolean
  primer_ingreso: boolean
  created_at: string
  perfil?: Perfil
}
export interface Cliente {
  id: string
  codigo: string
  nit: string
  nombre: string
  razon_social: string
  municipio: string
  barrio: string
  direccion: string
  telefono: string
  ruta_id: string | null
  activo: boolean
  created_at: string
}
export interface Ruta {
  id: string
  nombre: string
  descripcion: string
  activo: boolean
  created_at: string
}
export interface AsignacionRuta {
  id: string
  usuario_id: string
  dia_semana: number
  ruta_id: string | null
  descanso: boolean
  quincena: number
  created_at: string
}
export interface Festivo {
  id: string
  fecha: string
  created_at: string
}
export interface Producto {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  unidad: string
  precio: number
  stock: number
  stock_minimo: number
  grupo: string
  activo: boolean
}
export interface PedidoItem {
  id: string
  pedido_id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto?: Producto
}
export interface Pedido {
  id: string
  cliente_id: string
  usuario_id: string
  estado: 'borrador' | 'confirmado' | 'entregado' | 'cancelado'
  observaciones: string
  total: number
  created_at: string
  cliente?: Cliente
  usuario?: Usuario
  items?: PedidoItem[]
}
