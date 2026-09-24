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
    qualities: [90, 100],
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
