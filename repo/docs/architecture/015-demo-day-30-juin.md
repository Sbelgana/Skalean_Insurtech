# Decision 015 -- Demo Day 30 Juin 2026 -- Scope Complet + Strategie Co-Developpement

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-015-demo-day-30-juin.md`

---

## Contexte

Saad a identifie un **moment strategique** : un Demo Day est prevu le **30 juin 2026** pour pitcher devant les acteurs de l'ecosysteme fintech au Maroc et tenter de :
- Signer 1-2 lettres d'intent de co-developpement avec compagnies d'assurance (carriers)
- Obtenir financement amorcage par les carriers signataires
- Eviter levee VC premature (preserver equity + tractions before VC)
- Generer visibility Assurflow aupres ACAPS Programme Emergence

**Contexte temporel** : entre la date de creation cette decision (23 mai 2026) et le Demo Day (30 juin 2026), il reste **38 jours calendrier**.

**Realite execution** :
- Etat actuel : Sprint 7 RBAC en cours (tache 2.3.1 livre, tache 2.3.2 prochaine)
- Plan v3.0 = 40 sprints au total (6 livres + 1 en cours + 33 a faire)
- Effort total restant programme = ~3000h
- Capacite max realiste : 16h/jour x 38 jours = 608h

**Analyse risque Claude** :
- Probabilite "tout livrer parfait avant 30 juin" : <5%
- Probabilite "scope reduit + bon Demo" : 40-50%
- Risque burnout Saad : eleve si 16h/jour pendant 38 jours
- Risque qualite degradee : eleve si precipitation

Solutions etudiees :
- (A) Demo Day 30 juin scope reduit (mockup + architecture live + roadmap)
- (B) Demo Day 30 juin tout livrer parfait (decision Saad)
- (C) Repousser Demo Day a septembre 2026 (apres Sprint 22 ~complet)
- (D) Annuler Demo Day, focus uniquement Pilote Marrakech Avril 2027

## Probleme adresse

Comment maximiser les chances de signer des lettres d'intent + financement amorcage le 30 juin 2026, tout en :
- Conservant la pression de livraison (motivation Saad)
- Reduisant le risque execution / burnout
- Preservant la qualite et la coherence v3.0
- Permettant fallback plan si derapage detecte

## Decision

**Adoption Option B : Demo Day 30 juin 2026 scope complet (decision Saad assumee)**.

**Mitigation** : fallback plan declenche au **15 juin 2026 (J-15)** si signaux derapage detectes.

### Strategie execution 38 jours

```
SEMAINE 1 (23-29 mai) :
- Sprint 7.5a (25h)  -- decisions + RBAC foundation v3.0
- Sprint 7 reprise tache 2.3.2 a 2.3.5 (15h)
- Sprint 7.5b partiel (15h) -- specifications nouveaux sprints
Total : ~55h

SEMAINE 2 (30 mai - 5 juin) :
- Sprint 7.5b complet (20h)
- Sprint 7 reprise tache 2.3.6 a 2.3.12 (35h)
- Sprint 8 CRM + Booking (40h)
Total : ~95h

SEMAINE 3 (6-12 juin) :
- Sprint 9 Comm WhatsApp + Email (60h)
- Sprint 10 Docs + Signature (50h)
Total : ~110h

SEMAINE 4 (13-19 juin) :
- Sprint 11 Pay (50h)
- Sprint 12 Books + Compliance (50h)
- Sprint 13 Analytics + Stock + HR (40h)
Total : ~140h

CHECKPOINT 15 JUIN (J-15) :
- Audit progression : si < 50% Sprint 13 fini -> declenchement fallback plan
- Decision finale scope Demo Day

SEMAINE 5 (20-26 juin) :
- Sprint 14 Insure Foundation (60h)
- Sprint 15 Insure Lifecycle (40h)
- Sprint 16 Web Broker App (40h)
Total : ~140h

SEMAINE 6 (27-30 juin) :
- Sprint 17 Web Customer Portal (40h)
- Sprint 18 Web Assure Portal + Mobile (40h)
- Preparation pitch + scenarios + demo data (30h)
Total : ~110h

TOTAL SEMAINES 1-6 : ~650h en 38 jours = ~17h/jour effort intense

ETAT POSSIBLE 30 JUIN :
- Sprints 1-18 LIVRES (Phase 1-4 complets) -- ~95% probabilite
- Sprints 19-22 partiellement livres -- ~30% probabilite
- Sprints 22.5 Tow + 22.7 Expert + 26.5 Carrier Portal -- 0-20% probabilite
- Sprints 23-35 -- non livres
```

### Scope Demo Day 30 juin (cible realiste)

**Si TOUT livre selon plan optimiste** :
- Demo coordonne 5 acteurs sinistre live (Mariem/Karim/Hassan/Said/Wafa)
- Tous les workflows fonctionnels
- 1071+ tests existants + nouveaux tests = ~5000+ tests cumules

**Si livraison partielle (probabilite ~60%)** :
- Sprint 1-13 livres = backend solide + tests live (RBAC + Multi-tenant + Auth + horizontaux)
- Sprint 14-18 partiel = Insure foundation + Customer Portal partiel
- Mockup interactif Figma pour parties non livrees (Sprint 22.5 Tow + 22.7 Expert + 26.5 Carrier)
- Demo : architecture live + workflows partiels + mockup pour acteurs manquants

### Format Demo Day 30 juin (15 minutes)

```
MINUTE 0-3 : Introduction et probleme marche
- Saad + Abla bios
- Probleme assurance auto MA chiffre (sinistre 7-12 jours, 400k MAD impayes MATU)
- Ecosystem 6 acteurs Assurflow
- Differentiation vs Courtizen

MINUTE 3-11 : Demo
- ARCHITECTURE LIVE : RBAC + Multi-tenant + Auth + tests
- WORKFLOWS LIVE : Broker souscription + Customer portal + Garage devis (selon scope livre)
- MOCKUP INTERACTIF : Tow + Expert + Carrier Portal (si pas livre)

MINUTE 11-14 : Vision et roadmap
- Sprints 22.5 Tow + 22.7 Expert + 26.5 Carrier Portal
- Sky AI pre-training sur historique reel garage Saad
- Pilote Marrakech Mars-Avril 2027

MINUTE 14-15 : Ask final
- Co-developpement 1-2 carriers : lettres d'intent
- Financement amorcage avant levee VC
- Partenariat ACAPS Programme Emergence
```

### Audience cible Demo Day

| Audience | Objectif specifique |
|----------|---------------------|
| **Carriers (Wafa cible)** | Signature lettre d'intent co-developpement + financement amorcage |
| **Wafa Assurance** | Cible #1 (API moderne + partenariat ACAPS) |
| **Sanlam** | Cible #2 (bon payeur reference + relations Abla) |
| **AXA** | Cible #3 (interest InsurTech) |
| **RMA** | Cible #4 (volume marche) |
| **Saham** | Cible #5 (innovation focus) |
| **MATU** | Cible #6 (pain point identifie -- 400k MAD impayes garage Saad) |
| **Sanad** | Cible #7 (bon payeur referrence) |
| **ACAPS** | Validation Programme Emergence avance + dossier complet |
| **Investisseurs fintech MA** | Lead generation pour future levee VC (T4 2026 ou T1 2027) |
| **Brokers majeurs** | Adoption prospective Assurflow Broker post-pilote |

### Resultats Demo Day attendus

**Primaires** :
- [ ] 1-2 lettres d'intent co-developpement carrier signees
- [ ] Financement amorcage carrier signe (~500k-2M MAD)
- [ ] Avancement dossier ACAPS Programme Emergence

**Secondaires** :
- [ ] 5-10 leads carriers (post-relances)
- [ ] 5-10 leads brokers majeurs
- [ ] Press release fintech MA
- [ ] Tractions pour future levee VC

### Fallback Plan declenche au 15 juin 2026 (J-15)

Si signaux derapage detectes au checkpoint 15 juin :

**Signaux derapage** :
- Sprint 13 pas fini ou < 50% complete
- Bugs critiques en regression sur Sprint 1-7 livres
- Capacite Saad < 12h/jour soutenable (burnout signs)
- Tests cumules < 2000 PASS

**Actions fallback** :
1. **Reduction scope Demo Day a 50% sprints** :
   - Cible : Sprint 1-13 complets + Sprint 14-15 partiels
   - Mockup interactif Figma pour Sprint 16-22 + nouveaux sprints
2. **Delegation mockup a freelance** : ~15-20k MAD pour 2 semaines mockup Figma interactif
3. **Redaction slides pitch focus architecture + vision** : reduire poids "code live"
4. **Communication carrier prospects** : "scope Demo Day reduit a noyau dur, scope complet Avril 2027"

**Decision finale fallback** : prise par Saad seul au 15 juin selon etat reel programme.

## Strategie de mitigation pendant developpement

- Sprint 7.5a livre rapidement (1-2 jours max) pour debloquer Sprint 7 reprise
- Sprint 7 reprise tache 2.3.2 a 2.3.12 en mode focus (10-14h/jour soutenable)
- Sprint 8-13 en cadence acceleree (40-50h/sprint vs 70-80h v2.2)
- Tests automatises CI/CD continus pour eviter regression
- Commits frequents Conventional Commits (preserve historique)
- Documentation legere pendant sprint, completee post-sprint
- Pas de Sprint 22.5/22.7/26.5 avant Demo Day (acceptable pour mockup)
- Pause Sprint 14+ si signal burnout (priorite sante > Demo Day)

## Strategie pilote Marrakech (post-Demo Day)

Le Pilote Marrakech complet (Sprint 35) reste cible **Mars-Avril 2027** :
- Sprints 19-35 livres apres Demo Day
- Carriers signataires Demo Day = pilote co-developpe
- Garage Saad = premier pilote terrain (avec PartsHub Phase 1)
- Brokers Marrakech = adoption progressive
- ACAPS validation finale Programme Emergence

## Risques documentes

| Risque | Probabilite | Mitigation |
|--------|-------------|------------|
| Burnout Saad | Eleve (40%) | Pause si signe + delegation freelance frontend |
| Bugs regression Sprint 1-7 | Moyen (30%) | Tests CI/CD continus + commits frequents |
| Qualite code degradee | Moyen (40%) | Code review post-sprint + refacto Phase 7 |
| Echec signature lettres intent | Moyen (50%) | Pitch credibility via architecture solide |
| Pas de financement carriers | Moyen (40%) | Fallback levee VC plus tard |
| Audience Demo Day faible | Moyen (30%) | Invitations multiples + relance |
| ACAPS Programme Emergence retarde | Faible (15%) | Dossier independant Demo Day |

## Avantages

1. **Pression motivation** : Demo Day fixe = motivation Saad pour livrer rapidement
2. **Lettres d'intent avant levee VC** : preserve equity + valuation
3. **Validation marche concrete** : signature carrier = preuve traction
4. **Financement amorcage** : carriers payent pour co-developpement (vs VC)
5. **ACAPS visibility** : Programme Emergence renforce credibility
6. **Scope ambitieux** : si reussi, leadership marche InsurTech MA confirme
7. **Pilote Marrakech facilite** : carriers signataires deviennent pilote partners

## Inconvenients

1. **Risque burnout Saad** : 16h/jour pendant 38 jours = risque sante
2. **Risque qualite code** : precipitation = bugs + dette technique
3. **Probabilite scope complet < 5%** : 40 sprints en 38 jours mathematiquement impossible
4. **Risque echec Demo** : si bugs en live = perte credibility carriers
5. **Cout opportunite** : 600h focus Demo Day = pas focus pilote Marrakech
6. **Pression equipe** : Abla + futurs collaborateurs subissent rythme

Inconvenients juges acceptables par Saad qui assume le risque consciemment.

## Impact technique

- **Sprint 7.5a/b accelere** : 60h total compresse en 1-2 semaines
- **Sprints 8-13 acceleres** : 40-50h/sprint vs 70-80h v2.2 (qualite minimale acceptable)
- **Sprint 14-18 partiel** : focus sur fonctionnalites pitchables
- **Tests** : maintien 85% coverage minimum (vs 90% cible v3.0)
- **Documentation legere** : completee post-Demo Day
- **Mockups frontend** : delegate freelance si necessaire (15-20k MAD)

## Communication

Cette decision est communiquee :
- A l'equipe technique : sprint cadence acceleree + tests minimum 85%
- A Abla : Demo Day 30 juin = priorite absolue + risque accepte
- A futurs collaborateurs (freelance frontend) : mockups Figma a livrer J-15 si necessaire
- A carriers cibles : invitations Demo Day + agenda 15 min
- A ACAPS : Demo Day = jalon avancement Programme Emergence
- A investisseurs : Demo Day = preview vision Assurflow + roadmap pilote 2027

---

**Decision finale** : OK pour Demo Day 30 juin 2026 scope complet. Decision Saad assumee. Fallback plan declenche au 15 juin si derapage. Burnout signs = pause immediate prioritaire sur Demo Day.

**Note importante** : cette decision est prise par Saad en pleine conscience du risque (<5% probabilite scope complet livre). Si scope partiel = OK car mitige par mockup + architecture live + roadmap claire.

**References** :
- decision-011-assurflow-rebrand.md (naming Demo Day)
- decision-012-6-acteurs-ecosystem.md (6 acteurs a demontrer)
- decision-013-expert-acteur-central.md (workflow expert pitchable)
- decision-014-partshub-phase1.md (PartsHub pitchable mockup)
- assurflow-analyse-strategique-v2.docx (scenario Demo Day 5 acteurs)
- skalean-proposition-de-valeur.docx (pitch deck base)
- CHECKLIST-MASTER-EXECUTION.md (suivi quotidien)
- B-7.5a-sprint-7.5a-assurflow-foundation.md (sprint d'execution immediat)
