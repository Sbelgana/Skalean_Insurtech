# Decision 008 -- Data Residency Maroc Strict (CNDP loi 09-08) + Atlas Cloud Services

**Date** : 2025-12 (revisee 2026-05-05 -- choix provider Atlas Cloud Services)
**Statut** : Acceptee (REGLEMENTAIRE -- non-negociable)
**Decideurs** : Saad (CTO), Abla (CEO), Conseil legal
**ADR mirror** : `repo/docs/architecture/ADR-008-data-residency-maroc.md`

---

## Contexte

Skalean InsurTech traite **donnees personnelles assures + courtiers + employes** :
- CIN (Carte Identite Nationale)
- Adresses + coordinates
- Polices assurance + sinistres
- Photos vehicules + documents
- Donnees medicales (assurance sante)
- Donnees financieres (paiements + RIB)

Loi MA 09-08 (CNDP) : **donnees personnelles MA = stockage Maroc obligatoire** sauf transferts vers pays adequats avec autorisation CNDP.

## Probleme adresse

- Conformite reglementaire CNDP loi 09-08 (obligation absolute)
- Risque amendes CNDP (jusqu'a 1M MAD + responsabilite penale)
- Confiance courtiers + assures + assureurs partenaires
- Audits ACAPS Programme Emergence + DGI fiscal
- Notification breach 72h CNDP
- **Coherence ecosystem** : choisir un provider deja utilise par les regulators MA (ACAPS) facilite audits

## Decision

**Data residency Maroc strict pour TOUTES donnees personnelles + transactionnelles, hostees chez Atlas Cloud Services (cloud souverain marocain)**.

**Provider retenu** : **Atlas Cloud Services** (https://atlascloudservices.com/) -- cloud souverain marocain.

Architecture :
- **Production DB PostgreSQL** : Atlas Cloud Services -- Database RDBMS managed Benguerir
- **Production Storage S3** : Atlas Cloud Services Object Storage Benguerir
- **Production Compute** : Atlas Cloud Services VM + Containers (Atlasx.Cloud portal)
- **Development MinIO** : local dev environments (data fictives only)
- **CDN + WAF** : Cloudflare edge (assets publics seulement -- pas PII)
- **Logs structures** : Atlas Cloud Services + retention 1 an
- **Backups** : Atlas Cloud Services region MA (DC1 + DC2 redondance)
- **APM Datadog/Grafana** : EU region acceptable POUR metriques agreges (pas PII)

**Datacenters Atlas Cloud Services** :
- **DC1 Benguerir** : Tier III certifie Uptime Institute (production primary)
- **DC2 Benguerir** : Tier IV certifie Uptime Institute (DR + critical workloads)
- Redondance cross-DC pour HA + DR strategy Sprint 34

**Certifications Atlas Cloud Services** (couvertes par leur conformite globale) :
- ISO 9001:2015 (qualite)
- ISO 14001:2015 (environnement)
- **ISO/IEC 27001:2022** (securite information -- critical pour ACAPS)
- ISO/IEC 27017:2015 (securite cloud)
- ISO/IEC 27018:2019 (protection PII cloud)
- ISO 22301:2019 (continuite activite)
- SOC1 Type 1 + SOC2 Type 2 (controle interne)
- HIPAA (protection donnees sante -- relevant pour assurance sante)
- **PCI DSS** (paiements -- critical pour Sprint 11 Pay multi-passerelles)

Exclusions :
- **Skalean AI Frontier** : infrastructure Maroc (decision-005)
- **Connecteurs assureurs** (Sprint 32) : data flows Wafa/Atlanta/Saham/RMA/AXA tous MA-based

Cas particuliers :
- Email transactionnel (Sprint 9) : provider MA OR EU avec DPA + autorisation CNDP
- WhatsApp Business API : Meta hosting USA -- mitigation chiffrement E2EE + autorisation CNDP

## Pourquoi Atlas Cloud Services (vs alternatives)

**Alternatives evaluees** : OVHcloud Casablanca / N+ONE / Inwi Business / AWS region MA (n'existe pas).

**Atlas Cloud Services retenu pour 5 raisons strategiques** :

1. **Souverainete digitale MA** : "cloud souverain marocain" -- alignement positionnement Skalean InsurTech (premiere InsurTech MA)
2. **Coherence ecosystem regulators MA** : 
   - **ACAPS deja client Atlas Cloud Services** -> dossier Programme Emergence + audits facilites
   - **Barid Maroc deja client Atlas Cloud Services** -> partenaire Barid eSign (decision-009 signature) co-located avec nos archives signatures = latency reduite + simplification audits ANRT
   - **Bank Al-Maghrib (BKAM) deja client Atlas Cloud Services** -> conformite BAM Sprint 11 facilitee
3. **Certifications enterprise complete** : ISO 27001 + SOC2 + PCI DSS + HIPAA = couvre tous nos requirements (CNDP + ACAPS + DGI + AMC)
4. **Tier III + Tier IV Uptime Institute** : 99.99% disponibilite garantie (vs 99.9% Tier III seul)
5. **Ecosystem complete** : Atlasx.Cloud (portail unifie hybrid multi-cloud) + Atlasx.Hub (modernization apps) + Atlasx.AI (data fabric) -- couvre evolutions futures Phase 8+

## Enforcement technique

1. **Production deployment** : Terraform + scripts verifient region Atlas Cloud Services (Benguerir DC1/DC2 only)
2. **Database connection** : verification DNS resolve to Atlas Cloud Services MA IP block
3. **Encryption at rest** : AES-256-GCM via Atlas Cloud Services Key Management (KMS natif)
4. **Encryption in transit** : TLS 1.3 obligatoire
5. **CNDP audit logs** : table `compliance_data_residency` track tous accesses + transfers
6. **Notification breach** : automatic alert CNDP < 72h via Atlas Cloud Services SOC integration

## Avantages

1. **Conformite reglementaire 100%** loi 09-08
2. **Confiance customers + partenaires** : data Maroc visible + provider connu regulators
3. **Audit ACAPS facilite** : ACAPS deja Atlas client -- meme infra reduit friction audits
4. **Reduction risque amendes** : CNDP fines avoides
5. **Latency reduite Barid eSign** : co-localisation Atlas DC1/DC2 = signatures sous-seconde
6. **Tier IV DR** : 99.99% disponibilite pilote Marrakech Sprint 35
7. **Souverainete narrative** : argument vente B2B + investisseurs (premiere InsurTech 100% souveraine MA)

## Inconvenients

1. **Latency** : Benguerir > AWS Frankfurt pour internationaux (mitige : cache Redis + Cloudflare CDN edge -- 95% trafic MA donc impact limite)
2. **Choix limites providers** : less options vs USA/EU (mitige : Atlas couvre tous nos besoins via Atlasx.Cloud catalog)
3. **Cout** : Atlas Cloud Services prix similaire AWS region (pas d'economie significative)
4. **Migration complexite si change provider futur** : lock-in moderat (mitige : Terraform + apps cloud-agnostic via Atlas standard APIs)

## Impact technique

- **Sprint 1** : Docker dev local (Atlas region not required dev)
- **Sprint 6** : multi-tenant + procedure purge CNDP
- **Sprint 10** : signature electronique Barid (Maroc) + co-localisation Atlas
- **Sprint 12** : compliance audit logs CNDP
- **Sprint 34** : Cloudflare CDN + WAF in front Atlas Cloud Services origin
- **Sprint 35** : production deployment Atlas Cloud Services Benguerir DC1 + DC2 DR

## Communication

Equipe : non-negociable + audit annuel CNDP. Atlas Cloud Services partenaire strategique long-terme.
Customers : DPA contrats incluent residency clause + Atlas Cloud Services certification listing.
Investisseurs : compliance Morocco-first selling point + souverainete digitale = atout differentiant marche MA.
ACAPS : dossier Programme Emergence mentionne hosting Atlas Cloud Services (meme infra ACAPS) = facilite validation.

## References

- Loi 09-08 CNDP : https://www.cndp.ma/loi-09-08
- Atlas Cloud Services : https://atlascloudservices.com/
- Atlas Cloud Services Tier IV DC2 Benguerir : https://uptimeinstitute.com/uptime-institute-awards/datacenter/benguerir-data-center-dc2/1122
- Atlas Cloud Services Tier III DC1 Benguerir : https://uptimeinstitute.com/uptime-institute-awards/datacenter/benguerir-data-center-dc1/1847
- Atlas Cloud Services certifications : https://atlascloudservices.com/engagement-en-conformite/
- Sprint 6 (B-06) : procedure purge CNDP
- Sprint 12 (B-12) : compliance audit logs
- Sprint 35 (B-35) : production deployment Atlas Cloud Services
- ADR-008 : detail enforcement technique
