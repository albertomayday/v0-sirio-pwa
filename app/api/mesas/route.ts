import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const result = await sql`
      SELECT id, numero, estado, items, total, timestamp 
      FROM mesas 
      ORDER BY numero
    `
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching mesas:', error)
    return NextResponse.json({ error: 'Failed to fetch mesas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { numero, estado, items, total } = await request.json()
    const result = await sql`
      INSERT INTO mesas (numero, estado, items, total, timestamp)
      VALUES (${numero}, ${estado}, ${JSON.stringify(items)}, ${total}, NOW())
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error creating mesa:', error)
    return NextResponse.json({ error: 'Failed to create mesa' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, numero, estado, items, total } = await request.json()
    const result = await sql`
      UPDATE mesas 
      SET numero = ${numero}, estado = ${estado}, items = ${JSON.stringify(items)}, 
          total = ${total}, timestamp = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error updating mesa:', error)
    return NextResponse.json({ error: 'Failed to update mesa' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    await sql`DELETE FROM mesas WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting mesa:', error)
    return NextResponse.json({ error: 'Failed to delete mesa' }, { status: 500 })
  }
}
