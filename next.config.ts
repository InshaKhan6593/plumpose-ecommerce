import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
import { redirects } from './redirects'

const NEXT_PUBLIC_SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

const nextConfig: NextConfig = {
  /*
   * A second production build beside the first, for an A/B on this machine:
   * NEXT_DIST_DIR=.next-b for both `pnpm build` and `pnpm start`. Unset, Next's
   * default folders are used, as always.
   */
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  /*
   * The dev-mode "Compiling" badge sat over the page in every screen recording
   * sent for review, and read as a site defect. Build errors still show.
   */
  devIndicators: false,
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'],
  },
  images: {
    /**
     * Next 16 blocks optimising upstream images whose hostname resolves to a
     * private IP (SSRF guard). The Media component builds an absolute src from
     * NEXT_PUBLIC_SERVER_URL, which in local dev is localhost -> 127.0.0.1, so
     * every product photo 400s. Harmless in dev; never enabled in production,
     * where the host is public — except for a production build run on this
     * machine (`next start` on localhost), which opts in explicitly with
     * LOCAL_PRODUCTION_PREVIEW=on. Never set that on a deployed server.
     */
    dangerouslyAllowLocalIP:
      process.env.NODE_ENV === 'development' || process.env.LOCAL_PRODUCTION_PREVIEW === 'on',
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    // 80: ~40% lighter than 90 with no visible difference, checked on the print close-up (BUILD-LOG §68).
    qualities: [80, 100],
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          port: url.port,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        }
      }),
    ],
  },
  reactStrictMode: true,
  redirects,
  /*
   * The catalogue flip-book from the old site, linked from her Instagram as
   * plumpose.com/catalogue. It carries her photographs, so like the films it
   * lives in R2 and is fetched into public/video at build (scripts/films.ts).
   */
  rewrites: async () => [{ destination: '/video/catalogue.html', source: '/catalogue' }],
  /*
   * Baseline security headers on every response. Framing is same-origin only:
   * the admin's live preview shows the storefront in a frame on this domain.
   * No Content-Security-Policy yet — the films, R2 photos, Payload admin and
   * SkipCash redirect would each need allowing, and a wrong policy breaks pages.
   */
  headers: async () => [
    {
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
      source: '/:path*',
    },
  ],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig)
