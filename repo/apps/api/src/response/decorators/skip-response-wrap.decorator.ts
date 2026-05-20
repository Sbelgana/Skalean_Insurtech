/**
 * @SkipResponseWrap() -- marque un handler pour exclure l'enveloppement
 * automatique par ResponseInterceptor.
 *
 * Utilise pour :
 * - Endpoints health (/healthz, /readyz) qui retournent format terminus natif.
 * - Tout endpoint necessitant un format response custom.
 *
 * Usage :
 *   @SkipResponseWrap()
 *   @Get('healthz')
 *   liveness() { return { status: 'ok' }; }
 *
 * Reference : decision-006.
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { SetMetadata } from '@nestjs/common';

/** Cle metadata pour le decorator SkipResponseWrap. */
export const SKIP_RESPONSE_WRAP = 'skip_response_wrap';

/**
 * Marque le handler pour exclure l'enveloppement { success, data, meta }.
 * La reponse est retournee telle quelle depuis le handler.
 */
export const SkipResponseWrap = () => SetMetadata(SKIP_RESPONSE_WRAP, true);
