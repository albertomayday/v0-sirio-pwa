import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const result = await sql`SELECT data FROM config WHERE id = 1`
    const config = result[0]?.data || {}
    return NextResponse.json(config)
  } catch (error) {
    console.error('Error fetching config:', error)
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    await sql`UPDATE config SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = 1`
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}
