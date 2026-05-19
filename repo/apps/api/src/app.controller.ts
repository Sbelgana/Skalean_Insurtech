/**
 * AppController -- controller racine GET /.
 *
 * Endpoint minimal pour smoke test et debug. NE PAS confondre avec
 * /healthz et /readyz qui seront ajoutes Tache 1.3.10 (HealthModule).
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET /
   *
   * Retourne metadata service (name, version, env, uptime, timestamp).
   * Usage : smoke test boot reussi, debug version deployee.
   *
   * Format : { name, version, env, uptime_seconds, timestamp }.
   * Status : 200 OK.
   * Auth : aucune (public-by-default au Sprint 3, sera @Public() Tache 1.3.14).
   */
  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('X-API-Endpoint', 'root')
  getRoot(): {
    name: string;
    version: string;
    env: string;
    uptime_seconds: number;
    timestamp: string;
  } {
    return this.appService.getInfo();
  }
}
