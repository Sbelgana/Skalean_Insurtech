/**
 * next-intl TypeScript type augmentation -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 */
import type frMessages from '../messages/fr.json';

type Messages = typeof frMessages;

declare global {
  interface IntlMessages extends Messages {}
}
