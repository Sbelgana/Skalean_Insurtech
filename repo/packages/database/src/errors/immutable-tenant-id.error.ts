export class ImmutableTenantIdError extends Error {
  public readonly code = 'IMMUTABLE_TENANT_ID';
  public readonly httpStatus = 422;

  constructor(
    public readonly tableName: string,
    public readonly entityId: string,
    public readonly oldValue: string,
    public readonly newValue: string,
  ) {
    super(
      `Tentative modification tenant_id sur ${tableName}#${entityId} : ` +
        `${oldValue} -> ${newValue}. La colonne tenant_id est immuable apres creation. ` +
        `Pour migrer cross-tenant, utiliser le service TenantMigrationService (Sprint 28).`,
    );
    this.name = 'ImmutableTenantIdError';
    Object.setPrototypeOf(this, ImmutableTenantIdError.prototype);
  }
}
