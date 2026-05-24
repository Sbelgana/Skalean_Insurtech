# Decision 011 -- Rebranding Skalean Company / Assurflow Vertical InsurTech

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-011-assurflow-rebrand.md`

---

## Contexte

Le projet a ete initialement nomme **Skalean InsurTech** v2.0 puis v2.2 (35 sprints, 7 phases, 12 mois execution), avec une structure mono-marque ou Skalean designait a la fois la company holding et le produit vertical d'assurance.

Apres reflexion strategique et analyse marche (analyse strategique v2.0 produite 22-23 mai 2026), il devient clair que cette structure mono-marque presente trois problemes majeurs :

1. **Confusion produit / company** : Skalean evoque generiquement "scale lean" sans specificite assurance. Difficile a positionner aupres des acteurs InsurTech marche MA.

2. **Limitation expansion verticaux futurs** : si Skalean veut lancer d'autres verticaux (Healthtech, OBNL, Immo, Education, Government, Legal, Construction, HR), chaque vertical aurait besoin de sa propre identite produit. Mono-marque empeche cette expansion.

3. **Concurrence directe Courtizen positioning** : Courtizen se positionne comme "OS for Insurance Distribution". Skalean InsurTech generique = combat de positioning perdu d'avance. Necessite specialisation marque dediee.

Solutions etudiees :
- (A) Garder Skalean InsurTech mono-marque
- (B) Renommer la company en Assurflow et abandonner Skalean
- (C) Architecture marque a 2 niveaux : Skalean (company / platform IA horizontale) + Assurflow (vertical InsurTech)

## Probleme adresse

Comment positionner et nommer correctement le programme pour :
- Specialiser l'identite InsurTech (combat marketing vs Courtizen)
- Preserver l'expansion future vers d'autres verticaux sectoriels
- Conserver la valeur deja accumulee dans la marque Skalean
- Maintenir la coherence technique du monorepo
- Faciliter le pitch aupres carriers / ACAPS / VCs

## Decision

**Architecture marque a 2 niveaux adoptee (Option C)** :

```
SKALEAN (company holding + platform IA horizontale)
  |
  +-- Platform IA modules horizontaux
  |   - Skalean Studio IA
  |   - Skalean Automatisation IA
  |   - Skalean Assistant IA
  |   - Skalean Modele IA
  |
  +-- ASSURFLOW (vertical InsurTech complet)
  |   - Assurflow Carrier Portal (Acteur 1 -- Assurances)
  |   - Assurflow Broker (Acteur 2 -- Courtiers)
  |   - Assurflow Garage + PartsHub integre (Acteur 3 -- Garagistes)
  |   - Assurflow Customer + Assure (Acteur 4 -- Clients)
  |   - Assurflow Tow (Acteur 5 -- Remorqueurs)
  |   - Assurflow Expert (Acteur 6 -- Experts)
  |   - Assurflow Sky AI (IA verticale specialisee)
  |
  +-- Verticaux futurs (selon roadmap)
      - Healthtech vertical (a nommer)
      - OBNL vertical (a nommer)
      - Immo vertical (a nommer)
      - etc.
```

**Pattern de naming choisi** : similaire a Salesforce (Sales Cloud, Service Cloud, etc.) ou Microsoft (Office, Azure, Dynamics).

## Mapping technique de la migration

### Domains (Option C confirmee)

| Domain | Usage |
|--------|-------|
| `skalean.com` | Homepage company + verticaux + about |
| `skalean.com/ai-platform` | Pages platform IA horizontale |
| `assurflow.com` | Homepage vertical InsurTech + landing pages 6 apps |
| `assurflow.com/broker` | Landing page Assurflow Broker |
| `assurflow.com/garage` | Landing page Assurflow Garage |
| `assurflow.com/carrier` | Landing page Assurflow Carrier Portal |
| `assurflow.com/expert` | Landing page Assurflow Expert |
| `assurflow.com/tow` | Landing page Assurflow Tow |
| `assurflow.com/customer` | Landing page Customer + Assure |
| `app.assurflow.com/broker` | Assurflow Broker app (port 3001) |
| `app.assurflow.com/garage` | Assurflow Garage app (port 3002) |
| `app.assurflow.com/garage-mobile` | Garage technicien PWA (port 3003) |
| `app.assurflow.com/customer` | Customer Portal (port 3004) |
| `app.assurflow.com/assure` | Assure Portal (port 3005) |
| `app.assurflow.com/assure-mobile` | Assure mobile PWA (port 3006) |
| `app.assurflow.com/tow-mobile` | Tow driver mobile PWA (port 3007 -- NOUVEAU) |
| `app.assurflow.com/carrier` | Carrier Portal (port 3008 -- NOUVEAU) |
| `app.assurflow.com/expert` | Expert app desktop (port 3009 -- NOUVEAU) |
| `api.assurflow.com` | API NestJS (port 4000) |
| `admin.assurflow.com` | Admin Platform (port 3000) |
| `mcp.assurflow.com` | MCP Server (port 4001) |

### Code refactor (decision 7.5a + 7.5b)

| Element | Etat actuel | Cible v3.0 |
|---------|-------------|------------|
| Repo Git | `skalean-insurtech` | Conserve (Option A pragmatique pour Phase 1) |
| Package namespace | `@insurtech/*` | Conserve Phase 1 |
| Postgres role | `insurtech_app` | Conserve Phase 1 |
| Kafka topics | `insurtech.events.*` | Conserve Phase 1 |
| package.json `homepage` | `skalean-insurtech.ma` | `assurflow.com` |
| Variables env domains | `*.skalean-insurtech.ma` | `*.assurflow.com` |
| DKIM email signing | `skalean-insurtech.ma` | `assurflow.com` |
| CORS allowed origins | `skalean-insurtech.ma` | + `assurflow.com` + `app.assurflow.com` |
| Documentation pilotage | "Skalean InsurTech" / "Skalean Broker" / "Skalean Garage" | "Assurflow" / "Assurflow Broker" / "Assurflow Garage" |
| Cookies Domain | `.skalean-insurtech.ma` | `.assurflow.com` |

### Phase 2 (post-pilote Marrakech)

Migration profonde possible apres validation pilote :
- Renommage repo : `skalean-insurtech` -> `assurflow`
- Refactor namespace : `@insurtech/*` -> `@assurflow/*`
- Refactor Postgres role : `insurtech_app` -> `assurflow_app`
- Refactor Kafka topics : `insurtech.events.*` -> `assurflow.events.*`

Cette migration profonde represente ~20-30h refactor + tests. Decision reportee post-pilote pour eviter risque execution v3.0.

### Fallback DNS

Conservation domains `*.skalean-insurtech.ma` comme redirect 301 vers `*.assurflow.com` pendant 12 mois post-rebrand pour preserver SEO + liens externes.

## Strategie de communication

| Audience | Message |
|----------|---------|
| ACAPS Programme Emergence | "Assurflow, vertical InsurTech de Skalean, plateforme InsurTech marocaine complete couvrant 6 acteurs ecosysteme assurance auto" |
| Carriers (Wafa, Sanlam, AXA, RMA, Saham, Atlanta, MATU, Sanad) | "Assurflow Carrier Portal -- votre nouveau outil pour gerer claims temps reel + compliance ACAPS automatisee" |
| Brokers | "Assurflow Broker -- comparateur multi-carriers en 3 minutes + CRM integre" |
| Garages | "Assurflow Garage -- ERP complet (compta + workflow + PartsHub integre + paiement carrier 7 jours)" |
| Clients finaux | "Assurflow -- l'assurance auto simplifiee (souscription 3 min + sinistre 5 jours + remorqueur Uber-style)" |
| Investisseurs | "Skalean : platform IA horizontale avec premier vertical Assurflow (InsurTech MA + CIMA 14 marches)" |
| Equipe technique | "On reste sur skalean-insurtech repo, les apps user-facing sont rebrand Assurflow" |

## Strategie de mitigation pendant developpement

Pendant la migration v3.0 (Sprint 7.5a + 7.5b), pour eviter regression :
- Tous les tests existants continuent de PASS (no regression sur code livre)
- Le code metier (sprints 8-35) est genere directement avec naming v3.0
- Le code foundation (sprints 1-7) garde le namespace `@insurtech/*` initialement
- Migration profonde reportee Phase post-pilote (decision a re-evaluer T2 2027)

## Avantages

1. **Specialisation marketing** : Assurflow attaque directement le marche InsurTech sans dilution
2. **Expansion future preservee** : Skalean peut lancer autres verticaux sans casser Assurflow
3. **Combat positioning vs Courtizen** : Assurflow = OS for Auto Insurance Ecosystem (6 acteurs vs 3)
4. **Coherence pitch carriers** : "Assurflow Carrier Portal" sonne mieux que "Skalean Broker pour carriers"
5. **SEO ameliore** : assurflow.com = mot-cle assurance + workflow, meilleur ranking
6. **Risque execution faible** : changement majoritairement documentation + frontend, code backend impactne minimal
7. **Architecture marque scalable** : pattern Salesforce/Microsoft reconnu et eprouve

## Inconvenients

1. **Effort migration documentation** : 12696 references "Skalean InsurTech" dans 00-pilotage/ a refactorer (~6h Sprint 7.5b)
2. **Risque confusion temporaire** : pendant 3-6 mois, audience peut confondre les 2 marques
3. **Coût domain assurflow.com** : achat domaine + DNS migration (~500 EUR initial + 100 EUR/an)
4. **Sites web a refondre** : skalean.com (homepage company) + assurflow.com (homepage vertical) + landing pages

## Impact technique

- **Aucun code livre touche** : Sprint 1-6 livres + Sprint 7 task 2.3.1 livre conservent `@insurtech/*` namespace
- **Sprint 7.5a impact** : juste decision documentaire formalisee
- **Sprint 7.5b impact** : refactor massif documentation + variables env + cookies domain
- **Sprints 8-35 impact** : utilisent direct naming Assurflow dans specs et UI strings
- **Tests** : tests existants PASS sans modification (namespace conserve)

## Communication

Cette decision est communiquee :
- A l'equipe technique : guide migration documentation Sprint 7.5b
- A l'equipe business : pitch carriers + brokers + clients utilise "Assurflow"
- A ACAPS : dossier Programme Emergence reference "Assurflow vertical de Skalean"
- A audience publique : skalean.com (company) + assurflow.com (vertical) lancement coordonne

---

**Decision finale** : OK pour rebrand a 2 niveaux : Skalean (company) + Assurflow (vertical). Migration documentation Sprint 7.5b. Migration code profonde reportee Phase post-pilote.

**References** :
- decision-006-no-emoji-policy.md (style guide identique)
- decision-008-data-residency-maroc.md (Atlas Cloud Services conserve)
- assurflow-analyse-strategique-v2.docx (analyse strategique v2.0 source)
- skalean-proposition-de-valeur.docx (proposition valeur sourced)
- B-7.5a-sprint-7.5a-assurflow-foundation.md (sprint d'execution)
