# Storage Provider -- Skalean InsurTech v2.2

**Reference** : Tache 1.1.7 + decision-008 + decision-009
**Sprint** : 1 (init), 35 (migration prod)

---

## Stack

| Env | Provider | Region | Endpoint | Force Path Style |
|-----|----------|--------|----------|-------------------|
| dev | MinIO RELEASE.2024-11-07 | ma-bgr-1 (simulated) | http://localhost:9000 | true |
| prod | Atlas Cloud Services Benguerir | ma-bgr-1 (DC1) + ma-bgr-2 (DC2) | https://s3.atlas-bgr.ma | false |

---

## Decision-008 conformite legale

Loi 09-08 CNDP article 17 : donnees personnelles assures stockees STRICTEMENT au Maroc.

- AWS region me-south-1 (Bahrain) NON acceptee (hors MA)
- Atlas Cloud Services Benguerir = souverainete totale Maroc
- DC1 Tier III + DC2 Tier IV (geo-redondance MA)
- ACAPS et Barid Maroc deja clients (validation regulatory)
- Encryption at rest AES-256-GCM via Atlas KMS
- TLS 1.3 in-transit obligatoire

---

## 3 buckets strategy

| Bucket | Usage | Lifecycle | Access | Retention |
|--------|-------|-----------|--------|-----------|
| `*-docs` | Polices PDF, devis, factures, KYC | Glacier 1 an, delete 10 ans 1 jour | Auth required | 10 ans (ACAPS+DGI) |
| `*-photos` | Sinistres + selfies KYC + vehicules | Glacier 6 mois | Anonymous download presigned | 6 ans |
| `*-archive` | Documents signes loi 43-20 | IMMUTABLE 10 ans | Auth + audit log | 10 ans (loi 43-20) |

---

## Naming convention objects

Pattern : `{tenant_id}/{module}/{entity}/{object_uuid}.{ext}`

Examples :

```
tenant-abc/polices/police-def.pdf
tenant-abc/sinistres/sinistre-ghi/photo-jkl.jpg
tenant-abc/kyc/cin-mno.pdf
```

---

## SDK usage

```typescript
import { getS3Client, getBucketName, getTenantObjectKey } from '@insurtech/shared-utils';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const client = getS3Client();
const bucket = getBucketName('docs', 'dev');
const key = getTenantObjectKey('tenant-uuid', 'polices', 'police-uuid.pdf');

await client.send(new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  Body: pdfBuffer,
  ContentType: 'application/pdf',
}));
```

---

## Migration dev -> prod (Sprint 35)

Aucun changement code. Update env vars uniquement :

```
S3_ENDPOINT=https://s3.atlas-bgr.ma
S3_FORCE_PATH_STYLE=false
S3_REGION=ma-bgr-1
S3_ACCESS_KEY_ID=<from Atlas Vault>
S3_SECRET_ACCESS_KEY=<from Atlas Vault>
S3_KMS_KEY_BASE=arn:atlas:kms:ma-bgr-1:account:key/skalean-insurtech-prod
```

---

## References

- decision-008 (data residency Maroc)
- decision-009 (3 buckets strategy docs/photos/archive)
- decision-006 (no-emoji)
- CNDP Loi 09-08 article 17
- ACAPS decisions 2023
- Loi 43-20 signature electronique
