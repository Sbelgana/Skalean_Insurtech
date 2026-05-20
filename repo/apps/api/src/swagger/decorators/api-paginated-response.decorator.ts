/**
 * @ApiPaginatedResponse(EntityDto) -- documente response paginated dans Swagger.
 *
 * Usage :
 *   @ApiPaginatedResponse(ContactDto)
 *   @Get()
 *   findAll() { ... }
 *
 * Reference : decision-006.
 * Tache : 1.3.9 (Sprint 3 / Phase 1).
 */
import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Decorator qui documente une response paginated dans Swagger.
 * Produit un schema { data: EntityDto[], meta: { pagination: {...} } }.
 */
export const ApiPaginatedResponse = <T extends Type<unknown>>(model: T) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description: `Paginated list of ${model.name}`,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          meta: {
            type: 'object',
            properties: {
              request_id: { type: 'string', example: '01HK3X9YABCDEF1234567890' },
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string', example: '0.1.0' },
              duration_ms: { type: 'number', example: 42 },
              locale: { type: 'string', enum: ['fr-MA', 'ar-MA', 'amz-MA', 'en-MA'] },
              pagination: {
                type: 'object',
                required: ['total', 'page', 'pageSize', 'totalPages', 'hasNext', 'hasPrev'],
                properties: {
                  total: { type: 'integer', minimum: 0 },
                  page: { type: 'integer', minimum: 1 },
                  pageSize: { type: 'integer', minimum: 1, maximum: 100 },
                  totalPages: { type: 'integer', minimum: 0 },
                  hasNext: { type: 'boolean' },
                  hasPrev: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    }),
  );
