export class MissingTenantContextError extends Error {
  public readonly code = 'MISSING_TENANT_CONTEXT';
  public readonly httpStatus = 500;

  constructor(
    public readonly tableName: string,
    public readonly userId: string | null,
    public readonly operation: 'INSERT' | 'UPDATE',
  ) {
    super(
      `Tentative ${operation} sur table tenant-scoped "${tableName}" sans contexte tenant defini ` +
        `(user_id=${userId ?? 'null'}). Verifier appel setTenantContext en amont ` +
        `via middleware HTTP, listener Kafka ou helper runInTenantContext.`,
    );
    this.name = 'MissingTenantContextError';
    Object.setPrototypeOf(this, MissingTenantContextError.prototype);
  }
}
