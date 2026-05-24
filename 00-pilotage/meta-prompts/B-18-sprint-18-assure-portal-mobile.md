# META-PROMPT B-18 v3.0 -- SPRINT 18 ASSURE PORTAL MOBILE (Acteur 5 distinct B2B/B2C/Famille)

**Version** : v3.0 (REFONTE complete v2.2 -- Assure = acteur 5 distinct du Customer)
**Phase** : 4 -- Vertical Insure (Assure-facing mobile)
**Sprint** : 18 / 40 (cumul v3.0) -- Phase 4 Sprint 5
**Position** : Apres Customer Portal (Sprint 17), avant Vertical Repair Foundation (Sprint 19)
**Numerotation taches** : 4.5.1 a 4.5.12
**Effort total** : ~65 heures developpement / 1.5 semaines (vs 40h v2.2)
**Priorite** : P0 (acteur central Insure ecosystem 6 acteurs decision-012)

---

## Objectif Global du Sprint

Construire l'**application mobile web-assure-app** (Expo SDK 51 managed) : application B2C/B2B native iOS + Android pour les **personnes assurees** (Assure = acteur 5 distinct du Customer souscripteur dans l'ecosystem 6 acteurs decision-012).

**Refonte critique v3.0** par rapport a v2.2 :
- Acteur Assure = personne assuree (peut etre distincte du Customer souscripteur) -- decision-012
- 3 cas usage modeles : B2C personne physique (Assure = Customer) / B2B entreprise (Assure designe) / Famille (parents + enfants)
- Expo SDK 51 managed workflow (simplification vs React Native pur v2.2)
- 4 langues (fr / ar classique / ar-MA darija / en) -- decision-008
- Theme Sofidemy (bleu marine #0E1B3D + gold #C8A465) -- decision-011
- NOUVEAU Carte police QR Code signed offline (anti-fraud + controle police MA)
- NOUVEAU FNOL Assure simplifie 4 etapes mobile-first
- NOUVEAU GPS tracking tow + emergency localisation
- NOUVEAU WhatsApp scope strict 8 templates assure (Sprint 9 v3.0)

A la sortie de ce sprint :
- App `apps/web-assure-app` Expo SDK 51 (iOS + Android via EAS Build)
- 9 ecrans : Login + Home + PolicyCard + Sinistres + SinistreNew + SinistreTracking + Emergency + Documents + Profile
- Auth Assure avec 3 cas usage linking (B2C/B2B/Famille)
- Migration `insure_policies.assure_user_ids UUID[]` (array Sprint 7.5b)
- Carte police QR Code signed payload (verification public scan controle MA)
- FNOL Assure workflow 4 etapes (trigger Sprint 24 master orchestrator)
- GPS background tracking tow (Expo Location permissions iOS + Android)
- Emergency screen (bouton URGENCE + carrier + Police 19)
- WhatsApp scope strict 8 templates assure whitelist
- Push notifications Expo + FCM + APNs
- 5 permissions Sprint 7.5a `assure.*` enforced (view_mine / report / access / emergency / update_mine)
- Tests E2E Detox 25+ + seeds 10 assures (3 cas usage)
- EAS Build production iOS + Android pret pour soumission stores

---

## Distinction Customer vs Assure (decision-012 critique)

**Customer (Sprint 17 Customer Portal Web)** = personne ayant **souscrit** la police (titulaire contrat) :
- Permissions : 17 perms `customer.*` (souscription + paiement + FNOL + management)
- App : web-customer-portal Next.js 14 (PWA web)
- Use case : decide quoi souscrire + paie primes

**Assure (Sprint 18 Assure Portal Mobile)** = personne **assuree** physique sur la police :
- Permissions : 5 perms `assure.*` (lecture-seule sauf FNOL + emergency)
- App : web-assure-app Expo SDK 51 (mobile native iOS + Android)
- Use case : montre attestation police + declare sinistre + suit tracking

**3 cas usage modeles** :

**Cas A B2C personne physique** (99% marche Maroc particuliers) :
- Customer (souscripteur) = Assure (assure) -- meme user dans `auth_users`
- `insure_policies.customer_user_id = insure_policies.assure_user_ids[0]`
- 2 portails accessibles avec meme login (web + mobile)
- Auto-link automatique a la souscription

**Cas B B2B entreprise** (5% Maroc, critical business) :
- Customer = entreprise/DAF (responsable contrats)
- Assure = employes designes conducteurs (2-50 personnes)
- `insure_policies.customer_user_id = DAF`
- `insure_policies.assure_user_ids = [employee1, ..., employee50]`
- Workflow invitation email/SMS pour Assures

**Cas C Famille** (2% Maroc) :
- Customer = parent souscripteur
- Assure = parent + conjoint + enfants majeurs (mineurs sans login)
- Workflow linking via CIN match ou invitation

**Modele DB** (extension Tache 4.5.2) :
```sql
ALTER TABLE insure_policies
  ADD COLUMN assure_user_ids UUID[] NOT NULL DEFAULT '{}';
CREATE INDEX idx_insure_policies_assure_user_ids 
  ON insure_policies USING GIN(assure_user_ids);
```

Verification `assure_user_ids @> ARRAY[$assureUserId]::uuid[]` pour autoriser acces Assure.

---

## Frontiere du Sprint

**INCLUS** :
- App Expo SDK 51 managed workflow (iOS + Android)
- 9 ecrans squelette + navigation (React Navigation 6)
- Auth Assure 3 cas usage (B2C auto-link + B2B invitation + Famille CIN match)
- Migration `assure_user_ids UUID[]` + index GIN
- Carte police QR Code signed (carrier private key)
- Endpoint public `/api/v1/public/policy-verify` (no auth -- controle police MA scan)
- FNOL Assure 4 etapes simplifie (vs 6 etapes Customer Portal)
- Trigger Sprint 24 master orchestrator depuis FNOL
- GPS background tracking tow mission (Expo Location)
- Emergency screen + workflow urgence (carrier + Police 19 si necessaire)
- 8 templates WhatsApp assure whitelist (Sprint 9 v3.0 STATUS_ONLY_TEMPLATES.assure)
- Push notifications Expo + FCM + APNs registration
- 5 permissions Sprint 7.5a `assure.*` enforce
- Offline-first AsyncStorage + 30 jours cache
- Theme Sofidemy + i18n 4 langues (fr/ar/ar-MA/en)
- Tests E2E Detox 25+ + seeds 10 assures
- EAS Build production iOS + Android

**EXCLU** (sera ajoute aux sprints suivants) :
- Self-service souscription mobile (reserve Customer Portal Sprint 17)
- Paiement primes mobile (Customer Portal seulement)
- Renewal police mobile (Customer Portal seulement)
- Modification couvertures (Customer Portal seulement)
- Chat support live (Sprint 31 Agent Sky)
- Comparateur produits (Customer Portal seulement)
- Notifications marketing (post-pilote Phase 7+)

---

## Lectures Prealables Obligatoires

1. **Decision-006** : NO emoji policy
2. **Decision-008** : Data residency Maroc + multilingue 4 langues
3. **Decision-011** : Rebrand Sofidemy + theme
4. **Decision-012** : Ecosystem 6 acteurs (Assure distinct)
5. **Correction Saad terrain #7** : WhatsApp scope strict (Sprint 9 v3.0)
6. **Sortie Sprint 5** : @insurtech/auth + JWT mobile
7. **Sortie Sprint 7.5a** : 130 permissions + 5 perms `assure.*`
8. **Sortie Sprint 9 v3.0** : STATUS_ONLY_TEMPLATES.assure (8 templates)
9. **Sortie Sprint 14** : insure_policies modele DB
10. **Sortie Sprint 17** : Customer Portal pattern + FNOL 6 etapes (mirror)
11. **Sortie Sprint 22.5** : Tow App + tow_mission_locations GPS

---

## Stack Imposee (Sprint 18)

| Composant | Version | Notes |
|-----------|---------|-------|
| expo | ~51.0.0 | Managed workflow simplifie |
| react-native | 0.74.x | Latest stable Expo 51 |
| react | 18.2.0 | Aligned RN 0.74 |
| @react-navigation/native | 6.x | Stack + bottom tabs |
| @react-navigation/native-stack | 6.x | Native performance |
| @react-navigation/bottom-tabs | 6.x | Bottom navigation |
| expo-location | ~17.0.x | GPS background tracking |
| expo-notifications | ~0.28.x | Push notifications |
| expo-camera | ~15.0.x | Photo capture FNOL |
| expo-image-picker | ~15.0.x | Image picker gallery |
| expo-localization | ~15.0.x | Auto-detect device language |
| expo-secure-store | ~13.0.x | Tokens (KeyChain iOS / Keystore Android) |
| react-native-qrcode-svg | 6.x | QR Code generation |
| react-native-maps | 1.14.x | Maps Google + Apple |
| react-native-event-source | 1.x | SSE real-time tracking |
| @tanstack/react-query | 5.62.x | Server state mgmt |
| @react-native-async-storage/async-storage | 1.23.x | Persistent storage |
| nativewind | 4.x | Tailwind for RN |
| react-hook-form | 7.53.x | Forms FNOL |
| zod | 3.24.x | Validation schemas |
| i18next + react-i18next | 23.x | I18n 4 langues |
| date-fns | 4.x | Dates + ar-MA locale |
| @insurtech/auth | workspace | JWT mobile + refresh |
| @insurtech/comm-client | workspace | Sprint 9 client |

**Variables env publiques Expo** :
- `EXPO_PUBLIC_API_BASE_URL=https://api.assurflow.ma`
- `EXPO_PUBLIC_PUBLIC_VERIFY_URL=https://verify.assurflow.ma/policy`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_DEFAULT_LANGUAGE=fr`

**Variables build (eas.json)** : `APPLE_TEAM_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON` + `FCM_SERVER_KEY` + `APNS_KEY_FILE`

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 4.5.1 | Bootstrap Expo SDK 51 + theme Sofidemy + i18n 4 langues + 9 ecrans squelette | 5h | P0 | Sprint 17 |
| 4.5.2 | Auth Assure + linking Customer 3 cas usage + migration assure_user_ids[] | 5h | P0 | 4.5.1 |
| 4.5.3 | Dashboard Assure + Home Screen + actions rapides | 4h | P0 | 4.5.2 |
| 4.5.4 | **NOUVEAU** Carte police QR Code signed + attestation offline 30 jours | 5h | P0 | 4.5.3 |
| 4.5.5 | **NOUVEAU** FNOL Assure simplifie 4 etapes + trigger Sprint 24 | 6h | P0 | 4.5.4 |
| 4.5.6 | Sinistres list + tabs (En cours / Resolus) + filtres | 3h | P0 | 4.5.5 |
| 4.5.7 | Tracking sinistre real-time mobile + SSE + 12 milestones | 5h | P0 | 4.5.6 |
| 4.5.8 | **NOUVEAU** GPS tracking tow + emergency localisation + map | 6h | P0 | 4.5.7 |
| 4.5.9 | Documents Assure (lecture-seule) + download offline | 3h | P0 | 4.5.8 |
| 4.5.10 | Profile + emergency contacts + multilingue switching | 4h | P0 | 4.5.9 |
| 4.5.11 | **NOUVEAU** Notifications push + WhatsApp scope strict 8 templates | 4h | P0 | 4.5.10 |
| 4.5.12 | Tests E2E Detox 25+ + seeds 10 assures + accessibility + EAS build | 9h | P0 | 4.5.11 |
| | **TOTAL** | **65h** | | |

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

---

### Tache 4.5.1 : Bootstrap Expo SDK 51 + theme Sofidemy + i18n 4 langues

**Metadonnees** : P0 | 5h | Depend de : Sprint 17

**But** : Bootstrap apps/web-assure-app avec Expo SDK 51 managed + theme Sofidemy + i18n 4 langues + 9 ecrans squelette navigables.

**Structure du projet** :
```
repo/apps/web-assure-app/
  package.json + app.json + eas.json + babel.config.js + tsconfig.json
  src/
    theme/sofidemy.ts            # Palettes + typography decision-011
    i18n/                        # 4 langues
      index.ts + fr.json + ar.json + ar-MA.json + en.json
    navigation/
      RootNavigator.tsx + AppNavigator.tsx + AuthNavigator.tsx
    screens/                     # 9 ecrans
      LoginScreen + HomeScreen + PolicyCardScreen (4.5.4)
      SinistresScreen + SinistreNewScreen (4.5.5)
      SinistreTrackingScreen + EmergencyScreen (4.5.8)
      DocumentsScreen + ProfileScreen
    components/
      ui/ + fnol/ + tracking/ + qrcode/
    services/
      api-client.ts + auth-storage.ts + offline-storage.ts
    hooks/
      useAuth + useAssurePolicies + useRealtimeTracking + useGpsTracking
    types/ + constants/
  __tests__/ + e2e/
```

**Pattern theme/sofidemy.ts** :
```typescript
export const sofidemyColors = {
  primary: { 50: '#E6E9F2', 500: '#0E1B3D', 700: '#091228', 900: '#050913' },
  secondary: { 50: '#FAF3E0', 500: '#C8A465', 700: '#A07F40', 900: '#5C4A26' },
  success: { 500: '#22C55E' }, warning: { 500: '#F59E0B' }, danger: { 500: '#DC2626' },
  gray: { 50: '#F9FAFB', 500: '#6B7280', 900: '#111827' },
} as const;

export const sofidemyTypography = {
  fontFamily: { body: 'Inter', heading: 'Inter-Bold', arabic: 'NotoSansArabic' },
  fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 32 },
} as const;
```

**Pattern app.json permissions critiques** :
```json
{
  "expo": {
    "name": "Assurflow Assure", "slug": "assurflow-assure", "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "ma.assurflow.assure",
      "infoPlist": {
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Cette app utilise votre position pour suivre votre depanneuse en cas de sinistre.",
        "NSLocationWhenInUseUsageDescription": "Cette app utilise votre position pour le service d'urgence.",
        "NSCameraUsageDescription": "Cette app utilise la camera pour photographier votre sinistre.",
        "UIBackgroundModes": ["location", "fetch"]
      }
    },
    "android": {
      "package": "ma.assurflow.assure",
      "permissions": [
        "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "ACCESS_BACKGROUND_LOCATION",
        "CAMERA", "POST_NOTIFICATIONS"
      ]
    },
    "plugins": [
      ["expo-location", { "locationAlwaysAndWhenInUsePermission": "Cette app utilise votre position pour suivre votre depanneuse." }],
      ["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#0E1B3D" }],
      ["expo-camera", { "cameraPermission": "Cette app utilise la camera pour photographier votre sinistre." }]
    ]
  }
}
```

**Pattern i18n/index.ts** :
```typescript
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './fr.json';
import ar from './ar.json';
import arMA from './ar-MA.json';
import en from './en.json';

const deviceLocale = Localization.getLocales()[0]?.languageTag || 'fr';
const supportedLocales = ['fr', 'ar', 'ar-MA', 'en'];
const selectedLocale = supportedLocales.find(l => deviceLocale.startsWith(l)) || 'fr';

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr }, ar: { translation: ar },
    'ar-MA': { translation: arMA }, en: { translation: en },
  },
  lng: selectedLocale, fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});
```

**Actions principales** :
- Bootstrap Expo SDK 51 managed + app.json complet (iOS + Android permissions)
- eas.json profiles (development + preview + production)
- Theme Sofidemy palettes complets + i18n 4 langues
- 9 ecrans squelette navigables + React Navigation 6
- Tanstack Query 5 + AsyncStorage persistence
- EAS Build preview validation

**Criteres P0** :
- V1 (P0) : Expo SDK 51 + RN 0.74+
- V2 (P0) : Theme Sofidemy applique
- V3 (P0) : i18n 4 langues + auto-detect
- V4 (P0) : 9 ecrans navigables
- V5 (P0) : EAS Build preview OK

**Commit** :
```bash
git commit -m "feat(sprint-18): REFONTE bootstrap expo sdk 51 + theme + i18n 4 langues

Task: 4.5.1
Sprint: 18 (Phase 4 / Sprint 5)
Decisions: decision-012 + decision-011 + decision-008"
```

---

### Tache 4.5.2 : Auth Assure + linking 3 cas usage + migration

**Metadonnees** : P0 | 5h | Depend de : 4.5.1

**But** : Auth Assure 3 cas usage (B2C/B2B/Famille) + migration `assure_user_ids[]`.

**Migration** `1735000000NNN-AddAssureUserIdsToInsurePolicies.ts` :
```typescript
export class AddAssureUserIdsToInsurePolicies1735000000NNN implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE insure_policies
      ADD COLUMN assure_user_ids UUID[] NOT NULL DEFAULT '{}';
    `);
    await queryRunner.query(`
      CREATE INDEX idx_insure_policies_assure_user_ids 
      ON insure_policies USING GIN(assure_user_ids);
    `);
    // Cas A B2C : auto-migration assure_user_ids[0] = customer_user_id
    await queryRunner.query(`
      UPDATE insure_policies
      SET assure_user_ids = ARRAY[customer_user_id]
      WHERE assure_user_ids = '{}' AND customer_user_id IS NOT NULL;
    `);
  }
}
```

**Pattern assure-auth.service.ts** :
```typescript
@Injectable()
export class AssureAuthService {
  async loginAssure(input: { email: string; password: string }): Promise<{ accessToken: string }> {
    const user = await this.authService.validateCredentials(input.email, input.password);
    const hasPolicy = await this.policyRepo
      .createQueryBuilder('p')
      .where(':userId = ANY(p.assure_user_ids)', { userId: user.id })
      .getCount();
    if (hasPolicy === 0) {
      throw new ForbiddenException('User has no policy as Assure');
    }
    return this.authService.issueTokens(user, { app: 'assure-mobile' });
  }

  // Cas A B2C: auto-link
  async linkExistingCustomerAsAssure(input: { customerUserId: string; policyId: string }): Promise<void> {
    const policy = await this.policyRepo.findOneOrFail({ where: { id: input.policyId } });
    if (!policy.assure_user_ids.includes(input.customerUserId)) {
      policy.assure_user_ids = [...policy.assure_user_ids, input.customerUserId];
      await this.policyRepo.save(policy);
    }
  }

  // Cas B B2B: invitation workflow
  async createAssureInvitation(input: {
    customerUserId: string;
    policyId: string;
    inviteeEmail: string; inviteePhone: string; inviteeName: string;
  }): Promise<{ invitationCode: string }> {
    const policy = await this.policyRepo.findOneOrFail({ 
      where: { id: input.policyId, customer_user_id: input.customerUserId } 
    });
    const code = generateInvitationCode(); // 8 chars
    const expiresAt = addDays(new Date(), 7);
    
    await this.invitationsRepo.save({
      code, policyId: input.policyId,
      inviteeEmail: input.inviteeEmail, inviteePhone: input.inviteePhone,
      inviteeName: input.inviteeName, invitedByUserId: input.customerUserId,
      expiresAt, status: 'pending',
    });
    
    const deepLink = `assurflow://invite?code=${code}`;
    await this.emailService.sendEmail({
      to: input.inviteeEmail, templateName: 'assure_invitation',
      data: { code, deepLink, customerCompanyName: policy.customer_company_name },
      language: 'fr',
    });
    return { invitationCode: code };
  }

  async registerAssureFromInvitation(input: {
    invitationCode: string;
    profile: { firstName: string; lastName: string; cin: string; password: string };
  }): Promise<{ user: AuthUser; accessToken: string }> {
    const invitation = await this.invitationsRepo.findOne({
      where: { code: input.invitationCode, status: 'pending', expiresAt: MoreThan(new Date()) },
    });
    if (!invitation) throw new BadRequestException('Invalid or expired invitation');
    
    const user = await this.authService.createUser({
      email: invitation.inviteeEmail, phone: invitation.inviteePhone,
      password: input.profile.password,
      firstName: input.profile.firstName, lastName: input.profile.lastName,
      cin: input.profile.cin, role: 'assure', tenantId: invitation.tenantId,
    });
    
    const policy = await this.policyRepo.findOneOrFail({ where: { id: invitation.policyId } });
    policy.assure_user_ids = [...policy.assure_user_ids, user.id];
    await this.policyRepo.save(policy);
    
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    invitation.acceptedByUserId = user.id;
    await this.invitationsRepo.save(invitation);
    
    return this.authService.issueTokens(user, { app: 'assure-mobile' });
  }
}
```

**Pattern assure-policy-linking.service.ts** :
```typescript
@Injectable()
export class AssurePolicyLinkingService {
  async verifyAssureBelongsToPolicy(assureUserId: string, policyId: string): Promise<boolean> {
    const result = await this.policyRepo
      .createQueryBuilder('p')
      .where('p.id = :policyId', { policyId })
      .andWhere(':assureUserId = ANY(p.assure_user_ids)', { assureUserId })
      .getCount();
    return result > 0;
  }
  
  async listPoliciesAsAssure(assureUserId: string): Promise<InsurePolicy[]> {
    return this.policyRepo
      .createQueryBuilder('p')
      .where(':assureUserId = ANY(p.assure_user_ids)', { assureUserId })
      .andWhere('p.status IN (:...activeStatuses)', { activeStatuses: ['active', 'pending_renewal'] })
      .orderBy('p.start_date', 'DESC').getMany();
  }
}
```

**Criteres P0** :
- V1 (P0) : Migration assure_user_ids[] + index GIN
- V2 (P0) : Cas A B2C linking auto-fonctionnel
- V3 (P0) : Cas B B2B invitation workflow + register
- V4 (P0) : verifyAssureBelongsToPolicy ANY() query
- V5 (P0) : Tests 10+ scenarios 3 cas

**Commit** :
```bash
git commit -m "feat(sprint-18): REFONTE auth assure + linking 3 cas usage + migration assure_user_ids

Task: 4.5.2
Decisions: decision-012 acteur 5 distinct"
```

---

### Tache 4.5.3 : Dashboard Assure + Home Screen + actions rapides

**Metadonnees** : P0 | 4h | Depend de : 4.5.2

**But** : HomeScreen avec polices + sinistres + 3 boutons larges (DECLARER + URGENCE + ATTESTATION).

**Pattern HomeScreen.tsx** :
```typescript
export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { data: policies } = useAssurePolicies();
  const { data: sinistres } = useAssureSinistres({ status: 'in_progress' });

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-primary-500 pt-12 pb-6 px-6">
        <Text className="text-white text-2xl font-heading">
          {t('home.greeting', { name: user.firstName })}
        </Text>
      </View>

      {/* Actions rapides 3 boutons larges */}
      <View className="px-6 -mt-4">
        <View className="bg-white rounded-2xl p-4 shadow-md flex-row justify-around">
          <ActionButton icon="alert-circle" label={t('home.actions.declare')}
            onPress={() => navigation.navigate('SinistreNew')} color="primary" />
          <ActionButton icon="phone-call" label={t('home.actions.emergency')}
            onPress={() => navigation.navigate('Emergency')} color="danger" />
          <ActionButton icon="file-text" label={t('home.actions.attestation')}
            onPress={() => navigation.navigate('PolicyCard')} color="secondary" />
        </View>
      </View>

      {/* Mes polices */}
      <View className="px-6 mt-6">
        <Text className="text-lg font-heading text-gray-900 mb-3">{t('home.myPolicies')}</Text>
        {policies?.map(policy => (
          <PolicyCard key={policy.id} policy={policy}
            onPress={() => navigation.navigate('PolicyCard', { policyId: policy.id })} />
        ))}
      </View>

      {/* Sinistres en cours */}
      <View className="px-6 mt-6">
        <Text className="text-lg font-heading text-gray-900 mb-3">{t('home.activeSinistres')}</Text>
        {sinistres?.map(s => (
          <SinistreCard key={s.id} sinistre={s}
            onPress={() => navigation.navigate('SinistreTracking', { sinistreId: s.id })} />
        ))}
      </View>
    </ScrollView>
  );
}
```

**Criteres P0** : V1 3 boutons actions rapides / V2 polices + sinistres affiches / V3 Permission view_mine / V4 Tests 6+

**Commit** : `feat(sprint-18): dashboard assure home screen + actions rapides` (Task: 4.5.3)

---

### Tache 4.5.4 : NOUVEAU Carte police QR Code signed + offline

**Metadonnees** : P0 | 5h | Depend de : 4.5.3

**But** : **NOUVEAU v3.0** -- Carte police QR Code signed offline + attestation officielle MA (loi assurance + controle police MA scan).

**Pattern PolicyCardScreen.tsx** :
```typescript
export default function PolicyCardScreen({ route }) {
  const { policyId } = route.params;
  const { t } = useTranslation();
  const { data: policyCard, isLoading } = usePolicyCard(policyId);
  const [isFullScreenQr, setIsFullScreenQr] = useState(false);

  if (isLoading) return <ActivityIndicator />;

  return (
    <SafeAreaView className="flex-1 bg-primary-500">
      <ScrollView contentContainerClassName="px-6 pt-4 pb-12">
        <View className="flex-row items-center mb-6">
          <Image source={{ uri: policyCard.carrierLogoUrl }} className="w-16 h-16 mr-4" />
          <View>
            <Text className="text-white text-xl font-heading">{policyCard.carrierName}</Text>
            <Text className="text-secondary-500 text-base">{policyCard.branchLabel}</Text>
          </View>
        </View>

        <Pressable className="bg-white rounded-3xl p-6 mb-6 items-center"
          onPress={() => setIsFullScreenQr(true)}>
          <QRCode value={policyCard.signedQrPayload} size={200}
            color={sofidemyColors.primary[500]} backgroundColor="white" />
          <Text className="mt-4 text-gray-500 text-sm">{t('policyCard.tapToFullScreen')}</Text>
        </Pressable>

        <View className="bg-white rounded-2xl p-6 mb-4">
          <Text className="text-xs text-gray-500 mb-1">{t('policyCard.policyNumber')}</Text>
          <Text className="text-lg font-heading text-gray-900 mb-3">{policyCard.policyNumber}</Text>
          <Text className="text-xs text-gray-500 mb-1">{t('policyCard.assureName')}</Text>
          <Text className="text-base text-gray-900 mb-3">{policyCard.assureName}</Text>
          <Text className="text-xs text-gray-500 mb-1">{t('policyCard.validity')}</Text>
          <Text className="text-base text-gray-900">
            {format(policyCard.startDate, 'P', { locale: dateFnsLocale })} - {format(policyCard.endDate, 'P', { locale: dateFnsLocale })}
          </Text>
        </View>

        <Pressable className="bg-secondary-500 rounded-lg p-4 flex-row justify-center items-center"
          onPress={() => downloadAttestationPdf(policyCard.policyId)}>
          <Feather name="download" size={20} color="white" />
          <Text className="text-white font-bold ml-2">{t('policyCard.downloadPdf')}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={isFullScreenQr} transparent={false}>
        <View className="flex-1 bg-white justify-center items-center">
          <QRCode value={policyCard.signedQrPayload}
            size={Dimensions.get('window').width - 40} color="black" backgroundColor="white" />
          <Text className="mt-6 text-gray-900 text-xl font-heading">{policyCard.assureName}</Text>
          <Text className="text-gray-500 mt-1">{policyCard.policyNumber}</Text>
          <Pressable className="absolute top-12 right-6" onPress={() => setIsFullScreenQr(false)}>
            <Feather name="x" size={32} />
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
```

**Pattern assure-policy-card.service.ts (API)** :
```typescript
@Injectable()
export class AssurePolicyCardService {
  async getPolicyCard(input: { policyId: string; assureUserId: string }): Promise<PolicyCardDto> {
    const belongs = await this.linkingService.verifyAssureBelongsToPolicy(input.assureUserId, input.policyId);
    if (!belongs) throw new ForbiddenException('Assure does not belong to this policy');

    const policy = await this.policyRepo.findOneOrFail({
      where: { id: input.policyId },
      relations: ['carrier', 'coverages'],
    });
    const assure = await this.userRepo.findOneOrFail({ where: { id: input.assureUserId } });

    const signedPayload = await this.generateQrCode({
      policyNumber: policy.policy_number,
      assureCinHash: this.hashCin(assure.cin),
      carrierId: policy.carrier_id,
      validityStart: policy.start_date, validityEnd: policy.end_date,
    });

    return {
      policyId: policy.id, policyNumber: policy.policy_number,
      carrierName: policy.carrier.name, carrierLogoUrl: policy.carrier.logo_url,
      branchLabel: policy.branch_label,
      assureName: `${assure.first_name} ${assure.last_name}`,
      startDate: policy.start_date, endDate: policy.end_date,
      coverages: policy.coverages.map(c => ({ label: c.label, included: c.included })),
      signedQrPayload: signedPayload,
    };
  }

  // Anti-fraud: carrier private key signing
  async generateQrCode(input: QrPayloadInput): Promise<string> {
    const data = JSON.stringify(input);
    const signature = await this.signingService.sign(data, 'carrier-private-key');
    return Buffer.from(JSON.stringify({ data, signature })).toString('base64');
  }
}
```

**Endpoint public verify** (no auth) :
```typescript
@Controller('api/v1/public/policy-verify')
export class PublicPolicyVerifyController {
  @Get()
  async verifyPolicy(@Query('qr') qrBase64: string): Promise<PublicVerifyDto> {
    const decoded = JSON.parse(Buffer.from(qrBase64, 'base64').toString());
    const { data, signature } = decoded;
    const isValid = await this.signingService.verify(data, signature, 'carrier-public-key');
    if (!isValid) return { valid: false, error: 'Invalid signature' };
    
    const payload = JSON.parse(data);
    const policy = await this.policyRepo.findOne({ where: { policy_number: payload.policyNumber } });
    if (!policy || policy.status !== 'active') return { valid: false, error: 'Policy not active' };
    
    const now = new Date();
    if (now < policy.start_date || now > policy.end_date) {
      return { valid: false, error: 'Policy outside validity period' };
    }
    return {
      valid: true, policyNumber: payload.policyNumber,
      carrierName: policy.carrier_name, validityEnd: policy.end_date,
    };
  }
}
```

**Cache offline 30 jours** : usePolicyCard avec AsyncStorage persistence.

**Criteres P0** :
- V1 (P0) : QR Code generation signed carrier private key
- V2 (P0) : Cache offline 30 jours AsyncStorage
- V3 (P0) : Endpoint public verify accessible (no auth)
- V4 (P0) : Permission `assure.policy.view_mine` enforce
- V5 (P0) : Mode plein-ecran QR fonctionnel

**Commit** :
```bash
git commit -m "feat(sprint-18): NOUVEAU carte police qr code signed + offline 30j

Task: 4.5.4
Decisions: decision-012 utility + anti-fraud controle police MA"
```

---

### Tache 4.5.5 : NOUVEAU FNOL Assure simplifie 4 etapes + trigger Sprint 24

**Metadonnees** : P0 | 6h | Depend de : 4.5.4

**But** : **NOUVEAU v3.0** -- FNOL Assure 4 etapes (vs 6 etapes Customer) + trigger Sprint 24 master orchestrator.

**Etapes wizard** :
1. Type sinistre + police concernee (4 cards : collision / vol / incendie / autre)
2. Date/heure/lieu (date picker + geolocation auto)
3. Photos (Expo Camera multi-shot 3-5 photos)
4. Description courte (text + voice recording optional)

**Pattern assure-fnol-declaration.service.ts** :
```typescript
@Injectable()
export class AssureFnolDeclarationService {
  async submitFnol(input: { assureUserId: string; data: FnolInput }): Promise<{ sinistreId: string }> {
    const belongs = await this.linkingService.verifyAssureBelongsToPolicy(
      input.assureUserId, input.data.policyId,
    );
    if (!belongs) throw new ForbiddenException('Assure does not belong to this policy');

    const sinistre = await this.sinistreRepo.save({
      policy_id: input.data.policyId,
      declared_by_user_id: input.assureUserId,
      fnol_source: 'assure_app',
      fnol_declared_at: new Date(),
      type: input.data.type,
      occurred_at: input.data.occurredAt,
      location: { lat: input.data.lat, lng: input.data.lng, address: input.data.address },
      description: input.data.description,
      photos: input.data.photoS3Keys,
      status: 'fnol_declared',
    });

    // Trigger Sprint 24 master orchestrator
    await this.kafkaProducer.send({
      topic: 'insurtech.events.repair',
      messages: [{
        key: sinistre.id,
        value: JSON.stringify({
          event: 'fnol_declared',
          sinistreId: sinistre.id,
          source: 'assure_app',
          assureUserId: input.assureUserId,
        }),
      }],
    });

    // Notify Customer (Cas B B2B) si different
    const policy = await this.policyRepo.findOneOrFail({ where: { id: input.data.policyId } });
    if (policy.customer_user_id !== input.assureUserId) {
      await this.notificationRouter.routeNotification({
        userId: policy.customer_user_id,
        contentType: 'status_only',
        templateName: 'customer_assure_declared_fnol',
        safeData: { assureName: '*****', sinistreIdShort: sinistre.id.substring(0, 8) },
        tenantId: policy.tenant_id,
      });
    }

    await this.auditService.logEvent({
      tenantId: policy.tenant_id, userId: input.assureUserId,
      eventType: 'fnol_declared_by_assure', resourceId: sinistre.id,
    });

    return { sinistreId: sinistre.id };
  }
}
```

**Criteres P0** :
- V1 (P0) : Workflow 4 etapes complete
- V2 (P0) : Trigger Sprint 24 Kafka event `insurtech.events.repair`
- V3 (P0) : Notification Customer (cas B2B)
- V4 (P0) : Permission `assure.sinistres.report`
- V5 (P0) : verifyAssureBelongsToPolicy check
- V6 (P0) : Tests 10+

**Commit** :
```bash
git commit -m "feat(sprint-18): NOUVEAU fnol assure simplifie mobile 4 etapes + trigger sprint 24

Task: 4.5.5"
```

---

### Tache 4.5.6 : Sinistres list + tabs + filtres

**Metadonnees** : P0 | 3h | Depend de : 4.5.5

**But** : SinistresScreen tabs (En cours / Resolus) + filtres + Service `listMySinistres(assureUserId)`.

Pattern : Liste cards par sinistre avec status workflow + bouton tracking. Permission `assure.sinistres.report` (lecture). Tests 4+.

**Commit** : `feat(sprint-18): sinistres list assure + filtres` (Task: 4.5.6)

---

### Tache 4.5.7 : Tracking sinistre real-time mobile + SSE

**Metadonnees** : P0 | 5h | Depend de : 4.5.6

**But** : SinistreTrackingScreen mirror Sprint 17 Tache 4.4.7 UX mobile compact + SSE via react-native-event-source + 12 milestones.

**Pattern useRealtimeTracking hook** :
```typescript
export function useRealtimeTracking(sinistreId: string) {
  const [status, setStatus] = useState<TrackingStatus | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(
      `${API_BASE_URL}/api/v1/assure/sinistres/${sinistreId}/stream`,
      { headers: { Authorization: `Bearer ${getAccessToken()}` } },
    );
    eventSource.addEventListener('milestone', (e: any) => {
      setMilestones(prev => [...prev, JSON.parse(e.data)]);
    });
    eventSource.addEventListener('status_changed', (e: any) => {
      setStatus(JSON.parse(e.data));
    });
    return () => eventSource.close();
  }, [sinistreId]);

  return { status, milestones };
}
```

**12 milestones references** : `declared`, `carrier_reviewed`, `tow_dispatched`, `vehicle_received`, `diagnosed`, `devis_sent_expert`, `expert_validated`, `carrier_approved`, `parts_ordered`, `repair_in_progress`, `qc_done`, `ready_for_delivery`.

**Criteres P0** : V1 SSE library / V2 12 milestones display / V3 Tests 8+

**Commit** : `feat(sprint-18): tracking sinistre real-time mobile + sse 12 milestones` (Task: 4.5.7)

---

### Tache 4.5.8 : NOUVEAU GPS tracking tow + emergency localisation

**Metadonnees** : P0 | 6h | Depend de : 4.5.7

**But** : **NOUVEAU v3.0** -- GPS real-time tow + bouton emergency localisation (carrier + Police 19 si necessaire).

**Pattern useGpsTowTracking hook** :
```typescript
export function useGpsTowTracking(towMissionId: string | null) {
  const [towLocation, setTowLocation] = useState<Coords | null>(null);
  const [eta, setEta] = useState<number | null>(null);

  useEffect(() => {
    if (!towMissionId) return;
    const eventSource = new EventSource(
      `${API_BASE_URL}/api/v1/assure/tow-tracking/${towMissionId}/stream`,
      { headers: { Authorization: `Bearer ${getAccessToken()}` } },
    );
    eventSource.addEventListener('location', (e: any) => {
      const data = JSON.parse(e.data);
      setTowLocation({ latitude: data.lat, longitude: data.lng });
      setEta(data.etaSeconds);
    });
    return () => eventSource.close();
  }, [towMissionId]);

  return { towLocation, eta };
}
```

**Pattern EmergencyScreen.tsx** :
```typescript
export default function EmergencyScreen() {
  const { t } = useTranslation();
  const [emergencyInProgress, setEmergencyInProgress] = useState(false);

  const triggerEmergency = async () => {
    setEmergencyInProgress(true);
    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      await api.post('/api/v1/assure/emergency/trigger', {
        location: { lat: location.coords.latitude, lng: location.coords.longitude },
        timestamp: new Date().toISOString(),
      });
      Alert.alert(t('emergency.acknowledged'), t('emergency.helpOnTheWay'), [{ text: 'OK' }]);
    } catch (err) {
      Alert.alert(t('emergency.error'), t('emergency.tryAgain'));
    } finally {
      setEmergencyInProgress(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-danger-500 justify-center items-center px-8">
      <Pressable className="bg-white rounded-full w-56 h-56 justify-center items-center"
        onPress={triggerEmergency} disabled={emergencyInProgress}>
        <Feather name="alert-circle" size={64} color={sofidemyColors.danger[500]} />
        <Text className="text-danger-500 text-2xl font-heading mt-2">
          {emergencyInProgress ? t('emergency.sending') : t('emergency.button')}
        </Text>
      </Pressable>
      <Text className="text-white text-center mt-12 px-4">{t('emergency.description')}</Text>
      <View className="mt-12 flex-row justify-around w-full">
        <Pressable className="items-center" onPress={() => Linking.openURL('tel:19')}>
          <Feather name="phone" size={32} color="white" />
          <Text className="text-white mt-2">{t('emergency.police')}</Text>
        </Pressable>
        <Pressable className="items-center" onPress={() => Linking.openURL('tel:150')}>
          <Feather name="phone" size={32} color="white" />
          <Text className="text-white mt-2">{t('emergency.medical')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

**Pattern assure-gps-tracking.service.ts** :
```typescript
@Injectable()
export class AssureGpsTrackingService {
  subscribeToTowLocation(towMissionId: string): Observable<Coords> {
    return new Observable(subscriber => {
      const interval = setInterval(async () => {
        const latest = await this.towLocationRepo.findOne({
          where: { tow_mission_id: towMissionId },
          order: { recorded_at: 'DESC' },
        });
        if (latest) {
          subscriber.next({
            lat: latest.latitude, lng: latest.longitude,
            etaSeconds: latest.eta_seconds,
          });
        }
      }, 5000);
      return () => clearInterval(interval);
    });
  }

  async triggerEmergency(input: { assureUserId: string; location: Coords }): Promise<void> {
    const policies = await this.policyRepo
      .createQueryBuilder('p')
      .where(':userId = ANY(p.assure_user_ids)', { userId: input.assureUserId })
      .andWhere('p.status = :status', { status: 'active' })
      .getMany();

    const sinistre = await this.sinistreRepo.save({
      policy_id: policies[0]?.id,
      declared_by_user_id: input.assureUserId,
      type: 'emergency',
      occurred_at: new Date(),
      location: input.location,
      status: 'emergency_pending',
      description: 'Emergency triggered from mobile app',
    });

    for (const policy of policies) {
      await this.notificationRouter.routeNotification({
        userId: policy.carrier_user_id,
        contentType: 'urgent',
        templateName: 'carrier_assure_emergency',
        safeData: {
          policyNumber: policy.policy_number,
          locationLat: input.location.lat.toString(),
          locationLng: input.location.lng.toString(),
        },
        tenantId: policy.tenant_id,
      });
    }

    await this.auditService.logEvent({
      tenantId: policies[0]?.tenant_id || 'unknown',
      userId: input.assureUserId,
      eventType: 'emergency_triggered',
      resourceId: sinistre.id,
      severity: 'critical',
    });
  }
}
```

**Criteres P0** :
- V1 (P0) : GPS background permissions iOS + Android (app.json declares)
- V2 (P0) : Map react-native-maps tow position real-time
- V3 (P0) : Emergency trigger workflow
- V4 (P0) : Permission `assure.contact_emergency`
- V5 (P0) : Tests 10+

**Commit** :
```bash
git commit -m "feat(sprint-18): NOUVEAU gps tracking tow + emergency localisation + map

Task: 4.5.8
Decisions: sprint 22.5 integration + emergency workflow critical"
```

---

### Tache 4.5.9 : Documents Assure lecture-seule + offline

**Metadonnees** : P0 | 3h | Depend de : 4.5.8

**But** : DocumentsScreen + service `listMyDocuments(assureUserId)` + cache offline 30 jours + Permission `assure.documents.access`.

Pattern liste documents PDF (police + attestation + rapport expert) avec download S3 signed URL (expiration 1h). Cache AsyncStorage 30 jours. Tests 4+.

**Commit** : `feat(sprint-18): documents assure lecture-seule + cache offline 30j` (Task: 4.5.9)

---

### Tache 4.5.10 : Profile + emergency contacts + multilingue

**Metadonnees** : P0 | 4h | Depend de : 4.5.9

**But** : ProfileScreen 5 sections (Info personnelles lecture + Emergency contacts modifiable + Notifications + Langue + Securite).

Pattern emergency contacts critical : 3 contacts max (nom + telephone + relation) -- utilises par Tache 4.5.8 emergency workflow. Service `assure-profile.service.ts` methodes `getProfile / updateProfile / updateLanguage / updateNotificationPreferences / updateEmergencyContacts`. Permission `assure.profile.update_mine`. Tests 6+.

**Commit** : `feat(sprint-18): profile + emergency contacts + langue switching` (Task: 4.5.10)

---

### Tache 4.5.11 : NOUVEAU Notifications push + WhatsApp scope strict

**Metadonnees** : P0 | 4h | Depend de : 4.5.10

**But** : **NOUVEAU v3.0** -- Expo push registration + WhatsApp Sprint 9 v3.0 scope strict 8 templates assure.

**Pattern assure-notifications.service.ts** :
```typescript
@Injectable()
export class AssureNotificationsService {
  async registerPushToken(input: { assureUserId: string; expoPushToken: string }): Promise<void> {
    await this.userTokensRepo.save({
      user_id: input.assureUserId,
      app: 'assure-mobile',
      push_token: input.expoPushToken,
      registered_at: new Date(),
    });
  }

  // Sprint 9 v3.0 enforce whitelist + blacklist server-side
  async sendStatusWhatsApp(input: {
    assureUserId: string;
    templateName: string;
    data: Record<string, string>;
    language: WhatsAppLanguage;
    tenantId: string;
  }): Promise<void> {
    const assure = await this.userRepo.findOneOrFail({ where: { id: input.assureUserId } });
    await this.whatsappService.sendWhatsAppStatus({
      to: assure.phone,
      templateName: input.templateName, // MUST be in STATUS_ONLY_TEMPLATES.assure
      data: input.data, // verifie blacklist server-side
      language: input.language,
      tenantId: input.tenantId,
      userId: input.assureUserId,
    });
  }
}
```

**8 templates Assure whitelist** (Sprint 9 STATUS_ONLY_TEMPLATES.assure) :
1. `assure_fnol_received` -- "Declaration recue, en cours d'examen"
2. `assure_tow_dispatched` -- "Depanneuse en route"
3. `assure_tow_arriving_soon` -- "Depanneuse arrive dans X min"
4. `assure_repair_in_progress` -- "Reparation en cours"
5. `assure_repair_ready_delivery` -- "Vehicule pret pour livraison"
6. `assure_milestone_update` -- "Avancement sinistre"
7. `assure_emergency_acknowledged` -- "Urgence prise en compte"
8. `assure_policy_renewal_due` -- "Renouvellement police a venir"

Aucun template ne contient amount/cin/total_mad (verifie CI Sprint 9).

**Criteres P0** :
- V1 (P0 CRITIQUE) : Aucun template assure ne contient amount/cin
- V2 (P0) : Push token registered Expo + FCM + APNs
- V3 (P0) : Tests 5+ rejet blacklist via Sprint 9

**Commit** :
```bash
git commit -m "feat(sprint-18): NOUVEAU notifications push + whatsapp scope strict 8 templates assure

Task: 4.5.11
Decisions: correction saad #7"
```

---

### Tache 4.5.12 : Tests E2E Detox 25+ + seeds 10 + EAS Build production

**Metadonnees** : P0 | 9h | Depend de : 4.5.11

**But** : Tests E2E Detox 25+ + seeds 10 assures realistic 3 cas + accessibility + EAS Build production.

**Tests E2E Detox categories** :
1. Auth + login + register invitation Cas B (4+ scenarios)
2. Carte police QR + offline + plein-ecran (4+ scenarios)
3. FNOL 4 etapes complete + photos + voice (5+ scenarios)
4. Tracking SSE + milestones display (4+ scenarios)
5. Emergency workflow (3+ scenarios)
6. WhatsApp scope strict rejet montants (5+ scenarios)

**Seeds 10 assures (3 cas usage)** :
- **5 Cas A B2C** : Casa + Rabat + Marrakech + Tanger + Agadir (Customer = Assure)
- **3 Cas B B2B** : DAF Casa Manufacturing + 2 employees / DAF Rabat Logistics + 1 employee
- **2 Cas C Famille** : pere + mere + 1 enfant majeur / pere + 1 enfant majeur

**EAS Build production** :
```bash
cd repo/apps/web-assure-app
eas build --platform ios --profile production
eas build --platform android --profile production
# .ipa + .aab generes pour App Store + Google Play
```

**Coverage Sprint 18** >= 85%.

**Criteres P0** :
- V1 (P0) : Tests Detox 25+ PASS
- V2 (P0) : Seeds 10 assures cas A/B/C
- V3 (P0) : EAS Build iOS + Android production OK
- V4 (P0) : Accessibility audit passing

**Commit** :
```bash
git commit -m "test(sprint-18): tests e2e detox 25+ + seeds 10 assures + eas build production

Task: 4.5.12
Sprint: 18 (Phase 4 / Sprint 5)"
```

---

## Risques + Mitigations

| Risque | Impact | Probabilite | Mitigation |
|--------|--------|-------------|------------|
| Apple/Google rejet permissions GPS background | Bloque release stores | Moyenne | Justifications claires + demo video usage tow tracking |
| Expo SDK 51 breaking changes pendant dev | Bloque sprint | Faible | Lock version exacte + tests avant upgrade |
| Cas B B2B linking complexity | UX confuse | Moyenne | Tests usability dedies + onboarding wizard guide |
| GPS background battery drain | Mauvaise UX | Moyenne | Geofencing + adaptive accuracy + duty cycle |
| QR Code signature compromise | Anti-fraud broken | Faible | Rotation keys carrier + audit signature each scan |
| Emergency false positive | Charge support | Moyenne | Confirmation pre-trigger + cancellation 10s post-trigger |
| Detox flaky tests | CI instable | Moyenne | Retries 3x + screenshots + video recording |

---

## Conformite Maroc

- **Loi 09-08 CNDP** : protection donnees + correction Saad #7 (WhatsApp scope strict) -- heritage Sprint 9
- **Loi ACAPS** : retention 10 ans toute communication assure
- **Loi assurance Maroc** : attestation police obligatoire dans vehicule (QR Code = format moderne accepte)
- **ANRT (Telecoms)** : SMS via providers homologues
- **App Store Maroc** : conformite Apple Guidelines Section 5.1.2 location services
- **Google Play Maroc** : conformite Google Permissions Policy background location

---

## Metriques de Validation

| Metrique | Cible | Mesure |
|----------|-------|--------|
| Permissions GPS background declares | iOS + Android | inspection app.json |
| 8 templates assure whitelist | 8 | verification Sprint 9 STATUS_ONLY_TEMPLATES.assure |
| Coverage Sprint 18 | >= 85% | vitest + Detox |
| 0 emoji | 0 | grep CI |
| EAS Build success | iOS + Android | EAS dashboard |
| Cas A/B/C testes | 3 cas | seeds + tests |
| Conventional commits | 100% | git log |

---

## Apport au Programme

Sprint 18 v3.0 finalise l'**ecosystem 6 acteurs** (decision-012) cote mobile :
- Customer (Sprint 17 web) + Assure (Sprint 18 mobile) = 2 acteurs B2C
- Foundation cas B2B entreprises (Cas B linking via invitation)
- QR Code = differentiator concurrentiel Maroc (premier app assurance avec attestation digitale)
- Emergency workflow = vital pour fidelisation customer (cas critique)

**Sprint 18 GO** = lancement app stores possible (App Store + Google Play soumission post-pilote).

**Sprint suivant** : Sprint 19 Vertical Repair Foundation (workflow garage).

---

**Fin meta-prompt B-18 v3.0 -- Sprint 18 (4.5) REFONTE Assure Portal Mobile (Acteur 5 distinct).**

**Total taches** : 12 (8 v2.2 adaptees + 4 v3.0 nouvelles) | **Effort** : ~65h | **Apport** : Acteur 5 distinct + mobile-first + QR offline + emergency
