import { redirect } from 'next/navigation'

/**
 * The template's order page. There is one order page — `/order/[id]`, the one
 * every email links to — and it already lets a signed-in customer open their
 * own orders. Old links land there.
 */
export default async function LegacyOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/order/${encodeURIComponent(id)}`)
}
