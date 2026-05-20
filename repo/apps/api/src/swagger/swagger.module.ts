/**
 * SwaggerModule wrapper -- expose la config Swagger Skalean via static setup().
 *
 * Usage depuis main.ts :
 *   SwaggerModule.setup(app, { disable: false });
 *
 * Appele APRES NestFactory.create() et AVANT app.listen().
 * Registre les routes /docs (HTML UI) + /docs-json (OpenAPI JSON) + /docs-yaml.
 *
 * Reference : decision-006.
 * Tache : 1.3.9 (Sprint 3 / Phase 1).
 */
import { Module, Logger, type INestApplication } from '@nestjs/common';
import { SwaggerModule as NestSwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig, buildSwaggerUiOptions, type SwaggerConfigDocument } from './swagger.config';
import { SKALEAN_THEME_CSS, CUSTOM_FAVICON_BASE64 } from './swagger-theme';

/** Options du setup Swagger. */
export interface SwaggerSetupOptions {
  /** Si true, Swagger UI n'est pas registre (ex: SWAGGER_DISABLE_PROD=true en prod). */
  disable?: boolean;
}

@Module({})
export class SwaggerModule {
  private static readonly logger = new Logger(SwaggerModule.name);

  /**
   * Setup Swagger UI sur /docs et /docs-json.
   * Appele depuis main.ts apres NestFactory.create.
   */
  static setup(app: INestApplication, options: SwaggerSetupOptions = {}): void {
    if (options.disable === true) {
      SwaggerModule.logger.log('[SwaggerModule] Swagger UI disabled.');
      return;
    }

    const config: SwaggerConfigDocument = buildSwaggerConfig();
    const document = NestSwaggerModule.createDocument(app, config);
    const uiOptions = buildSwaggerUiOptions();

    NestSwaggerModule.setup('docs', app, document, {
      ...uiOptions,
      customCss: SKALEAN_THEME_CSS,
      customfavIcon: `data:image/svg+xml;base64,${CUSTOM_FAVICON_BASE64}`,
      jsonDocumentUrl: '/docs-json',
      yamlDocumentUrl: '/docs-yaml',
    });
  }
}
