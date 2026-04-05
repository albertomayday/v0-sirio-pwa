import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { ticketCreateSchema, ticketUpdateSchema, validateOrThrow } from '@/lib/validation'
import { generarHashVeriFactu, obtenerProximoNumero, registrarEventoAuditoria, generarDatosQR, crearEstructuraVeriFactu } from '@/lib/verifactu'

// ── Rate limiting simple (en producción usar Upstash o similar) ─────────────
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 100 // requests
const RATE_WINDOW = 60000 // 1 minuto

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = requestCounts.get(ip)
  
  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }
  
  if (record.count >= RATE_LIMIT) {
    return false
  }
  
  record.count++
  return true
}

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') || 
         'unknown'
}

// ── GET: Listar tickets ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)
    const serie = searchParams.get('serie')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    let tickets
    
    if (serie && desde && hasta) {
      tickets = await sql`
        SELECT id, ticket_id, serie, numero, timestamp_factura, subtotal, iva_amount, 
               total, metodo_pago, mesa_id, usuario_id, usuario_name, tipo_factura,
               hash_actual, items, created_at
        FROM tickets 
        WHERE serie = ${serie}
          AND timestamp_factura >= ${desde}::timestamp
          AND timestamp_factura <= ${hasta}::timestamp
        ORDER BY numero DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (serie) {
      tickets = await sql`
        SELECT id, ticket_id, serie, numero, timestamp_factura, subtotal, iva_amount, 
               total, metodo_pago, mesa_id, usuario_id, usuario_name, tipo_factura,
               hash_actual, items, created_at
        FROM tickets 
        WHERE serie = ${serie}
        ORDER BY numero DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      tickets = await sql`
        SELECT id, ticket_id, serie, numero, timestamp_factura, subtotal, iva_amount, 
               total, metodo_pago, mesa_id, usuario_id, usuario_name, tipo_factura,
               hash_actual, items, created_at
        FROM tickets 
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    }

    return NextResponse.json({
      success: true,
      data: tickets,
      pagination: { limit, offset }
    })
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ── POST: Crear ticket con VeriFactu ────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const body = await request.json()
    
    // Validar datos de entrada
    const data = validateOrThrow(ticketCreateSchema, body)
    
    // Obtener próximo número de factura
    const numero = await obtenerProximoNumero(data.serie)
    const fecha = new Date().toISOString().split('T')[0]
    const timestampFactura = new Date()
    
    // Generar hash VeriFactu
    const { hash, datosHash, hashAnterior } = await generarHashVeriFactu({
      numero,
      serie: data.serie,
      fecha,
      subtotal: data.subtotal,
      iva_amount: data.iva_amount,
      total: data.total
    })
    
    // Crear estructura VeriFactu (payload para envío SOAP a AEAT)
    // PLACEHOLDER: estructura generada y encolada — envío real pendiente de certificado .pfx
    const estructuraVF = crearEstructuraVeriFactu({
      ticketId: `${data.serie}-${numero.toString().padStart(8, '0')}`,
      serie: data.serie,
      numero,
      fecha,
      subtotal: data.subtotal,
      iva_amount: data.iva_amount,
      total: data.total,
      hash,
      hashAnterior,
      datosHash,
    })

    // Encolar para sincronización futura con AEAT
    // En producción: sustituir por envío SOAP real con certificado .pfx
    console.info('[VeriFactu] Estructura generada (pendiente envío AEAT):', estructuraVF.RegistroFacturacion?.IDFactura)

    // Generar ID único del ticket
    const ticketId = `${data.serie}-${numero.toString().padStart(8, '0')}`
    
    // Insertar en base de datos
    const result = await sql`
      INSERT INTO tickets (
        ticket_id, serie, numero, timestamp_factura, items,
        subtotal, iva_amount, total, metodo_pago, mesa_id,
        usuario_id, usuario_name, tipo_factura,
        hash_anterior, hash_actual, datos_hash,
        destinatario_nif, destinatario_nombre, created_at
      )
      VALUES (
        ${ticketId},
        ${data.serie},
        ${numero},
        ${timestampFactura.toISOString()},
        ${JSON.stringify(data.items)},
        ${data.subtotal},
        ${data.iva_amount},
        ${data.total},
        ${data.metodo_pago},
        ${data.mesa_id || null},
        ${data.usuario_id || null},
        ${data.usuario_name || null},
        'F2',
        ${hashAnterior},
        ${hash},
        ${datosHash},
        ${data.destinatario_nif || null},
        ${data.destinatario_nombre || null},
        NOW()
      )
      RETURNING *
    `

    const ticket = result[0]
    
    // Registrar evento de auditoría
    await registrarEventoAuditoria(ticket.id, 'ticket_created', {
      ticket_id: ticketId,
      total: data.total,
      metodo_pago: data.metodo_pago,
      ip_origen: ip
    })

    // Generar datos para QR
    const qrData = generarDatosQR({
      serie: data.serie,
      numero,
      fecha,
      total: data.total,
      hash
    })

    return NextResponse.json({
      success: true,
      data: {
        ...ticket,
        qr_verificacion: qrData
      }
    }, { status: 201 })
    
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Validation failed')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    console.error('Error creating ticket:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ── PUT: Actualizar tipo de factura (rectificativas) ────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const data = validateOrThrow(ticketUpdateSchema, body)

    // Solo permitir cambiar a tipos rectificativos
    if (data.tipo_factura && !data.tipo_factura.startsWith('R')) {
      return NextResponse.json(
        { error: 'Solo se permite cambiar a facturas rectificativas (R1-R5)' },
        { status: 400 }
      )
    }

    const result = await sql`
      UPDATE tickets 
      SET tipo_factura = ${data.tipo_factura}
      WHERE id = ${data.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Registrar evento de auditoría
    await registrarEventoAuditoria(data.id, 'ticket_rectified', {
      nuevo_tipo: data.tipo_factura,
      ip_origen: ip
    })

    return NextResponse.json({
      success: true,
      data: result[0]
    })
    
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Validation failed')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    console.error('Error updating ticket:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
