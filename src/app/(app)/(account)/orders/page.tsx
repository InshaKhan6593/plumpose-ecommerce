import { redirect } from 'next/navigation'

/** The template's orders list. Orders are the account's front page now. */
export default function OrdersPage() {
  redirect('/account')
}
