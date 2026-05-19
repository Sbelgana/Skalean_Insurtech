export class InvalidTenantContextError extends Error {
  public readonly code = 'INVALID_TENANT_CONTEXT';
  public readonly httpStatus = 500;

  constructor(public readonly receivedValue: string) {
    super(
      `app_current_tenant() a retourne une valeur invalide : "${receivedValue}". ` +
        `Format attendu : UUID v4. Verifier la session PostgreSQL et ` +
        `le pool de connexions.`,
    );
    this.name = 'InvalidTenantContextError';
    Object.setPrototypeOf(this, InvalidTenantContextError.prototype);
  }
}
