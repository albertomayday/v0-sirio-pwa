import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

export const sql = neon(process.env.DATABASE_URL)

export async function getConfig() {
  const result = await sql`SELECT * FROM config WHERE id = 1`
  return result[0] || null
}

export async function updateConfig(data: any) {
  const result = await sql`
    UPDATE config 
    SET data = ${JSON.stringify(data)}, updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `
  return result[0]
}

export async function getCategorias() {
  return await sql`SELECT * FROM categorias ORDER BY id`
}

export async function getProductos() {
  return await sql`SELECT * FROM productos ORDER BY categoria_id, id`
}

export async function getUsuarios() {
  return await sql`SELECT * FROM usuarios ORDER BY id`
}

export async function getMesas() {
  return await sql`SELECT * FROM mesas ORDER BY numero`
}

export async function getTickets(limit = 100, offset = 0) {
  return await sql`SELECT * FROM tickets ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`
}

export async function getTicketsSyncQueue(since: number) {
  return await sql`SELECT * FROM sync_queue WHERE timestamp > ${since} ORDER BY timestamp`
}
