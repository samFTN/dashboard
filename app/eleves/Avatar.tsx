'use client'

import { useState } from 'react'

const COLORS = [
  '#d4a017', '#2563eb', '#16a34a', '#dc2626',
  '#9333ea', '#0891b2', '#ea580c', '#db2777',
]

function initials(nom: string) {
  const parts = nom.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function colorFor(nom: string) {
  return COLORS[(nom.charCodeAt(0) ?? 0) % COLORS.length]
}

export default function Avatar({
  gravatarUrl,
  nom,
  size = 32,
}: {
  gravatarUrl: string
  nom: string
  size?: number
}) {
  const [failed, setFailed] = useState(false)

  if (!failed) {
    return (
      <img
        src={gravatarUrl}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <div
      aria-hidden
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: colorFor(nom),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        color: '#fff',
        fontSize: size * 0.38,
        fontWeight: 700,
        userSelect: 'none',
      }}
    >
      {initials(nom)}
    </div>
  )
}
