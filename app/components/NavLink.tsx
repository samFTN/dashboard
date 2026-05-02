'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname.startsWith(href)

  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--dark)' : 'var(--muted2)',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </Link>
  )
}
