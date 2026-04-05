import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const result = await sql`SELECT id, nombre, color FROM categorias ORDER BY id`
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching categorias:', error)
    return NextResponse.json({ error: 'Failed to fetch categorias' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { nombre, color } = await request.json()
    const result = await sql`
      INSERT INTO categorias (nombre, color, created_at)
      VALUES (${nombre}, ${color}, NOW())
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error creating categoria:', error)
    return NextResponse.json({ error: 'Failed to create categoria' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, nombre, color } = await request.json()
    const result = await sql`
      UPDATE categorias 
      SET nombre = ${nombre}, color = ${color}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error updating categoria:', error)
    return NextResponse.json({ error: 'Failed to update categoria' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    await sql`DELETE FROM categorias WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting categoria:', error)
    return NextResponse.json({ error: 'Failed to delete categoria' }, { status: 500 })
  }
}
