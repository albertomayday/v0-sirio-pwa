import crypto from 'crypto'
import { sql } from './db'

export interface VeriFactuData {
  numero: number
  serie: string
  fecha: string
  hash_anterior?: string
  hash_actual: string
  importe_total: number
  importe_neto: number
  importe_impuesto: number
  tipo_factura: string // F2 for simplified invoice
  estado: string
}

export async function generarHashVeriFactu(data: any): Promise<string> {
  // Obtener el hash anterior para encadenamiento
  const result = await sql`
    SELECT hash_actual FROM tickets 
    WHERE id < ${data.id || 999999}
    ORDER BY id DESC
    LIMIT 1
  `
  
  const hashAnterior = result[0]?.hash_actual || ''
  
  // Construir cadena para hash: numero|serie|fecha|importe|hash_anterior
  const cadenaHash = `${data.numero}|${data.serie}|${data.fecha}|${data.importe_total}|${hashAnterior}`
  
  // Generar SHA-256
  const hash = crypto
    .createHash('sha256')
    .update(cadenaHash)
    .digest('hex')
    .toUpperCase()
  
  return hash
}

export async function obtenerProximoNumeroTicket(serie: string = 'A'): Promise<number> {
  const result = await sql`
    SELECT MAX(numero) as max_numero 
    FROM tickets 
    WHERE serie = ${serie}
    AND estado = 'completado'
  `
  
  const maxNumero = result[0]?.max_numero || 0
  return maxNumero + 1
}

export async function validarSecuenciaVeriFactu(ticket: any): Promise<boolean> {
  // Validar que los números sean secuenciales
  const ultimoTicket = await sql`
    SELECT numero, hash_actual 
    FROM tickets 
    WHERE serie = ${ticket.serie}
    AND id < ${ticket.id}
    ORDER BY numero DESC
    LIMIT 1
  `
  
  if (ultimoTicket.length === 0) {
    return ticket.numero === 1
  }
  
  return ticket.numero === ultimoTicket[0].numero + 1
}

export function crearEstructuraVeriFactu(data: any): VeriFactuData {
  return {
    numero: data.numero,
    serie: data.serie || 'A',
    fecha: new Date().toISOString().split('T')[0],
    hash_anterior: data.hash_anterior,
    hash_actual: data.hash_actual,
    importe_total: data.importe_total,
    importe_neto: data.importe_neto,
    importe_impuesto: data.importe_impuesto,
    tipo_factura: 'F2', // Factura simplificada
    estado: 'pendiente',
  }
}
