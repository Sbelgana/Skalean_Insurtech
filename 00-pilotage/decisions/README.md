# Decisions Strategiques Assurflow v3.0 (anciennement Skalean InsurTech v2.2)

Ce dossier contient les **15 decisions strategiques** formalisees du programme.

## Statut : 15/15 COMPLETES

| # | Titre | Statut | Effort impact |
|---|-------|--------|---|
| 001 | Monorepo pnpm + Turborepo | OK | Sprint 1 |
| 002 | Multi-tenant 3 niveaux + RLS | OK | Sprint 1, 6, 25 |
| 003 | TypeORM 0.3 vs Prisma | OK | Sprint 1, 2 |
| 004 | Kafka KRaft vs RabbitMQ | OK | Sprint 1, 2 |
| 005 | Skalean AI Frontier model | OK | Sprint 29-31 |
| 006 | No-emoji policy absolute | OK | Tous sprints |
| 007 | AI defere (Mock Sprint 20 -> Real Sprint 29) | OK | Sprint 20, 29 |
| 008 | Data residency Maroc strict (CNDP loi 09-08) | OK | Sprint 6, 10, 12 |
| 009 | Signature loi 43-20 (Barid eSign + ANRT) | OK | Sprint 10 |
| 010 | Insure Connecteurs defere Phase 7 | OK | Sprint 32 |
| 011 | Assurflow rebrand (editeur Skalean / produit Assurflow) | OK | Sprint 7.5a, 7.5b |
| 012 | Ecosysteme 6 acteurs (vs 3 v2.2) -- 26 roles / 7 cross-tenant / 130 perms | OK | Sprint 7.5a, 7 |
| 013 | Expert acteur central designe par carrier (4 roles, agrement ACAPS) | OK | Sprint 7.5a, 22.7 |
| 014 | PartsHub Phase 1 module integre verticale Garage | OK | Sprint 7.5a, 8+ |
| 015 | Demo Day 30 juin 2026 scope complet v3.0 (pilote Marrakech) | OK | Tous sprints 7.5a-25 |

## Organisation decisions

Chaque decision suit format standard :
- **Date + Statut** (Acceptee / Proposee / Depreciee)
- **Decideurs** (Saad CTO + Abla CEO)
- **Contexte** : situation business + technique
- **Probleme adresse** : enjeux a resoudre
- **Decision** : choix retenu + rationale
- **Avantages** / **Inconvenients**
- **Impact technique** : sprints affectes
- **Communication** : equipe + stakeholders
- **References** : ADR mirror + sprints + sources externes

## ADR mirror

Chaque decision a son ADR (Architecture Decision Record) dans `repo/docs/architecture/ADR-NNN-*.md` une fois Sprint 1 deploye.

## Categorisation

**Decisions architecture** (ADR mirror direct) :
- 001 Monorepo, 002 Multi-tenant, 003 TypeORM, 004 Kafka, 005 Skalean AI, 012 Ecosysteme 6 acteurs, 013 Expert acteur central

**Decisions process / qualite** :
- 006 No-emoji policy

**Decisions strategiques business / sequencement** :
- 007 AI defere, 010 Insure Connecteurs defere, 011 Assurflow rebrand, 014 PartsHub Phase 1, 015 Demo Day 30 juin 2026

**Decisions reglementaires** :
- 008 Data residency MA (CNDP), 009 Signature 43-20, 013 Expert agrement ACAPS

## Migration v2.2 -> v3.0 (Sprint 7.5a)

Les decisions 011 a 015 actent le passage de la version v2.2 (3 acteurs, marque Skalean InsurTech) a la version v3.0 (6 acteurs, marque Assurflow editee par Skalean). Cette migration est une extension additive : les decisions 001 a 010 restent valides ; les decisions 011 a 015 les completent sans les abroger.

## Modifications

Toute modification d'une decision doit :
1. Creer nouvelle version (decision-NNN-v2.md)
2. Marquer ancienne `Statut: Depreciee + Reason`
3. Updater references dans sprints + 8-master.md + autres docs
4. Audit cross-fichiers re-execute

## Reference

Voir `8-skalean-insurtech-prompt-master.md` Section 14 pour vue d'ensemble decisions.
Voir `B-7.5a-sprint-7.5a-assurflow-foundation.md` pour la migration v2.2 -> v3.0.
