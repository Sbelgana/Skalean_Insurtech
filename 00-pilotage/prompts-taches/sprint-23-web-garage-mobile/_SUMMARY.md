# SPRINT 23 -- Web Garage Mobile PWA (Technicien) -- _SUMMARY.md

**Reference meta-prompt** : `00-pilotage/meta-prompts/B-23-sprint-23-web-garage-mobile.md`
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 23 / 35 cumul (Phase 5 / Sprint 5 dans phase)
**Effort total estime** : 68 heures developpement / 2 semaines
**Priorite** : P0 (PWA technicien critique pour productivite garage on-the-floor)
**Nombre de taches** : 12 (task-5.5.1 a task-5.5.12)
**AUCUNE EMOJI** (decision-006 strictement applique -- verifie)

---

## Objectif Global du Sprint

Construire **web-garage-mobile** (port 3003) -- PWA installable pour technicien garage : focus mobile-first sur les use cases atelier (prise photos sinistre + log hours rapide + accept work + quick status updates). Pattern PWA Sprint 18 reutilise (manifest + service worker + push + offline). Productivite atelier prioritaire : 1-2 taps pour les actions frequentes.

A la sortie de ce sprint :
- web-garage-mobile PWA installable (port 3003 dev / `garage-mobile.skalean-insurtech.ma` prod)
- Auth simplifiee : pin code 6 chiffres + biometric WebAuthn FIDO2
- 7 pages technicien-focused : Aujourd'hui + Detail order + Reception + Diagnostic + QC + Timer + (Notifications/Profil)
- Bottom nav 5 tabs + topbar compact + FAB context-sensitive
- Camera directe (multi-photos + burst diagnostic)
- Hours timer real-time + auto-pause + offline log + background sync
- Service worker 3 sync types (timer + photos + checklist) + resolution de conflits
- Push notifications technicien + voice-to-text fr/ar
- Tests Playwright 4 viewports + Lighthouse PWA 100 + WCAG

---

## Liste des taches (ordre d'execution)

| Tache | Titre | Effort | Densite (apres enrichissement) | Code | Tests | Criteres |
|-------|-------|--------|--------------------------------|------|-------|----------|
| 5.5.1 | App skeleton PWA + manifest + service worker | 5h | ~100 ko | 20 + 7 config | 30 | V1-V28 |
| 5.5.2 | Auth pin 6 chiffres + biometric WebAuthn FIDO2 | 6h | ~101 ko | 18 | 32 | V1-V28 |
| 5.5.3 | Layout mobile bottom nav 5 tabs + topbar + FAB | 4h | ~93 ko | 26 | 36 | V1-V40 |
| 5.5.4 | Page Aujourd'hui (agenda + orders + alerts + stats) | 5h | ~83 ko | 18 + contrats | 32 | V1-V42 |
| 5.5.5 | Detail order mobile (tasks + photos + hours + optimiste) | 7h | ~80 ko | 16 + contrats | 34 | V1-V40 |
| 5.5.6 | Reception mobile (camera + checklist 12pts + signature) | 7h | ~82 ko | 16 + contrats | 24 | V1-V40 |
| 5.5.7 | Diagnostic photos mobile (burst + IA + validation) | 5h | ~78 ko | 16 + contrats | 26 | V1-V46 |
| 5.5.8 | Hours timer (auto-pause + offline + background sync) | 6h | ~77 ko | 14 + contrats | 31 | V1-V46 |
| 5.5.9 | QC checklist mobile (10 pts swipe + signature) | 5h | ~70 ko | 14 + backend ref | 20 | V1-V46 |
| 5.5.10 | Service worker offline + 3 background sync + conflits | 6h | ~73 ko | 16 + contrats | 30 | V1-V42 |
| 5.5.11 | Push notifications + voice-to-text fr/ar | 4h | ~67 ko | 16 + contrats | 22 | V1-V46 |
| 5.5.12 | Tests Playwright 4 viewports + Lighthouse PWA 100 + WCAG | 8h | ~53 ko | 14 | 35 | V1-V44 |

Note densite : figures mesurees a partir des comptes de lignes (autoritatifs) x ~46,6 octets/ligne. Volume total sprint ~965 ko. Toutes les taches respectent la structure 17 sections, code complet, contrats backend, i18n 3 locales (fr/ar-MA/ar), tests concrets, criteres V1-V40+ et edge cases. Le contenu est genuine (zero bourrage, conforme aux anti-patterns du projet).

---

## Flux de dependances

```
5.5.1 (skeleton PWA + garage-shared)
  -> 5.5.2 (auth pin/biometric)
       -> 5.5.3 (chassis nav + FAB)
            -> 5.5.4 (Aujourd'hui)
            -> 5.5.5 (Detail order, contrat timer)
                 -> 5.5.6 (Reception, SignaturePadMobile)
                      -> 5.5.7 (Diagnostic IA)
                      -> 5.5.8 (Timer, branche 5.5.5)
                           -> 5.5.9 (QC, reuse SignaturePadMobile 5.5.6)
                                -> 5.5.10 (SW sync, centralise files 5.5.5/6/8/9)
                                     -> 5.5.11 (Push + voice, branche 5.5.7)
                                          -> 5.5.12 (Tests E2E + Lighthouse, valide tout)
```

---

## Patterns cles livres (fideles au B-23)

1. **Pattern WebAuthn FIDO2** (5.5.2) : challenge backend -> `navigator.credentials.create/get` (via `@simplewebauthn`) -> verify backend -> persist counter anti-clone. Table `auth_webauthn_credentials` (schema v2.2) mappee. `attestation: none` (privacy), `authenticatorAttachment: platform`.

2. **Pattern PWA offline-first** (5.5.1 + 5.5.8 + 5.5.10) : Serwist SW + cache strategies (CacheFirst static, NetworkFirst API GET) + classe `HoursTimer` basee sur timestamps (fiable en arriere-plan) + files IndexedDB + background sync (3 tags) + fallback iOS + resolution de conflits LWW.

3. **Pattern photo capture iOS/Android** (5.5.5 + 5.5.6 + 5.5.7) : `<input capture="environment">` (camera arriere) + `compressImage` (canvas, 1600px) + accumulation + preview + suppression + upload offline (file de sync). Mode burst pour le diagnostic IA.

---

## Conventions strictes respectees (toutes taches)

- Multi-tenant strict : `x-tenant-id` sur toutes les requetes via le client API `@insurtech/garage-shared`.
- Validation : Zod uniquement (types domaine, DTOs, reponses API). Jamais class-validator.
- Logger : aucun `console.log` ; erreurs via TanStack Query + toasts Sonner.
- Hash : argon2id (password Sprint 5), bcrypt cost 10 (pin, trade-off documente).
- Package manager : pnpm, `workspace:*`, versions exactes.
- TypeScript strict : `strict`, pas de `any` implicite.
- Tests : Vitest + Testing Library + Playwright. Coverage >= 85% global, >= 90% modules critiques.
- No-emoji (decision-006) : icones lucide-react + SVG inline, jamais d'emoji. Gate CI.
- Idempotency-Key : mutations sensibles (log-hours, mark-complete, photos, reception, QC, sync).
- Skalean AI frontier (decision-005) : IA via `@insurtech/sky` backend uniquement (5.5.7), jamais d'appel direct depuis le mobile. Mock decision-007.
- Cloud souverain MA (decision-008) : cache/photos/donnees dans le perimetre Atlas Benguerir ; audio voice-to-text jamais transmis (CNDP loi 09-08).
- Conformite : loi 09-08 (CNDP, biometrie + documents), decision-009 (signatures manuscrites numerisees vs qualifiees), audit ACAPS (Regle T2).

---

## Statut densite (transparence, apres enrichissement)

Cible projet : 80-150 ko par task (ideal 120 ko), plancher ECHEC < 80 ko. Etat final mesure :

- Conformes cible (>= 100 ko) : 5.5.1 (~100), 5.5.2 (~101) -- 2/12.
- Au-dessus du plancher 80 ko : 5.5.3 (~93), 5.5.4 (~83), 5.5.5 (~80), 5.5.6 (~82) -- 4/12.
- A ~floor (77-78 ko, dans la marge de mesure de 80) : 5.5.7, 5.5.8 -- 2/12.
- Sous plancher (enrichies mais scope compact) : 5.5.10 (~73), 5.5.9 (~70), 5.5.11 (~67), 5.5.12 (~53) -- 4/12.

Progression : toutes les taches ont ete enrichies de leur taille initiale (43-72 ko) vers leur taille actuelle (53-101 ko), avec du contenu genuine uniquement (contrats backend, i18n 3 locales, tests supplementaires, criteres V29-V46, edge cases 8-16, sections perf/a11y/machine a etats). Volume sprint total : ~640 ko -> ~965 ko.

Les 4 taches restant sous le plancher (5.5.9 QC, 5.5.10 SW sync, 5.5.11 push/voice, 5.5.12 tests) ont un scope intrinsequement compact (peu de surface frontend). Les amener a 80+ ko genuine necessiterait d'inclure l'implementation backend complete (QcService, PushService, etc.) qui releve d'autres sprints (19/21) -- ce qui depasserait la frontiere de ces taches frontend. Conformement a la regle anti-bourrage du projet, ce contenu n'a pas ete ajoute. La reference backend (controller/service) y figure deja en specification.

---

## STATUT : OK partiel -- 8/12 a/au-dessus du plancher (dont 6 nets), 4 enrichies sous plancher (scope compact)

Structure (17 sections), conventions strictes, patterns B-23 (WebAuthn FIDO2 / PWA offline-first / photo capture iOS-Android), frontiere IA (decision-005), conformite MA (CNDP/ACAPS) : tous conformes sur les 12 taches.

Prochain sprint a generer : Sprint 24 (Flux Sinistre Client end-to-end).
