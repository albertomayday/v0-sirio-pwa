import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { syncRequestSchema, validateOrThrow } from '@/lib/validation'

// ── Rate limiting para sincronización ───────────────────────────────────────
const syncLimits = new Map<string, number>()
const SYNC_INTERVAL = 2000 // Mínimo 2 segundos entre syncs

function checkSyncLimit(deviceId: string): boolean {
  const now = Date.now()
  const lastSync = syncLimits.get(deviceId) || 0
  
  if (now - lastSync < SYNC_INTERVAL) {
    return false
  }
  
  syncLimits.set(deviceId, now)
  return true
}

// ── POST: Sincronización bidireccional ──────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = validateOrThrow(syncRequestSchema, body)
    
    const deviceId = data.deviceId || 'unknown'
    
    if (!checkSyncLimit(deviceId)) {
      return NextResponse.json(
        { error: 'Sync too frequent. Wait at least 2 seconds.' },
        { status: 429 }
      )
    }

    // Obtener cambios desde la última sincronización
    const lastSyncTime = data.lastSync ? new Date(data.lastSync) : new Date(0)
    
    const serverChanges = await sql`
      SELECT id, table_name, operation_type, record_id, data, created_at
      FROM sync_queue 
      WHERE created_at > ${lastSyncTime.toISOString()}
      ORDER BY created_at ASC
      LIMIT 100
    `

    // Guardar cambios del cliente en la cola
    if (data.changes && data.changes.length > 0) {
      for (const change of data.changes) {
        await sql`
          INSERT INTO sync_queue (
            table_name, operation_type, record_id, data, 
            client_timestamp, created_at
          )
          VALUES (
            ${change.table_name},
            ${change.operation_type},
            ${change.record_id},
            ${JSON.stringify(change.data)},
            ${change.client_timestamp || new Date().toISOString()},
            NOW()
          )
        `
      }
    }

    const currentTime = new Date().toISOString()

    return NextResponse.json({
      success: true,
      serverTime: currentTime,
      changes: serverChanges,
      conflictResolution: 'server-wins',
      nextSyncAllowed: Date.now() + SYNC_INTERVAL
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Validation failed')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    console.error('Error syncing data:', error)
    return NextResponse.json(
      { error: 'Error de sincronización' },
      { status: 500 }
    )
  }
}

// ── GET: Obtener cambios desde timestamp ────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const since = searchParams.get('since')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    if (!since) {
      return NextResponse.json(
        { error: 'Parámetro "since" requerido (ISO timestamp)' },
        { status: 400 }
      )
    }

    // Validar formato de fecha
    const sinceDate = new Date(since)
    if (isNaN(sinceDate.getTime())) {
      return NextResponse.json(
        { error: 'Formato de fecha inválido. Use ISO 8601.' },
        { status: 400 }
      )
    }

    const changes = await sql`
      SELECT id, table_name, operation_type, record_id, data, created_at
      FROM sync_queue 
      WHERE created_at > ${sinceDate.toISOString()}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `

    return NextResponse.json({
      success: true,
      changes,
      serverTime: new Date().toISOString(),
      hasMore: changes.length === limit
    })
  } catch (error) {
    console.error('Error fetching sync changes:', error)
    return NextResponse.json(
      { error: 'Error al obtener cambios' },
      { status: 500 }
    )
  }
}
