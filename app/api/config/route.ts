import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { configSchema, validateOrThrow, sanitizeString } from '@/lib/validation'

export async function GET() {
  try {
    const result = await sql`
      SELECT biz_name, biz_type, iva, currency, iva_incluido,
             use_mesas, use_inventario, offline_mode, stock_alert,
             pay_methods, num_mesas, mesa_prefix
      FROM config 
      WHERE id = 1
    `
    
    if (result.length === 0) {
      return NextResponse.json({
        biz_name: 'SIRIO TPV',
        biz_type: 'restaurante',
        iva: 21,
        currency: '€',
        iva_incluido: true,
        use_mesas: true,
        use_inventario: true,
        offline_mode: true,
        stock_alert: true,
        pay_methods: { efectivo: true, tarjeta: true, bizum: true },
        num_mesas: 10,
        mesa_prefix: 'Mesa '
      })
    }
    
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error fetching config:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validar datos de entrada
    const data = validateOrThrow(configSchema, body)
    
    // Sanitizar strings
    const bizName = sanitizeString(data.biz_name)
    const bizType = sanitizeString(data.biz_type)
    const mesaPrefix = sanitizeString(data.mesa_prefix)
    
    // Actualizar configuración
    const result = await sql`
      UPDATE config 
      SET biz_name = ${bizName},
          biz_type = ${bizType},
          iva = ${data.iva},
          currency = ${data.currency},
          iva_incluido = ${data.iva_incluido},
          use_mesas = ${data.use_mesas},
          use_inventario = ${data.use_inventario},
          offline_mode = ${data.offline_mode},
          stock_alert = ${data.stock_alert},
          pay_methods = ${JSON.stringify(data.pay_methods)},
          num_mesas = ${data.num_mesas},
          mesa_prefix = ${mesaPrefix},
          updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `
    
    if (result.length === 0) {
      // Crear si no existe
      await sql`
        INSERT INTO config (
          id, biz_name, biz_type, iva, currency, iva_incluido,
          use_mesas, use_inventario, offline_mode, stock_alert,
          pay_methods, num_mesas, mesa_prefix, updated_at
        ) VALUES (
          1, ${bizName}, ${bizType}, ${data.iva}, ${data.currency}, ${data.iva_incluido},
          ${data.use_mesas}, ${data.use_inventario}, ${data.offline_mode}, ${data.stock_alert},
          ${JSON.stringify(data.pay_methods)}, ${data.num_mesas}, ${mesaPrefix}, NOW()
        )
      `
    }
    
    return NextResponse.json({ success: true, data: result[0] || data })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Validation failed')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    console.error('Error updating config:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
