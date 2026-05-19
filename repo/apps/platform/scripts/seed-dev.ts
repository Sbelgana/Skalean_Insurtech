/**
 * Seed dev exhaustifs -- Skalean InsurTech MA ecosystem.
 * Ordre insertion : tenants -> users -> contacts -> deals -> assureurs -> produits
 *                   -> polices -> rdv -> messages -> audit_log -> analytics_events.
 * Idempotent via ON CONFLICT DO NOTHING.
 * RLS bypass via SET LOCAL row_security = off (super admin context).
 * Aucune emoji (decision-006). Timezone Africa/Casablanca (decision-002).
 * DEV ONLY -- Ne jamais executer en production.
 */
import 'dotenv/config';
import pg from 'pg';
import type { PoolClient } from 'pg';
const { Pool } = pg;
import { hash as argon2Hash, argon2id } from 'argon2';
import { faker } from '@faker-js/faker/locale/fr';
import { pino } from 'pino';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateIce,
  generateCin,
  generatePhoneMa,
  generatePoliceNumber,
  generateUlid,
  pickRandom,
  randomBetween,
  randomDateInRange,
  isMoroccoHoliday2026,
} from './seed-helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const log = pino({ level: 'info' });

// Seed deterministe pour reproductibilite
const RANDOM_SEED = parseInt(process.env['SEED_RANDOM_SEED'] ?? '42', 10);
faker.seed(RANDOM_SEED);

const CONTACTS_COUNT = parseInt(process.env['SEED_CONTACTS_COUNT'] ?? '50', 10);
const DEALS_COUNT = parseInt(process.env['SEED_DEALS_COUNT'] ?? '20', 10);
const POLICES_COUNT = parseInt(process.env['SEED_POLICES_COUNT'] ?? '20', 10);
const RDV_COUNT = parseInt(process.env['SEED_RDV_COUNT'] ?? '10', 10);
const MESSAGES_COUNT = parseInt(process.env['SEED_MESSAGES_COUNT'] ?? '30', 10);
const AUDIT_COUNT = parseInt(process.env['SEED_AUDIT_COUNT'] ?? '50', 10);
const ANALYTICS_COUNT = parseInt(process.env['SEED_ANALYTICS_COUNT'] ?? '200', 10);
const DEFAULT_PASSWORD = process.env['SEED_PASSWORD_DEFAULT'] ?? 'Demo!2026Skalean';
const TIMEZONE = process.env['SEED_TIMEZONE'] ?? 'Africa/Casablanca';

// Charger fichiers JSON donnees
interface AssureurData {
  name: string;
  acaps_code: string;
  ice: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  metadata: Record<string, unknown>;
}
interface ProduitData {
  assureur_acaps_code: string;
  code: string;
  name: string;
  type: string;
  premium_min_mad: number;
  premium_max_mad: number;
  garanties: string[];
}
interface VilleData {
  name: string;
  region: string;
  population: number;
}
interface NomsMaData {
  prenoms: string[];
  noms: string[];
}

const assureursMa = JSON.parse(
  readFileSync(resolve(__dirname, 'seed-data/assureurs-ma.json'), 'utf-8'),
) as AssureurData[];
const produitsAssurance = JSON.parse(
  readFileSync(resolve(__dirname, 'seed-data/produits-assurance.json'), 'utf-8'),
) as ProduitData[];
const villesMa = JSON.parse(
  readFileSync(resolve(__dirname, 'seed-data/villes-ma.json'), 'utf-8'),
) as VilleData[];
const nomsFrMa = JSON.parse(
  readFileSync(resolve(__dirname, 'seed-data/noms-fr-ma.json'), 'utf-8'),
) as NomsMaData;

const pool = new Pool({
  host: process.env['DATABASE_HOST'] ?? 'localhost',
  port: parseInt(process.env['DATABASE_PORT'] ?? '5432', 10),
  database: process.env['DATABASE_NAME'] ?? 'skalean_dev',
  user: process.env['DATABASE_USER'] ?? 'seed_admin',
  password: process.env['DATABASE_PASSWORD'] ?? 'change-me',
});

async function main(): Promise<void> {
  const startTime = Date.now();
  log.info({ randomSeed: RANDOM_SEED, timezone: TIMEZONE }, 'Starting Skalean dev seeds');

  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL row_security = off');
    await client.query(`SET LOCAL TIMEZONE = '${TIMEZONE}'`);

    // Seed 1 : Tenant Skalean Platform
    log.info('Seed 1 : Tenant Skalean Platform');
    const skaleanTenantId = generateUlid();
    await client.query(
      `INSERT INTO tenants (id, name, type, slug, settings, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (slug) DO NOTHING`,
      [
        skaleanTenantId,
        'Skalean Platform',
        'mixed',
        'skalean',
        JSON.stringify({ timezone: TIMEZONE, locale: 'fr', currency: 'MAD', is_super_admin: true }),
      ],
    );
    // Retrieve actual id (conflict may mean it already existed)
    const skaleanRow = await client.query<{ id: string }>(
      `SELECT id FROM tenants WHERE slug = 'skalean'`,
    );
    const actualSkaleanId: string = skaleanRow.rows[0]?.id ?? skaleanTenantId;

    // Seed 2 : Tenant Cabinet Bennani Assurance Casablanca
    log.info('Seed 2 : Tenant Bennani');
    const bennaniTenantId = generateUlid();
    await client.query(
      `INSERT INTO tenants (id, name, type, slug, settings, address, city, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (slug) DO NOTHING`,
      [
        bennaniTenantId,
        'Cabinet Bennani Assurance',
        'broker',
        'bennani',
        JSON.stringify({
          timezone: TIMEZONE,
          locale: 'fr',
          currency: 'MAD',
          ice: '001234567000089',
          rc: '123456',
          patente: '12345678',
          cnss: '1234567',
          if_fiscal: '01234567',
          acaps_code: 'CRT-001234',
        }),
        '15 Boulevard Mohammed V',
        'Casablanca',
      ],
    );
    const bennaniRow = await client.query<{ id: string }>(
      `SELECT id FROM tenants WHERE slug = 'bennani'`,
    );
    const actualBennaniId: string = bennaniRow.rows[0]?.id ?? bennaniTenantId;

    // Seed 3 : Tenant Garage Atlas Auto Marrakech
    log.info('Seed 3 : Tenant Atlas');
    const atlasTenantId = generateUlid();
    await client.query(
      `INSERT INTO tenants (id, name, type, slug, settings, address, city, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (slug) DO NOTHING`,
      [
        atlasTenantId,
        'Garage Atlas Auto',
        'garage',
        'atlas',
        JSON.stringify({
          timezone: TIMEZONE,
          locale: 'fr',
          currency: 'MAD',
          ice: '002345678000091',
          rc: '234567',
          patente: '23456789',
          cnss: '2345678',
          if_fiscal: '02345678',
        }),
        '42 Avenue Mohammed VI, Gueliz',
        'Marrakech',
      ],
    );
    const atlasRow = await client.query<{ id: string }>(
      `SELECT id FROM tenants WHERE slug = 'atlas'`,
    );
    const actualAtlasId: string = atlasRow.rows[0]?.id ?? atlasTenantId;

    // Seed 4 : 5 utilisateurs avec argon2id password
    log.info('Seed 4 : Users argon2id (DEV ONLY -- shared hash)');
    const passwordHash = await argon2Hash(DEFAULT_PASSWORD, {
      type: argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    interface UserSeed {
      id: string;
      tenantId: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      phone: string;
    }
    const users: UserSeed[] = [
      {
        id: generateUlid(),
        tenantId: actualSkaleanId,
        email: 'admin@skalean.ma',
        firstName: 'Belgacem',
        lastName: 'Naasaad',
        role: 'super_admin_platform',
        phone: '+212661234567',
      },
      {
        id: generateUlid(),
        tenantId: actualBennaniId,
        email: 'admin@bennani.ma',
        firstName: 'Karim',
        lastName: 'Bennani',
        role: 'broker_admin',
        phone: '+212662345678',
      },
      {
        id: generateUlid(),
        tenantId: actualBennaniId,
        email: 'agent@bennani.ma',
        firstName: 'Salma',
        lastName: 'Tazi',
        role: 'broker_user',
        phone: '+212663456789',
      },
      {
        id: generateUlid(),
        tenantId: actualAtlasId,
        email: 'chef@atlas.ma',
        firstName: 'Ahmed',
        lastName: 'El Alaoui',
        role: 'garage_chef',
        phone: '+212664567890',
      },
      {
        id: generateUlid(),
        tenantId: actualAtlasId,
        email: 'tech@atlas.ma',
        firstName: 'Youssef',
        lastName: 'Berrada',
        role: 'garage_technicien',
        phone: '+212665678901',
      },
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, phone, email_verified_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        [u.id, u.tenantId, u.email, passwordHash, u.firstName, u.lastName, u.role, u.phone],
      );
    }
    // Retrieve actual user ids
    const userRows = await client.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email = ANY($1)`,
      [users.map((u) => u.email)],
    );
    const userIdByEmail = new Map(userRows.rows.map((r) => [r.email, r.id]));

    const brokerUserId = userIdByEmail.get('agent@bennani.ma') ?? users[2]?.id ?? generateUlid();

    // Seed 5 : 50 contacts CRM (30 Bennani + 20 Atlas)
    log.info(`Seed 5 : ${CONTACTS_COUNT} contacts CRM`);
    const contactsBennani: Array<{
      id: string;
      tenantId: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      ice: string | null;
      cin: string | null;
      city: string;
      address: string;
      type: string;
    }> = [];
    const contactsAtlas: Array<{
      id: string;
      tenantId: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      cin: string | null;
      city: string;
      address: string;
      type: string;
      vehicleBrand: string;
      vehiclePlate: string;
    }> = [];
    const usedIces = new Set<string>();
    const usedCins = new Set<string>();

    const bennaniCount = Math.floor((CONTACTS_COUNT * 3) / 5);
    const atlasCount = CONTACTS_COUNT - bennaniCount;

    for (let i = 0; i < bennaniCount; i++) {
      const prenom = pickRandom(nomsFrMa.prenoms);
      const nom = pickRandom(nomsFrMa.noms);
      const ville = pickRandom(villesMa);
      let ice = generateIce();
      let iceRetry = 0;
      while (usedIces.has(ice) && iceRetry < 10) {
        ice = generateIce();
        iceRetry++;
      }
      usedIces.add(ice);
      let cin = generateCin();
      let cinRetry = 0;
      while (usedCins.has(cin) && cinRetry < 10) {
        cin = generateCin();
        cinRetry++;
      }
      usedCins.add(cin);

      contactsBennani.push({
        id: generateUlid(),
        tenantId: actualBennaniId,
        firstName: prenom,
        lastName: nom,
        email: `${prenom.toLowerCase().replace(/\s/g, '')}.${nom.toLowerCase().replace(/[\s']/g, '')}.${i}@example.ma`,
        phone: generatePhoneMa(),
        ice: i < bennaniCount - 5 ? ice : null,
        cin,
        city: ville.name,
        address: `${randomBetween(1, 200)} Rue ${faker.location.street()}, ${ville.name}`,
        type: i < Math.floor(bennaniCount * 0.8) ? 'individual' : 'corporate',
      });
    }

    for (let i = 0; i < atlasCount; i++) {
      const prenom = pickRandom(nomsFrMa.prenoms);
      const nom = pickRandom(nomsFrMa.noms);
      const ville = pickRandom(villesMa);
      let cin = generateCin();
      let cinRetry = 0;
      while (usedCins.has(cin) && cinRetry < 10) {
        cin = generateCin();
        cinRetry++;
      }
      usedCins.add(cin);

      contactsAtlas.push({
        id: generateUlid(),
        tenantId: actualAtlasId,
        firstName: prenom,
        lastName: nom,
        email: `${prenom.toLowerCase().replace(/\s/g, '')}.${nom.toLowerCase().replace(/[\s']/g, '')}.atlas${i}@example.ma`,
        phone: generatePhoneMa(),
        cin,
        city: ville.name,
        address: `${randomBetween(1, 200)} Rue ${faker.location.street()}, ${ville.name}`,
        type: 'individual',
        vehicleBrand: pickRandom(['Renault', 'Dacia', 'Peugeot', 'Citroen', 'Volkswagen', 'Ford', 'Toyota']),
        vehiclePlate: `${randomBetween(10000, 99999)}-${pickRandom(['A', 'B', 'C', 'D'])}-${randomBetween(1, 99)}`,
      });
    }

    for (const c of contactsBennani) {
      await client.query(
        `INSERT INTO contacts (id, tenant_id, first_name, last_name, email, phone, ice, cin, city, address, type, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         ON CONFLICT (tenant_id, email) DO NOTHING`,
        [
          c.id, c.tenantId, c.firstName, c.lastName, c.email,
          c.phone, c.ice, c.cin, c.city, c.address, c.type,
          JSON.stringify({ vehicleBrand: null, vehiclePlate: null }),
        ],
      );
    }
    for (const c of contactsAtlas) {
      await client.query(
        `INSERT INTO contacts (id, tenant_id, first_name, last_name, email, phone, ice, cin, city, address, type, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         ON CONFLICT (tenant_id, email) DO NOTHING`,
        [
          c.id, c.tenantId, c.firstName, c.lastName, c.email,
          c.phone, null, c.cin, c.city, c.address, c.type,
          JSON.stringify({ vehicleBrand: c.vehicleBrand, vehiclePlate: c.vehiclePlate }),
        ],
      );
    }
    // Retrieve actual contact ids for Bennani (needed for deals/polices)
    const bennaniContactRows = await client.query<{ id: string }>(
      `SELECT id FROM contacts WHERE tenant_id = $1 ORDER BY created_at LIMIT $2`,
      [actualBennaniId, bennaniCount],
    );
    const actualBennaniContacts = bennaniContactRows.rows;
    const atlasContactRows = await client.query<{ id: string }>(
      `SELECT id FROM contacts WHERE tenant_id = $1 ORDER BY created_at LIMIT $2`,
      [actualAtlasId, atlasCount],
    );
    const actualAtlasContacts = atlasContactRows.rows;

    // Seed 6 : 20 deals CRM (5 lead + 5 qualified + 5 proposal + 5 won)
    log.info(`Seed 6 : ${DEALS_COUNT} deals CRM`);
    const stages = [
      ...Array<string>(5).fill('lead'),
      ...Array<string>(5).fill('qualified'),
      ...Array<string>(5).fill('proposal'),
      ...Array<string>(5).fill('won'),
    ];
    for (let i = 0; i < DEALS_COUNT; i++) {
      const contact = actualBennaniContacts[i % Math.max(actualBennaniContacts.length, 1)];
      const stage = stages[i] ?? 'lead';
      const amount = randomBetween(5000, 50000);
      if (contact === undefined) continue;
      await client.query(
        `INSERT INTO deals (id, tenant_id, contact_id, owner_id, title, stage, amount_mad, expected_close_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT DO NOTHING`,
        [
          generateUlid(),
          actualBennaniId,
          contact.id,
          brokerUserId,
          `Deal ${stage} #${i + 1}`,
          stage,
          amount,
          randomDateInRange(0, 90),
        ],
      );
    }

    // Seed 7 : 5 assureurs MA
    log.info('Seed 7 : 5 assureurs MA');
    for (const a of assureursMa) {
      await client.query(
        `INSERT INTO insure_assureurs (id, tenant_id, name, acaps_code, ice, address, city, phone, email, website, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (acaps_code) DO NOTHING`,
        [
          generateUlid(), actualSkaleanId, a.name, a.acaps_code, a.ice,
          a.address, a.city, a.phone, a.email, a.website,
          JSON.stringify(a.metadata ?? {}),
        ],
      );
    }

    // Seed 8 : 25 produits assurance
    log.info('Seed 8 : 25 produits assurance');
    for (const p of produitsAssurance) {
      await client.query(
        `INSERT INTO insure_produits (id, tenant_id, assureur_acaps_code, code, name, type, premium_min_mad, premium_max_mad, garanties, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (code) DO NOTHING`,
        [
          generateUlid(), actualSkaleanId, p.assureur_acaps_code, p.code,
          p.name, p.type, p.premium_min_mad, p.premium_max_mad,
          JSON.stringify(p.garanties),
        ],
      );
    }

    // Seed 9 : 20 polices fictives (mix actives/expirees/annulees)
    log.info(`Seed 9 : ${POLICES_COUNT} polices`);
    const policeStatuses = [
      ...Array<string>(12).fill('active'),
      ...Array<string>(5).fill('expired'),
      ...Array<string>(3).fill('cancelled'),
    ];
    for (let i = 0; i < POLICES_COUNT; i++) {
      const contact = actualBennaniContacts[i % Math.max(actualBennaniContacts.length, 1)];
      const produit = produitsAssurance[i % produitsAssurance.length];
      const status = policeStatuses[i] ?? 'active';
      const numero = generatePoliceNumber(2026, i + 1);
      const startDate = status === 'expired' ? randomDateInRange(-365, -180) : randomDateInRange(-90, 0);
      const endDate = new Date(new Date(startDate).getTime() + 365 * 24 * 3600 * 1000).toISOString();
      if (contact === undefined || produit === undefined) continue;
      const premium = randomBetween(produit.premium_min_mad, produit.premium_max_mad);
      await client.query(
        `INSERT INTO insure_polices (id, tenant_id, numero, contact_id, assureur_acaps_code, produit_code, status, start_at, end_at, premium_mad, garanties_subscribed, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (tenant_id, numero) DO NOTHING`,
        [
          generateUlid(), actualBennaniId, numero, contact.id,
          produit.assureur_acaps_code, produit.code,
          status, startDate, endDate, premium,
          JSON.stringify(produit.garanties),
        ],
      );
    }

    // Seed 10 : 10 RDV booking dans futur
    log.info(`Seed 10 : ${RDV_COUNT} RDV`);
    for (let i = 0; i < RDV_COUNT; i++) {
      const tenantId = i < 5 ? actualBennaniId : actualAtlasId;
      const contactPool = i < 5 ? actualBennaniContacts : actualAtlasContacts;
      const contact = contactPool[i % Math.max(contactPool.length, 1)];
      if (contact === undefined) continue;
      let rdvAt = randomDateInRange(1, 30);
      let attempts = 0;
      while (isMoroccoHoliday2026(new Date(rdvAt)) && attempts < 20) {
        rdvAt = randomDateInRange(1, 30);
        attempts++;
      }
      await client.query(
        `INSERT INTO booking_rdv (id, tenant_id, contact_id, scheduled_at, duration_min, type, status, notes, created_at)
         VALUES ($1, $2, $3, $4, 30, $5, 'scheduled', $6, NOW())`,
        [
          generateUlid(), tenantId, contact.id, rdvAt,
          i < 5 ? 'consultation' : 'reparation',
          'Rendez-vous planifie via seed dev',
        ],
      );
    }

    // Seed 11 : 30 messages communication
    log.info(`Seed 11 : ${MESSAGES_COUNT} messages`);
    for (let i = 0; i < MESSAGES_COUNT; i++) {
      const channel = i % 2 === 0 ? 'whatsapp' : 'email';
      const direction = i % 3 === 0 ? 'inbound' : 'outbound';
      const tenantId = i < 20 ? actualBennaniId : actualAtlasId;
      const contactPool = i < 20 ? actualBennaniContacts : actualAtlasContacts;
      const contact = contactPool[i % Math.max(contactPool.length, 1)];
      if (contact === undefined) continue;
      await client.query(
        `INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, body, status, sent_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          generateUlid(), tenantId, contact.id, channel, direction,
          'Message de test genere par seed dev.',
          direction === 'outbound' ? 'sent' : 'received',
          randomDateInRange(-30, 0),
        ],
      );
    }

    // Seed 12 : 50 audit_log entries
    log.info(`Seed 12 : ${AUDIT_COUNT} audit_log`);
    const auditActions = ['INSERT', 'UPDATE'];
    const auditResources = ['contact', 'deal', 'police', 'rdv', 'message'];
    for (let i = 0; i < AUDIT_COUNT; i++) {
      const tenantId = i < 30 ? actualBennaniId : actualAtlasId;
      const tenantEmail = i < 30 ? 'agent@bennani.ma' : 'chef@atlas.ma';
      const userId = userIdByEmail.get(tenantEmail) ?? generateUlid();
      await client.query(
        `INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          generateUlid(), tenantId, userId,
          pickRandom(auditActions), pickRandom(auditResources), generateUlid(),
          JSON.stringify({ ip: '127.0.0.1', userAgent: 'seed-dev/1.0' }),
          randomDateInRange(-30, 0),
        ],
      );
    }

    // Seed 13 : 200 analytics_events en batch
    log.info(`Seed 13 : ${ANALYTICS_COUNT} analytics_events`);
    const analyticsEvents = [
      'page_view', 'login_success', 'contact_created', 'deal_stage_changed',
      'police_signed', 'rdv_booked', 'message_sent', 'export_csv',
    ];
    const batchSize = 50;
    for (let i = 0; i < ANALYTICS_COUNT; i += batchSize) {
      const valuesPlaceholders: string[] = [];
      const valuesParams: unknown[] = [];
      let paramIdx = 1;
      for (let j = 0; j < batchSize && i + j < ANALYTICS_COUNT; j++) {
        const idx = i + j;
        const tenantId = idx < 120 ? actualBennaniId : actualAtlasId;
        const tenantEmail = idx < 120 ? 'agent@bennani.ma' : 'chef@atlas.ma';
        const userId = userIdByEmail.get(tenantEmail) ?? generateUlid();
        valuesPlaceholders.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5})`);
        valuesParams.push(
          generateUlid(),
          tenantId,
          userId,
          pickRandom(analyticsEvents),
          JSON.stringify({ source: 'seed-dev', index: idx }),
          randomDateInRange(-60, 0),
        );
        paramIdx += 6;
      }
      if (valuesPlaceholders.length > 0) {
        await client.query(
          `INSERT INTO analytics_events (id, tenant_id, user_id, event_name, properties, occurred_at)
           VALUES ${valuesPlaceholders.join(', ')}`,
          valuesParams,
        );
      }
    }

    await client.query('COMMIT');
    const elapsed = (Date.now() - startTime) / 1000;
    log.info({ elapsedSeconds: elapsed }, 'Seeds completed successfully');
    if (elapsed > 30) {
      log.warn({ elapsedSeconds: elapsed }, 'Seeds exceeded 30s target');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    log.error({ err }, 'Seeds failed -- transaction rolled back');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  log.error({ err }, 'Seeds fatal error');
  process.exit(1);
});
