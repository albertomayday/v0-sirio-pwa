import { z } from 'zod'

// ── Configuración ───────────────────────────────────────────────────────────
export const configSchema = z.object({
  biz_name: z.string().min(1).max(100),
  biz_type: z.string().min(1).max(50),
  iva: z.number().min(0).max(100),
  currency: z.string().length(1),
  iva_incluido: z.boolean(),
  use_mesas: z.boolean(),
  use_inventario: z.boolean(),
  offline_mode: z.boolean(),
  stock_alert: z.boolean(),
  pay_methods: z.object({
    efectivo: z.boolean().optional(),
    tarjeta: z.boolean().optional(),
    bizum: z.boolean().optional(),
  }),
  num_mesas: z.number().int().min(1).max(100),
  mesa_prefix: z.string().max(20),
})

// ── Categorías ──────────────────────────────────────────────────────────────
export const categoriaSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  orden: z.number().int().min(0).optional(),
})

// ── Productos ───────────────────────────────────────────────────────────────
export const productoSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(100),
  price: z.number().min(0),
  cat_id: z.string().min(1).max(50),
  badge: z.string().max(20).optional(),
  stock: z.number().int().min(0).optional(),
  activo: z.boolean().optional(),
})

export const productoUpdateSchema = productoSchema.extend({
  id: z.number().int().positive(),
})

// ── Usuarios ────────────────────────────────────────────────────────────────
export const usuarioSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  activo: z.boolean().optional(),
  ventas: z.number().int().min(0).optional(),
  total: z.number().min(0).optional(),
})

// ── Mesas ───────────────────────────────────────────────────────────────────
export const mesaSchema = z.object({
  id: z.number().int().positive(),
  estado: z.enum(['libre', 'ocupada', 'reservada']),
  comanda: z.array(z.any()).optional(),
  usuario_id: z.string().nullable().optional(),
  hora: z.string().nullable().optional(),
})

// ── Items del ticket ────────────────────────────────────────────────────────
export const ticketItemSchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string().min(1),
  qty: z.number().int().positive(),
  price: z.number().min(0),
  cat: z.string().optional(),
})

// ── Tickets VeriFactu ───────────────────────────────────────────────────────
export const ticketCreateSchema = z.object({
  serie: z.string().min(1).max(5).default('A'),
  items: z.array(ticketItemSchema).min(1),
  subtotal: z.number().min(0),
  iva_amount: z.number().min(0),
  total: z.number().min(0),
  metodo_pago: z.enum(['efectivo', 'tarjeta', 'bizum']),
  mesa_id: z.number().int().positive().optional(),
  usuario_id: z.string().optional(),
  usuario_name: z.string().optional(),
  destinatario_nif: z.string().max(15).optional(),
  destinatario_nombre: z.string().max(100).optional(),
})

export const ticketUpdateSchema = z.object({
  id: z.number().int().positive(),
  tipo_factura: z.enum(['F1', 'F2', 'R1', 'R2', 'R3', 'R4', 'R5']).optional(),
})

// ── Sincronización ──────────────────────────────────────────────────────────
export const syncRequestSchema = z.object({
  lastSync: z.string().datetime().optional(),
  deviceId: z.string().min(1).max(100).optional(),
  changes: z.array(z.object({
    table_name: z.string(),
    operation_type: z.enum(['insert', 'update', 'delete']),
    record_id: z.string(),
    data: z.any(),
    client_timestamp: z.string().datetime().optional(),
  })).optional(),
})

// ── Helpers de validación ───────────────────────────────────────────────────
export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    throw new Error(`Validation failed: ${errors}`)
  }
  return result.data
}

export function sanitizeString(str: string): string {
  // Eliminar caracteres potencialmente peligrosos
  return str
    .replace(/<[^>]*>/g, '') // Eliminar HTML
    .replace(/[<>'"`;]/g, '') // Eliminar caracteres SQL/XSS
    .trim()
}

export function sanitizeNumeric(value: unknown): number | null {
  if (typeof value === 'number' && !isNaN(value)) return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? null : parsed
  }
  return null
}
