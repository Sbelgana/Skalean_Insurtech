/**
 * ZodValidationPipe -- pipe NestJS de validation Zod pour Skalean InsurTech v2.2.
 *
 * Usage en deux modes :
 *
 *   Mode 1 : parametre de route (schema explicite)
 *     @Body(new ZodValidationPipe(CreateContratSchema)) body: CreateContrat
 *     @Query(new ZodValidationPipe(PaginationSchema)) query: Pagination
 *
 *   Mode 2 : global (pass-through -- registration main.ts)
 *     app.useGlobalPipes(new ZodValidationPipe())
 *     Sans schema, le pipe laisse passer la valeur sans transformation.
 *
 * En cas d'echec de validation :
 *   - Leve BadRequestException avec detail Zod structuree (code 400).
 *   - Body : { statusCode: 400, message: 'Validation failed', errors: ZodError[] }
 *   - errors : [{ path: 'field.nested', message: 'human-readable', code: 'invalid_type' }]
 *
 * PII : les valeurs invalides ne sont PAS logguees (PII potentiel dans body).
 * Seuls les chemins et messages d'erreur Zod sont exposes.
 *
 * Reference : decision-006 (no-emoji) + decision-009 (Zod uniforme).
 * Tache : 1.3.6 (Sprint 3 / Phase 1).
 */
import {
  PipeTransform,
  BadRequestException,
  type ArgumentMetadata,
} from '@nestjs/common';
import type { ZodSchema, ZodError } from 'zod';

/** Detail d'une erreur de validation Zod exposee dans la reponse 400. */
export interface ZodValidationError {
  /** Chemin dot-notation vers le champ invalide (ex: 'user.email'). */
  path: string;
  /** Message d'erreur humain Zod. */
  message: string;
  /** Code d'erreur Zod (ex: 'invalid_type', 'too_small'). */
  code: string;
}

/** Corps de la reponse HTTP 400 retourne par ZodValidationPipe. */
export interface ZodValidationErrorResponse {
  statusCode: 400;
  message: 'Validation failed';
  errors: ZodValidationError[];
}

/**
 * Transforme les erreurs Zod en tableau de ZodValidationError.
 * Exported pour les tests unitaires.
 */
export function formatZodErrors(zodError: ZodError): ZodValidationError[] {
  return zodError.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * ZodValidationPipe -- pipe NestJS de validation Zod.
 *
 * Instancie avec ou sans schema :
 *   - Avec schema : valide et transforme la valeur.
 *   - Sans schema  : pass-through (aucune validation).
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  /**
   * Valide et transforme la valeur entrante.
   *
   * @param value    - Valeur brute NestJS (body, query, param, header).
   * @param metadata - Metadonnees NestJS (type, metatype, data).
   * @returns        - Valeur validee et parsee par Zod (type-safe).
   * @throws BadRequestException si la validation Zod echoue.
   */
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (!this.schema) {
      // Pas de schema : pass-through pour usage en pipe global sans schema.
      return value;
    }

    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      const body: ZodValidationErrorResponse = {
        statusCode: 400,
        message: 'Validation failed',
        errors,
      };
      throw new BadRequestException(body);
    }

    // Retourne result.data (valeur parsee et transformee par Zod).
    // Les defaults Zod sont appliques, les champs inconnus strippes.
    return result.data;
  }
}
