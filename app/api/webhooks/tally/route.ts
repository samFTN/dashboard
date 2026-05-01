import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import pool from '@/lib/db'

interface TallyField {
  key: string
  label: string
  type: string
  value: unknown
}

interface TallyPayload {
  eventType: string
  data: { responseId: string; fields: TallyField[] }
}

// Disqualifying answers: [answer text, questionnaire key, display label]
const DISQUALIFIERS: [string, string, string][] = [
  ["Je n'ai pas encore commencé", 'anciennete', 'Ancienneté guitare'],
  ['Moins de 3 mois', 'anciennete', 'Ancienneté guitare'],
  ['Non, je veux seulement des cours à l\'heure', 'adhesion_programme', 'Programme Guitarisation'],
  ['Je viens pour avoir quelques conseils pour progresser de mon côté', 'attentes_cours', "Attentes cours d'essai"],
  ['Ce n\'est pas le bon moment pour moi', 'delai_demarrage', 'Délai démarrage'],
]

function extractValue(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v.trim() || null
  if (Array.isArray(v)) {
    const parts = v.map(i => extractValue(i)).filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const text = obj.text ?? obj.label ?? obj.value
    return text != null ? String(text).trim() || null : null
  }
  return String(v).trim() || null
}

function extractByLabel(fields: TallyField[], label: string): string | null {
  const f = fields.find(f => f.label.toLowerCase().trim() === label.toLowerCase().trim())
  return f ? extractValue(f.value) : null
}

function extractByLabelContains(fields: TallyField[], fragment: string): string | null {
  const f = fields.find(f => f.label.toLowerCase().includes(fragment.toLowerCase()))
  return f ? extractValue(f.value) : null
}

function extractByType(fields: TallyField[], type: string): string | null {
  const f = fields.find(f => f.type === type)
  return f ? extractValue(f.value) : null
}

function detectDisqualification(q: Record<string, string | undefined>): string | null {
  for (const [answer, key, label] of DISQUALIFIERS) {
    const val = q[key]
    if (val && val.toLowerCase().trim() === answer.toLowerCase()) {
      return `${label} : ${val}`
    }
  }
  return null
}

function validateSignature(rawBody: string, received: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    const expBuf = Buffer.from(expected)
    const recBuf = Buffer.from(received)
    if (expBuf.length !== recBuf.length) return false
    return crypto.timingSafeEqual(expBuf, recBuf)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.TALLY_SIGNING_SECRET
  if (!secret) {
    console.error('[webhooks/tally] TALLY_SIGNING_SECRET manquant')
    return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 })
  }

  const rawBody = await req.text()

  // Validate signature — Tally sends it in the 'tally-signature' header
  const receivedSig = req.headers.get('tally-signature') ?? ''
  if (!validateSignature(rawBody, receivedSig, secret)) {
    console.warn('[webhooks/tally] Signature invalide')
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
  }

  let payload: TallyPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  // Only handle form responses
  if (payload.eventType !== 'FORM_RESPONSE') {
    return NextResponse.json({ ok: true })
  }

  const fields = payload.data?.fields ?? []

  // Build nom (Prénom + Nom de famille)
  const prenom = extractByLabel(fields, 'Prénom') ?? ''
  const nomFamille = extractByLabel(fields, 'Nom de famille') ?? ''
  const nom = `${prenom} ${nomFamille}`.trim()
  const email = (extractByLabel(fields, 'Adresse e-mail') ?? '').toLowerCase().trim()

  // Validate required fields — return 200 silently (Tally retries on non-2xx)
  if (!nom || !email) {
    console.warn('[webhooks/tally] Champs requis manquants', { nom, email })
    return NextResponse.json({ ok: true })
  }

  const telephone = extractByType(fields, 'INPUT_PHONE_NUMBER')
  const objectifs = extractByLabelContains(fields, 'rêves-tu de maîtriser')
  const problemes = extractByLabelContains(fields, 'te bloque')

  const questionnaire = {
    anciennete: extractByLabelContains(fields, 'commencé la guitare') ?? undefined,
    essais_passes: extractByLabelContains(fields, 'déjà essayé') ?? undefined,
    adhesion_programme: extractByLabelContains(fields, 'ligne directrice') ?? undefined,
    attentes_cours: extractByLabelContains(fields, "cours d'essai en visio") ?? undefined,
    delai_demarrage: extractByLabelContains(fields, 'quel délai') ?? undefined,
  } as Record<string, string | undefined>

  // Check for duplicate (silent on match — Tally retries on non-2xx)
  const { rows: dups } = await pool.query(
    `SELECT id FROM leads
     WHERE (email = $1 OR ($2::text IS NOT NULL AND telephone = $2))
       AND archive = false
     LIMIT 1`,
    [email, telephone || null]
  )
  if (dups.length > 0) {
    console.log('[webhooks/tally] Doublon ignoré:', email)
    return NextResponse.json({ ok: true })
  }

  // Determine qualification
  const disqualRaison = detectDisqualification(questionnaire)
  const isQualifie = disqualRaison === null

  if (!isQualifie) {
    questionnaire.disqualification_raison = disqualRaison!
  }

  // Insert lead
  try {
    if (isQualifie) {
      await pool.query(
        `INSERT INTO leads (nom, email, telephone, source, objectifs, problemes, statut, questionnaire)
         VALUES ($1, $2, $3, 'pub_meta', $4, $5, 'qualifie', $6)`,
        [nom, email, telephone || null, objectifs || null, problemes || null, questionnaire]
      )
    } else {
      await pool.query(
        `INSERT INTO leads (nom, email, telephone, source, objectifs, problemes, statut, questionnaire,
           archive, raison_archivage, date_archivage)
         VALUES ($1, $2, $3, 'pub_meta', $4, $5, 'nouveau', $6, true, 'non_qualifie', NOW())`,
        [nom, email, telephone || null, objectifs || null, problemes || null, questionnaire]
      )
    }
    console.log('[webhooks/tally] Lead créé:', email, isQualifie ? 'qualifié' : 'non qualifié')
  } catch (err) {
    console.error('[webhooks/tally] Erreur DB:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
