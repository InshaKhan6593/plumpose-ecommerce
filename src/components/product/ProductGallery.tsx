'use client'

import type { Media as MediaType } from '@/payload-types'

import { useSearchParams } from 'next/navigation'

import { Media } from '@/components/Media'
import { RevealImage } from '@/motion/Reveal'
import { cn } from '@/utilities/cn'

/**
 * The product page's photographs.
 *
 * - **Desktop** (docs/mockups/06-product-page.webp): one large photograph,
 *   then the rest in pairs, each opening upward as it scrolls in.
 * - **Phone** (SCREEN-PROMPTS M2): one swipeable row, the next photo peeking
 *   in at the edge to show there is more. Stacking all seven would push the
 *   size and "Add to bag" below seven screens of photography.
 *
 * One set of images serves both, so nothing downloads twice. The first is
 * prioritised — it is the page's main image.
 *
 * A photograph she ties to an option ("Only show for" Navy) shows once that
 * option is chosen, alongside the photographs tied to none (REQUIREMENTS A4).
 * Before anything is chosen, every photograph shows.
 */
export function ProductGallery({
  items,
}: {
  items: Array<{ image: MediaType; optionId: null | number }>
}) {
  const searchParams = useSearchParams()
  const chosen = new Set(Array.from(searchParams.values()))
  const tagged = items.filter((item) => item.optionId !== null && chosen.has(String(item.optionId)))
  const images = (
    tagged.length
      ? items.filter((item) => item.optionId === null || chosen.has(String(item.optionId)))
      : items
  ).map((item) => item.image)

  if (!images.length) return null

  const oddTail = (images.length - 1) % 2 === 1

  return (
    <div
      aria-label="Photographs"
      className={cn(
        // Phone: a horizontal, snapping row that bleeds to the screen edges.
        '-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        // Desktop: the stack from the mockup.
        'lg:mx-0 lg:grid lg:snap-none lg:grid-cols-2 lg:gap-2.5 lg:overflow-visible lg:px-0',
      )}
      role="region"
    >
      {images.map((image, index) => {
        const isFirst = index === 0
        const isOddLast = oddTail && index === images.length - 1

        return (
          <RevealImage
            className={cn(
              'relative aspect-[4/5] w-[86%] shrink-0 snap-start overflow-hidden bg-paper-3 lg:w-auto',
              (isFirst || isOddLast) && 'lg:col-span-2',
              isOddLast && 'lg:aspect-[16/10]',
            )}
            key={image.id}
          >
            <Media
              className="absolute inset-0"
              fill
              imgClassName="object-cover"
              priority={isFirst}
              resource={image}
              size={isFirst ? '(min-width: 1024px) 55vw, 86vw' : '(min-width: 1024px) 28vw, 86vw'}
            />
          </RevealImage>
        )
      })}
    </div>
  )
}
