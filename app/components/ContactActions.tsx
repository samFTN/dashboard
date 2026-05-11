'use client'
import { useState, useEffect } from 'react'

interface ContactActionsProps {
  email?: string
  telephone?: string
  style?: React.CSSProperties
  className?: string
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 5,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--accent)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  lineHeight: '18px',
}

export function ContactActions({ email, telephone, style, className }: ContactActionsProps) {
  const [hovered, setHovered] = useState<'email' | 'phone' | null>(null)
  const [tapped, setTapped] = useState<'email' | 'phone' | null>(null)
  const [copied, setCopied] = useState<'email' | 'phone' | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))
  }, [])

  const showEmail = hovered === 'email' || tapped === 'email'
  const showPhone = hovered === 'phone' || tapped === 'phone'

  function copy(value: string, key: 'email' | 'phone') {
    navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className={className} style={style}>
      {email && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: telephone ? 3 : 0 }}
          onMouseEnter={() => setHovered('email')}
          onMouseLeave={() => setHovered(null)}
        >
          <span
            style={{ fontSize: 13, color: 'var(--muted2)', cursor: 'default', userSelect: 'text' }}
            onClick={() => setTapped(p => p === 'email' ? null : 'email')}
          >
            {email}
          </span>
          {showEmail && (
            <>
              <a
                href={isMobile
                  ? `mailto:${email}`
                  : `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}&from=${encodeURIComponent('samuel@guitarisation.fr')}`
                }
                target="_blank"
                rel="noopener noreferrer"
                style={btnStyle}
                onClick={e => e.stopPropagation()}
              >
                ✉ Email
              </a>
              <button
                style={{ ...btnStyle, color: copied === 'email' ? '#15803d' : 'var(--muted2)' }}
                onClick={e => { e.stopPropagation(); copy(email, 'email') }}
              >
                {copied === 'email' ? '✓ Copié' : 'Copier'}
              </button>
            </>
          )}
        </div>
      )}
      {telephone && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
          onMouseEnter={() => setHovered('phone')}
          onMouseLeave={() => setHovered(null)}
        >
          <span
            style={{ fontSize: 13, color: 'var(--muted2)', cursor: 'default', userSelect: 'text' }}
            onClick={() => setTapped(p => p === 'phone' ? null : 'phone')}
          >
            {telephone}
          </span>
          {showPhone && (
            <>
              <a href={`tel:${telephone}`} style={btnStyle} onClick={e => e.stopPropagation()}>
                Appeler
              </a>
              <a href={`sms:${telephone}`} style={btnStyle} onClick={e => e.stopPropagation()}>
                SMS
              </a>
              <a
                href={`https://wa.me/${telephone.replace(/\s/g, '').replace(/^\+/, '').replace(/^0/, '33')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...btnStyle, color: '#25D366' }}
                onClick={e => e.stopPropagation()}
              >
                WhatsApp
              </a>
              <button
                style={{ ...btnStyle, color: copied === 'phone' ? '#15803d' : 'var(--muted2)' }}
                onClick={e => { e.stopPropagation(); copy(telephone, 'phone') }}
              >
                {copied === 'phone' ? '✓ Copié' : 'Copier'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
