import { cn } from '@/utilities/cn'

const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z'

/**
 * A rating as five fine outlined stars, filled to the value (4.5 fills four
 * and a half). The number is spoken, not the drawing.
 */
export function Stars({
  className,
  size = 14,
  value,
}: {
  className?: string
  size?: number
  value: number
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  const row = (filled: boolean) => (
    <span className="flex gap-[3px]">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          aria-hidden
          fill={filled ? 'currentColor' : 'none'}
          height={size}
          key={i}
          stroke="currentColor"
          strokeWidth={1.2}
          viewBox="0 0 24 24"
          width={size}
        >
          <path d={STAR} strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  )
  return (
    <span
      className={cn('relative inline-flex text-ink', className)}
      role="img"
      aria-label={`${Number(value.toFixed(1))} out of 5 stars`}
    >
      {row(false)}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row(true)}
      </span>
    </span>
  )
}

/** "4.8" from the approved ratings, or null when there are none. */
export const averageRating = (ratings: number[]): null | number =>
  ratings.length
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null
