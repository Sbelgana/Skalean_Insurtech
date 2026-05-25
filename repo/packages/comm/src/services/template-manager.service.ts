/**
 * @insurtech/comm/services/template-manager.service
 *
 * Sprint 9 Tache 3.2.5 -- service CRUD comm_templates +
 * seed idempotent (heritage pattern Sprint 7.5b.0).
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Repository } from 'typeorm';

import type { Channel, Locale } from '../types/channel.enum.js';

export const COMM_TEMPLATES_REPO_TOKEN = Symbol('COMM_TEMPLATES_REPO_TOKEN');

export interface TemplateRow {
  id?: string;
  tenantId: string;
  name: string;
  channel: Channel;
  category: 'marketing' | 'transactional' | 'reminder';
  language: Locale;
  subjectTemplate: string | null;
  bodyTemplate: string;
  variablesSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required: string[];
    ordered?: string[];
  };
  metaTemplateName: string | null;
  metaTemplateStatus: 'draft' | 'pending_review' | 'approved' | 'rejected';
  active: boolean;
}

export interface TemplateSeed {
  name: string;
  channel: Channel;
  category: 'marketing' | 'transactional' | 'reminder';
  metaTemplateName?: string | undefined;
  metaTemplateStatus?: 'draft' | 'pending_review' | 'approved' | 'rejected';
  variables: Array<{ name: string; type: 'string' | 'number' | 'date'; required: boolean }>;
  /** map locale -> { subject?, body } */
  localizations: Partial<Record<Locale, { subject?: string | undefined; body: string }>>;
}

@Injectable()
export class TemplateManagerService {
  private readonly logger = new Logger(TemplateManagerService.name);

  constructor(
    @Optional()
    @Inject(COMM_TEMPLATES_REPO_TOKEN)
    private readonly repo: Repository<TemplateRow> | undefined,
  ) {}

  private assertRepo(): Repository<TemplateRow> {
    if (this.repo === undefined) {
      throw new Error('COMM_TEMPLATES_REPO_TOKEN not injected');
    }
    return this.repo;
  }

  /**
   * Seed idempotent : insert un template (variant locale) si absent ;
   * met a jour body + status si present.
   * Reference pattern Sprint 7.5b.0 seeds idempotent.
   */
  async upsertTemplate(tenantId: string, seed: TemplateSeed): Promise<{ created: number; updated: number }> {
    const repo = this.assertRepo();
    const required = seed.variables.filter((v) => v.required).map((v) => v.name);
    const ordered = seed.variables.map((v) => v.name);
    const properties: Record<string, { type: string }> = {};
    for (const v of seed.variables) properties[v.name] = { type: v.type };

    let created = 0;
    let updated = 0;
    for (const [locale, content] of Object.entries(seed.localizations) as Array<[Locale, { subject?: string; body: string }]>) {
      const existing = await repo.findOne({
        where: {
          tenantId,
          name: seed.name,
          language: locale,
          channel: seed.channel,
        } as never,
      });
      if (existing === null) {
        await repo.save({
          tenantId,
          name: seed.name,
          channel: seed.channel,
          category: seed.category,
          language: locale,
          subjectTemplate: content.subject ?? null,
          bodyTemplate: content.body,
          variablesSchema: {
            type: 'object',
            properties,
            required,
            ordered,
          },
          metaTemplateName: seed.metaTemplateName ?? null,
          metaTemplateStatus: seed.metaTemplateStatus ?? 'draft',
          active: true,
        });
        created += 1;
      } else {
        existing.subjectTemplate = content.subject ?? null;
        existing.bodyTemplate = content.body;
        existing.variablesSchema = { type: 'object', properties, required, ordered };
        if (seed.metaTemplateName !== undefined) existing.metaTemplateName = seed.metaTemplateName;
        if (seed.metaTemplateStatus !== undefined) existing.metaTemplateStatus = seed.metaTemplateStatus;
        existing.active = true;
        await repo.save(existing);
        updated += 1;
      }
    }
    this.logger.log(
      `template_upsert tenant=${tenantId} name=${seed.name} channel=${seed.channel} created=${created} updated=${updated}`,
    );
    return { created, updated };
  }

  async seedAll(tenantId: string, seeds: ReadonlyArray<TemplateSeed>): Promise<{ created: number; updated: number; total: number }> {
    let created = 0;
    let updated = 0;
    for (const seed of seeds) {
      const out = await this.upsertTemplate(tenantId, seed);
      created += out.created;
      updated += out.updated;
    }
    return { created, updated, total: created + updated };
  }

  async list(tenantId: string, channel?: Channel): Promise<ReadonlyArray<TemplateRow>> {
    const repo = this.assertRepo();
    const where: Partial<TemplateRow> = { tenantId };
    if (channel !== undefined) where.channel = channel;
    return await repo.find({ where: where as never });
  }
}
