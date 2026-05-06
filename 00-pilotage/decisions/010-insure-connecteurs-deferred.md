# Decision 010 -- Insure Connecteurs Assureurs Defere en Phase 7

**Date** : 2026-05-05
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-010-insure-connecteurs-defere.md`

---

## Contexte

Sprint Insure Connecteurs Assureurs (5 connecteurs : Wafa, Atlanta, Saham, RMA, AXA) etait initialement en **Phase 4 Sprint 15** (B-15). Apres reflexion strategique, la decision est prise de **deplacer ce sprint en Phase 7 Sprint 32** (B-32), suivant le pattern deja adopte pour les sprints Skalean AI (decision-007).

## Probleme adresse

Les risques d'execution en gardant les connecteurs en Phase 4 :

1. **API maturity variable assureurs MA** :
   - Wafa : API moderne (cible priorite 1)
   - Atlanta / Saham : APIs en cours de developpement
   - RMA / AXA : partiellement documentees, possibles besoins integrations alternatives (EDI legacy, fichiers CSV)

2. **Partenariats commerciaux non encore acquis** : besoin signature accords commerciaux + acces sandbox per assureur AVANT pouvoir tester integration reelle

3. **Risque cascade Phase 4** : si bloque sur connecteurs (negociation lente, API doc indisponible, sandbox down), risque bloquer toute la Phase 4 vertical Insure

4. **Dependance ecosystem externe** : meme pattern que Skalean AI (defere) -- regrouper toutes dependances ecosystem en Phase 7 simplifie execution

## Decision

**Skalean Insure Connecteurs deplace de Phase 4 Sprint 15 (B-15) vers Phase 7 Sprint 32 (B-32)**.

Cascade renumerotation :
- B-15 (Connecteurs) -> B-32 (Phase 7 Sprint 4)
- B-16 a B-29 anciens -> B-15 a B-28 nouveaux (decalage -1)
- B-30 a B-32 anciens (Skalean AI) -> B-29 a B-31 nouveaux
- B-33, B-34, B-35 inchanges

Numerotation taches :
- 4.2.X -> 7.4.X (Phase 7 Sprint 4)

## Nouvelle structure phases

| Phase | Sprints | Count | Modules |
|-------|---------|-------|---------|
| Phase 1 Bootstrap | B-01 a B-04 | 4 | Setup + DB + API + Frontend |
| Phase 2 Securite | B-05 a B-07 | 3 | Auth + Multi-tenant + RBAC |
| Phase 3 Modules Horizontaux | B-08 a B-13 | 6 | CRM+Booking / Comm / Docs+Sig / Pay / Books / Analytics+Stock+HR |
| **Phase 4 Vertical Insure (pure ERP)** | **B-14 a B-18** | **5** | Foundation / Lifecycle / 3 web apps |
| Phase 5 Vertical Repair | B-19 a B-25 | 7 | Foundation / IA / Sinistre / 2 garage apps / Cross-tenant |
| Phase 6 Admin Platform | B-26 a B-28 | 3 | Admin foundation + Tenants + Reports |
| **Phase 7 Hardening+Integrations+Pilote** | **B-29 a B-35** | **7** | AI defere + Connecteurs + Pentest + Perf + Pilote |
| **Total** | | **35** | |

## Strategie de mitigation pendant developpement

Pendant Phases 4-6, les modules dependants des assureurs utilisent **fallbacks robustes** :
- **Tarification** (Sprint 14) : utilise lookup tables au lieu d'API real-time assureurs
- **Souscription** (Sprint 14) : workflow signature Skalean fonctionne sans push assureur
- **Sinistres** (Sprint 21) : declaration interne Skalean (sans push assureur dans Phase 5)
- **ACAPS reports** (Sprint 12) : utilisent donnees internes Skalean polices/sinistres

Tout ceci permet a Skalean Broker ERP d'etre **completement fonctionnel** sans connecteurs assureurs.

## Strategie pilote Phase 7

Pilote Marrakech (Sprint 35 -- inchange) demarre avec :
- **1 seul assureur Wafa** integre via Sprint 32 connecteurs
- Autres 4 assureurs (Atlanta/Saham/RMA/AXA) ajoutes graduelement post-pilote selon partenariats commerciaux
- Tarification : transition progressive lookup tables -> Wafa real-time pour produits Wafa
- Polices : push automatique Skalean -> Wafa apres signature

## Avantages

1. **Phase 4 Vertical Insure pure ERP** : focus 100% experience metier sans depend ecosystem
2. **ACAPS Programme Emergence** peut demarrer + valider socle marche sans connecteurs reels (decoupling reglementaire/commercial)
3. **Pilote Marrakech** peut commencer avec 1 assureur au lieu d'attendre 5 simultanes
4. **Connecteurs developpes en parallele du pilote** : reels feedbacks marche guident integration
5. **Strategie coherente avec AI defere** : tout ce qui depend ecosystem externe groupe en Phase 7
6. **Risk mitigation** : si Phase 4-6 prend +20% du temps, livraison MVP marche pas affectee par retards assureurs

## Inconvenients

1. **Demo investisseurs** : pas de demo connecteur assureur reel pendant Phase 4 (mock visible)
2. **Tarification approximative** : lookup tables Sprint 14 peuvent etre 10-20% off vs prix assureur reel
3. **Pas de feedback API maturity** : risque decouvrir tard problemes API assureurs

Inconvenients juges acceptables car compenses par predictabilite execution.

## Impact technique

- **Aucun fichier code change** : Sprint 14 Foundation Insure deja prevu fallback lookup tables
- **Sprint 32** : meme contenu technique que B-15 origine, juste renumeroated
- **Tests** : tests E2E Phase 4 utilisent mocks connecteurs (deja prevu dans interfaces)

## Communication

Cette decision est communiquee :
- A l'equipe technique : guide development Phase 4 (utiliser fallbacks lookup tables)
- A l'equipe business : pilote Marrakech demarre avec 1 assureur (Wafa)
- A ACAPS : dossier Programme Emergence ne mentionne pas connecteurs assureurs comme prerequis (correct car non requis)

---

**Decision finale** : OK pour reporter B-15 Insure Connecteurs en B-32 Phase 7. Cascade renumerotation executee.

**References** :
- decision-007-skalean-ai-deferred.md (pattern similaire pour Skalean AI)
- B-32-sprint-32-insure-connecteurs.md (sprint deplace)
- 9-roadmap-execution.md (mis a jour)
