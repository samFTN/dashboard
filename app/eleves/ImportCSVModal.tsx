'use client'

import { useRef, useState } from 'react'
import type { EleveRow } from './ElevesClient'

// ── Parsers client-side (même logique que le serveur, pour la preview) ──

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
      cols.push(cur.trim()); cur = ''
    } else { cur += ch }
  }
  cols.push(cur.trim())
  return cols
}

function parseDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function parseSatisfaction(s: string): number | null {
  const c = (s.match(/★/g) || []).length
  return c > 0 ? c : null
}

function parsePoints(s: string): number {
  const m = s.trim().match(/^(\d+)/)
  return m ? parseInt(m[1]) : 0
}

function parseBool(s: string, def = false): boolean {
  const u = s.trim().toUpperCase()
  if (u === 'TRUE' || u === 'OUI') return true
  if (u === 'FALSE' || u === 'NON') return false
  return def
}

function parseIntSafe(s: string): number {
  const n = parseInt(s.trim()); return isNaN(n) ? 0 : n
}

type SeancePreview = {
  date: string
  presence: boolean
  satisfaction: number | null
  participationAteliers: boolean
  nbAteliers: number
  nbCommentaires: number
  nbVideosFeedback: number
  videoDefi: boolean
  defiValide: boolean
  pointsJeux: number
  remarque: string | null
}

function parseCSV(text: string): SeancePreview[] {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)
  if (lines.length < 3) return []

  const headers = parseCSVLine(lines[1]).map(h => h.toLowerCase())
  const find = (needle: string) => headers.findIndex(h => h.includes(needle))

  const iDate       = find('date de la s')
  const iPresence   = find('pr\u00e9sence')
  const iSatisf     = find('satisfaction')
  const iRemarque   = find('remarque')
  const iParticip   = find('participation')
  const iAteliers   = find('ateliers')
  const iComments   = find('commentaires')
  const iVideosFb   = find('vid\u00e9os pour feedback')
  const iVideoDefi  = find('vid\u00e9o pour d')
  const iDefiValide = find('d\u00e9fi valid')
  const iInfosSup   = find('infos suppl')
  const iPoints     = find('points pour')

  return lines.slice(2).flatMap(line => {
    const cols = parseCSVLine(line)
    if (cols.length < 2) return []
    const date = iDate >= 0 ? parseDate(cols[iDate] ?? '') : null
    if (!date) return []
    return [{
      date,
      presence:             iPresence >= 0 ? parseBool(cols[iPresence] ?? '', true) : true,
      satisfaction:         iSatisf >= 0 ? parseSatisfaction(cols[iSatisf] ?? '') : null,
      participationAteliers: iParticip >= 0 ? parseBool(cols[iParticip] ?? '') : false,
      nbAteliers:           iAteliers >= 0 ? parseIntSafe(cols[iAteliers] ?? '0') : 0,
      nbCommentaires:       iComments >= 0 ? parseIntSafe(cols[iComments] ?? '0') : 0,
      nbVideosFeedback:     iVideosFb >= 0 ? parseIntSafe(cols[iVideosFb] ?? '0') : 0,
      videoDefi:            iVideoDefi >= 0 ? parseBool(cols[iVideoDefi] ?? '') : false,
      defiValide:           iDefiValide >= 0 ? parseBool(cols[iDefiValide] ?? '') : false,
      pointsJeux:           iPoints >= 0 ? parsePoints(cols[iPoints] ?? '0') : 0,
      remarque:             [
        iRemarque >= 0 ? cols[iRemarque] : '',
        iInfosSup >= 0 ? cols[iInfosSup] : '',
      ].map(s => s.trim()).filter(Boolean).join(' — ') || null,
    }]
  })
}

// Extrait le nom de l'élève depuis le nom de fichier
// "Guitarisation™ - Suivi Élèves (Axel) - David Marangoni.csv" → "David Marangoni"
function nameFromFilename(filename: string): string {
  const noExt = filename.replace(/\.csv$/i, '')
  const parts = noExt.split(' - ')
  return parts.at(-1)?.trim() ?? ''
}

// ── Composant ──

type Props = {
  eleves: EleveRow[]
  onClose: () => void
  onImported: (eleveId: string, nbSeances: number) => void
}

type FileEntry = {
  file: File
  suggestedEleveId: string
  preview: SeancePreview[]
  text: string
}

type Result = { imported: number; skipped: number }

export default function ImportCSVModal({ eleves, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files) return
    setError(null)
    const newEntries: FileEntry[] = []
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.csv')) continue
      const text = await file.text()
      const preview = parseCSV(text)
      const guessedName = nameFromFilename(file.name).toLowerCase()
      // Cherche l'élève dont le nom ressemble le plus au nom de fichier
      const matched = eleves.find(e =>
        e.nom.toLowerCase().includes(guessedName) ||
        guessedName.includes(e.nom.toLowerCase().split(' ')[0])
      )
      newEntries.push({
        file,
        text,
        preview,
        suggestedEleveId: matched?.id ?? '',
      })
    }
    setEntries(prev => [...prev, ...newEntries])
  }

  function setEleveId(filename: string, id: string) {
    setEntries(prev => prev.map(e => e.file.name === filename ? { ...e, suggestedEleveId: id } : e))
  }

  function removeEntry(filename: string) {
    setEntries(prev => prev.filter(e => e.file.name !== filename))
  }

  async function handleImport() {
    setLoading(true)
    setError(null)
    const newResults: Record<string, Result> = {}
    for (const entry of entries) {
      if (!entry.suggestedEleveId) continue
      const form = new FormData()
      form.append('eleve_id', entry.suggestedEleveId)
      form.append('file', entry.file)
      try {
        const res = await fetch('/api/eleves/import-csv', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Erreur inconnue')
          setLoading(false)
          return
        }
        newResults[entry.file.name] = { imported: data.imported, skipped: data.skipped }
        onImported(entry.suggestedEleveId, data.imported)
      } catch {
        setError('Erreur réseau')
        setLoading(false)
        return
      }
    }
    setResults(newResults)
    setLoading(false)
  }

  const done = Object.keys(results).length > 0
  const allAssigned = entries.length > 0 && entries.every(e => e.suggestedEleveId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--dark)' }}>Importer des séances depuis CSV</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>
              Format Guitarisation™ — une feuille par élève
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--muted2)' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
          {/* Zone de dépôt */}
          {!done && (
            <div
              className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-10 cursor-pointer transition-colors"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
              onClick={() => inputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            >
              <span className="text-2xl mb-2">📄</span>
              <p className="text-sm font-medium" style={{ color: 'var(--dark)' }}>
                Cliquer ou déposer des fichiers CSV
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Un fichier par élève
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>
          )}

          {/* Fichiers chargés */}
          {entries.map(entry => {
            const res = results[entry.file.name]
            return (
              <div
                key={entry.file.name}
                className="rounded-xl"
                style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
              >
                {/* Fichier + sélecteur élève */}
                <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--dark)' }}>
                    {entry.file.name}
                  </span>
                  {!done && (
                    <button
                      onClick={() => removeEntry(entry.file.name)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: 'var(--muted)', background: 'var(--border)' }}
                    >
                      Retirer
                    </button>
                  )}
                  {res && (
                    <span
                      className="text-xs font-bold px-2 py-1 rounded"
                      style={{ background: res.imported > 0 ? '#dcfce7' : 'var(--border)', color: res.imported > 0 ? '#16a34a' : 'var(--muted)' }}
                    >
                      {res.imported} importée{res.imported !== 1 ? 's' : ''}
                      {res.skipped > 0 ? ` · ${res.skipped} ignorée${res.skipped !== 1 ? 's' : ''}` : ''}
                    </span>
                  )}
                </div>

                {/* Sélecteur élève */}
                {!done && (
                  <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="text-xs" style={{ color: 'var(--muted2)' }}>Élève :</span>
                    <select
                      value={entry.suggestedEleveId}
                      onChange={e => setEleveId(entry.file.name, e.target.value)}
                      className="flex-1 text-sm rounded-lg px-2 py-1"
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: 'var(--dark)',
                      }}
                    >
                      <option value="">— Choisir un élève —</option>
                      {eleves.map(e => (
                        <option key={e.id} value={e.id}>{e.nom}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Preview des séances */}
                {entry.preview.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr style={{ background: 'var(--bg)' }}>
                          {['Date', 'Présence', 'Satisf.', 'Ateliers', 'Comm.', 'Défi', 'Points'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--muted2)' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entry.preview.map((s, i) => (
                          <tr
                            key={s.date}
                            style={{ borderTop: i > 0 ? '1px solid var(--border2)' : undefined }}
                          >
                            <td className="px-3 py-2 font-mono" style={{ color: 'var(--dark)' }}>
                              {new Date(s.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td className="px-3 py-2">
                              <span style={{ color: s.presence ? '#16a34a' : '#dc2626' }}>
                                {s.presence ? '✓' : '✗'}
                              </span>
                            </td>
                            <td className="px-3 py-2" style={{ color: 'var(--dark)' }}>
                              {s.satisfaction !== null ? '★'.repeat(s.satisfaction) + '☆'.repeat(5 - s.satisfaction) : '—'}
                            </td>
                            <td className="px-3 py-2" style={{ color: 'var(--muted2)' }}>{s.nbAteliers}</td>
                            <td className="px-3 py-2" style={{ color: 'var(--muted2)' }}>{s.nbCommentaires}</td>
                            <td className="px-3 py-2">
                              {s.defiValide
                                ? <span style={{ color: '#16a34a' }}>✓</span>
                                : <span style={{ color: 'var(--muted)' }}>—</span>
                              }
                            </td>
                            <td className="px-3 py-2 font-semibold" style={{ color: s.pointsJeux > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                              {s.pointsJeux > 0 ? `+${s.pointsJeux}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {entry.preview.length === 0 && (
                  <p className="px-4 py-4 text-xs text-center" style={{ color: 'var(--muted)' }}>
                    Aucune séance détectée dans ce fichier
                  </p>
                )}
              </div>
            )
          })}

          {error && (
            <p className="text-sm text-center font-medium" style={{ color: '#dc2626' }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {done ? (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--dark)', color: 'white' }}
            >
              Fermer
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ color: 'var(--muted2)', background: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                Annuler
              </button>
              <button
                onClick={handleImport}
                disabled={!allAssigned || loading}
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-opacity"
                style={{
                  background: 'var(--dark)',
                  color: 'white',
                  opacity: (!allAssigned || loading) ? 0.4 : 1,
                }}
              >
                {loading ? 'Import en cours…' : `Importer ${entries.reduce((sum, e) => sum + e.preview.length, 0)} séance${entries.reduce((sum, e) => sum + e.preview.length, 0) !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
