# Decision 009 -- Signature Electronique Loi 43-20 (Barid eSign + ANRT)

**Date** : 2026-01
**Statut** : Acceptee (REGLEMENTAIRE)
**Decideurs** : Saad (CTO), Abla (CEO), Conseil legal
**ADR mirror** : `repo/docs/architecture/ADR-009-signature-loi-43-20.md`

---

## Contexte

Skalean InsurTech genere documents signes electroniquement :
- **Polices assurance** (Sprint 14 + 15)
- **Devis** (Sprint 14)
- **Avenants** (Sprint 15)
- **Quittances paiement** (Sprint 11)
- **Documents provisoires** (Sprint 17 KYC)
- **Releases sinistre** (Sprint 21)

Loi MA 43-20 (Code des Assurances + Code Civil 2009) : signature electronique fiable = **tiers de confiance certifie marocain + horodatage qualifie + archivage 10 ans**.

## Probleme adresse

- Conformite legale signatures electroniques MA
- Validity opposability tribunal MA
- Hash + horodatage qualifie ANRT
- Archivage long terme 10 ans (loi commerciale + fiscale)
- Tiers de confiance certifie ACAPS-approved

## Decision

**Barid eSign (Poste Maroc) + ANRT TSA RFC 3161 + archivage 10 ans Atlas Cloud Services Object Storage Benguerir**.

**Avantage strategique Atlas Cloud Services pour signature** : **Barid Maroc (provider Barid eSign) est deja client Atlas Cloud Services**. Co-localisation = latency reduite (sous-seconde) + simplification audits ANRT + chain of trust homogene.

Architecture :
- **Tiers de confiance** : Barid eSign (filiale Poste Maroc) -- certifie ANRT + ACAPS
- **Hash algorithme** : SHA-512 (vs SHA-256 minimum legal)
- **Timestamp authority** : ANRT TSA via RFC 3161 (Authority Marocaine Reglementation Telecoms)
- **Archivage** : Atlas Cloud Services Object Storage Benguerir + immutable bucket (object lock) + 10 ans retention + DC1/DC2 redondance Tier III/IV
- **Verification publique** : QR code on document + endpoint `/verify-doc/:hash` (Sprint 10)

Workflow signature :
1. Document genere (PDF) + hash SHA-512
2. Hash signed via Barid eSign API + horodatage ANRT
3. Bundle (PDF + signature + timestamp + certificate) archive S3
4. QR code link verification publique embedded
5. Audit log : `docs_signatures` table (Sprint 10)

## Avantages

1. **Conformite legale 100%** loi 43-20
2. **Opposability tribunal** : signature reconnue par juges
3. **Archivage 10 ans** : conformite fiscale + commerciale
4. **Verification publique** : QR + endpoint = transparence customers
5. **Tiers certifie ACAPS** : credible compagnies assurance

## Inconvenients

1. **Cost per signature** : Barid eSign tarif fixe per signature (~1-3 MAD)
2. **Latency signature** : ~5s per signature (acceptable)
3. **Lock-in Barid eSign** : alternative DocuSign hors MA non-conforme

## Enforcement technique

1. **Sprint 10** : integration Barid eSign API + ANRT TSA RFC 3161
2. **Sprint 14, 15, 17, 21** : signature obligatoire documents legaux
3. **Tests** : 50+ scenarios signature + verification + archivage
4. **Audit ACAPS** : tracage complet signatures dans `docs_signatures`

## Cas exceptions

- Documents internes (memos staff) : pas signature requise
- Brouillons + drafts : signature optionnelle
- Communications WhatsApp : pas signature legale (just acknowledgement)

## Impact technique

- **Sprint 10** (B-10) : implementation Barid eSign + ANRT TSA
- **Sprint 14, 15, 17, 21** : integration signature workflow
- **Sprint 28** : reports compliance signatures pour ACAPS

## Communication

Equipe : pattern signature standardise via Pattern 5 (`4-templates-generation.md`).
Compagnies assurance partenaires : conformite 43-20 = atout commercial.
Investisseurs : conformite legal complete.

## References

- Loi 43-20 + Code Civil 2009 : signature electronique
- Barid eSign : https://barid.ma/eSign
- ANRT TSA : https://anrt.ma/tsa
- Sprint 10 (B-10), 14 (B-14), 15 (B-15) : implementation
- ADR-009 : detail technique signature workflow
