/**
 * @insurtech/comm/seeds/templates.seed
 *
 * Sprint 9 Tache 3.2.5 -- 20 templates fonctionnels x 4 locales (fr / ar-MA / ar / en) = 80 variants.
 * Categories : auth (5) + booking (3) + insure (5) + repair (4) + tenant (3) = 20.
 *
 * Body sans emoji (decision-006).
 * Variables ordered correspond a Meta {{1}}..{{N}}.
 * Sujet pour email seulement (NULL pour WhatsApp).
 */

import type { TemplateSeed } from '../services/template-manager.service.js';

const stringVar = (name: string, required = true): { name: string; type: 'string'; required: boolean } => ({
  name,
  type: 'string',
  required,
});

export const SPRINT9_TEMPLATE_SEEDS: ReadonlyArray<TemplateSeed> = [
  // ============================================================
  // AUTH (5 templates)
  // ============================================================
  {
    name: 'auth_verify_email',
    channel: 'email',
    category: 'transactional',
    variables: [stringVar('user_name'), stringVar('verify_url')],
    localizations: {
      fr: { subject: 'Verifiez votre compte Assurflow', body: 'Bonjour {{user_name}}, cliquez ici pour verifier votre compte : {{verify_url}} (lien valable 24 heures).' },
      'ar-MA': { subject: 'Akkid hssabek f Assurflow', body: 'Salam {{user_name}}, clicki had link bach takkid hssabek : {{verify_url}} (link sale7 24 sa3a).' },
      ar: { subject: 'تأكيد حسابك في Assurflow', body: 'مرحبا {{user_name}}، الرجاء النقر على الرابط التالي لتأكيد حسابك : {{verify_url}} (صالح لمدة 24 ساعة).' },
      en: { subject: 'Verify your Assurflow account', body: 'Hello {{user_name}}, click here to verify your account: {{verify_url}} (link valid for 24 hours).' },
    },
  },
  {
    name: 'auth_password_reset',
    channel: 'email',
    category: 'transactional',
    variables: [stringVar('user_name'), stringVar('reset_url')],
    localizations: {
      fr: { subject: 'Reinitialisation de votre mot de passe', body: 'Bonjour {{user_name}}, suivez ce lien pour reinitialiser votre mot de passe : {{reset_url}}. Si vous n etes pas a l origine de cette demande, ignorez ce message.' },
      'ar-MA': { subject: 'Bedel password dyalek', body: 'Salam {{user_name}}, hadi link bach tbeddel password dyalek : {{reset_url}}.' },
      ar: { subject: 'إعادة تعيين كلمة المرور', body: 'مرحبا {{user_name}}، اتبع هذا الرابط لإعادة تعيين كلمة المرور الخاصة بك : {{reset_url}}.' },
      en: { subject: 'Reset your password', body: 'Hello {{user_name}}, follow this link to reset your password: {{reset_url}}.' },
    },
  },
  {
    name: 'auth_password_changed',
    channel: 'email',
    category: 'transactional',
    variables: [stringVar('user_name'), stringVar('changed_at')],
    localizations: {
      fr: { subject: 'Mot de passe modifie', body: 'Bonjour {{user_name}}, votre mot de passe Assurflow a ete modifie le {{changed_at}}.' },
      'ar-MA': { subject: 'Password tbeddel', body: 'Salam {{user_name}}, password dyalek tbeddel f {{changed_at}}.' },
      ar: { subject: 'تم تغيير كلمة المرور', body: 'مرحبا {{user_name}}، تم تغيير كلمة المرور الخاصة بك بتاريخ {{changed_at}}.' },
      en: { subject: 'Password changed', body: 'Hello {{user_name}}, your Assurflow password was changed at {{changed_at}}.' },
    },
  },
  {
    name: 'auth_mfa_enabled',
    channel: 'email',
    category: 'transactional',
    variables: [stringVar('user_name')],
    localizations: {
      fr: { subject: 'Authentification a deux facteurs activee', body: 'Bonjour {{user_name}}, la double authentification est maintenant activee sur votre compte.' },
      'ar-MA': { subject: '2FA mfa3al', body: 'Salam {{user_name}}, l-authentification b 2 facteurs khedama daba.' },
      ar: { subject: 'تم تفعيل المصادقة الثنائية', body: 'مرحبا {{user_name}}، تم تفعيل المصادقة الثنائية على حسابك.' },
      en: { subject: 'Two-factor authentication enabled', body: 'Hello {{user_name}}, two-factor authentication is now active on your account.' },
    },
  },
  {
    name: 'auth_login_alert',
    channel: 'email',
    category: 'transactional',
    variables: [stringVar('user_name'), stringVar('ip'), stringVar('city'), stringVar('device')],
    localizations: {
      fr: { subject: 'Nouvelle connexion detectee', body: 'Bonjour {{user_name}}, une nouvelle connexion a eu lieu depuis {{ip}} ({{city}}) avec l appareil {{device}}.' },
      'ar-MA': { subject: 'Connexion jdida', body: 'Salam {{user_name}}, kayn connexion jdida mn {{ip}} ({{city}}) device {{device}}.' },
      ar: { subject: 'تسجيل دخول جديد', body: 'مرحبا {{user_name}}، تم تسجيل دخول جديد من {{ip}} ({{city}}) باستخدام {{device}}.' },
      en: { subject: 'New sign-in detected', body: 'Hello {{user_name}}, a new sign-in occurred from {{ip}} ({{city}}) on {{device}}.' },
    },
  },
  // ============================================================
  // BOOKING (3 templates)
  // ============================================================
  {
    name: 'booking_appointment_scheduled',
    channel: 'whatsapp',
    category: 'transactional',
    metaTemplateName: 'booking_appointment_scheduled_v1',
    metaTemplateStatus: 'approved',
    variables: [stringVar('contact_name'), stringVar('appointment_date'), stringVar('agency_name')],
    localizations: {
      fr: { body: 'Bonjour {{1}}, votre rendez-vous est confirme le {{2}} a l agence {{3}}.' },
      'ar-MA': { body: 'Salam {{1}}, RDV dyalek mwafak l {{2}} f agence {{3}}.' },
      ar: { body: 'مرحبا {{1}}، تم تأكيد موعدك في {{2}} في وكالة {{3}}.' },
      en: { body: 'Hello {{1}}, your appointment is confirmed on {{2}} at {{3}} agency.' },
    },
  },
  {
    name: 'booking_appointment_reminder_24h',
    channel: 'whatsapp',
    category: 'reminder',
    metaTemplateName: 'booking_appointment_reminder_24h_v1',
    metaTemplateStatus: 'approved',
    variables: [stringVar('contact_name'), stringVar('appointment_date'), stringVar('agency_name')],
    localizations: {
      fr: { body: 'Bonjour {{1}}, rappel : votre RDV est demain {{2}} a {{3}}.' },
      'ar-MA': { body: 'Salam {{1}}, fkir : RDV dyalek ghedda {{2}} f {{3}}.' },
      ar: { body: 'مرحبا {{1}}، تذكير : موعدك غدا {{2}} في {{3}}.' },
      en: { body: 'Hello {{1}}, reminder: your appointment is tomorrow {{2}} at {{3}}.' },
    },
  },
  {
    name: 'booking_appointment_cancelled',
    channel: 'whatsapp',
    category: 'transactional',
    metaTemplateName: 'booking_appointment_cancelled_v1',
    metaTemplateStatus: 'approved',
    variables: [stringVar('contact_name'), stringVar('appointment_date'), stringVar('reason')],
    localizations: {
      fr: { body: 'Bonjour {{1}}, votre RDV du {{2}} a ete annule. Motif : {{3}}.' },
      'ar-MA': { body: 'Salam {{1}}, RDV dyalek f {{2}} tlgha. Sabab : {{3}}.' },
      ar: { body: 'مرحبا {{1}}، تم إلغاء موعدك بتاريخ {{2}}. السبب : {{3}}.' },
      en: { body: 'Hello {{1}}, your appointment on {{2}} was cancelled. Reason: {{3}}.' },
    },
  },
  // ============================================================
  // INSURE (5 templates)
  // ============================================================
  {
    name: 'insure_quote_generated',
    channel: 'email',
    category: 'transactional',
    variables: [stringVar('contact_name'), stringVar('quote_number'), stringVar('quote_url')],
    localizations: {
      fr: { subject: 'Votre devis est pret', body: 'Bonjour {{contact_name}}, votre devis numero {{quote_number}} est disponible : {{quote_url}}.' },
      'ar-MA': { subject: 'Devis dyalek mwjoud', body: 'Salam {{contact_name}}, devis dyalek {{quote_number}} hadi : {{quote_url}}.' },
      ar: { subject: 'عرض الأسعار جاهز', body: 'مرحبا {{contact_name}}، عرض الأسعار رقم {{quote_number}} متاح : {{quote_url}}.' },
      en: { subject: 'Your quote is ready', body: 'Hello {{contact_name}}, your quote number {{quote_number}} is ready: {{quote_url}}.' },
    },
  },
  {
    name: 'insure_police_signed_confirmation',
    channel: 'whatsapp',
    category: 'transactional',
    metaTemplateName: 'insure_police_signed_confirmation_v1',
    metaTemplateStatus: 'approved',
    variables: [stringVar('contact_name'), stringVar('policy_number'), stringVar('signed_date')],
    localizations: {
      fr: { body: 'Bonjour {{1}}, votre police {{2}} est signee depuis le {{3}}.' },
      'ar-MA': { body: 'Salam {{1}}, l-police {{2}} mwakka mn {{3}}.' },
      ar: { body: 'مرحبا {{1}}، تم توقيع وثيقة التأمين {{2}} في {{3}}.' },
      en: { body: 'Hello {{1}}, your policy {{2}} has been signed on {{3}}.' },
    },
  },
  {
    name: 'insure_payment_due_reminder',
    channel: 'whatsapp',
    category: 'reminder',
    metaTemplateName: 'insure_payment_due_reminder_v1',
    metaTemplateStatus: 'approved',
    variables: [stringVar('contact_name'), stringVar('amount'), stringVar('due_date')],
    localizations: {
      fr: { body: 'Bonjour {{1}}, votre echeance de {{2}} MAD est due le {{3}}.' },
      'ar-MA': { body: 'Salam {{1}}, l-payment {{2}} MAD ghadi ykhellss f {{3}}.' },
      ar: { body: 'مرحبا {{1}}، قسط بقيمة {{2}} درهم مستحق في {{3}}.' },
      en: { body: 'Hello {{1}}, your installment of {{2}} MAD is due on {{3}}.' },
    },
  },
  {
    name: 'insure_renewal_reminder_30d',
    channel: 'whatsapp',
    category: 'reminder',
    metaTemplateName: 'insure_renewal_reminder_30d_v1',
    metaTemplateStatus: 'approved',
    variables: [stringVar('contact_name'), stringVar('policy_number'), stringVar('renewal_date')],
    localizations: {
      fr: { body: 'Bonjour {{1}}, votre police {{2}} expire le {{3}}. Pensez au renouvellement.' },
      'ar-MA': { body: 'Salam {{1}}, l-police {{2}} tsali f {{3}}. Khellss renewal.' },
      ar: { body: 'مرحبا {{1}}، تنتهي وثيقة التأمين {{2}} في {{3}}.' },
      en: { body: 'Hello {{1}}, your policy {{2}} expires on {{3}}. Please consider renewal.' },
    },
  },
  {
    name: 'insure_claim_received',
    channel: 'email',
    category: 'transactional',
    variables: [stringVar('contact_name'), stringVar('claim_number'), stringVar('policy_number')],
    localizations: {
      fr: { subject: 'Declaration de sinistre recue', body: 'Bonjour {{contact_name}}, votre declaration de sinistre {{claim_number}} sur la police {{policy_number}} a ete recue.' },
      'ar-MA': { subject: 'Sinistre wsl', body: 'Salam {{contact_name}}, declaration {{claim_number}} 3la police {{policy_number}} wslna.' },
      ar: { subject: 'تم استلام التصريح بالحادث', body: 'مرحبا {{contact_name}}، تم استلام التصريح {{claim_number}} على وثيقة {{policy_number}}.' },
      en: { subject: 'Claim received', body: 'Hello {{contact_name}}, your claim {{claim_number}} on policy {{policy_number}} has been received.' },
    },
  },
  // ============================================================
  // REPAIR (4 templates)
  // ============================================================
  {
    name: 'repair_sinistre_acknowledged',
    channel: 'whatsapp',
    category: 'transactional',
    metaTemplateName: 'repair_sinistre_acknowledged_v1',
    metaTemplateStatus: 'approved',
    variables: [stringVar('contact_name'), stringVar('garage_name'), stringVar('reference')],
    localizations: {
      fr: { body: 'Bonjour {{1}}, votre dossier a ete pris en charge par {{2}} (ref {{3}}).' },
      'ar-MA': { body: 'Salam {{1}}, dossier dyalek 3and {{2}} (ref {{3}}).' },
      ar: { body: 'مرحبا {{1}}، تم استلام ملفك من قبل {{2}} (مرجع {{3}}).' },
      en: { body: 'Hello {{1}}, your file is being handled by {{2}} (ref {{3}}).' },
    },
  },
  {
    name: 'repair_devis_ready',
    channel: 'email',
    category: 'transactional',
    variables: [stringVar('contact_name'), stringVar('devis_number'), stringVar('amount'), stringVar('devis_url')],
    localizations: {
      fr: { subject: 'Devis de reparation pret', body: 'Bonjour {{contact_name}}, votre devis {{devis_number}} d un montant de {{amount}} MAD est consultable : {{devis_url}}.' },
      'ar-MA': { subject: 'Devis dyal reparation wajed', body: 'Salam {{contact_name}}, devis {{devis_number}} {{amount}} MAD : {{devis_url}}.' },
      ar: { subject: 'عرض الإصلاح جاهز', body: 'مرحبا {{contact_name}}، عرض الإصلاح {{devis_number}} بقيمة {{amount}} درهم : {{devis_url}}.' },
      en: { subject: 'Repair quote ready', body: 'Hello {{contact_name}}, your repair quote {{devis_number}} of {{amount}} MAD is ready: {{devis_url}}.' },
    },
  },
  {
    name: 'repair_reparation_started',
    channel: 'whatsapp',
    category: 'transactional',
    metaTemplateName: 'repair_reparation_started_v1',
    metaTemplateStatus: 'approved',
    variables: [stringVar('contact_name'), stringVar('vehicle'), stringVar('expected_end_date')],
    localizations: {
      fr: { body: 'Bonjour {{1}}, la reparation de votre {{2}} a debute. Fin estimee : {{3}}.' },
      'ar-MA': { body: 'Salam {{1}}, reparation dyal {{2}} bdat. Salat l {{3}}.' },
      ar: { body: 'مرحبا {{1}}، بدأت أعمال الإصلاح على سيارتك {{2}}. التاريخ المتوقع للانتهاء : {{3}}.' },
      en: { body: 'Hello {{1}}, repairs on your {{2}} have started. Estimated completion: {{3}}.' },
    },
  },
  {
    name: 'repair_reparation_completed',
    channel: 'whatsapp',
    category: 'transactional',
    metaTemplateName: 'repair_reparation_completed_v1',
    metaTemplateStatus: 'approved',
    variables: [stringVar('contact_name'), stringVar('vehicle'), stringVar('garage_name')],
    localizations: {
      fr: { body: 'Bonjour {{1}}, votre {{2}} est prete chez {{3}}. Vous pouvez venir la recuperer.' },
      'ar-MA': { body: 'Salam {{1}}, l-{{2}} dyalek wajda 3and {{3}}. Tigi tdek dyalek.' },
      ar: { body: 'مرحبا {{1}}، سيارتك {{2}} جاهزة لدى {{3}}.' },
      en: { body: 'Hello {{1}}, your {{2}} is ready at {{3}}.' },
    },
  },
  // ============================================================
  // TENANT (3 templates)
  // ============================================================
  {
    name: 'tenant_invitation',
    channel: 'email',
    category: 'transactional',
    variables: [stringVar('invitee_name'), stringVar('tenant_name'), stringVar('invite_url')],
    localizations: {
      fr: { subject: 'Invitation a rejoindre Assurflow', body: 'Bonjour {{invitee_name}}, vous etes invite a rejoindre {{tenant_name}} sur Assurflow : {{invite_url}}.' },
      'ar-MA': { subject: 'Invitation Assurflow', body: 'Salam {{invitee_name}}, kat3awwed l {{tenant_name}} f Assurflow : {{invite_url}}.' },
      ar: { subject: 'دعوة للانضمام إلى Assurflow', body: 'مرحبا {{invitee_name}}، أنت مدعو للانضمام إلى {{tenant_name}} على Assurflow : {{invite_url}}.' },
      en: { subject: 'Invitation to join Assurflow', body: 'Hello {{invitee_name}}, you are invited to join {{tenant_name}} on Assurflow: {{invite_url}}.' },
    },
  },
  {
    name: 'tenant_quota_warning',
    channel: 'email',
    category: 'transactional',
    variables: [stringVar('admin_name'), stringVar('quota_name'), stringVar('usage_percent')],
    localizations: {
      fr: { subject: 'Alerte de quota', body: 'Bonjour {{admin_name}}, le quota {{quota_name}} est utilise a {{usage_percent}} %.' },
      'ar-MA': { subject: 'Quota qrib ysali', body: 'Salam {{admin_name}}, quota {{quota_name}} mosta3mel {{usage_percent}} %.' },
      ar: { subject: 'تنبيه نسبة الاستخدام', body: 'مرحبا {{admin_name}}، تم استخدام {{usage_percent}} % من {{quota_name}}.' },
      en: { subject: 'Quota warning', body: 'Hello {{admin_name}}, the quota {{quota_name}} is at {{usage_percent}}% usage.' },
    },
  },
  {
    name: 'tenant_suspended_notice',
    channel: 'email',
    category: 'transactional',
    variables: [stringVar('admin_name'), stringVar('tenant_name'), stringVar('reason')],
    localizations: {
      fr: { subject: 'Compte tenant suspendu', body: 'Bonjour {{admin_name}}, le tenant {{tenant_name}} est suspendu. Motif : {{reason}}.' },
      'ar-MA': { subject: 'Tenant tsuspenda', body: 'Salam {{admin_name}}, tenant {{tenant_name}} tsuspenda. Sabab : {{reason}}.' },
      ar: { subject: 'تم تعليق الحساب', body: 'مرحبا {{admin_name}}، تم تعليق المستأجر {{tenant_name}}. السبب : {{reason}}.' },
      en: { subject: 'Tenant suspended', body: 'Hello {{admin_name}}, tenant {{tenant_name}} is suspended. Reason: {{reason}}.' },
    },
  },
];

/**
 * Compte le nombre total de variants (templates x locales) -- doit etre 80 pour Sprint 9.
 */
export function countSeedVariants(): number {
  return SPRINT9_TEMPLATE_SEEDS.reduce((acc, s) => acc + Object.keys(s.localizations).length, 0);
}
