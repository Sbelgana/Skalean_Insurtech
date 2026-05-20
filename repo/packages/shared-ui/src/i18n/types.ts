/**
 * Types utilitaires i18n Skalean InsurTech.
 *
 * Note : L'augmentation globale IntlMessages doit etre faite dans chaque app
 * via src/i18n/types.ts (ou next-intl plugin) car elle reference les messages
 * JSON specifiques a l'app.
 */

export type AppName =
  | 'web-broker'
  | 'web-garage'
  | 'web-garage-mobile'
  | 'web-insurtech-admin'
  | 'web-customer-portal'
  | 'web-assure-portal'
  | 'web-assure-mobile';

export type MessageKey<T extends Record<string, unknown>, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? MessageKey<T[K], P extends '' ? K : `${P}.${K}`>
    : P extends ''
      ? K
      : `${P}.${K}`;
}[keyof T & string];

export type {};
