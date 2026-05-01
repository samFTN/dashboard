import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

// Vérifie la signature via l'API PayPal
async function validatePaypalWebhook(
  rawBody: string,
  headers: Headers
): Promise<boolean> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  const webhookId = process.env.PAYPAL_WEBHOOK_ID

  if (!clientId || !clientSecret || !webhookId) return false

  // Obtenir un token d'accès PayPal
  const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const tokenData = await tokenRes.json() as { access_token?: string }
  if (!tokenData.access_token) return false

  // Vérifier la signature via l'API PayPal
  const verifyRes = await fetch('https://api-m.paypal.com/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo:         headers.get('paypal-auth-algo'),
      cert_url:          headers.get('paypal-cert-url'),
      transmission_id:   headers.get('paypal-transmission-id'),
      transmission_sig:  headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id:        webhookId,
      webhook_event:     JSON.parse(rawBody),
    }),
  })
  const verifyData = await verifyRes.json() as { verification_status?: string }
  return verifyData.verification_status === 'SUCCESS'
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

function inferFormule(montant: number): {
  formule: string; montantTotal: number; mode: string; nb: number; dureeMois: number
} | null {
  if (Math.abs(montant - 150) < 1)   return { formule: 'test_1_mois_molk35qh',      montantTotal: 150, mode: 'paypal', nb: 1, dureeMois: 1 }
  if (Math.abs(montant - 497) < 1)   return { formule: 'programme_3_mois_molk0h06', montantTotal: 497, mode: 'paypal', nb: 1, dureeMois: 3 }
  if (Math.abs(montant - 597) < 1)   return { formule: 'programme_4_mois',          montantTotal: 597, mode: 'paypal', nb: 1, dureeMois: 4 }
  if (Math.abs(montant - 298.5) < 1) return { formule: 'programme_4_mois',          montantTotal: 597, mode: 'cb_2x', nb: 2, dureeMois: 4 }
  if (Math.abs(montant - 199) < 1)   return { formule: 'programme_4_mois',          montantTotal: 597, mode: 'cb_3x', nb: 3, dureeMois: 4 }
  return null
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    console.error('[webhooks/paypal] PAYPAL_WEBHOOK_ID manquant')
    return NextResponse.json({ error: 'Configuration manquante' }, { status: 500 })
  }

  const rawBody = await req.text()

  const valid = await validatePaypalWebhook(rawBody, req.headers)
  if (!valid) {
    console.warn('[webhooks/paypal] Signature invalide')
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
  }

  let event: { event_type: string; resource: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return NextResponse.json({ ok: true })
  }

  const resource = event.resource
  const paypalEmail = ((resource.payer as { email_address?: string })?.email_address ?? '').toLowerCase().trim()
  const payerName = (resource.payer as { name?: { given_name?: string; surname?: string } })?.name
  const paypalNom = payerName ? `${payerName.given_name ?? ''} ${payerName.surname ?? ''}`.trim() : ''
  const montant = parseFloat((resource.amount as { value?: string })?.value ?? '0')
  const paypalCaptureId = resource.id as string
  const createTime = resource.create_time as string | undefined
  const paymentDate = createTime ? createTime.slice(0, 10) : new Date().toISOString().slice(0, 10)

  if (!paypalEmail && !paypalNom) {
    console.warn('[webhooks/paypal] Aucun email ni nom dans le capture', paypalCaptureId)
    return NextResponse.json({ ok: true })
  }

  // Dédup via stripe_payment_id (on stocke le capture ID PayPal dans ce champ)
  const { rows: existing } = await pool.query(
    `SELECT id FROM alertes_paiement WHERE stripe_payment_id = $1`,
    [paypalCaptureId]
  )
  if (existing.length > 0) return NextResponse.json({ ok: true })

  try {
    // 1. Email → élève existant
    if (paypalEmail) {
      const { rows } = await pool.query(
        `SELECT id::text FROM eleves
         WHERE actif = true AND (
           LOWER(TRIM(email)) = $1 OR
           LOWER(TRIM(email_paiement)) = $1
         )
         LIMIT 1`,
        [paypalEmail]
      )
      if (rows.length > 0) {
        await encaisserEcheance(rows[0].id, montant, paypalEmail, null, paypalCaptureId, paymentDate)
        console.log('[webhooks/paypal] Encaissé par email (élève):', paypalEmail, montant)
        return NextResponse.json({ ok: true })
      }
    }

    // 2. Nom → élève existant
    if (paypalNom) {
      const nomNorm = normalizeName(paypalNom)
      const { rows: eleves } = await pool.query(`SELECT id::text, nom FROM eleves WHERE actif = true`)
      const matches = eleves.filter(e => normalizeName(e.nom) === nomNorm)

      if (matches.length === 1) {
        await encaisserEcheance(matches[0].id, montant, paypalEmail, paypalNom, paypalCaptureId, paymentDate)
        console.log('[webhooks/paypal] Encaissé par nom (élève):', paypalNom, montant)
        return NextResponse.json({ ok: true })
      }
    }

    // 3. Email → lead actif
    if (paypalEmail) {
      const { rows: leads } = await pool.query(
        `SELECT id::text, nom, email, telephone FROM leads
         WHERE LOWER(TRIM(email)) = $1 AND archive = false
         LIMIT 1`,
        [paypalEmail]
      )
      if (leads.length > 0) {
        await creerEleveDepuisLead(leads[0], montant, paypalEmail, paypalCaptureId, paymentDate)
        console.log('[webhooks/paypal] Lead → élève créé par email:', paypalEmail, montant)
        return NextResponse.json({ ok: true })
      }
    }

    // 4. Nom → lead actif
    if (paypalNom) {
      const nomNorm = normalizeName(paypalNom)
      const { rows: leads } = await pool.query(
        `SELECT id::text, nom, email, telephone FROM leads WHERE archive = false`
      )
      const matches = leads.filter(l => normalizeName(l.nom) === nomNorm)

      if (matches.length === 1) {
        await creerEleveDepuisLead(matches[0], montant, paypalEmail, paypalCaptureId, paymentDate)
        console.log('[webhooks/paypal] Lead → élève créé par nom:', paypalNom, montant)
        return NextResponse.json({ ok: true })
      }
    }

    // 5. Aucun match → alerte
    await creerAlerte(paypalEmail, paypalNom, montant, paypalCaptureId, null)
    console.warn('[webhooks/paypal] Aucun élève ni lead trouvé:', paypalEmail, paypalNom)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhooks/paypal] Erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function creerEleveDepuisLead(
  lead: { id: string; nom: string; email: string; telephone: string },
  montant: number,
  emailPaiement: string,
  captureId: string,
  paymentDate: string
) {
  const inf = inferFormule(montant)
  if (!inf) {
    await creerAlerte(emailPaiement, lead.nom, montant, captureId, {
      type: 'lead_montant_inconnu',
      lead_id: lead.id,
    })
    console.warn('[webhooks/paypal] Montant inconnu pour lead:', lead.nom, montant)
    return
  }

  const { formule, montantTotal, mode, nb, dureeMois } = inf
  const dateFinPrevue = addMonths(paymentDate, dureeMois)
  const montantEcheance = +(montantTotal / nb).toFixed(2)
  const isPaypalFull = nb === 1

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: eleveRows } = await client.query(
      `INSERT INTO eleves
         (nom, email, telephone, lead_id, formule, duree_contractuelle_mois,
          date_debut, date_fin_prevue, prof_dedie_id,
          mode_paiement, montant_total, nb_echeances, email_paiement)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'axel', $9, $10, $11, $12)
       RETURNING id::text`,
      [
        lead.nom, lead.email, lead.telephone, lead.id,
        formule, dureeMois, paymentDate, dateFinPrevue,
        mode, montantTotal, nb,
        emailPaiement || null,
      ]
    )
    const eleveId = eleveRows[0].id

    const { rows: inscRows } = await client.query(
      `INSERT INTO inscriptions_financieres
         (eleve_id, date_inscription, formule, mode_paiement, montant_contracte)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id::text`,
      [eleveId, paymentDate, formule, mode, montantTotal]
    )
    const inscId = inscRows[0].id

    let firstEcheanceId: string | null = null
    for (let i = 0; i < nb; i++) {
      const datePrelevement = addMonths(paymentDate, i)
      const encaisse = i === 0 || isPaypalFull
      const { rows: echRows } = await client.query(
        `INSERT INTO echeances
           (inscription_id, eleve_id, date_prelevement, montant, encaisse, date_encaissement)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id::text`,
        [inscId, eleveId, datePrelevement, montantEcheance, encaisse, encaisse ? paymentDate : null]
      )
      if (i === 0) firstEcheanceId = echRows[0].id
    }

    await client.query(
      `UPDATE leads
       SET eleve_id = $2, statut = 'eleve', archive = true,
           date_archivage = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [lead.id, eleveId]
    )

    await client.query(
      `INSERT INTO alertes_paiement
         (stripe_email, stripe_nom, montant, stripe_payment_id, statut, eleve_id, echeance_id)
       VALUES ($1, $2, $3, $4, 'assigne', $5, $6)
       ON CONFLICT (stripe_payment_id) DO NOTHING`,
      [emailPaiement, lead.nom, montant, captureId, eleveId, firstEcheanceId]
    )

    await client.query('COMMIT')
    console.log('[webhooks/paypal] Élève créé automatiquement:', lead.nom, formule, mode)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function encaisserEcheance(
  eleveId: string,
  montant: number,
  email: string,
  nom: string | null,
  captureId: string,
  paymentDate: string
) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `SELECT id FROM echeances
       WHERE eleve_id = $1 AND encaisse = false AND ABS(montant - $2) < 0.02
       ORDER BY date_prelevement ASC
       LIMIT 1`,
      [eleveId, montant]
    )

    if (rows.length === 0) {
      await client.query('ROLLBACK')
      await creerAlerte(email, nom ?? '', montant, `no-echeance-${Date.now()}`, {
        type: 'eleve_trouve_sans_echeance',
        eleve_id: eleveId,
      })
      return
    }

    await client.query(
      `UPDATE echeances SET encaisse = true, date_encaissement = $2 WHERE id = $1`,
      [rows[0].id, paymentDate]
    )

    if (email) {
      await client.query(
        `UPDATE eleves SET email_paiement = $2 WHERE id = $1 AND email_paiement IS NULL`,
        [eleveId, email]
      )
    }

    await client.query(
      `INSERT INTO alertes_paiement
         (stripe_email, stripe_nom, montant, stripe_payment_id, statut, eleve_id, echeance_id)
       VALUES ($1, $2, $3, $4, 'assigne', $5, $6)
       ON CONFLICT (stripe_payment_id) DO NOTHING`,
      [email, nom, montant, captureId, eleveId, rows[0].id]
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function creerAlerte(
  email: string,
  nom: string,
  montant: number,
  captureId: string,
  meta: unknown
) {
  await pool.query(
    `INSERT INTO alertes_paiement
       (stripe_email, stripe_nom, montant, stripe_payment_id, meta)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (stripe_payment_id) DO NOTHING`,
    [email, nom, montant, captureId, meta ? JSON.stringify(meta) : null]
  )
}
