/**
 * SwaggerConfig -- builder du document OpenAPI 3.0.3.
 *
 * Construit le document OpenAPI complet :
 * - Info (title, version, contact, license, termsOfService)
 * - Servers (dev / staging / prod)
 * - Tags par module (21 tags)
 * - Security schemes (Bearer JWT + API Key + OAuth2)
 * - Header global x-tenant-id documente
 *
 * Reference : decision-006 + decision-009 + decision-003.
 * Tache : 1.3.9 (Sprint 3 / Phase 1).
 */
import type { OpenAPIObject } from '@nestjs/swagger';
import { DocumentBuilder } from '@nestjs/swagger';
import { SWAGGER_TAGS } from './swagger-tags';
import { addSecuritySchemes } from './swagger-security';

/** Type config Swagger (sans paths -- ceux-ci sont ajoutes par createDocument). */
export type SwaggerConfigDocument = Omit<OpenAPIObject, 'paths'>;

export interface SwaggerConfigOptions {
  title?: string;
  description?: string;
  version?: string;
  contactName?: string;
  contactEmail?: string;
  licenseName?: string;
  licenseUrl?: string;
  servers?: Array<{ url: string; description: string }>;
  externalDocs?: { description: string; url: string };
  termsOfService?: string;
}

/**
 * Construit et retourne le document OpenAPIObject sans paths.
 * Les paths sont ajoutes par NestSwaggerModule.createDocument() au boot.
 */
export function buildSwaggerConfig(options: SwaggerConfigOptions = {}): SwaggerConfigDocument {
  const builder = new DocumentBuilder()
    .setTitle(options.title ?? 'Skalean InsurTech API')
    .setDescription(
      options.description ??
        `Backend API NestJS pour Skalean InsurTech v2.2. Multi-tenant strict, ` +
          `conformite ACAPS + DGI + CNDP + AMC + Loi 43-20. ` +
          `Format response standardise { data, meta }. ` +
          `Header x-tenant-id obligatoire sauf /api/v1/public/*.`,
    )
    .setVersion(options.version ?? '0.1.0')
    .setContact(
      options.contactName ?? 'Skalean InsurTech',
      'https://skalean-insurtech.ma',
      options.contactEmail ?? 'api@skalean-insurtech.ma',
    )
    .setLicense(
      options.licenseName ?? 'Proprietary',
      options.licenseUrl ?? 'https://skalean-insurtech.ma/license',
    )
    .setTermsOfService(options.termsOfService ?? 'https://skalean-insurtech.ma/terms');

  // Servers (dev / staging / prod)
  const servers = options.servers ?? [
    { url: 'http://localhost:4000', description: 'Development local' },
    {
      url: 'https://staging-api.skalean-insurtech.ma',
      description: 'Staging Atlas Cloud Maroc',
    },
    {
      url: 'https://api.skalean-insurtech.ma',
      description: 'Production Atlas Cloud Benguerir',
    },
  ];

  for (const server of servers) {
    builder.addServer(server.url, server.description);
  }

  // External docs
  builder.setExternalDoc(
    options.externalDocs?.description ?? 'Documentation complete',
    options.externalDocs?.url ?? 'https://docs.skalean-insurtech.ma',
  );

  // Tags par module (21 tags)
  for (const tag of SWAGGER_TAGS) {
    builder.addTag(tag.name, tag.description);
  }

  // Security schemes (Bearer JWT + API Key + OAuth2)
  addSecuritySchemes(builder);

  // Header global x-tenant-id
  builder.addGlobalParameters({
    name: 'x-tenant-id',
    in: 'header',
    required: false,
    description:
      'Tenant UUID v4. Obligatoire sauf /api/v1/public/*. Refer to decision-002.',
    schema: { type: 'string', format: 'uuid' },
  });

  return builder.build();
}

/**
 * Options Swagger UI (theme + persistAuthorization + snippets).
 */
export function buildSwaggerUiOptions(): Record<string, unknown> {
  return {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      displayRequestDuration: true,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
      requestSnippetsEnabled: true,
      syntaxHighlight: {
        activated: true,
        theme: 'monokai',
      },
      requestSnippets: {
        generators: {
          curl_bash: { title: 'cURL (bash)', syntax: 'bash' },
          curl_powershell: { title: 'cURL (PowerShell)', syntax: 'powershell' },
          curl_cmd: { title: 'cURL (CMD)', syntax: 'bash' },
        },
        defaultExpanded: true,
        languages: ['curl_bash'],
      },
    },
    customSiteTitle: 'Skalean InsurTech API Docs',
  };
}
