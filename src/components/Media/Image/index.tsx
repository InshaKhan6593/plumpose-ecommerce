'use client'

import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/cn'
import NextImage from 'next/image'
import React from 'react'

import type { Props as MediaProps } from '../types'

import { cssVariables } from '@/cssVariables'

const { breakpoints } = cssVariables

export const Image: React.FC<MediaProps> = (props) => {
  const {
    alt: altFromProps,
    fill,
    height: heightFromProps,
    imgClassName,
    loading,
    onClick,
    onLoad: onLoadFromProps,
    priority,
    resource,
    size: sizeFromProps,
    src: srcFromProps,
    width: widthFromProps,
  } = props

  let width: number | undefined | null
  let height: number | undefined | null
  let alt = altFromProps
  let src: StaticImageData | string = srcFromProps || ''

  if (!src && resource && typeof resource === 'object') {
    const {
      alt: altFromResource,
      height: fullHeight,
      updatedAt,
      url,
      width: fullWidth,
    } = resource

    width = widthFromProps ?? fullWidth
    height = heightFromProps ?? fullHeight
    alt = altFromResource

    /*
     * The date of the upload in the address: resized photographs are cached for
     * 31 days (next.config.ts), and a photo she replaces under the same file
     * name would otherwise keep showing the old one for as long.
     */
    const version = updatedAt ? Date.parse(updatedAt) : NaN
    const versioned =
      url && Number.isFinite(version) ? `${url}${url.includes('?') ? '&' : '?'}v=${version}` : url

    src = `${process.env.NEXT_PUBLIC_SERVER_URL}${versioned}`
  }

  // NOTE: this is used by the browser to determine which image to download at different screen sizes
  const sizes = sizeFromProps
    ? sizeFromProps
    : Object.entries(breakpoints)
        .map(([, value]) => `(max-width: ${value}px) ${value}px`)
        .join(', ')

  return (
    <NextImage
      alt={alt || ''}
      className={cn(imgClassName)}
      fill={fill}
      height={!fill ? height || heightFromProps : undefined}
      // `priority` already loads eagerly, and Next warns if both are given.
      loading={priority ? undefined : loading}
      onClick={onClick}
      onLoad={onLoadFromProps}
      priority={priority}
      // 80, not 90: about 40% lighter, indistinguishable on her photographs (BUILD-LOG §68).
      quality={80}
      sizes={sizes}
      src={src}
      width={!fill ? width || widthFromProps : undefined}
    />
  )
}
