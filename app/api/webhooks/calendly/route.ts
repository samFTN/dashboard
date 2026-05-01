import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import pool from '@/lib/db'

interface CalendlyPayload {
  event: string
  payload: {
    event: { start_time: string; end_time: string }
    invitee: { email: string; name: string }
  }
}

function validateSignature(rawBody: string, header: string, secret: string): boolean {
  // Calendly header format: "t=<epoch_seconds>,v1=<hex_signature>"
  // Signed content: "<epoch_seconds>.<rawBody>"
  const parts: Record<string, string> = {}
  for (const part of header.split(',')) {
    const idx = part.indexOf('=')
    if (idx > 0) parts[part.slice(0, idx)] = part.slice(idx + 1)
  }
  if (!parts.t || !parts.v1) return false

  const signedContent = `${parts.t}.${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(signedContent).digest('hex')
  try {
    const expBuf = Buffer.from(expected)
    const recBuf = Buffer.from(parts.v1)
    if (expBuf.length !== recBuf.length) return false
    return crypto.timingSafeEqual(expBuf, recBuf)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhooks/calendly] CALENDLY_WEBHOOK_SECRET manquant')
    return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 })
  }

  const rawBody = await req.text()

  const sigHeader = req.headers.get('Calendly-Webhook-Signature') ?? ''
  if (!validateSignature(rawBody, sigHeader, secret)) {
    console.warn('[webhooks/calendly] Signature invalide')
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
  }

  let payload: CalendlyPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  // Only handle new bookings
  if (payload.event !== 'invitee.created') {
    return NextResponse.json({ ok: true })
  }

  const email = payload.payload?.invitee?.email?.toLowerCase().trim()
  const startTime = payload.payload?.event?.start_time

  if (!email || !startTime) {
    console.warn('[webhooks/calendly] Données manquantes', { email, startTime })
    return NextResponse.json({ ok: true })
  }

  try {
    // Find lead by email (active, not archived)
    const { rows } = await pool.query(
      `SELECT id FROM leads WHERE email = $1 AND archive = false LIMIT 1`,
      [email]
    )

    if (rows.length === 0) {
      console.warn('[webhooks/calendly] Aucun lead trouvé pour:', email)
      return NextResponse.json({ ok: true })
    }

    const leadId = rows[0].id

    await pool.query(
      `UPDATE leads SET
         statut = 'reserve',
         cours_essai_date = $2,
         prochaine_action_type = 'cours_essai',
         prochaine_action_date = $2,
         updated_at = NOW()
       WHERE id = $1`,
      [leadId, startTime]
    )

    console.log('[webhooks/calendly] Lead mis à jour en réservé:', email, startTime)
  } catch (err) {
    console.error('[webhooks/calendly] Erreur DB:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
