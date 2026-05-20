/**
 * Wrappers next-intl typed pour navigation locale-aware.
 *
 * Usage :
 *   import { Link, useRouter, redirect } from '@insurtech/shared-ui/i18n/navigation';
 */
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const {
  Link,
  redirect,
  permanentRedirect,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation(routing);

export type AppRouter = ReturnType<typeof useRouter>;
