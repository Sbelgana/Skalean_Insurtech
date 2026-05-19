export { DocDocumentEntity, type DocType, type DocStatus } from './doc-document.entity.js';
export { DocVersionEntity } from './doc-version.entity.js';
export { DocAccessLogEntity, type DocAccessAction } from './doc-access-log.entity.js';

import { DocDocumentEntity } from './doc-document.entity.js';
import { DocVersionEntity } from './doc-version.entity.js';
import { DocAccessLogEntity } from './doc-access-log.entity.js';

export const docsEntities = [
  DocDocumentEntity,
  DocVersionEntity,
  DocAccessLogEntity,
] as const;
