# Decision 015 -- Demo Day fixe au 30 juin 2026, scope complet v3.0

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-015-demo-day-30-juin-2026.md`

---

## Contexte

Le pilote Marrakech d'Assurflow doit etre demontre de bout en bout devant les parties prenantes (investisseurs, partenaires courtiers, garages, et representants compagnies). Cette demonstration, le Demo Day, conditionne la suite du financement et l'engagement des partenaires du pilote. La question etait : fixer une date dure ou laisser la date flotter selon l'avancement ?

Une demonstration en deux temps (d'abord v2.2 a 3 acteurs, puis v3.0 a 6 acteurs) a ete envisagee mais ecartee : elle diluerait le message et ne montrerait pas la valeur differenciante d'Assurflow, qui est precisement l'orchestration de l'ecosysteme complet a 6 acteurs.

## Probleme adresse

- Fixer un engagement de date clair pour aligner tous les sprints.
- Garantir que le scope demontre est l'ecosysteme v3.0 complet (6 acteurs), pas un sous-ensemble.
- Donner aux sprints 7.5a, 7.5b et 7 (reprise) une contrainte de sequencement dure.
- Eviter le glissement de date au profit d'un ajustement de perimetre maitrise.

## Decision

**Le Demo Day est fixe au 30 juin 2026, avec un scope complet v3.0.**

- **Date** : 30 juin 2026. Date dure, non reportable.
- **Scope** : l'ecosysteme v3.0 complet a 6 acteurs (broker, garage, customer, carrier, expert, tow), demontre de bout en bout, incluant le workflow sinistre avec designation d'expert (decision-013) et le module pieces PartsHub (decision-014), sous la marque Assurflow (decision-011).
- **Contexte** : pilote Marrakech.

Regle de sequencement : la date du 30 juin 2026 prime. Tout retard d'un sprint doit etre absorbe par reduction de perimetre (livrer un sous-ensemble fonctionnel mais demontrable), jamais par report de la date. Le scenario de demonstration de bout en bout (ouverture sinistre, designation expert, validation devis, commande pieces) doit etre operationnel a cette date.

### Scenario de demonstration cible

Un scenario unique, demonstrable de bout en bout, sert de fil rouge :

1. Un assure (Customer L3) declare un sinistre via l'app web ou WhatsApp.
2. Le courtier (Broker) recupere le dossier et assigne un garage (cross-tenant type 1 broker_to_garage_assignment).
3. Le remorqueur (Tow) intervient pour livrer le vehicule au garage (cross-tenant types 4 client_to_tower_dispatch + 5 tower_to_garage_delivery).
4. Le garage etablit un devis et active le module PartsHub pour commander des pieces (role garage_parts_manager).
5. La compagnie d'assurance (Carrier) designe un expert agree ACAPS sur le sinistre.
6. L'expert accede au devis du garage (cross-tenant type 6 garage_to_expert_request) et le valide, modifie ou rejette.
7. Le garage envoie le devis valide a la compagnie en copie (cross-tenant type 7 garage_to_carrier_quote).
8. L'indemnisation est calculee et tracee dans le systeme.

Ce scenario fait intervenir les 6 acteurs, les 7 types cross-tenant, et la majorite des nouveaux modules de permissions. Il est l'element non-negociable du Demo Day.

## Avantages

1. Engagement de date clair qui aligne tous les sprints 7.5a et suivants.
2. Message non dilue : l'ecosysteme complet a 6 acteurs est demontre d'un coup.
3. Contrainte de sequencement dure qui force la priorisation.
4. Valeur differenciante (orchestration multi-acteurs) mise en avant face a Courtizen.

## Inconvenients

1. Pression de calendrier forte sur les sprints 7.5a, 7.5b et la reprise du Sprint 7 : mitige par la regle de reduction de perimetre plutot que report de date.
2. Risque de scope trop ambitieux : mitige par un scenario de demonstration cible et priorise (le workflow sinistre de bout en bout est l'element non-negociable).

## Impact technique

- **Sprint 7.5a (foundation)** : doit etre complete avant la reprise Sprint 7 task 2.3.2.
- **Sprint 7 (reprise)** : PermissionsMatrix construite sur 130 perms (architecture v3.0).
- **Sprint 7.5b (specifications)** : refactor documentaire massif + sprints aval.
- **Sprints aval (8-25)** : sequences pour livrer le scenario de demonstration au 30 juin 2026.

## Communication

Equipe : le 30 juin 2026 est une date dure ; en cas de retard, on reduit le perimetre, on ne reporte pas la date.
Investisseurs et partenaires : le Demo Day du 30 juin 2026 presente l'ecosysteme Assurflow complet a 6 acteurs sur le pilote Marrakech.

## References

- decision-011-assurflow-rebrand.md : la marque presentee au Demo Day.
- decision-012-ecosysteme-6-acteurs.md : l'ecosysteme demontre.
- decision-013-expert-acteur-central.md : le workflow expert au coeur de la demo.
- decision-014-partshub-module-garage.md : le module PartsHub presente comme levier de revenu.
- B-7.5a-sprint-7.5a-assurflow-foundation.md (meta-prompt Sprint 7.5a Assurflow Foundation).
- ADR-015 : detail du sequencement et du scope demonstrable.
