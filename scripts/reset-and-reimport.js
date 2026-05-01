#!/usr/bin/env node
// scripts/reset-and-reimport.js — Remet les encaissements au propre depuis le CSV Stripe
// Usage : node scripts/reset-and-reimport.js /path/to/unified_payments.csv

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node scripts/reset-and-reimport.js /path/to/file.csv')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ─── CSV Parser ──────────────────────────────────────────────────────────────

function parseRow(line) {
  const cols = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuote = !inQuote }
    else if (line[i] === ',' && !inQuote) { cols.push(cur); cur = '' }
    else { cur += line[i] }
  }
  cols.push(cur)
  return cols
}

function parseCSV(content) {
  const lines = content.trim().split('\n')
  const header = parseRow(lines[0])
  return lines.slice(1).map(l => {
    const cols = parseRow(l)
    const obj = {}
    header.forEach((h, i) => obj[h] = (cols[i] || '').trim())
    return obj
  })
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Charge les élèves actifs
  const { rows: eleves } = await pool.query(
    `SELECT id::text, nom, email, email_paiement FROM eleves WHERE actif = true`
  )

  const emailToEleve = {}
  for (const e of eleves) {
    if (e.email) emailToEleve[e.email.toLowerCase().trim()] = e
    if (e.email_paiement) emailToEleve[e.email_paiement.toLowerCase().trim()] = e
  }

  const eleveIds = eleves.map(e => e.id)
  console.log(`${eleves.length} élèves actifs :`, eleves.map(e => e.nom).join(', '))

  // 2. Parse CSV — filtre Paid + email élève
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'))
  const payments = rows
    .filter(r => {
      const email = (r['Customer Email'] || '').toLowerCase().trim()
      const status = r['Status']
      return status === 'Paid' && emailToEleve[email]
    })
    .map(r => ({
      id: r['id'],
      date: r['Created date (UTC)'].slice(0, 10),
      amount: parseFloat(r['Amount'].replace(',', '.')),
      email: r['Customer Email'].toLowerCase().trim(),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  console.log(`\n${payments.length} paiements Stripe à importer :`)
  payments.forEach(p => console.log(`  ${p.date}  ${p.email}  ${p.amount}€  [${p.id}]`))

  // 3. Reset : vide alertes_paiement + remet toutes les échéances à non-encaissé
  console.log('\n🗑  Remise à zéro...')
  await pool.query(`DELETE FROM alertes_paiement`)
  await pool.query(
    `UPDATE echeances SET encaisse = false, date_encaissement = NULL WHERE eleve_id = ANY($1::uuid[])`,
    [eleveIds]
  )
  // Supprime les échéances ad-hoc (montants non-standard créées par les scripts)
  // = les échéances qui ne correspondent à aucun des montants standards du CSV pour cet élève
  // Pour David Marangoni : ses échéances 199€ ne correspondent pas à ses vrais paiements
  // → on supprime et on recréera depuis le CSV
  for (const eleve of eleves) {
    const elevePays = payments.filter(p => emailToEleve[p.email]?.id === eleve.id)
    if (elevePays.length === 0) continue

    const amounts = elevePays.map(p => p.amount)
    // Récupère les échéances standard
    const { rows: echs } = await pool.query(
      `SELECT id, montant FROM echeances WHERE eleve_id = $1 ORDER BY date_prelevement ASC`,
      [eleve.id]
    )
    // Si AUCUNE échéance ne correspond aux montants du CSV → on supprime tout et on crée depuis CSV
    const anyMatch = echs.some(ec => amounts.some(a => Math.abs(parseFloat(ec.montant) - a) < 0.02))
    if (!anyMatch && echs.length > 0) {
      console.log(`  ⚠ ${eleve.nom} : aucune échéance ne correspond aux montants CSV → suppression et recréation`)
      await pool.query(`DELETE FROM echeances WHERE eleve_id = $1`, [eleve.id])
      // Crée une nouvelle échéance par paiement CSV
      const { rows: inscRows } = await pool.query(
        `SELECT id FROM inscriptions_financieres WHERE eleve_id = $1 ORDER BY date_inscription ASC LIMIT 1`,
        [eleve.id]
      )
      if (inscRows.length > 0) {
        for (const p of elevePays) {
          await pool.query(
            `INSERT INTO echeances (inscription_id, eleve_id, date_prelevement, montant, encaisse)
             VALUES ($1, $2, $3, $4, false)`,
            [inscRows[0].id, eleve.id, p.date, p.amount]
          )
        }
        console.log(`    → ${elevePays.length} nouvelles échéances créées`)
      }
    }
  }

  // 4. Réimporte les paiements CSV
  console.log('\n✅ Import des paiements...')
  let imported = 0
  let skipped = 0

  for (const p of payments) {
    const eleve = emailToEleve[p.email]
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Trouve la plus ancienne échéance non-encaissée avec le bon montant
      const { rows: echs } = await client.query(
        `SELECT id FROM echeances
         WHERE eleve_id = $1 AND encaisse = false AND ABS(montant - $2) < 0.02
         ORDER BY date_prelevement ASC LIMIT 1`,
        [eleve.id, p.amount]
      )

      if (echs.length === 0) {
        console.log(`  ✗ Pas d'échéance pour ${eleve.nom} ${p.amount}€ ${p.date}`)
        skipped++
        await client.query('ROLLBACK')
        continue
      }

      await client.query(
        `UPDATE echeances SET encaisse = true, date_encaissement = $2 WHERE id = $1`,
        [echs[0].id, p.date]
      )

      // Trace dans alertes_paiement pour déduplication future
      await client.query(
        `INSERT INTO alertes_paiement (stripe_email, stripe_nom, montant, stripe_payment_id, statut, eleve_id, echeance_id)
         VALUES ($1, $2, $3, $4, 'assigne', $5, $6)
         ON CONFLICT (stripe_payment_id) DO NOTHING`,
        [p.email, eleve.nom, p.amount, p.id, eleve.id, echs[0].id]
      )

      await client.query('COMMIT')
      console.log(`  ✓ ${eleve.nom}  ${p.amount}€  ${p.date}`)
      imported++
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`  ✗ Erreur ${eleve.nom}:`, err.message)
    } finally {
      client.release()
    }
  }

  console.log(`\n─────────────────────────────`)
  console.log(`✓ ${imported} paiements importés`)
  if (skipped) console.log(`✗ ${skipped} sans échéance correspondante`)
  console.log('\nÉtat final des échéances :')

  const { rows: summary } = await pool.query(`
    SELECT e.nom, ec.montant, ec.date_prelevement, ec.encaisse, ec.date_encaissement
    FROM echeances ec JOIN eleves e ON e.id = ec.eleve_id
    ORDER BY e.nom, ec.date_prelevement
  `)
  summary.forEach(r => {
    const status = r.encaisse ? `✓ encaissé ${r.date_encaissement?.toISOString?.()?.slice(0,10) ?? ''}` : '○ à venir'
    const date = r.date_prelevement?.toISOString?.()?.slice(0,10) ?? r.date_prelevement
    console.log(`  ${r.nom.padEnd(22)} ${String(r.montant).padEnd(8)} ${date}  ${status}`)
  })

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
