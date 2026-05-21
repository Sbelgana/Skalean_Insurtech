# CNDP Purge Procedure -- Runbook DPO

Reference : Sprint 6 / Tache 2.2.12 + loi 09-08 droit oubli (articles 24-26) + ACAPS InsurTech Programme Emergence.

## Vue d'ensemble

La procedure de purge tenant ou user-data conforme la loi 09-08 CNDP (Commission Nationale de Controle de la Protection des Donnees a caractere personnel) Maroc. Toute demande d'utilisateur (droit a l'oubli) suit ce flux validation + grace period 30 jours + execution irreversible.

## Roles impliques

- **Data Protection Officer (DPO) Skalean** : recoit demande utilisateur, initie request via API
- **Super Admin Platform** : valide la demande (super_admin_platform role)
- **Auditeur Compliance** : verifie via `GET /api/v1/admin/cndp/purge-requests`
- **Super Admin Platform** : execute apres grace period 30j

## Workflow detaille

### 1. Demande utilisateur

Utilisateur envoie demande ecrite (email, courrier) au DPO Skalean en specifiant :
- Identite (CIN ou passeport scan)
- Email du compte concerne
- Tenant (cabinet/garage)
- Motivation (loi 09-08)
- Type : user_data (un user) ou full_tenant (tout le cabinet, rare)

### 2. Verification identite (DPO)

DPO Skalean :
1. Verifie identite via document officiel
2. Verifie que la demande respecte loi 09-08 (cas exceptionnel : conservation obligatoire 10 ans audit ACAPS / 10 ans comptabilite -- voir Sprint 12)
3. Cree purge request via API :

```bash
curl -X POST https://api.skalean.ma/api/v1/admin/cndp/purge-request \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "<uuid>",
    "requestType": "user_data",
    "targetUserId": "<uuid-utilisateur>",
    "requestedByEmail": "<email-utilisateur>",
    "reason": "Demande droit a l'oubli loi 09-08 articles 24-26. Documents identite verifies (CIN scan archived). Reference dossier : DPO-2026-XXX."
  }'
```

Response : `{ id, status: 'pending', createdAt, ... }`

### 3. Validation Super Admin

Super Admin Skalean (different du DPO pour separation des roles) :
1. Examine pending requests : `GET /api/v1/admin/cndp/purge-requests`
2. Examine detail : `GET /api/v1/admin/cndp/purge-requests/:id`
3. Verifie absence d'obligations legales contraires (ACAPS audit en cours, comptabilite annee en cours)
4. Valide :

```bash
curl -X POST https://api.skalean.ma/api/v1/admin/cndp/purge-requests/<id>/validate \
  -H "Authorization: Bearer <super_admin_token>"
```

Response : `status='in_grace_period', graceEndsAt=<now+30j>`

### 4. Grace period 30 jours (legal)

Pendant 30 jours :
- Utilisateur peut rappeler pour CANCEL (changement avis)
- Aucune action automatique
- Logs Pino structures `cndp_purge_validated`

Cancel possible :
```bash
curl -X POST https://api.skalean.ma/api/v1/admin/cndp/purge-requests/<id>/cancel \
  -H "Authorization: Bearer <super_admin_token>" \
  -d '{"reason": "Demande retiree par l'utilisateur par email YYYY-MM-DD"}'
```

### 5. Execution (apres 30j)

Apres `graceEndsAt`, super admin execute :

```bash
curl -X POST https://api.skalean.ma/api/v1/admin/cndp/purge-requests/<id>/execute \
  -H "Authorization: Bearer <super_admin_token>"
```

Workflow execution :
1. Transaction TypeORM atomique
2. Soft-delete `auth_users` (deletedAt = now)
3. Hard-delete `auth_tenant_users` (jointure user-tenant)
4. Pour `full_tenant` : soft-delete `auth_tenants` (cascade tenant lui-meme)
5. **Sprint 12** ajoutera : hard-delete differe 90j + backup encrypted pre-purge

Response : `{ status: 'completed', executedAt, completedAt, affectedRecords: { auth_users: 1, ... } }`

### 6. Notification post-purge

DPO notifie l'utilisateur (email) :
- Confirmation execution
- Numero dossier
- Date completion
- Audit trail conservation 10 ans (legal requirement ACAPS + CGNC)

## Exceptions legales

Certaines donnees DOIVENT etre conservees malgre demande droit oubli :
- **Audit ACAPS** (loi 17-99 article 9) : 10 ans -> ne PAS purger `compliance_acaps_audits`
- **CGNC comptabilite** (loi 9-88) : 10 ans -> ne PAS purger `books_invoices`, `pay_transactions`
- **Litiges en cours** : conservation tant que dossier ouvert
- **Sinistres avec contre-partie** : 10 ans loi 17-99

Le DPO documente l'exception dans `reason` lors de l'initiate. Sprint 12 raffinera avec filtre table par defaut.

## Audit trail

Tous les flows publient logs Pino structures :
- `cndp_purge_initiated` (DPO action)
- `cndp_purge_validated` (super admin validation)
- `cndp_purge_executed` (irreversible)
- `cndp_purge_cancelled` (DPO ou super admin cancel)

Conservation logs : 10 ans (Atlas Cloud Services Benguerir Maroc, decision-008 data residency).

## Reference legale

- Loi 09-08 (2009) : Protection des personnes physiques a l'egard du traitement des donnees personnelles
- Article 24 : droit d'acces
- Article 25 : droit de rectification
- Article 26 : droit de suppression (droit a l'oubli)
- Decret 2-09-165 : modalites d'application loi 09-08
- Decision CNDP 478-2013 : transferts internationaux (impacte data residency)

## Contact CNDP

En cas de notification breach obligatoire 72h :
- Email : contact@cndp.ma
- Web : https://www.cndp.ma

Reference Sprint 35 : pilote Marrakech notification breach < 72h obligatoire.
