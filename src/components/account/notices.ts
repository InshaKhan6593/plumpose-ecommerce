/**
 * Messages carried across a redirect are **codes**, never text. The template
 * printed whatever `?error=` or `?warning=` said, so anyone could send a link
 * that showed words of their choosing on plumpose.com in the site's own
 * voice. Now the URL can only pick one of these.
 */
export const NOTICES = {
  'account-created': { text: 'Your account is ready. Welcome to plumpose.', tone: 'note' },
  'password-changed': { text: 'Your password has been changed.', tone: 'note' },
  'signed-in-already': { text: 'You’re already signed in.', tone: 'note' },
  'sign-in-first': { text: 'Please sign in to see your account.', tone: 'note' },
} as const

export type NoticeCode = keyof typeof NOTICES

export const noticeHref = (path: string, notice: NoticeCode, extra?: Record<string, string>) => {
  const query = new URLSearchParams({ notice, ...extra })
  return `${path}?${query.toString()}`
}
