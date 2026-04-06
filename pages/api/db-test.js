import { Client } from "pg"

export default async function handler(req, res) {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const result = await client.query("SELECT NOW()")
  await client.end()
  res.json(result.rows)
}
