import { getCachedGlobal } from '@/utilities/getGlobals'

import { SiteHeaderClient } from './SiteHeaderClient'

/**
 * The storefront header, as in the approved mockups (docs/mockups/).
 *
 * The navigation is fixed in code, not read from the Header global: REQUIREMENTS
 * §4.3 puts navigation structure in the developer-only column, because a broken
 * menu item breaks the whole site. The announcement line is hers to edit, in
 * Site settings.
 */
export async function SiteHeader() {
  const settings = await getCachedGlobal('siteSettings', 0)()

  const announcement =
    settings.announcementEnabled && settings.announcementText ? settings.announcementText : null

  return <SiteHeaderClient announcement={announcement} />
}
