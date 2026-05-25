/**
 * @insurtech/comm/providers/whatsapp/template-renderer
 *
 * Sprint 9 Tache 3.2.3 -- rendu templates WhatsApp avec :
 *   - resolution locale fallback ar-MA -> ar -> fr -> en
 *   - lookup comm_templates approved Meta
 *   - mapping variables {name->value} vers Meta `components[].parameters[]` ordered
 *   - escape de caracteres de controle interdits par Meta (\n+ leading whitespace, tabs)
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import type { Repository } from 'typeorm';

import type { Locale } from '../../types/channel.enum.js';
import { META_LOCALE_MAP } from '../../types/channel.enum.js';
import { MetaInvalidTemplateError, MetaTemplateNotApprovedError } from './errors.js';
import type { MetaLanguageCode, MetaTemplateComponent } from './types.js';

export const COMM_TEMPLATES_REPO = Symbol('COMM_TEMPLATES_REPO');

interface CommTemplateRow {
  id: string;
  tenantId: string;
  name: string;
  channel: string;
  language: Locale;
  bodyTemplate: string;
  variablesSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required: string[];
    /** Sprint 9: optional ordered list of variable names mapping to {{1}}..{{N}} for WA */
    ordered?: string[];
  };
  metaTemplateName: string | null;
  metaTemplateStatus: string;
  active: boolean;
}

export interface RenderResult {
  templateId: string;
  templateName: string;
  metaTemplateName: string;
  languageCode: MetaLanguageCode;
  components: MetaTemplateComponent[];
  resolvedLocale: Locale;
  bodyPreview: string;
}

const FALLBACK_CHAINS: Record<Locale, Locale[]> = {
  'ar-MA': ['ar-MA', 'ar', 'fr', 'en'],
  ar: ['ar', 'fr', 'en'],
  fr: ['fr', 'en'],
  en: ['en', 'fr'],
};

@Injectable()
export class WaTemplateRenderer {
  private readonly logger = new Logger(WaTemplateRenderer.name);

  constructor(
    @Optional()
    @Inject(COMM_TEMPLATES_REPO)
    private readonly repo: Repository<CommTemplateRow> | undefined,
  ) {}

  private assertRepo(): Repository<CommTemplateRow> {
    if (this.repo === undefined) {
      throw new Error('COMM_TEMPLATES_REPO not injected');
    }
    return this.repo;
  }

  /**
   * Resout la meilleure locale disponible pour un template name + tenant donne.
   */
  async resolveLocale(
    tenantId: string,
    templateName: string,
    requested: Locale,
  ): Promise<Locale | null> {
    const repo = this.assertRepo();
    const chain = FALLBACK_CHAINS[requested];
    for (const candidate of chain) {
      const row = await repo.findOne({
        where: { tenantId, name: templateName, language: candidate, channel: 'whatsapp', active: true },
      });
      if (row !== null) return candidate;
    }
    return null;
  }

  /**
   * Verifie qu'un template est approve Meta (precondition envoi).
   */
  async validateMetaApproved(
    tenantId: string,
    templateName: string,
    locale: Locale,
  ): Promise<boolean> {
    const repo = this.assertRepo();
    const row = await repo.findOne({
      where: {
        tenantId,
        name: templateName,
        language: locale,
        channel: 'whatsapp',
        active: true,
      },
    });
    return row !== null && row.metaTemplateStatus === 'approved' && row.metaTemplateName !== null;
  }

  /**
   * Echappe les caracteres rejetes par Meta (4+ newlines, tabs, leading spaces).
   */
  private sanitize(value: string): string {
    return value
      .replace(/\t/g, ' ')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/^[\s]+|[\s]+$/g, '');
  }

  async render(
    tenantId: string,
    templateName: string,
    requestedLocale: Locale,
    variables: Record<string, unknown>,
  ): Promise<RenderResult> {
    const repo = this.assertRepo();
    const resolved = await this.resolveLocale(tenantId, templateName, requestedLocale);
    if (resolved === null) {
      throw new MetaInvalidTemplateError(`Template ${templateName} not found for any locale in ${FALLBACK_CHAINS[requestedLocale].join(',')}`);
    }
    const row = await repo.findOne({
      where: {
        tenantId,
        name: templateName,
        language: resolved,
        channel: 'whatsapp',
        active: true,
      },
    });
    if (row === null) {
      throw new MetaInvalidTemplateError(`Template ${templateName}:${resolved} not found`);
    }
    if (row.metaTemplateStatus !== 'approved') {
      throw new MetaTemplateNotApprovedError(
        `Template ${templateName}:${resolved} status=${row.metaTemplateStatus} not approved by Meta`,
      );
    }
    if (row.metaTemplateName === null) {
      throw new MetaTemplateNotApprovedError(
        `Template ${templateName}:${resolved} missing meta_template_name`,
      );
    }

    const ordered = row.variablesSchema.ordered ?? row.variablesSchema.required;
    const parameters = ordered.map((varName) => {
      const value = variables[varName];
      if (value === undefined || value === null) {
        throw new MetaInvalidTemplateError(
          `Template ${templateName}:${resolved} missing variable "${varName}"`,
        );
      }
      return { type: 'text' as const, text: this.sanitize(String(value)) };
    });

    const components: MetaTemplateComponent[] = parameters.length > 0
      ? [{ type: 'body', parameters }]
      : [];

    // Preview du body interpole (no engine pour Meta, simple replacement)
    let preview = row.bodyTemplate;
    ordered.forEach((varName, idx) => {
      const value = String(variables[varName] ?? '');
      preview = preview.replace(new RegExp(`\\{\\{\\s*${idx + 1}\\s*\\}\\}`, 'g'), value);
      preview = preview.replace(new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'g'), value);
    });

    const languageCode = META_LOCALE_MAP[resolved] as MetaLanguageCode;
    this.logger.log(
      `wa_template_rendered template=${templateName} requested=${requestedLocale} resolved=${resolved} lang_code=${languageCode}`,
    );

    return {
      templateId: row.id,
      templateName,
      metaTemplateName: row.metaTemplateName,
      languageCode,
      components,
      resolvedLocale: resolved,
      bodyPreview: preview,
    };
  }
}
