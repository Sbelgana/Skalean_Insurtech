/**
 * @insurtech/comm/providers/email/template-renderer
 *
 * Sprint 9 Tache 3.2.7 -- rendu emails Handlebars HTML avec :
 *   - RTL automatique pour ar / ar-MA (dir="rtl" + lang attribute)
 *   - 4 locales avec fallback chain
 *   - text fallback via heuristique simple (sera node-html-to-text Sprint 35)
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Handlebars from 'handlebars';
import type { Repository } from 'typeorm';

import type { Locale } from '../../types/channel.enum.js';

export const COMM_EMAIL_TEMPLATES_REPO = Symbol('COMM_EMAIL_TEMPLATES_REPO');

interface EmailTemplateRow {
  id: string;
  tenantId: string;
  name: string;
  channel: string;
  language: Locale;
  subjectTemplate: string | null;
  bodyTemplate: string;
  active: boolean;
}

export interface EmailRenderResult {
  templateId: string;
  resolvedLocale: Locale;
  subject: string;
  html: string;
  text: string;
  langAttr: string;
  dirAttr: 'ltr' | 'rtl';
}

const FALLBACK_CHAINS: Record<Locale, Locale[]> = {
  'ar-MA': ['ar-MA', 'ar', 'fr', 'en'],
  ar: ['ar', 'fr', 'en'],
  fr: ['fr', 'en'],
  en: ['en', 'fr'],
};

const RTL_LOCALES: ReadonlySet<Locale> = new Set(['ar', 'ar-MA']);

@Injectable()
export class EmailTemplateRenderer {
  private readonly logger = new Logger(EmailTemplateRenderer.name);

  constructor(
    @Optional()
    @Inject(COMM_EMAIL_TEMPLATES_REPO)
    private readonly repo: Repository<EmailTemplateRow> | undefined,
  ) {}

  private assertRepo(): Repository<EmailTemplateRow> {
    if (this.repo === undefined) {
      throw new Error('COMM_EMAIL_TEMPLATES_REPO not injected');
    }
    return this.repo;
  }

  private isRtl(locale: Locale): boolean {
    return RTL_LOCALES.has(locale);
  }

  private wrapHtml(body: string, locale: Locale, subject: string): string {
    const dir = this.isRtl(locale) ? 'rtl' : 'ltr';
    return `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><title>${this.escapeHtml(subject)}</title><style>body{font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222;padding:16px}</style></head><body>${body}</body></html>`;
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private toText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/?[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  async resolveLocale(
    tenantId: string,
    templateName: string,
    requested: Locale,
  ): Promise<EmailTemplateRow | null> {
    const repo = this.assertRepo();
    const chain = FALLBACK_CHAINS[requested];
    for (const candidate of chain) {
      const row = await repo.findOne({
        where: {
          tenantId,
          name: templateName,
          language: candidate,
          channel: 'email',
          active: true,
        } as never,
      });
      if (row !== null) return row;
    }
    return null;
  }

  async render(
    tenantId: string,
    templateName: string,
    requestedLocale: Locale,
    variables: Record<string, unknown>,
  ): Promise<EmailRenderResult> {
    const row = await this.resolveLocale(tenantId, templateName, requestedLocale);
    if (row === null) {
      throw new Error(`EMAIL_TEMPLATE_NOT_FOUND: ${templateName}`);
    }

    const subjectTpl = Handlebars.compile(row.subjectTemplate ?? '');
    const bodyTpl = Handlebars.compile(row.bodyTemplate);

    const subject = subjectTpl(variables).trim();
    const renderedBody = bodyTpl(variables);
    const html = this.wrapHtml(this.markdownLite(renderedBody), row.language, subject);
    const text = this.toText(renderedBody);

    this.logger.log(
      `email_template_rendered template=${templateName} requested=${requestedLocale} resolved=${row.language}`,
    );

    return {
      templateId: row.id,
      resolvedLocale: row.language,
      subject,
      html,
      text,
      langAttr: row.language,
      dirAttr: this.isRtl(row.language) ? 'rtl' : 'ltr',
    };
  }

  /**
   * Light Markdown-like conversion: line breaks -> <br>, double newline -> </p><p>.
   * Sprint 35 may swap for full markdown-it parser; Sprint 9 keeps it minimal.
   */
  private markdownLite(text: string): string {
    const paragraphs = text.split(/\n{2,}/g).map((p) => p.trim()).filter((p) => p.length > 0);
    return paragraphs.map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
  }
}
