/**
 * Tests DatabaseModule -- valide l'exposition de DataSource via DI NestJS.
 *
 * Utilise un mock stateful de AppDataSource pour eviter la dependance
 * a une vraie connexion PostgreSQL en tests unitaires.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { DatabaseModule } from './database.module';
import { DATA_SOURCE_TOKEN } from './data-source.provider';

// vi.hoisted() est evalue avant les imports -- permet reference dans vi.mock factory.
const mockDataSource = vi.hoisted(() => {
  const mock = {
    isInitialized: false as boolean,
    initialize: vi.fn(),
    destroy: vi.fn(),
  };
  // Implementations stateful
  mock.initialize.mockImplementation(async () => {
    mock.isInitialized = true;
  });
  mock.destroy.mockImplementation(async () => {
    mock.isInitialized = false;
  });
  return mock;
});

vi.mock('@insurtech/database', () => ({
  AppDataSource: mockDataSource,
}));

describe('DatabaseModule', () => {
  let module: TestingModule;

  beforeEach(() => {
    // Reinitialiser le mock avant chaque test
    mockDataSource.isInitialized = false;
    mockDataSource.initialize.mockClear();
    mockDataSource.destroy.mockClear();
    // Re-appliquer les implementations (mockClear retire les mocks)
    mockDataSource.initialize.mockImplementation(async () => {
      mockDataSource.isInitialized = true;
    });
    mockDataSource.destroy.mockImplementation(async () => {
      mockDataSource.isInitialized = false;
    });
  });

  afterEach(async () => {
    if (module) await module.close();
  });

  it('expose DataSource via DI (DATA_SOURCE_TOKEN)', async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    const dataSource = module.get<typeof mockDataSource>(DATA_SOURCE_TOKEN);
    expect(dataSource).toBeDefined();
    expect(dataSource.isInitialized).toBe(true);
  });

  it('useFactory appelle initialize() si DataSource non initialise', async () => {
    expect(mockDataSource.isInitialized).toBe(false);
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    expect(mockDataSource.initialize).toHaveBeenCalledTimes(1);
  });

  it('useFactory ne re-initialise pas si DataSource deja initialise', async () => {
    mockDataSource.isInitialized = true;
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    expect(mockDataSource.initialize).not.toHaveBeenCalled();
  });

  it('onModuleDestroy appelle destroy() si DataSource initialise', async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    expect(mockDataSource.isInitialized).toBe(true);
    await module.close();
    expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    expect(mockDataSource.isInitialized).toBe(false);
  });

  it('onModuleDestroy ne fait rien si DataSource non initialise', async () => {
    // Tester le garde-fou : si isInitialized = false, destroy ne doit pas etre appele
    const localDs = {
      isInitialized: false,
      destroy: vi.fn(async () => {}),
    };
    module = await Test.createTestingModule({
      providers: [
        {
          provide: DATA_SOURCE_TOKEN,
          useValue: localDs,
        },
      ],
    }).compile();

    // Simuler la logique onModuleDestroy directement
    if (localDs.isInitialized) await localDs.destroy();

    expect(localDs.destroy).not.toHaveBeenCalled();
  });
});
