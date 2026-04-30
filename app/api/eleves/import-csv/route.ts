import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

// Parse une ligne CSV en tenant compte des champs entre guillemets
function parseCSVLine(line: string): string[] {
  const cols: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      cols.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  cols.push(cur.trim())
  return cols
}

// "DD/MM/YYYY" → "YYYY-MM-DD"
function parseDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// "★★★★☆" → 4
function parseSatisfaction(s: string): number | null {
  const count = (s.match(/★/g) || []).length
  return count > 0 ? count : null
}

// "5 points" | "0 point" → 5
function parsePoints(s: string): number {
  const m = s.trim().match(/^(\d+)/)
  return m ? parseInt(m[1]) : 0
}

// "TRUE"/"FALSE"/"Oui"/"Non" → boolean
function parseBool(s: string, def = false): boolean {
  const u = s.trim().toUpperCase()
  if (u === 'TRUE' || u === 'OUI') return true
  if (u === 'FALSE' || u === 'NON') return false
  return def
}

function parseIntSafe(s: string): number {
  const n = parseInt(s.trim())
  return isNaN(n) ? 0 : n
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const eleveId = form.get('eleve_id') as string
    const file = form.get('file') as File

    if (!eleveId || !file) {
      return NextResponse.json({ error: 'eleve_id et fichier requis' }, { status: 400 })
    }

    // Vérifier que l'élève existe
    const { rows: eleveRows } = await pool.query(
      `SELECT id, nom FROM eleves WHERE id = $1`,
      [eleveId]
    )
    if (eleveRows.length === 0) {
      return NextResponse.json({ error: 'Élève introuvable' }, { status: 404 })
    }

    // Parser le CSV
    const text = await file.text()
    const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)

    if (lines.length < 3) {
      return NextResponse.json({ error: 'CSV vide ou invalide (moins de 3 lignes)' }, { status: 400 })
    }

    // Ligne 2 (index 1) = en-têtes
    const headers = parseCSVLine(lines[1]).map(h => h.toLowerCase())

    const findCol = (needle: string) =>
      headers.findIndex(h => h.includes(needle.toLowerCase()))

    const iDate        = findCol('date de la s')        // "date de la séance"
    const iPresence    = findCol('pr\u00e9sence')        // "présence"
    const iSatisf      = findCol('satisfaction')
    const iRemarque    = findCol('remarque')
    const iParticip    = findCol('participation')
    const iAteliers    = findCol('ateliers')
    const iComments    = findCol('commentaires')
    const iVideosFb    = findCol('vid\u00e9os pour feedback') // "vidéos pour feedback"
    const iVideoDefi   = findCol('vid\u00e9o pour d')    // "vidéo pour défi"
    const iDefiValide  = findCol('d\u00e9fi valid')      // "défi validé"
    const iRessenti    = findCol('ressenti')
    const iInfosSup    = findCol('infos suppl')          // "infos supplémentaires"
    const iPoints      = findCol('points pour')          // "points pour les jeux"

    // Dates existantes pour dédoublonnage
    const { rows: existingRows } = await pool.query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS date FROM seances WHERE eleve_id = $1`,
      [eleveId]
    )
    const existingDates = new Set(existingRows.map(r => r.date))

    const client = await pool.connect()
    let imported = 0
    let skipped = 0
    const importedDates: string[] = []

    try {
      await client.query('BEGIN')

      // Numéro de séance courant
      const { rows: maxRows } = await client.query(
        `SELECT COALESCE(MAX(numero_seance), 0) AS max_num FROM seances WHERE eleve_id = $1`,
        [eleveId]
      )
      let nextNum = parseInt(maxRows[0].max_num) + 1

      // Lignes de données (index 2+)
      for (const line of lines.slice(2)) {
        const cols = parseCSVLine(line)
        if (cols.length < 2) { skipped++; continue }

        const rawDate = iDate >= 0 ? (cols[iDate] ?? '') : ''
        const date = parseDate(rawDate)
        if (!date) { skipped++; continue }

        // Dédoublonnage par date
        if (existingDates.has(date)) { skipped++; continue }

        const presence          = iPresence >= 0 ? parseBool(cols[iPresence] ?? '', true) : true
        const satisfaction      = iSatisf >= 0 ? parseSatisfaction(cols[iSatisf] ?? '') : null
        const remarqueProf      = [
          iRemarque >= 0 ? cols[iRemarque] : '',
          iInfosSup >= 0 ? cols[iInfosSup] : '',
        ].map(s => s.trim()).filter(Boolean).join(' — ') || null
        const participAteliers  = iParticip >= 0 ? parseBool(cols[iParticip] ?? '') : false
        const nbAteliers        = iAteliers >= 0 ? parseIntSafe(cols[iAteliers] ?? '0') : 0
        const nbCommentaires    = iComments >= 0 ? parseIntSafe(cols[iComments] ?? '0') : 0
        const nbVideosFeedback  = iVideosFb >= 0 ? parseIntSafe(cols[iVideosFb] ?? '0') : 0
        const videoDefi         = iVideoDefi >= 0 ? parseBool(cols[iVideoDefi] ?? '') : false
        const defiValide        = iDefiValide >= 0 ? parseBool(cols[iDefiValide] ?? '') : false
        const ressenti          = iRessenti >= 0 ? (cols[iRessenti] ?? '').trim() || null : null
        const pointsJeux        = iPoints >= 0 ? parsePoints(cols[iPoints] ?? '0') : 0

        // 1. Créer la séance
        const { rows: seanceRows } = await client.query(
          `INSERT INTO seances (eleve_id, date, numero_seance, alerte_decrochage)
           VALUES ($1, $2, $3, false)
           RETURNING id::text`,
          [eleveId, date, nextNum]
        )
        const seanceId = seanceRows[0].id
        nextNum++

        // 2. Volet prof
        await client.query(
          `INSERT INTO compte_rendu_prof
             (seance_id, presence, remarque, nb_ateliers_assistes,
              nb_commentaires, nb_videos_feedback, video_defi, defi_valide, points_jeux)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [seanceId, presence, remarqueProf, nbAteliers,
           nbCommentaires, nbVideosFeedback, videoDefi, defiValide, pointsJeux]
        )

        // 3. Volet élève (seulement si satisfaction présente)
        if (satisfaction !== null) {
          await client.query(
            `INSERT INTO compte_rendu_eleve
               (seance_id, satisfaction, ressenti, participation_ateliers, date_remplissage)
             VALUES ($1, $2, $3, $4, NOW())`,
            [seanceId, satisfaction, ressenti, participAteliers]
          )
        }

        imported++
        importedDates.push(date)
        existingDates.add(date)
      }

      // Recalculer points_total
      if (imported > 0) {
        await client.query(
          `UPDATE eleves
           SET points_total = (
             SELECT COALESCE(SUM(crp.points_jeux), 0)
             FROM compte_rendu_prof crp
             JOIN seances s ON s.id = crp.seance_id
             WHERE s.eleve_id = $1
           ), updated_at = NOW()
           WHERE id = $1`,
          [eleveId]
        )
      }

      await client.query('COMMIT')
      return NextResponse.json({ imported, skipped, dates: importedDates })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('[POST /api/eleves/import-csv]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
