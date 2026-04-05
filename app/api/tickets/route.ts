import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { generarHashVeriFactu, obtenerProximoNumeroTicket, crearEstructuraVeriFactu } from '@/lib/verifactu'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const estado = searchParams.get('estado')

    let query = 'SELECT * FROM tickets'
    const params: any[] = []

    if (estado) {
      query += ' WHERE estado = $1'
      params.push(estado)
    }

    query += ' ORDER BY id DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)
    params.push(limit, offset)

    const result = await sql(query, params)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Obtener próximo número
    const numero = await obtenerProximoNumeroTicket(data.serie || 'A')
    
    // Preparar datos VeriFactu
    const veriFactuData = {
      ...data,
      numero,
      serie: data.serie || 'A',
    }

    // Generar hash
    const hashActual = await generarHashVeriFactu(veriFactuData)
    veriFactuData.hash_actual = hashActual

    // Crear ticket
    const result = await sql`
      INSERT INTO tickets (
        numero, serie, fecha, items, importe_neto, importe_impuesto, importe_total,
        hash_anterior, hash_actual, tipo_factura, estado, metadata, created_at
      )
      VALUES (
        ${veriFactuData.numero},
        ${veriFactuData.serie},
        NOW(),
        ${JSON.stringify(veriFactuData.items)},
        ${veriFactuData.importe_neto},
        ${veriFactuData.importe_impuesto},
        ${veriFactuData.importe_total},
        ${veriFactuData.hash_anterior || ''},
        ${hashActual},
        'F2',
        'pendiente',
        ${JSON.stringify(veriFactuData.metadata || {})},
        NOW()
      )
      RETURNING *
    `

    // Agregar a cola de sincronización
    await sql`
      INSERT INTO sync_queue (tabla, operacion, datos, timestamp)
      VALUES ('tickets', 'insert', ${JSON.stringify(result[0])}, NOW())
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, estado, metadata } = await request.json()

    const result = await sql`
      UPDATE tickets 
      SET estado = ${estado}, metadata = ${JSON.stringify(metadata)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    // Agregar a cola de sincronización
    await sql`
      INSERT INTO sync_queue (tabla, operacion, datos, timestamp)
      VALUES ('tickets', 'update', ${JSON.stringify(result[0])}, NOW())
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
