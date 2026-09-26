import type { Metadata } from 'next'

// The template shipped Payload's own name and share image here, so a shared
// link to any CMS page previewed as "Payload Website Template".
const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  siteName: 'plumpose',
}

export const mergeOpenGraph = (og?: Partial<Metadata['openGraph']>): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
  }
}
