# Decision 006 -- No-Emoji Policy Absolute

**Date** : 2025-12
**Statut** : Acceptee (ABSOLUE -- non-negociable)
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-006-no-emoji-policy.md`

---

## Contexte

Plateforme professionnelle B2B vendue a courtiers + garages + assureurs MA. Image de marque + confidence enterprise critique.

Audience cible :
- ACAPS regulator + DGI fiscal
- Cabinets courtiers etablis (decennies experience)
- Compagnies assurance (Wafa, Atlanta, Saham, RMA, AXA)
- Investisseurs institutionnels

## Probleme adresse

Emojis nuisent credibilite enterprise :
- Documents legaux + reports compliance ne tolerent pas emojis
- Communication B2B serieuse (vs B2C casual)
- Internationalisation : emojis varient cultures + interpretation
- Compatibilite legacy : certains systemes garage age + ACAPS reports
- Code maintenability : grep + diff Git pollued par emojis

## Decision

**Aucun emoji autorise dans aucun output Skalean InsurTech**.

Scope :
- Code source (commentaires + strings)
- Documentation (markdown + YAML + SQL)
- API responses (text fields + error messages)
- UI translations (4 locales fr/ar-MA/ar/en)
- Logs structured (Pino logger)
- Email templates (Sprint 9 Comm)
- WhatsApp templates (Sprint 9)
- PDF documents (Sprint 10)
- Reports compliance (Sprint 12 + 28)
- Notifications push (Sprint 18 + 23)

## Enforcement technique

1. **Pre-commit hook** : `check-no-emoji.sh` regex unicode `[\u{1F000}-\u{1FFFF}]` reject commit
2. **CI verification** : GitHub Actions step `lint:no-emoji` block PR si emoji detecte
3. **Code review** : reviewers verifie absence emoji
4. **Database constraint** : trigger validation INSERT/UPDATE rejette emojis dans text fields critiques (compliance fields specifically)

## Avantages

1. **Image enterprise serieuse** : credibilite ACAPS + compagnies + investisseurs
2. **Compatibilite legacy** : aucun risque rendering issue
3. **Lisibilite code** : pas de pollution diff Git
4. **Internationalization safe** : pas d'interpretation culturelle variable

## Inconvenients

1. **UX moderne** : certains designs UI utilisent emojis (mitige : icones SVG + Lucide React)
2. **Onboarding equipe** : developpeurs habitues emojis communication informelle
3. **Communication interne** : Slack + Github comments OK emojis (juste production output exempte)

## Distinction

- **Emojis interdits** : output production (code source live + UI live + emails sent + reports legaux)
- **Emojis OK** : Slack interne, GitHub PR comments, brainstorming docs, chats developpeurs

## Impact technique

- **Sprint 1** : pre-commit hook + CI step + .gitignore handling
- Tous sprints : code + docs + UI + emails sans emoji
- Tests : check-no-emoji integrated CI green required

## Communication

Equipe : ABSOLU non-negociable. Repete dans `8-skalean-insurtech-prompt-master.md` Section 10.
Onboarding : explication rationale enterprise B2B.

## References

- Sprint 1 : implementation pre-commit hook
- ADR-006 : detail enforcement technique
- `8-skalean-insurtech-prompt-master.md` : repete dans toutes regles generation
