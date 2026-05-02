'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavLink({ href, children, badge }: { href: string; children: React.ReactNode; badge?: number }) {
  const pathname = usePathname()
  const active = pathname.startsWith(href)

  return (
    <Link
      href={href}
      className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--dark)' : 'var(--muted2)',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        fontWeight: active ? 600 : 500,
      }}
    >
      <span>{children}</span>
      {badge != null && badge > 0 && (
        <span
          className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--accent)', color: '#fff', minWidth: 18, textAlign: 'center' }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
