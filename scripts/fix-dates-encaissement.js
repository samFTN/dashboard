#!/usr/bin/env node
// scripts/fix-dates-encaissement.js — Corrige les date_encaissement à partir des vraies dates Stripe
// Usage : STRIPE_SECRET_KEY=sk_live_... node scripts/fix-dates-encaissement.js

const { Pool } = require('pg')
const https = require('https')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY manquant.')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function stripeRequest(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: 'api.stripe.com', path, method: 'GET',
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

async function main() {
  // Récupère tous les encaissements trackés dans alertes_paiement avec leur echeance_id
  const { rows } = await pool.query(`
    SELECT stripe_payment_id, echeance_id::text
    FROM alertes_paiement
    WHERE statut = 'assigne' AND echeance_id IS NOT NULL AND stripe_payment_id IS NOT NULL
  `)

  console.log(`${rows.length} encaissements à corriger\n`)

  let updated = 0
  let errors = 0

  for (const row of rows) {
    try {
      const pi = await stripeRequest(`/v1/payment_intents/${row.stripe_payment_id}`)
      if (pi.error) {
        console.log(`  ✗ ${row.stripe_payment_id} : ${pi.error.message}`)
        errors++
        continue
      }

      const realDate = new Date(pi.created * 1000).toISOString().slice(0, 10)

      await pool.query(
        `UPDATE echeances SET date_encaissement = $1 WHERE id = $2`,
        [realDate, row.echeance_id]
      )

      console.log(`  ✓ ${row.stripe_payment_id} → ${realDate}`)
      updated++
    } catch (err) {
      console.error(`  ✗ ${row.stripe_payment_id} :`, err.message)
      errors++
    }
  }

  console.log(`\n─────────────────────`)
  console.log(`✓ ${updated} dates corrigées`)
  if (errors) console.log(`✗ ${errors} erreurs`)

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
