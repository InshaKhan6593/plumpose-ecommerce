import type { StaticImageData } from 'next/image'
import type { ElementType, Ref } from 'react'

import type { Media as MediaType } from '@/payload-types'

export interface Props {
  alt?: string
  className?: string
  fill?: boolean // for NextImage only
  height?: number
  htmlElement?: ElementType | null
  imgClassName?: string
  /**
   * For NextImage only. 'eager' for images that are in the layout but hidden
   * by a clip or mask until an animation reveals them: the browser does not
   * treat a fully clipped image as visible, so a lazy one only starts loading
   * as the reveal begins and pops in part-way through it.
   */
  loading?: 'eager' | 'lazy'
  onClick?: () => void
  onLoad?: () => void
  priority?: boolean // for NextImage only
  ref?: Ref<HTMLImageElement | HTMLVideoElement | null>
  resource?: MediaType | string | number // for Payload media
  size?: string // for NextImage only
  src?: StaticImageData // for static media
  videoClassName?: string
  width?: number
}
