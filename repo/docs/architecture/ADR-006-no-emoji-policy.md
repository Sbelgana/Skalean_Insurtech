# ADR-006 : No-emoji Policy ABSOLU

**Date** : 2026-01-15
**Statut** : Acceptee (ABSOLU non-negociable)
**Decideurs** : Saad Belgana (CTO), Abla Ait Kassi (CEO)
**Mirror** : `00-pilotage/decisions/006-no-emoji-policy.md`

## Contexte

Plateforme professionnelle B2B vendue a courtiers + garages + assureurs MA. Image de marque + confidence enterprise critique.

Audience cible :
- ACAPS regulateur + DGI fiscal
- Cabinets courtiers etablis
- Compagnies assurance (Wafa, Atlanta, Saham, RMA, AXA)
- Investisseurs institutionnels

## Probleme adresse

Emojis nuisent credibilite enterprise :
- Documents legaux + reports compliance ne tolerent pas emojis
- Communication B2B serieuse (vs B2C casual)
- Internationalisation : emojis varient selon cultures + interpretation
- Compatibilite legacy : certains systemes garage + ACAPS reports
- Code maintenability : grep + diff Git pollues par emojis

## Decision

**Aucun emoji autorise dans aucun output Skalean InsurTech**.

Scope :
- Code source (commentaires + strings)
- Documentation (markdown + YAML + SQL)
- API responses (text fields + error messages)
- UI translations (4 locales fr/ar-MA/ar/en)
- Logs structures (Pino logger)
- Email templates (Sprint 9)
- WhatsApp templates (Sprint 9)
- PDF documents (Sprint 10)
- Reports compliance (Sprint 12 + 28)
- Notifications push (Sprint 18 + 23)

## Enforcement

1. **Pre-commit hook** : `check-no-emoji.sh` regex Unicode rejette commits
2. **CI verification** : GitHub Actions step bloque PR si emoji
3. **Code review** : reviewers verifient
4. **Database constraint** : trigger validation INSERT/UPDATE rejette emojis (Sprint 12)

## Consequences

### Positives (+)
- Image enterprise serieuse
- Compatibilite legacy systems
- Lisibilite code (pas pollution diff Git)
- Internationalisation safe

### Negatives (-)
- Friction initiale pour devs habitues emojis dans commits
- Documentation moins "vivante" visuellement
- Mitigation : conventions Conventional Commits compensent

## References

- decision-006 (mirror)
- Sprint 1 (B-01) Tache 1.1.14 : check-no-emoji.sh + hooks
- Sprint 33 (B-33) : audit usage --no-verify
