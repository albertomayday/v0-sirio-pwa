import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const result = await sql`
      SELECT id, categoria_id, nombre, precio, descripcion, impuesto 
      FROM productos 
      ORDER BY categoria_id, id
    `
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching productos:', error)
    return NextResponse.json({ error: 'Failed to fetch productos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { categoria_id, nombre, precio, descripcion, impuesto } = await request.json()
    const result = await sql`
      INSERT INTO productos (categoria_id, nombre, precio, descripcion, impuesto, created_at)
      VALUES (${categoria_id}, ${nombre}, ${precio}, ${descripcion}, ${impuesto}, NOW())
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error creating producto:', error)
    return NextResponse.json({ error: 'Failed to create producto' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, categoria_id, nombre, precio, descripcion, impuesto } = await request.json()
    const result = await sql`
      UPDATE productos 
      SET categoria_id = ${categoria_id}, nombre = ${nombre}, precio = ${precio}, 
          descripcion = ${descripcion}, impuesto = ${impuesto}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error updating producto:', error)
    return NextResponse.json({ error: 'Failed to update producto' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    await sql`DELETE FROM productos WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting producto:', error)
    return NextResponse.json({ error: 'Failed to delete producto' }, { status: 500 })
  }
}
