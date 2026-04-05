import { NextRequest, NextResponse } from 'next/server'
import { validarCadenaHashes } from '@/lib/verifactu'

// ── GET: Verificar integridad de la cadena VeriFactu ────────────────────────
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const serie = searchParams.get('serie') || 'A'
    
    const resultado = await validarCadenaHashes(serie)
    
    return NextResponse.json({
      success: true,
      serie,
      integridad: {
        valida: resultado.valido,
        total_tickets: resultado.totalTickets,
        errores: resultado.errores
      },
      verificado_en: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error verificando cadena VeriFactu:', error)
    return NextResponse.json(
      { error: 'Error al verificar integridad' },
      { status: 500 }
    )
  }
}
