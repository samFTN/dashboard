// Usage: node scripts/import-leads.js /chemin/vers/leads.csv
// Efface toutes les données de test et importe les leads du CSV Guitarisation.

require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

function parseDate(str) {
  // DD/MM/YYYY → YYYY-MM-DD
  const parts = str.trim().split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function mapEtat(etat) {
  const e = (etat || '').trim()
  if (e === 'Qualifié')    return { statut: 'qualifie', archive: false, raison: null }
  if (e === 'Présent')     return { statut: 'present',  archive: false, raison: null }
  if (e === 'Élève')       return { statut: 'eleve',    archive: true,  raison: null }
  if (e === 'Disqualifié') return { statut: 'nouveau',  archive: true,  raison: 'non_qualifie' }
  return { statut: 'nouveau', archive: false, raison: null }
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: node scripts/import-leads.js /chemin/vers/leads.csv')
    process.exit(1)
  }

  const content = fs.readFileSync(path.resolve(csvPath), 'utf8')
  const lines = content.trim().split('\n')

  // Trouver la ligne d'en-tête (contient "Nom,Email")
  const headerIdx = lines.findIndex(l => l.startsWith('Nom,'))
  const dataLines = lines.slice(headerIdx + 1)

  const rows = []
  for (const line of dataLines) {
    if (!line.trim()) continue
    const cols = line.split(',')
    const nom   = cols[0]?.trim()
    const email = cols[1]?.trim().toLowerCase() || null
    const tel   = cols[2]?.trim() || null
    const dateStr = cols[3]?.trim()
    const etat  = cols[4]?.trim()

    if (!nom || !dateStr || !etat) continue
    const date = parseDate(dateStr)
    if (!date) continue

    rows.push({ nom, email, tel, date, etat })
  }

  // Dédupliquation : même email → dernière occurrence gagne
  // (sans email : clé = nom normalisé pour éviter les collisions)
  const map = new Map()
  for (const row of rows) {
    const key = row.email ? row.email : `__nomail__${row.nom.toLowerCase().replace(/\s+/g, '_')}`
    map.set(key, row) // écrase avec la plus récente (CSV déjà trié par date)
  }

  const unique = Array.from(map.values())
  console.log(`CSV : ${rows.length} lignes → ${unique.length} leads uniques après déduplication`)

  // Stats
  const byEtat = {}
  for (const r of unique) byEtat[r.etat] = (byEtat[r.etat] || 0) + 1
  console.log('Répartition :', byEtat)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Effacer toutes les données
    await client.query(`
      TRUNCATE compte_rendu_prof, compte_rendu_eleve, seances,
               echeances, inscriptions_financieres, freezes,
               eleves, actions_contact, leads
      RESTART IDENTITY CASCADE
    `)
    console.log('✓ Données de test effacées')

    // 2. Réinsérer le prof
    await client.query(`INSERT INTO profs (id, nom) VALUES ('axel', 'Axel') ON CONFLICT DO NOTHING`)

    // 3. Insérer les leads
    let inserted = 0
    for (const row of unique) {
      const { statut, archive, raison } = mapEtat(row.etat)
      await client.query(
        `INSERT INTO leads
           (nom, email, telephone, statut, source, archive, raison_archivage, date_archivage, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pub_meta', $5, $6, $7, $8, $8)`,
        [
          row.nom,
          row.email,
          row.tel,
          statut,
          archive,
          raison,
          archive ? row.date : null,
          row.date,
        ]
      )
      inserted++
    }

    await client.query('COMMIT')
    console.log(`✓ ${inserted} leads importés`)

    // Afficher les élèves à créer manuellement
    const eleves = unique.filter(r => r.etat === 'Élève')
    if (eleves.length > 0) {
      console.log('\n⚠️  Ces leads ont le statut Élève — crée leurs fiches dans /eleves :')
      for (const e of eleves) {
        console.log(`   • ${e.nom} <${e.email || 'pas d\'email'}> — entré le ${e.date}`)
      }
    }

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Erreur, rollback effectué :', err.message)
    process.exit(1)
  } finally {
    client.release()
  }

  await pool.end()
}

main()
