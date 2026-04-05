import crypto from 'crypto'
import { sql } from './db'

// ── Tipos VeriFactu según normativa española ────────────────────────────────
export type TipoFactura = 'F1' | 'F2' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
// F1: Factura (incluida factura rectificativa)
// F2: Factura simplificada (ticket)
// R1-R5: Tipos de rectificativa

export interface DatosVeriFactu {
  numero: number
  serie: string
  timestamp_factura: Date
  subtotal: number
  iva_amount: number
  total: number
  hash_anterior: string
  hash_actual: string
  tipo_factura: TipoFactura
  datos_hash: string
}

// ── Generar Hash SHA-256 encadenado según VeriFactu ─────────────────────────
export async function generarHashVeriFactu(data: {
  numero: number
  serie: string
  fecha: string
  subtotal: number
  iva_amount: number
  total: number
}): Promise<{ hash: string; datosHash: string; hashAnterior: string }> {
  
  // 1. Obtener el hash anterior para encadenamiento
  const ultimoTicket = await sql`
    SELECT hash_actual 
    FROM tickets 
    WHERE serie = ${data.serie}
    ORDER BY numero DESC
    LIMIT 1
  `
  
  const hashAnterior = ultimoTicket[0]?.hash_actual || '0'.repeat(64)
  
  // 2. Construir cadena según especificación VeriFactu
  // Formato: NIF|NumeroFactura|Serie|FechaExpedicion|TipoFactura|CuotaTotal|ImporteTotal|Huella|HashAnterior
  // Para simplificado sin NIF emisor configurado usamos placeholder
  const datosHash = [
    'EMISOR_NIF',           // NIF del emisor (placeholder)
    data.numero.toString().padStart(8, '0'),
    data.serie,
    data.fecha,             // YYYY-MM-DD
    'F2',                   // Tipo factura simplificada
    data.iva_amount.toFixed(2),
    data.total.toFixed(2),
    hashAnterior
  ].join('|')
  
  // 3. Generar SHA-256
  const hash = crypto
    .createHash('sha256')
    .update(datosHash, 'utf8')
    .digest('hex')
    .toUpperCase()
  
  return { hash, datosHash, hashAnterior }
}

// ── Obtener próximo número de factura ───────────────────────────────────────
export async function obtenerProximoNumero(serie: string = 'A'): Promise<number> {
  const result = await sql`
    SELECT COALESCE(MAX(numero), 0) as max_numero 
    FROM tickets 
    WHERE serie = ${serie}
  `
  return (result[0]?.max_numero || 0) + 1
}

// ── Validar integridad de la cadena de hashes ───────────────────────────────
export async function validarCadenaHashes(serie: string = 'A'): Promise<{
  valido: boolean
  errores: string[]
  totalTickets: number
}> {
  const tickets = await sql`
    SELECT numero, hash_actual, hash_anterior, datos_hash
    FROM tickets 
    WHERE serie = ${serie}
    ORDER BY numero ASC
  `
  
  const errores: string[] = []
  let hashEsperado = '0'.repeat(64)
  
  for (const ticket of tickets) {
    // Verificar que el hash_anterior coincide con el esperado
    if (ticket.hash_anterior !== hashEsperado) {
      errores.push(`Ticket ${ticket.numero}: hash_anterior no coincide. Esperado: ${hashEsperado.substring(0, 16)}..., Actual: ${ticket.hash_anterior?.substring(0, 16)}...`)
    }
    
    // Verificar que podemos regenerar el hash
    if (ticket.datos_hash) {
      const hashRegenerado = crypto
        .createHash('sha256')
        .update(ticket.datos_hash, 'utf8')
        .digest('hex')
        .toUpperCase()
      
      if (hashRegenerado !== ticket.hash_actual) {
        errores.push(`Ticket ${ticket.numero}: hash_actual no se puede verificar`)
      }
    }
    
    hashEsperado = ticket.hash_actual
  }
  
  return {
    valido: errores.length === 0,
    errores,
    totalTickets: tickets.length
  }
}

// ── Crear registro de auditoría VeriFactu ───────────────────────────────────
export async function registrarEventoAuditoria(
  ticketId: number,
  evento: string,
  datos: Record<string, unknown>
): Promise<void> {
  await sql`
    INSERT INTO sync_queue (table_name, operation_type, record_id, data, created_at)
    VALUES (
      'tickets_audit',
      ${evento},
      ${ticketId.toString()},
      ${JSON.stringify({ ...datos, timestamp: new Date().toISOString() })},
      NOW()
    )
  `
}

// ── Generar QR VeriFactu (datos para código QR) ─────────────────────────────
export function generarDatosQR(ticket: {
  serie: string
  numero: number
  fecha: string
  total: number
  hash: string
}): string {
  // URL base para verificación (placeholder - debería ser la URL oficial de la AEAT)
  const baseUrl = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR'
  const params = new URLSearchParams({
    s: ticket.serie,
    n: ticket.numero.toString(),
    f: ticket.fecha.replace(/-/g, ''),
    i: ticket.total.toFixed(2),
    h: ticket.hash.substring(0, 8) // Primeros 8 caracteres del hash
  })
  
  return `${baseUrl}?${params.toString()}`
}

// ── Crear estructura para envío SOAP VeriFactu ──────────────────────────────
export function crearEstructuraVeriFactu(ticket: {
  ticketId: string
  serie: string
  numero: number
  fecha: string
  subtotal: number
  iva_amount: number
  total: number
  hash: string
  hashAnterior: string
  datosHash: string
  nifEmisor?: string
  nombreEmisor?: string
}): Record<string, unknown> {
  return {
    RegistroFacturacion: {
      IDVersion: '1.0',
      IDFactura: {
        IDEmisorFactura: ticket.nifEmisor || 'EMISOR_NIF',
        NumSerieFactura: ticket.ticketId,
        FechaExpedicionFacturaFacturado: ticket.fecha.replace(/-/g, ''),
      },
      NombreRazonEmisor: ticket.nombreEmisor || 'Negocio Demo',
      TipoFactura: 'F2',
      CuotaTotal: ticket.iva_amount.toFixed(2),
      ImporteTotal: ticket.total.toFixed(2),
      Encadenamiento: {
        PrimerRegistro: ticket.hashAnterior === '0'.repeat(64) ? 'S' : 'N',
        RegistroAnterior: ticket.hashAnterior !== '0'.repeat(64) ? {
          IDEmisorFactura: ticket.nifEmisor || 'EMISOR_NIF',
          HuellaRegistroAnterior: ticket.hashAnterior,
        } : undefined,
      },
      SistemaInformatico: {
        NombreRazon: 'Sirio TPV',
        NIF: 'SIRIO_NIF',
        NombreSistemaInformatico: 'SirioTPV',
        IdSistemaInformatico: 'SIRIO01',
        Version: '1.0',
        NumeroInstalacion: ticket.serie,
        TipoUsoPosibleSoloVerifactu: 'S',
        TipoUsoPosibleMultiOT: 'N',
        IndicadorMultiplesOT: 'N',
      },
      FechaHoraHusoGenRegistro: new Date().toISOString().replace('T', ' ').substring(0, 19),
      TipoHuella: '01',
      Huella: ticket.hash,
    }
  }
}
