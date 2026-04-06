import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { productoSchema, productoUpdateSchema, validateOrThrow, sanitizeString } from '@/lib/validation'

export async function GET() {
  try {
    const result = await sql`
      SELECT id, name, price, cat_id as cat, badge, stock, activo
      FROM productos 
      WHERE activo = true
      ORDER BY cat_id, name
    `
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching productos:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = validateOrThrow(productoSchema, body)
    
    // Sanitizar strings
    const name = sanitizeString(data.name)
    const badge = data.badge ? sanitizeString(data.badge) : ''
    
    const result = await sql`
      INSERT INTO productos (name, price, cat_id, badge, stock, activo, created_at)
      VALUES (${name}, ${data.price}, ${data.cat_id}, ${badge}, ${data.stock || 0}, true, NOW())
      RETURNING id, name, price, cat_id as cat, badge, stock, activo
    `
    
    return NextResponse.json({ success: true, data: result[0] }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Validation failed')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    console.error('Error creating producto:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const data = validateOrThrow(productoUpdateSchema, body)
    
    const name = sanitizeString(data.name)
    const badge = data.badge ? sanitizeString(data.badge) : ''
    
    const result = await sql`
      UPDATE productos 
      SET name = ${name}, price = ${data.price}, cat_id = ${data.cat_id}, 
          badge = ${badge}, stock = ${data.stock || 0}, activo = ${data.activo ?? true},
          updated_at = NOW()
      WHERE id = ${data.id}
      RETURNING id, name, price, cat_id as cat, badge, stock, activo
    `
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true, data: result[0] })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Validation failed')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    console.error('Error updating producto:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    
    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'ID de producto requerido' }, { status: 400 })
    }
    
    // Soft delete: marcar como inactivo en lugar de eliminar
    const result = await sql`
      UPDATE productos SET activo = false, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting producto:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
