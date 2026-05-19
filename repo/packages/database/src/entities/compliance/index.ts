export { ComplianceAcapsReportEntity, type AcapsReportType, type AcapsReportStatus } from './compliance-acaps-report.entity.js';
export { ComplianceDataRetentionPolicyEntity } from './compliance-data-retention-policy.entity.js';
export { ComplianceConsentLogEntity, type ConsentType, type ConsentMethod } from './compliance-consent-log.entity.js';

import { ComplianceAcapsReportEntity } from './compliance-acaps-report.entity.js';
import { ComplianceDataRetentionPolicyEntity } from './compliance-data-retention-policy.entity.js';
import { ComplianceConsentLogEntity } from './compliance-consent-log.entity.js';

export const complianceEntities = [
  ComplianceAcapsReportEntity,
  ComplianceDataRetentionPolicyEntity,
  ComplianceConsentLogEntity,
] as const;
