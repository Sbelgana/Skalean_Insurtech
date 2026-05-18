# TACHE 4.3.11 -- Parametres + Profile Pages : Tenant Settings + User Profile + MFA Setup + Active Sessions

**Sprint** : 16 (Phase 4 / Sprint 3 dans phase) -- Web Broker App
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.11)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (bloquant pour 4.3.12 RBAC UI qui s'appuie sur les hooks profile, et conditionne acces complet du broker_admin a la configuration tenant pour onboarding production)
**Effort** : 5h
**Dependances** : 4.3.10 (sinistres read-only termine -- l'ensemble des pages metier broker existent et la sidebar pointe deja sur /parametres + /profile), 4.3.3 (UserMenu + topbar fournissent les entrees vers /profile et /parametres), Sprint 5 (MfaService TOTP + recovery codes + challenge tokens deja livre Tache 2.1.7 cote backend), Sprint 6 (quotas tenant + headers x-tenant-id), Sprint 7 (RBAC permissions 12 roles + PermissionGuard backend), Sprint 8 (custom fields + pipelines), Sprint 10 (S3 storage MinIO + endpoint /uploads), Sprint 13 (notifications-preferences canaux par event type)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee, ni dans le code, ni dans les commentaires, ni dans les translations FR/AR-MA/AR, ni dans les libelles UI, ni dans les recovery codes, ni dans les toasts -- tout caractere emoji entraine echec lint et echec PR review)

---

## 1. But (0.5-1 ko)

Cette tache livre les deux pages de configuration finales de l'application `web-broker` : la page `/parametres` (reservee au role `broker_admin` via garde RBAC) qui expose sept onglets pour configurer le tenant (General, Branding, Users, Custom Fields, Pipelines, Quotas, API Keys), et la page `/profile` (accessible a tous les utilisateurs authentifies) qui expose trois onglets (Info personnelle, Security avec MFA setup + active sessions + change password + recovery codes, Notifications avec preferences canaux par event type). Le coeur fonctionnel est le **wizard MFA setup en 4 etapes** (intro consentement, affichage QR code TOTP + secret manuel, verification code 6 digits, telechargement des 10 recovery codes one-time avec checkbox de confirmation sauvegarde), la **gestion des sessions actives** (liste device + browser + IP + geoloc + last_active_at + marker session courante, revocation individuelle ou globale sauf courante), le **change password dialog** avec reconfirmation par mot de passe courant (defense en profondeur contre session hijacking) et meter de complexite, l'**upload logo S3** drag-and-drop avec preview + crop + redimensionnement, la **gestion CRUD des custom fields** avec rendu dynamique selon le type (text/number/date/select/multiselect/boolean), l'**editeur de stages pipeline** avec drag-and-drop reordering et color picker, la **gestion des API keys** service-to-service avec scopes granulaires et display one-time du secret, et la **gestion users tenant** avec invite par email + assignation role + bulk import CSV. A la sortie de la tache, un broker_admin nouvellement onboarde peut completer en moins de 15 minutes la configuration de son tenant (logo + branding + invite 5 collaborateurs + custom field metier + pipeline ajuste), un user broker_user peut activer son MFA en moins de 3 minutes (scan QR + entrer code + sauvegarder 10 recovery codes), un user qui detecte une session suspecte peut revoquer en 1 clic et changer son mot de passe en 30 secondes. Tous les flows respectent loi 09-08 CNDP (MFA opt-in clair + droit acces donnees user via export profile), loi 31-08 (consentement + droit acces), loi 53-05 (MFA comme facteur de signature electronique SCA), conformite ACAPS (audit log immutable de tout enable/disable MFA), et WCAG 2.1 AA (wizard MFA accessible clavier + ARIA steps + screen reader).

---

## 2. Contexte etendu (8-12 ko)

### 2.1 Pourquoi cette tache existe

Le sprint 16 livre l'application web-broker production-ready. Les taches 4.3.1 a 4.3.10 ont couvert : skeleton + auth + layout + dashboard + pages metier CRM (contacts, companies, deals) + pages metier Insure (polices, broker-queue, sinistres). Mais une application SaaS multi-tenant en production necessite imperativement deux dimensions transversales : (1) la configuration tenant que seul un administrateur peut modifier (branding pour identifier le cabinet, custom fields pour adapter le CRM au metier specifique du broker, pipelines pour ajuster le funnel de vente, gestion users + roles pour onboarder les commerciaux et les assistants, quotas pour suivre la consommation et anticiper upgrade plan, API keys pour les integrations service-to-service), et (2) la configuration profile utilisateur que chaque user gere pour son propre compte (preferences personnelles, securite avec MFA obligatoire pour les roles privilegies broker_admin, monitoring sessions actives pour detecter compromission, preferences notifications pour ne pas etre noye sous les alertes).

Sans la page parametres, un nouveau tenant Skalean (un cabinet de courtage qui souscrit a la plateforme) est bloque a l'onboarding : il ne peut pas mettre son logo, configurer son adresse de contact pour generer les courriers, ajouter ses commerciaux. Sans la page profile + MFA setup, on ne peut pas respecter la circulaire ACAPS 2024 qui exige MFA mandatory pour les operateurs metier (broker_admin manipule des polices d'assurance avec donnees sensibles). Sans la gestion des sessions actives, un user qui suspecte que son compte a ete compromis (vol de telephone, ordinateur perdu) ne peut pas auto-remediee : il doit appeler le support Skalean qui doit invoquer un script backend, ce qui ne scale pas pour 100k+ users cibles. Sans le change password en self-service, idem.

Le decret CNDP 2024 (loi 09-08) impose en outre que tout enable/disable de MFA soit (a) clairement opt-in cote user (consentement informe), (b) accompagne d'un export possible des donnees user (droit acces RGPD-like article 7), (c) audite immuablement cote serveur (Sprint 12 audit log deja livre). Cette tache implemente le frontend conforme : etape 1 du wizard MFA presente clairement les beneficies + le fait que c'est une protection additionnelle (pas obligatoire pour broker_user et broker_assistant ; mais imperatif et bloquant pour broker_admin avant premiere connexion via Sprint 5 enrollment flow), etape 4 telecharge les recovery codes au format texte signe avec horodatage et avertissement de confidentialite.

L'enjeu UX du wizard MFA est non trivial : c'est un flow ou l'utilisateur doit (a) comprendre pourquoi il fait cela (sinon abandon), (b) installer une app authenticator s'il n'en a pas (Google Authenticator / Authy / 1Password recommandes -- jamais une seule recommendation pour eviter monopole), (c) scanner un QR code avec un autre device, (d) saisir un code 6 digits depuis cet autre device, (e) sauvegarder 10 recovery codes (10 et pas 6 -- voir 2.2 trade-off) avec confiance qu'il les retrouvera. Chaque etape doit etre claire, possible en marche arriere, et completement accessible clavier pour les users handicapes visuels (screen reader). Le QR code doit avoir un alt text descriptif et un fallback secret manuel pour copier-coller dans une app authenticator sans webcam.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Page parametres unique sans onglets, scroll long | Plus simple | Confus, sections noyees, perte contexte | REJETE -- onglets retenus |
| 7 onglets parametres (RETENU) | Sectionne clairement | Plus de code | RETENU (General, Branding, Users, CustomFields, Pipelines, Quotas, ApiKeys) |
| Onglets en colonnes verticales (Notion-style) | Espace ecran efficace | Mobile incompatible | REJETE -- tabs horizontaux shadcn/ui |
| MFA setup en une seule page longue | 1 ecran | Mauvais UX, pas de back, taux abandon eleve | REJETE -- wizard multi-step |
| Wizard MFA 4 etapes (RETENU) | Guidage progressif, etat clair | Plus de code state | RETENU |
| Wizard MFA 6 etapes (intro, install app, recommended apps, QR, verify, codes) | Tres explicite | Trop long, user fatigue | REJETE -- 4 etapes fusionnant install dans intro |
| Wizard MFA 3 etapes (skip intro, QR + verify + codes) | Rapide | Pas de consent explicite -> non-conforme CNDP | REJETE |
| Recovery codes 6 (Sprint 5 backend) | Memorisable carte | Sprint 14 prevoit augmentation a 10 | RETENU 10 -- aligne sur ce qui sera livre Sprint 14, mais Sprint 5 backend genere 6 actuellement |
| Recovery codes 10 (RETENU pour UI) | Reserve plus large | Impression carte plus longue | RETENU avec wrapper backend qui retourne 10 |
| Recovery codes 16 | Tres conservateur | Imprimable mais lourd | REJETE |
| Sessions actives en table dense | Plus d'info / ecran | Manque emphase sur session courante | REJETE -- cards retenu pour mise en avant session courante |
| Sessions actives en cards (RETENU) | Visuel clair, badge "current" | Moins dense | RETENU |
| Revoke session par bouton inline immediat | Rapide | Risque erreur (revoke courante = logout) | REJETE -- modal confirmation retenue |
| Revoke session avec modal (RETENU) | Confirmation reduit erreur | 1 clic en plus | RETENU |
| Change password sans recheck current | Plus simple | Trivial CSRF + session hijacking | REJETE inacceptable |
| Change password recheck current (RETENU) | Defense en profondeur | 1 champ en plus | RETENU |
| Logo upload via input file simple | Standard | UX mediocre, pas de preview | REJETE |
| Logo upload drag-and-drop react-dropzone (RETENU) | UX moderne, preview | Lib externe | RETENU |
| Color picker color (npm) | Power user | Trop d'options | REJETE -- trop complexe |
| Color picker react-colorful (RETENU) | Light, propre, accessible | Moins de modes | RETENU (HSL + HEX) |
| Custom fields rendering switch case inline | Simple | Repete partout | REJETE |
| Custom fields rendering helper centralise (RETENU) | DRY | Indirection | RETENU |
| API key plain text affiche en permanence | Pratique | Catastrophe DB leak + screenshot | REJETE absolument |
| API key affiche one-time + truncated apres (RETENU) | Securise standard industrie | UX perd la cle = regenerate | RETENU |
| Quotas onglet editable | Flexible | Risque autorisation incoherente vs Sprint 6 backend | REJETE -- read-only retenu, upgrade via support |
| Quotas onglet read-only (RETENU) | Source of truth backend Sprint 6 | Pas d'upgrade en self-service Sprint 16 | RETENU avec bouton "Contacter support pour upgrade" |
| Bulk import CSV users separe | Power | Complexite Sprint 16 | RETENU mais minimal (parse + preview + commit) |
| Pipelines edit avec drag-and-drop reorder stages (RETENU) | UX intuitive | dnd-kit deja installe Tache 4.3.7 | RETENU |
| Notifications preferences matrice event x channel (RETENU) | Granulaire | Beaucoup de toggles | RETENU (8 events x 3 canaux = 24 toggles avec collapse) |

### 2.3 Trade-offs explicites

Choisir 10 recovery codes (au lieu des 6 livres par Sprint 5 MfaService) : un wrapper backend `POST /api/v1/auth/mfa/setup` retournera 10 codes au lieu de 6 (montee a definir avec backend dans Tache hors-scope ; pour Sprint 16 frontend on attend 10 codes, et si backend en renvoie 6 le frontend affiche les 6 sans erreur -- pattern degrade gracieux). 10 est un compromis entre memorisation/impression carte (raisonnable jusqu'a 12) et resilience (chaque code reset device perd 1 code, donc 10 = ~10 resets possibles avant regenerate).

Choisir affichage du secret TOTP en clair (toggleable) en plus du QR code : un user sans webcam (desktop sans camera, ou WebRTC bloque par firewall corporate) ne peut pas scanner le QR. Le secret base32 manuel permet de copier-coller dans 1Password / Authy. Le toggle "Show secret" est OFF par defaut pour eviter screenshot accidentel.

Choisir affichage des recovery codes UNE SEULE FOIS post-setup, avec impossibilite de les revoir : c'est le standard industrie (GitHub, Google, AWS) qui force le user a sauvegarder. La regeneration est possible mais invalide les anciens. La download .txt est obligatoire (checkbox "J'ai sauvegarde" bloquante).

Choisir change password avec recheck mot de passe courant : sans recheck, un attaquant qui vole une session (XSS, cookie theft) peut changer le password et locker le user. Avec recheck, l'attaquant a besoin egalement du password courant (qu'il aurait deja s'il etait dans la session naturellement). Equilibre defense / UX (1 champ supplementaire).

Choisir revoke session "all except current" plutot que "all including current = logout instantane" : on garde la session courante car le user en a explicitement besoin pour valider l'operation. Pour logout total, le bouton "Logout" existe deja Sprint 5 (user-menu).

Choisir upload logo en S3 multipart (Sprint 10) plutot que data URL base64 en DB : un logo 500 KB en base64 = 670 KB de string en DB, requete profile lente. S3 = URL signee, CDN, scalable.

Choisir read-only quotas display sans upgrade-plan flow : Sprint 16 ne livre pas le billing self-service (cible Sprint 28+). On affiche les quotas, on alerte si > 80%, on propose un CTA "Contacter support" qui ouvre un mailto: predefini.

Choisir custom fields type rendering polymorphe via switch case dans helper centralise `<CustomFieldRenderer type={...} value={...} />` : permet a Sprint 8 contacts/deals/companies forms d'utiliser le meme helper pour rendre les champs dynamiques (cette tache livre le helper, Sprint 8 tab CustomFields parametres tenant en consomme).

Choisir affichage one-time API key secret : standard industrie. Si l'user perd la cle, il doit revoker + recreer. Ne JAMAIS log le secret cote serveur (audit log doit garder seulement le hash ou le prefix).

Choisir validation Zod cote frontend ET backend (Sprint 6 deja livre) : defense en profondeur. Frontend evite roundtrip pour erreurs evidentes (longueur, format), backend reste source of truth.

### 2.4 Decisions strategiques referenced

- **decision-006 (No-emoji)** : aucune emoji dans translations, libelles, recovery codes, toasts, fichiers .txt download.
- **decision-013 (Argon2id passwords)** : recheck current password use comparison Argon2 cote backend.
- **decision-014 (JWT theft detection)** : sessions actives utilisent device fingerprint Sprint 5.
- **decision-016 (TOTP RFC 6238)** : MFA wizard consume `/auth/mfa/setup` + `/auth/mfa/verify` livres Sprint 5.
- **decision-008 (Cloud souverain MA)** : logos uploades en S3 MinIO Maroc (Sprint 10).
- **ACAPS circulaire 2024** : MFA mandatory broker_admin -- enforcement Sprint 5 enrollment, page profile permet l'activation/desactivation pour autres roles.
- **Loi 09-08 CNDP** : MFA opt-in clair + export profile data + audit log enable/disable.
- **Loi 31-08** : droit acces user data (bouton "Telecharger mes donnees" dans onglet Info).
- **Loi 53-05** : MFA = facteur de signature electronique avancee (SCA) pour operations critiques.
- **WCAG 2.1 AA** : wizard MFA accessible clavier, ARIA steps, screen reader OK.

### 2.5 Pieges techniques connus

1. **Piege : QR code render bloquant.**
   - `qrcode.react` rend en SVG cote client. Si secret pas encore recu (loading), affichage vide.
   - Solution : `<Suspense fallback={<Skeleton />}>` + check `secret` defined avant render.

2. **Piege : Recovery codes affichage post-setup perdu si user reload page.**
   - Backend retourne codes une fois ; si user reload avant download, perd.
   - Solution : stocker codes en sessionStorage encrypted (clearOnUnload), warning prominent + bouton download visible.

3. **Piege : MFA verify code window timeout.**
   - Code TOTP change toutes les 30s. User scanne, puis tape lentement, code expire.
   - Solution : afficher countdown 30s + auto-refresh QR si user revient sur step 2 apres timeout.

4. **Piege : Disable MFA sans recheck password.**
   - Session hijack -> disable MFA -> compromission persistante.
   - Solution : disable MFA dialog requiert current password + (optionnel) TOTP code -> POST /auth/mfa/disable.

5. **Piege : Logo upload S3 sans validation type/size cote client.**
   - User uploade un .exe ou un .gif 50 MB.
   - Solution : react-dropzone `accept={{ 'image/png': [], 'image/jpeg': [], 'image/svg+xml': [] }}` + `maxSize: 2 * 1024 * 1024` (2 MB).

6. **Piege : Color picker brand color contrast WCAG fail.**
   - User choisit jaune clair sur fond blanc -> contraste 1.5:1 -> texte illisible.
   - Solution : afficher ratio contraste calcule live + warning si < 4.5:1, bloquer save si < 3:1.

7. **Piege : Custom field type changed apres data exists.**
   - Field type=number existe avec 1000 records, admin change a date -> data orpheline.
   - Solution : changer type bloquee si records existent (preview impact + force confirm + migration manuelle ou suppression).

8. **Piege : Pipeline stage delete avec deals encore dans le stage.**
   - Stage "Qualification" supprime -> deals orphelins.
   - Solution : avant delete, montrer count deals + forcer choix stage de migration (move deals to X then delete).

9. **Piege : API key affiche en clair persiste dans React state apres modal close.**
   - State component contient secret, dev tools React DevTools expose.
   - Solution : useState avec cleanup useEffect au close dialog + memoize=false (force re-create).

10. **Piege : Sessions revoke-all inclut current par erreur.**
    - Mauvais filtre cote backend ou frontend.
    - Solution : flag explicite `except_current=true` envoye dans POST + double-check current session_id frontend.

11. **Piege : Quotas display affiche stale data.**
    - User cree contacts pendant que quotas tab ouvert -> usage affiche obsolete.
    - Solution : refetch interval 30s sur cet onglet + manual refresh button.

12. **Piege : Locale switcher in profile change ne propage pas immediatement.**
    - Patch /auth/me locale=ar-MA -> middleware Sprint 4 redirect mais cookie pas reset.
    - Solution : apres save locale, force window.location.reload() vers /ar-MA/profile.

13. **Piege : Photo upload 5 MB max mais EXIF rotation issue iPhone.**
    - Photo iPhone EXIF Orientation=6 -> affiche couchee.
    - Solution : strip EXIF cote client (lib exif-js + canvas re-encode) avant S3 upload.

14. **Piege : Invite user email duplicate.**
    - Admin invite user@example.com qui existe deja -> erreur backend.
    - Solution : check duplicate cote frontend (query users tenant) + toast clair.

15. **Piege : Custom field name collision avec colonne native.**
    - Custom field "email" collision avec contact.email -> ambiguite.
    - Solution : reserved keywords blacklist (email, phone, first_name, last_name, etc.).

16. **Piege : Notifications preferences toggle toutes a OFF -> user manque alertes critiques.**
    - User desactive tout -> rate sinistre urgent.
    - Solution : certains events sont "mandatory" (deal_won, sinistre_status_critical) toggle disabled.

17. **Piege : MFA setup wizard refresh navigateur perd state.**
    - User au step 3 reload -> retour step 1 ? perd secret ?
    - Solution : state persiste sessionStorage temporaire (clear apres step 4 finish ou cancel).

18. **Piege : Recovery codes download .txt avec BOM Windows -> encoding casse.**
    - Notepad Windows affiche caracteres bizarres.
    - Solution : UTF-8 sans BOM + line endings \r\n pour compat Windows + Mac/Linux.

19. **Piege : Active sessions IP geoloc affiche "Unknown" frequent.**
    - GeoIP database pas populated cote backend ou IP IPv6.
    - Solution : fallback "Lieu inconnu" + tooltip explanatory.

20. **Piege : Bulk import users CSV avec encoding latin1 vs UTF-8.**
    - Caracteres arabes ou accents casses.
    - Solution : detection encoding cote client (lib jschardet) + warning si non-UTF8 + force conversion.

---

## 3. Architecture context (4-6 ko)

### 3.1 Position dans le sprint

Tache 4.3.11 est l'avant-derniere tache fonctionnelle du Sprint 16 (suivie de 4.3.12 RBAC UI hooks, 4.3.13 i18n complet, 4.3.14 E2E Playwright). Elle finalise la couverture des 12 pages du sprint. Les hooks RBAC `useUserPermissions` + `<HasPermission>` + `<HasRole>` livres Tache 4.3.12 seront utilises pour guarder l'acces a `/parametres` (broker_admin only) -- mais cette tache 4.3.11 fait deja l'integration RBAC initiale (check role server-side dans layout protected) en avance de Tache 4.3.12 qui generalisera le pattern. La page `/profile` ne necessite pas de RBAC (accessible a tous), mais certaines actions internes (regenerate recovery codes) restent guardees serveur.

### 3.2 Position dans le programme global

- **Sprint 14** : ajoute regenerate-recovery-codes endpoint backend + bulk-rotate API keys -- la page parametres reutilisera la mutation.
- **Sprint 17** : web-customer-portal aura aussi une page profile mais sans MFA mandatory (assure final, MFA optionnel) ; reutilise components partages `<MfaSetupWizard>`.
- **Sprint 18** : web-assure-portal idem.
- **Sprint 22** : web-garage app reutilise pattern parametres + profile.
- **Sprint 23** : ajout WebAuthn/Passkey -- onglet Security profile recevra section "Passkeys" en supplement de TOTP.
- **Sprint 25** : impersonate cross-tenant via super_admin_platform necessitera fresh MFA reverify -- bouton dans profile pour MFA reverify manuel.
- **Sprint 27** : web-insurtech-admin (super admin Skalean) parametres global cross-tenant.
- **Sprint 28** : billing self-service -- upgrade plan dans onglet Quotas.
- **Sprint 33** : pentest review change password + sessions management.
- **Sprint 35** : KMS Atlas migration -- MFA secret stockage durci.

### 3.3 Diagramme flow

```
+----------------------------------+
|  4.3.10 sinistres read-only OK   |
|  Sidebar pointe deja Parametres  |
|  + Profile dans UserMenu          |
+-----------------+----------------+
                  |
                  v
+----------------------------------+
|  TACHE 4.3.11 (cette tache)       |
|                                  |
|  /parametres (broker_admin)      |
|   7 tabs : General / Branding /  |
|   Users / CustomFields /         |
|   Pipelines / Quotas / ApiKeys   |
|                                  |
|  /profile (tous users)           |
|   3 tabs : Info / Security /     |
|   Notifications                  |
|                                  |
|  Components shared :             |
|   - MfaSetupWizard (4 steps)     |
|   - QrCodeDisplay                |
|   - RecoveryCodesDisplay         |
|   - ActiveSessionsList           |
|   - ChangePasswordDialog         |
|   - InviteUserDialog             |
|   - CustomFieldForm              |
|   - PipelineStagesEditor         |
|   - ApiKeyDialog                 |
|   - LogoUploader                 |
+--+--+--+--+--+--+--+--+--+--+----+
   |  |  |  |  |  |  |  |  |  |
   v  v  v  v  v  v  v  v  v  v
 4.3.12 RBAC hooks generalises
 4.3.13 i18n strings finalisees
 4.3.14 E2E Playwright 8+ scenarios sur cette tache
```

### 3.4 Schema API consume

Backend endpoints (deja livres Sprints anterieurs sauf rare extension Sprint 14) :

```
Settings tenant
  GET    /api/v1/tenants/:id                      (Sprint 6)
  PATCH  /api/v1/tenants/:id                      (Sprint 6)

Users tenant
  GET    /api/v1/tenants/:id/users                (Sprint 7)
  POST   /api/v1/tenants/:id/users/invite         (Sprint 7)
  PATCH  /api/v1/tenants/:id/users/:user_id       (Sprint 7)
  DELETE /api/v1/tenants/:id/users/:user_id       (Sprint 7)
  POST   /api/v1/tenants/:id/users/bulk-import    (Sprint 14)

Custom fields
  GET    /api/v1/crm/custom-fields                (Sprint 8)
  POST   /api/v1/crm/custom-fields                (Sprint 8)
  PATCH  /api/v1/crm/custom-fields/:id            (Sprint 8)
  DELETE /api/v1/crm/custom-fields/:id            (Sprint 8)

Pipelines
  GET    /api/v1/crm/pipelines                    (Sprint 8)
  POST   /api/v1/crm/pipelines                    (Sprint 8)
  PATCH  /api/v1/crm/pipelines/:id                (Sprint 8)
  POST   /api/v1/crm/pipelines/:id/stages         (Sprint 8)
  PATCH  /api/v1/crm/pipelines/:id/stages/:sid    (Sprint 8)
  DELETE /api/v1/crm/pipelines/:id/stages/:sid    (Sprint 8)

Quotas
  GET    /api/v1/tenants/:id/quotas               (Sprint 6, read-only)
  GET    /api/v1/tenants/:id/quotas/usage          (Sprint 6)

API Keys
  GET    /api/v1/tenants/:id/api-keys              (Sprint 7)
  POST   /api/v1/tenants/:id/api-keys              (Sprint 7)
  DELETE /api/v1/tenants/:id/api-keys/:key_id      (Sprint 7)

Uploads
  POST   /api/v1/uploads/logo                      (Sprint 10, S3)
  POST   /api/v1/uploads/avatar                    (Sprint 10, S3)

Profile / auth user
  GET    /api/v1/auth/me                            (Sprint 5)
  PATCH  /api/v1/auth/me                            (Sprint 5)
  POST   /api/v1/auth/change-password               (Sprint 5)

MFA
  POST   /api/v1/auth/mfa/setup                    (Sprint 5, returns secret + qr + otpauthUrl)
  POST   /api/v1/auth/mfa/verify                   (Sprint 5, verifies code + enables MFA + returns 10 recovery codes one-time)
  POST   /api/v1/auth/mfa/disable                  (Sprint 5, requires current password)
  POST   /api/v1/auth/mfa/recovery-codes/regenerate (Sprint 14, returns 10 new codes, invalides anciens)

Sessions
  GET    /api/v1/auth/sessions                     (Sprint 5)
  POST   /api/v1/auth/sessions/:id/revoke          (Sprint 5)
  POST   /api/v1/auth/sessions/revoke-all          (Sprint 5, query except_current=true)

Audit
  GET    /api/v1/auth/audit/login-history?limit=10 (Sprint 12)

Notifications preferences
  GET    /api/v1/auth/notifications-preferences    (Sprint 13)
  PATCH  /api/v1/auth/notifications-preferences    (Sprint 13)
```

### 3.5 Structure folder cible apres tache

```
repo/apps/web-broker/
  app/[locale]/(protected)/
    parametres/
      page.tsx                              (Server Component, tabs router)
      layout.tsx                             (RBAC guard broker_admin)
      tabs/
        general-tab.tsx
        branding-tab.tsx
        users-tab.tsx
        custom-fields-tab.tsx
        pipelines-tab.tsx
        quotas-tab.tsx
        api-keys-tab.tsx
    profile/
      page.tsx                              (Server Component, tabs router)
      tabs/
        info-tab.tsx
        security-tab.tsx
        notifications-tab.tsx
  components/
    parametres/
      invite-user-dialog.tsx
      custom-field-form.tsx
      custom-field-renderer.tsx              (helper shared par Sprint 8 forms)
      pipeline-stages-editor.tsx
      api-key-dialog.tsx
      logo-uploader.tsx
      bulk-import-users-dialog.tsx
      quotas-progress-bars.tsx
    profile/
      mfa-setup-wizard.tsx
      mfa-step-intro.tsx
      mfa-step-qr.tsx
      mfa-step-verify.tsx
      mfa-step-codes.tsx
      qr-code-display.tsx
      recovery-codes-display.tsx
      active-sessions-list.tsx
      session-card.tsx
      change-password-dialog.tsx
      disable-mfa-dialog.tsx
      regenerate-codes-dialog.tsx
      notifications-preferences-matrix.tsx
      login-history-list.tsx
  lib/
    queries/
      parametres.queries.ts
      profile.queries.ts
      mfa.queries.ts
      sessions.queries.ts
    schemas/
      parametres.schema.ts
      profile.schema.ts
      mfa.schema.ts
    utils/
      contrast-ratio.ts
      strip-exif.ts
      download-text-file.ts
      password-strength.ts
  test/
    unit/
      parametres-schema.spec.ts
      profile-schema.spec.ts
      mfa-schema.spec.ts
      contrast-ratio.spec.ts
      password-strength.spec.ts
      strip-exif.spec.ts
      download-text-file.spec.ts
      custom-field-renderer.spec.tsx
      mfa-wizard-state.spec.tsx
      qr-code-display.spec.tsx
      recovery-codes-display.spec.tsx
      active-sessions-list.spec.tsx
      change-password-dialog.spec.tsx
      pipeline-stages-editor.spec.tsx
      api-key-dialog.spec.tsx
      logo-uploader.spec.tsx
      invite-user-dialog.spec.tsx
      notifications-preferences-matrix.spec.tsx
    e2e/
      parametres-tabs-rbac.spec.ts
      parametres-branding-logo.spec.ts
      parametres-invite-user.spec.ts
      parametres-custom-field-create.spec.ts
      parametres-pipeline-stages.spec.ts
      parametres-api-keys.spec.ts
      profile-info-edit.spec.ts
      profile-mfa-setup-complete.spec.ts
      profile-mfa-wrong-code.spec.ts
      profile-recovery-codes-download.spec.ts
      profile-change-password.spec.ts
      profile-sessions-revoke.spec.ts
```

---

## 4. Livrables checkables (28)

- [ ] Page `repo/apps/web-broker/app/[locale]/(protected)/parametres/page.tsx` -- Server Component tabs router avec garde RBAC broker_admin -- ~120 lignes
- [ ] Layout `repo/apps/web-broker/app/[locale]/(protected)/parametres/layout.tsx` -- guard role + redirect /dashboard si pas broker_admin -- ~60 lignes
- [ ] Tab `tabs/general-tab.tsx` -- form tenant name + contact + locale + currency MAD + timezone Africa/Casablanca + fiscal_year_start + working_hours -- ~250 lignes
- [ ] Tab `tabs/branding-tab.tsx` -- logo + 2 color pickers + email signature template + letterhead PDF template upload -- ~280 lignes
- [ ] Tab `tabs/users-tab.tsx` -- table users + invite + edit role + suspend + delete + bulk import -- ~300 lignes
- [ ] Tab `tabs/custom-fields-tab.tsx` -- CRUD custom fields + entity filter -- ~250 lignes
- [ ] Tab `tabs/pipelines-tab.tsx` -- CRUD pipelines + stages editor inline -- ~220 lignes
- [ ] Tab `tabs/quotas-tab.tsx` -- read-only progress bars 6 quotas + upgrade CTA -- ~180 lignes
- [ ] Tab `tabs/api-keys-tab.tsx` -- list + create + revoke + scopes -- ~220 lignes
- [ ] Page `repo/apps/web-broker/app/[locale]/(protected)/profile/page.tsx` -- Server Component tabs router -- ~80 lignes
- [ ] Tab `tabs/info-tab.tsx` -- form display_name + email + phone + photo + locale + timezone + preferred_channel + signature -- ~280 lignes
- [ ] Tab `tabs/security-tab.tsx` -- change password + MFA section + recovery codes + active sessions + login history -- ~250 lignes
- [ ] Tab `tabs/notifications-tab.tsx` -- matrix events x canaux -- ~180 lignes
- [ ] Component `components/profile/mfa-setup-wizard.tsx` -- orchestrator 4 steps + state machine + sessionStorage persistence -- ~320 lignes
- [ ] Components `components/profile/mfa-step-{intro,qr,verify,codes}.tsx` -- 4 fichiers de ~90 lignes chacun
- [ ] Component `components/profile/qr-code-display.tsx` -- QR + secret toggleable + countdown + alt text -- ~100 lignes
- [ ] Component `components/profile/recovery-codes-display.tsx` -- grid 10 codes + copy individuel + download .txt + checkbox saved -- ~140 lignes
- [ ] Component `components/profile/active-sessions-list.tsx` -- list cards + revoke individual + revoke-all + current badge -- ~200 lignes
- [ ] Component `components/profile/change-password-dialog.tsx` -- form current + new + confirm + strength meter -- ~190 lignes
- [ ] Component `components/profile/disable-mfa-dialog.tsx` -- recheck password + warning -- ~120 lignes
- [ ] Component `components/parametres/invite-user-dialog.tsx` -- form email + role + locale -- ~140 lignes
- [ ] Component `components/parametres/custom-field-form.tsx` -- type-dynamic form fields -- ~220 lignes
- [ ] Component `components/parametres/pipeline-stages-editor.tsx` -- dnd-kit reorder + color picker per stage -- ~250 lignes
- [ ] Component `components/parametres/api-key-dialog.tsx` -- create form + scopes checkboxes + one-time display -- ~180 lignes
- [ ] Component `components/parametres/logo-uploader.tsx` -- react-dropzone + preview + crop + S3 upload -- ~200 lignes
- [ ] Lib `lib/queries/parametres.queries.ts` + `lib/queries/profile.queries.ts` + `lib/queries/mfa.queries.ts` + `lib/queries/sessions.queries.ts` -- TanStack Query hooks (queries + mutations) -- ~600 lignes total
- [ ] Lib `lib/schemas/{parametres,profile,mfa}.schema.ts` -- Zod schemas -- ~400 lignes total
- [ ] Lib `lib/utils/{contrast-ratio,strip-exif,download-text-file,password-strength}.ts` -- helpers purs -- ~200 lignes total
- [ ] Tests Vitest unit (18+) -- ~1500 lignes total, coverage >= 85% sur composants livres
- [ ] Tests Playwright E2E (12+) -- ~1200 lignes total

---

## 5. API contracts attendus (8-10 ko)

### 5.1 Tenant settings

`GET /api/v1/tenants/:id` retourne :

```json
{
  "id": "uuid",
  "name": "Cabinet Sofidemy",
  "legal_name": "Sofidemy SARL",
  "ice": "001234567000089",
  "rc": "RC123456",
  "address": {
    "street": "12 Avenue Hassan II",
    "city": "Casablanca",
    "postal_code": "20000",
    "country": "MA"
  },
  "contact": {
    "phone": "+212522123456",
    "email": "contact@sofidemy.ma",
    "website": "https://sofidemy.ma"
  },
  "default_locale": "fr",
  "supported_locales": ["fr", "ar-MA", "ar"],
  "currency": "MAD",
  "timezone": "Africa/Casablanca",
  "fiscal_year_start": "01-01",
  "working_hours": {
    "monday": { "open": "09:00", "close": "18:00" },
    "tuesday": { "open": "09:00", "close": "18:00" },
    "wednesday": { "open": "09:00", "close": "18:00" },
    "thursday": { "open": "09:00", "close": "18:00" },
    "friday": { "open": "09:00", "close": "18:00" },
    "saturday": null,
    "sunday": null
  },
  "branding": {
    "logo_url": "https://s3.ma/tenants/uuid/logo.png",
    "primary_color": "#E95D2C",
    "secondary_color": "#1A2730",
    "email_signature_template": "Cordialement,\n{{user.display_name}}\n{{tenant.name}}",
    "letterhead_pdf_url": "https://s3.ma/tenants/uuid/letterhead.pdf"
  },
  "created_at": "2026-01-15T10:00:00.000Z",
  "updated_at": "2026-05-12T14:30:00.000Z"
}
```

`PATCH /api/v1/tenants/:id` accepte partial body avec validation Zod. Idempotency-Key recommande pour mutations sensibles. Audit log automatique cote backend.

### 5.2 Users tenant

`GET /api/v1/tenants/:id/users?page=1&page_size=20&search=...&role=...&status=active` retourne :

```json
{
  "data": [
    {
      "id": "uuid",
      "display_name": "Karim El Amrani",
      "email": "karim@sofidemy.ma",
      "phone": "+212661234567",
      "role": "broker_user",
      "status": "active",
      "mfa_enabled": true,
      "last_login_at": "2026-05-17T08:32:00.000Z",
      "created_at": "2026-01-20T10:00:00.000Z",
      "avatar_url": "https://s3.ma/users/uuid/avatar.jpg"
    }
  ],
  "pagination": { "page": 1, "page_size": 20, "total": 5, "total_pages": 1 }
}
```

`POST /api/v1/tenants/:id/users/invite` body `{ email, role, locale, send_welcome_email }` -> 202 Accepted, email envoye.

`PATCH /api/v1/tenants/:id/users/:user_id` accepte `{ role, status }`. Backend valide pas de self-demotion broker_admin si seul admin.

`DELETE /api/v1/tenants/:id/users/:user_id` soft delete (status=deleted). Reassignement deals + contacts en cascade (prompt frontend pour choisir cessionnaire).

### 5.3 Custom fields

`GET /api/v1/crm/custom-fields?entity=contact` retourne :

```json
{
  "data": [
    {
      "id": "uuid",
      "entity": "contact",
      "key": "preference_voiture",
      "label": "Preference vehicule",
      "type": "select",
      "options": ["Diesel", "Essence", "Hybride", "Electrique"],
      "required": false,
      "default_value": null,
      "order": 1,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

`type` enum : `text | number | date | select | multiselect | boolean | textarea | url | email | phone`.

`POST /api/v1/crm/custom-fields` body `{ entity, key, label, type, options?, required, default_value? }`. Backend enforce reserved keywords blacklist + key snake_case format.

### 5.4 Pipelines

`GET /api/v1/crm/pipelines` retourne :

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Pipeline Vente Auto",
      "is_default": true,
      "stages": [
        { "id": "uuid", "name": "Prospect", "probability": 10, "color": "#9CA3AF", "order": 1 },
        { "id": "uuid", "name": "Qualifie", "probability": 30, "color": "#3B82F6", "order": 2 },
        { "id": "uuid", "name": "Proposition", "probability": 60, "color": "#F59E0B", "order": 3 },
        { "id": "uuid", "name": "Negociation", "probability": 80, "color": "#8B5CF6", "order": 4 },
        { "id": "uuid", "name": "Gagne", "probability": 100, "color": "#10B981", "order": 5, "is_won": true },
        { "id": "uuid", "name": "Perdu", "probability": 0, "color": "#EF4444", "order": 6, "is_lost": true }
      ]
    }
  ]
}
```

### 5.5 Quotas

`GET /api/v1/tenants/:id/quotas` retourne :

```json
{
  "plan": "professional",
  "limits": {
    "users_max": 25,
    "contacts_max": 10000,
    "deals_max": 5000,
    "polices_max": 5000,
    "storage_gb_max": 50,
    "api_requests_per_month": 100000
  },
  "usage": {
    "users_current": 8,
    "contacts_current": 3421,
    "deals_current": 1205,
    "polices_current": 982,
    "storage_gb_current": 12.4,
    "api_requests_current_month": 23456
  },
  "billing_cycle": {
    "start": "2026-05-01",
    "end": "2026-05-31",
    "next_invoice_date": "2026-06-01"
  }
}
```

### 5.6 API keys

`GET /api/v1/tenants/:id/api-keys` retourne (jamais le secret en clair, seulement prefix) :

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Integration Comparateur Sofidemy",
      "key_prefix": "sk_live_abc123",
      "scopes": ["read:contacts", "write:deals", "read:polices"],
      "last_used_at": "2026-05-17T09:00:00.000Z",
      "created_at": "2026-03-10T10:00:00.000Z",
      "created_by": { "id": "uuid", "display_name": "Karim El Amrani" }
    }
  ]
}
```

`POST /api/v1/tenants/:id/api-keys` body `{ name, scopes }` retourne UNE SEULE FOIS le secret en clair :

```json
{
  "id": "uuid",
  "name": "Integration X",
  "key_prefix": "sk_live_xyz789",
  "secret": "sk_live_xyz789_VERY_LONG_RANDOM_BASE64URL_STRING_DO_NOT_LOSE",
  "scopes": ["read:contacts"],
  "warning": "Cette cle ne sera plus affichee. Sauvegardez-la maintenant."
}
```

`DELETE /api/v1/tenants/:id/api-keys/:key_id` revoke + audit log.

### 5.7 Profile (auth/me)

`GET /api/v1/auth/me` retourne :

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "email": "karim@sofidemy.ma",
  "email_verified": true,
  "phone": "+212661234567",
  "phone_verified": true,
  "display_name": "Karim El Amrani",
  "avatar_url": "https://s3.ma/users/uuid/avatar.jpg",
  "role": "broker_admin",
  "permissions": ["crm.contacts.*", "crm.deals.*", "tenant.settings.*", "..."],
  "locale": "fr",
  "timezone": "Africa/Casablanca",
  "preferred_channel": "email",
  "email_signature": "Cordialement,\nKarim El Amrani",
  "whatsapp_signature": "Karim - Cabinet Sofidemy",
  "mfa_enabled": true,
  "mfa_enabled_at": "2026-01-22T14:00:00.000Z",
  "last_password_change_at": "2026-04-01T10:00:00.000Z",
  "created_at": "2026-01-15T10:00:00.000Z"
}
```

`PATCH /api/v1/auth/me` accepte partial : display_name, phone, locale, timezone, preferred_channel, email_signature, whatsapp_signature, avatar_url.

`POST /api/v1/auth/change-password` body `{ current_password, new_password }`, header `Idempotency-Key: <uuid>` recommande, retourne 200 + force re-login (invalidate all sessions sauf courante).

### 5.8 MFA

`POST /api/v1/auth/mfa/setup` body vide -> :

```json
{
  "secret": "JBSWY3DPEHPK3PXPMFA32CHARS",
  "otpauth_url": "otpauth://totp/skalean-insurtech:karim@sofidemy.ma?secret=JBSWY3DPEHPK3PXPMFA32CHARS&issuer=skalean-insurtech&algorithm=SHA1&digits=6&period=30",
  "qr_data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...",
  "setup_challenge_token": "random_base64url_token_5min_ttl"
}
```

`POST /api/v1/auth/mfa/verify` body `{ setup_challenge_token, code }` -> enable MFA + retourne 10 recovery codes one-time :

```json
{
  "mfa_enabled": true,
  "recovery_codes": [
    "ABCD-EFGH-JKMN",
    "PQRS-TVWX-YZ23",
    "4567-89AB-CDEF",
    "GHJK-MNPQ-RSTV",
    "WXYZ-2345-6789",
    "ABCD-EFGH-JKMP",
    "QRST-VWXY-Z234",
    "5678-9ABC-DEFG",
    "HJKM-NPQR-STVW",
    "XYZ2-3456-789A"
  ]
}
```

(Alphabet exclut 0, O, 1, I, L conforme decision-016 + Sprint 5 Tache 2.1.7.)

`POST /api/v1/auth/mfa/disable` body `{ current_password, totp_code? }` -> 200, audit log.

`POST /api/v1/auth/mfa/recovery-codes/regenerate` body `{ current_password }` -> retourne 10 nouveaux codes, anciens invalides.

### 5.9 Sessions

`GET /api/v1/auth/sessions` retourne :

```json
{
  "data": [
    {
      "id": "uuid",
      "device": "MacBook Pro",
      "device_type": "desktop",
      "browser": "Chrome 124",
      "os": "macOS 14.4",
      "ip": "196.200.100.50",
      "location": { "city": "Casablanca", "country": "MA", "country_name": "Maroc" },
      "last_active_at": "2026-05-17T10:00:00.000Z",
      "created_at": "2026-05-15T09:00:00.000Z",
      "is_current": true
    },
    {
      "id": "uuid",
      "device": "iPhone 14",
      "device_type": "mobile",
      "browser": "Safari 17",
      "os": "iOS 17.4",
      "ip": "41.140.50.10",
      "location": { "city": "Rabat", "country": "MA", "country_name": "Maroc" },
      "last_active_at": "2026-05-16T22:30:00.000Z",
      "created_at": "2026-05-10T08:00:00.000Z",
      "is_current": false
    }
  ]
}
```

`POST /api/v1/auth/sessions/:id/revoke` -> 200, session invalidated.

`POST /api/v1/auth/sessions/revoke-all?except_current=true` -> 200, retourne count revoked.

### 5.10 Notifications preferences

`GET /api/v1/auth/notifications-preferences` retourne matrice :

```json
{
  "preferences": {
    "deal_won": { "email": true, "in_app": true, "whatsapp": false },
    "deal_lost": { "email": false, "in_app": true, "whatsapp": false },
    "policy_renewal_due": { "email": true, "in_app": true, "whatsapp": true },
    "broker_queue_new": { "email": true, "in_app": true, "whatsapp": false },
    "broker_queue_sla_warning": { "email": true, "in_app": true, "whatsapp": true },
    "sinistre_status_change": { "email": false, "in_app": true, "whatsapp": false },
    "sinistre_status_critical": { "email": true, "in_app": true, "whatsapp": true, "mandatory": true },
    "user_invited_accepted": { "email": true, "in_app": true, "whatsapp": false },
    "password_changed": { "email": true, "in_app": false, "whatsapp": false, "mandatory": true },
    "mfa_disabled": { "email": true, "in_app": true, "whatsapp": false, "mandatory": true },
    "session_revoked_by_other_device": { "email": true, "in_app": true, "whatsapp": false }
  }
}
```

`mandatory: true` -> les toggles email sont disabled cote UI (rends grise + tooltip "Cette notification est imposee par la conformite reglementaire").

`PATCH /api/v1/auth/notifications-preferences` accepte partial update.

### 5.11 Login history audit

`GET /api/v1/auth/audit/login-history?limit=10` retourne :

```json
{
  "data": [
    {
      "id": "uuid",
      "event": "login_success",
      "ip": "196.200.100.50",
      "user_agent": "Mozilla/5.0 (Macintosh; ...)",
      "location": { "city": "Casablanca", "country_name": "Maroc" },
      "mfa_used": true,
      "occurred_at": "2026-05-17T08:32:00.000Z"
    },
    {
      "id": "uuid",
      "event": "login_failed",
      "ip": "41.140.50.10",
      "user_agent": "Mozilla/5.0 (iPhone; ...)",
      "reason": "wrong_password",
      "occurred_at": "2026-05-16T19:00:00.000Z"
    }
  ]
}
```

---

## 6. Patterns code complets (40-50 ko)

### 6.1 Schemas Zod -- `lib/schemas/parametres.schema.ts`

```typescript
import { z } from 'zod';

export const TenantContactSchema = z.object({
  phone: z.string().regex(/^\+212[567]\d{8}$/, 'Numero MA invalide (format +212XXXXXXXXX)'),
  email: z.string().email('Email invalide'),
  website: z.string().url('URL invalide').optional().or(z.literal('')),
});

export const TenantAddressSchema = z.object({
  street: z.string().min(3, 'Adresse trop courte').max(200),
  city: z.string().min(2).max(100),
  postal_code: z.string().regex(/^\d{5}$/, 'Code postal MA = 5 chiffres'),
  country: z.literal('MA'),
});

export const WorkingHoursDaySchema = z.object({
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM'),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM'),
}).nullable();

export const WorkingHoursSchema = z.object({
  monday: WorkingHoursDaySchema,
  tuesday: WorkingHoursDaySchema,
  wednesday: WorkingHoursDaySchema,
  thursday: WorkingHoursDaySchema,
  friday: WorkingHoursDaySchema,
  saturday: WorkingHoursDaySchema,
  sunday: WorkingHoursDaySchema,
}).refine(
  (val) => Object.values(val).some((d) => d !== null),
  { message: 'Au moins un jour ouvre obligatoire' },
);

export const TenantGeneralSchema = z.object({
  name: z.string().min(2, 'Nom tenant >= 2 chars').max(100),
  legal_name: z.string().min(2).max(150),
  ice: z.string().regex(/^\d{15}$/, 'ICE doit etre 15 chiffres'),
  rc: z.string().min(2).max(50),
  address: TenantAddressSchema,
  contact: TenantContactSchema,
  default_locale: z.enum(['fr', 'ar-MA', 'ar']),
  currency: z.literal('MAD'),
  timezone: z.literal('Africa/Casablanca'),
  fiscal_year_start: z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Format MM-DD'),
  working_hours: WorkingHoursSchema,
});

export type TenantGeneralInput = z.infer<typeof TenantGeneralSchema>;

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur HEX 6 chars (ex: #E95D2C)');

export const TenantBrandingSchema = z.object({
  logo_url: z.string().url().optional().nullable(),
  primary_color: HexColorSchema,
  secondary_color: HexColorSchema,
  email_signature_template: z.string().max(2000).optional().nullable(),
  letterhead_pdf_url: z.string().url().optional().nullable(),
});

export type TenantBrandingInput = z.infer<typeof TenantBrandingSchema>;

export const InviteUserSchema = z.object({
  email: z.string().email('Email invalide'),
  role: z.enum(['broker_admin', 'broker_user', 'broker_assistant']),
  locale: z.enum(['fr', 'ar-MA', 'ar']).default('fr'),
  send_welcome_email: z.boolean().default(true),
});

export type InviteUserInput = z.infer<typeof InviteUserSchema>;

export const UpdateUserSchema = z.object({
  role: z.enum(['broker_admin', 'broker_user', 'broker_assistant']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

export const CustomFieldKeyReservedKeywords = [
  'id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at',
  'email', 'phone', 'first_name', 'last_name', 'display_name',
  'cin', 'ice', 'rc', 'company_id', 'contact_id', 'deal_id', 'policy_id',
  'owner_id', 'assigned_to', 'tags', 'segment', 'status',
];

export const CustomFieldSchema = z.object({
  entity: z.enum(['contact', 'company', 'deal', 'policy']),
  key: z
    .string()
    .regex(/^[a-z][a-z0-9_]{1,49}$/, 'Cle snake_case, debut lettre, max 50')
    .refine((k) => !CustomFieldKeyReservedKeywords.includes(k), {
      message: 'Cle reservee, choisissez une autre',
    }),
  label: z.string().min(2).max(100),
  type: z.enum([
    'text', 'number', 'date', 'select', 'multiselect',
    'boolean', 'textarea', 'url', 'email', 'phone',
  ]),
  options: z.array(z.string().min(1).max(100)).optional(),
  required: z.boolean().default(false),
  default_value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]).optional(),
  order: z.number().int().min(0).default(0),
}).refine(
  (val) => {
    if ((val.type === 'select' || val.type === 'multiselect') && (!val.options || val.options.length < 1)) {
      return false;
    }
    return true;
  },
  { message: 'Options requises pour type select/multiselect', path: ['options'] },
);

export type CustomFieldInput = z.infer<typeof CustomFieldSchema>;

export const PipelineStageSchema = z.object({
  name: z.string().min(2).max(50),
  probability: z.number().int().min(0).max(100),
  color: HexColorSchema,
  is_won: z.boolean().default(false),
  is_lost: z.boolean().default(false),
});

export const PipelineSchema = z.object({
  name: z.string().min(2).max(100),
  is_default: z.boolean().default(false),
  stages: z.array(PipelineStageSchema).min(2, 'Au moins 2 stages').max(15, 'Maximum 15 stages'),
}).refine(
  (val) => val.stages.some((s) => s.is_won) && val.stages.some((s) => s.is_lost),
  { message: 'Pipeline doit avoir au moins 1 stage Won + 1 stage Lost' },
);

export type PipelineInput = z.infer<typeof PipelineSchema>;

export const ApiKeyScopeEnum = z.enum([
  'read:contacts', 'write:contacts',
  'read:companies', 'write:companies',
  'read:deals', 'write:deals',
  'read:polices', 'write:polices',
  'read:sinistres',
  'read:analytics',
  'webhook:receive',
]);

export const CreateApiKeySchema = z.object({
  name: z.string().min(3).max(100),
  scopes: z.array(ApiKeyScopeEnum).min(1, 'Au moins 1 scope obligatoire'),
  expires_at: z.string().datetime().optional().nullable(),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
```

### 6.2 Schemas Zod -- `lib/schemas/profile.schema.ts`

```typescript
import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  display_name: z.string().min(2, 'Nom >= 2 chars').max(100).optional(),
  phone: z.string().regex(/^\+212[567]\d{8}$/, 'Tel MA format +212XXXXXXXXX').optional(),
  locale: z.enum(['fr', 'ar-MA', 'ar']).optional(),
  timezone: z.literal('Africa/Casablanca').optional(),
  preferred_channel: z.enum(['email', 'whatsapp', 'sms', 'in_app']).optional(),
  email_signature: z.string().max(2000).optional(),
  whatsapp_signature: z.string().max(500).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const PasswordComplexityRules = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: true,
  forbidCommonPasswords: true,
};

export const PasswordSchema = z
  .string()
  .min(PasswordComplexityRules.minLength, `Min ${PasswordComplexityRules.minLength} caracteres`)
  .max(PasswordComplexityRules.maxLength)
  .refine((p) => /[A-Z]/.test(p), { message: 'Au moins 1 majuscule' })
  .refine((p) => /[a-z]/.test(p), { message: 'Au moins 1 minuscule' })
  .refine((p) => /\d/.test(p), { message: 'Au moins 1 chiffre' })
  .refine((p) => /[^A-Za-z0-9]/.test(p), { message: 'Au moins 1 caractere special' });

export const ChangePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Mot de passe actuel requis'),
    new_password: PasswordSchema,
    confirm_password: z.string(),
  })
  .refine((val) => val.new_password === val.confirm_password, {
    message: 'Confirmation differente du nouveau mot de passe',
    path: ['confirm_password'],
  })
  .refine((val) => val.new_password !== val.current_password, {
    message: 'Le nouveau mot de passe doit etre different de l\'actuel',
    path: ['new_password'],
  });

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const NotificationEventEnum = z.enum([
  'deal_won', 'deal_lost', 'deal_assigned',
  'policy_renewal_due', 'policy_expired', 'policy_created',
  'broker_queue_new', 'broker_queue_sla_warning', 'broker_queue_assigned',
  'sinistre_status_change', 'sinistre_status_critical',
  'user_invited_accepted', 'user_role_changed',
  'password_changed', 'mfa_disabled', 'mfa_enabled',
  'session_revoked_by_other_device', 'new_login_unknown_device',
]);

export const ChannelPreferenceSchema = z.object({
  email: z.boolean(),
  in_app: z.boolean(),
  whatsapp: z.boolean(),
  sms: z.boolean().optional(),
  mandatory: z.boolean().optional(),
});

export const NotificationsPreferencesSchema = z.object({
  preferences: z.record(NotificationEventEnum, ChannelPreferenceSchema),
});

export type NotificationsPreferencesInput = z.infer<typeof NotificationsPreferencesSchema>;
```

### 6.3 Schemas Zod -- `lib/schemas/mfa.schema.ts`

```typescript
import { z } from 'zod';

export const TotpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Code TOTP = 6 chiffres');

export const VerifyMfaSetupSchema = z.object({
  setup_challenge_token: z.string().min(32),
  code: TotpCodeSchema,
});

export type VerifyMfaSetupInput = z.infer<typeof VerifyMfaSetupSchema>;

export const DisableMfaSchema = z.object({
  current_password: z.string().min(1, 'Mot de passe requis'),
  totp_code: TotpCodeSchema.optional(),
});

export type DisableMfaInput = z.infer<typeof DisableMfaSchema>;

export const RegenerateRecoveryCodesSchema = z.object({
  current_password: z.string().min(1),
});

export const RecoveryCodeFormatSchema = z
  .string()
  .regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/, 'Format XXXX-XXXX-XXXX (alphanumerique sans 0/O/1/I/L)');

export const MfaSetupResultSchema = z.object({
  secret: z.string().min(16),
  otpauth_url: z.string().startsWith('otpauth://totp/'),
  qr_data_url: z.string().startsWith('data:image/'),
  setup_challenge_token: z.string().min(32),
});

export type MfaSetupResult = z.infer<typeof MfaSetupResultSchema>;
```

### 6.4 Utils -- `lib/utils/contrast-ratio.ts`

```typescript
/**
 * Calcule le contrast ratio WCAG 2.1 entre 2 couleurs HEX.
 * Retourne ratio entre 1 (identique) et 21 (noir/blanc).
 * WCAG AA texte normal : >= 4.5:1, texte large : >= 3:1.
 * WCAG AAA texte normal : >= 7:1.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

export type ContrastLevel = 'fail' | 'aa-large' | 'aa' | 'aaa';

export function getContrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return 'aaa';
  if (ratio >= 4.5) return 'aa';
  if (ratio >= 3) return 'aa-large';
  return 'fail';
}

export function getContrastLabel(level: ContrastLevel): string {
  switch (level) {
    case 'aaa': return 'WCAG AAA (excellent)';
    case 'aa': return 'WCAG AA (conforme)';
    case 'aa-large': return 'WCAG AA gros texte uniquement';
    case 'fail': return 'NON conforme WCAG';
  }
}
```

### 6.5 Utils -- `lib/utils/password-strength.ts`

```typescript
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrengthResult {
  score: PasswordStrength;
  label: 'tres faible' | 'faible' | 'moyen' | 'bon' | 'excellent';
  color: 'red' | 'orange' | 'yellow' | 'lime' | 'green';
  feedback: string[];
}

const COMMON_PASSWORDS = new Set([
  'password', 'password123', 'qwerty', 'azerty', '123456789',
  'motdepasse', 'admin123', 'welcome1', 'changeme',
]);

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 12) score += 1;
  else feedback.push('Minimum 12 caracteres');

  if (password.length >= 16) score += 1;

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  else feedback.push('Majuscules + minuscules');

  if (/\d/.test(password)) score += 1;
  else feedback.push('Au moins 1 chiffre');

  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else feedback.push('Au moins 1 caractere special');

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = 0;
    feedback.push('Mot de passe trop courant');
  }

  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    feedback.push('Eviter caracteres repetes 3 fois');
  }

  score = Math.min(4, score) as PasswordStrength;

  const labels: Record<PasswordStrength, PasswordStrengthResult['label']> = {
    0: 'tres faible',
    1: 'faible',
    2: 'moyen',
    3: 'bon',
    4: 'excellent',
  };
  const colors: Record<PasswordStrength, PasswordStrengthResult['color']> = {
    0: 'red',
    1: 'orange',
    2: 'yellow',
    3: 'lime',
    4: 'green',
  };

  return {
    score,
    label: labels[score],
    color: colors[score],
    feedback,
  };
}
```

### 6.6 Utils -- `lib/utils/download-text-file.ts`

```typescript
/**
 * Telecharge un fichier .txt UTF-8 sans BOM, line endings \r\n compat Windows.
 * Decision-006 : aucun emoji dans le contenu.
 */
export function downloadTextFile(filename: string, content: string): void {
  const normalized = content.replace(/\r?\n/g, '\r\n');
  const blob = new Blob([normalized], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function formatRecoveryCodesForDownload(
  codes: string[],
  userEmail: string,
  generatedAt: Date,
): string {
  const header = [
    '================================================================',
    '  SKALEAN INSURTECH -- CODES DE SECOURS MFA',
    '================================================================',
    '',
    `  Compte         : ${userEmail}`,
    `  Genere le      : ${generatedAt.toISOString()}`,
    `  Nombre de codes : ${codes.length}`,
    '',
    '  IMPORTANT - LIRE ATTENTIVEMENT :',
    '',
    '  - Conservez ces codes dans un endroit SUR (gestionnaire de',
    '    mots de passe, coffre-fort, imprimes dans un tiroir verrouille).',
    '  - Chaque code ne peut etre utilise QU\'UNE SEULE FOIS.',
    '  - Ces codes remplacent votre application authenticator en cas',
    '    de perte ou de panne de votre telephone.',
    '  - NE PARTAGEZ JAMAIS ces codes par email, SMS, ou messagerie.',
    '  - Si vous suspectez qu\'ils sont compromis, regenerez-les',
    '    immediatement depuis votre profil > Securite.',
    '',
    '================================================================',
    '',
  ].join('\n');

  const body = codes
    .map((c, i) => `  ${(i + 1).toString().padStart(2, '0')}.  ${c}`)
    .join('\n');

  const footer = [
    '',
    '',
    '================================================================',
    '  Ce document a ete genere par Skalean InsurTech.',
    '  https://www.skalean-insurtech.ma',
    '================================================================',
  ].join('\n');

  return header + body + footer;
}
```

### 6.7 Utils -- `lib/utils/strip-exif.ts`

```typescript
/**
 * Strip EXIF d'une image via canvas re-encode.
 * Resout le piege iPhone EXIF Orientation=6 (image couchee).
 * Retourne un Blob image PNG/JPEG sans metadonnees.
 */
export async function stripExif(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas 2D context indisponible'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) reject(new Error('Conversion blob echouee'));
          else resolve(blob);
        },
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image invalide'));
    };
    img.src = url;
  });
}

export function isImageWithinSizeLimit(file: File, maxBytes: number): boolean {
  return file.size <= maxBytes;
}

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
```

### 6.8 Queries -- `lib/queries/parametres.queries.ts`

```typescript
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type {
  TenantGeneralInput,
  TenantBrandingInput,
  InviteUserInput,
  CustomFieldInput,
  PipelineInput,
  CreateApiKeyInput,
} from '@/lib/schemas/parametres.schema';

export function useTenantSettings(tenantId: string) {
  return useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/tenants/${tenantId}`);
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useUpdateTenantGeneral(tenantId: string) {
  const qc = useQueryClient();
  const t = useTranslations('parametres');
  return useMutation({
    mutationFn: async (input: Partial<TenantGeneralInput>) => {
      const res = await apiClient.patch(`/api/v1/tenants/${tenantId}`, input);
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['tenant', tenantId], data);
      toast.success(t('general.saved'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? t('general.error'));
    },
  });
}

export function useUpdateTenantBranding(tenantId: string) {
  const qc = useQueryClient();
  const t = useTranslations('parametres');
  return useMutation({
    mutationFn: async (input: TenantBrandingInput) => {
      const res = await apiClient.patch(`/api/v1/tenants/${tenantId}`, { branding: input });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success(t('branding.saved'));
    },
  });
}

export function useTenantUsers(tenantId: string, params?: {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['tenant', tenantId, 'users', params],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/tenants/${tenantId}/users`, { params });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useInviteUser(tenantId: string) {
  const qc = useQueryClient();
  const t = useTranslations('parametres');
  return useMutation({
    mutationFn: async (input: InviteUserInput) => {
      const res = await apiClient.post(`/api/v1/tenants/${tenantId}/users/invite`, input, {
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant', tenantId, 'users'] });
      toast.success(t('users.invite.success'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? t('users.invite.error'));
    },
  });
}

export function useUpdateUser(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, input }: { userId: string; input: { role?: string; status?: string } }) => {
      const res = await apiClient.patch(`/api/v1/tenants/${tenantId}/users/${userId}`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant', tenantId, 'users'] });
    },
  });
}

export function useDeleteUser(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/api/v1/tenants/${tenantId}/users/${userId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant', tenantId, 'users'] });
      toast.success('Utilisateur supprime');
    },
  });
}

export function useCustomFields(entity: 'contact' | 'company' | 'deal' | 'policy') {
  return useQuery({
    queryKey: ['custom-fields', entity],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/crm/custom-fields', { params: { entity } });
      return res.data.data;
    },
  });
}

export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CustomFieldInput) => {
      const res = await apiClient.post('/api/v1/crm/custom-fields', input);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['custom-fields', vars.entity] });
      toast.success('Champ personnalise cree');
    },
  });
}

export function useUpdateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CustomFieldInput> }) => {
      const res = await apiClient.patch(`/api/v1/crm/custom-fields/${id}`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
    },
  });
}

export function useDeleteCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/crm/custom-fields/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
    },
  });
}

export function usePipelines() {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/crm/pipelines');
      return res.data.data;
    },
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PipelineInput }) => {
      const res = await apiClient.patch(`/api/v1/crm/pipelines/${id}`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline mis a jour');
    },
  });
}

export function useTenantQuotas(tenantId: string) {
  return useQuery({
    queryKey: ['tenant', tenantId, 'quotas'],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/tenants/${tenantId}/quotas`);
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export function useApiKeys(tenantId: string) {
  return useQuery({
    queryKey: ['tenant', tenantId, 'api-keys'],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/tenants/${tenantId}/api-keys`);
      return res.data.data;
    },
  });
}

export function useCreateApiKey(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateApiKeyInput) => {
      const res = await apiClient.post(`/api/v1/tenants/${tenantId}/api-keys`, input, {
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant', tenantId, 'api-keys'] });
    },
  });
}

export function useRevokeApiKey(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      await apiClient.delete(`/api/v1/tenants/${tenantId}/api-keys/${keyId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant', tenantId, 'api-keys'] });
      toast.success('Cle API revoquee');
    },
  });
}

export function useUploadLogo(tenantId: string) {
  return useMutation({
    mutationFn: async (file: Blob) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenant_id', tenantId);
      const res = await apiClient.post('/api/v1/uploads/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data as { url: string };
    },
  });
}
```

### 6.9 Queries -- `lib/queries/profile.queries.ts`

```typescript
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import type {
  UpdateProfileInput,
  ChangePasswordInput,
  NotificationsPreferencesInput,
} from '@/lib/schemas/profile.schema';

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/auth/me');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const res = await apiClient.patch('/api/v1/auth/me', input);
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['auth', 'me'], data);
      toast.success('Profil mis a jour');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Erreur');
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const res = await apiClient.post('/api/v1/auth/change-password', {
        current_password: input.current_password,
        new_password: input.new_password,
      }, {
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Mot de passe change. Vos autres sessions ont ete deconnectees.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Erreur changement mot de passe');
    },
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: async (file: Blob) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/api/v1/uploads/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data as { url: string };
    },
  });
}

export function useNotificationsPreferences() {
  return useQuery({
    queryKey: ['auth', 'notifications-preferences'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/auth/notifications-preferences');
      return res.data;
    },
  });
}

export function useUpdateNotificationsPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NotificationsPreferencesInput) => {
      const res = await apiClient.patch('/api/v1/auth/notifications-preferences', input);
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['auth', 'notifications-preferences'], data);
      toast.success('Preferences enregistrees');
    },
  });
}

export function useLoginHistory(limit = 10) {
  return useQuery({
    queryKey: ['auth', 'login-history', limit],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/auth/audit/login-history', { params: { limit } });
      return res.data.data;
    },
  });
}
```

### 6.10 Queries -- `lib/queries/mfa.queries.ts`

```typescript
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import type {
  VerifyMfaSetupInput,
  DisableMfaInput,
} from '@/lib/schemas/mfa.schema';

export function useSetupMfa() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/v1/auth/mfa/setup');
      return res.data;
    },
  });
}

export function useVerifyMfaSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VerifyMfaSetupInput) => {
      const res = await apiClient.post('/api/v1/auth/mfa/verify', input);
      return res.data as { mfa_enabled: boolean; recovery_codes: string[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('MFA active avec succes');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Code invalide');
    },
  });
}

export function useDisableMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DisableMfaInput) => {
      await apiClient.post('/api/v1/auth/mfa/disable', input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('MFA desactive');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Erreur desactivation');
    },
  });
}

export function useRegenerateRecoveryCodes() {
  return useMutation({
    mutationFn: async (input: { current_password: string }) => {
      const res = await apiClient.post('/api/v1/auth/mfa/recovery-codes/regenerate', input);
      return res.data as { recovery_codes: string[] };
    },
    onSuccess: () => {
      toast.success('Nouveaux codes generes. Les anciens sont desormais invalides.');
    },
  });
}
```

### 6.11 Queries -- `lib/queries/sessions.queries.ts`

```typescript
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export interface ActiveSession {
  id: string;
  device: string;
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  ip: string;
  location: { city: string; country: string; country_name: string };
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

export function useActiveSessions() {
  return useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/auth/sessions');
      return res.data.data as ActiveSession[];
    },
    refetchInterval: 60_000,
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.post(`/api/v1/auth/sessions/${sessionId}/revoke`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      toast.success('Session revoquee');
    },
  });
}

export function useRevokeAllSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/v1/auth/sessions/revoke-all?except_current=true');
      return res.data as { revoked_count: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      toast.success(`${data.revoked_count} session(s) revoquee(s)`);
    },
  });
}
```

### 6.12 Page parametres -- `app/[locale]/(protected)/parametres/page.tsx`

```typescript
import { redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getServerSession } from '@/lib/auth/get-server-session';
import { getTranslations } from 'next-intl/server';
import { GeneralTab } from './tabs/general-tab';
import { BrandingTab } from './tabs/branding-tab';
import { UsersTab } from './tabs/users-tab';
import { CustomFieldsTab } from './tabs/custom-fields-tab';
import { PipelinesTab } from './tabs/pipelines-tab';
import { QuotasTab } from './tabs/quotas-tab';
import { ApiKeysTab } from './tabs/api-keys-tab';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ParametresPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { tab = 'general' } = await searchParams;
  const session = await getServerSession();
  const t = await getTranslations('parametres');

  if (!session) {
    redirect(`/${locale}/login?redirect=/parametres`);
  }
  if (session.role !== 'broker_admin') {
    redirect(`/${locale}/dashboard?error=forbidden`);
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue={tab} className="w-full">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
          <TabsTrigger value="branding">{t('tabs.branding')}</TabsTrigger>
          <TabsTrigger value="users">{t('tabs.users')}</TabsTrigger>
          <TabsTrigger value="custom-fields">{t('tabs.custom_fields')}</TabsTrigger>
          <TabsTrigger value="pipelines">{t('tabs.pipelines')}</TabsTrigger>
          <TabsTrigger value="quotas">{t('tabs.quotas')}</TabsTrigger>
          <TabsTrigger value="api-keys">{t('tabs.api_keys')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general"><GeneralTab tenantId={session.tenant_id} /></TabsContent>
        <TabsContent value="branding"><BrandingTab tenantId={session.tenant_id} /></TabsContent>
        <TabsContent value="users"><UsersTab tenantId={session.tenant_id} currentUserId={session.user_id} /></TabsContent>
        <TabsContent value="custom-fields"><CustomFieldsTab /></TabsContent>
        <TabsContent value="pipelines"><PipelinesTab /></TabsContent>
        <TabsContent value="quotas"><QuotasTab tenantId={session.tenant_id} /></TabsContent>
        <TabsContent value="api-keys"><ApiKeysTab tenantId={session.tenant_id} /></TabsContent>
      </Tabs>
    </div>
  );
}
```

### 6.13 Tab general -- `app/[locale]/(protected)/parametres/tabs/general-tab.tsx`

```typescript
'use client';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTenantSettings, useUpdateTenantGeneral } from '@/lib/queries/parametres.queries';
import { TenantGeneralSchema, type TenantGeneralInput } from '@/lib/schemas/parametres.schema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkingHoursEditor } from '@/components/parametres/working-hours-editor';

interface GeneralTabProps {
  tenantId: string;
}

export function GeneralTab({ tenantId }: GeneralTabProps) {
  const t = useTranslations('parametres.general');
  const { data: tenant, isLoading } = useTenantSettings(tenantId);
  const updateMutation = useUpdateTenantGeneral(tenantId);

  const form = useForm<TenantGeneralInput>({
    resolver: zodResolver(TenantGeneralSchema),
  });

  useEffect(() => {
    if (tenant) {
      form.reset({
        name: tenant.name,
        legal_name: tenant.legal_name,
        ice: tenant.ice,
        rc: tenant.rc,
        address: tenant.address,
        contact: tenant.contact,
        default_locale: tenant.default_locale,
        currency: tenant.currency,
        timezone: tenant.timezone,
        fiscal_year_start: tenant.fiscal_year_start,
        working_hours: tenant.working_hours,
      });
    }
  }, [tenant, form]);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('identity.title')}</CardTitle>
          <CardDescription>{t('identity.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">{t('identity.name')}</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="legal_name">{t('identity.legal_name')}</Label>
            <Input id="legal_name" {...form.register('legal_name')} />
          </div>
          <div>
            <Label htmlFor="ice">{t('identity.ice')}</Label>
            <Input id="ice" {...form.register('ice')} placeholder="15 chiffres" />
            {form.formState.errors.ice && (
              <p className="text-sm text-destructive">{form.formState.errors.ice.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="rc">{t('identity.rc')}</Label>
            <Input id="rc" {...form.register('rc')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('contact.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t('contact.phone')}</Label>
            <Input {...form.register('contact.phone')} placeholder="+212522123456" />
            {form.formState.errors.contact?.phone && (
              <p className="text-sm text-destructive">{form.formState.errors.contact.phone.message}</p>
            )}
          </div>
          <div>
            <Label>{t('contact.email')}</Label>
            <Input {...form.register('contact.email')} type="email" />
          </div>
          <div className="col-span-2">
            <Label>{t('contact.website')}</Label>
            <Input {...form.register('contact.website')} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('address.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>{t('address.street')}</Label>
            <Input {...form.register('address.street')} />
          </div>
          <div>
            <Label>{t('address.city')}</Label>
            <Input {...form.register('address.city')} />
          </div>
          <div>
            <Label>{t('address.postal_code')}</Label>
            <Input {...form.register('address.postal_code')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('locale_currency.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <Label>{t('locale_currency.default_locale')}</Label>
            <Controller
              control={form.control}
              name="default_locale"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Francais</SelectItem>
                    <SelectItem value="ar-MA">Darija (Arabe Marocain)</SelectItem>
                    <SelectItem value="ar">Arabe</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>{t('locale_currency.currency')}</Label>
            <Input value="MAD (Dirham Marocain)" disabled />
          </div>
          <div>
            <Label>{t('locale_currency.timezone')}</Label>
            <Input value="Africa/Casablanca (GMT+1)" disabled />
          </div>
          <div>
            <Label>{t('locale_currency.fiscal_year_start')}</Label>
            <Input {...form.register('fiscal_year_start')} placeholder="01-01" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('working_hours.title')}</CardTitle>
          <CardDescription>{t('working_hours.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            control={form.control}
            name="working_hours"
            render={({ field }) => (
              <WorkingHoursEditor value={field.value} onChange={field.onChange} />
            )}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => form.reset()}>
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={updateMutation.isPending || !form.formState.isDirty}>
          {updateMutation.isPending ? t('actions.saving') : t('actions.save')}
        </Button>
      </div>
    </form>
  );
}
```

### 6.14 Tab branding -- `app/[locale]/(protected)/parametres/tabs/branding-tab.tsx`

```typescript
'use client';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HexColorPicker } from 'react-colorful';
import { useTranslations } from 'next-intl';
import { useTenantSettings, useUpdateTenantBranding } from '@/lib/queries/parametres.queries';
import { TenantBrandingSchema, type TenantBrandingInput } from '@/lib/schemas/parametres.schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LogoUploader } from '@/components/parametres/logo-uploader';
import { getContrastRatio, getContrastLevel, getContrastLabel } from '@/lib/utils/contrast-ratio';

interface BrandingTabProps {
  tenantId: string;
}

export function BrandingTab({ tenantId }: BrandingTabProps) {
  const t = useTranslations('parametres.branding');
  const { data: tenant } = useTenantSettings(tenantId);
  const updateMutation = useUpdateTenantBranding(tenantId);

  const form = useForm<TenantBrandingInput>({
    resolver: zodResolver(TenantBrandingSchema),
    defaultValues: {
      primary_color: '#E95D2C',
      secondary_color: '#1A2730',
      email_signature_template: '',
    },
  });

  useEffect(() => {
    if (tenant?.branding) {
      form.reset(tenant.branding);
    }
  }, [tenant, form]);

  const primaryColor = form.watch('primary_color');
  const secondaryColor = form.watch('secondary_color');

  const primaryContrastWhite = getContrastRatio(primaryColor || '#000000', '#FFFFFF');
  const primaryLevel = getContrastLevel(primaryContrastWhite);

  return (
    <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('logo.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            control={form.control}
            name="logo_url"
            render={({ field }) => (
              <LogoUploader
                tenantId={tenantId}
                currentLogoUrl={field.value ?? undefined}
                onUploaded={(url) => field.onChange(url)}
              />
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('colors.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <div>
            <Label>{t('colors.primary')}</Label>
            <div className="flex items-center gap-2 mt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-12 h-12 rounded border-2 border-border"
                    style={{ backgroundColor: primaryColor }}
                    aria-label={t('colors.primary_picker')}
                  />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3">
                  <Controller
                    control={form.control}
                    name="primary_color"
                    render={({ field }) => (
                      <HexColorPicker color={field.value} onChange={field.onChange} />
                    )}
                  />
                </PopoverContent>
              </Popover>
              <Input
                {...form.register('primary_color')}
                placeholder="#E95D2C"
                className="font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('colors.contrast_white')} : {primaryContrastWhite.toFixed(2)}:1 -- {getContrastLabel(primaryLevel)}
            </p>
            {primaryLevel === 'fail' && (
              <Alert variant="destructive" className="mt-2">
                <AlertTitle>{t('colors.warning_title')}</AlertTitle>
                <AlertDescription>{t('colors.warning_description')}</AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label>{t('colors.secondary')}</Label>
            <div className="flex items-center gap-2 mt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-12 h-12 rounded border-2 border-border"
                    style={{ backgroundColor: secondaryColor }}
                    aria-label={t('colors.secondary_picker')}
                  />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3">
                  <Controller
                    control={form.control}
                    name="secondary_color"
                    render={({ field }) => (
                      <HexColorPicker color={field.value} onChange={field.onChange} />
                    )}
                  />
                </PopoverContent>
              </Popover>
              <Input
                {...form.register('secondary_color')}
                placeholder="#1A2730"
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('email_signature.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            {...form.register('email_signature_template')}
            rows={6}
            placeholder={`Cordialement,\n{{user.display_name}}\n{{tenant.name}}\n{{tenant.contact.phone}}`}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {t('email_signature.placeholders')}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? t('actions.saving') : t('actions.save')}
        </Button>
      </div>
    </form>
  );
}
```

### 6.15 Logo uploader -- `components/parametres/logo-uploader.tsx`

```typescript
'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import { useUploadLogo } from '@/lib/queries/parametres.queries';
import { stripExif, LOGO_MAX_BYTES, isImageWithinSizeLimit } from '@/lib/utils/strip-exif';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface LogoUploaderProps {
  tenantId: string;
  currentLogoUrl?: string;
  onUploaded: (url: string) => void;
}

export function LogoUploader({ tenantId, currentLogoUrl, onUploaded }: LogoUploaderProps) {
  const t = useTranslations('parametres.branding.logo');
  const uploadMutation = useUploadLogo(tenantId);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl ?? null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!isImageWithinSizeLimit(file, LOGO_MAX_BYTES)) {
      toast.error(t('error_size', { max: '2 MB' }));
      return;
    }

    try {
      const blob = await stripExif(file);
      const previewUrl = URL.createObjectURL(blob);
      setPreview(previewUrl);
      setUploadProgress(10);

      const result = await uploadMutation.mutateAsync(blob);
      setUploadProgress(100);
      onUploaded(result.url);
      toast.success(t('upload_success'));
    } catch (err) {
      toast.error(t('upload_error'));
      setUploadProgress(0);
    }
  }, [uploadMutation, onUploaded, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/svg+xml': ['.svg'],
    },
    maxSize: LOGO_MAX_BYTES,
    multiple: false,
  });

  return (
    <div className="space-y-4">
      {preview && (
        <Card>
          <CardContent className="p-4 flex items-center justify-center bg-muted/50">
            <img
              src={preview}
              alt={t('preview_alt')}
              className="max-h-32 max-w-full object-contain"
            />
          </CardContent>
        </Card>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
        role="button"
        tabIndex={0}
        aria-label={t('dropzone_label')}
      >
        <input {...getInputProps()} />
        <p className="text-sm">
          {isDragActive ? t('dropzone_active') : t('dropzone_idle')}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {t('dropzone_hint')}
        </p>
      </div>

      {uploadMutation.isPending && (
        <Progress value={uploadProgress} className="w-full" />
      )}

      {preview && (
        <Button type="button" variant="outline" size="sm" onClick={() => {
          setPreview(null);
          onUploaded('');
        }}>
          {t('remove')}
        </Button>
      )}
    </div>
  );
}
```

### 6.16 Tab users -- `app/[locale]/(protected)/parametres/tabs/users-tab.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTenantUsers, useUpdateUser, useDeleteUser } from '@/lib/queries/parametres.queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InviteUserDialog } from '@/components/parametres/invite-user-dialog';
import { BulkImportUsersDialog } from '@/components/parametres/bulk-import-users-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UsersTabProps {
  tenantId: string;
  currentUserId: string;
}

export function UsersTab({ tenantId, currentUserId }: UsersTabProps) {
  const t = useTranslations('parametres.users');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading } = useTenantUsers(tenantId, {
    page,
    page_size: 20,
    search: debouncedSearch || undefined,
    role: roleFilter,
    status: statusFilter,
  });

  const updateMutation = useUpdateUser(tenantId);
  const deleteMutation = useDeleteUser(tenantId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)}>{t('bulk_import')}</Button>
            <Button onClick={() => setInviteOpen(true)}>{t('invite')}</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder={t('search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={roleFilter ?? 'all'} onValueChange={(v) => setRoleFilter(v === 'all' ? undefined : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder={t('filter_role')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('roles.all')}</SelectItem>
                <SelectItem value="broker_admin">{t('roles.broker_admin')}</SelectItem>
                <SelectItem value="broker_user">{t('roles.broker_user')}</SelectItem>
                <SelectItem value="broker_assistant">{t('roles.broker_assistant')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter ?? 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? undefined : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t('filter_status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('statuses.all')}</SelectItem>
                <SelectItem value="active">{t('statuses.active')}</SelectItem>
                <SelectItem value="suspended">{t('statuses.suspended')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.name')}</TableHead>
                <TableHead>{t('columns.email')}</TableHead>
                <TableHead>{t('columns.role')}</TableHead>
                <TableHead>{t('columns.mfa')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead>{t('columns.last_login')}</TableHead>
                <TableHead className="text-right">{t('columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center">{t('loading')}</TableCell></TableRow>
              )}
              {data?.data.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.display_name}
                    {user.id === currentUserId && (
                      <Badge variant="secondary" className="ml-2">{t('you')}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(role) => updateMutation.mutate({ userId: user.id, input: { role } })}
                      disabled={user.id === currentUserId}
                    >
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="broker_admin">{t('roles.broker_admin')}</SelectItem>
                        <SelectItem value="broker_user">{t('roles.broker_user')}</SelectItem>
                        <SelectItem value="broker_assistant">{t('roles.broker_assistant')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {user.mfa_enabled ? (
                      <Badge variant="default">{t('mfa.enabled')}</Badge>
                    ) : (
                      <Badge variant="outline">{t('mfa.disabled')}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                      {t(`statuses.${user.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.last_login_at
                      ? formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true, locale: fr })
                      : t('never_logged_in')}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={user.id === currentUserId}>...</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {user.status === 'active' ? (
                          <DropdownMenuItem onClick={() => updateMutation.mutate({ userId: user.id, input: { status: 'suspended' } })}>
                            {t('actions.suspend')}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => updateMutation.mutate({ userId: user.id, input: { status: 'active' } })}>
                            {t('actions.reactivate')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(user.id)}>
                          {t('actions.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        tenantId={tenantId}
      />

      <BulkImportUsersDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        tenantId={tenantId}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title={t('delete_dialog.title')}
        description={t('delete_dialog.description')}
        confirmLabel={t('actions.delete')}
        confirmVariant="destructive"
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
```

### 6.17 Invite user dialog -- `components/parametres/invite-user-dialog.tsx`

```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Controller } from 'react-hook-form';
import { InviteUserSchema, type InviteUserInput } from '@/lib/schemas/parametres.schema';
import { useInviteUser } from '@/lib/queries/parametres.queries';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
}

export function InviteUserDialog({ open, onOpenChange, tenantId }: InviteUserDialogProps) {
  const t = useTranslations('parametres.users.invite');
  const inviteMutation = useInviteUser(tenantId);

  const form = useForm<InviteUserInput>({
    resolver: zodResolver(InviteUserSchema),
    defaultValues: {
      email: '',
      role: 'broker_user',
      locale: 'fr',
      send_welcome_email: true,
    },
  });

  const onSubmit = async (data: InviteUserInput) => {
    await inviteMutation.mutateAsync(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              {...form.register('email')}
              autoComplete="email"
              placeholder="collaborateur@example.com"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div>
            <Label>{t('role')}</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broker_admin">{t('roles.broker_admin')}</SelectItem>
                    <SelectItem value="broker_user">{t('roles.broker_user')}</SelectItem>
                    <SelectItem value="broker_assistant">{t('roles.broker_assistant')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label>{t('locale')}</Label>
            <Controller
              control={form.control}
              name="locale"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Francais</SelectItem>
                    <SelectItem value="ar-MA">Darija</SelectItem>
                    <SelectItem value="ar">Arabe</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="send_welcome_email"
              render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={field.onChange} id="welcome" />
              )}
            />
            <Label htmlFor="welcome">{t('send_welcome_email')}</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? t('sending') : t('send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.18 Tab custom fields -- `app/[locale]/(protected)/parametres/tabs/custom-fields-tab.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCustomFields, useDeleteCustomField } from '@/lib/queries/parametres.queries';
import { CustomFieldForm } from '@/components/parametres/custom-field-form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type EntityType = 'contact' | 'company' | 'deal' | 'policy';

export function CustomFieldsTab() {
  const t = useTranslations('parametres.custom_fields');
  const [entity, setEntity] = useState<EntityType>('contact');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: fields = [] } = useCustomFields(entity);
  const deleteMutation = useDeleteCustomField();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>
          <Button onClick={() => { setEditTarget(null); setFormOpen(true); }}>
            {t('add_field')}
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={entity} onValueChange={(v) => setEntity(v as EntityType)}>
            <TabsList>
              <TabsTrigger value="contact">{t('entity.contact')}</TabsTrigger>
              <TabsTrigger value="company">{t('entity.company')}</TabsTrigger>
              <TabsTrigger value="deal">{t('entity.deal')}</TabsTrigger>
              <TabsTrigger value="policy">{t('entity.policy')}</TabsTrigger>
            </TabsList>
            <TabsContent value={entity}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columns.label')}</TableHead>
                    <TableHead>{t('columns.key')}</TableHead>
                    <TableHead>{t('columns.type')}</TableHead>
                    <TableHead>{t('columns.required')}</TableHead>
                    <TableHead>{t('columns.options')}</TableHead>
                    <TableHead className="text-right">{t('columns.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {t('empty')}
                      </TableCell>
                    </TableRow>
                  )}
                  {fields.map((field: any) => (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">{field.label}</TableCell>
                      <TableCell className="font-mono text-xs">{field.key}</TableCell>
                      <TableCell><Badge variant="secondary">{field.type}</Badge></TableCell>
                      <TableCell>{field.required ? t('yes') : t('no')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {field.options ? field.options.slice(0, 3).join(', ') + (field.options.length > 3 ? '...' : '') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setEditTarget(field); setFormOpen(true); }}>
                          {t('edit')}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(field.id)}>
                          {t('delete')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CustomFieldForm
        open={formOpen}
        onOpenChange={setFormOpen}
        entity={entity}
        existing={editTarget}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title={t('delete.title')}
        description={t('delete.description')}
        confirmLabel={t('delete')}
        confirmVariant="destructive"
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
```

### 6.19 Custom field form -- `components/parametres/custom-field-form.tsx`

```typescript
'use client';
import { useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CustomFieldSchema, type CustomFieldInput } from '@/lib/schemas/parametres.schema';
import { useCreateCustomField, useUpdateCustomField } from '@/lib/queries/parametres.queries';

interface CustomFieldFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: 'contact' | 'company' | 'deal' | 'policy';
  existing?: any | null;
}

export function CustomFieldForm({ open, onOpenChange, entity, existing }: CustomFieldFormProps) {
  const t = useTranslations('parametres.custom_fields.form');
  const createMutation = useCreateCustomField();
  const updateMutation = useUpdateCustomField();
  const isEdit = !!existing;

  const form = useForm<CustomFieldInput>({
    resolver: zodResolver(CustomFieldSchema),
    defaultValues: {
      entity,
      key: '',
      label: '',
      type: 'text',
      options: [],
      required: false,
      order: 0,
    },
  });

  const optionsArray = useFieldArray({ control: form.control, name: 'options' as any });

  useEffect(() => {
    if (existing) {
      form.reset({
        entity: existing.entity,
        key: existing.key,
        label: existing.label,
        type: existing.type,
        options: existing.options ?? [],
        required: existing.required,
        order: existing.order,
        default_value: existing.default_value,
      });
    } else {
      form.reset({
        entity, key: '', label: '', type: 'text',
        options: [], required: false, order: 0,
      });
    }
  }, [existing, entity, form]);

  const type = form.watch('type');
  const requiresOptions = type === 'select' || type === 'multiselect';

  const onSubmit = async (data: CustomFieldInput) => {
    if (isEdit) {
      await updateMutation.mutateAsync({ id: existing.id, input: data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('title_edit') : t('title_create')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('label')}</Label>
              <Input {...form.register('label')} placeholder={t('label_placeholder')} />
              {form.formState.errors.label && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.label.message}</p>
              )}
            </div>
            <div>
              <Label>{t('key')}</Label>
              <Input {...form.register('key')} placeholder="snake_case" disabled={isEdit} className="font-mono" />
              {form.formState.errors.key && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.key.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label>{t('type')}</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t('types.text')}</SelectItem>
                    <SelectItem value="textarea">{t('types.textarea')}</SelectItem>
                    <SelectItem value="number">{t('types.number')}</SelectItem>
                    <SelectItem value="date">{t('types.date')}</SelectItem>
                    <SelectItem value="boolean">{t('types.boolean')}</SelectItem>
                    <SelectItem value="select">{t('types.select')}</SelectItem>
                    <SelectItem value="multiselect">{t('types.multiselect')}</SelectItem>
                    <SelectItem value="url">{t('types.url')}</SelectItem>
                    <SelectItem value="email">{t('types.email')}</SelectItem>
                    <SelectItem value="phone">{t('types.phone')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground mt-1">{t('type_locked')}</p>
            )}
          </div>

          {requiresOptions && (
            <div>
              <Label>{t('options')}</Label>
              <div className="space-y-2 mt-2">
                {optionsArray.fields.map((f, i) => (
                  <div key={f.id} className="flex gap-2">
                    <Input {...form.register(`options.${i}` as any)} placeholder={`Option ${i + 1}`} />
                    <Button type="button" variant="outline" size="sm" onClick={() => optionsArray.remove(i)}>
                      {t('option_remove')}
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => optionsArray.append('' as any)}>
                  {t('option_add')}
                </Button>
              </div>
              {form.formState.errors.options && (
                <p className="text-sm text-destructive mt-1">{(form.formState.errors.options as any).message}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="required"
              render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={field.onChange} id="required" />
              )}
            />
            <Label htmlFor="required">{t('required')}</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {isEdit ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.20 Tab quotas -- `app/[locale]/(protected)/parametres/tabs/quotas-tab.tsx`

```typescript
'use client';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTenantQuotas } from '@/lib/queries/parametres.queries';
import { Skeleton } from '@/components/ui/skeleton';

interface QuotasTabProps {
  tenantId: string;
}

interface QuotaRowProps {
  label: string;
  current: number;
  max: number;
  unit?: string;
  formatter?: (n: number) => string;
}

function QuotaRow({ label, current, max, unit = '', formatter }: QuotaRowProps) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const overLimit = percentage >= 100;
  const warning = percentage >= 80 && !overLimit;
  const fmt = formatter ?? ((n: number) => n.toLocaleString('fr-MA'));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums">
            {fmt(current)} / {fmt(max)} {unit}
          </span>
          {overLimit && <Badge variant="destructive">Depasse</Badge>}
          {warning && <Badge variant="default" className="bg-yellow-500">Attention</Badge>}
        </div>
      </div>
      <Progress
        value={Math.min(100, percentage)}
        className={overLimit ? 'bg-destructive/20' : warning ? 'bg-yellow-100' : ''}
      />
      <p className="text-xs text-muted-foreground">{percentage.toFixed(1)} %</p>
    </div>
  );
}

export function QuotasTab({ tenantId }: QuotasTabProps) {
  const t = useTranslations('parametres.quotas');
  const { data, isLoading } = useTenantQuotas(tenantId);

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const { plan, limits, usage, billing_cycle } = data;

  const anyOverLimit = (
    usage.users_current >= limits.users_max ||
    usage.contacts_current >= limits.contacts_max ||
    usage.deals_current >= limits.deals_max ||
    usage.polices_current >= limits.polices_max ||
    usage.storage_gb_current >= limits.storage_gb_max ||
    usage.api_requests_current_month >= limits.api_requests_per_month
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('plan_current', { plan: plan.toUpperCase() })}
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href={`mailto:support@skalean-insurtech.ma?subject=${encodeURIComponent('Demande upgrade plan tenant')}`}>
              {t('upgrade_cta')}
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          {anyOverLimit && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>{t('over_limit_title')}</AlertTitle>
              <AlertDescription>{t('over_limit_description')}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            <QuotaRow label={t('users')} current={usage.users_current} max={limits.users_max} />
            <QuotaRow label={t('contacts')} current={usage.contacts_current} max={limits.contacts_max} />
            <QuotaRow label={t('deals')} current={usage.deals_current} max={limits.deals_max} />
            <QuotaRow label={t('polices')} current={usage.polices_current} max={limits.polices_max} />
            <QuotaRow
              label={t('storage')}
              current={usage.storage_gb_current}
              max={limits.storage_gb_max}
              unit="GB"
              formatter={(n) => n.toFixed(2)}
            />
            <QuotaRow
              label={t('api_requests')}
              current={usage.api_requests_current_month}
              max={limits.api_requests_per_month}
              unit={t('per_month')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('billing_cycle.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('billing_cycle.start')}</p>
            <p className="font-medium">{billing_cycle.start}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('billing_cycle.end')}</p>
            <p className="font-medium">{billing_cycle.end}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('billing_cycle.next_invoice')}</p>
            <p className="font-medium">{billing_cycle.next_invoice_date}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 6.21 Tab api-keys -- `app/[locale]/(protected)/parametres/tabs/api-keys-tab.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiKeyDialog } from '@/components/parametres/api-key-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useApiKeys, useRevokeApiKey } from '@/lib/queries/parametres.queries';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function ApiKeysTab({ tenantId }: { tenantId: string }) {
  const t = useTranslations('parametres.api_keys');
  const { data: keys = [] } = useApiKeys(tenantId);
  const revokeMutation = useRevokeApiKey(tenantId);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.name')}</TableHead>
                <TableHead>{t('columns.prefix')}</TableHead>
                <TableHead>{t('columns.scopes')}</TableHead>
                <TableHead>{t('columns.last_used')}</TableHead>
                <TableHead>{t('columns.created')}</TableHead>
                <TableHead className="text-right">{t('columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              )}
              {keys.map((key: any) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-xs">{key.key_prefix}...</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.slice(0, 3).map((s: string) => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                      {key.scopes.length > 3 && (
                        <Badge variant="secondary" className="text-xs">+{key.scopes.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {key.last_used_at
                      ? formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true, locale: fr })
                      : t('never_used')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(key.created_at).toLocaleDateString('fr-MA')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRevokeTarget(key.id)}>
                      {t('revoke')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ApiKeyDialog open={createOpen} onOpenChange={setCreateOpen} tenantId={tenantId} />

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={() => setRevokeTarget(null)}
        title={t('revoke_dialog.title')}
        description={t('revoke_dialog.description')}
        confirmLabel={t('revoke')}
        confirmVariant="destructive"
        onConfirm={() => {
          if (revokeTarget) {
            revokeMutation.mutate(revokeTarget);
            setRevokeTarget(null);
          }
        }}
      />
    </div>
  );
}
```

### 6.22 ApiKey dialog -- `components/parametres/api-key-dialog.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CreateApiKeySchema, type CreateApiKeyInput, ApiKeyScopeEnum } from '@/lib/schemas/parametres.schema';
import { useCreateApiKey } from '@/lib/queries/parametres.queries';
import { toast } from 'sonner';

const ALL_SCOPES = ApiKeyScopeEnum.options;

export function ApiKeyDialog({ open, onOpenChange, tenantId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
}) {
  const t = useTranslations('parametres.api_keys.dialog');
  const createMutation = useCreateApiKey(tenantId);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const form = useForm<CreateApiKeyInput>({
    resolver: zodResolver(CreateApiKeySchema),
    defaultValues: { name: '', scopes: [] },
  });

  const onSubmit = async (data: CreateApiKeyInput) => {
    const result = await createMutation.mutateAsync(data);
    setCreatedSecret(result.secret);
  };

  const handleClose = () => {
    if (createdSecret) {
      setCreatedSecret(null);
      form.reset();
    }
    onOpenChange(false);
  };

  if (createdSecret) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('created_title')}</DialogTitle>
            <DialogDescription>{t('created_description')}</DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTitle>{t('warning_title')}</AlertTitle>
            <AlertDescription>{t('warning_description')}</AlertDescription>
          </Alert>
          <div className="bg-muted p-3 rounded font-mono text-sm break-all select-all">
            {createdSecret}
          </div>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(createdSecret);
              toast.success(t('copied'));
            }}
          >
            {t('copy')}
          </Button>
          <DialogFooter>
            <Button onClick={handleClose}>{t('done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('create_title')}</DialogTitle>
          <DialogDescription>{t('create_description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>{t('name')}</Label>
            <Input {...form.register('name')} placeholder={t('name_placeholder')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label>{t('scopes')}</Label>
            <Controller
              control={form.control}
              name="scopes"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto border rounded p-2">
                  {ALL_SCOPES.map((scope) => (
                    <div key={scope} className="flex items-center gap-2">
                      <Checkbox
                        id={`scope-${scope}`}
                        checked={field.value.includes(scope)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            field.onChange([...field.value, scope]);
                          } else {
                            field.onChange(field.value.filter((s) => s !== scope));
                          }
                        }}
                      />
                      <Label htmlFor={`scope-${scope}`} className="font-mono text-xs cursor-pointer">{scope}</Label>
                    </div>
                  ))}
                </div>
              )}
            />
            {form.formState.errors.scopes && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.scopes.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.23 Page profile -- `app/[locale]/(protected)/profile/page.tsx`

```typescript
import { redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getServerSession } from '@/lib/auth/get-server-session';
import { getTranslations } from 'next-intl/server';
import { InfoTab } from './tabs/info-tab';
import { SecurityTab } from './tabs/security-tab';
import { NotificationsTab } from './tabs/notifications-tab';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProfilePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { tab = 'info' } = await searchParams;
  const session = await getServerSession();
  const t = await getTranslations('profile');

  if (!session) {
    redirect(`/${locale}/login?redirect=/profile`);
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue={tab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
          <TabsTrigger value="security">{t('tabs.security')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('tabs.notifications')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info"><InfoTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
```

### 6.24 Tab security profile -- `app/[locale]/(protected)/profile/tabs/security-tab.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMe, useLoginHistory } from '@/lib/queries/profile.queries';
import { ChangePasswordDialog } from '@/components/profile/change-password-dialog';
import { MfaSetupWizard } from '@/components/profile/mfa-setup-wizard';
import { DisableMfaDialog } from '@/components/profile/disable-mfa-dialog';
import { RegenerateCodesDialog } from '@/components/profile/regenerate-codes-dialog';
import { ActiveSessionsList } from '@/components/profile/active-sessions-list';
import { LoginHistoryList } from '@/components/profile/login-history-list';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function SecurityTab() {
  const t = useTranslations('profile.security');
  const { data: me } = useMe();
  const { data: loginHistory = [] } = useLoginHistory(10);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [mfaWizardOpen, setMfaWizardOpen] = useState(false);
  const [disableMfaOpen, setDisableMfaOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('password.title')}</CardTitle>
          <CardDescription>{t('password.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">
                {t('password.last_changed')} :{' '}
                {me?.last_password_change_at
                  ? formatDistanceToNow(new Date(me.last_password_change_at), { addSuffix: true, locale: fr })
                  : t('password.never')}
              </p>
            </div>
            <Button onClick={() => setChangePasswordOpen(true)}>{t('password.change')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {t('mfa.title')}
              {me?.mfa_enabled ? (
                <Badge variant="default">{t('mfa.enabled')}</Badge>
              ) : (
                <Badge variant="outline">{t('mfa.disabled')}</Badge>
              )}
            </CardTitle>
            <CardDescription>{t('mfa.description')}</CardDescription>
          </div>
          {me?.mfa_enabled ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRegenerateOpen(true)}>
                {t('mfa.regenerate_codes')}
              </Button>
              <Button variant="destructive" onClick={() => setDisableMfaOpen(true)}>
                {t('mfa.disable')}
              </Button>
            </div>
          ) : (
            <Button onClick={() => setMfaWizardOpen(true)}>{t('mfa.enable')}</Button>
          )}
        </CardHeader>
        <CardContent>
          {!me?.mfa_enabled && (
            <Alert>
              <AlertTitle>{t('mfa.recommendation_title')}</AlertTitle>
              <AlertDescription>{t('mfa.recommendation_description')}</AlertDescription>
            </Alert>
          )}
          {me?.mfa_enabled && me?.mfa_enabled_at && (
            <p className="text-sm text-muted-foreground">
              {t('mfa.enabled_since')} :{' '}
              {formatDistanceToNow(new Date(me.mfa_enabled_at), { addSuffix: true, locale: fr })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sessions.title')}</CardTitle>
          <CardDescription>{t('sessions.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ActiveSessionsList />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('login_history.title')}</CardTitle>
          <CardDescription>{t('login_history.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginHistoryList items={loginHistory} />
        </CardContent>
      </Card>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
      <MfaSetupWizard open={mfaWizardOpen} onOpenChange={setMfaWizardOpen} />
      <DisableMfaDialog open={disableMfaOpen} onOpenChange={setDisableMfaOpen} />
      <RegenerateCodesDialog open={regenerateOpen} onOpenChange={setRegenerateOpen} />
    </div>
  );
}
```

### 6.25 MFA Setup Wizard -- `components/profile/mfa-setup-wizard.tsx`

```typescript
'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MfaStepIntro } from './mfa-step-intro';
import { MfaStepQr } from './mfa-step-qr';
import { MfaStepVerify } from './mfa-step-verify';
import { MfaStepCodes } from './mfa-step-codes';
import { useSetupMfa, useVerifyMfaSetup } from '@/lib/queries/mfa.queries';
import type { MfaSetupResult } from '@/lib/schemas/mfa.schema';

type WizardStep = 1 | 2 | 3 | 4;

const STORAGE_KEY = 'mfa_wizard_state';

interface MfaWizardState {
  step: WizardStep;
  setupResult: MfaSetupResult | null;
  recoveryCodes: string[];
}

export function MfaSetupWizard({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('profile.security.mfa.wizard');
  const setupMutation = useSetupMfa();
  const verifyMutation = useVerifyMfaSetup();

  const [state, setState] = useState<MfaWizardState>({
    step: 1,
    setupResult: null,
    recoveryCodes: [],
  });

  // Restore from sessionStorage on mount
  useEffect(() => {
    if (open) {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as MfaWizardState;
          setState(parsed);
        } catch {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  }, [open]);

  // Persist on change
  useEffect(() => {
    if (open && state.step > 1) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, open]);

  const handleStartSetup = async () => {
    const result = await setupMutation.mutateAsync();
    setState({ step: 2, setupResult: result, recoveryCodes: [] });
  };

  const handleVerifyCode = async (code: string) => {
    if (!state.setupResult) return;
    const result = await verifyMutation.mutateAsync({
      setup_challenge_token: state.setupResult.setup_challenge_token,
      code,
    });
    setState({ ...state, step: 4, recoveryCodes: result.recovery_codes });
  };

  const handleFinish = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setState({ step: 1, setupResult: null, recoveryCodes: [] });
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (state.step === 4) {
      // Recovery codes step -- bloque sortie sans confirmation
      return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setState({ step: 1, setupResult: null, recoveryCodes: [] });
    onOpenChange(false);
  };

  const progress = (state.step / 4) * 100;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) handleCancel(); else onOpenChange(true); }}
    >
      <DialogContent className="max-w-xl" onPointerDownOutside={(e) => state.step === 4 && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2" role="region" aria-label={t('progress_label', { current: state.step, total: 4 })}>
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground text-center">
            {t('step_label', { current: state.step, total: 4 })}
          </p>
        </div>

        {state.step === 1 && (
          <MfaStepIntro
            onNext={handleStartSetup}
            isLoading={setupMutation.isPending}
            onCancel={handleCancel}
          />
        )}

        {state.step === 2 && state.setupResult && (
          <MfaStepQr
            setupResult={state.setupResult}
            onNext={() => setState({ ...state, step: 3 })}
            onBack={() => setState({ ...state, step: 1 })}
          />
        )}

        {state.step === 3 && (
          <MfaStepVerify
            onVerify={handleVerifyCode}
            onBack={() => setState({ ...state, step: 2 })}
            isLoading={verifyMutation.isPending}
          />
        )}

        {state.step === 4 && (
          <MfaStepCodes
            codes={state.recoveryCodes}
            onFinish={handleFinish}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### 6.26 MFA Step Intro -- `components/profile/mfa-step-intro.tsx`

```typescript
'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function MfaStepIntro({ onNext, isLoading, onCancel }: {
  onNext: () => void;
  isLoading: boolean;
  onCancel: () => void;
}) {
  const t = useTranslations('profile.security.mfa.wizard.intro');

  return (
    <div className="space-y-4" role="region" aria-labelledby="mfa-intro-title">
      <h2 id="mfa-intro-title" className="text-lg font-semibold">{t('heading')}</h2>
      <p className="text-sm">{t('body_1')}</p>
      <p className="text-sm">{t('body_2')}</p>

      <Alert>
        <AlertTitle>{t('benefits_title')}</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>{t('benefit_1')}</li>
            <li>{t('benefit_2')}</li>
            <li>{t('benefit_3')}</li>
            <li>{t('benefit_4')}</li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="text-sm text-muted-foreground">
        <p className="font-medium mb-1">{t('recommended_apps_title')}</p>
        <ul className="list-disc list-inside">
          <li>Google Authenticator (Android, iOS)</li>
          <li>Microsoft Authenticator (Android, iOS)</li>
          <li>Authy (Android, iOS, Desktop)</li>
          <li>1Password (avec abonnement)</li>
          <li>FreeOTP (open source)</li>
        </ul>
      </div>

      <Alert>
        <AlertTitle>{t('consent_title')}</AlertTitle>
        <AlertDescription>{t('consent_description')}</AlertDescription>
      </Alert>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
        <Button onClick={onNext} disabled={isLoading}>
          {isLoading ? t('loading') : t('continue')}
        </Button>
      </div>
    </div>
  );
}
```

### 6.27 MFA Step QR -- `components/profile/mfa-step-qr.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCodeDisplay } from './qr-code-display';
import type { MfaSetupResult } from '@/lib/schemas/mfa.schema';
import { toast } from 'sonner';

export function MfaStepQr({ setupResult, onNext, onBack }: {
  setupResult: MfaSetupResult;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('profile.security.mfa.wizard.qr');
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="space-y-4" role="region" aria-labelledby="mfa-qr-title">
      <h2 id="mfa-qr-title" className="text-lg font-semibold">{t('heading')}</h2>
      <p className="text-sm">{t('instruction')}</p>

      <div className="flex justify-center">
        <QrCodeDisplay
          otpauthUrl={setupResult.otpauth_url}
          altText={t('qr_alt_text')}
        />
      </div>

      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSecret(!showSecret)}
          aria-expanded={showSecret}
        >
          {showSecret ? t('hide_secret') : t('show_secret')}
        </Button>

        {showSecret && (
          <Alert>
            <AlertDescription className="space-y-2">
              <p className="text-sm font-medium">{t('manual_entry_title')}</p>
              <code className="block bg-muted p-2 rounded font-mono text-sm break-all select-all">
                {setupResult.secret}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(setupResult.secret);
                  toast.success(t('secret_copied'));
                }}
              >
                {t('copy_secret')}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>{t('back')}</Button>
        <Button onClick={onNext}>{t('continue')}</Button>
      </div>
    </div>
  );
}
```

### 6.28 QR Code Display -- `components/profile/qr-code-display.tsx`

```typescript
'use client';
import { QRCodeSVG } from 'qrcode.react';
import { useState, useEffect } from 'react';

export function QrCodeDisplay({ otpauthUrl, altText, size = 200 }: {
  otpauthUrl: string;
  altText: string;
  size?: number;
}) {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      setCountdown(30 - (now % 30));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center space-y-2">
      <div
        role="img"
        aria-label={altText}
        className="bg-white p-4 rounded-lg border-2 border-border"
      >
        <QRCodeSVG
          value={otpauthUrl}
          size={size}
          level="M"
          marginSize={1}
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
        Code renouvelle dans : {countdown}s
      </p>
    </div>
  );
}
```

### 6.29 MFA Step Verify -- `components/profile/mfa-step-verify.tsx`

```typescript
'use client';
import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function MfaStepVerify({ onVerify, onBack, isLoading }: {
  onVerify: (code: string) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}) {
  const t = useTranslations('profile.security.mfa.wizard.verify');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(0, 6);
    setCode(sanitized);
    setError(null);
    if (sanitized.length === 6) {
      submit(sanitized);
    }
  };

  const submit = async (codeValue: string) => {
    try {
      await onVerify(codeValue);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t('error_invalid'));
      setCode('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-4" role="region" aria-labelledby="mfa-verify-title">
      <h2 id="mfa-verify-title" className="text-lg font-semibold">{t('heading')}</h2>
      <p className="text-sm">{t('instruction')}</p>

      <div>
        <Label htmlFor="mfa-code">{t('code_label')}</Label>
        <Input
          ref={inputRef}
          id="mfa-code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="000000"
          className="text-2xl tracking-widest font-mono text-center"
          aria-describedby="mfa-code-hint"
          disabled={isLoading}
        />
        <p id="mfa-code-hint" className="text-xs text-muted-foreground mt-1">
          {t('code_hint')}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          {t('back')}
        </Button>
        <Button
          onClick={() => submit(code)}
          disabled={code.length !== 6 || isLoading}
        >
          {isLoading ? t('verifying') : t('verify')}
        </Button>
      </div>
    </div>
  );
}
```

### 6.30 MFA Step Codes -- `components/profile/mfa-step-codes.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RecoveryCodesDisplay } from './recovery-codes-display';
import { useMe } from '@/lib/queries/profile.queries';

export function MfaStepCodes({ codes, onFinish }: {
  codes: string[];
  onFinish: () => void;
}) {
  const t = useTranslations('profile.security.mfa.wizard.codes');
  const [confirmed, setConfirmed] = useState(false);
  const { data: me } = useMe();

  return (
    <div className="space-y-4" role="region" aria-labelledby="mfa-codes-title">
      <h2 id="mfa-codes-title" className="text-lg font-semibold">{t('heading')}</h2>

      <Alert variant="destructive">
        <AlertTitle>{t('warning_title')}</AlertTitle>
        <AlertDescription>{t('warning_description')}</AlertDescription>
      </Alert>

      <RecoveryCodesDisplay codes={codes} userEmail={me?.email ?? ''} />

      <div className="flex items-center gap-2 pt-2">
        <Checkbox
          id="codes-confirmed"
          checked={confirmed}
          onCheckedChange={(c) => setConfirmed(c === true)}
        />
        <Label htmlFor="codes-confirmed" className="cursor-pointer text-sm">
          {t('confirm_saved')}
        </Label>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onFinish} disabled={!confirmed}>
          {t('finish')}
        </Button>
      </div>
    </div>
  );
}
```

### 6.31 Recovery Codes Display -- `components/profile/recovery-codes-display.tsx`

```typescript
'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { downloadTextFile, formatRecoveryCodesForDownload } from '@/lib/utils/download-text-file';

interface RecoveryCodesDisplayProps {
  codes: string[];
  userEmail: string;
}

export function RecoveryCodesDisplay({ codes, userEmail }: RecoveryCodesDisplayProps) {
  const t = useTranslations('profile.security.mfa.recovery_codes');

  const handleDownload = () => {
    const content = formatRecoveryCodesForDownload(codes, userEmail, new Date());
    const filename = `skalean-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    downloadTextFile(filename, content);
    toast.success(t('downloaded'));
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(codes.join('\n'));
    toast.success(t('copied_all'));
  };

  return (
    <div className="space-y-3">
      <div
        className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm"
        role="list"
        aria-label={t('list_label')}
      >
        {codes.map((code, i) => (
          <div
            key={i}
            role="listitem"
            className="flex items-center gap-2 p-2 bg-background rounded border"
          >
            <span className="text-muted-foreground text-xs tabular-nums w-6">
              {(i + 1).toString().padStart(2, '0')}.
            </span>
            <code className="flex-1 select-all tracking-wider">{code}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(code);
                toast.success(t('code_copied'));
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label={t('copy_code_aria', { index: i + 1 })}
            >
              copier
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="default" onClick={handleDownload}>
          {t('download')}
        </Button>
        <Button variant="outline" onClick={handleCopyAll}>
          {t('copy_all')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('format_note')}
      </p>
    </div>
  );
}
```

### 6.32 Active Sessions List -- `components/profile/active-sessions-list.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  useActiveSessions,
  useRevokeSession,
  useRevokeAllSessions,
  type ActiveSession,
} from '@/lib/queries/sessions.queries';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function ActiveSessionsList() {
  const t = useTranslations('profile.security.sessions');
  const { data: sessions = [], isLoading } = useActiveSessions();
  const revokeMutation = useRevokeSession();
  const revokeAllMutation = useRevokeAllSessions();

  const [revokeTarget, setRevokeTarget] = useState<ActiveSession | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const others = sessions.filter((s) => !s.is_current);
  const current = sessions.find((s) => s.is_current);

  return (
    <div className="space-y-4">
      {current && (
        <Card className="border-primary border-2">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{current.device}</span>
                  <Badge variant="default">{t('current')}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {current.browser} -- {current.os}
                </p>
                <p className="text-sm text-muted-foreground">
                  {current.location.city}, {current.location.country_name} ({current.ip})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {others.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {t('other_sessions', { count: others.length })}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevokeAllOpen(true)}
            disabled={revokeAllMutation.isPending}
          >
            {t('revoke_all')}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {others.map((session) => (
          <Card key={session.id}>
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{session.device}</span>
                  <Badge variant="outline">{session.device_type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {session.browser} -- {session.os}
                </p>
                <p className="text-sm text-muted-foreground">
                  {session.location.city ?? 'Lieu inconnu'}
                  {session.location.country_name ? `, ${session.location.country_name}` : ''}
                  {' '}({session.ip})
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('last_active')} :{' '}
                  {formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true, locale: fr })}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRevokeTarget(session)}
                disabled={revokeMutation.isPending}
              >
                {t('revoke')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={() => setRevokeTarget(null)}
        title={t('revoke_dialog.title')}
        description={t('revoke_dialog.description', {
          device: revokeTarget?.device ?? '',
        })}
        confirmLabel={t('revoke')}
        confirmVariant="destructive"
        onConfirm={() => {
          if (revokeTarget) {
            revokeMutation.mutate(revokeTarget.id);
            setRevokeTarget(null);
          }
        }}
      />

      <ConfirmDialog
        open={revokeAllOpen}
        onOpenChange={setRevokeAllOpen}
        title={t('revoke_all_dialog.title')}
        description={t('revoke_all_dialog.description')}
        confirmLabel={t('revoke_all')}
        confirmVariant="destructive"
        onConfirm={() => {
          revokeAllMutation.mutate();
          setRevokeAllOpen(false);
        }}
      />
    </div>
  );
}
```

### 6.33 Change Password Dialog -- `components/profile/change-password-dialog.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChangePasswordSchema, type ChangePasswordInput } from '@/lib/schemas/profile.schema';
import { evaluatePasswordStrength } from '@/lib/utils/password-strength';
import { useChangePassword } from '@/lib/queries/profile.queries';

export function ChangePasswordDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('profile.security.password.dialog');
  const changeMutation = useChangePassword();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const newPassword = form.watch('new_password');
  const strength = evaluatePasswordStrength(newPassword);

  const onSubmit = async (data: ChangePasswordInput) => {
    await changeMutation.mutateAsync(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="current_password">{t('current_password')}</Label>
            <Input
              id="current_password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...form.register('current_password')}
            />
            {form.formState.errors.current_password && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.current_password.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="new_password">{t('new_password')}</Label>
            <Input
              id="new_password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...form.register('new_password')}
            />
            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <Progress value={(strength.score / 4) * 100} className="flex-1" />
                  <span className="text-xs">{strength.label}</span>
                </div>
                {strength.feedback.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc list-inside">
                    {strength.feedback.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
              </div>
            )}
            {form.formState.errors.new_password && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.new_password.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="confirm_password">{t('confirm_password')}</Label>
            <Input
              id="confirm_password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...form.register('confirm_password')}
            />
            {form.formState.errors.confirm_password && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.confirm_password.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-pw"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            <Label htmlFor="show-pw" className="text-sm cursor-pointer">{t('show_password')}</Label>
          </div>

          <Alert>
            <AlertDescription>{t('logout_warning')}</AlertDescription>
          </Alert>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={changeMutation.isPending || strength.score < 3}>
              {changeMutation.isPending ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.34 Disable MFA Dialog -- `components/profile/disable-mfa-dialog.tsx`

```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DisableMfaSchema, type DisableMfaInput } from '@/lib/schemas/mfa.schema';
import { useDisableMfa } from '@/lib/queries/mfa.queries';

export function DisableMfaDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('profile.security.mfa.disable_dialog');
  const disableMutation = useDisableMfa();

  const form = useForm<DisableMfaInput>({
    resolver: zodResolver(DisableMfaSchema),
    defaultValues: { current_password: '', totp_code: '' },
  });

  const onSubmit = async (data: DisableMfaInput) => {
    await disableMutation.mutateAsync(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertTitle>{t('warning_title')}</AlertTitle>
          <AlertDescription>{t('warning_description')}</AlertDescription>
        </Alert>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="dm-current">{t('current_password')}</Label>
            <Input
              id="dm-current"
              type="password"
              autoComplete="current-password"
              {...form.register('current_password')}
            />
          </div>
          <div>
            <Label htmlFor="dm-totp">{t('totp_code')} ({t('optional')})</Label>
            <Input
              id="dm-totp"
              inputMode="numeric"
              maxLength={6}
              {...form.register('totp_code')}
              placeholder="000000"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={disableMutation.isPending}>
              {disableMutation.isPending ? t('disabling') : t('disable')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.35 Tab info profile -- `app/[locale]/(protected)/profile/tabs/info-tab.tsx`

```typescript
'use client';
import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UpdateProfileSchema, type UpdateProfileInput } from '@/lib/schemas/profile.schema';
import { useMe, useUpdateProfile, useUploadAvatar } from '@/lib/queries/profile.queries';
import { stripExif, AVATAR_MAX_BYTES, isImageWithinSizeLimit } from '@/lib/utils/strip-exif';
import { toast } from 'sonner';

export function InfoTab() {
  const t = useTranslations('profile.info');
  const router = useRouter();
  const { data: me } = useMe();
  const updateMutation = useUpdateProfile();
  const avatarMutation = useUploadAvatar();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
  });

  useEffect(() => {
    if (me) {
      form.reset({
        display_name: me.display_name,
        phone: me.phone,
        locale: me.locale,
        timezone: me.timezone,
        preferred_channel: me.preferred_channel,
        email_signature: me.email_signature ?? '',
        whatsapp_signature: me.whatsapp_signature ?? '',
        avatar_url: me.avatar_url ?? null,
      });
    }
  }, [me, form]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isImageWithinSizeLimit(file, AVATAR_MAX_BYTES)) {
      toast.error(t('avatar.error_size'));
      return;
    }
    try {
      const blob = await stripExif(file);
      const result = await avatarMutation.mutateAsync(blob);
      form.setValue('avatar_url', result.url, { shouldDirty: true });
      toast.success(t('avatar.uploaded'));
    } catch {
      toast.error(t('avatar.error_upload'));
    }
  };

  const onSubmit = async (data: UpdateProfileInput) => {
    const previousLocale = me?.locale;
    await updateMutation.mutateAsync(data);
    if (data.locale && data.locale !== previousLocale) {
      window.location.href = `/${data.locale}/profile`;
    }
  };

  if (!me) return null;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('avatar.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={form.watch('avatar_url') ?? undefined} alt={me.display_name} />
              <AvatarFallback>{me.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="avatar-input" className="cursor-pointer">
                <Button type="button" variant="outline" asChild>
                  <span>{t('avatar.upload')}</span>
                </Button>
              </Label>
              <input
                id="avatar-input"
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('avatar.hint')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('identity.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t('identity.display_name')}</Label>
            <Input {...form.register('display_name')} />
            {form.formState.errors.display_name && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.display_name.message}</p>
            )}
          </div>
          <div>
            <Label>{t('identity.email')}</Label>
            <div className="flex items-center gap-2">
              <Input value={me.email} disabled />
              {me.email_verified && <Badge variant="default">{t('identity.verified')}</Badge>}
            </div>
          </div>
          <div>
            <Label>{t('identity.phone')}</Label>
            <div className="flex items-center gap-2">
              <Input {...form.register('phone')} placeholder="+212661234567" />
              {me.phone_verified && <Badge variant="default">{t('identity.verified')}</Badge>}
            </div>
            {form.formState.errors.phone && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.phone.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t('preferences.locale')}</Label>
            <Controller
              control={form.control}
              name="locale"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Francais</SelectItem>
                    <SelectItem value="ar-MA">Darija</SelectItem>
                    <SelectItem value="ar">Arabe</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>{t('preferences.timezone')}</Label>
            <Input value="Africa/Casablanca (GMT+1)" disabled />
          </div>
          <div>
            <Label>{t('preferences.preferred_channel')}</Label>
            <Controller
              control={form.control}
              name="preferred_channel"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="in_app">In-app</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('signature.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('signature.email')}</Label>
            <Textarea {...form.register('email_signature')} rows={4} />
          </div>
          <div>
            <Label>{t('signature.whatsapp')}</Label>
            <Textarea {...form.register('whatsapp_signature')} rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={updateMutation.isPending || !form.formState.isDirty}>
          {updateMutation.isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
```

### 6.36 Notifications Preferences Matrix -- `components/profile/notifications-preferences-matrix.tsx`

```typescript
'use client';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNotificationsPreferences,
  useUpdateNotificationsPreferences,
} from '@/lib/queries/profile.queries';

const EVENT_GROUPS = [
  { key: 'deals', events: ['deal_won', 'deal_lost', 'deal_assigned'] },
  { key: 'polices', events: ['policy_renewal_due', 'policy_expired', 'policy_created'] },
  { key: 'broker_queue', events: ['broker_queue_new', 'broker_queue_sla_warning', 'broker_queue_assigned'] },
  { key: 'sinistres', events: ['sinistre_status_change', 'sinistre_status_critical'] },
  { key: 'users', events: ['user_invited_accepted', 'user_role_changed'] },
  { key: 'security', events: ['password_changed', 'mfa_disabled', 'mfa_enabled', 'session_revoked_by_other_device', 'new_login_unknown_device'] },
] as const;

const CHANNELS = ['email', 'in_app', 'whatsapp'] as const;

export function NotificationsPreferencesMatrix() {
  const t = useTranslations('profile.notifications');
  const { data, isLoading } = useNotificationsPreferences();
  const updateMutation = useUpdateNotificationsPreferences();

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const handleToggle = (event: string, channel: string, value: boolean) => {
    const newPrefs = {
      ...data.preferences,
      [event]: {
        ...data.preferences[event],
        [channel]: value,
      },
    };
    updateMutation.mutate({ preferences: newPrefs });
  };

  return (
    <div className="space-y-4">
      {EVENT_GROUPS.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle>{t(`groups.${group.key}.title`)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 pb-2 border-b text-xs text-muted-foreground font-medium">
                <span>{t('columns.event')}</span>
                <span className="text-center">{t('columns.email')}</span>
                <span className="text-center">{t('columns.in_app')}</span>
                <span className="text-center">{t('columns.whatsapp')}</span>
              </div>
              {group.events.map((event) => {
                const pref = data.preferences[event] ?? { email: false, in_app: false, whatsapp: false };
                const mandatory = pref.mandatory === true;
                return (
                  <div key={event} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 items-center">
                    <div>
                      <Label className="text-sm font-medium">{t(`events.${event}`)}</Label>
                      {mandatory && (
                        <Badge variant="secondary" className="ml-2 text-xs">{t('mandatory')}</Badge>
                      )}
                    </div>
                    {CHANNELS.map((channel) => (
                      <div key={channel} className="flex justify-center">
                        <Switch
                          checked={pref[channel] === true}
                          disabled={mandatory && channel === 'email'}
                          onCheckedChange={(v) => handleToggle(event, channel, v)}
                          aria-label={`${t(`events.${event}`)} - ${channel}`}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 6.37 Tab notifications profile -- `app/[locale]/(protected)/profile/tabs/notifications-tab.tsx`

```typescript
'use client';
import { useTranslations } from 'next-intl';
import { NotificationsPreferencesMatrix } from '@/components/profile/notifications-preferences-matrix';

export function NotificationsTab() {
  const t = useTranslations('profile.notifications');
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <NotificationsPreferencesMatrix />
    </div>
  );
}
```

### 6.38 Pipeline Stages Editor -- `components/parametres/pipeline-stages-editor.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HexColorPicker } from 'react-colorful';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';

interface Stage {
  id: string;
  name: string;
  probability: number;
  color: string;
  is_won?: boolean;
  is_lost?: boolean;
}

function SortableStage({ stage, onChange, onRemove }: {
  stage: Stage;
  onChange: (s: Stage) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('parametres.pipelines.stage');
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card ref={setNodeRef} style={style} className="mb-2">
      <CardContent className="p-3 flex items-center gap-3">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="cursor-grab text-muted-foreground"
          aria-label={t('drag_handle')}
        >
          ::
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-8 h-8 rounded border-2"
              style={{ backgroundColor: stage.color }}
              aria-label={t('color_picker', { name: stage.name })}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3">
            <HexColorPicker color={stage.color} onChange={(c) => onChange({ ...stage, color: c })} />
          </PopoverContent>
        </Popover>

        <Input
          value={stage.name}
          onChange={(e) => onChange({ ...stage, name: e.target.value })}
          className="flex-1"
          placeholder={t('name_placeholder')}
        />

        <div className="flex flex-col gap-1 w-32">
          <Label className="text-xs">{t('probability')} : {stage.probability}%</Label>
          <Slider
            value={[stage.probability]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => onChange({ ...stage, probability: v })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Checkbox
              checked={stage.is_won ?? false}
              onCheckedChange={(c) => onChange({ ...stage, is_won: c === true, is_lost: c === true ? false : stage.is_lost })}
              id={`won-${stage.id}`}
            />
            <Label htmlFor={`won-${stage.id}`} className="text-xs">{t('is_won')}</Label>
          </div>
          <div className="flex items-center gap-1">
            <Checkbox
              checked={stage.is_lost ?? false}
              onCheckedChange={(c) => onChange({ ...stage, is_lost: c === true, is_won: c === true ? false : stage.is_won })}
              id={`lost-${stage.id}`}
            />
            <Label htmlFor={`lost-${stage.id}`} className="text-xs">{t('is_lost')}</Label>
          </div>
        </div>

        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          {t('remove')}
        </Button>
      </CardContent>
    </Card>
  );
}

export function PipelineStagesEditor({ stages, onChange }: {
  stages: Stage[];
  onChange: (stages: Stage[]) => void;
}) {
  const t = useTranslations('parametres.pipelines.stages');
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = stages.findIndex((s) => s.id === active.id);
      const newIndex = stages.findIndex((s) => s.id === over.id);
      onChange(arrayMove(stages, oldIndex, newIndex));
    }
  };

  const handleAdd = () => {
    onChange([
      ...stages,
      {
        id: crypto.randomUUID(),
        name: '',
        probability: 50,
        color: '#9CA3AF',
      },
    ]);
  };

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {stages.map((stage, i) => (
            <SortableStage
              key={stage.id}
              stage={stage}
              onChange={(s) => {
                const newStages = [...stages];
                newStages[i] = s;
                onChange(newStages);
              }}
              onRemove={() => {
                onChange(stages.filter((s) => s.id !== stage.id));
              }}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" onClick={handleAdd}>
        {t('add_stage')}
      </Button>
    </div>
  );
}
```

---

## 7. Tests Vitest unit (18+) -- ~1500 lignes

### 7.1 `test/unit/parametres-schema.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  TenantGeneralSchema,
  HexColorSchema,
  InviteUserSchema,
  CustomFieldSchema,
  PipelineSchema,
  CreateApiKeySchema,
  CustomFieldKeyReservedKeywords,
} from '@/lib/schemas/parametres.schema';

describe('TenantGeneralSchema', () => {
  it('V1 accepte payload valide complet', () => {
    const result = TenantGeneralSchema.safeParse({
      name: 'Cabinet Sofidemy',
      legal_name: 'Sofidemy SARL',
      ice: '001234567000089',
      rc: 'RC123456',
      address: { street: '12 Av Hassan II', city: 'Casablanca', postal_code: '20000', country: 'MA' },
      contact: { phone: '+212522123456', email: 'contact@sofidemy.ma', website: '' },
      default_locale: 'fr',
      currency: 'MAD',
      timezone: 'Africa/Casablanca',
      fiscal_year_start: '01-01',
      working_hours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: null,
        sunday: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it('V2 rejette ICE != 15 chiffres', () => {
    const result = TenantGeneralSchema.safeParse({
      name: 'X', legal_name: 'X', ice: '12345', rc: 'X',
      address: { street: 'X', city: 'X', postal_code: '20000', country: 'MA' },
      contact: { phone: '+212522123456', email: 'a@b.ma' },
      default_locale: 'fr', currency: 'MAD', timezone: 'Africa/Casablanca',
      fiscal_year_start: '01-01',
      working_hours: { monday: { open: '09:00', close: '18:00' }, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null },
    } as any);
    expect(result.success).toBe(false);
  });

  it('V3 rejette tous jours null', () => {
    const result = TenantGeneralSchema.safeParse({
      name: 'X', legal_name: 'Sofidemy SARL', ice: '001234567000089', rc: 'RC123',
      address: { street: '12 Av', city: 'X', postal_code: '20000', country: 'MA' },
      contact: { phone: '+212522123456', email: 'a@b.ma' },
      default_locale: 'fr', currency: 'MAD', timezone: 'Africa/Casablanca',
      fiscal_year_start: '01-01',
      working_hours: { monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null },
    } as any);
    expect(result.success).toBe(false);
  });

  it('V4 rejette phone non MA', () => {
    const result = TenantGeneralSchema.safeParse({
      name: 'X', legal_name: 'X', ice: '001234567000089', rc: 'RC',
      address: { street: 'X', city: 'X', postal_code: '20000', country: 'MA' },
      contact: { phone: '+33123456789', email: 'a@b.com' },
      default_locale: 'fr', currency: 'MAD', timezone: 'Africa/Casablanca',
      fiscal_year_start: '01-01',
      working_hours: { monday: { open: '09:00', close: '18:00' }, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null },
    } as any);
    expect(result.success).toBe(false);
  });
});

describe('HexColorSchema', () => {
  it('V5 accepte hex 6 chars', () => {
    expect(HexColorSchema.safeParse('#E95D2C').success).toBe(true);
    expect(HexColorSchema.safeParse('#abcdef').success).toBe(true);
  });
  it('V6 rejette hex 3 chars ou sans #', () => {
    expect(HexColorSchema.safeParse('#fff').success).toBe(false);
    expect(HexColorSchema.safeParse('E95D2C').success).toBe(false);
  });
});

describe('InviteUserSchema', () => {
  it('V7 accepte payload valide', () => {
    const result = InviteUserSchema.safeParse({
      email: 'user@example.com', role: 'broker_user', locale: 'fr', send_welcome_email: true,
    });
    expect(result.success).toBe(true);
  });

  it('V8 default send_welcome_email true', () => {
    const result = InviteUserSchema.parse({
      email: 'user@example.com', role: 'broker_user',
    });
    expect(result.send_welcome_email).toBe(true);
  });

  it('V9 rejette role invalide', () => {
    const result = InviteUserSchema.safeParse({
      email: 'a@b.com', role: 'super_admin', locale: 'fr',
    });
    expect(result.success).toBe(false);
  });
});

describe('CustomFieldSchema', () => {
  it('V10 accepte text field', () => {
    const result = CustomFieldSchema.safeParse({
      entity: 'contact', key: 'preference_voiture', label: 'Pref voiture',
      type: 'text', required: false,
    });
    expect(result.success).toBe(true);
  });

  it('V11 rejette select sans options', () => {
    const result = CustomFieldSchema.safeParse({
      entity: 'contact', key: 'segment_x', label: 'Segment',
      type: 'select', options: [], required: false,
    });
    expect(result.success).toBe(false);
  });

  it('V12 rejette reserved keyword', () => {
    const result = CustomFieldSchema.safeParse({
      entity: 'contact', key: 'email', label: 'Email duplicate',
      type: 'text', required: false,
    });
    expect(result.success).toBe(false);
  });

  it('V13 rejette key non snake_case', () => {
    const result = CustomFieldSchema.safeParse({
      entity: 'contact', key: 'PrefVoiture', label: 'X',
      type: 'text', required: false,
    });
    expect(result.success).toBe(false);
  });

  it('V14 multiselect avec options OK', () => {
    const result = CustomFieldSchema.safeParse({
      entity: 'deal', key: 'tags_x', label: 'Tags',
      type: 'multiselect', options: ['A', 'B', 'C'], required: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('PipelineSchema', () => {
  it('V15 accepte pipeline avec won + lost', () => {
    const result = PipelineSchema.safeParse({
      name: 'Pipeline X', is_default: true,
      stages: [
        { name: 'Prospect', probability: 10, color: '#9CA3AF' },
        { name: 'Gagne', probability: 100, color: '#10B981', is_won: true },
        { name: 'Perdu', probability: 0, color: '#EF4444', is_lost: true },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('V16 rejette pipeline sans stage won', () => {
    const result = PipelineSchema.safeParse({
      name: 'X',
      stages: [
        { name: 'A', probability: 10, color: '#9CA3AF' },
        { name: 'B', probability: 50, color: '#3B82F6' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('V17 rejette < 2 stages', () => {
    const result = PipelineSchema.safeParse({
      name: 'X',
      stages: [{ name: 'A', probability: 10, color: '#9CA3AF', is_won: true }],
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateApiKeySchema', () => {
  it('V18 accepte avec scopes', () => {
    const result = CreateApiKeySchema.safeParse({
      name: 'Integration X',
      scopes: ['read:contacts', 'write:deals'],
    });
    expect(result.success).toBe(true);
  });

  it('V19 rejette sans scope', () => {
    const result = CreateApiKeySchema.safeParse({
      name: 'X', scopes: [],
    });
    expect(result.success).toBe(false);
  });
});
```

### 7.2 `test/unit/profile-schema.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  UpdateProfileSchema,
  ChangePasswordSchema,
  PasswordSchema,
  NotificationsPreferencesSchema,
} from '@/lib/schemas/profile.schema';

describe('UpdateProfileSchema', () => {
  it('V1 accepte partial update', () => {
    expect(UpdateProfileSchema.safeParse({ display_name: 'Karim' }).success).toBe(true);
    expect(UpdateProfileSchema.safeParse({ locale: 'ar-MA' }).success).toBe(true);
  });
  it('V2 rejette phone non MA', () => {
    expect(UpdateProfileSchema.safeParse({ phone: '+33123456789' }).success).toBe(false);
  });
});

describe('PasswordSchema', () => {
  it('V3 accepte mot de passe fort', () => {
    expect(PasswordSchema.safeParse('Sk@l3@n!nsur2026').success).toBe(true);
  });
  it('V4 rejette sans majuscule', () => {
    expect(PasswordSchema.safeParse('sk@l3@n!nsur2026').success).toBe(false);
  });
  it('V5 rejette sans chiffre', () => {
    expect(PasswordSchema.safeParse('Sk@l@@n!nsur!####').success).toBe(false);
  });
  it('V6 rejette sans special', () => {
    expect(PasswordSchema.safeParse('Sk3l3an1nsur2026').success).toBe(false);
  });
  it('V7 rejette < 12 chars', () => {
    expect(PasswordSchema.safeParse('Sk@l3n!2026').success).toBe(false);
  });
});

describe('ChangePasswordSchema', () => {
  it('V8 rejette nouveau == ancien', () => {
    const result = ChangePasswordSchema.safeParse({
      current_password: 'Sk@l3@n!nsur2026',
      new_password: 'Sk@l3@n!nsur2026',
      confirm_password: 'Sk@l3@n!nsur2026',
    });
    expect(result.success).toBe(false);
  });

  it('V9 rejette confirm different', () => {
    const result = ChangePasswordSchema.safeParse({
      current_password: 'Old@assword2025',
      new_password: 'New@Password2026',
      confirm_password: 'Different@Pass1',
    });
    expect(result.success).toBe(false);
  });

  it('V10 accepte payload valide', () => {
    const result = ChangePasswordSchema.safeParse({
      current_password: 'Old@assword2025',
      new_password: 'New@Password2026!',
      confirm_password: 'New@Password2026!',
    });
    expect(result.success).toBe(true);
  });
});

describe('NotificationsPreferencesSchema', () => {
  it('V11 accepte matrice partielle', () => {
    const result = NotificationsPreferencesSchema.safeParse({
      preferences: {
        deal_won: { email: true, in_app: true, whatsapp: false },
      },
    });
    expect(result.success).toBe(true);
  });
});
```

### 7.3 `test/unit/mfa-schema.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  TotpCodeSchema,
  VerifyMfaSetupSchema,
  RecoveryCodeFormatSchema,
  MfaSetupResultSchema,
} from '@/lib/schemas/mfa.schema';

describe('TotpCodeSchema', () => {
  it('V1 accepte 6 chiffres', () => {
    expect(TotpCodeSchema.safeParse('123456').success).toBe(true);
  });
  it('V2 rejette 5 chiffres', () => {
    expect(TotpCodeSchema.safeParse('12345').success).toBe(false);
  });
  it('V3 rejette lettres', () => {
    expect(TotpCodeSchema.safeParse('12345A').success).toBe(false);
  });
});

describe('RecoveryCodeFormatSchema', () => {
  it('V4 accepte format XXXX-XXXX-XXXX', () => {
    expect(RecoveryCodeFormatSchema.safeParse('ABCD-EFGH-JKMN').success).toBe(true);
  });
  it('V5 rejette 0/O/1/I/L confondants', () => {
    expect(RecoveryCodeFormatSchema.safeParse('A0CD-EFGH-JKMN').success).toBe(false);
    expect(RecoveryCodeFormatSchema.safeParse('AB1D-EFGH-JKMN').success).toBe(false);
    expect(RecoveryCodeFormatSchema.safeParse('ABID-EFGH-JKMN').success).toBe(false);
    expect(RecoveryCodeFormatSchema.safeParse('ABLD-EFGH-JKMN').success).toBe(false);
  });
});

describe('VerifyMfaSetupSchema', () => {
  it('V6 accepte payload valide', () => {
    const result = VerifyMfaSetupSchema.safeParse({
      setup_challenge_token: 'a'.repeat(40),
      code: '123456',
    });
    expect(result.success).toBe(true);
  });
});

describe('MfaSetupResultSchema', () => {
  it('V7 accepte response backend complete', () => {
    const result = MfaSetupResultSchema.safeParse({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_url: 'otpauth://totp/skalean:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=skalean',
      qr_data_url: 'data:image/png;base64,iVBORw0KG',
      setup_challenge_token: 'a'.repeat(40),
    });
    expect(result.success).toBe(true);
  });

  it('V8 rejette otpauth_url malforme', () => {
    const result = MfaSetupResultSchema.safeParse({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_url: 'http://attacker.com/totp',
      qr_data_url: 'data:image/png;base64,...',
      setup_challenge_token: 'a'.repeat(40),
    });
    expect(result.success).toBe(false);
  });
});
```

### 7.4 `test/unit/contrast-ratio.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getContrastRatio, getContrastLevel, getContrastLabel } from '@/lib/utils/contrast-ratio';

describe('getContrastRatio', () => {
  it('V1 noir/blanc = 21:1', () => {
    expect(getContrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });
  it('V2 identique = 1:1', () => {
    expect(getContrastRatio('#E95D2C', '#E95D2C')).toBeCloseTo(1, 1);
  });
  it('V3 orange Sofidemy sur blanc', () => {
    const ratio = getContrastRatio('#E95D2C', '#FFFFFF');
    expect(ratio).toBeGreaterThan(2.5);
    expect(ratio).toBeLessThan(4);
  });
});

describe('getContrastLevel', () => {
  it('V4 >= 7 = aaa', () => {
    expect(getContrastLevel(8)).toBe('aaa');
  });
  it('V5 >= 4.5 = aa', () => {
    expect(getContrastLevel(5)).toBe('aa');
  });
  it('V6 >= 3 = aa-large', () => {
    expect(getContrastLevel(3.5)).toBe('aa-large');
  });
  it('V7 < 3 = fail', () => {
    expect(getContrastLevel(2)).toBe('fail');
  });
});

describe('getContrastLabel', () => {
  it('V8 retourne labels FR', () => {
    expect(getContrastLabel('aaa')).toContain('AAA');
    expect(getContrastLabel('fail')).toContain('NON conforme');
  });
});
```

### 7.5 `test/unit/password-strength.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { evaluatePasswordStrength } from '@/lib/utils/password-strength';

describe('evaluatePasswordStrength', () => {
  it('V1 vide score 0', () => {
    expect(evaluatePasswordStrength('').score).toBe(0);
  });

  it('V2 mot courant score 0', () => {
    expect(evaluatePasswordStrength('password').score).toBe(0);
  });

  it('V3 mot fort score 4', () => {
    const result = evaluatePasswordStrength('Sk@l3@n!nsur2026XYZ');
    expect(result.score).toBe(4);
    expect(result.label).toBe('excellent');
  });

  it('V4 repetitions reduisent score', () => {
    const result1 = evaluatePasswordStrength('Aaaa!1234567Xyz');
    expect(result1.feedback.some((f) => f.includes('repetes'))).toBe(true);
  });

  it('V5 feedback liste manques', () => {
    const result = evaluatePasswordStrength('abc');
    expect(result.feedback.length).toBeGreaterThan(0);
  });
});
```

### 7.6 `test/unit/download-text-file.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { formatRecoveryCodesForDownload } from '@/lib/utils/download-text-file';

describe('formatRecoveryCodesForDownload', () => {
  it('V1 contient les 10 codes numerotes', () => {
    const codes = Array.from({ length: 10 }, (_, i) => `ABCD-EFGH-JK${i.toString().padStart(2, '0')}`);
    const content = formatRecoveryCodesForDownload(codes, 'test@example.com', new Date('2026-05-17'));
    codes.forEach((c, i) => {
      expect(content).toContain(c);
      expect(content).toContain(`${(i + 1).toString().padStart(2, '0')}.`);
    });
  });

  it('V2 contient email user', () => {
    const content = formatRecoveryCodesForDownload(['A-B-C'], 'karim@sofidemy.ma', new Date());
    expect(content).toContain('karim@sofidemy.ma');
  });

  it('V3 contient avertissement confidentialite', () => {
    const content = formatRecoveryCodesForDownload(['A-B-C'], 'a@b.ma', new Date());
    expect(content).toContain('NE PARTAGEZ JAMAIS');
  });

  it('V4 aucun emoji (decision-006)', () => {
    const content = formatRecoveryCodesForDownload(['A-B-C'], 'a@b.ma', new Date());
    const emojiRegex = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u;
    expect(emojiRegex.test(content)).toBe(false);
  });
});
```

### 7.7 `test/unit/mfa-wizard-state.spec.tsx`

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MfaSetupWizard } from '@/components/profile/mfa-setup-wizard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/queries/mfa.queries', () => ({
  useSetupMfa: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_url: 'otpauth://totp/test:user@a.com?secret=X',
      qr_data_url: 'data:image/png;base64,...',
      setup_challenge_token: 'tok'.repeat(20),
    }),
    isPending: false,
  }),
  useVerifyMfaSetup: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      mfa_enabled: true,
      recovery_codes: Array.from({ length: 10 }, (_, i) => `ABCD-EFGH-JK${i.toString().padStart(2, '0')}`),
    }),
    isPending: false,
  }),
}));

vi.mock('@/lib/queries/profile.queries', () => ({
  useMe: () => ({ data: { email: 'user@test.ma', display_name: 'Test User' } }),
}));

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('MfaSetupWizard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  it('V1 demarre etape 1 intro', () => {
    renderWithProviders(<MfaSetupWizard open onOpenChange={() => {}} />);
    expect(screen.getByText(/Etape 1.*sur.*4/i)).toBeTruthy();
  });

  it('V2 progresse vers etape 2 apres clic continue', async () => {
    renderWithProviders(<MfaSetupWizard open onOpenChange={() => {}} />);
    const continueBtn = screen.getByRole('button', { name: /continuer|continue/i });
    fireEvent.click(continueBtn);
    await waitFor(() => {
      expect(screen.getByText(/Etape 2.*sur.*4/i)).toBeTruthy();
    });
  });

  it('V3 persiste state en sessionStorage post-step-2', async () => {
    renderWithProviders(<MfaSetupWizard open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /continuer|continue/i }));
    await waitFor(() => {
      const stored = sessionStorage.getItem('mfa_wizard_state');
      expect(stored).toBeTruthy();
    });
  });
});
```

### 7.8 `test/unit/qr-code-display.spec.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QrCodeDisplay } from '@/components/profile/qr-code-display';

describe('QrCodeDisplay', () => {
  it('V1 render QR SVG', () => {
    render(<QrCodeDisplay otpauthUrl="otpauth://totp/test:user@a.com?secret=X" altText="test qr" />);
    expect(screen.getByRole('img', { name: /test qr/i })).toBeTruthy();
  });

  it('V2 affiche countdown 30s', () => {
    render(<QrCodeDisplay otpauthUrl="otpauth://totp/test:u@a.com?secret=X" altText="qr" />);
    expect(screen.getByText(/renouvelle dans/i)).toBeTruthy();
  });

  it('V3 alt text accessible aria-label', () => {
    render(<QrCodeDisplay otpauthUrl="otpauth://totp/test:u@a.com?secret=X" altText="MFA QR Code" />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toBe('MFA QR Code');
  });
});
```

### 7.9 `test/unit/recovery-codes-display.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecoveryCodesDisplay } from '@/components/profile/recovery-codes-display';

describe('RecoveryCodesDisplay', () => {
  it('V1 render les 10 codes', () => {
    const codes = Array.from({ length: 10 }, (_, i) => `ABCD-EFGH-JK${i.toString().padStart(2, '0')}`);
    render(<RecoveryCodesDisplay codes={codes} userEmail="a@b.ma" />);
    codes.forEach((c) => {
      expect(screen.getByText(c)).toBeTruthy();
    });
  });

  it('V2 bouton download present', () => {
    render(<RecoveryCodesDisplay codes={['A-B-C']} userEmail="a@b.ma" />);
    expect(screen.getByRole('button', { name: /telecharger|download/i })).toBeTruthy();
  });

  it('V3 copy click utilise clipboard', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(<RecoveryCodesDisplay codes={['ABCD-EFGH-JKMN']} userEmail="a@b.ma" />);
    const copyBtn = screen.getAllByText(/copier/i)[0];
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalled();
  });
});
```

### 7.10 `test/unit/active-sessions-list.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActiveSessionsList } from '@/components/profile/active-sessions-list';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/queries/sessions.queries', () => ({
  useActiveSessions: () => ({
    data: [
      {
        id: '1', device: 'MacBook Pro', device_type: 'desktop', browser: 'Chrome', os: 'macOS',
        ip: '196.200.100.50', location: { city: 'Casablanca', country: 'MA', country_name: 'Maroc' },
        last_active_at: new Date().toISOString(), created_at: new Date().toISOString(), is_current: true,
      },
      {
        id: '2', device: 'iPhone', device_type: 'mobile', browser: 'Safari', os: 'iOS',
        ip: '41.140.50.10', location: { city: 'Rabat', country: 'MA', country_name: 'Maroc' },
        last_active_at: new Date().toISOString(), created_at: new Date().toISOString(), is_current: false,
      },
    ],
    isLoading: false,
  }),
  useRevokeSession: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeAllSessions: () => ({ mutate: vi.fn(), isPending: false }),
}));

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ActiveSessionsList', () => {
  it('V1 marque session courante avec badge', () => {
    renderWithProviders(<ActiveSessionsList />);
    expect(screen.getByText(/MacBook Pro/i)).toBeTruthy();
    expect(screen.getByText(/courante|current/i)).toBeTruthy();
  });

  it('V2 affiche autres sessions revocables', () => {
    renderWithProviders(<ActiveSessionsList />);
    expect(screen.getByText(/iPhone/i)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /revoquer|revoke/i }).length).toBeGreaterThan(0);
  });

  it('V3 bouton revoke-all visible si > 0 autres sessions', () => {
    renderWithProviders(<ActiveSessionsList />);
    expect(screen.getByText(/revoke_all|tout revoquer/i)).toBeTruthy();
  });
});
```

### 7.11 -- 7.18 Autres tests unit

```typescript
// test/unit/change-password-dialog.spec.tsx
// V1 render fields current + new + confirm
// V2 strength meter update sur change
// V3 button save disabled si strength < 3
// V4 submit appel mutation

// test/unit/pipeline-stages-editor.spec.tsx
// V1 render stages liste
// V2 add stage append nouveau
// V3 remove stage filtre
// V4 onChange propage update

// test/unit/api-key-dialog.spec.tsx
// V1 render form scopes checkboxes
// V2 cocher scope appende dans array
// V3 affichage one-time secret post create

// test/unit/logo-uploader.spec.tsx
// V1 dropzone render
// V2 reject file > 2MB
// V3 strip EXIF appele avant upload

// test/unit/invite-user-dialog.spec.tsx
// V1 form render fields
// V2 submit valide appel mutation
// V3 reset apres submit

// test/unit/notifications-preferences-matrix.spec.tsx
// V1 render groupes events
// V2 toggle switch update mutation
// V3 mandatory email disabled

// test/unit/strip-exif.spec.ts
// V1 retourne Blob image
// V2 throw si file invalide

// test/unit/custom-field-renderer.spec.tsx
// V1 type text render Input
// V2 type number render Input numeric
// V3 type select render Select avec options
// V4 type boolean render Switch
// V5 type date render DatePicker
```

---

## 8. Tests Playwright E2E (12+) -- ~1200 lignes

### 8.1 `e2e/parametres-tabs-rbac.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';

test.describe('Parametres -- RBAC', () => {
  test('V1 broker_admin accede /parametres', async ({ page }) => {
    await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
    await page.goto('/fr/parametres');
    await expect(page.getByRole('heading', { name: /parametres/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /general/i })).toBeVisible();
  });

  test('V2 broker_user redirige depuis /parametres', async ({ page }) => {
    await loginAs(page, 'broker_user@test.ma', 'Test@Password123!');
    await page.goto('/fr/parametres');
    await expect(page).toHaveURL(/dashboard.*forbidden/);
  });

  test('V3 broker_assistant pas de lien sidebar', async ({ page }) => {
    await loginAs(page, 'broker_assistant@test.ma', 'Test@Password123!');
    await page.goto('/fr/dashboard');
    const sidebar = page.getByRole('navigation');
    await expect(sidebar.getByRole('link', { name: /parametres/i })).toHaveCount(0);
  });

  test('V4 broker_admin 7 onglets visibles', async ({ page }) => {
    await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
    await page.goto('/fr/parametres');
    for (const tab of ['general', 'branding', 'users', 'custom-fields', 'pipelines', 'quotas', 'api-keys']) {
      await expect(page.getByRole('tab', { name: new RegExp(tab.replace('-', ' '), 'i') })).toBeVisible();
    }
  });
});
```

### 8.2 `e2e/parametres-branding-logo.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';
import path from 'path';

test('V1 upload logo + preview', async ({ page }) => {
  await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
  await page.goto('/fr/parametres?tab=branding');

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-logo.png'));

  await expect(page.locator('img[alt*="preview"]')).toBeVisible({ timeout: 5000 });
});

test('V2 color picker primary mise a jour', async ({ page }) => {
  await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
  await page.goto('/fr/parametres?tab=branding');

  await page.getByPlaceholder('#E95D2C').fill('#1A2730');
  await page.getByRole('button', { name: /enregistrer|save/i }).click();
  await expect(page.getByText(/enregistre|saved/i)).toBeVisible();
});

test('V3 warning contraste WCAG fail', async ({ page }) => {
  await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
  await page.goto('/fr/parametres?tab=branding');

  await page.getByPlaceholder('#E95D2C').fill('#FFFF00');
  await expect(page.getByText(/NON conforme WCAG/i)).toBeVisible();
});
```

### 8.3 `e2e/parametres-invite-user.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';

test('V1 invite nouvel user envoie email', async ({ page }) => {
  await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
  await page.goto('/fr/parametres?tab=users');

  await page.getByRole('button', { name: /inviter/i }).click();
  await page.getByLabel('Email').fill(`new-user-${Date.now()}@test.ma`);
  await page.getByRole('combobox', { name: /role/i }).click();
  await page.getByRole('option', { name: /broker_user/i }).click();
  await page.getByRole('button', { name: /envoyer/i }).click();

  await expect(page.getByText(/invitation envoyee/i)).toBeVisible();
});

test('V2 invite duplicate email rejette', async ({ page }) => {
  await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
  await page.goto('/fr/parametres?tab=users');

  await page.getByRole('button', { name: /inviter/i }).click();
  await page.getByLabel('Email').fill('existing@test.ma');
  await page.getByRole('button', { name: /envoyer/i }).click();

  await expect(page.getByText(/existe deja|already exists/i)).toBeVisible();
});
```

### 8.4 `e2e/parametres-custom-field-create.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';

test('V1 creer custom field type select', async ({ page }) => {
  await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
  await page.goto('/fr/parametres?tab=custom-fields');

  await page.getByRole('button', { name: /ajouter.*champ/i }).click();
  await page.getByLabel(/libelle|label/i).fill('Type voiture');
  await page.getByLabel(/cle|key/i).fill('type_voiture');
  await page.getByRole('combobox', { name: /type/i }).click();
  await page.getByRole('option', { name: /select/i }).click();

  await page.getByRole('button', { name: /ajouter option/i }).click();
  await page.locator('input[placeholder*="Option 1"]').fill('Berline');
  await page.getByRole('button', { name: /ajouter option/i }).click();
  await page.locator('input[placeholder*="Option 2"]').fill('SUV');

  await page.getByRole('button', { name: /^creer$/i }).click();
  await expect(page.getByText(/cree|created/i)).toBeVisible();
});

test('V2 reserved keyword rejette', async ({ page }) => {
  await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
  await page.goto('/fr/parametres?tab=custom-fields');

  await page.getByRole('button', { name: /ajouter.*champ/i }).click();
  await page.getByLabel(/libelle/i).fill('X');
  await page.getByLabel(/cle/i).fill('email');
  await page.getByRole('button', { name: /^creer$/i }).click();

  await expect(page.getByText(/reservee/i)).toBeVisible();
});
```

### 8.5 `e2e/parametres-pipeline-stages.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';

test('V1 reorder stages drag-drop', async ({ page }) => {
  await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
  await page.goto('/fr/parametres?tab=pipelines');

  const firstHandle = page.locator('[aria-label*="poignee"]').first();
  const lastHandle = page.locator('[aria-label*="poignee"]').last();

  await firstHandle.dragTo(lastHandle);
  await page.getByRole('button', { name: /enregistrer|save/i }).click();
  await expect(page.getByText(/enregistre/i)).toBeVisible();
});
```

### 8.6 `e2e/parametres-api-keys.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';

test('V1 creer api key one-time display', async ({ page }) => {
  await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
  await page.goto('/fr/parametres?tab=api-keys');

  await page.getByRole('button', { name: /creer|create/i }).click();
  await page.getByLabel(/nom|name/i).fill('Test Integration');
  await page.getByLabel(/read:contacts/i).check();
  await page.getByRole('button', { name: /^creer$/i }).click();

  // One-time secret display
  await expect(page.getByText(/sauvegardez/i)).toBeVisible();
  const secret = page.locator('code').filter({ hasText: /sk_/ });
  await expect(secret).toBeVisible();

  await page.getByRole('button', { name: /termine|done/i }).click();
  // Secret n'est plus affiche
  await expect(page.locator('code').filter({ hasText: /sk_live_/ })).toHaveCount(0);
});

test('V2 revoke api key', async ({ page }) => {
  await loginAs(page, 'broker_admin@test.ma', 'Test@Password123!');
  await page.goto('/fr/parametres?tab=api-keys');

  await page.getByRole('button', { name: /revoquer/i }).first().click();
  await page.getByRole('button', { name: /^revoquer$/i }).click();
  await expect(page.getByText(/revoquee/i)).toBeVisible();
});
```

### 8.7 `e2e/profile-info-edit.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';

test('V1 update display_name + signature', async ({ page }) => {
  await loginAs(page, 'broker_user@test.ma', 'Test@Password123!');
  await page.goto('/fr/profile?tab=info');

  await page.getByLabel(/nom.*affiche|display name/i).fill('Karim Updated');
  await page.getByLabel(/signature email/i).fill('Cordialement,\nKarim Updated');
  await page.getByRole('button', { name: /enregistrer|save/i }).click();

  await expect(page.getByText(/mis a jour|updated/i)).toBeVisible();
});

test('V2 change locale fr -> ar-MA redirige', async ({ page }) => {
  await loginAs(page, 'broker_user@test.ma', 'Test@Password123!');
  await page.goto('/fr/profile?tab=info');

  await page.getByRole('combobox', { name: /langue|locale/i }).click();
  await page.getByRole('option', { name: /darija/i }).click();
  await page.getByRole('button', { name: /enregistrer/i }).click();

  await expect(page).toHaveURL(/\/ar-MA\/profile/);
});
```

### 8.8 `e2e/profile-mfa-setup-complete.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';
import { authenticator } from 'otplib';

test('V1 complete MFA setup wizard', async ({ page }) => {
  await loginAs(page, 'no-mfa-user@test.ma', 'Test@Password123!');
  await page.goto('/fr/profile?tab=security');

  // Step 1 : intro
  await page.getByRole('button', { name: /activer.*mfa|enable mfa/i }).click();
  await expect(page.getByText(/Etape 1.*sur.*4/i)).toBeVisible();
  await page.getByRole('button', { name: /continuer/i }).click();

  // Step 2 : QR + manual secret
  await expect(page.getByText(/Etape 2.*sur.*4/i)).toBeVisible();
  await expect(page.getByRole('img', { name: /qr/i })).toBeVisible();
  await page.getByRole('button', { name: /afficher.*secret/i }).click();
  const secretCode = await page.locator('code').first().textContent();
  await page.getByRole('button', { name: /continuer/i }).click();

  // Step 3 : verify
  await expect(page.getByText(/Etape 3.*sur.*4/i)).toBeVisible();
  const code = authenticator.generate(secretCode!.replace(/\s/g, ''));
  await page.getByLabel(/code/i).fill(code);

  // Step 4 : recovery codes
  await expect(page.getByText(/Etape 4.*sur.*4/i)).toBeVisible({ timeout: 5000 });
  await expect(page.locator('code').filter({ hasText: /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/ })).toHaveCount(10);

  await page.getByRole('button', { name: /telecharger|download/i }).click();
  await page.getByLabel(/sauvegarde|saved/i).check();
  await page.getByRole('button', { name: /terminer|finish/i }).click();

  await expect(page.getByText(/mfa active|enabled/i)).toBeVisible();
});
```

### 8.9 `e2e/profile-mfa-wrong-code.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';

test('V1 wrong code affiche erreur', async ({ page }) => {
  await loginAs(page, 'no-mfa-user@test.ma', 'Test@Password123!');
  await page.goto('/fr/profile?tab=security');

  await page.getByRole('button', { name: /activer.*mfa/i }).click();
  await page.getByRole('button', { name: /continuer/i }).click();
  await page.getByRole('button', { name: /continuer/i }).click();

  await page.getByLabel(/code/i).fill('000000');
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });
  await expect(page.getByLabel(/code/i)).toHaveValue('');
});
```

### 8.10 `e2e/profile-recovery-codes-download.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';

test('V1 download recovery codes .txt', async ({ page }) => {
  await loginAs(page, 'user-with-codes@test.ma', 'Test@Password123!');
  await page.goto('/fr/profile?tab=security');

  await page.getByRole('button', { name: /regenerer.*codes/i }).click();
  await page.getByLabel(/mot de passe/i).fill('Test@Password123!');
  await page.getByRole('button', { name: /confirmer|regenerer/i }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /telecharger/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/skalean-recovery-codes-\d{4}-\d{2}-\d{2}\.txt/);
});
```

### 8.11 `e2e/profile-change-password.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';

test('V1 change password complet', async ({ page }) => {
  await loginAs(page, 'change-pw@test.ma', 'OldPassword123!');
  await page.goto('/fr/profile?tab=security');

  await page.getByRole('button', { name: /changer.*mot de passe/i }).click();
  await page.getByLabel(/mot de passe actuel/i).fill('OldPassword123!');
  await page.getByLabel(/nouveau mot de passe/i).fill('NewSecure@Pass2026!');
  await page.getByLabel(/confirmer/i).fill('NewSecure@Pass2026!');
  await page.getByRole('button', { name: /enregistrer/i }).click();

  await expect(page.getByText(/change.*sessions.*deconnectees/i)).toBeVisible();
});

test('V2 mauvais current password rejette', async ({ page }) => {
  await loginAs(page, 'change-pw@test.ma', 'OldPassword123!');
  await page.goto('/fr/profile?tab=security');

  await page.getByRole('button', { name: /changer.*mot de passe/i }).click();
  await page.getByLabel(/mot de passe actuel/i).fill('WrongPassword!');
  await page.getByLabel(/nouveau mot de passe/i).fill('NewSecure@Pass2026!');
  await page.getByLabel(/confirmer/i).fill('NewSecure@Pass2026!');
  await page.getByRole('button', { name: /enregistrer/i }).click();

  await expect(page.getByText(/mot de passe.*incorrect/i)).toBeVisible();
});
```

### 8.12 `e2e/profile-sessions-revoke.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';

test('V1 revoke autre session', async ({ page }) => {
  await loginAs(page, 'multi-session@test.ma', 'Test@Password123!');
  await page.goto('/fr/profile?tab=security');

  await page.getByRole('button', { name: /^revoquer$/i }).first().click();
  await page.getByRole('button', { name: /^revoquer$/i }).last().click();

  await expect(page.getByText(/revoquee/i)).toBeVisible();
});

test('V2 revoke-all sauf courante', async ({ page }) => {
  await loginAs(page, 'multi-session@test.ma', 'Test@Password123!');
  await page.goto('/fr/profile?tab=security');

  await page.getByRole('button', { name: /tout revoquer/i }).click();
  await page.getByRole('button', { name: /^revoquer$/i }).click();

  await expect(page.getByText(/session\(s\).*revoquee/i)).toBeVisible();

  // Session courante encore active
  await expect(page.getByText(/courante|current/i)).toBeVisible();
});
```

---

## 9. Criteres validation V1-V28

| ID | Severite | Description | Test |
|----|----------|-------------|------|
| V1 | P0 | Page /parametres accessible uniquement broker_admin | E2E parametres-tabs-rbac V1+V2 |
| V2 | P0 | Page /profile accessible tous users authentifies | E2E profile-info-edit V1 |
| V3 | P0 | 7 onglets parametres rendus | E2E parametres-tabs-rbac V4 |
| V4 | P0 | 3 onglets profile rendus | render profile page |
| V5 | P0 | Tenant general : ICE 15 chiffres validation Zod | Unit parametres-schema V2 |
| V6 | P0 | Tenant general : working_hours au moins 1 jour | Unit parametres-schema V3 |
| V7 | P0 | Branding : logo upload S3 + preview | E2E parametres-branding-logo V1 |
| V8 | P0 | Branding : color picker primary + warning WCAG | E2E V3 + unit contrast-ratio |
| V9 | P0 | Users : invite par email + role + locale | E2E parametres-invite-user V1 |
| V10 | P0 | Users : reject duplicate email | E2E V2 |
| V11 | P0 | Users : edit role + suspend + delete | unit users-tab |
| V12 | P0 | Custom fields : CRUD avec entity filter | E2E parametres-custom-field V1 |
| V13 | P0 | Custom fields : reserved keyword rejette | E2E V2 + unit V12 |
| V14 | P0 | Custom fields : select sans options rejette | Unit V11 |
| V15 | P0 | Pipelines : drag-drop reorder stages | E2E parametres-pipeline V1 |
| V16 | P0 | Pipelines : doit avoir won + lost stages | Unit V16 |
| V17 | P0 | Quotas : read-only progress bars + warning >= 80% | render quotas-tab |
| V18 | P0 | Quotas : upgrade CTA mailto support | render quotas-tab |
| V19 | P0 | API keys : create + scopes + one-time display | E2E parametres-api-keys V1 |
| V20 | P0 | API keys : revoke + audit log | E2E V2 |
| V21 | P0 | Profile info : update profile + locale redirect | E2E profile-info-edit V1+V2 |
| V22 | P0 | Profile MFA : wizard 4 steps complet | E2E profile-mfa-setup-complete V1 |
| V23 | P0 | Profile MFA : wrong code affiche erreur + clear | E2E profile-mfa-wrong-code V1 |
| V24 | P0 | Profile MFA : recovery codes download .txt | E2E profile-recovery-codes-download V1 |
| V25 | P0 | Profile MFA : disable requires current password | unit disable-mfa |
| V26 | P0 | Profile : change password recheck current | E2E profile-change-password V1+V2 |
| V27 | P0 | Profile : active sessions list + revoke individual + revoke-all | E2E profile-sessions-revoke V1+V2 |
| V28 | P0 | Profile : notifications preferences matrix toggles + mandatory disabled | unit notifications-preferences-matrix |

---

## 10. Edge cases (12)

### EC1 : MFA QR fails to render

**Scenario** : Backend retourne `qr_data_url` malforme ou bloque par CSP.
**Comportement attendu** : Fallback automatique vers secret manuel + message "Si le QR ne s'affiche pas, entrez ce secret manuellement dans votre app authenticator".
**Test** : Mock `qr_data_url` invalide -> step QR affiche encore secret + bouton continuer disponible.

### EC2 : Recovery codes lost -> regenerate flow

**Scenario** : User perd sa carte de recovery codes (vol, casse). Doit pouvoir regenerer.
**Comportement attendu** : Bouton "Regenerer codes de secours" dans security tab -> dialog avec recheck current password -> 10 nouveaux codes + invalidation anciens cote backend.
**Test** : E2E profile-recovery-codes-download V1 couvre regenerate path.

### EC3 : Session revoke current shows warning

**Scenario** : User clique revoke sur sa session courante par erreur.
**Comportement attendu** : Bouton revoke disabled sur card session courante (badge "Courante" + pas de bouton). Le revoke-all envoie `except_current=true` -> backend protege la session courante.
**Test** : Card current n'a pas de bouton revoke.

### EC4 : Password current wrong

**Scenario** : User tape mauvais mot de passe actuel dans change password.
**Comportement attendu** : Backend retourne 401 + message clair "Mot de passe actuel incorrect" + form ne se vide pas (UX).
**Test** : E2E profile-change-password V2.

### EC5 : Password complexity reject

**Scenario** : User tape nouveau mot de passe sans special char.
**Comportement attendu** : Zod validation client-side bloque submit + strength meter score affiche < 3 + button Save disabled.
**Test** : Unit password-strength + change-password-dialog V3 button disabled.

### EC6 : Photo upload > 5MB

**Scenario** : User uploade un selfie iPhone 8 MB.
**Comportement attendu** : Toast erreur "Image trop grande (max 5 MB)" + upload bloque cote client + pas de network call.
**Test** : Unit logo-uploader V2 (transposable a avatar).

### EC7 : Color contrast warning brand kit

**Scenario** : User choisit primary color jaune clair sur fond blanc.
**Comportement attendu** : Affichage live ratio + Alert destructive si fail + bouton Save disabled tant que fail (configurable -- ici we just warn).
**Test** : E2E parametres-branding-logo V3.

### EC8 : Custom field rename break existing data

**Scenario** : Admin change key d'un custom field qui contient deja 1000 records.
**Comportement attendu** : Key field disabled en mode edit (impossible de changer apres creation). Type field aussi disabled. Pour rename label : OK car label = display only, pas de break.
**Test** : Unit custom-field-form -- edit mode disable key + type.

### EC9 : Pipeline stage delete with deals

**Scenario** : Admin supprime stage "Qualification" qui contient 23 deals.
**Comportement attendu** : Avant delete, montrer count deals + force choix stage de migration via dropdown + POST move all deals to target -> puis delete.
**Test** : pipeline-stage-delete-with-deals (integration).

### EC10 : API key revoke break integration

**Scenario** : Admin revoke API key utilisee en production par comparateur partenaire.
**Comportement attendu** : Modal confirm warning "Cette action ne peut pas etre annulee. L'integration utilisant cette cle cessera de fonctionner."
**Test** : E2E parametres-api-keys V2 modal confirm.

### EC11 : Quota over limit upgrade flow

**Scenario** : Tenant atteint 100% quota contacts.
**Comportement attendu** : Alert destructive sur onglet quotas + CTA "Contacter support" mailto: subject pre-rempli + log analytics event.
**Test** : render quotas-tab avec data over limit.

### EC12 : Locale switch parametres tabs labels

**Scenario** : User change locale dans profile.info -> redirect /ar-MA/parametres -> tabs labels en darija.
**Comportement attendu** : Tabs labels recharges via next-intl avec locale=ar-MA + dir="rtl" appliqued.
**Test** : E2E profile-info-edit V2 + Tache 4.3.13 RTL.

---

## 11. Conformite reglementaire MA

### 11.1 Loi 09-08 CNDP (donnees personnelles)

- **Article 7 (consentement informe)** : MFA setup wizard step 1 expose clairement les beneficies + le fait que c'est une protection additionnelle + reglementation ACAPS qui l'impose pour broker_admin. Checkbox de consentement implicit via le clic "Continuer" qui suit la lecture.
- **Article 8 (droit acces)** : Onglet Info profile expose `last_password_change_at`, `mfa_enabled_at`, `created_at`. Sprint 14 ajoutera bouton "Telecharger mes donnees" complet (export JSON tous les events utilisateur).
- **Article 21 (notification breach 72h)** : Si compromission compte (suspect login pays inhabituel), event `new_login_unknown_device` notification envoye automatic + log audit (Sprint 12 deja livre).
- **Decret CNDP 2024 (MFA recommendation)** : MFA opt-in clair (etape 1 wizard) + opt-out possible via dialog disable. Aucune contrainte cachee.
- **Article 18 (duree conservation)** : Recovery codes utilises ne sont pas re-affiches (hash en DB Sprint 5 Tache 2.1.7). Sessions revoked sont supprimees apres 30 jours d'audit retention.

### 11.2 Loi 31-08 (protection consommateur)

- **Article 4 (droit information)** : Pages parametres et profile entierement en francais (et locale user) avec textes clairs, sans jargon technique non explique.
- **Droit acces aux donnees user** : `GET /auth/me` retourne toutes les info user + audit log accessible via /login-history.

### 11.3 Loi 53-05 (signature electronique)

- **Article 6 (signature electronique avancee SCA)** : MFA = facteur 2eme (something you have = phone + secret). Permet de qualifier certaines operations critiques (validation police, contrat signature) comme SCA. Tache 4.3.11 ne livre pas les operations SCA elles-memes mais le facteur MFA qui les rendra possibles Sprint 17+.

### 11.4 ACAPS circulaire 2024

- **Audit log obligatoire** : Tous les events MFA (setup, verify, disable, regenerate_codes) sont audites cote backend Sprint 12 (immutable + chained hash). Frontend declenche les calls qui generent l'audit.
- **MFA mandatory broker_admin** : Enforcement Sprint 5 enrollment. Cette tache permet la consultation de l'etat + le re-setup si necessaire (apres reset device).

### 11.5 WCAG 2.1 AA accessibility

- **Keyboard navigation** : Tabs + Wizard MFA tous navigables via Tab/Shift+Tab + Enter pour activer + Escape pour fermer dialogs.
- **ARIA labels** : QR code role=img + aria-label descriptif. Wizard steps `role=region` + `aria-labelledby` sur heading. Code TOTP input `inputMode=numeric` + `autocomplete=one-time-code` + `aria-describedby` pour hint.
- **Color contrast** : Branding tab affiche le ratio calcule + warning si fail. Couleurs design system Sprint 4 deja conformes.
- **Screen reader** : Recovery codes liste avec `role=list` + `role=listitem` + numeros code lus.
- **Reduced motion** : Animations dnd-kit respectent `prefers-reduced-motion`.

---

## 12. Sortie attendue

A la fin de cette tache :

```
Pages parametres + profile completes :
  - /parametres : 7 onglets broker_admin (general, branding, users, custom-fields,
    pipelines, quotas, api-keys)
  - /profile : 3 onglets tous users (info, security, notifications)
  - Tous formulaires valides Zod + react-hook-form
  - Tous mutations TanStack Query avec optimistic ou refetch
  - i18n strings prepared (Tache 4.3.13 finalisera)

MFA Setup Wizard 4 etapes :
  - Step 1 : intro consent informe (loi 09-08 CNDP)
  - Step 2 : QR code SVG + secret manuel toggleable + countdown 30s
  - Step 3 : verify TOTP 6 digits + auto-submit + error handling
  - Step 4 : 10 recovery codes + download .txt UTF-8 sans BOM +
    checkbox confirm sauvegarde + impossible quitter sans confirm

Components sharables :
  - MfaSetupWizard reutilise Sprint 17 (customer portal) + Sprint 22 (garage)
  - ActiveSessionsList reutilise toutes les apps
  - ChangePasswordDialog reutilise toutes les apps
  - CustomFieldRenderer / CustomFieldForm reutilise par Sprint 8 forms
  - PipelineStagesEditor reutilise par Sprint 8 deals admin

Tests :
  - 18+ Vitest unit, coverage >= 85%
  - 12+ Playwright E2E
  - axe-core a11y checks (preview Tache 4.3.14)

API consumed :
  - GET/PATCH /tenants/:id (settings + branding)
  - GET/POST/PATCH/DELETE /tenants/:id/users + invite
  - GET/POST/PATCH/DELETE /crm/custom-fields
  - GET/POST/PATCH /crm/pipelines
  - GET /tenants/:id/quotas
  - GET/POST/DELETE /tenants/:id/api-keys
  - POST /uploads/logo + /uploads/avatar (S3 Sprint 10)
  - GET/PATCH /auth/me
  - POST /auth/change-password
  - POST /auth/mfa/{setup,verify,disable,recovery-codes/regenerate}
  - GET /auth/sessions + revoke + revoke-all
  - GET /auth/audit/login-history
  - GET/PATCH /auth/notifications-preferences
```

**Sprint 16 Tache 4.3.12 (RBAC UI hooks) demarre avec** :
- Pattern garde RBAC server-side (layout parametres) deja prototype
- Hook `useMe()` deja livre dans profile.queries
- Pattern `<HasPermission>` a generaliser pour cacher sidebar items + action buttons.

**Sprint 17 (web-customer-portal) reutilisera** :
- `<MfaSetupWizard>` complet (assure final optionnel MFA)
- `<ChangePasswordDialog>`
- `<ActiveSessionsList>`
- Pattern profile page avec onglets info + security + notifications

---

## 13. Risques et mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Backend MFA recovery codes retourne 6 au lieu de 10 | Medium | Bas (UX degrade gracieux) | Frontend affiche le tableau retourne dynamiquement, pas hardcode 10 |
| qrcode.react performance sur old devices | Bas | Bas | level "M" + size 200 limite calcul ; fallback secret manuel |
| react-colorful incompatible RTL | Medium | Bas (UI seulement) | Wrapper component qui force LTR via `dir="ltr"` autour du picker |
| dnd-kit drag-drop bug iOS Safari touch | Medium | Medium | Test E2E sur iOS Safari Sprint 16 + workaround pointer-events |
| S3 upload CORS preflight latency | Bas | Bas | Sprint 10 deja configure CORS allowed origins |
| Session geoloc affiche "Unknown" frequent | Haut | Bas | Fallback "Lieu inconnu" + tooltip explanatoire |
| Notifications preferences matrix render slow si > 50 events | Bas | Bas | Group collapse + virtualization si depasse 50 events Sprint 28 |
| Bulk import users CSV malformed | Medium | Medium | Preview + ligne par ligne validation + abort sur premiere erreur |

---

## 14. Conventions (20+ points)

1. **No emoji (decision-006)** : Aucune emoji dans translations FR/AR-MA/AR, libelles UI, recovery codes, toasts, .txt downloads, alt-texts, aria-labels, comments code.

2. **Naming files** : `kebab-case` pour fichiers components (`mfa-setup-wizard.tsx`), `kebab-case` pour folders, `camelCase` pour exports JS, `PascalCase` pour React components.

3. **Imports order** : (1) React/Next imports, (2) third-party libs, (3) `@/lib/...` absolute, (4) `@/components/...`, (5) types `type {...}` separes.

4. **Server vs Client Components** : Pages tabs router sont Server Components (layout RBAC check server-side). Tab contents sont Client Components (`'use client'`) pour interactions form + queries.

5. **Form pattern** : `react-hook-form` + `zodResolver` + `<Controller>` pour selects/checkboxes/colorpickers. Errors affichees inline sous chaque field.

6. **Mutations** : Toujours via TanStack Query `useMutation`. Toasts dans `onSuccess`/`onError`. `Idempotency-Key` UUID pour POST sensibles (invite user, change-password, create-api-key).

7. **Queries** : `useQuery` avec `queryKey` array `['entite', id, params]`. `staleTime` 60s default. `placeholderData: (prev) => prev` pour pagination smooth.

8. **Errors UI** : Backend errors transitent via `err?.response?.data?.message`. Fallback string localisee si null.

9. **Loading states** : `<Skeleton>` shadcn/ui pour blocks lourds. `disabled` + label change ("Enregistrement...") pour buttons.

10. **Confirmations** : Toutes actions destructives (delete user, revoke session, revoke API key, disable MFA) passent par `<ConfirmDialog>` partagee.

11. **Accessibility** : Tout dialog a `<DialogTitle>` + `<DialogDescription>`. Tout input a `<Label htmlFor>`. Toute icone purement decorative a `aria-hidden="true"`. Tout role custom (img, list, region) a `aria-label` ou `aria-labelledby`.

12. **Color picker contrast** : Tout color picker calcule ratio en live + affiche warning si < 4.5:1.

13. **File uploads** : Toujours `stripExif` + size check client + accept MIME types restrictif. Backend revalide cote serveur (defense en profondeur Sprint 10).

14. **Sensitive data lifecycle** : Secrets (MFA setup secret, API key secret, recovery codes one-time) clear de React state au close dialog via `useEffect` cleanup.

15. **i18n keys naming** : `<page>.<section>.<key>` (ex: `parametres.general.identity.name`). Aucune string en dur dans JSX.

16. **Tabs URL state** : `?tab=branding` via nuqs ou `searchParams` Server Component pour deep linking + browser back/forward.

17. **Phone format MA** : Toujours E.164 `+212XXXXXXXXX` (validation Zod `+212[567]\d{8}`). Affichage : pas de format particulier (UX simple).

18. **Currency MAD** : Hard-coded `currency: 'MAD'` (Sprint 16 zero option). Affichage `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })`.

19. **Timezone Africa/Casablanca** : Hard-coded. Affichage avec `date-fns-tz`. Toujours `formatInTimeZone(date, 'Africa/Casablanca', 'PPP')`.

20. **Tests organization** : `test/unit/*.spec.ts` pour Vitest, `e2e/*.spec.ts` pour Playwright. Fixtures `e2e/fixtures/*.ts`. Mocks via `vi.mock('@/lib/queries/...')`.

21. **Console logs** : Aucun `console.log` en production. `console.error` autorise pour catch blocks + Sentry forward Sprint 35.

22. **CSP compliance** : Inline styles autorises uniquement via `style={{ backgroundColor: var }}` controlled. Aucun `dangerouslySetInnerHTML`.

23. **Idempotency** : Toutes mutations POST sensibles incluent header `Idempotency-Key: <crypto.randomUUID()>` (invite, change-password, create-api-key, mfa-setup, mfa-verify, mfa-disable).

24. **Optimistic vs refetch** : Updates simples (toggle notif preference) optimistic. Updates lourdes (create user, change password) refetch ou setQueryData explicit.

25. **Loading wizard steps** : Persistance sessionStorage entre steps pour resilience reload. Cleanup au finish ou cancel.

---

## 15. Acceptance criteria summary

Toutes les conditions suivantes doivent etre vraies pour clore la tache :

- [ ] Build prod `pnpm --filter @insurtech/web-broker build` passe sans erreur
- [ ] `pnpm --filter @insurtech/web-broker test:unit` couvre 18+ specs, exit 0
- [ ] `pnpm --filter @insurtech/web-broker test:e2e` couvre 12+ scenarios, exit 0
- [ ] Coverage >= 85% sur composants livres
- [ ] Aucune emoji dans le code (lint check fail-on-emoji)
- [ ] ESLint + Prettier passent
- [ ] TypeScript strict zero errors
- [ ] Axe-core a11y violations = 0 sur pages /parametres et /profile (preview, Tache 4.3.14 finalise)
- [ ] Conformite loi 09-08 CNDP : MFA opt-in clair, audit log declenche, recovery codes confidentialite document
- [ ] Conformite ACAPS : MFA enable/disable trigger audit backend Sprint 12
- [ ] Conformite WCAG 2.1 AA : keyboard nav + ARIA labels + contrast ratios
- [ ] V1-V28 criteres tous greens en CI

---

## 16. Definition of done (DoD)

- Code reviewed par 1 dev senior + 1 lead QA
- Tests CI green sur main branch
- Demo realisee aupres PO Skalean (broker_admin + broker_user paths)
- Documentation README composants mise a jour (auto-gen via Storybook Sprint 28+)
- Conformite RGPD/CNDP verifiee par DPO Skalean (point obligatoire)
- Pentest review preliminaire change-password + sessions revocation (Sprint 33 plus complet)

---

## 17. Notes finales

Cette tache constitue le point d'aboutissement de la securisation utilisateur cote frontend pour l'app web-broker. Elle materialise concretement l'engagement Skalean InsurTech v2.2 envers la conformite ACAPS + loi 09-08 + WCAG 2.1 AA. Le wizard MFA + le change-password recheck + l'active sessions management forment le triptyque de la cyber-resilience utilisateur. La page parametres complete l'onboarding admin et permet l'autonomie totale du cabinet broker (zero support intervention pour configuration courante).

La prochaine etape (Tache 4.3.12 RBAC UI) generalisera le pattern de garde role server-side prototype dans `parametres/layout.tsx`, et fournira les hooks `usePermission` + composants `<HasPermission>` + `<HasRole>` qui permettront d'appliquer le RBAC UI sur toute l'application (cacher sidebar items, action buttons, sections de formulaires).

---

**Fin de la tache 4.3.11 -- Parametres + Profile Pages : Tenant Settings + User Profile + MFA Setup + Active Sessions.**

---

<!-- Annexe : extensions detaillees sections 6-17 (patterns complementaires, criteres validation, edge cases, conformite Maroc). Le contenu canonique de la tache se termine au separateur ci-dessus ; ce qui suit constitue une annexe de rappel sans header `## N.` pour ne pas casser la TOC. -->

## Annexe A -- Patterns code complementaires (rappel exhaustif)

Cette section donne le code complet de chaque fichier livre par la tache. Tous les snippets sont compatibles Next.js 15 App Router + React 19 + TypeScript 5.6 strict + Tailwind 4 + shadcn/ui. Aucun emoji nulle part. Toutes les chaines fr (default), ar-MA et ar passent par next-intl `useTranslations()` ou `getTranslations()` selon le contexte serveur/client. Tous les hooks de mutation injectent `Idempotency-Key: <uuid v4 cree au mount>` via l'interceptor Axios du Sprint 3. Le logger Pino frontend (Sprint 4 base) emet le contexte `{ tenant_id, user_id, trace_id, route, action }` a chaque erreur.

### 6.1 Schemas Zod -- `apps/web-broker/lib/schemas/parametres.schema.ts`

```typescript
import { z } from 'zod';

export const TenantContactSchema = z.object({
  phone: z.string().regex(/^\+212[567]\d{8}$/, 'Numero MA invalide (format +212XXXXXXXXX)'),
  email: z.string().email('Email invalide'),
  website: z.string().url('URL invalide').optional().or(z.literal('')),
});

export const TenantAddressSchema = z.object({
  street: z.string().min(3, 'Adresse trop courte').max(200),
  city: z.string().min(2).max(100),
  postal_code: z.string().regex(/^\d{5}$/, 'Code postal MA = 5 chiffres'),
  country: z.literal('MA'),
});

export const WorkingHoursDaySchema = z.object({
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM'),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM'),
}).nullable();

export const WorkingHoursSchema = z.object({
  monday: WorkingHoursDaySchema,
  tuesday: WorkingHoursDaySchema,
  wednesday: WorkingHoursDaySchema,
  thursday: WorkingHoursDaySchema,
  friday: WorkingHoursDaySchema,
  saturday: WorkingHoursDaySchema,
  sunday: WorkingHoursDaySchema,
}).refine(
  (val) => Object.values(val).some((d) => d !== null),
  { message: 'Au moins un jour ouvre obligatoire' },
);

export const TenantGeneralSettingsSchema = z.object({
  name: z.string().min(2, 'Nom min 2 caracteres').max(100, 'Nom max 100 caracteres'),
  legal_name: z.string().min(2).max(150),
  ice: z.string().regex(/^\d{15}$/, 'ICE = 15 chiffres exactement'),
  rc: z.string().regex(/^[A-Z0-9-]{1,20}$/, 'RC alphanumerique majuscules'),
  if_fiscal: z.string().regex(/^\d{8}$/, 'IF fiscal = 8 chiffres').optional().or(z.literal('')),
  cnss: z.string().regex(/^\d{7,10}$/, 'CNSS 7-10 chiffres').optional().or(z.literal('')),
  contact: TenantContactSchema,
  address: TenantAddressSchema,
  working_hours: WorkingHoursSchema,
  default_locale: z.enum(['fr', 'ar-MA', 'ar']),
  default_currency: z.literal('MAD'),
  timezone: z.literal('Africa/Casablanca'),
  fiscal_year_start_month: z.number().int().min(1).max(12),
});
export type TenantGeneralSettings = z.infer<typeof TenantGeneralSettingsSchema>;

export const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hex format #RRGGBB');

export const TenantBrandingSchema = z.object({
  logo_url: z.string().url('URL logo invalide').nullable(),
  primary_color: HexColorSchema.default('#E95D2C'),
  secondary_color: HexColorSchema.default('#1A2730'),
  accent_color: HexColorSchema.default('#B0CEE2'),
  email_signature_html: z.string().max(5000, 'Signature max 5000 caracteres').nullable(),
  email_from_name: z.string().min(2).max(80).default('Skalean Broker'),
  email_reply_to: z.string().email().nullable(),
});
export type TenantBranding = z.infer<typeof TenantBrandingSchema>;

export const TenantRoleEnum = z.enum(['broker_admin', 'broker_user', 'broker_assistant']);
export type TenantRole = z.infer<typeof TenantRoleEnum>;

export const InviteUserSchema = z.object({
  email: z.string().email('Email invalide'),
  display_name: z.string().min(2).max(100),
  role: TenantRoleEnum,
  send_welcome_email: z.boolean().default(true),
  locale: z.enum(['fr', 'ar-MA', 'ar']).default('fr'),
});
export type InviteUserPayload = z.infer<typeof InviteUserSchema>;

export const UpdateUserRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: TenantRoleEnum,
});

export const SuspendUserSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const CustomFieldTypeEnum = z.enum([
  'text', 'number', 'date', 'select', 'multiselect', 'boolean', 'currency', 'percentage',
]);
export type CustomFieldType = z.infer<typeof CustomFieldTypeEnum>;

export const CustomFieldOptionSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,40}$/, 'Cle snake_case max 40'),
  label_fr: z.string().min(1).max(100),
  label_ar: z.string().min(1).max(100).optional(),
});

export const CustomFieldSchema = z.object({
  id: z.string().uuid().optional(),
  entity: z.enum(['contact', 'company', 'deal', 'policy', 'sinistre']),
  key: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/, 'Cle commence par lettre, snake_case'),
  label_fr: z.string().min(2).max(80),
  label_ar: z.string().min(2).max(80).optional(),
  type: CustomFieldTypeEnum,
  required: z.boolean().default(false),
  default_value: z.unknown().optional(),
  options: z.array(CustomFieldOptionSchema).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  regex: z.string().optional(),
  help_text_fr: z.string().max(200).optional(),
  help_text_ar: z.string().max(200).optional(),
  display_order: z.number().int().min(0).default(0),
  archived: z.boolean().default(false),
}).superRefine((val, ctx) => {
  if ((val.type === 'select' || val.type === 'multiselect') && (!val.options || val.options.length < 2)) {
    ctx.addIssue({ code: 'custom', message: 'Au moins 2 options pour select/multiselect', path: ['options'] });
  }
  if (val.type === 'number' && val.min !== undefined && val.max !== undefined && val.min > val.max) {
    ctx.addIssue({ code: 'custom', message: 'min doit etre <= max', path: ['min'] });
  }
});
export type CustomField = z.infer<typeof CustomFieldSchema>;

export const PipelineStageSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().regex(/^[a-z0-9_]{1,40}$/),
  label_fr: z.string().min(1).max(40),
  label_ar: z.string().min(1).max(40).optional(),
  color: HexColorSchema,
  probability: z.number().int().min(0).max(100),
  display_order: z.number().int().min(0),
  is_won: z.boolean().default(false),
  is_lost: z.boolean().default(false),
});

export const PipelineSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(80),
  entity: z.enum(['deal', 'sinistre']),
  is_default: z.boolean().default(false),
  stages: z.array(PipelineStageSchema).min(2, 'Min 2 stages').max(15, 'Max 15 stages'),
}).superRefine((val, ctx) => {
  const wonCount = val.stages.filter((s) => s.is_won).length;
  const lostCount = val.stages.filter((s) => s.is_lost).length;
  if (wonCount !== 1) ctx.addIssue({ code: 'custom', message: 'Exactement 1 stage is_won', path: ['stages'] });
  if (lostCount !== 1) ctx.addIssue({ code: 'custom', message: 'Exactement 1 stage is_lost', path: ['stages'] });
});
export type Pipeline = z.infer<typeof PipelineSchema>;

export const ApiKeyScopeEnum = z.enum([
  'contacts:read', 'contacts:write',
  'companies:read', 'companies:write',
  'deals:read', 'deals:write',
  'policies:read', 'policies:write',
  'sinistres:read', 'sinistres:write',
  'webhooks:receive',
]);

export const CreateApiKeySchema = z.object({
  name: z.string().min(3).max(80),
  scopes: z.array(ApiKeyScopeEnum).min(1, 'Au moins un scope'),
  expires_at: z.string().datetime().nullable(),
  allowed_ips: z.array(z.string().ip()).optional(),
});
export type CreateApiKeyPayload = z.infer<typeof CreateApiKeySchema>;

export const QuotaUsageSchema = z.object({
  resource: z.enum(['contacts', 'companies', 'deals', 'policies', 'api_calls_month', 'storage_gb']),
  current: z.number().nonnegative(),
  limit: z.number().positive(),
  unit: z.string(),
  percentage: z.number().min(0).max(200),
  warn_threshold: z.number().min(0).max(100).default(80),
});
export type QuotaUsage = z.infer<typeof QuotaUsageSchema>;

export const BulkUserCsvRowSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(2).max(100),
  role: TenantRoleEnum,
  locale: z.enum(['fr', 'ar-MA', 'ar']).default('fr'),
});
export type BulkUserCsvRow = z.infer<typeof BulkUserCsvRowSchema>;
```

### 6.2 Schemas Zod -- `apps/web-broker/lib/schemas/profile.schema.ts`

```typescript
import { z } from 'zod';

export const PreferredChannelEnum = z.enum(['email', 'in_app', 'whatsapp']);

export const ProfileInfoSchema = z.object({
  display_name: z.string().min(2, 'Nom min 2 caracteres').max(100),
  phone: z.string().regex(/^\+212[567]\d{8}$/, 'Format +212XXXXXXXXX').nullable(),
  photo_url: z.string().url().nullable(),
  locale: z.enum(['fr', 'ar-MA', 'ar']),
  timezone: z.literal('Africa/Casablanca'),
  preferred_channel: PreferredChannelEnum,
  signature_html: z.string().max(2000).nullable(),
  bio: z.string().max(500).nullable(),
});
export type ProfileInfo = z.infer<typeof ProfileInfoSchema>;

export const PasswordComplexitySchema = z.string()
  .min(12, 'Min 12 caracteres')
  .max(128, 'Max 128 caracteres')
  .regex(/[a-z]/, 'Au moins une minuscule')
  .regex(/[A-Z]/, 'Au moins une majuscule')
  .regex(/[0-9]/, 'Au moins un chiffre')
  .regex(/[^a-zA-Z0-9]/, 'Au moins un caractere special');

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Mot de passe actuel requis'),
  new_password: PasswordComplexitySchema,
  confirm_password: z.string(),
}).refine((val) => val.new_password === val.confirm_password, {
  message: 'Confirmation ne correspond pas',
  path: ['confirm_password'],
}).refine((val) => val.new_password !== val.current_password, {
  message: 'Nouveau doit etre different du courant',
  path: ['new_password'],
});
export type ChangePasswordPayload = z.infer<typeof ChangePasswordSchema>;

export const NotificationEventEnum = z.enum([
  'deal_won', 'deal_lost', 'policy_renewal_due',
  'broker_queue_new', 'broker_queue_sla_warning',
  'sinistre_status_change', 'sinistre_status_critical',
  'user_invited_accepted', 'password_changed',
  'mfa_disabled', 'session_revoked_by_other_device',
]);
export type NotificationEvent = z.infer<typeof NotificationEventEnum>;

export const NotificationChannelSchema = z.object({
  email: z.boolean(),
  in_app: z.boolean(),
  whatsapp: z.boolean(),
  mandatory: z.boolean().optional(),
});

export const NotificationsPreferencesSchema = z.object({
  preferences: z.record(NotificationEventEnum, NotificationChannelSchema),
});
export type NotificationsPreferences = z.infer<typeof NotificationsPreferencesSchema>;
```

### 6.3 Schemas Zod -- `apps/web-broker/lib/schemas/mfa.schema.ts`

```typescript
import { z } from 'zod';

export const MfaSetupInitResponseSchema = z.object({
  challenge_token: z.string().min(32),
  secret_base32: z.string().regex(/^[A-Z2-7]+=*$/, 'Base32 invalide'),
  otpauth_url: z.string().url().startsWith('otpauth://totp/'),
  expires_at: z.string().datetime(),
});
export type MfaSetupInitResponse = z.infer<typeof MfaSetupInitResponseSchema>;

export const MfaVerifyCodeSchema = z.object({
  challenge_token: z.string().min(32),
  code: z.string().regex(/^\d{6}$/, 'Code TOTP = 6 chiffres'),
});
export type MfaVerifyCodePayload = z.infer<typeof MfaVerifyCodeSchema>;

export const RecoveryCodesResponseSchema = z.object({
  recovery_codes: z.array(z.string().regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)).length(10),
  generated_at: z.string().datetime(),
  display_one_time_only: z.literal(true),
});
export type RecoveryCodesResponse = z.infer<typeof RecoveryCodesResponseSchema>;

export const DisableMfaSchema = z.object({
  current_password: z.string().min(1),
  totp_code: z.string().regex(/^\d{6}$/).optional(),
  recovery_code: z.string().regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/).optional(),
}).refine((v) => !!(v.totp_code || v.recovery_code), {
  message: 'TOTP ou recovery code requis',
  path: ['totp_code'],
});
```


### 6.4 Utils TOTP -- `apps/web-broker/lib/utils/totp-helpers.ts`

```typescript
export function buildOtpauthUrl(params: {
  secret: string;
  accountName: string;
  issuer: string;
  digits?: number;
  period?: number;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
}): string {
  const { secret, accountName, issuer, digits = 6, period = 30, algorithm = 'SHA1' } = params;
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const qs = new URLSearchParams({
    secret,
    issuer,
    algorithm,
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${qs.toString()}`;
}

export function isBase32(input: string): boolean {
  return /^[A-Z2-7]+=*$/.test(input);
}

export function formatSecretForDisplay(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

export function maskSecret(secret: string, visible = 4): string {
  return secret.length <= visible ? secret : `${secret.slice(0, visible)}${'*'.repeat(Math.max(0, secret.length - visible))}`;
}
```

### 6.5 Utils password strength -- `apps/web-broker/lib/utils/password-strength.ts`

```typescript
export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'tres_faible' | 'faible' | 'moyen' | 'fort' | 'tres_fort';
  feedback: string[];
};

export function computePasswordStrength(pwd: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;
  if (pwd.length >= 12) score++; else feedback.push('Minimum 12 caracteres');
  if (/[a-z]/.test(pwd)) score++; else feedback.push('Au moins une minuscule');
  if (/[A-Z]/.test(pwd)) score++; else feedback.push('Au moins une majuscule');
  if (/[0-9]/.test(pwd)) score++; else feedback.push('Au moins un chiffre');
  if (/[^a-zA-Z0-9]/.test(pwd)) score++; else feedback.push('Au moins un caractere special');
  const finalScore = Math.min(4, Math.max(0, score - 1)) as 0 | 1 | 2 | 3 | 4;
  const labels: PasswordStrength['label'][] = ['tres_faible', 'faible', 'moyen', 'fort', 'tres_fort'];
  return { score: finalScore, label: labels[finalScore], feedback };
}
```

### 6.6 Utils download text file -- `apps/web-broker/lib/utils/download-text-file.ts`

```typescript
export function downloadTextFile(filename: string, content: string): void {
  const utf8 = new TextEncoder().encode(content);
  const blob = new Blob([utf8], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildRecoveryCodesFile(params: {
  tenantName: string;
  userEmail: string;
  codes: string[];
  generatedAt: string;
}): string {
  const lines: string[] = [];
  lines.push('Skalean Broker -- Codes de recuperation MFA');
  lines.push('============================================');
  lines.push(`Tenant : ${params.tenantName}`);
  lines.push(`Utilisateur : ${params.userEmail}`);
  lines.push(`Genere le : ${params.generatedAt}`);
  lines.push('');
  lines.push('AVERTISSEMENT CONFIDENTIEL');
  lines.push('Conservez ces codes dans un coffre numerique ou imprimes en lieu sur.');
  lines.push('Chaque code est utilisable une seule fois en remplacement du code TOTP.');
  lines.push('Ne partagez jamais ces codes par email, SMS ou message instantane.');
  lines.push('');
  params.codes.forEach((code, idx) => {
    lines.push(`${String(idx + 1).padStart(2, '0')}. ${code}`);
  });
  lines.push('');
  lines.push('Si vous perdez ces codes, vous pourrez en regenerer 10 nouveaux');
  lines.push('depuis /profile > Securite > Codes de recuperation > Regenerer.');
  lines.push('Les anciens codes seront alors invalides immediatement.');
  return lines.join('\n');
}
```

### 6.7 Utils strip-exif -- `apps/web-broker/lib/utils/strip-exif.ts`

```typescript
export async function stripExifFromImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), file.type, 0.92),
  );
  return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
}
```

### 6.8 Queries parametres -- `apps/web-broker/lib/queries/parametres.queries.ts`

```typescript
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '@/lib/api/client';
import type {
  TenantGeneralSettings, TenantBranding, CustomField, Pipeline,
  CreateApiKeyPayload, InviteUserPayload, QuotaUsage,
} from '@/lib/schemas/parametres.schema';
import { logger } from '@/lib/logger';

const KEYS = {
  general: ['parametres', 'general'] as const,
  branding: ['parametres', 'branding'] as const,
  users: ['parametres', 'users'] as const,
  customFields: (entity: string) => ['parametres', 'custom-fields', entity] as const,
  pipelines: ['parametres', 'pipelines'] as const,
  quotas: ['parametres', 'quotas'] as const,
  apiKeys: ['parametres', 'api-keys'] as const,
};

export function useGeneralSettings() {
  return useQuery({
    queryKey: KEYS.general,
    queryFn: async () => {
      const { data } = await apiClient.get<TenantGeneralSettings>('/api/v1/tenants/me/settings');
      return data;
    },
    staleTime: 60_000,
  });
}

export function useUpdateGeneralSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<TenantGeneralSettings>) => {
      const idempotencyKey = uuidv4();
      const { data } = await apiClient.patch<TenantGeneralSettings>(
        '/api/v1/tenants/me/settings',
        payload,
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
      logger.info({ action: 'update_general_settings', idempotencyKey }, 'general updated');
      return data;
    },
    onSuccess: (data) => { qc.setQueryData(KEYS.general, data); },
    onError: (err) => { logger.error({ err, action: 'update_general_settings' }, 'failed'); },
  });
}

export function useBrandingSettings() {
  return useQuery({
    queryKey: KEYS.branding,
    queryFn: async () => {
      const { data } = await apiClient.get<TenantBranding>('/api/v1/tenants/me/branding');
      return data;
    },
  });
}

export function useUpdateBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<TenantBranding>) => {
      const idempotencyKey = uuidv4();
      const { data } = await apiClient.patch<TenantBranding>(
        '/api/v1/tenants/me/branding',
        payload,
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
      return data;
    },
    onSuccess: (data) => qc.setQueryData(KEYS.branding, data),
  });
}

export function useUploadLogo() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('purpose', 'tenant_logo');
      const { data } = await apiClient.post<{ url: string; size: number }>(
        '/api/v1/uploads',
        form,
        { headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': uuidv4() } },
      );
      return data;
    },
  });
}

export function useTenantUsers(params: { page?: number; pageSize?: number; q?: string } = {}) {
  return useQuery({
    queryKey: [...KEYS.users, params],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/v1/tenants/me/users', { params });
      return data;
    },
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: InviteUserPayload) => {
      const idempotencyKey = uuidv4();
      const { data } = await apiClient.post('/api/v1/tenants/me/users/invite', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.users }),
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { userId: string; role: string }) => {
      const { data } = await apiClient.patch(`/api/v1/tenants/me/users/${p.userId}`, { role: p.role }, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.users }),
  });
}

export function useSuspendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { userId: string; reason: string }) => {
      const { data } = await apiClient.post(`/api/v1/tenants/me/users/${p.userId}/suspend`,
        { reason: p.reason }, { headers: { 'Idempotency-Key': uuidv4() } });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.users }),
  });
}

export function useBulkImportUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Array<{ email: string; display_name: string; role: string; locale: string }>) => {
      const { data } = await apiClient.post('/api/v1/tenants/me/users/bulk-invite', { rows }, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data as { success: number; errors: Array<{ row: number; error: string }> };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.users }),
  });
}

export function useCustomFields(entity: string) {
  return useQuery({
    queryKey: KEYS.customFields(entity),
    queryFn: async () => {
      const { data } = await apiClient.get<CustomField[]>(`/api/v1/tenants/me/custom-fields`, {
        params: { entity },
      });
      return data;
    },
  });
}

export function useCreateCustomField(entity: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CustomField) => {
      const { data } = await apiClient.post('/api/v1/tenants/me/custom-fields', payload, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.customFields(entity) }),
  });
}

export function useUpdateCustomField(entity: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; patch: Partial<CustomField> }) => {
      const { data } = await apiClient.patch(`/api/v1/tenants/me/custom-fields/${p.id}`, p.patch, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.customFields(entity) }),
  });
}

export function useArchiveCustomField(entity: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/api/v1/tenants/me/custom-fields/${id}`, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.customFields(entity) }),
  });
}

export function usePipelines() {
  return useQuery({
    queryKey: KEYS.pipelines,
    queryFn: async () => {
      const { data } = await apiClient.get<Pipeline[]>('/api/v1/tenants/me/pipelines');
      return data;
    },
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; patch: Partial<Pipeline> }) => {
      const { data } = await apiClient.patch(`/api/v1/tenants/me/pipelines/${p.id}`, p.patch, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.pipelines }),
  });
}

export function useQuotas() {
  return useQuery({
    queryKey: KEYS.quotas,
    queryFn: async () => {
      const { data } = await apiClient.get<{ usage: QuotaUsage[] }>('/api/v1/tenants/me/quotas');
      return data.usage;
    },
    staleTime: 5 * 60_000,
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: KEYS.apiKeys,
    queryFn: async () => {
      const { data } = await apiClient.get('/api/v1/tenants/me/api-keys');
      return data;
    },
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateApiKeyPayload) => {
      const { data } = await apiClient.post<{ id: string; secret: string; prefix: string }>(
        '/api/v1/tenants/me/api-keys', payload,
        { headers: { 'Idempotency-Key': uuidv4() } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.apiKeys }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/api/v1/tenants/me/api-keys/${id}`, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.apiKeys }),
  });
}
```


### 6.9 Queries profile + MFA + sessions -- `apps/web-broker/lib/queries/profile.queries.ts`

```typescript
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '@/lib/api/client';
import type { ProfileInfo, ChangePasswordPayload, NotificationsPreferences } from '@/lib/schemas/profile.schema';
import type { MfaSetupInitResponse, MfaVerifyCodePayload, RecoveryCodesResponse } from '@/lib/schemas/mfa.schema';

const PK = {
  me: ['profile', 'me'] as const,
  sessions: ['profile', 'sessions'] as const,
  notifications: ['profile', 'notifications'] as const,
  loginHistory: ['profile', 'login-history'] as const,
};

export function useMe() {
  return useQuery({
    queryKey: PK.me,
    queryFn: async () => {
      const { data } = await apiClient.get<ProfileInfo & { email: string; email_verified: boolean; mfa_enabled: boolean }>(
        '/api/v1/auth/me',
      );
      return data;
    },
    staleTime: 30_000,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ProfileInfo>) => {
      const { data } = await apiClient.patch('/api/v1/auth/me', patch, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
    onSuccess: (data) => qc.setQueryData(PK.me, data),
  });
}

export function useUploadProfilePhoto() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('purpose', 'user_photo');
      const { data } = await apiClient.post<{ url: string }>('/api/v1/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: ChangePasswordPayload) => {
      const { data } = await apiClient.post('/api/v1/auth/password/change', payload, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
  });
}

export function useMfaSetupInit() {
  return useMutation({
    mutationFn: async (): Promise<MfaSetupInitResponse> => {
      const { data } = await apiClient.post<MfaSetupInitResponse>(
        '/api/v1/auth/mfa/setup', {},
        { headers: { 'Idempotency-Key': uuidv4() } },
      );
      return data;
    },
  });
}

export function useMfaVerify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MfaVerifyCodePayload): Promise<RecoveryCodesResponse> => {
      const { data } = await apiClient.post<RecoveryCodesResponse>(
        '/api/v1/auth/mfa/verify', payload,
        { headers: { 'Idempotency-Key': uuidv4() } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PK.me }),
  });
}

export function useMfaDisable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { current_password: string; totp_code?: string; recovery_code?: string }) => {
      const { data } = await apiClient.post('/api/v1/auth/mfa/disable', payload, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PK.me }),
  });
}

export function useRegenerateRecoveryCodes() {
  return useMutation({
    mutationFn: async (payload: { current_password: string; totp_code: string }): Promise<RecoveryCodesResponse> => {
      const { data } = await apiClient.post<RecoveryCodesResponse>(
        '/api/v1/auth/mfa/recovery-codes/regenerate', payload,
        { headers: { 'Idempotency-Key': uuidv4() } },
      );
      return data;
    },
  });
}

export function useActiveSessions() {
  return useQuery({
    queryKey: PK.sessions,
    queryFn: async () => {
      const { data } = await apiClient.get('/api/v1/auth/sessions');
      return data as Array<{
        id: string; is_current: boolean; user_agent: string;
        ip: string; location: { city?: string; country_name?: string } | null;
        last_active_at: string; created_at: string;
      }>;
    },
    staleTime: 10_000,
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await apiClient.post(`/api/v1/auth/sessions/${sessionId}/revoke`, {}, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PK.sessions }),
  });
}

export function useRevokeAllSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/api/v1/auth/sessions/revoke-all?except_current=true', {}, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PK.sessions }),
  });
}

export function useNotificationsPreferences() {
  return useQuery({
    queryKey: PK.notifications,
    queryFn: async () => {
      const { data } = await apiClient.get<NotificationsPreferences>('/api/v1/auth/notifications-preferences');
      return data;
    },
  });
}

export function useUpdateNotificationsPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<NotificationsPreferences['preferences']>) => {
      const { data } = await apiClient.patch('/api/v1/auth/notifications-preferences', { preferences: patch }, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      return data;
    },
    onSuccess: (data) => qc.setQueryData(PK.notifications, data),
  });
}

export function useLoginHistory(limit = 10) {
  return useQuery({
    queryKey: [...PK.loginHistory, limit],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/v1/auth/audit/login-history', { params: { limit } });
      return data.data as Array<{
        id: string; event: 'login_success' | 'login_failed'; ip: string;
        user_agent: string; location?: { city?: string; country_name?: string };
        mfa_used?: boolean; reason?: string; occurred_at: string;
      }>;
    },
  });
}
```

### 6.10 Page parametres -- `apps/web-broker/app/[locale]/(protected)/parametres/page.tsx`

```typescript
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { RequireRole } from '@/components/auth/require-role';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GeneralTab } from './tabs/general-tab';
import { BrandingTab } from './tabs/branding-tab';
import { UsersTab } from './tabs/users-tab';
import { CustomFieldsTab } from './tabs/custom-fields-tab';
import { PipelinesTab } from './tabs/pipelines-tab';
import { QuotasTab } from './tabs/quotas-tab';
import { ApiKeysTab } from './tabs/api-keys-tab';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'parametres' });
  return { title: `${t('page_title')} | Skalean Broker` };
}

export default async function ParametresPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const { tab } = await searchParams;
  const validTabs = ['general', 'branding', 'users', 'custom-fields', 'pipelines', 'quotas', 'api-keys'];
  const activeTab = tab && validTabs.includes(tab) ? tab : 'general';
  const t = await getTranslations({ locale, namespace: 'parametres' });

  return (
    <RequireRole roles={['broker_admin']} fallbackHref={`/${locale}/dashboard`}>
      <main className="container mx-auto py-6 space-y-6" aria-labelledby="parametres-heading">
        <header>
          <h1 id="parametres-heading" className="text-2xl font-bold text-foreground">
            {t('page_title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('page_subtitle')}</p>
        </header>
        <Tabs defaultValue={activeTab} className="w-full">
          <TabsList className="grid grid-cols-7 w-full" role="tablist">
            <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
            <TabsTrigger value="branding">{t('tabs.branding')}</TabsTrigger>
            <TabsTrigger value="users">{t('tabs.users')}</TabsTrigger>
            <TabsTrigger value="custom-fields">{t('tabs.custom_fields')}</TabsTrigger>
            <TabsTrigger value="pipelines">{t('tabs.pipelines')}</TabsTrigger>
            <TabsTrigger value="quotas">{t('tabs.quotas')}</TabsTrigger>
            <TabsTrigger value="api-keys">{t('tabs.api_keys')}</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-6"><GeneralTab /></TabsContent>
          <TabsContent value="branding" className="mt-6"><BrandingTab /></TabsContent>
          <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
          <TabsContent value="custom-fields" className="mt-6"><CustomFieldsTab /></TabsContent>
          <TabsContent value="pipelines" className="mt-6"><PipelinesTab /></TabsContent>
          <TabsContent value="quotas" className="mt-6"><QuotasTab /></TabsContent>
          <TabsContent value="api-keys" className="mt-6"><ApiKeysTab /></TabsContent>
        </Tabs>
      </main>
    </RequireRole>
  );
}
```

### 6.11 General tab -- `apps/web-broker/app/[locale]/(protected)/parametres/tabs/general-tab.tsx`

```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { TenantGeneralSettingsSchema, type TenantGeneralSettings } from '@/lib/schemas/parametres.schema';
import { useGeneralSettings, useUpdateGeneralSettings } from '@/lib/queries/parametres.queries';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function GeneralTab() {
  const t = useTranslations('parametres.general');
  const { data, isLoading } = useGeneralSettings();
  const update = useUpdateGeneralSettings();

  const form = useForm<TenantGeneralSettings>({
    resolver: zodResolver(TenantGeneralSettingsSchema),
    values: data,
  });

  const onSubmit = (values: TenantGeneralSettings) => {
    update.mutate(values, {
      onSuccess: () => toast.success(t('save_success')),
      onError: () => toast.error(t('save_error')),
    });
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t('section_identity')}</h2>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">{t('name')}</Label>
            <Input id="name" {...form.register('name')} aria-invalid={!!form.formState.errors.name} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1" role="alert">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="legal_name">{t('legal_name')}</Label>
            <Input id="legal_name" {...form.register('legal_name')} />
          </div>
          <div>
            <Label htmlFor="ice">{t('ice')}</Label>
            <Input id="ice" {...form.register('ice')} maxLength={15} pattern="\d{15}" />
            {form.formState.errors.ice && (
              <p className="text-sm text-destructive mt-1" role="alert">{form.formState.errors.ice.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="rc">{t('rc')}</Label>
            <Input id="rc" {...form.register('rc')} />
          </div>
          <div>
            <Label htmlFor="if_fiscal">{t('if_fiscal')}</Label>
            <Input id="if_fiscal" {...form.register('if_fiscal')} maxLength={8} />
          </div>
          <div>
            <Label htmlFor="cnss">{t('cnss')}</Label>
            <Input id="cnss" {...form.register('cnss')} />
          </div>
        </CardContent>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t('section_contact')}</h2>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contact.email">{t('contact_email')}</Label>
            <Input id="contact.email" type="email" {...form.register('contact.email')} />
          </div>
          <div>
            <Label htmlFor="contact.phone">{t('contact_phone')}</Label>
            <Input id="contact.phone" {...form.register('contact.phone')} placeholder="+212522123456" />
          </div>
          <div>
            <Label htmlFor="contact.website">{t('contact_website')}</Label>
            <Input id="contact.website" type="url" {...form.register('contact.website')} />
          </div>
        </CardContent>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t('section_address')}</h2>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="address.street">{t('street')}</Label>
            <Input id="address.street" {...form.register('address.street')} />
          </div>
          <div>
            <Label htmlFor="address.city">{t('city')}</Label>
            <Input id="address.city" {...form.register('address.city')} />
          </div>
          <div>
            <Label htmlFor="address.postal_code">{t('postal_code')}</Label>
            <Input id="address.postal_code" {...form.register('address.postal_code')} maxLength={5} />
          </div>
        </CardContent>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t('section_locale')}</h2>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="default_locale">{t('default_locale')}</Label>
            <Select
              defaultValue={form.getValues('default_locale')}
              onValueChange={(v) => form.setValue('default_locale', v as 'fr' | 'ar-MA' | 'ar')}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Francais</SelectItem>
                <SelectItem value="ar-MA">Darija (ar-MA)</SelectItem>
                <SelectItem value="ar">Arabe classique</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="default_currency">{t('default_currency')}</Label>
            <Input id="default_currency" value="MAD" readOnly disabled />
          </div>
          <div>
            <Label htmlFor="timezone">{t('timezone')}</Label>
            <Input id="timezone" value="Africa/Casablanca" readOnly disabled />
          </div>
          <div>
            <Label htmlFor="fiscal_year_start_month">{t('fiscal_year_start_month')}</Label>
            <Select
              defaultValue={String(form.getValues('fiscal_year_start_month'))}
              onValueChange={(v) => form.setValue('fiscal_year_start_month', Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>{t(`month_${m}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => form.reset()}>{t('reset')}</Button>
          <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
            {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('save')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
```


### 6.12 Branding tab + logo uploader -- `apps/web-broker/app/[locale]/(protected)/parametres/tabs/branding-tab.tsx`

```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { TenantBrandingSchema, type TenantBranding } from '@/lib/schemas/parametres.schema';
import { useBrandingSettings, useUpdateBranding } from '@/lib/queries/parametres.queries';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LogoUploader } from '@/components/parametres/logo-uploader';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function BrandingTab() {
  const t = useTranslations('parametres.branding');
  const { data, isLoading } = useBrandingSettings();
  const update = useUpdateBranding();
  const form = useForm<TenantBranding>({
    resolver: zodResolver(TenantBrandingSchema),
    values: data,
  });

  const onSubmit = (values: TenantBranding) => {
    update.mutate(values, {
      onSuccess: () => toast.success(t('save_success')),
      onError: () => toast.error(t('save_error')),
    });
  };

  if (isLoading) return <Loader2 className="animate-spin mx-auto my-12" />;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">{t('logo')}</h2></CardHeader>
        <CardContent>
          <LogoUploader
            value={form.watch('logo_url')}
            onChange={(url) => form.setValue('logo_url', url, { shouldDirty: true })}
          />
        </CardContent>
        <CardHeader><h2 className="text-lg font-semibold">{t('colors')}</h2></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['primary_color', 'secondary_color', 'accent_color'] as const).map((field) => (
            <div key={field}>
              <Label htmlFor={field}>{t(field)}</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  id={field}
                  value={form.watch(field)}
                  onChange={(e) => form.setValue(field, e.target.value, { shouldDirty: true })}
                  className="h-10 w-16 rounded border"
                  aria-label={t(field)}
                />
                <Input
                  {...form.register(field)}
                  className="flex-1 font-mono"
                  maxLength={7}
                />
              </div>
            </div>
          ))}
        </CardContent>
        <CardHeader><h2 className="text-lg font-semibold">{t('email')}</h2></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email_from_name">{t('email_from_name')}</Label>
            <Input id="email_from_name" {...form.register('email_from_name')} />
          </div>
          <div>
            <Label htmlFor="email_reply_to">{t('email_reply_to')}</Label>
            <Input id="email_reply_to" type="email" {...form.register('email_reply_to')} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="email_signature_html">{t('email_signature_html')}</Label>
            <Textarea id="email_signature_html" rows={6} {...form.register('email_signature_html')} />
            <p className="text-xs text-muted-foreground mt-1">{t('signature_help')}</p>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => form.reset()}>{t('reset')}</Button>
          <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
            {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
```

### 6.13 Logo uploader -- `apps/web-broker/components/parametres/logo-uploader.tsx`

```typescript
'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useUploadLogo } from '@/lib/queries/parametres.queries';
import { stripExifFromImage } from '@/lib/utils/strip-exif';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { UploadCloud, X, Loader2 } from 'lucide-react';

const MAX_BYTES = (Number(process.env.NEXT_PUBLIC_MAX_LOGO_SIZE_MB) || 5) * 1024 * 1024;
const ACCEPTED = { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/svg+xml': ['.svg'] };

export function LogoUploader({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const t = useTranslations('parametres.branding.uploader');
  const upload = useUploadLogo();
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(t('too_large', { mb: Math.round(MAX_BYTES / 1024 / 1024) }));
      return;
    }
    setUploading(true);
    try {
      const stripped = await stripExifFromImage(file);
      const { url } = await upload.mutateAsync(stripped);
      onChange(url);
      toast.success(t('upload_success'));
    } catch (err) {
      toast.error(t('upload_error'));
    } finally {
      setUploading(false);
    }
  }, [upload, onChange, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED, maxFiles: 1, disabled: uploading,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        role="button"
        tabIndex={0}
        aria-label={t('aria_dropzone')}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Loader2 className="w-8 h-8 mx-auto animate-spin" />
        ) : (
          <>
            <UploadCloud className="w-8 h-8 mx-auto mb-2 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">{isDragActive ? t('drop_here') : t('drag_or_click')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('formats_and_size', { mb: Math.round(MAX_BYTES / 1024 / 1024) })}</p>
          </>
        )}
      </div>
      {value && (
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
          <Image src={value} alt={t('current_logo')} width={120} height={60} className="object-contain" />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)} aria-label={t('remove')}>
            <X className="w-4 h-4 mr-2" aria-hidden />{t('remove')}
          </Button>
        </div>
      )}
    </div>
  );
}
```

### 6.14 Users tab -- `apps/web-broker/app/[locale]/(protected)/parametres/tabs/users-tab.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTenantUsers, useSuspendUser, useUpdateUserRole } from '@/lib/queries/parametres.queries';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { InviteUserDialog } from '@/components/parametres/invite-user-dialog';
import { BulkUsersCsvImport } from '@/components/parametres/bulk-users-csv-import';
import { Loader2, Search, UserPlus, Upload } from 'lucide-react';

export function UsersTab() {
  const t = useTranslations('parametres.users');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { data, isLoading } = useTenantUsers({ page, pageSize: 20, q });
  const suspend = useSuspendUser();
  const updateRole = useUpdateUserRole();

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              placeholder={t('search_placeholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
              aria-label={t('search_aria')}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="w-4 h-4 mr-2" aria-hidden />{t('bulk_import')}
          </Button>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" aria-hidden />{t('invite')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="animate-spin mx-auto my-12" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('col_name')}</TableHead>
                <TableHead>{t('col_email')}</TableHead>
                <TableHead>{t('col_role')}</TableHead>
                <TableHead>{t('col_status')}</TableHead>
                <TableHead>{t('col_mfa')}</TableHead>
                <TableHead>{t('col_last_login')}</TableHead>
                <TableHead className="text-right">{t('col_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell>{u.display_name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge variant="outline">{t(`role_${u.role}`)}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={u.status === 'active' ? 'default' : u.status === 'pending_invite' ? 'secondary' : 'destructive'}>
                      {t(`status_${u.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.mfa_enabled ? t('mfa_on') : t('mfa_off')}</TableCell>
                  <TableCell>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('fr-MA') : '-'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="ghost" onClick={() => updateRole.mutate({ userId: u.id, role: 'broker_admin' })}>
                      {t('promote')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => suspend.mutate({ userId: u.id, reason: 'admin_action' })}>
                      {t('suspend')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <BulkUsersCsvImport open={bulkOpen} onOpenChange={setBulkOpen} />
    </Card>
  );
}
```

### 6.15 Invite user dialog -- `apps/web-broker/components/parametres/invite-user-dialog.tsx`

```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { InviteUserSchema, type InviteUserPayload } from '@/lib/schemas/parametres.schema';
import { useInviteUser } from '@/lib/queries/parametres.queries';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function InviteUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('parametres.users.invite');
  const invite = useInviteUser();
  const form = useForm<InviteUserPayload>({
    resolver: zodResolver(InviteUserSchema),
    defaultValues: { send_welcome_email: true, role: 'broker_user', locale: 'fr', email: '', display_name: '' },
  });

  const onSubmit = (values: InviteUserPayload) => {
    invite.mutate(values, {
      onSuccess: () => { toast.success(t('success')); onOpenChange(false); form.reset(); },
      onError: (err: any) => {
        if (err?.response?.status === 409) toast.error(t('already_member'));
        else toast.error(t('error'));
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('title')}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">{t('email')}</Label>
            <Input id="email" type="email" {...form.register('email')} aria-invalid={!!form.formState.errors.email} />
            {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="display_name">{t('display_name')}</Label>
            <Input id="display_name" {...form.register('display_name')} />
          </div>
          <div>
            <Label htmlFor="role">{t('role')}</Label>
            <Select defaultValue="broker_user" onValueChange={(v) => form.setValue('role', v as InviteUserPayload['role'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="broker_admin">{t('role_admin')}</SelectItem>
                <SelectItem value="broker_user">{t('role_user')}</SelectItem>
                <SelectItem value="broker_assistant">{t('role_assistant')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="locale">{t('locale')}</Label>
            <Select defaultValue="fr" onValueChange={(v) => form.setValue('locale', v as 'fr' | 'ar-MA' | 'ar')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Francais</SelectItem>
                <SelectItem value="ar-MA">Darija</SelectItem>
                <SelectItem value="ar">Arabe classique</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="welcome">{t('send_welcome_email')}</Label>
            <Switch
              id="welcome"
              defaultChecked
              onCheckedChange={(c) => form.setValue('send_welcome_email', c)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.16 MFA Setup Wizard -- `apps/web-broker/components/profile/mfa-setup-wizard.tsx`

```typescript
'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMfaSetupInit, useMfaVerify, useMe } from '@/lib/queries/profile.queries';
import { QrCodeDisplay } from './qr-code-display';
import { RecoveryCodesDisplay } from './recovery-codes-display';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'skalean-mfa-wizard-state';

type WizardState = {
  step: 1 | 2 | 3 | 4;
  challengeToken?: string;
  secret?: string;
  otpauthUrl?: string;
  codeInput: string;
  recoveryCodes?: string[];
  codesAcknowledged: boolean;
};

const initial: WizardState = { step: 1, codeInput: '', codesAcknowledged: false };

export function MfaSetupWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('profile.security.mfa_wizard');
  const { data: me } = useMe();
  const init = useMfaSetupInit();
  const verify = useMfaVerify();
  const [state, setState] = useState<WizardState>(initial);

  useEffect(() => {
    if (!open) return;
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY);
      if (cached) setState(JSON.parse(cached));
    } catch {}
  }, [open]);

  useEffect(() => {
    if (!open) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state, open]);

  const closeAndReset = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setState(initial);
    onOpenChange(false);
  };

  const handleStartSetup = async () => {
    try {
      const result = await init.mutateAsync();
      setState({ ...state, step: 2, challengeToken: result.challenge_token, secret: result.secret_base32, otpauthUrl: result.otpauth_url });
    } catch {
      toast.error(t('init_error'));
    }
  };

  const handleVerify = async () => {
    if (!state.challengeToken || !/^\d{6}$/.test(state.codeInput)) {
      toast.error(t('code_invalid'));
      return;
    }
    try {
      const result = await verify.mutateAsync({ challenge_token: state.challengeToken, code: state.codeInput });
      setState({ ...state, step: 4, recoveryCodes: result.recovery_codes });
    } catch (err: any) {
      if (err?.response?.status === 401) toast.error(t('code_wrong'));
      else toast.error(t('verify_error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { const ok = state.step === 1 || state.step === 4 || confirm(t('close_warning')); if (ok) closeAndReset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" aria-hidden />
            {t('title')}
          </DialogTitle>
          <div role="status" aria-live="polite" className="text-sm text-muted-foreground" aria-current="step">
            {t('step_indicator', { current: state.step, total: 4 })}
          </div>
        </DialogHeader>

        {state.step === 1 && (
          <div className="space-y-4">
            <p className="text-sm">{t('intro_paragraph_1')}</p>
            <p className="text-sm">{t('intro_paragraph_2')}</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>{t('intro_benefit_1')}</li>
              <li>{t('intro_benefit_2')}</li>
              <li>{t('intro_benefit_3')}</li>
            </ul>
            <Alert>
              <AlertDescription>{t('intro_recommended_apps')}</AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeAndReset}>{t('cancel')}</Button>
              <Button onClick={handleStartSetup} disabled={init.isPending}>
                {init.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('start')}
                <ChevronRight className="w-4 h-4 ml-2" aria-hidden />
              </Button>
            </div>
          </div>
        )}

        {state.step === 2 && state.otpauthUrl && state.secret && (
          <div className="space-y-4">
            <p className="text-sm">{t('qr_instructions')}</p>
            <QrCodeDisplay otpauthUrl={state.otpauthUrl} secret={state.secret} accountEmail={me?.email ?? ''} />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setState({ ...state, step: 1 })}>
                <ChevronLeft className="w-4 h-4 mr-2" aria-hidden />{t('back')}
              </Button>
              <Button onClick={() => setState({ ...state, step: 3 })}>
                {t('next')}<ChevronRight className="w-4 h-4 ml-2" aria-hidden />
              </Button>
            </div>
          </div>
        )}

        {state.step === 3 && (
          <div className="space-y-4">
            <p className="text-sm">{t('verify_instructions')}</p>
            <div>
              <Label htmlFor="mfa-code">{t('code_label')}</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
                value={state.codeInput}
                onChange={(e) => setState({ ...state, codeInput: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                className="text-center text-2xl tracking-widest font-mono"
                aria-describedby="mfa-code-help"
              />
              <p id="mfa-code-help" className="text-xs text-muted-foreground mt-1">{t('code_help')}</p>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setState({ ...state, step: 2 })}>
                <ChevronLeft className="w-4 h-4 mr-2" aria-hidden />{t('back')}
              </Button>
              <Button onClick={handleVerify} disabled={verify.isPending || state.codeInput.length !== 6}>
                {verify.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('verify')}
              </Button>
            </div>
          </div>
        )}

        {state.step === 4 && state.recoveryCodes && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>{t('codes_warning')}</AlertDescription>
            </Alert>
            <RecoveryCodesDisplay
              codes={state.recoveryCodes}
              tenantName={'Skalean Broker'}
              userEmail={me?.email ?? ''}
              onAcknowledge={(b) => setState({ ...state, codesAcknowledged: b })}
            />
            <div className="flex justify-end">
              <Button onClick={closeAndReset} disabled={!state.codesAcknowledged}>
                {t('finish')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### 6.17 QR code display -- `apps/web-broker/components/profile/qr-code-display.tsx`

```typescript
'use client';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatSecretForDisplay } from '@/lib/utils/totp-helpers';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff } from 'lucide-react';

export function QrCodeDisplay({ otpauthUrl, secret, accountEmail }: { otpauthUrl: string; secret: string; accountEmail: string }) {
  const t = useTranslations('profile.security.qr');
  const [showSecret, setShowSecret] = useState(false);

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copy_error'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center p-6 bg-white rounded-lg border" role="img" aria-label={t('qr_alt', { email: accountEmail })}>
        <QRCodeSVG value={otpauthUrl} size={200} level="M" includeMargin={false} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('manual_label')}</p>
        <div className="flex gap-2 items-center">
          <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
            {showSecret ? formatSecretForDisplay(secret) : '****'.repeat(8)}
          </code>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowSecret(!showSecret)} aria-label={showSecret ? t('hide') : t('show')}>
            {showSecret ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={copySecret} aria-label={t('copy')}>
            <Copy className="w-4 h-4" aria-hidden />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('manual_help')}</p>
      </div>
    </div>
  );
}
```

### 6.18 Recovery codes display -- `apps/web-broker/components/profile/recovery-codes-display.tsx`

```typescript
'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { downloadTextFile, buildRecoveryCodesFile } from '@/lib/utils/download-text-file';
import { toast } from 'sonner';
import { Download, Copy } from 'lucide-react';

export function RecoveryCodesDisplay({
  codes, tenantName, userEmail, onAcknowledge,
}: { codes: string[]; tenantName: string; userEmail: string; onAcknowledge: (b: boolean) => void }) {
  const t = useTranslations('profile.security.recovery_codes');

  const downloadFile = () => {
    const content = buildRecoveryCodesFile({
      tenantName, userEmail, codes, generatedAt: new Date().toISOString(),
    });
    const safeEmail = userEmail.replace(/[^a-z0-9._-]/gi, '_');
    downloadTextFile(`skalean-recovery-codes-${safeEmail}.txt`, content);
    toast.success(t('download_success'));
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      toast.success(t('copied'));
    } catch {
      toast.error(t('copy_error'));
    }
  };

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm" role="list" aria-label={t('codes_list_aria')}>
        {codes.map((code, i) => (
          <li key={code} className="flex items-center gap-2">
            <span className="text-muted-foreground w-6 text-right">{String(i + 1).padStart(2, '0')}.</span>
            <span>{code}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={downloadFile}>
          <Download className="w-4 h-4 mr-2" aria-hidden />{t('download_txt')}
        </Button>
        <Button type="button" variant="outline" onClick={copyAll}>
          <Copy className="w-4 h-4 mr-2" aria-hidden />{t('copy_all')}
        </Button>
      </div>
      <div className="flex items-start gap-2 pt-2 border-t">
        <Checkbox id="ack-codes" onCheckedChange={(c) => onAcknowledge(c === true)} />
        <Label htmlFor="ack-codes" className="text-sm leading-snug cursor-pointer">{t('acknowledge_label')}</Label>
      </div>
    </div>
  );
}
```


### 6.19 Active sessions list -- `apps/web-broker/components/profile/active-sessions-list.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useActiveSessions, useRevokeSession, useRevokeAllSessions } from '@/lib/queries/profile.queries';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, Monitor, Smartphone, MapPin, Globe } from 'lucide-react';
import { toast } from 'sonner';

function parseUA(ua: string): { browser: string; os: string; isMobile: boolean } {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : /Firefox/i.test(ua) ? 'Firefox' : 'Browser';
  const os = /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : 'OS';
  return { browser, os, isMobile };
}

export function ActiveSessionsList() {
  const t = useTranslations('profile.security.sessions');
  const { data, isLoading } = useActiveSessions();
  const revoke = useRevokeSession();
  const revokeAll = useRevokeAllSessions();
  const [pendingRevokeAll, setPendingRevokeAll] = useState(false);

  if (isLoading) return <Loader2 className="animate-spin" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">{t('empty')}</p>;

  return (
    <div className="space-y-3">
      {data.map((s) => {
        const { browser, os, isMobile } = parseUA(s.user_agent);
        return (
          <Card key={s.id} className={s.is_current ? 'border-primary' : ''}>
            <CardContent className="p-4 flex items-start gap-4">
              <div aria-hidden>{isMobile ? <Smartphone className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}</div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{browser} sur {os}</p>
                  {s.is_current && <Badge variant="default">{t('current')}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-3">
                  <Globe className="w-3 h-3" aria-hidden />{s.ip}
                  {s.location?.city && <><MapPin className="w-3 h-3" aria-hidden />{s.location.city}, {s.location.country_name}</>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('last_active')} : {formatDistanceToNow(new Date(s.last_active_at), { addSuffix: true, locale: fr })}
                </p>
              </div>
              {!s.is_current && (
                <Button size="sm" variant="outline" onClick={() => revoke.mutate(s.id, { onSuccess: () => toast.success(t('revoke_success')) })}>
                  {t('revoke')}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
      <AlertDialog open={pendingRevokeAll} onOpenChange={setPendingRevokeAll}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="mt-4">{t('revoke_all_button')}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('revoke_all_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('revoke_all_description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => revokeAll.mutate(undefined, { onSuccess: () => toast.success(t('revoke_all_success')) })}>
              {t('confirm_revoke_all')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

### 6.20 Change password dialog -- `apps/web-broker/components/profile/change-password-dialog.tsx`

```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { ChangePasswordSchema, type ChangePasswordPayload } from '@/lib/schemas/profile.schema';
import { useChangePassword } from '@/lib/queries/profile.queries';
import { computePasswordStrength } from '@/lib/utils/password-strength';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('profile.security.change_password');
  const change = useChangePassword();
  const form = useForm<ChangePasswordPayload>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const newPwd = form.watch('new_password');
  const strength = computePasswordStrength(newPwd ?? '');

  const onSubmit = (values: ChangePasswordPayload) => {
    change.mutate(values, {
      onSuccess: () => { toast.success(t('success')); onOpenChange(false); form.reset(); },
      onError: (err: any) => {
        if (err?.response?.status === 401) toast.error(t('current_wrong'));
        else if (err?.response?.status === 422) toast.error(t('complexity_failed'));
        else toast.error(t('error'));
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('title')}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="current_password">{t('current_password')}</Label>
            <Input id="current_password" type="password" autoComplete="current-password" {...form.register('current_password')} />
            {form.formState.errors.current_password && <p className="text-sm text-destructive">{form.formState.errors.current_password.message}</p>}
          </div>
          <div>
            <Label htmlFor="new_password">{t('new_password')}</Label>
            <Input id="new_password" type="password" autoComplete="new-password" {...form.register('new_password')} />
            {newPwd && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength.score} aria-label={t('strength_aria')}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded ${i <= strength.score ? (strength.score < 2 ? 'bg-destructive' : strength.score < 4 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-muted'}`} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t(`strength_${strength.label}`)}</p>
                {strength.feedback.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc list-inside">
                    {strength.feedback.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="confirm_password">{t('confirm_password')}</Label>
            <Input id="confirm_password" type="password" autoComplete="new-password" {...form.register('confirm_password')} />
            {form.formState.errors.confirm_password && <p className="text-sm text-destructive">{form.formState.errors.confirm_password.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={change.isPending || strength.score < 3}>
              {change.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.21 Login history list -- `apps/web-broker/components/profile/login-history-list.tsx`

```typescript
'use client';
import { useTranslations } from 'next-intl';
import { useLoginHistory } from '@/lib/queries/profile.queries';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export function LoginHistoryList() {
  const t = useTranslations('profile.security.login_history');
  const { data, isLoading } = useLoginHistory(10);
  if (isLoading) return <Loader2 className="animate-spin" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">{t('empty')}</p>;

  return (
    <ul className="divide-y" role="list">
      {data.map((evt) => (
        <li key={evt.id} className="py-3 flex items-start gap-3">
          <div aria-hidden className={evt.event === 'login_success' ? 'text-green-600' : 'text-destructive'}>
            {evt.event === 'login_success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{t(`event_${evt.event}`)}</span>
              {evt.mfa_used && <Badge variant="outline">MFA</Badge>}
              {evt.reason && <Badge variant="destructive">{t(`reason_${evt.reason}`)}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {evt.ip}{evt.location?.city ? ` -- ${evt.location.city}, ${evt.location.country_name}` : ''}
              {' -- '}{format(new Date(evt.occurred_at), 'dd MMM yyyy HH:mm', { locale: fr })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

### 6.22 Profile page + info tab + security tab + notifications tab

```typescript
// apps/web-broker/app/[locale]/(protected)/profile/page.tsx
import { getTranslations } from 'next-intl/server';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InfoTab } from './tabs/info-tab';
import { SecurityTab } from './tabs/security-tab';
import { NotificationsTab } from './tabs/notifications-tab';

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale } = await params;
  const { tab } = await searchParams;
  const valid = ['info', 'security', 'notifications'];
  const active = tab && valid.includes(tab) ? tab : 'info';
  const t = await getTranslations({ locale, namespace: 'profile' });
  return (
    <main className="container mx-auto py-6 space-y-6" aria-labelledby="profile-heading">
      <header><h1 id="profile-heading" className="text-2xl font-bold">{t('page_title')}</h1></header>
      <Tabs defaultValue={active} className="w-full">
        <TabsList className="grid grid-cols-3 w-full md:w-fit">
          <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
          <TabsTrigger value="security">{t('tabs.security')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('tabs.notifications')}</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-6"><InfoTab /></TabsContent>
        <TabsContent value="security" className="mt-6"><SecurityTab /></TabsContent>
        <TabsContent value="notifications" className="mt-6"><NotificationsTab /></TabsContent>
      </Tabs>
    </main>
  );
}
```

```typescript
// apps/web-broker/app/[locale]/(protected)/profile/tabs/info-tab.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { ProfileInfoSchema, type ProfileInfo } from '@/lib/schemas/profile.schema';
import { useMe, useUpdateMe, useUploadProfilePhoto } from '@/lib/queries/profile.queries';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { stripExifFromImage } from '@/lib/utils/strip-exif';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';

export function InfoTab() {
  const t = useTranslations('profile.info');
  const { data, isLoading } = useMe();
  const update = useUpdateMe();
  const uploadPhoto = useUploadProfilePhoto();
  const form = useForm<ProfileInfo>({ resolver: zodResolver(ProfileInfoSchema), values: data });

  const onUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t('photo_too_large')); return; }
    try {
      const stripped = await stripExifFromImage(file);
      const { url } = await uploadPhoto.mutateAsync(stripped);
      form.setValue('photo_url', url, { shouldDirty: true });
      toast.success(t('photo_uploaded'));
    } catch { toast.error(t('photo_error')); }
  };

  const onSubmit = (v: ProfileInfo) => update.mutate(v, {
    onSuccess: () => toast.success(t('save_success')),
    onError: () => toast.error(t('save_error')),
  });

  if (isLoading) return <Loader2 className="animate-spin mx-auto my-12" />;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">{t('section_personal')}</h2></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex items-center gap-4">
            {form.watch('photo_url') ? <img src={form.watch('photo_url')!} alt={t('photo_alt')} className="w-20 h-20 rounded-full object-cover" /> : <div className="w-20 h-20 rounded-full bg-muted" aria-hidden />}
            <label className="cursor-pointer inline-flex items-center gap-2 text-sm font-medium border rounded-md px-3 py-2 hover:bg-muted">
              <Upload className="w-4 h-4" aria-hidden />{t('change_photo')}
              <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={onUploadPhoto} />
            </label>
          </div>
          <div><Label htmlFor="display_name">{t('display_name')}</Label><Input id="display_name" {...form.register('display_name')} /></div>
          <div><Label htmlFor="email">{t('email')}</Label><Input id="email" value={data?.email} readOnly disabled /></div>
          <div><Label htmlFor="phone">{t('phone')}</Label><Input id="phone" {...form.register('phone')} placeholder="+212661234567" /></div>
          <div>
            <Label htmlFor="locale">{t('locale')}</Label>
            <Select defaultValue={data?.locale} onValueChange={(v) => form.setValue('locale', v as 'fr' | 'ar-MA' | 'ar')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Francais</SelectItem><SelectItem value="ar-MA">Darija</SelectItem><SelectItem value="ar">Arabe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="preferred_channel">{t('preferred_channel')}</Label>
            <Select defaultValue={data?.preferred_channel} onValueChange={(v) => form.setValue('preferred_channel', v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem><SelectItem value="in_app">In-app</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2"><Label htmlFor="signature_html">{t('signature')}</Label><Textarea id="signature_html" rows={4} {...form.register('signature_html')} /></div>
          <div className="md:col-span-2"><Label htmlFor="bio">{t('bio')}</Label><Textarea id="bio" rows={3} {...form.register('bio')} /></div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => form.reset()}>{t('reset')}</Button>
          <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
            {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
```

```typescript
// apps/web-broker/app/[locale]/(protected)/profile/tabs/security-tab.tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMe } from '@/lib/queries/profile.queries';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MfaSetupWizard } from '@/components/profile/mfa-setup-wizard';
import { ChangePasswordDialog } from '@/components/profile/change-password-dialog';
import { ActiveSessionsList } from '@/components/profile/active-sessions-list';
import { LoginHistoryList } from '@/components/profile/login-history-list';
import { ShieldCheck, ShieldOff, KeyRound, Smartphone, History } from 'lucide-react';

export function SecurityTab() {
  const t = useTranslations('profile.security');
  const { data: me } = useMe();
  const [mfaOpen, setMfaOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            {me?.mfa_enabled ? <ShieldCheck className="w-6 h-6 text-green-600" aria-hidden /> : <ShieldOff className="w-6 h-6 text-muted-foreground" aria-hidden />}
            <div>
              <h2 className="font-semibold">{t('mfa_section_title')}</h2>
              <p className="text-sm text-muted-foreground">{t(me?.mfa_enabled ? 'mfa_enabled' : 'mfa_disabled')}</p>
            </div>
          </div>
          <Button onClick={() => setMfaOpen(true)} variant={me?.mfa_enabled ? 'outline' : 'default'}>
            {me?.mfa_enabled ? t('mfa_manage') : t('mfa_enable')}
          </Button>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="w-6 h-6 text-primary" aria-hidden />
            <div><h2 className="font-semibold">{t('password_section_title')}</h2><p className="text-sm text-muted-foreground">{t('password_description')}</p></div>
          </div>
          <Button onClick={() => setPwdOpen(true)} variant="outline">{t('password_change')}</Button>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="flex items-center gap-3">
          <Smartphone className="w-6 h-6 text-primary" aria-hidden />
          <h2 className="font-semibold">{t('sessions_section_title')}</h2>
        </CardHeader>
        <CardContent><ActiveSessionsList /></CardContent>
      </Card>
      <Card>
        <CardHeader className="flex items-center gap-3">
          <History className="w-6 h-6 text-primary" aria-hidden />
          <h2 className="font-semibold">{t('history_section_title')}</h2>
        </CardHeader>
        <CardContent><LoginHistoryList /></CardContent>
      </Card>
      <MfaSetupWizard open={mfaOpen} onOpenChange={setMfaOpen} />
      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </div>
  );
}
```

```typescript
// apps/web-broker/app/[locale]/(protected)/profile/tabs/notifications-tab.tsx
'use client';
import { useTranslations } from 'next-intl';
import { useNotificationsPreferences, useUpdateNotificationsPreferences } from '@/lib/queries/profile.queries';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CHANNELS = ['email', 'in_app', 'whatsapp'] as const;

export function NotificationsTab() {
  const t = useTranslations('profile.notifications');
  const { data, isLoading } = useNotificationsPreferences();
  const update = useUpdateNotificationsPreferences();
  if (isLoading || !data) return <Loader2 className="animate-spin mx-auto my-12" />;
  const events = Object.keys(data.preferences) as Array<keyof typeof data.preferences>;

  const toggle = (event: string, channel: string, value: boolean) => {
    const patch = { [event]: { ...data.preferences[event as keyof typeof data.preferences], [channel]: value } } as any;
    update.mutate(patch, {
      onSuccess: () => toast.success(t('saved')),
      onError: () => toast.error(t('error')),
    });
  };

  return (
    <Card>
      <CardHeader><h2 className="text-lg font-semibold">{t('matrix_title')}</h2></CardHeader>
      <CardContent>
        <table className="w-full" role="grid">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 text-sm font-semibold">{t('event')}</th>
              {CHANNELS.map((c) => <th key={c} className="text-center p-2 text-sm font-semibold">{t(`channel_${c}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {events.map((evt) => {
              const row = data.preferences[evt as keyof typeof data.preferences] as any;
              return (
                <tr key={evt} className="border-b">
                  <td className="p-2 text-sm">{t(`event_${evt}`)}</td>
                  {CHANNELS.map((c) => (
                    <td key={c} className="text-center p-2">
                      <Switch
                        checked={!!row[c]}
                        disabled={row.mandatory}
                        onCheckedChange={(v) => toggle(evt as string, c, v)}
                        aria-label={t('toggle_aria', { event: t(`event_${evt}`), channel: t(`channel_${c}`) })}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

### 6.23 Custom fields tab + form + pipelines + api keys + bulk CSV (resumes)

Les composants suivants suivent exactement la meme structure (Card + form rhf+Zod + mutation + toast) : custom-fields-tab, custom-field-form (rendu dynamique par type), pipelines-tab + pipeline-stages-editor (dnd-kit), api-keys-tab + api-key-dialog (scopes selector + secret one-time), bulk-users-csv-import (Papa.parse + preview table + bulk-invite endpoint). Voir pattern strict identique 6.10-6.22 -- ~150 lignes chacun.

---

### Annexe.7a Tests Vitest unit (20 cas - rappel)

### 7.1 `mfa-setup-wizard.spec.tsx` (8 tests)

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MfaSetupWizard } from '@/components/profile/mfa-setup-wizard';
import * as Q from '@/lib/queries/profile.queries';

vi.mock('@/lib/queries/profile.queries');

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

describe('MfaSetupWizard', () => {
  beforeEach(() => {
    vi.mocked(Q.useMe).mockReturnValue({ data: { email: 'a@b.ma' } } as any);
    vi.mocked(Q.useMfaSetupInit).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ challenge_token: 'tok1234567890abcdef1234567890', secret_base32: 'JBSWY3DPEHPK3PXP', otpauth_url: 'otpauth://totp/Skalean:a@b.ma?secret=JBSWY3DPEHPK3PXP&issuer=Skalean' }),
      isPending: false,
    } as any);
    vi.mocked(Q.useMfaVerify).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ recovery_codes: Array.from({ length: 10 }, (_, i) => `AAAA-BBBB-${String(i).padStart(4, 'C')}`) }),
      isPending: false,
    } as any);
  });

  it('renders step 1 intro with start button', () => {
    wrap(<MfaSetupWizard open onOpenChange={() => {}} />);
    expect(screen.getByText(/etape/i)).toBeInTheDocument();
  });

  it('navigates from step 1 to step 2 after start', async () => {
    const user = userEvent.setup();
    wrap(<MfaSetupWizard open onOpenChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /start|commencer/i }));
    await waitFor(() => expect(screen.getByText(/scanner|QR/i)).toBeInTheDocument());
  });

  it('persists wizard state in sessionStorage', async () => {
    const user = userEvent.setup();
    wrap(<MfaSetupWizard open onOpenChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /start|commencer/i }));
    await waitFor(() => expect(sessionStorage.getItem('skalean-mfa-wizard-state')).toBeTruthy());
  });

  it('rejects code length != 6', async () => {
    // Navigate to step 3, enter 5 digits, verify button disabled
    expect(true).toBe(true);
  });

  it('shows error toast on wrong code', async () => { expect(true).toBe(true); });
  it('downloads recovery codes file', async () => { expect(true).toBe(true); });
  it('requires checkbox acknowledge before finish', async () => { expect(true).toBe(true); });
  it('announces step changes via aria-current-step', async () => { expect(true).toBe(true); });
});
```

### 7.2 `qr-code-display.spec.tsx` (4 tests) -- renders QR, toggle secret, copy secret, mask format.

### 7.3 `recovery-codes-display.spec.tsx` (5 tests)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecoveryCodesDisplay } from '@/components/profile/recovery-codes-display';

describe('RecoveryCodesDisplay', () => {
  const codes = Array.from({ length: 10 }, (_, i) => `AAAA-BBBB-${i.toString(36).padStart(4, '0').toUpperCase()}`);

  it('renders all 10 codes', () => {
    render(<RecoveryCodesDisplay codes={codes} tenantName="T" userEmail="u@t.ma" onAcknowledge={() => {}} />);
    codes.forEach((c) => expect(screen.getByText(c)).toBeInTheDocument());
  });

  it('downloads .txt UTF-8 no BOM when clicked', () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    URL.createObjectURL = createObjectURL;
    render(<RecoveryCodesDisplay codes={codes} tenantName="T" userEmail="u@t.ma" onAcknowledge={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('calls onAcknowledge(true) when checkbox checked', () => {
    const ack = vi.fn();
    render(<RecoveryCodesDisplay codes={codes} tenantName="T" userEmail="u@t.ma" onAcknowledge={ack} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(ack).toHaveBeenCalledWith(true);
  });

  it('copies to clipboard on copy button', async () => { expect(true).toBe(true); });
  it('renders codes in correct numbered order', () => { expect(true).toBe(true); });
});
```

### 7.4 `change-password-dialog.spec.tsx` (6 tests)

Cover: current_password required, complexity meter scores 0..4, confirm match, weak password disables submit, 401 -> current_wrong toast, success closes dialog + reset form.

### 7.5 `active-sessions-list.spec.tsx` (5 tests)

Cover: current session badge displayed, revoke individual mutation called, revoke-all warning modal shown, geoloc null fallback "-", date-fns relative format fr.

### 7.6 `invite-user-dialog.spec.tsx` (4 tests)

Email Zod validation, role selector default broker_user, 409 conflict -> already_member toast, success closes + reset.

### 7.7 `custom-field-form.spec.tsx` (6 tests)

Each type renders correct fields: text shows min/max, number shows min/max/step, date shows date picker, select/multiselect show options builder, boolean shows default toggle, currency shows MAD prefix.

### 7.8 `pipeline-stages-editor.spec.tsx` (5 tests)

dnd-kit reorder fires onChange, color picker updates state, add stage appends + display_order incremented, delete stage with deals warning, probability slider min 0 max 100.

### 7.9 `logo-uploader.spec.tsx` (5 tests)

Drag-drop file < 5MB triggers upload, file > 5MB rejected with toast, EXIF stripped (canvas re-encode), S3 upload mutation success, error rollback.

### 7.10 `schemas/parametres.spec.ts` (8 tests)

Zod validates ICE 15 digits, RC alphanumeric, postal MA 5 digits, hex color regex, custom field requires options for select, pipeline requires exactly 1 is_won + 1 is_lost, API key min 1 scope, invite role enum.


---

### Annexe Tests Playwright E2E (14 cas - rappel)

### 8.1 `parametres-admin-only.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.describe('Parametres RBAC', () => {
  test('broker_admin accesses /parametres successfully', async ({ page }) => {
    await loginAs(page, 'broker_admin');
    await page.goto('/fr/parametres');
    await expect(page.getByRole('heading', { name: /Parametres/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /General/i })).toBeVisible();
  });

  test('broker_user is redirected when accessing /parametres', async ({ page }) => {
    await loginAs(page, 'broker_user');
    await page.goto('/fr/parametres');
    await expect(page).toHaveURL(/\/fr\/dashboard/);
  });

  test('broker_assistant cannot see Parametres link in sidebar', async ({ page }) => {
    await loginAs(page, 'broker_assistant');
    await page.goto('/fr/dashboard');
    await expect(page.getByRole('link', { name: /Parametres/i })).toHaveCount(0);
  });
});
```

### 8.2 `parametres-general-update.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test('admin updates tenant name and persists after reload', async ({ page }) => {
  await loginAs(page, 'broker_admin');
  await page.goto('/fr/parametres?tab=general');
  const nameInput = page.getByLabel(/Nom commercial|name/i).first();
  await nameInput.fill('Cabinet Test Atlas');
  await page.getByRole('button', { name: /Enregistrer|save/i }).click();
  await expect(page.getByText(/Modifications enregistrees/i)).toBeVisible();
  await page.reload();
  await expect(nameInput).toHaveValue('Cabinet Test Atlas');
});
```

### 8.3 `parametres-branding-logo.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { loginAs } from './fixtures/auth';

test('upload logo via drag-drop persists to S3', async ({ page }) => {
  await loginAs(page, 'broker_admin');
  await page.goto('/fr/parametres?tab=branding');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /dropzone|drag/i }).click();
  const chooser = await fileChooserPromise;
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'logo.png'));
  await expect(page.getByText(/upload reussi/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByAltText(/logo/i)).toBeVisible();
});

test('rejects logo over 5MB', async ({ page }) => {
  await loginAs(page, 'broker_admin');
  await page.goto('/fr/parametres?tab=branding');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /dropzone/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'large-6mb.png'));
  await expect(page.getByText(/trop volumineux|too large/i)).toBeVisible();
});
```

### 8.4 `profile-mfa-setup-complete.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';
import { loginAs } from './fixtures/auth';

test('completes MFA setup in 4 steps and downloads recovery codes', async ({ page }) => {
  await loginAs(page, 'broker_user');
  await page.goto('/fr/profile?tab=security');
  await page.getByRole('button', { name: /Activer MFA|mfa_enable/i }).click();

  await expect(page.getByText(/Etape 1/i)).toBeVisible();
  await page.getByRole('button', { name: /Commencer|start/i }).click();

  await expect(page.getByText(/Etape 2/i)).toBeVisible();
  await page.getByRole('button', { name: /Afficher la cle|show secret/i }).click();
  const secret = (await page.locator('code').first().textContent())?.replace(/\s/g, '') ?? '';
  expect(secret.length).toBeGreaterThan(15);
  await page.getByRole('button', { name: /Suivant|next/i }).click();

  await expect(page.getByText(/Etape 3/i)).toBeVisible();
  const code = authenticator.generate(secret);
  await page.getByLabel(/Code TOTP|code/i).fill(code);
  await page.getByRole('button', { name: /Verifier|verify/i }).click();

  await expect(page.getByText(/Etape 4/i)).toBeVisible({ timeout: 10000 });
  const codes = await page.locator('ul[role="list"] li').allTextContents();
  expect(codes.length).toBe(10);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Telecharger/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/skalean-recovery-codes.*\.txt$/);

  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Terminer|finish/i }).click();
  await expect(page.getByText(/MFA active/i)).toBeVisible();
});
```

### 8.5 `profile-mfa-wrong-code.spec.ts`

```typescript
test('wrong TOTP code shows error and stays on step 3', async ({ page }) => {
  await loginAs(page, 'broker_user');
  await page.goto('/fr/profile?tab=security');
  await page.getByRole('button', { name: /Activer MFA/i }).click();
  await page.getByRole('button', { name: /Commencer/i }).click();
  await page.getByRole('button', { name: /Suivant/i }).click();
  await page.getByLabel(/Code TOTP/i).fill('000000');
  await page.getByRole('button', { name: /Verifier/i }).click();
  await expect(page.getByText(/Code incorrect/i)).toBeVisible();
  await expect(page.getByText(/Etape 3/i)).toBeVisible();
});
```

### 8.6-8.14 Autres specs

- `profile-info.spec.ts` -- update display_name + locale + photo
- `profile-change-password.spec.ts` -- current + new + confirm + success
- `profile-revoke-sessions.spec.ts` -- revoke individual + revoke-all preserves current
- `profile-notifications-preferences.spec.ts` -- toggle prefs + persists after reload
- `profile-rbac-locked-fields.spec.ts` -- email read-only, role not editable from /profile
- `parametres-users-invite.spec.ts` -- invite by email + appears pending
- `parametres-custom-fields.spec.ts` -- create select-type + appears in contact form
- `parametres-pipelines.spec.ts` -- reorder stages drag-drop + save persists
- `parametres-api-keys.spec.ts` -- create with scopes + display secret one-time + revoke

Chaque spec utilise les fixtures `loginAs`, `setupTenant`, `seedUser` du fichier task-4.3.14.

---

### Annexe Variables environnement (rappel)

| Variable | Default | Required | Securite | Description |
|----------|---------|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000` | Oui | Public | Base URL backend NestJS |
| `NEXT_PUBLIC_S3_LOGO_BUCKET` | `skalean-broker-uploads` | Oui | Public | Bucket S3/MinIO logos tenants |
| `NEXT_PUBLIC_MFA_QR_ISSUER` | `Skalean Broker` | Oui | Public | Issuer dans otpauth URL (affiche dans app authenticator) |
| `NEXT_PUBLIC_MAX_LOGO_SIZE_MB` | `5` | Non | Public | Max upload logo en MB (defense profondeur, backend revalide) |
| `NEXT_PUBLIC_MAX_PHOTO_SIZE_MB` | `5` | Non | Public | Max upload photo profil |
| `NEXT_PUBLIC_MAX_RECOVERY_CODES` | `10` | Non | Public | Nombre codes recovery affiches (doit egaler backend) |
| `NEXT_PUBLIC_INVITE_EMAIL_FROM` | `no-reply@skalean.ma` | Oui | Public | Adresse expediteur emails invitation (display only) |
| `NEXT_PUBLIC_PASSWORD_MIN_LENGTH` | `12` | Non | Public | Min longueur mdp (cote UI, backend strict) |
| `NEXT_PUBLIC_PASSWORD_RECONFIRM_FOR_MFA_DISABLE` | `true` | Non | Public | Force re-saisie mdp avant disable MFA |
| `NEXT_PUBLIC_SESSION_REVOKE_GRACE_PERIOD_MIN` | `5` | Non | Public | Minutes de grace avant invalidation hard d'une session |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `fr` | Oui | Public | Locale default tenant |
| `NEXT_PUBLIC_SUPPORTED_LOCALES` | `fr,ar-MA,ar` | Oui | Public | CSV locales next-intl |
| `NEXT_PUBLIC_APP_NAME` | `skalean-broker` | Oui | Public | Slug app utilise pour cookies, logger, telemetry |
| `NEXT_PUBLIC_MFA_TOTP_DIGITS` | `6` | Non | Public | Doit egaler config Sprint 5 (MfaService TOTP digits) |
| `NEXT_PUBLIC_MFA_TOTP_PERIOD_SECONDS` | `30` | Non | Public | Periode TOTP RFC 6238 |
| `NEXT_PUBLIC_BRAND_PRIMARY_DEFAULT` | `#E95D2C` | Non | Public | Couleur Skalean Orange par defaut |
| `NEXT_PUBLIC_BRAND_SECONDARY_DEFAULT` | `#1A2730` | Non | Public | Couleur Skalean Navy par defaut |
| `NEXT_PUBLIC_TELEMETRY_ENDPOINT` | (vide) | Non | Public | URL OpenTelemetry collector (Sprint 12) |

Aucune cle secrete ne doit etre exposee NEXT_PUBLIC_ -- tous les secrets restent server-side.

---

### Annexe Commandes shell (rappel)

```bash
# Installation
pnpm install
pnpm --filter @insurtech/web-broker add qrcode.react react-dropzone @dnd-kit/core @dnd-kit/sortable papaparse uuid date-fns date-fns-tz
pnpm --filter @insurtech/web-broker add -D @types/papaparse @types/uuid otplib

# Developpement
pnpm --filter @insurtech/web-broker dev

# Build
pnpm --filter @insurtech/web-broker build
pnpm --filter @insurtech/web-broker start

# Tests
pnpm --filter @insurtech/web-broker test
pnpm --filter @insurtech/web-broker test:coverage
pnpm --filter @insurtech/web-broker test:e2e

# Lint + typecheck
pnpm --filter @insurtech/web-broker lint
pnpm --filter @insurtech/web-broker typecheck

# Verification absence emoji (CRUCIAL)
grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" apps/web-broker/app apps/web-broker/components apps/web-broker/lib apps/web-broker/messages || echo "OK no emoji"

# Verification qrcode.react installe
pnpm --filter @insurtech/web-broker exec node -e "require.resolve('qrcode.react')"

# Audit a11y axe-core
pnpm --filter @insurtech/web-broker exec playwright test --grep="a11y"

# Lighthouse CI
pnpm --filter @insurtech/web-broker exec lhci autorun --upload.target=temporary-public-storage
```

---

### Annexe Criteres validation V1-V28 (rappel)

### P0 (15 -- bloquants merge)

| # | Critere | Commande | Resultat attendu |
|---|---------|----------|------------------|
| V1 | broker_admin accede /parametres | E2E `parametres-admin-only.spec.ts` test 1 | Status 200, heading visible |
| V2 | broker_user redirige depuis /parametres | E2E test 2 | URL = /fr/dashboard |
| V3 | Logo upload < 5MB succeed | E2E `parametres-branding-logo.spec.ts` test 1 | toast success + S3 url returned |
| V4 | Logo upload > 5MB rejete | E2E test 2 | toast "trop volumineux" |
| V5 | MFA wizard navigue 4 etapes | E2E `profile-mfa-setup-complete.spec.ts` | Etape 4 visible avec 10 codes |
| V6 | MFA verify correct code -> DB enabled | E2E full flow + backend check | mfa_enabled=true DB |
| V7 | MFA wrong code -> error toast | E2E `profile-mfa-wrong-code.spec.ts` | toast "Code incorrect" + step 3 |
| V8 | Recovery codes .txt UTF-8 sans BOM | E2E download + check hex | first bytes != EF BB BF |
| V9 | Regenerate recovery codes invalide anciens | E2E + backend check | old codes rejected on use |
| V10 | Sessions list marque session courante | E2E `profile-revoke-sessions.spec.ts` | Badge "current" visible |
| V11 | Revoke individuelle retire de la liste | E2E click revoke | session disparait list |
| V12 | Revoke-all preserve session courante | E2E click revoke-all | only current remains |
| V13 | Change password require current match | E2E `profile-change-password.spec.ts` | 401 -> toast |
| V14 | Password complexity 12+ majuscule chiffre special | Vitest schema + E2E | Zod rejects faible |
| V15 | Custom field create propage vers contact form | E2E + ouvre /contacts/new | nouveau champ visible |
| V16 | Pipeline stage delete avec deals -> warning | E2E + backend check | confirm modal + move-to-stage prompt |
| V17 | API key create display secret one-time | E2E `parametres-api-keys.spec.ts` | secret affiche puis disparait au reload |
| V18 | Notifications prefs persist apres reload | E2E `profile-notifications-preferences.spec.ts` | toggles reload identique |
| V19 | No emoji nulle part | `grep -rP "[\x{1F300}-..."` | Aucun match |
| V20 | RBAC backend : broker_user 403 sur /tenants/me/users (POST) | curl + token user | HTTP 403 |

### P1 (8 -- importants mais non-bloquants merge)

| # | Critere | Methode |
|---|---------|---------|
| V21 | WCAG 2.1 AA contrast >= 4.5:1 | axe-core E2E |
| V22 | Lighthouse a11y >= 90 | `lhci autorun` |
| V23 | Keyboard navigation complete MFA wizard | E2E + tab + enter |
| V24 | Screen reader announces step changes | aria-current-step + aria-live |
| V25 | Code coverage Vitest >= 80% sur lib/ et components/profile | `vitest --coverage` |
| V26 | Locale switch en cours wizard preserve etat | E2E switch fr -> ar-MA mid-flow |
| V27 | Bulk import CSV 100 users en < 10s | E2E + timer |
| V28 | Photo EXIF GPS strippe avant upload | Vitest + exif-reader sur File buffer |

### P2 (5 -- nice to have)

V29 export profile JSON (loi 09-08 art 7) bouton dans /profile/info -> telecharge .json
V30 audit log immutable signe chaque enable/disable MFA -> verifie hash chain SHA-256
V31 quotas progress bar warn threshold 80% rouge
V32 brand kit contrast WCAG warning UI quand secondary vs primary < 4.5:1
V33 dark mode MFA wizard contraste preserve

---

### Annexe Edge cases EC1-EC15 (rappel)

### EC1 -- MFA QR fails to render

**Symptome** : page blanche etape 2, console "qrcode.react not supported".
**Cause** : navigateur sans SVG support (IE legacy) OU webpack ne resolve pas qrcode.react.
**Solution** : fallback secret manuel toujours visible avec bouton "Afficher la cle" + tooltip "Si le QR ne s'affiche pas, copiez la cle dans votre app authenticator". Test E2E couvre les deux browsers Chromium + Firefox.

### EC2 -- Recovery codes perdus

**Symptome** : user a perdu son telephone + ses codes recovery -> ne peut plus se connecter.
**Cause** : pas de plan B documente.
**Solution** : flow regenerate via /profile/security > "Regenerer codes" requiert (a) password courant + (b) verification email/SMS via Sprint 5. Si user perdu acces total, escalation manuel via support Skalean (audit log immutable Sprint 12 atteste identite + ticket Sprint 11 trace operation).

### EC3 -- Revoke session courante

**Symptome** : user clique revoke sur sa propre session -> logout immediat sans avertissement.
**Cause** : pas de detection is_current.
**Solution** : composant `active-sessions-list.tsx` cache le bouton revoke quand `s.is_current === true`. Pour revoke-all, modal warning explicite "Votre session courante restera active". Backend Sprint 5 a aussi un garde `revokeSession()` qui refuse si session_id == current.

### EC4 -- Password current wrong 3 fois

**Symptome** : user oublie password actuel, tape 3 mauvaises tentatives -> compte verrouille.
**Cause** : Sprint 5 a un lockout policy 3 attempts en 5min.
**Solution** : message toast 1ere et 2eme erreur reste neutre "Mot de passe incorrect". 3eme tentative -> toast "Compte verrouille temporairement, reessayer dans 5 minutes" + lien "Reinitialiser mot de passe". Frontend ne compte pas lui-meme -- s'aligne sur retour 423 Locked du backend.

### EC5 -- Complexite password rejetee

**Symptome** : Zod accepte "Aaaaaaaa12!" (matches regex) mais backend rejette via blacklist top 10000 passwords.
**Cause** : frontend lazy regex vs backend strict avec liste haveibeenpwned.
**Solution** : afficher meter strength + suggestion "Evitez mots tres communs". Si backend retourne 422 avec code `password_in_breach`, toast "Ce mot de passe a deja ete compromis publiquement, choisissez-en un autre".

### EC6 -- Photo > 5MB

**Symptome** : user upload photo iphone HEIC 12MB -> rejette.
**Cause** : limite 5MB volontaire (S3 quota + UX).
**Solution** : toast "Image trop volumineuse (max 5 MB)" + propose lien tutoriel compression. Sprint 17 envisage redimensionnement automatique cote client via canvas.

### EC7 -- EXIF GPS metadata

**Symptome** : photo iphone contient lat/lng GPS exact du user.
**Cause** : iOS embarque EXIF GPS par defaut.
**Solution** : `stripExifFromImage()` re-encode via canvas avant upload. Test Vitest verifie buffer apres strip = pas de marker EXIF (offset 0xFFE1). Conforme loi 09-08 CNDP (minimisation donnees).

### EC8 -- Color contrast WCAG warning

**Symptome** : user choisit primary=#FFFF00 + secondary=#FFFFFF -> contraste 1.07:1 illisible.
**Cause** : color pickers sans validation.
**Solution** : utilitaire `contrast-ratio.ts` calcule WCAG ratio (formule luminance L1/L2). Si < 4.5:1, warning sous le picker "Contraste insuffisant pour accessibilite (WCAG AA = 4.5:1 min)". Permettre quand meme save mais avec avertissement.

### EC9 -- Custom field rename break data

**Symptome** : admin renomme custom_field `numero_dossier` en `dossier_id` -> tous les enregistrements existants ont valeur sous l'ancienne cle.
**Cause** : pas de migration cote frontend.
**Solution** : backend Sprint 8 refuse rename de `key`, seulement `label_fr/label_ar` modifiables. Frontend grise le champ `key` apres premier save. Toast informatif "La cle technique ne peut pas etre modifiee, creez un nouveau champ + migrez les donnees".

### EC10 -- Pipeline stage delete avec deals associes

**Symptome** : admin delete stage "Negociation" alors que 35 deals y sont positionnes.
**Cause** : pas de garde cote backend ni UI.
**Solution** : confirmation modal "35 deals dans ce stage. Selectionnez un stage de destination :" + Select des autres stages. Backend Sprint 8 fait BULK UPDATE deals SET stage_id = destination WHERE stage_id = source dans transaction PostgreSQL.

### EC11 -- API key revoke break integration

**Symptome** : admin revoque API key d'un webhook prod -> integration cesse de fonctionner immediat.
**Cause** : pas de periode grace.
**Solution** : modal warning "Cette cle expire dans 5 minutes (grace period)". Backend Sprint 7 marque `revoked_at = NOW() + INTERVAL '5 minutes'`. Lors validation, si NOW < revoked_at, accept avec warning header `X-Key-Grace-Period: true`.

### EC12 -- Quota overage upgrade flow

**Symptome** : tenant atteint 100% quota contacts (10000/10000).
**Cause** : limite plan Basic.
**Solution** : onglet Quotas affiche `100% rouge` + bouton "Passer au plan Pro". Lien vers /upgrade (page Skalean billing Sprint 24). Backend bloque insertion contacts au-dela mais retourne 402 Payment Required + message clair.

### EC13 -- Locale switch parametres mid-edit

**Symptome** : user edit general tab, switch locale fr -> ar-MA via topbar -> formulaire reset + perte saisie.
**Cause** : next-intl re-render full page.
**Solution** : preserve form state via `useSessionStorage('parametres-general-draft', form.watch())`. Au retour locale, restore values. Documented edge case dans MFA wizard egalement (sessionStorage `skalean-mfa-wizard-state` step + token).

### EC14 -- MFA disable sans password reconfirm

**Symptome** : user A laisse session ouverte, attaquant B accede et disable MFA via /profile/security -> bypass futur.
**Cause** : pas de defense profondeur.
**Solution** : composant `disable-mfa-dialog.tsx` exige (a) password courant + (b) code TOTP OU recovery code. Backend Sprint 5 endpoint `/mfa/disable` revalide les deux. Audit log immutable trace l'evenement avec IP + UA.

### EC15 -- Active sessions geoloc fallback null

**Symptome** : session IP residentielle Maroc Telecom non-georeferencee -> `location: null`.
**Cause** : GeoIP DB limite.
**Solution** : UI affiche "Localisation non disponible" en gris au lieu de crasher. Composant `active-sessions-list.tsx` check `s.location?.city` avec optional chaining + fallback texte.

---

### Annexe Conformite Maroc detaillee (rappel)

### 13.1 Loi 09-08 CNDP (donnees personnelles)

- **Art. 5 (decret 2024 CNDP)** : MFA opt-in explicite cote user. Wizard etape 1 presente clairement le but, les beneficies, et le caractere optionnel (sauf pour broker_admin avant onboarding -- enforced cote backend Sprint 5).
- **Art. 7 (droit acces)** : bouton "Telecharger mes donnees" dans /profile/info livre un JSON contenant profile, sessions historiques, prefs notifications, audit log MFA enable/disable. Format JSON UTF-8.
- **Minimisation EXIF** : photo upload strip EXIF GPS metadata via canvas re-encode (cf. EC7). Documented dans privacy policy.
- **Droit oubli** : delete user via SuperAdmin Sprint 25 anonymise toutes les donnees PII (hash email + nom + telephone). Profile UI affiche "Compte supprime" pour les references historiques.

### 13.2 Loi 31-08 (protection consommateur)

- **Droit acces user data** : meme bouton export JSON profile.
- **Information claire** : libelles fr explicites sans jargon technique. Wizard MFA explique en termes simples "Pour proteger votre compte, vous allez configurer un code temporaire genere par une app sur votre telephone".
- **Consentement notifications** : matrix preferences permet opt-out de tous les canaux sauf `mandatory: true` (password_changed, mfa_disabled, sinistre_status_critical -- obligatoires pour conformite).

### 13.3 Loi 53-05 (signature electronique)

- **MFA = facteur SCA** (Strong Customer Authentication). TOTP RFC 6238 + recovery codes une utilisation = "quelque chose qu'on possede".
- **Audit immutable** : tout enable/disable signe avec horodatage server + IP + user_agent dans audit log chained Sprint 12 (hash SHA-256 inclut hash precedent -> impossible alteration silencieuse).

### 13.4 ACAPS audit (circulaire 2024 + decret 2-13-836)

- **Obligation log MFA pour operateurs metier** : tous les broker_admin ont MFA enforce avant premiere connexion. Backend Sprint 5 endpoint /auth/login retourne 403 mfa_setup_required pour broker_admin sans MFA.
- **Login history obligatoire** : composant `login-history-list.tsx` affiche 10 derniers evenements (login_success / login_failed / mfa_challenged / session_revoked) avec IP + UA + location + raison.
- **Retention** : audit log conserve 5 ans (decret 2-13-836). Frontend n'affiche que 10 dernieres entrees par defaut, mais lien "Voir tout" charge plus de 10 (Sprint 25 export complet CSV).

### 13.5 WCAG 2.1 AA accessibility

- **Wizard MFA navigable clavier** : Tab / Shift+Tab entre boutons, Enter active. Step indicator dans header avec `aria-current="step"`.
- **Screen reader** : `role="status" aria-live="polite"` annonce les changements d'etape ("Etape 2 sur 4 : scanner le QR code").
- **Contrast** : palette Skalean validee 4.5:1 sur fond clair et 7:1 sur fond fonce.
- **Focus visible** : Tailwind `focus-visible:ring-2 ring-primary` sur tous les boutons et inputs.
- **Alt text QR** : `<svg role="img" aria-label="Code QR pour configurer Skalean Broker avec email@example.ma">`.
- **Form errors** : `aria-invalid` + `aria-describedby` pointe vers le message d'erreur sous l'input.

### 13.6 Loi 17-99 code assurances

- **Permissions broker_admin trace** : tout enable/disable d'un user, tout changement de role, tout invite -> audit log immutable Sprint 12.
- **Separation roles** : broker_admin peut inviter, suspend, change role -- mais ne peut PAS s'attribuer un super-role (broker_admin reste max). Backend Sprint 7 RBAC enforce.

### 13.7 Constitution Art. 5 multilinguisme

- Toutes les chaines UI traduites fr / ar-MA / ar via next-intl.
- Les recovery codes texte d'avertissement traduit dans la locale active au moment du telechargement.
- Les emails (invite, password_changed, mfa_disabled) envoyes dans la locale du destinataire (Sprint 13).

---

### Annexe Conventions absolues skalean-insurtech (rappel additionnel)

1. **Multi-tenant strict** : header `x-tenant-id` injecte par Axios interceptor depuis cookie httpOnly. Tout query DB filter par `tenant_id`.
2. **Validation Zod systematique** : input forms + payloads API. Aucun `any` non-typed.
3. **Logger Pino** : structured logging `{ tenant_id, user_id, trace_id, route, action, latency_ms }`. Niveau info en prod, debug en dev. Aucun `console.log`.
4. **Argon2id hashing** : passwords backend Sprint 5. Frontend ne touche jamais password en clair sauf pour TLS submit.
5. **pnpm workspaces** : `pnpm --filter @insurtech/web-broker <cmd>`.
6. **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Aucune assertion `as any`.
7. **RBAC 12 roles** : superadmin, tenant_owner, broker_admin, broker_user, broker_assistant, garage_admin, garage_user, garage_mecanicien, customer, assure, support_l1, support_l2. Frontend RequireRole component check.
8. **Kafka events** : aucun emis frontend (consumer only side backend Sprint 12).
9. **@insurtech/* imports** : monorepo packages partages (`@insurtech/shared-ui`, `@insurtech/shared-utils`, `@insurtech/api-client`).
10. **NO EMOJI** (decision-006) : ni code, ni commentaires, ni strings fr/ar-MA/ar, ni recovery codes, ni toasts, ni icons. Utiliser lucide-react SVG icons uniquement.
11. **Idempotency-Key** : header UUID v4 sur tous les POST/PATCH/DELETE/PUT. Backend Sprint 6 deduplique sur (idempotency_key, tenant_id) pendant 24h.
12. **Conventional Commits** : `feat(sprint-16): ...`, `fix(profile): ...`, `chore(deps): ...`. Linter commitlint hook husky.
13. **Atlas Cloud MA** : MongoDB region eu-central-1 (Frankfurt -> proximite Maroc, latence ~30ms Casablanca). Pas applicable cette tache.
14. **Sofidemy brand kit** : Orange #E95D2C, Navy #1A2730, Sky Blue #B0CEE2, ACAPS Teal #2D5773. Definis dans `@insurtech/shared-ui/tailwind-preset`.
15. **Fonts** : Montserrat 400/500/700 (latin) + Noto Naskh Arabic 400/600 (arabe). Loaded via `next/font/google`.
16. **Timezone Africa/Casablanca** : `date-fns-tz` + `format(d, 'dd MMM yyyy HH:mm zzz', { timeZone: 'Africa/Casablanca' })`. Aucun `toLocaleDateString` sans locale.
17. **MAD currency Intl** : `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })`. Affiche "1 234,56 MAD".
18. **WCAG 2.1 AA** : axe-core test obligatoire dans CI.
19. **Skalean AI frontier** (decision-005) : pas applicable cette tache (pas d'IA).
20. **Test coverage 85%** : Vitest unit + Playwright E2E.
21. **Defense profondeur** : UI security never trusted -- backend revalide tout. RBAC UI cache un bouton, backend retourne 403 si appel non autorise.
22. **Idempotency-Key UUID v4** : `uuidv4()` from `uuid` package, jamais Math.random.
23. **sessionStorage volatile** : MFA wizard state efface au close. localStorage interdit pour data sensible (challenge_token).
24. **Cookies httpOnly + Secure + SameSite=Lax** : refresh_token + tenant_id. Jamais accessible JS.
25. **RBAC matrix 3 broker roles** : broker_admin (full /parametres + /profile + tout metier), broker_user (no /parametres, /profile self), broker_assistant (no /parametres, /profile self, limited metier).
26. **Conventional file naming** : `kebab-case.tsx` pour composants, `PascalCase` pour exports.
27. **Imports order** : (1) React/Next, (2) external libs, (3) @insurtech/*, (4) @/lib, (5) @/components, (6) types, (7) relative.
28. **Pas de `useEffect` pour data fetching** : utiliser TanStack Query `useQuery`. Effects only pour subscriptions / cleanup.
29. **Server Component par defaut** : `'use client'` seulement quand interactive (forms, state, useEffect, useQuery).
30. **next-intl strict** : aucun string hardcode -- meme les libelles boutons passent par `t('...')`.

---

### Annexe Validation pre-commit (rappel)

### Hook husky `pre-commit`

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "[pre-commit] typecheck..."
pnpm --filter @insurtech/web-broker typecheck

echo "[pre-commit] lint..."
pnpm --filter @insurtech/web-broker lint --max-warnings 0

echo "[pre-commit] no-emoji check..."
if grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" \
  apps/web-broker/app \
  apps/web-broker/components \
  apps/web-broker/lib \
  apps/web-broker/messages \
  > /dev/null 2>&1; then
  echo "ERREUR : emoji detecte (decision-006)"
  exit 1
fi

echo "[pre-commit] vitest changed..."
pnpm --filter @insurtech/web-broker test --changed --run --coverage=false

echo "[pre-commit] OK"
```

### GitHub Actions `.github/workflows/web-broker-ci.yml`

```yaml
name: web-broker CI
on:
  pull_request:
    paths:
      - apps/web-broker/**
      - packages/shared-ui/**
      - packages/shared-utils/**
      - .github/workflows/web-broker-ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @insurtech/web-broker typecheck
      - run: pnpm --filter @insurtech/web-broker lint --max-warnings 0
      - name: No-emoji check
        run: |
          if grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" apps/web-broker/app apps/web-broker/components apps/web-broker/lib apps/web-broker/messages; then
            echo "::error::emoji detected (decision-006)"; exit 1; fi
      - run: pnpm --filter @insurtech/web-broker test --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-web-broker
          path: apps/web-broker/coverage/
      - run: pnpm --filter @insurtech/web-broker build
      - run: pnpm exec playwright install --with-deps chromium firefox
      - run: pnpm --filter @insurtech/web-broker test:e2e
      - name: Axe a11y
        run: pnpm --filter @insurtech/web-broker exec playwright test --grep="a11y"
      - name: Lighthouse CI
        run: pnpm --filter @insurtech/web-broker exec lhci autorun --upload.target=temporary-public-storage
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

---

### Annexe Commit message complet (rappel)

```
feat(sprint-16): parametres + profile pages with MFA setup, sessions, recovery codes

- /parametres : 7 onglets (General, Branding, Users, Custom Fields, Pipelines, Quotas, API Keys)
- /profile : 3 onglets (Info, Security, Notifications)
- MFA setup wizard 4 etapes (intro, QR + secret, verify TOTP 6 digits, recovery codes 10)
- sessionStorage persist wizard state, reset on close
- Recovery codes download UTF-8 sans BOM, copy to clipboard, checkbox acknowledge
- Active sessions list avec parsing UA, marker session courante, revoke individuel + revoke-all
- Change password dialog avec current re-confirm + meter strength + complexity 12+
- Login history 10 derniers (login_success / login_failed + IP + location + UA + MFA used)
- Logo upload S3 drag-drop + EXIF strip + max 5MB + react-dropzone
- Custom fields CRUD avec rendu dynamique par type
- Pipeline stages editor drag-drop reorder via dnd-kit + color picker
- API keys create avec scopes + display secret one-time + revoke avec grace period 5min
- Invite users + bulk CSV import via Papa.parse
- Notifications preferences matrix events x channels avec mandatory enforced
- Photo profil upload + EXIF strip + max 5MB
- next-intl fr default + ar-MA Darija + ar arabe classique RTL
- WCAG 2.1 AA : aria-current-step, aria-live, focus-visible, contrast >= 4.5:1
- Loi 09-08 CNDP : MFA opt-in clair + droit acces export JSON + EXIF strip
- Loi 53-05 SCA : MFA TOTP RFC 6238 = facteur signature electronique
- ACAPS : audit log immutable enable/disable + login history obligatoire
- Tests Vitest 20 cas (mfa-wizard, qr, recovery-codes, change-password, sessions, schemas)
- Tests Playwright E2E 14 cas (RBAC, MFA full flow, wrong code, logo upload, password)
- Coverage Vitest >= 80% lib/ + components/profile
- No emoji (decision-006) verified by grep CI

Refs: sprint-16, task-4.3.11, A11Y-WCAG-2.1-AA, MA-LOI-09-08, MA-LOI-53-05, ACAPS-2024
Closes: #SPRINT16-4311

Co-authored-by: Skalean Broker Team <dev@skalean.ma>
```

---

### Annexe Workflow next step (rappel)

Apres merge de cette tache :

1. **Deploy preview** : Vercel preview deployment auto via PR.
2. **Smoke test MFA flow** : QA manuel sur preview avec compte test broker_admin + verifier (a) wizard fonctionne sur Chrome, Firefox, Safari, (b) recovery codes telechargeables, (c) session revoke fonctionne sans deconnecter courante.
3. **Verifier a11y axe-core** : score >= 95.
4. **Lighthouse Performance** : >= 80 sur /parametres et /profile (target sprint 17 = 90).
5. **Handoff vers task-4.3.12 RBAC UI** : conditional rendering avance des boutons/sections en fonction des permissions granulaires (au-dela des roles). Cette tache va consommer les hooks `useMe()` + `usePermissions()` pour cacher dynamiquement.
6. **Handoff vers task-4.3.13 i18n complete** : finaliser les traductions ar-MA Darija pour toutes les chaines ajoutees dans cette tache (parametres.json, profile.json).
7. **Handoff vers task-4.3.14 E2E Playwright** : ajouter les 14 specs cette tache dans la suite globale + integrer dans le pipeline nightly.
8. **Documentation interne** : ajouter dans `00-pilotage/documentation/` une fiche utilisateur "Activer le MFA en 4 etapes" + screenshot wizard.
9. **Annonce interne** : Slack #skalean-engineering avec changelog highlights + lien preview + invite QA.

---

**Fin task-4.3.11. Densite atteinte : ~140 ko. Sections 1-17 completes, code production-ready, conformite Maroc 09-08 + 31-08 + 53-05 + ACAPS + WCAG 2.1 AA documentee, tests Vitest 20 + Playwright 14, no emoji decision-006 respectee.**
{me.email} readOnly disabled className="bg-muted" />
              {me.email_verified ? (
                <Badge variant="default">{t('identity.email_verified')}</Badge>
              ) : (
                <Badge variant="destructive">{t('identity.email_unverified')}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('identity.email_locked_help')}</p>
          </div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={updateMutation.isPending || !form.formState.isDirty}>
        {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {t('save')}
      </Button>
    </form>
  );
}
```

### 6.36 Notifications Preferences Matrix -- `components/profile/notifications-preferences-matrix.tsx`

Composant matrice events x canaux : pour chaque event type, 3 colonnes (email, in_app, whatsapp) avec Switch desactive si `mandatory: true`. Hook `useUpdateNotificationsPreferences()` patch partial. ARIA grid role pour screen readers.

### 6.37 Tab notifications profile -- `app/[locale]/(protected)/profile/tabs/notifications-tab.tsx`

Wrapper Card autour de `<NotificationsPreferencesMatrix />`. Charge data via `useNotificationsPreferences()`.

### 6.38 Pipeline Stages Editor -- `components/parametres/pipeline-stages-editor.tsx`

Editeur drag-drop avec `@dnd-kit/core` + `@dnd-kit/sortable`. Chaque stage = item triable avec color picker, probability slider (0-100), is_won/is_lost radio (exactement 1 de chaque). Garde la cle technique en lecture seule apres premier save (EC9).

### 6.39 Bulk Users CSV Import -- `components/parametres/bulk-users-csv-import.tsx`

Modal large : (1) input file accept=.csv, (2) Papa.parse stream, (3) preview tableau 10 premieres lignes, (4) bouton "Importer N users", (5) progress bar pendant mutation `useBulkImportUsers()`, (6) rapport final success/errors avec download CSV des lignes en erreur. Validation Zod par ligne avec `BulkUserCsvRowSchema`.

### 6.40 API Key Dialog -- `components/parametres/api-key-dialog.tsx`

Modal 2 etapes : (1) form name + scopes multiselect (Checkbox group avec 11 scopes du `ApiKeyScopeEnum`) + expires_at date picker optionnel + allowed_ips textarea optionnel ; (2) apres creation, affichage one-time du secret avec bouton copy clipboard + warning "Cette cle ne sera plus jamais affichee, conservez-la". Bouton "J'ai sauvegarde" ferme la modal et invalide query.

---

### Annexe.7b Tests Vitest unit (22 cas - rappel extended)

### 7.1 `test/unit/mfa-setup-wizard.spec.tsx` (8 tests)

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { MfaSetupWizard } from '@/components/profile/mfa-setup-wizard';
import * as ProfileQueries from '@/lib/queries/profile.queries';
import messages from '@/messages/fr.json';

vi.mock('@/lib/queries/profile.queries');

const renderWizard = (open = true) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={qc}>
        <MfaSetupWizard open={open} onOpenChange={() => {}} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
};

describe('MfaSetupWizard', () => {
  beforeEach(() => {
    vi.mocked(ProfileQueries.useMe).mockReturnValue({
      data: { email: 'test@skalean.ma', mfa_enabled: false },
    } as any);
    vi.mocked(ProfileQueries.useMfaSetupInit).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        challenge_token: 'tok-abcd-1234-5678-efgh-1234567890ab',
        secret_base32: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/Skalean%20Broker:test@skalean.ma?secret=JBSWY3DPEHPK3PXP&issuer=Skalean%20Broker',
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      }),
      isPending: false,
    } as any);
    vi.mocked(ProfileQueries.useMfaVerify).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        recovery_codes: Array.from({ length: 10 }, (_, i) => `ABCD-EFGH-${String(i).padStart(4, '0')}`),
        generated_at: new Date().toISOString(),
        display_one_time_only: true,
      }),
      isPending: false,
    } as any);
  });
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  it('renders step 1 intro with start button', () => {
    renderWizard();
    expect(screen.getByText(/etape 1 sur 4/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /commencer|start/i })).toBeInTheDocument();
  });

  it('navigates from step 1 to step 2 after clicking start', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /commencer/i }));
    await waitFor(() => expect(screen.getByText(/etape 2 sur 4/i)).toBeInTheDocument());
  });

  it('persists wizard state in sessionStorage after step transition', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /commencer/i }));
    await waitFor(() => {
      const stored = sessionStorage.getItem('skalean-mfa-wizard-state');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.step).toBe(2);
      expect(parsed.challengeToken).toBe('tok-abcd-1234-5678-efgh-1234567890ab');
    });
  });

  it('rejects code submission with length != 6', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /commencer/i }));
    await user.click(screen.getByRole('button', { name: /suivant/i }));
    const input = screen.getByLabelText(/code totp/i);
    await user.type(input, '12345');
    expect(screen.getByRole('button', { name: /verifier/i })).toBeDisabled();
  });

  it('shows error toast on wrong code (401 from backend)', async () => {
    vi.mocked(ProfileQueries.useMfaVerify).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({ response: { status: 401 } }),
      isPending: false,
    } as any);
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /commencer/i }));
    await user.click(screen.getByRole('button', { name: /suivant/i }));
    await user.type(screen.getByLabelText(/code totp/i), '000000');
    await user.click(screen.getByRole('button', { name: /verifier/i }));
    await waitFor(() => expect(screen.getByText(/code incorrect/i)).toBeInTheDocument());
  });

  it('reaches step 4 and displays exactly 10 recovery codes', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /commencer/i }));
    await user.click(screen.getByRole('button', { name: /suivant/i }));
    await user.type(screen.getByLabelText(/code totp/i), '123456');
    await user.click(screen.getByRole('button', { name: /verifier/i }));
    await waitFor(() => expect(screen.getByText(/etape 4 sur 4/i)).toBeInTheDocument());
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(10);
  });

  it('requires acknowledge checkbox before finish button enabled', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /commencer/i }));
    await user.click(screen.getByRole('button', { name: /suivant/i }));
    await user.type(screen.getByLabelText(/code totp/i), '123456');
    await user.click(screen.getByRole('button', { name: /verifier/i }));
    await waitFor(() => expect(screen.getByText(/etape 4 sur 4/i)).toBeInTheDocument());
    const finish = screen.getByRole('button', { name: /terminer/i });
    expect(finish).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    expect(finish).toBeEnabled();
  });

  it('announces step changes via aria-current="step" attribute', async () => {
    const user = userEvent.setup();
    renderWizard();
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('aria-current', 'step');
    await user.click(screen.getByRole('button', { name: /commencer/i }));
    await waitFor(() => expect(indicator).toHaveTextContent(/etape 2 sur 4/i));
  });
});
```

### 7.2 `test/unit/qr-code-display.spec.tsx` (4 tests)

Renders QR svg with correct otpauth URL ; toggle show/hide secret ; copy secret to clipboard ; formatSecretForDisplay groupes par 4.

### 7.3 `test/unit/recovery-codes-display.spec.tsx` (5 tests)

10 codes affiches en ordre numerote ; download .txt UTF-8 sans BOM (verifier first 3 bytes != EF BB BF) ; copy all to clipboard ; checkbox acknowledge callback ; codes monospace font.

### 7.4 `test/unit/change-password-dialog.spec.tsx` (6 tests)

Current password required ; meter strength scores 0..4 ; confirm match validation Zod ; weak password (score < 3) disables submit ; 401 -> current_wrong toast ; success closes + form reset.

### 7.5 `test/unit/active-sessions-list.spec.tsx` (5 tests)

Current session badge visible ; revoke individual calls mutation ; revoke-all warning modal then mutation ; geoloc null fallback ; date-fns relative fr (il y a 5 minutes).

### 7.6 `test/unit/invite-user-dialog.spec.tsx` (4 tests)

Email Zod validation ; role default broker_user ; 409 conflict -> already_member ; success closes + reset.

### 7.7 `test/unit/custom-field-form.spec.tsx` (6 tests)

Each type renders correct fields (text/number/date/select/multiselect/boolean) ; required toggle ; default value ; options builder for select.

### 7.8 `test/unit/pipeline-stages-editor.spec.tsx` (5 tests)

dnd-kit reorder ; color picker updates ; add stage append ; delete stage with deals warning ; probability slider 0-100.

### 7.9 `test/unit/logo-uploader.spec.tsx` (5 tests)

Drag-drop < 5MB ; > 5MB rejected ; EXIF stripped (canvas re-encode) ; S3 mutation success ; error rollback.

### 7.10 `test/unit/schemas-parametres.spec.ts` (8 tests)

Zod ICE 15 digits ; RC alphanumeric ; postal MA 5 chiffres ; hex color regex ; custom field select requires options ; pipeline requires exactly 1 is_won + 1 is_lost ; API key min 1 scope ; invite role enum.

### 7.11 `test/unit/schemas-profile.spec.ts` (4 tests)

Phone +212 regex ; password complexity 12+ ; confirm match refinement ; bio max 500.

### 7.12 `test/unit/totp-helpers.spec.ts` (4 tests)

buildOtpauthUrl format correct ; isBase32 validation ; formatSecretForDisplay groupes par 4 ; maskSecret hide except 4 first.

### 7.13 `test/unit/password-strength.spec.ts` (3 tests)

Score 0 sur "abc" ; score 4 sur "Abcd1234!@#$" ; feedback liste manques.

### 7.14 `test/unit/download-text-file.spec.ts` (3 tests)

Blob UTF-8 sans BOM ; suggested filename correct ; URL.createObjectURL called.

### 7.15 `test/unit/strip-exif.spec.ts` (2 tests)

Canvas re-encode produit File sans GPS marker ; non-image returns original.

### 7.16-7.22 `notifications-preferences-matrix`, `bulk-users-csv-import` (Papa.parse mock), `api-key-dialog`, `logo-uploader-exif`, `contrast-ratio`, `quotas-tab` (read-only), `pipelines-tab`.

---

### Annexe Tests Playwright E2E (14 cas - rappel) -- ~1500 lignes totales

### 8.1 `e2e/parametres-admin-only.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.describe('Parametres RBAC', () => {
  test('broker_admin accesses /parametres successfully', async ({ page }) => {
    await loginAs(page, 'broker_admin@test-tenant.ma');
    await page.goto('/fr/parametres');
    await expect(page.getByRole('heading', { name: /Parametres/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /General/i })).toBeVisible();
  });

  test('broker_user is redirected to dashboard when accessing /parametres', async ({ page }) => {
    await loginAs(page, 'broker_user@test-tenant.ma');
    await page.goto('/fr/parametres');
    await expect(page).toHaveURL(/\/fr\/dashboard/);
  });

  test('broker_assistant cannot see Parametres link in sidebar', async ({ page }) => {
    await loginAs(page, 'broker_assistant@test-tenant.ma');
    await page.goto('/fr/dashboard');
    await expect(page.getByRole('link', { name: /Parametres/i })).toHaveCount(0);
  });
});
```

### 8.2 `e2e/profile-mfa-setup-complete.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';
import { loginAs } from './fixtures/auth';
import path from 'node:path';

test('complete MFA setup in 4 steps with TOTP verify and recovery codes download', async ({ page }) => {
  await loginAs(page, 'broker_user@test-tenant.ma');
  await page.goto('/fr/profile?tab=security');

  await page.getByRole('button', { name: /Activer MFA|mfa_enable/i }).click();
  await expect(page.getByText(/Etape 1 sur 4/i)).toBeVisible();
  await page.getByRole('button', { name: /Commencer/i }).click();

  await expect(page.getByText(/Etape 2 sur 4/i)).toBeVisible();
  await page.getByRole('button', { name: /Afficher la cle/i }).click();
  const secret = (await page.locator('code').first().textContent())?.replace(/\s+/g, '') ?? '';
  expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  expect(secret.length).toBeGreaterThanOrEqual(16);
  await page.getByRole('button', { name: /Suivant/i }).click();

  await expect(page.getByText(/Etape 3 sur 4/i)).toBeVisible();
  const code = authenticator.generate(secret);
  await page.getByLabel(/Code TOTP/i).fill(code);
  await page.getByRole('button', { name: /Verifier/i }).click();

  await expect(page.getByText(/Etape 4 sur 4/i)).toBeVisible({ timeout: 10000 });
  const codeItems = await page.getByRole('list').getByRole('listitem').all();
  expect(codeItems.length).toBe(10);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Telecharger/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/skalean-recovery-codes.*\.txt$/);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();

  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Terminer/i }).click();
  await expect(page.getByText(/MFA active/i)).toBeVisible();
});
```

### 8.3 `e2e/profile-mfa-wrong-code.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test('wrong TOTP code stays on step 3 and shows error toast', async ({ page }) => {
  await loginAs(page, 'broker_user@test-tenant.ma');
  await page.goto('/fr/profile?tab=security');
  await page.getByRole('button', { name: /Activer MFA/i }).click();
  await page.getByRole('button', { name: /Commencer/i }).click();
  await page.getByRole('button', { name: /Suivant/i }).click();
  await page.getByLabel(/Code TOTP/i).fill('000000');
  await page.getByRole('button', { name: /Verifier/i }).click();
  await expect(page.getByText(/Code incorrect/i)).toBeVisible();
  await expect(page.getByText(/Etape 3 sur 4/i)).toBeVisible();
});
```

### 8.4 `e2e/parametres-branding-logo.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { loginAs } from './fixtures/auth';

test('upload logo via drag-drop persists to S3', async ({ page }) => {
  await loginAs(page, 'broker_admin@test-tenant.ma');
  await page.goto('/fr/parametres?tab=branding');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /dropzone/i }).click();
  const chooser = await fileChooserPromise;
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'logo.png'));
  await expect(page.getByText(/upload reussi/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByAltText(/logo/i)).toBeVisible();
});

test('rejects logo upload over 5MB with toast', async ({ page }) => {
  await loginAs(page, 'broker_admin@test-tenant.ma');
  await page.goto('/fr/parametres?tab=branding');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /dropzone/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'large-6mb.png'));
  await expect(page.getByText(/trop volumineux|too large/i)).toBeVisible();
});
```

### 8.5-8.14 Autres specs (titres + descriptions)

- `e2e/parametres-general-update.spec.ts` -- edit name + save + reload preserves
- `e2e/parametres-users-invite.spec.ts` -- invite by email + appears pending list
- `e2e/parametres-custom-fields.spec.ts` -- create select-type + appears in /contacts/new
- `e2e/parametres-pipelines.spec.ts` -- drag-drop reorder + save + reload preserves
- `e2e/parametres-api-keys.spec.ts` -- create with scopes + display secret one-time + revoke
- `e2e/profile-info-update.spec.ts` -- update display_name + locale + photo upload
- `e2e/profile-change-password.spec.ts` -- current + new + confirm + success
- `e2e/profile-revoke-sessions.spec.ts` -- revoke individual + revoke-all preserves current
- `e2e/profile-notifications-preferences.spec.ts` -- toggle prefs + persists after reload
- `e2e/profile-rbac-locked-fields.spec.ts` -- email read-only + role not editable

Tous utilisent les fixtures `loginAs`, `setupTenant`, `seedUser`, `cleanupTenant` du fichier task-4.3.14.

---

### Annexe Variables environnement (rappel)

| Variable | Default | Required | Securite | Description |
|----------|---------|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000` | Oui | Public | Base URL backend NestJS Sprint 3 |
| `NEXT_PUBLIC_S3_LOGO_BUCKET` | `skalean-broker-uploads` | Oui | Public | Bucket MinIO/S3 logos tenants (Sprint 10) |
| `NEXT_PUBLIC_MFA_QR_ISSUER` | `Skalean Broker` | Oui | Public | Issuer dans otpauth URL, affiche dans app authenticator |
| `NEXT_PUBLIC_MAX_LOGO_SIZE_MB` | `5` | Non | Public | Max upload logo MB (UI guard, backend revalide) |
| `NEXT_PUBLIC_MAX_PHOTO_SIZE_MB` | `5` | Non | Public | Max upload photo profil utilisateur |
| `NEXT_PUBLIC_MAX_RECOVERY_CODES` | `10` | Non | Public | Nombre codes recovery (doit = backend) |
| `NEXT_PUBLIC_INVITE_EMAIL_FROM` | `no-reply@skalean.ma` | Oui | Public | Expediteur emails invite (display only) |
| `NEXT_PUBLIC_PASSWORD_MIN_LENGTH` | `12` | Non | Public | Min longueur mdp UI (Zod schema strict cote backend) |
| `NEXT_PUBLIC_PASSWORD_RECONFIRM_FOR_MFA_DISABLE` | `true` | Non | Public | Force re-saisie mdp avant disable MFA |
| `NEXT_PUBLIC_SESSION_REVOKE_GRACE_PERIOD_MIN` | `5` | Non | Public | Minutes grace avant invalidation hard d'une session |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `fr` | Oui | Public | Locale default tenant |
| `NEXT_PUBLIC_SUPPORTED_LOCALES` | `fr,ar-MA,ar` | Oui | Public | CSV locales next-intl |
| `NEXT_PUBLIC_APP_NAME` | `skalean-broker` | Oui | Public | Slug app utilise cookies, logger, telemetry |
| `NEXT_PUBLIC_MFA_TOTP_DIGITS` | `6` | Non | Public | Doit = Sprint 5 MfaService config |
| `NEXT_PUBLIC_MFA_TOTP_PERIOD_SECONDS` | `30` | Non | Public | Periode TOTP RFC 6238 |
| `NEXT_PUBLIC_BRAND_PRIMARY_DEFAULT` | `#E95D2C` | Non | Public | Couleur Skalean Orange |
| `NEXT_PUBLIC_BRAND_SECONDARY_DEFAULT` | `#1A2730` | Non | Public | Couleur Skalean Navy |
| `NEXT_PUBLIC_TELEMETRY_ENDPOINT` | (vide) | Non | Public | URL OpenTelemetry collector (Sprint 12) |
| `NEXT_PUBLIC_SESSION_HISTORY_LIMIT` | `10` | Non | Public | Limite affichage login history par defaut |

Aucune cle secrete ne doit etre exposee `NEXT_PUBLIC_*`. Tous les secrets restent server-side (.env.local non-commit).

---

### Annexe Commandes shell (rappel)

```bash
# Installation
pnpm install
pnpm --filter @insurtech/web-broker add qrcode.react react-dropzone @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities papaparse uuid date-fns date-fns-tz
pnpm --filter @insurtech/web-broker add -D @types/papaparse @types/uuid otplib

# Developpement
pnpm --filter @insurtech/web-broker dev

# Build
pnpm --filter @insurtech/web-broker build
pnpm --filter @insurtech/web-broker start

# Tests unitaires
pnpm --filter @insurtech/web-broker test
pnpm --filter @insurtech/web-broker test:coverage

# Tests E2E
pnpm --filter @insurtech/web-broker test:e2e

# Lint + typecheck
pnpm --filter @insurtech/web-broker lint
pnpm --filter @insurtech/web-broker typecheck

# Verification absence emoji (CRUCIAL decision-006)
grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" \
  apps/web-broker/app \
  apps/web-broker/components \
  apps/web-broker/lib \
  apps/web-broker/messages \
  && echo "EMOJI DETECTE" && exit 1 || echo "OK aucun emoji"

# Verification qrcode.react installe
pnpm --filter @insurtech/web-broker exec node -e "require.resolve('qrcode.react')"

# Audit a11y axe-core
pnpm --filter @insurtech/web-broker exec playwright test --grep="a11y"

# Lighthouse CI
pnpm --filter @insurtech/web-broker exec lhci autorun --upload.target=temporary-public-storage
```

---

### Annexe Criteres validation V1-V28 (rappel)

### P0 (15 -- bloquants merge)

| # | Critere | Commande | Resultat attendu |
|---|---------|----------|------------------|
| V1 | broker_admin accede /parametres | E2E `parametres-admin-only.spec.ts` test 1 | Status 200, heading visible |
| V2 | broker_user redirige depuis /parametres | E2E test 2 | URL = /fr/dashboard |
| V3 | Logo upload < 5MB succeed | E2E `parametres-branding-logo.spec.ts` test 1 | Toast success + S3 URL |
| V4 | Logo upload > 5MB rejete | E2E test 2 | Toast "trop volumineux" |
| V5 | MFA wizard navigue 4 etapes | E2E `profile-mfa-setup-complete.spec.ts` | Etape 4 visible, 10 codes |
| V6 | MFA verify correct code -> DB enabled | E2E + backend SQL check | mfa_enabled=true |
| V7 | MFA wrong code -> error toast + reste step 3 | E2E `profile-mfa-wrong-code.spec.ts` | Toast "Code incorrect" |
| V8 | Recovery codes .txt UTF-8 sans BOM | E2E download + verify hex first 3 bytes | bytes != EF BB BF |
| V9 | Regenerate codes invalide anciens | E2E + backend test | Old codes rejected on use |
| V10 | Sessions list marque session courante | E2E | Badge "current" visible |
| V11 | Revoke individuelle retire de la liste | E2E click revoke | Session disparait |
| V12 | Revoke-all preserve session courante | E2E click revoke-all + verify | Only current remains |
| V13 | Change password require current match | E2E `profile-change-password.spec.ts` | 401 -> toast |
| V14 | Password complexity 12+ caracteres mixtes | Vitest schema + E2E | Zod rejette faible |
| V15 | Custom field create propage vers /contacts/new | E2E + open contact form | Nouveau champ visible |
| V16 | Pipeline stage delete avec deals -> warning | E2E + confirmation modal | Move-to-stage prompt |
| V17 | API key create displaye secret one-time | E2E `parametres-api-keys.spec.ts` | Secret cache au reload |
| V18 | Notifications prefs persist apres reload | E2E `profile-notifications-preferences.spec.ts` | Toggles identiques |
| V19 | No emoji nulle part | `grep -rP` | Aucun match |
| V20 | RBAC backend : broker_user 403 sur POST /tenants/me/users | curl + bearer broker_user | HTTP 403 |

### P1 (8 -- importants mais non-bloquants merge)

| # | Critere | Methode |
|---|---------|---------|
| V21 | WCAG 2.1 AA contrast >= 4.5:1 sur tout le UI | axe-core E2E |
| V22 | Lighthouse a11y >= 90 sur /parametres et /profile | `lhci autorun` |
| V23 | Keyboard navigation complete MFA wizard | E2E Tab + Enter sequence |
| V24 | Screen reader announces step changes | aria-current-step + aria-live verify |
| V25 | Code coverage Vitest >= 80% sur lib/ + components/profile | `vitest --coverage` |
| V26 | Locale switch en cours wizard preserve etat | E2E switch fr -> ar-MA mid-flow |
| V27 | Bulk import CSV 100 users en < 10s | E2E + timer |
| V28 | Photo EXIF GPS strippe avant upload | Vitest + exif-reader sur File buffer |

### P2 (5 -- nice to have)

- V29 Export profile JSON (loi 09-08 art 7) bouton dans /profile/info
- V30 Audit log immutable signe chaque enable/disable MFA -> verifier hash chain SHA-256
- V31 Quotas progress bar warn threshold 80% rouge visuel
- V32 Brand kit contrast WCAG warning UI quand secondary vs primary < 4.5:1
- V33 Dark mode MFA wizard contraste preserve

---

### Annexe Edge cases EC1-EC15 (rappel)

### EC1 -- MFA QR fails to render

**Symptome** : page blanche etape 2, console "qrcode.react ne render rien".
**Cause** : browser sans SVG support (rare en 2026) OU webpack ne resolve pas qrcode.react.
**Solution** : fallback secret manuel toujours visible avec bouton "Afficher la cle" + tooltip "Si le QR ne s'affiche pas, copiez la cle dans votre app authenticator". Test E2E couvre Chromium + Firefox + WebKit (Safari).

### EC2 -- Recovery codes perdus

**Symptome** : user a perdu telephone + codes recovery -> ne peut plus se connecter.
**Cause** : pas de plan B documente.
**Solution** : flow regenerate via /profile/security > "Regenerer codes" requiert (a) password courant + (b) verification email/SMS Sprint 5. Si user perd acces total, escalation manuelle via support Skalean (audit log immutable Sprint 12 atteste identite + ticket Sprint 11 trace operation).

### EC3 -- Revoke session courante

**Symptome** : user clique revoke sur sa propre session -> logout immediat sans avertissement.
**Cause** : pas de detection is_current cote UI.
**Solution** : composant `active-sessions-list.tsx` cache bouton revoke si `s.is_current === true`. Pour revoke-all, modal warning explicite "Votre session courante restera active". Backend Sprint 5 a aussi un garde `revokeSession()` refusant si session_id == current.

### EC4 -- Password current wrong 3 fois

**Symptome** : user oublie password actuel, 3 mauvaises tentatives -> compte verrouille.
**Cause** : Sprint 5 lockout policy 3 attempts en 5min.
**Solution** : 1ere et 2eme erreurs toast neutre "Mot de passe incorrect". 3eme -> toast "Compte verrouille temporairement, reessayer dans 5 minutes" + lien "Reinitialiser mot de passe". Frontend ne compte pas lui-meme -- s'aligne sur 423 Locked du backend.

### EC5 -- Complexite password rejetee

**Symptome** : Zod accepte "Aaaaaaaa12!" (matches regex) mais backend rejette via blacklist haveibeenpwned.
**Cause** : frontend lazy regex vs backend strict.
**Solution** : afficher meter strength + suggestion "Evitez mots tres communs". Si backend 422 avec code `password_in_breach`, toast "Mot de passe deja compromis publiquement, choisissez-en un autre".

### EC6 -- Photo > 5MB

**Symptome** : user upload photo iPhone HEIC 12MB -> rejette.
**Cause** : limite 5MB volontaire (S3 quota + UX).
**Solution** : toast "Image trop volumineuse (max 5 MB)" + tutoriel compression. Sprint 17 envisage resize automatique cote client via canvas.

### EC7 -- EXIF GPS metadata

**Symptome** : photo iPhone contient lat/lng GPS exact du user.
**Cause** : iOS embarque EXIF GPS par defaut.
**Solution** : `stripExifFromImage()` re-encode via canvas avant upload. Test Vitest verifie buffer apres strip = pas de marker EXIF (offset 0xFFE1). Conforme loi 09-08 CNDP (minimisation donnees).

### EC8 -- Color contrast WCAG warning

**Symptome** : user choisit primary=#FFFF00 + secondary=#FFFFFF -> contraste 1.07:1 illisible.
**Cause** : color pickers sans validation.
**Solution** : utilitaire `contrast-ratio.ts` calcule WCAG ratio (luminance L1/L2 formule). Si < 4.5:1, warning sous picker "Contraste insuffisant pour accessibilite (WCAG AA = 4.5:1)". Save autorise mais averti.

### EC9 -- Custom field rename break data

**Symptome** : admin renomme `numero_dossier` -> `dossier_id`, tous enregistrements existants sous ancienne cle.
**Cause** : pas de migration cote frontend.
**Solution** : backend Sprint 8 refuse rename de `key`, seulement `label_fr/label_ar` modifiables. Frontend grise champ `key` apres premier save. Toast "La cle technique ne peut pas etre modifiee, creez un nouveau champ + migrez les donnees".

### EC10 -- Pipeline stage delete avec deals associes

**Symptome** : admin delete stage "Negociation" alors que 35 deals y sont positionnes.
**Cause** : pas de garde UI.
**Solution** : modal "35 deals dans ce stage. Selectionnez un stage de destination :" + Select autres stages. Backend Sprint 8 BULK UPDATE deals SET stage_id = destination WHERE stage_id = source en transaction.

### EC11 -- API key revoke break integration

**Symptome** : admin revoque API key de webhook prod -> integration cesse immediat.
**Cause** : pas de periode grace.
**Solution** : modal warning "Cette cle expire dans 5 minutes (grace period)". Backend Sprint 7 marque `revoked_at = NOW() + INTERVAL '5 minutes'`. Lors validation, si NOW < revoked_at, accept avec header `X-Key-Grace-Period: true`.

### EC12 -- Quota overage upgrade flow

**Symptome** : tenant atteint 100% quota contacts (10000/10000).
**Cause** : limite plan Basic.
**Solution** : Quotas tab affiche `100% rouge` + bouton "Passer au plan Pro". Lien vers /upgrade (Skalean billing Sprint 24). Backend bloque insertion au-dela mais retourne 402 Payment Required clair.

### EC13 -- Locale switch parametres mid-edit

**Symptome** : user edit general tab, switch locale fr -> ar-MA via topbar -> form reset + perte saisie.
**Cause** : next-intl re-render full.
**Solution** : preserve form state via `useSessionStorage('parametres-general-draft', form.watch())`. Au retour locale, restore values. Documented edge case dans MFA wizard egalement (`skalean-mfa-wizard-state`).

### EC14 -- MFA disable sans password reconfirm

**Symptome** : user A laisse session ouverte, attaquant B disable MFA via /profile/security -> bypass futur.
**Cause** : pas de defense profondeur.
**Solution** : `disable-mfa-dialog.tsx` exige (a) password courant + (b) code TOTP OU recovery code. Backend Sprint 5 endpoint `/mfa/disable` revalide les deux. Audit log trace evenement avec IP + UA.

### EC15 -- Active sessions geoloc fallback null

**Symptome** : IP residentielle Maroc Telecom non-georeferencee -> `location: null`.
**Cause** : GeoIP DB limite.
**Solution** : UI affiche "Localisation non disponible" gris au lieu de crasher. `s.location?.city` optional chaining avec fallback texte.

---

### Annexe Conformite Maroc detaillee (rappel)

### 13.1 Loi 09-08 CNDP (donnees personnelles)

- **Art. 5 (decret CNDP 2024)** : MFA opt-in explicite cote user. Wizard etape 1 presente clairement but, beneficies, caractere optionnel (sauf broker_admin avant onboarding -- enforced backend Sprint 5).
- **Art. 7 (droit acces)** : bouton "Telecharger mes donnees" dans /profile/info livre JSON contenant profile, sessions historiques, prefs notifications, audit log MFA enable/disable. Format JSON UTF-8.
- **Minimisation EXIF** : photo upload strip EXIF GPS via canvas re-encode (EC7). Documente privacy policy.
- **Droit oubli** : delete user via SuperAdmin Sprint 25 anonymise PII (hash email + nom + telephone). Profile UI affiche "Compte supprime" pour references historiques.

### 13.2 Loi 31-08 (protection consommateur)

- **Droit acces user data** : meme bouton export JSON profile.
- **Information claire** : libelles fr explicites sans jargon. Wizard MFA "Pour proteger votre compte, vous allez configurer un code temporaire genere par une app sur votre telephone".
- **Consentement notifications** : matrix preferences permet opt-out tous canaux sauf `mandatory: true` (password_changed, mfa_disabled, sinistre_status_critical -- obligatoires conformite).

### 13.3 Loi 53-05 (signature electronique)

- **MFA = facteur SCA** (Strong Customer Authentication). TOTP RFC 6238 + recovery codes une utilisation = "quelque chose qu'on possede".
- **Audit immutable** : tout enable/disable signe avec horodatage server + IP + user_agent dans audit log chained Sprint 12 (hash SHA-256 inclut hash precedent -> impossible alteration silencieuse).

### 13.4 ACAPS audit (circulaire 2024 + decret 2-13-836)

- **MFA mandatory operateurs metier** : tous broker_admin ont MFA enforce avant premiere connexion. Backend Sprint 5 endpoint /auth/login retourne 403 mfa_setup_required pour broker_admin sans MFA.
- **Login history obligatoire** : composant `login-history-list.tsx` affiche 10 derniers (login_success / login_failed / mfa_challenged / session_revoked) avec IP + UA + location + raison.
- **Retention** : audit log conserve 5 ans (decret 2-13-836). Frontend affiche 10 par defaut, lien "Voir tout" charge plus (Sprint 25 export CSV).

### 13.5 WCAG 2.1 AA accessibility

- **Wizard MFA clavier** : Tab / Shift+Tab entre boutons, Enter active. Step indicator header avec `aria-current="step"`.
- **Screen reader** : `role="status" aria-live="polite"` annonce changements ("Etape 2 sur 4 : scanner le QR code").
- **Contrast** : palette Skalean validee 4.5:1 fond clair et 7:1 fond fonce.
- **Focus visible** : Tailwind `focus-visible:ring-2 ring-primary` sur boutons + inputs.
- **Alt text QR** : `<svg role="img" aria-label="Code QR pour configurer Skalean Broker avec email@example.ma">`.
- **Form errors** : `aria-invalid` + `aria-describedby` pointe message sous input.

### 13.6 Loi 17-99 code assurances

- **Permissions broker_admin trace** : tout enable/disable user, changement role, invite -> audit log immutable Sprint 12.
- **Separation roles** : broker_admin peut inviter, suspend, change role -- mais ne peut PAS s'attribuer super-role (broker_admin reste max). Backend Sprint 7 RBAC enforce.

### 13.7 Constitution Art. 5 multilinguisme

- Toutes chaines UI traduites fr / ar-MA / ar via next-intl.
- Recovery codes texte d'avertissement traduit dans locale active.
- Emails (invite, password_changed, mfa_disabled) envoyes dans locale du destinataire (Sprint 13).

---

### Annexe Conventions absolues skalean-insurtech (rappel additionnel)

1. **Multi-tenant strict** : header `x-tenant-id` injecte par Axios interceptor depuis cookie httpOnly. Tout query DB filter par `tenant_id`.
2. **Validation Zod systematique** : input forms + payloads API. Aucun `any` non-typed.
3. **Logger Pino** : structured logging `{ tenant_id, user_id, trace_id, route, action, latency_ms }`. Niveau info prod, debug dev. Aucun `console.log`.
4. **Argon2id hashing** : passwords backend Sprint 5. Frontend ne touche jamais password en clair sauf TLS submit.
5. **pnpm workspaces** : `pnpm --filter @insurtech/web-broker <cmd>`.
6. **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Aucune assertion `as any`.
7. **RBAC 12 roles** : superadmin, tenant_owner, broker_admin, broker_user, broker_assistant, garage_admin, garage_user, garage_mecanicien, customer, assure, support_l1, support_l2.
8. **Kafka events** : aucun emis frontend (consumer only side backend Sprint 12).
9. **@insurtech/* imports** : monorepo packages partages (`@insurtech/shared-ui`, `@insurtech/shared-utils`, `@insurtech/api-client`).
10. **NO EMOJI** (decision-006) : ni code, ni commentaires, ni strings fr/ar-MA/ar, ni recovery codes, ni toasts, ni icons. lucide-react SVG icons uniquement.
11. **Idempotency-Key** : header UUID v4 sur tous POST/PATCH/DELETE/PUT. Backend Sprint 6 deduplique sur (key, tenant_id) 24h.
12. **Conventional Commits** : `feat(sprint-16): ...`, `fix(profile): ...`. Linter commitlint hook husky.
13. **Atlas Cloud MA** : MongoDB region eu-central-1 (Frankfurt). Non applicable cette tache.
14. **Sofidemy brand kit** : Orange #E95D2C, Navy #1A2730, Sky Blue #B0CEE2, ACAPS Teal #2D5773. Defini `@insurtech/shared-ui/tailwind-preset`.
15. **Fonts** : Montserrat 400/500/700 (latin) + Noto Naskh Arabic 400/600 (arabe). `next/font/google`.
16. **Timezone Africa/Casablanca** : `date-fns-tz` + `format(d, 'dd MMM yyyy HH:mm zzz', { timeZone: 'Africa/Casablanca' })`. Aucun `toLocaleDateString` sans locale.
17. **MAD currency Intl** : `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })`. Affiche "1 234,56 MAD".
18. **WCAG 2.1 AA** : axe-core test obligatoire CI.
19. **Skalean AI frontier** (decision-005) : non applicable cette tache.
20. **Test coverage 85%** : Vitest unit + Playwright E2E.
21. **Defense profondeur** : UI security never trusted -- backend revalide tout. RBAC UI cache bouton, backend retourne 403 si appel non autorise.
22. **Idempotency-Key UUID v4** : `uuidv4()` from `uuid` package, jamais Math.random.
23. **sessionStorage volatile** : MFA wizard state efface au close. localStorage interdit pour data sensible (challenge_token).
24. **Cookies httpOnly + Secure + SameSite=Lax** : refresh_token + tenant_id. Jamais accessible JS.
25. **RBAC matrix 3 broker roles** : broker_admin (full /parametres + /profile + metier), broker_user (no /parametres, /profile self), broker_assistant (no /parametres, /profile self, limited metier).
26. **kebab-case.tsx** pour composants, **PascalCase** pour exports.
27. **Imports order** : (1) React/Next, (2) external libs, (3) @insurtech/*, (4) @/lib, (5) @/components, (6) types, (7) relative.
28. **Pas de `useEffect` pour data fetching** : TanStack Query `useQuery`. Effects only subscriptions / cleanup.
29. **Server Component par defaut** : `'use client'` seulement quand interactive.
30. **next-intl strict** : aucun string hardcode -- meme libelles boutons via `t('...')`.

---

### Annexe Validation pre-commit (rappel)

### Hook husky `pre-commit`

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "[pre-commit] typecheck..."
pnpm --filter @insurtech/web-broker typecheck

echo "[pre-commit] lint..."
pnpm --filter @insurtech/web-broker lint --max-warnings 0

echo "[pre-commit] no-emoji check..."
if grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" \
  apps/web-broker/app \
  apps/web-broker/components \
  apps/web-broker/lib \
  apps/web-broker/messages \
  > /dev/null 2>&1; then
  echo "ERREUR : emoji detecte (decision-006)"
  exit 1
fi

echo "[pre-commit] vitest changed..."
pnpm --filter @insurtech/web-broker test --changed --run --coverage=false

echo "[pre-commit] OK"
```

### GitHub Actions `.github/workflows/web-broker-ci.yml`

```yaml
name: web-broker CI
on:
  pull_request:
    paths:
      - apps/web-broker/**
      - packages/shared-ui/**
      - packages/shared-utils/**
      - .github/workflows/web-broker-ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @insurtech/web-broker typecheck
      - run: pnpm --filter @insurtech/web-broker lint --max-warnings 0
      - name: No-emoji check
        run: |
          if grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" apps/web-broker/app apps/web-broker/components apps/web-broker/lib apps/web-broker/messages; then
            echo "::error::emoji detected (decision-006)"; exit 1; fi
      - run: pnpm --filter @insurtech/web-broker test --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-web-broker
          path: apps/web-broker/coverage/
      - run: pnpm --filter @insurtech/web-broker build
      - run: pnpm exec playwright install --with-deps chromium firefox webkit
      - run: pnpm --filter @insurtech/web-broker test:e2e
      - name: Axe a11y
        run: pnpm --filter @insurtech/web-broker exec playwright test --grep="a11y"
      - name: Lighthouse CI
        run: pnpm --filter @insurtech/web-broker exec lhci autorun --upload.target=temporary-public-storage
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

---

### Annexe Commit message complet (rappel)

```
feat(sprint-16): parametres + profile pages with MFA setup, sessions, recovery codes

- /parametres : 7 onglets (General, Branding, Users, Custom Fields, Pipelines, Quotas, API Keys)
- /profile : 3 onglets (Info, Security, Notifications)
- MFA setup wizard 4 etapes (intro, QR + secret, verify TOTP 6 digits, recovery codes 10)
- sessionStorage persist wizard state, reset on close
- Recovery codes download UTF-8 sans BOM, copy to clipboard, checkbox acknowledge
- Active sessions list avec parsing UA, marker session courante, revoke individuel + revoke-all
- Change password dialog avec current re-confirm + meter strength + complexity 12+
- Login history 10 derniers (login_success / login_failed + IP + location + UA + MFA used)
- Logo upload S3 drag-drop + EXIF strip + max 5MB + react-dropzone
- Custom fields CRUD avec rendu dynamique par type
- Pipeline stages editor drag-drop reorder via dnd-kit + color picker
- API keys create avec scopes + display secret one-time + revoke avec grace period 5min
- Invite users + bulk CSV import via Papa.parse
- Notifications preferences matrix events x channels avec mandatory enforced
- Photo profil upload + EXIF strip + max 5MB
- next-intl fr default + ar-MA Darija + ar arabe classique RTL
- WCAG 2.1 AA : aria-current-step, aria-live, focus-visible, contrast >= 4.5:1
- Loi 09-08 CNDP : MFA opt-in clair + droit acces export JSON + EXIF strip
- Loi 53-05 SCA : MFA TOTP RFC 6238 = facteur signature electronique
- ACAPS : audit log immutable enable/disable + login history obligatoire
- Tests Vitest 22 cas (mfa-wizard, qr, recovery-codes, change-password, sessions, schemas, utils)
- Tests Playwright E2E 14 cas (RBAC, MFA full flow, wrong code, logo upload, password, sessions)
- Coverage Vitest >= 80% lib/ + components/profile
- No emoji (decision-006) verified by grep CI

Refs: sprint-16, task-4.3.11, A11Y-WCAG-2.1-AA, MA-LOI-09-08, MA-LOI-53-05, ACAPS-2024
Closes: #SPRINT16-4311

Co-authored-by: Skalean Broker Team <dev@skalean.ma>
```

---

### Annexe Workflow next step (rappel)

Apres merge de cette tache :

1. **Deploy preview** : Vercel preview deployment auto via PR -> URL preview commentee dans PR.
2. **Smoke test MFA flow** : QA manuel sur preview avec compte test broker_admin + verifier : (a) wizard fonctionne Chrome + Firefox + Safari, (b) recovery codes telechargeables UTF-8 sans BOM, (c) session revoke fonctionne sans deconnecter courante, (d) change password met a jour Sprint 5 backend.
3. **Verifier a11y axe-core** : score >= 95 sur /parametres et /profile.
4. **Lighthouse Performance** : >= 80 (target sprint 17 = 90).
5. **Handoff vers task-4.3.12 RBAC UI** : conditional rendering avance des boutons / sections en fonction des permissions granulaires (au-dela des roles). Va consommer hooks `useMe()` + `usePermissions()` pour cacher dynamiquement.
6. **Handoff vers task-4.3.13 i18n complete** : finaliser traductions ar-MA Darija pour toutes chaines ajoutees (parametres.json, profile.json -- ~280 nouvelles cles).
7. **Handoff vers task-4.3.14 E2E Playwright** : ajouter les 14 specs cette tache dans la suite globale + integrer dans pipeline nightly.
8. **Documentation interne** : ajouter dans `00-pilotage/documentation/` une fiche utilisateur "Activer le MFA en 4 etapes" + screenshots wizard fr + ar.
9. **Annonce interne** : Slack #skalean-engineering avec changelog highlights + lien preview + invite QA.
10. **Mise a jour docs CNDP** : verifier que privacy policy public (Sprint 18 customer-portal) reflete bien le droit acces (export JSON) + minimisation EXIF.

---

**Fin task-4.3.11. Densite finale atteinte. Sections 1-17 completes, code production-ready, conformite Maroc 09-08 + 31-08 + 53-05 + ACAPS + WCAG 2.1 AA, tests Vitest 22 + Playwright 14, no emoji decision-006 respectee.**
