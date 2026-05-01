import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import pool from '@/lib/db'

function validateSignature(rawBody: string, header: string, secret: string): boolean {
  // Format Stripe : "t=timestamp,v1=hex_signature"
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

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhooks/stripe] STRIPE_WEBHOOK_SECRET manquant')
    return NextResponse.json({ error: 'Configuration manquante' }, { status: 500 })
  }

  const rawBody = await req.text()
  const sigHeader = req.headers.get('stripe-signature') ?? ''

  if (!validateSignature(rawBody, sigHeader, secret)) {
    console.warn('[webhooks/stripe] Signature invalide')
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
  }

  let event: { type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ ok: true })
  }

  const pi = event.data.object
  const stripeEmail = (
    (pi.receipt_email as string) ||
    ((pi.charges as { data?: Array<{ billing_details?: { email?: string } }> })?.data?.[0]?.billing_details?.email) ||
    ''
  ).toLowerCase().trim()

  const stripeNom = (
    ((pi.charges as { data?: Array<{ billing_details?: { name?: string } }> })?.data?.[0]?.billing_details?.name) || ''
  ).trim()

  const montant = typeof pi.amount === 'number' ? pi.amount / 100 : 0
  const stripePaymentId = pi.id as string
  const paymentDate = typeof pi.created === 'number'
    ? new Date(pi.created * 1000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  if (!stripeEmail && !stripeNom) {
    console.warn('[webhooks/stripe] Aucun email ni nom dans le payment_intent', stripePaymentId)
    return NextResponse.json({ ok: true })
  }

  // Vérifie doublon
  const { rows: existing } = await pool.query(
    `SELECT id FROM alertes_paiement WHERE stripe_payment_id = $1`,
    [stripePaymentId]
  )
  if (existing.length > 0) return NextResponse.json({ ok: true })

  try {
    // 1. Matching par email exact
    if (stripeEmail) {
      const { rows } = await pool.query(
        `SELECT id::text FROM eleves
         WHERE actif = true AND (
           LOWER(TRIM(email)) = $1 OR
           LOWER(TRIM(email_paiement)) = $1
         )
         LIMIT 1`,
        [stripeEmail]
      )
      if (rows.length > 0) {
        await encaisserEcheance(rows[0].id, montant, stripeEmail, null, paymentDate)
        console.log('[webhooks/stripe] Encaissé par email:', stripeEmail, montant)
        return NextResponse.json({ ok: true })
      }
    }

    // 2. Matching par nom normalisé
    if (stripeNom) {
      const nomNorm = normalizeName(stripeNom)
      const { rows: eleves } = await pool.query(
        `SELECT id::text, nom FROM eleves WHERE actif = true`
      )

      const matches = eleves.filter(e =>
        normalizeName(e.nom) === nomNorm
      )

      if (matches.length === 1) {
        await encaisserEcheance(matches[0].id, montant, stripeEmail, stripeNom, paymentDate)
        console.log('[webhooks/stripe] Encaissé par nom:', stripeNom, montant)
        return NextResponse.json({ ok: true })
      }

      if (matches.length > 1) {
        // Homonymes → alerte avec candidats
        await creerAlerte(stripeEmail, stripeNom, montant, stripePaymentId, {
          type: 'homonymes',
          candidats: matches.map(m => ({ id: m.id, nom: m.nom })),
        })
        console.warn('[webhooks/stripe] Homonymes pour:', stripeNom)
        return NextResponse.json({ ok: true })
      }
    }

    // 3. Aucun match → alerte
    await creerAlerte(stripeEmail, stripeNom, montant, stripePaymentId, null)
    console.warn('[webhooks/stripe] Aucun élève trouvé:', stripeEmail, stripeNom)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhooks/stripe] Erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function encaisserEcheance(
  eleveId: string,
  montant: number,
  stripeEmail: string,
  stripeNom: string | null,
  paymentDate: string
) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const today = paymentDate

    // Plus ancienne échéance non-encaissée avec le bon montant
    const { rows } = await client.query(
      `SELECT id FROM echeances
       WHERE eleve_id = $1 AND encaisse = false AND ABS(montant - $2) < 0.02
       ORDER BY date_prelevement ASC
       LIMIT 1`,
      [eleveId, montant]
    )

    if (rows.length === 0) {
      // Pas d'échéance correspondante → alerte quand même
      await client.query('ROLLBACK')
      await creerAlerte(stripeEmail, stripeNom ?? '', montant, `no-echeance-${Date.now()}`, {
        type: 'eleve_trouve_sans_echeance',
        eleve_id: eleveId,
      })
      return
    }

    await client.query(
      `UPDATE echeances SET encaisse = true, date_encaissement = $2 WHERE id = $1`,
      [rows[0].id, today]
    )

    // Sauvegarde email_paiement si absent et email fourni
    if (stripeEmail) {
      await client.query(
        `UPDATE eleves SET email_paiement = $2
         WHERE id = $1 AND email_paiement IS NULL`,
        [eleveId, stripeEmail]
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function creerAlerte(
  stripeEmail: string,
  stripeNom: string,
  montant: number,
  stripePaymentId: string,
  meta: unknown
) {
  await pool.query(
    `INSERT INTO alertes_paiement
       (stripe_email, stripe_nom, montant, stripe_payment_id, meta)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (stripe_payment_id) DO NOTHING`,
    [stripeEmail, stripeNom, montant, stripePaymentId, meta ? JSON.stringify(meta) : null]
  )
}
