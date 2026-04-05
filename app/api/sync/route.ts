import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { lastSync, deviceId, changes } = await request.json()

    // Obtener cambios desde la última sincronización
    const syncQueue = await sql`
      SELECT * FROM sync_queue 
      WHERE timestamp > ${new Date(lastSync || 0).toISOString()}
      ORDER BY timestamp ASC
    `

    // Guardar cambios locales en la cola
    if (changes && changes.length > 0) {
      for (const change of changes) {
        await sql`
          INSERT INTO sync_queue (tabla, operacion, datos, timestamp, device_id)
          VALUES (
            ${change.tabla},
            ${change.operacion},
            ${JSON.stringify(change.datos)},
            NOW(),
            ${deviceId || 'unknown'}
          )
        `
      }
    }

    const currentTime = new Date().toISOString()

    return NextResponse.json({
      success: true,
      currentTime,
      changes: syncQueue,
      conflictResolution: 'server-wins',
    })
  } catch (error) {
    console.error('Error syncing data:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const since = searchParams.get('since')

    if (!since) {
      return NextResponse.json({ error: 'Missing since parameter' }, { status: 400 })
    }

    const changes = await sql`
      SELECT * FROM sync_queue 
      WHERE timestamp > ${new Date(since).toISOString()}
      ORDER BY timestamp ASC
    `

    return NextResponse.json({
      success: true,
      changes,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching sync changes:', error)
    return NextResponse.json({ error: 'Sync fetch failed' }, { status: 500 })
  }
}
