/**
 * @insurtech/comm/templates
 *
 * Inline Handlebars templates for Sprint 5 auth flows.
 * Sprint 9 will replace this with file-based templates and full DTP support
 * (RTL Arabic, brand assets, multi-channel WhatsApp/SMS).
 *
 * Locales : fr-MA (default) / ar-MA / en / fr-FR.
 */

import Handlebars from 'handlebars';

export type EmailLocale = 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';

interface TemplateBundle {
  subject: HandlebarsTemplateDelegate;
  body: HandlebarsTemplateDelegate;
}

interface RawTemplate {
  subject: string;
  body: string;
}

const VERIFY_RAW: Record<EmailLocale, RawTemplate> = {
  'fr-MA': {
    subject: 'Bienvenue sur Skalean InsurTech -- verifiez votre email',
    body: `Bonjour {{display_name}},

Bienvenue sur Skalean InsurTech. Cliquez sur le lien suivant pour verifier votre adresse email :

{{{verify_url}}}

Ce lien expire dans 24 heures.

L'equipe Skalean InsurTech`,
  },
  'fr-FR': {
    subject: 'Bienvenue sur Skalean InsurTech -- verifiez votre email',
    body: `Bonjour {{display_name}},

Bienvenue sur Skalean InsurTech. Cliquez sur le lien suivant pour verifier votre adresse email :

{{{verify_url}}}

Ce lien expire dans 24 heures.

L'equipe Skalean InsurTech`,
  },
  'ar-MA': {
    subject: 'Marhaba Skalean InsurTech -- akkid email dyalek',
    body: `Salam {{display_name}},

Marhaba bik fi Skalean InsurTech. Clicki had link bach takkid email dyalek :

{{{verify_url}}}

Had link ghadi yseft fi 24 sa3a.

Team Skalean InsurTech`,
  },
  en: {
    subject: 'Welcome to Skalean InsurTech -- verify your email',
    body: `Hello {{display_name}},

Welcome to Skalean InsurTech. Click the link below to verify your email address:

{{{verify_url}}}

This link expires in 24 hours.

The Skalean InsurTech team`,
  },
};

const RECOVERY_RAW: Record<EmailLocale, RawTemplate> = {
  'fr-MA': {
    subject: 'Reinitialisation de votre mot de passe Skalean InsurTech',
    body: `Bonjour,

Une demande de reinitialisation de mot de passe a ete recue. Cliquez sur le lien suivant :

{{{reset_url}}}

Ce lien expire dans 1 heure. Si vous n'etes pas a l'origine de cette demande, ignorez ce message.

L'equipe Skalean InsurTech`,
  },
  'fr-FR': {
    subject: 'Reinitialisation de votre mot de passe Skalean InsurTech',
    body: `Bonjour,

Une demande de reinitialisation de mot de passe a ete recue. Cliquez sur le lien suivant :

{{{reset_url}}}

Ce lien expire dans 1 heure. Si vous n'etes pas a l'origine de cette demande, ignorez ce message.

L'equipe Skalean InsurTech`,
  },
  'ar-MA': {
    subject: 'Reinitialisation password Skalean InsurTech',
    body: `Salam,

Tlbna men dik reinitialiser password. Clicki had link :

{{{reset_url}}}

Had link ghadi yseft fi sa3a. Ila ma kunti nta li tlbtha, ma3ndekch tdir walou.

Team Skalean InsurTech`,
  },
  en: {
    subject: 'Reset your Skalean InsurTech password',
    body: `Hello,

A password reset has been requested. Click the link below:

{{{reset_url}}}

This link expires in 1 hour. If you did not request this, please ignore.

The Skalean InsurTech team`,
  },
};

const PASSWORD_CHANGED_RAW: Record<EmailLocale, RawTemplate> = {
  'fr-MA': {
    subject: 'Votre mot de passe Skalean InsurTech a ete change',
    body: `Bonjour {{display_name}},

Le mot de passe de votre compte Skalean InsurTech vient d'etre modifie. Si vous etes a l'origine du changement, aucune action requise. Sinon, contactez immediatement le support : support@skalean.ma

L'equipe Skalean InsurTech`,
  },
  'fr-FR': {
    subject: 'Votre mot de passe Skalean InsurTech a ete change',
    body: `Bonjour {{display_name}},

Le mot de passe de votre compte Skalean InsurTech vient d'etre modifie. Si vous etes a l'origine du changement, aucune action requise. Sinon, contactez immediatement le support : support@skalean.ma

L'equipe Skalean InsurTech`,
  },
  'ar-MA': {
    subject: 'Password Skalean InsurTech dyalek tbeddel',
    body: `Salam {{display_name}},

Password dyal compte Skalean InsurTech ttbeddel. Ila kunti nta li dirthou, ma3ndekch tdir walou. Ila kna chi haja ghir mzyana, 3eyyet 3la support : support@skalean.ma

Team Skalean InsurTech`,
  },
  en: {
    subject: 'Your Skalean InsurTech password was changed',
    body: `Hello {{display_name}},

Your Skalean InsurTech account password was just changed. If you did this, no action is required. Otherwise, contact support immediately at support@skalean.ma

The Skalean InsurTech team`,
  },
};

function compile(raw: Record<EmailLocale, RawTemplate>): Record<EmailLocale, TemplateBundle> {
  const out = {} as Record<EmailLocale, TemplateBundle>;
  for (const locale of Object.keys(raw) as EmailLocale[]) {
    const t = raw[locale];
    out[locale] = {
      subject: Handlebars.compile(t.subject),
      body: Handlebars.compile(t.body),
    };
  }
  return out;
}

export const VERIFY_TEMPLATES = compile(VERIFY_RAW);
export const RECOVERY_TEMPLATES = compile(RECOVERY_RAW);
export const PASSWORD_CHANGED_TEMPLATES = compile(PASSWORD_CHANGED_RAW);

export function renderVerify(
  locale: EmailLocale,
  vars: { display_name: string; verify_url: string },
): { subject: string; body: string } {
  const t = VERIFY_TEMPLATES[locale];
  return { subject: t.subject(vars), body: t.body(vars) };
}

export function renderRecovery(
  locale: EmailLocale,
  vars: { reset_url: string },
): { subject: string; body: string } {
  const t = RECOVERY_TEMPLATES[locale];
  return { subject: t.subject(vars), body: t.body(vars) };
}

export function renderPasswordChanged(
  locale: EmailLocale,
  vars: { display_name: string },
): { subject: string; body: string } {
  const t = PASSWORD_CHANGED_TEMPLATES[locale];
  return { subject: t.subject(vars), body: t.body(vars) };
}
