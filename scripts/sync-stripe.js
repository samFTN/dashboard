#!/usr/bin/env node
// scripts/sync-stripe.js — Rattrapage des paiements Stripe depuis début 2026
// Usage : STRIPE_SECRET_KEY=sk_live_... node scripts/sync-stripe.js
//
// Le script liste tous les payment_intent succeeded depuis 2026-01-01,
// applique la même logique de matching que le webhook, et rapporte le résultat.

const { Pool } = require('pg')
const https = require('https')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY manquant. Usage : STRIPE_SECRET_KEY=sk_live_... node scripts/sync-stripe.js')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.stripe.com',
      path,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

// Récupère tous les payment_intents succeeded depuis created >= timestamp
async function fetchAllPaymentIntents(since) {
  const results = []
  let startingAfter = null
  let page = 0

  while (true) {
    page++
    let url = `/v1/payment_intents?limit=100&created[gte]=${since}&expand[]=data.latest_charge&expand[]=data.customer`
    if (startingAfter) url += `&starting_after=${startingAfter}`

    process.stdout.write(`  Page ${page}…`)
    const data = await stripeRequest(url)

    if (data.error) {
      console.error('\n❌ Erreur Stripe:', data.error.message)
      process.exit(1)
    }

    const succeeded = data.data.filter(pi => pi.status === 'succeeded')
    results.push(...succeeded)
    process.stdout.write(` ${succeeded.length} succeeded\n`)

    if (!data.has_more) break
    startingAfter = data.data[data.data.length - 1].id
  }

  return results
}

// ─── Logique matching (miroir du webhook) ───────────────────────────────────

async function encaisserEcheance(client, eleveId, montant, stripeEmail, stripeNom, stripePaymentId, paymentDate) {
  const today = paymentDate || new Date().toISOString().slice(0, 10)

  const { rows } = await client.query(
    `SELECT id FROM echeances
     WHERE eleve_id = $1 AND encaisse = false AND ABS(montant - $2) < 0.02
     ORDER BY date_prelevement ASC LIMIT 1`,
    [eleveId, montant]
  )

  if (rows.length === 0) return { ok: false, reason: 'pas_echeance' }

  await client.query(
    `UPDATE echeances SET encaisse = true, date_encaissement = $2 WHERE id = $1`,
    [rows[0].id, today]
  )

  if (stripeEmail) {
    await client.query(
      `UPDATE eleves SET email_paiement = $2 WHERE id = $1 AND email_paiement IS NULL`,
      [eleveId, stripeEmail]
    )
  }

  // Enregistre l'encaissement dans alertes_paiement (statut=assigne) pour déduplication future
  await client.query(
    `INSERT INTO alertes_paiement (stripe_email, stripe_nom, montant, stripe_payment_id, statut, eleve_id, echeance_id)
     VALUES ($1, $2, $3, $4, 'assigne', $5, $6)
     ON CONFLICT (stripe_payment_id) DO NOTHING`,
    [stripeEmail || '', stripeNom || '', montant, stripePaymentId, eleveId, rows[0].id]
  )

  return { ok: true, echeanceId: rows[0].id }
}

async function creerAlerte(client, stripeEmail, stripeNom, montant, stripePaymentId, meta) {
  await client.query(
    `INSERT INTO alertes_paiement (stripe_email, stripe_nom, montant, stripe_payment_id, meta)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (stripe_payment_id) DO NOTHING`,
    [stripeEmail, stripeNom, montant, stripePaymentId, meta ? JSON.stringify(meta) : null]
  )
}

async function processPaymentIntent(pi) {
  const stripePaymentId = pi.id

  const charge = pi.latest_charge
  const customer = pi.customer // objet customer expandé (ou null)

  const stripeEmail = (
    pi.receipt_email ||
    charge?.billing_details?.email ||
    customer?.email ||
    ''
  ).toLowerCase().trim()

  const stripeNom = (
    charge?.billing_details?.name ||
    customer?.name ||
    ''
  ).trim()

  const montant = typeof pi.amount === 'number' ? pi.amount / 100 : 0
  const paymentDate = typeof pi.created === 'number'
    ? new Date(pi.created * 1000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  if (!stripeEmail && !stripeNom) {
    return { status: 'skip', reason: 'pas_email_ni_nom' }
  }

  // Vérifie doublon (déjà traité ou déjà en alerte)
  const { rows: existing } = await pool.query(
    `SELECT id FROM alertes_paiement WHERE stripe_payment_id = $1`,
    [stripePaymentId]
  )

  // Vérifie aussi si l'échéance a déjà été encaissée via ce payment_id (pas de table de mapping, on skip si alerte déjà là)
  if (existing.length > 0) {
    return { status: 'skip', reason: 'deja_traite' }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Email exact
    if (stripeEmail) {
      const { rows } = await client.query(
        `SELECT id::text FROM eleves
         WHERE actif = true AND (
           LOWER(TRIM(email)) = $1 OR
           LOWER(TRIM(email_paiement)) = $1
         ) LIMIT 1`,
        [stripeEmail]
      )
      if (rows.length > 0) {
        const result = await encaisserEcheance(client, rows[0].id, montant, stripeEmail, stripeNom, stripePaymentId, paymentDate)
        await client.query('COMMIT')
        if (result.ok) return { status: 'encaisse', method: 'email', stripeEmail, montant }
        // Élève trouvé mais pas d'échéance correspondante
        await creerAlerte(client, stripeEmail, stripeNom, montant, stripePaymentId, {
          type: 'eleve_trouve_sans_echeance', eleve_id: rows[0].id,
        })
        return { status: 'alerte', reason: 'eleve_sans_echeance', stripeEmail, montant }
      }
    }

    // 2. Nom normalisé
    if (stripeNom) {
      const nomNorm = normalizeName(stripeNom)
      const { rows: eleves } = await client.query(
        `SELECT id::text, nom FROM eleves WHERE actif = true`
      )
      const matches = eleves.filter(e => normalizeName(e.nom) === nomNorm)

      if (matches.length === 1) {
        const result = await encaisserEcheance(client, matches[0].id, montant, stripeEmail, stripeNom, stripePaymentId, paymentDate)
        await client.query('COMMIT')
        if (result.ok) return { status: 'encaisse', method: 'nom', stripeNom, montant }
        await creerAlerte(client, stripeEmail, stripeNom, montant, stripePaymentId, {
          type: 'eleve_trouve_sans_echeance', eleve_id: matches[0].id,
        })
        return { status: 'alerte', reason: 'eleve_sans_echeance', stripeNom, montant }
      }

      if (matches.length > 1) {
        await creerAlerte(client, stripeEmail, stripeNom, montant, stripePaymentId, {
          type: 'homonymes', candidats: matches.map(m => ({ id: m.id, nom: m.nom })),
        })
        await client.query('COMMIT')
        return { status: 'alerte', reason: 'homonymes', stripeNom, montant }
      }
    }

    // 3. Aucun match
    await creerAlerte(client, stripeEmail, stripeNom, montant, stripePaymentId, null)
    await client.query('COMMIT')
    return { status: 'alerte', reason: 'aucun_match', stripeEmail, stripeNom, montant }

  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Rattrapage des paiements Stripe depuis 2026-01-01\n')

  const since = Math.floor(new Date('2026-01-01').getTime() / 1000)

  console.log('📡 Récupération des payment_intents Stripe…')
  const paymentIntents = await fetchAllPaymentIntents(since)
  console.log(`\n✅ ${paymentIntents.length} paiements succeeded trouvés\n`)

  if (paymentIntents.length === 0) {
    console.log('Rien à traiter.')
    await pool.end()
    return
  }

  const stats = { encaisse: 0, alerte: 0, skip: 0, erreur: 0 }

  for (const pi of paymentIntents) {
    try {
      const result = await processPaymentIntent(pi)
      stats[result.status] = (stats[result.status] || 0) + 1

      if (result.status === 'encaisse') {
        console.log(`  ✓ Encaissé  [${result.method}] ${result.stripeEmail || result.stripeNom} — ${result.montant}€`)
      } else if (result.status === 'alerte') {
        console.log(`  ⚠ Alerte   [${result.reason}] ${result.stripeEmail || result.stripeNom} — ${result.montant}€`)
      } else {
        console.log(`  · Skip     [${result.reason}] ${pi.id}`)
      }
    } catch (err) {
      stats.erreur++
      console.error(`  ✗ Erreur   ${pi.id}:`, err.message)
    }
  }

  console.log('\n─────────────────────────────')
  console.log(`✓ Encaissés automatiquement : ${stats.encaisse}`)
  console.log(`⚠ Alertes à résoudre manuellement : ${stats.alerte}`)
  console.log(`· Déjà traités (skippés) : ${stats.skip}`)
  if (stats.erreur) console.log(`✗ Erreurs : ${stats.erreur}`)
  console.log('\nLes alertes sont visibles dans le module Finances du dashboard.')

  await pool.end()
}

main().catch(err => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
