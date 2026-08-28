/** Formate un numéro français pour l'affichage : 06 12 34 56 78 → 33 6 12 34 56 78 */
export function formatPhone(tel: string): string {
  const digits = tel.replace(/[^\d+]/g, '')
  let national: string | null = null

  if (/^0\d{9}$/.test(digits)) national = digits.slice(1)
  else if (/^\+33\d{9}$/.test(digits)) national = digits.slice(3)
  else if (/^0033\d{9}$/.test(digits)) national = digits.slice(4)
  else if (/^33\d{9}$/.test(digits)) national = digits.slice(2)

  if (!national) return tel

  const groups = national.slice(1).match(/.{1,2}/g) ?? []
  return `33 ${national[0]} ${groups.join(' ')}`
}

/** Version compacte pour les liens tel: / sms: → +33612345678 */
export function phoneHref(tel: string): string {
  const formatted = formatPhone(tel)
  const digits = formatted.replace(/\s/g, '')
  return /^33\d{9}$/.test(digits) ? `+${digits}` : tel.replace(/\s/g, '')
}
