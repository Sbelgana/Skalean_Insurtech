/**
 * @insurtech/comm/providers/whatsapp/errors
 *
 * Hierarchy d'erreurs typees Meta Cloud API v21.0 (Sprint 9 Tache 3.2.2).
 * Permet aux consommateurs (workers BullMQ Tache 3.2.8, orchestrator Tache 3.2.9)
 * de discriminer retryable vs fatal via instanceof + champ `retryable`.
 */

export interface MetaErrorDetails {
  code?: number;
  subCode?: number | undefined;
  metaTraceId?: string | undefined;
  httpStatus?: number | undefined;
  retryable?: boolean | undefined;
  originalResponse?: unknown;
}

export class MetaApiError extends Error {
  public readonly code: number;
  public readonly subCode?: number | undefined;
  public readonly metaTraceId?: string | undefined;
  public readonly httpStatus?: number | undefined;
  public readonly retryable: boolean;
  public readonly originalResponse?: unknown;

  constructor(message: string, details: MetaErrorDetails = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = details.code ?? 0;
    this.subCode = details.subCode;
    this.metaTraceId = details.metaTraceId;
    this.httpStatus = details.httpStatus;
    this.retryable = details.retryable ?? false;
    this.originalResponse = details.originalResponse;
  }
}

export class MetaRateLimitError extends MetaApiError {
  public readonly retryAfterMs: number;
  constructor(message: string, retryAfterMs: number, details: MetaErrorDetails = {}) {
    super(message, { ...details, retryable: true });
    this.retryAfterMs = retryAfterMs;
  }
}

export class MetaInvalidTemplateError extends MetaApiError {
  constructor(message: string, details: MetaErrorDetails = {}) {
    super(message, { ...details, retryable: false });
  }
}

export class MetaPhoneNotOptedInError extends MetaApiError {
  constructor(message: string, details: MetaErrorDetails = {}) {
    super(message, { ...details, retryable: false });
  }
}

export class MetaTemplateNotApprovedError extends MetaApiError {
  constructor(message: string, details: MetaErrorDetails = {}) {
    super(message, { ...details, retryable: false });
  }
}

export class MetaInvalidWaBaError extends MetaApiError {
  constructor(message: string, details: MetaErrorDetails = {}) {
    super(message, { ...details, retryable: false });
  }
}

export class MetaAccessTokenExpiredError extends MetaApiError {
  constructor(message: string, details: MetaErrorDetails = {}) {
    super(message, { ...details, retryable: false });
  }
}

export class MetaParameterCountMismatchError extends MetaApiError {
  constructor(message: string, details: MetaErrorDetails = {}) {
    super(message, { ...details, retryable: false });
  }
}

export class MetaWaBaSuspendedError extends MetaApiError {
  constructor(message: string, details: MetaErrorDetails = {}) {
    super(message, { ...details, retryable: false });
  }
}

export class MetaDisabledError extends Error {
  public readonly code = 'WHATSAPP_DISABLED';
  constructor(reason: string) {
    super(`WhatsApp client disabled: ${reason}`);
    this.name = 'MetaDisabledError';
  }
}

/**
 * Mappe une erreur Meta API HTTP/JSON vers la sous-classe correspondante.
 * Reference codes Meta documentation officielle Business Platform 2024.
 */
export function mapMetaError(httpStatus: number, body: unknown): MetaApiError {
  const error =
    typeof body === 'object' && body !== null && 'error' in body
      ? ((body as { error: unknown }).error as Record<string, unknown>)
      : null;

  const code = typeof error?.code === 'number' ? (error.code as number) : 0;
  const subCode =
    typeof error?.error_subcode === 'number' ? (error.error_subcode as number) : undefined;
  const message =
    typeof error?.message === 'string' ? (error.message as string) : `Meta API error ${httpStatus}`;
  const metaTraceId =
    typeof error?.fbtrace_id === 'string' ? (error.fbtrace_id as string) : undefined;

  const details: MetaErrorDetails = {
    code,
    subCode,
    metaTraceId,
    httpStatus,
    originalResponse: body,
  };

  // Rate limit: codes 80007 (app rate), 130429 (message rate), 131056 (pair rate)
  if (code === 80007 || code === 130429 || code === 131056 || httpStatus === 429) {
    const retryAfterMs = extractRetryAfter(body) ?? 60000;
    return new MetaRateLimitError(message, retryAfterMs, details);
  }

  if (code === 130 || code === 131008) {
    return new MetaInvalidTemplateError(message, details);
  }
  if (code === 131) {
    return new MetaPhoneNotOptedInError(message, details);
  }
  if (code === 132 || code === 133 || code === 132015) {
    return new MetaTemplateNotApprovedError(message, details);
  }
  if (code === 190) {
    return new MetaAccessTokenExpiredError(message, details);
  }
  if (code === 132012) {
    return new MetaParameterCountMismatchError(message, details);
  }
  if (httpStatus === 403) {
    return new MetaWaBaSuspendedError(message, details);
  }
  if (httpStatus >= 500 && httpStatus < 600) {
    return new MetaApiError(message, { ...details, retryable: true });
  }
  return new MetaApiError(message, { ...details, retryable: false });
}

function extractRetryAfter(body: unknown): number | null {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const err = (body as { error: Record<string, unknown> }).error;
    if (
      typeof err?.error_data === 'object' &&
      err.error_data !== null &&
      'details' in err.error_data &&
      typeof (err.error_data as Record<string, unknown>).details === 'string'
    ) {
      const detailsStr = (err.error_data as { details: string }).details;
      const match = detailsStr.match(/wait\s+(\d+)\s*s/i);
      if (match !== null && match[1] !== undefined) {
        return Number.parseInt(match[1], 10) * 1000;
      }
    }
  }
  return null;
}
