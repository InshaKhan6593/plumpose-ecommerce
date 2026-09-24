import { AuthProvider } from '@/providers/Auth'
import { LocaleProvider } from '@/providers/Locale'
import { QAR } from '@/currencies'
import { EcommerceProvider } from '@payloadcms/plugin-ecommerce/client/react'
import { stripeAdapterClient } from '@payloadcms/plugin-ecommerce/payments/stripe'
import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { SonnerProvider } from '@/providers/Sonner'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HeaderThemeProvider>
          <SonnerProvider />
          <EcommerceProvider
            /**
             * Must mirror the server config in payload.config's ecommercePlugin.
             * Without it the client falls back to the plugin default of USD,
             * which renders prices as `$1,399.00` and makes every POST /api/carts
             * fail validation with `currency: invalid selection`.
             */
            currenciesConfig={{
              defaultCurrency: 'QAR',
              supportedCurrencies: [QAR],
            }}
            enableVariants={true}
            api={{
              cartsFetchQuery: {
                depth: 2,
                populate: {
                  products: {
                    slug: true,
                    title: true,
                    gallery: true,
                    inventory: true,
                    // The bag's stepper follows the stock rule (@/lib/pricing/stock), which needs this.
                    madeToOrder: true,
                  },
                  variants: {
                    title: true,
                    inventory: true,
                  },
                },
              },
            }}
            paymentMethods={[
              stripeAdapterClient({
                publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
              }),
            ]}
          >
            <LocaleProvider>{children}</LocaleProvider>
          </EcommerceProvider>
        </HeaderThemeProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
