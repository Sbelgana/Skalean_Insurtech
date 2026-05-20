/**
 * Security schemes Swagger : Bearer JWT + API Key + OAuth2.
 *
 * Reference : decision-006.
 * Tache : 1.3.9 (Sprint 3 / Phase 1).
 */
import type { DocumentBuilder } from '@nestjs/swagger';

/**
 * Ajoute les schemes de securite sur le DocumentBuilder.
 * - JWT (Bearer) : Sprint 5 auth
 * - apiKey (header x-api-key) : Sprint 27 admin/cron
 * - oauth2 (authorizationCode) : Sprint 35 partenaires
 */
export function addSecuritySchemes(builder: DocumentBuilder): void {
  // Bearer JWT (Sprint 5+)
  builder.addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'JWT token issued by /api/v1/auth/login. Algorithm RS256. ' +
        'Access token TTL 15 min, refresh token TTL 30 jours. Sprint 5.',
    },
    'JWT',
  );

  // API Key (Sprint 27 admin / cron)
  builder.addApiKey(
    {
      type: 'apiKey',
      name: 'x-api-key',
      in: 'header',
      description: 'API Key for admin/cron integrations. Issued by SuperAdmin. Sprint 27.',
    },
    'apiKey',
  );

  // OAuth2 (Sprint 35 partenaires bancaires)
  builder.addOAuth2(
    {
      type: 'oauth2',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://api.skalean-insurtech.ma/oauth/authorize',
          tokenUrl: 'https://api.skalean-insurtech.ma/oauth/token',
          scopes: {
            'read:contacts': 'Read contacts',
            'write:contacts': 'Write contacts',
            'read:policies': 'Read policies',
            admin: 'Full admin access (SuperAdmin only)',
          },
        },
      },
    },
    'oauth2',
  );
}

export const SECURITY_SCHEMES = {
  JWT: 'JWT',
  apiKey: 'apiKey',
  oauth2: 'oauth2',
} as const;

export type SecurityScheme = keyof typeof SECURITY_SCHEMES;
