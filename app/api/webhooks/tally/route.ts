import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import pool from '@/lib/db'
import { pushover } from '@/lib/pushover'

interface TallyOption { id: string; text: string }

interface TallyField {
  key: string
  label: string
  type: string
  value: unknown
  options?: TallyOption[]
}

interface TallyPayload {
  eventType: string
  data: { responseId: string; fields: TallyField[] }
}

/**
 * Une règle de disqualification, identifiée par un `slug` STABLE choisi par
 * nous (jamais modifié) — c'est ce qui permet de la relier à un id d'option
 * Tally même si le texte affiché change. `matchText` sert uniquement à
 * (re)trouver cette option quand son texte correspond encore : c'est ce qui
 * doit être mis à jour à la main si la reformulation est trop importante
 * pour qu'un simple id suffise (l'alerte Pushover prévient dans ce cas).
 */
interface DisqualifierRule {
  slug: string
  key: string
  label: string
  matchText: string
}

const DISQUALIFIERS: DisqualifierRule[] = [
  { slug: 'anciennete_pas_commence', key: 'anciennete', label: 'Ancienneté guitare', matchText: "Je n'ai pas encore commencé" },
  { slug: 'anciennete_moins_3_mois', key: 'anciennete', label: 'Ancienneté guitare', matchText: 'Moins de 3 mois' },
  { slug: 'adhesion_cours_a_heure', key: 'adhesion_programme', label: 'Programme Guitarisation', matchText: "Non, je veux seulement des cours à l'heure" },
  { slug: 'attentes_conseils_seul', key: 'attentes_cours', label: "Attentes cours d'essai", matchText: 'Je viens seulement pour avoir quelques conseils pour progresser de mon côté' },
  { slug: 'delai_pas_bon_moment', key: 'delai_demarrage', label: 'Délai démarrage', matchText: "Ce n'est pas le bon moment pour moi" },
]

// Fragment (insensible à la casse) du label Tally pour retrouver chaque champ suivi.
const FIELD_FRAGMENTS: Record<string, string> = {
  anciennete: 'commencé la guitare',
  adhesion_programme: 'te parle',
  attentes_cours: "cours d'essai en visio",
  delai_demarrage: 'quel délai',
}

// Tally envoie des UUIDs pour MULTIPLE_CHOICE — résolution en texte via options[]
function resolveValue(field: TallyField): string | null {
  const v = field.value
  if (v == null) return null

  if (field.options && field.options.length > 0) {
    const ids = Array.isArray(v) ? v : [v]
    const texts = ids
      .map(id => field.options!.find(o => o.id === id)?.text)
      .filter((t): t is string => !!t)
    return texts.length > 0 ? texts.join(', ') : null
  }

  return typeof v === 'string' ? v.trim() || null : String(v).trim() || null
}

function selectedIds(field: TallyField | undefined): string[] {
  if (!field) return []
  const v = field.value
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') return [v]
  return []
}

function extractByLabel(fields: TallyField[], label: string): string | null {
  const f = fields.find(f => f.label.toLowerCase().trim() === label.toLowerCase().trim())
  return f ? resolveValue(f) : null
}

function extractByLabelContains(fields: TallyField[], fragment: string): string | null {
  const f = fields.find(f => f.label.toLowerCase().includes(fragment.toLowerCase()))
  return f ? resolveValue(f) : null
}

function findFieldByLabelContains(fields: TallyField[], fragment: string): TallyField | undefined {
  return fields.find(f => f.label.toLowerCase().includes(fragment.toLowerCase()))
}

function extractByType(fields: TallyField[], type: string): string | null {
  const f = fields.find(f => f.type === type)
  return f ? resolveValue(f) : null
}

interface OptSnap { id: string; text: string }

function normalizeOptions(options: TallyOption[] | undefined): OptSnap[] {
  return (options ?? [])
    .map(o => ({ id: o.id, text: o.text }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Compare les options actuelles d'un champ suivi à leur dernier instantané
 * connu. Premier passage → mémorise sans alerter. Écart détecté → alerte
 * Pushover avec le détail, puis met à jour l'instantané.
 */
async function checkFieldDrift(fieldKey: string, label: string, current: OptSnap[]): Promise<void> {
  if (current.length === 0) return // champ texte libre — rien à surveiller

  const { rows } = await pool.query(
    `SELECT options FROM tally_field_snapshot WHERE field_key = $1`,
    [fieldKey],
  )
  const stored: OptSnap[] | null = rows[0]?.options ?? null

  if (stored && JSON.stringify(stored) === JSON.stringify(current)) return

  await pool.query(
    `INSERT INTO tally_field_snapshot (field_key, options, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (field_key) DO UPDATE SET options = $2, updated_at = NOW()`,
    [fieldKey, JSON.stringify(current)],
  )

  if (!stored) return // premier passage : instantané de référence, pas d'alerte

  const storedById = new Map(stored.map(o => [o.id, o.text]))
  const currentById = new Map(current.map(o => [o.id, o.text]))
  const added = current.filter(o => !storedById.has(o.id))
  const removed = stored.filter(o => !currentById.has(o.id))
  const changed = current.filter(o => storedById.has(o.id) && storedById.get(o.id) !== o.text)

  const lines: string[] = [
    ...added.map(o => `+ nouvelle option : « ${o.text} »`),
    ...removed.map(o => `- option supprimée : « ${o.text} »`),
    ...changed.map(o => `~ reformulée : « ${storedById.get(o.id)} » → « ${o.text} »`),
  ]
  if (lines.length === 0) return // ordre changé seulement, sans impact

  console.log(`[webhooks/tally] Dérive détectée sur "${label}":`, lines)
  await pushover(
    `Question « ${label} » modifiée sur Tally :\n\n${lines.join('\n')}\n\nVérifie que les règles de qualification (DISQUALIFIERS) sont toujours à jour.`,
    { title: '⚠️ Formulaire Tally modifié' },
  ).catch(e => console.error('[webhooks/tally] Échec alerte dérive :', e))
}

/**
 * Pour chaque règle, retrouve l'id d'option Tally qui la déclenche
 * actuellement. Auto-associe (et mémorise) le premier id dont le texte
 * matche encore `matchText` — c'est ce qui rend une simple reformulation
 * inoffensive tant que le texte de la règle est toujours présent quelque
 * part dans les options du champ.
 */
async function resolveActiveDisqualifierIds(
  fieldsByKey: Record<string, OptSnap[]>,
): Promise<Map<string, string>> {
  const { rows } = await pool.query(
    `SELECT slug, option_id FROM tally_disqualifier_ids`,
  )
  const known = new Map<string, string>(rows.map(r => [r.slug, r.option_id]))

  const active = new Map<string, string>()
  for (const rule of DISQUALIFIERS) {
    const options = fieldsByKey[rule.key] ?? []
    const match = options.find(o => o.text.toLowerCase().trim() === rule.matchText.toLowerCase())
    const existingId = known.get(rule.slug)

    if (match) {
      active.set(rule.slug, match.id)
      if (match.id !== existingId) {
        await pool.query(
          `INSERT INTO tally_disqualifier_ids (slug, option_id, option_text, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (slug) DO UPDATE SET option_id = $2, option_text = $3, updated_at = NOW()`,
          [rule.slug, match.id, match.text],
        )
      }
    } else if (existingId) {
      // Le texte ne matche plus MAIS on a déjà un id connu (reformulation
      // trop importante pour matchText, ou dernière valeur connue) — on le
      // garde : mieux vaut continuer à disqualifier sur l'ancien id que de
      // perdre la règle silencieusement. L'alerte de dérive a déjà prévenu.
      active.set(rule.slug, existingId)
    }
  }
  return active
}

function detectDisqualification(
  activeIdBySlug: Map<string, string>,
  selectedIdsByKey: Record<string, string[]>,
): string | null {
  const reasons: string[] = []
  for (const rule of DISQUALIFIERS) {
    const activeId = activeIdBySlug.get(rule.slug)
    const selected = selectedIdsByKey[rule.key] ?? []
    if (activeId && selected.includes(activeId)) {
      reasons.push(`${rule.label} : ${rule.matchText}`)
    }
  }
  return reasons.length > 0 ? reasons.join(' | ') : null
}

interface KpiSummary {
  depense: number
  leads: number
  formulaires: number
  qualifies: number
  reservations: number
  ventes: number
}

/** Chiffres du jour depuis le KPI — best-effort, jamais bloquant. */
async function fetchKpiSummary(): Promise<KpiSummary | null> {
  const url = process.env.KPI_API_URL
  const secret = process.env.KPI_API_SECRET
  if (!url || !secret) return null
  try {
    const res = await fetch(`${url}/api/summary`, {
      headers: { 'x-api-secret': secret },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as KpiSummary
  } catch (e) {
    console.error('[webhooks/tally] Échec récupération résumé KPI :', e)
    return null
  }
}

/**
 * Notifie Samuel en temps réel dès qu'un lead devient qualifié, avec le
 * résumé des KPI du jour — pas juste l'alerte brute. Si le KPI est
 * injoignable, la notification part quand même, sans le résumé.
 * Envoie une première notification immédiate, puis une mise à jour après 5 min.
 */
async function notifyLeadQualifie(): Promise<void> {
  const summary = await fetchKpiSummary()

  const lignes = summary
    ? [
        `Aujourd'hui : ${summary.leads} leads, ${summary.formulaires} formulaires ` +
          `(${summary.qualifies} qualifiés), ${summary.reservations} appels réservés.`,
      ]
    : ['Résumé indisponible (KPI injoignable).']

  await pushover(lignes.join('\n'), { title: 'Nouveau formulaire' }).catch(e =>
    console.error('[webhooks/tally] Échec alerte lead qualifié :', e),
  )

  // Notification mise à jour après 5 minutes pour voir si un appel a été réservé
  setTimeout(async () => {
    const updatedSummary = await fetchKpiSummary().catch(() => summary)
    if (updatedSummary) {
      // Affiche seulement s'il y a eu un changement (appel réservé, etc.)
      if (
        updatedSummary.reservations > (summary?.reservations ?? 0) ||
        updatedSummary.qualifies > (summary?.qualifies ?? 0)
      ) {
        const updatedLines = [
          `Mise à jour (5 min après) : ${updatedSummary.leads} leads, ${updatedSummary.formulaires} formulaires ` +
            `(${updatedSummary.qualifies} qualifiés), ${updatedSummary.reservations} appels réservés.`,
        ]
        await pushover(updatedLines.join('\n'), { title: '📈 Mise à jour formulaires' }).catch(e =>
          console.error('[webhooks/tally] Échec alerte mise à jour :', e),
        )
      }
    }
  }, 5 * 60 * 1000) // 5 minutes
}

function validateSignature(rawBody: string, received: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
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

  if (payload.eventType !== 'FORM_RESPONSE') {
    return NextResponse.json({ ok: true })
  }

  const fields = payload.data?.fields ?? []

  const prenom = extractByLabel(fields, 'Prénom') ?? ''
  const nomFamille = extractByLabel(fields, 'Nom de famille') ?? ''
  const nom = `${prenom} ${nomFamille}`.trim()
  const email = (extractByLabel(fields, 'Adresse e-mail') ?? '').toLowerCase().trim()

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
    adhesion_programme: extractByLabelContains(fields, 'te parle') ?? undefined,
    attentes_cours: extractByLabelContains(fields, "cours d'essai en visio") ?? undefined,
    delai_demarrage: extractByLabelContains(fields, 'quel délai') ?? undefined,
  } as Record<string, string | undefined>

  // Surveillance des questions suivies : instantané + alerte si ça a changé,
  // puis résolution des ids actifs pour la décision de qualification.
  const fieldsByKey: Record<string, OptSnap[]> = {}
  const selectedIdsByKey: Record<string, string[]> = {}
  for (const [key, fragment] of Object.entries(FIELD_FRAGMENTS)) {
    const field = findFieldByLabelContains(fields, fragment)
    const options = normalizeOptions(field?.options)
    fieldsByKey[key] = options
    selectedIdsByKey[key] = selectedIds(field)
    const rule = DISQUALIFIERS.find(r => r.key === key)
    await checkFieldDrift(key, rule?.label ?? key, options)
  }

  const activeIdBySlug = await resolveActiveDisqualifierIds(fieldsByKey)
  const disqualRaison = detectDisqualification(activeIdBySlug, selectedIdsByKey)
  const isQualifie = disqualRaison === null

  if (!isQualifie) {
    questionnaire.disqualification_raison = disqualRaison!
  }

  const { rows: dups } = await pool.query(
    `SELECT id, archive, raison_archivage, statut FROM leads
     WHERE (email = $1 OR ($2::text IS NOT NULL AND telephone = $2))
     ORDER BY created_at DESC LIMIT 1`,
    [email, telephone || null]
  )

  try {
    if (dups.length > 0) {
      const existing = dups[0]
      const wasNonQualifie = existing.raison_archivage === 'non_qualifie'

      if (wasNonQualifie && isQualifie) {
        await pool.query(
          `UPDATE leads SET
             questionnaire = $2, objectifs = $3, problemes = $4,
             telephone = COALESCE($5, telephone),
             statut = 'qualifie', archive = false,
             raison_archivage = null, date_archivage = null,
             updated_at = NOW()
           WHERE id = $1`,
          [existing.id, questionnaire, objectifs || null, problemes || null, telephone || null]
        )
        console.log('[webhooks/tally] Lead réactivé (non_qualifie → qualifié):', email)
        await notifyLeadQualifie()
      } else {
        await pool.query(
          `UPDATE leads SET
             questionnaire = $2, objectifs = $3, problemes = $4,
             telephone = COALESCE($5, telephone),
             updated_at = NOW()
           WHERE id = $1`,
          [existing.id, questionnaire, objectifs || null, problemes || null, telephone || null]
        )
        console.log('[webhooks/tally] Lead mis à jour (re-soumission):', email)
      }
    } else {
      if (isQualifie) {
        await pool.query(
          `INSERT INTO leads (nom, email, telephone, source, objectifs, problemes, statut, questionnaire)
           VALUES ($1, $2, $3, 'pub_meta', $4, $5, 'qualifie', $6)`,
          [nom, email, telephone || null, objectifs || null, problemes || null, questionnaire]
        )
        await notifyLeadQualifie()
      } else {
        await pool.query(
          `INSERT INTO leads (nom, email, telephone, source, objectifs, problemes, statut, questionnaire,
             archive, raison_archivage, date_archivage)
           VALUES ($1, $2, $3, 'pub_meta', $4, $5, 'non_qualifie', $6, true, 'non_qualifie', NOW())`,
          [nom, email, telephone || null, objectifs || null, problemes || null, questionnaire]
        )
      }
      console.log('[webhooks/tally] Lead créé:', email, isQualifie ? 'qualifié' : 'non qualifié')
    }
  } catch (err) {
    console.error('[webhooks/tally] Erreur DB:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
