# TACHE 3.6.5 -- Stock Items + Categories + Valorisation FIFO

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.5)
**Phase** : 3 -- Modules Horizontaux (Analytics + Stock + HR)
**Priorite** : P0 (bloquant Tache 3.6.6 mouvements + Sprint 22 Repair consume pieces)
**Effort** : 5h
**Dependances** : Tache 3.6.4 (Dashboards), Sprint 6 multi-tenant + RLS, Sprint 7 RBAC, Sprint 10 Docs (photos S3), Sprint 12 Books (futures ecritures stock)
**Densite cible** : 100-130 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache pose le coeur du module Stock pour garages atelier reparation Maroc : 3 entites Postgres (`stock_categories`, `stock_items`, `stock_lots`) avec multi-tenant strict via Row Level Security, plus le service de valorisation FIFO (First-In-First-Out) qui est la **methode comptable obligatoire au Maroc** selon la loi 9-88 modifiee par la loi 38-14 et le CGNC. Le service `stock-valorisation.service.ts` calcule pour chaque item : (a) la quantite courante (somme des `quantity_remaining` sur tous les lots actifs), (b) la valorisation FIFO (somme des `quantity_remaining * unit_cost` lot par lot), et (c) une vue snapshot complete par tenant pour le bilan annuel (passif courant -> stocks). Sans cette tache, les garages ne peuvent pas tenir leur comptabilite analytique conforme DGI ni produire le bilan classe 3 (stocks et en-cours) du CGNC.

L'apport est triple. **Premierement**, on cree 3 migrations TypeORM strictement isolees multi-tenant : `stock_categories` (hierarchie parent_id, code unique per tenant), `stock_items` (SKU unique per tenant, reorder_threshold, ideal_stock, photo_url S3, barcode, supplier_id futur), `stock_lots` (quantity_in, quantity_remaining numeric 18,4 pour precision, unit_cost numeric 15,4, entry_date, supplier_invoice_ref). **Deuxiemement**, on cree 2 services principaux : `stock-items.service.ts` (CRUD + search + filtres categorie/low_stock), `stock-valorisation.service.ts` (`getCurrentStock`, `getValorisation`, `getValorisationSnapshot`). **Troisiemement**, on cree le controller REST `/api/v1/stock/items` + `/api/v1/stock/categories` + `/api/v1/stock/valorisation` avec RBAC `stock.items.create/read/update/delete` (Sprint 7 seed) + photos upload S3 (Sprint 10 `@insurtech/docs` reutilise). Tests : 22 unitaires + 8 E2E + fixtures (50 categories + 200 items + 500 lots).

A l'issue de cette tache, un garage peut creer ses categories (`Pneus > Pneus 4x4 > Pneus 4x4 hiver`), enregistrer ses items (`SKU GAR-PNEU-001 Pneu Michelin 205/55R16`), recevoir un premier lot (livraison 10 pneus a 800 MAD piece), et la valorisation FIFO affiche correctement `current_stock: 10`, `valorisation: 8000.00 MAD`. La Tache 3.6.6 ajoute les mouvements (entrees/sorties) qui consomment ces lots FIFO. La Tache 3.6.8 expose les endpoints rest finaux. Sprint 22 Repair consume des pieces via Kafka event `repair.parts_consumed`.

---

## 2. Contexte etendu

### 2.1 Pourquoi FIFO obligatoire au Maroc

Le **CGNC Article 32** (decret 2-89-61 du 22 novembre 1989, modifie 2017) impose pour la valorisation des stocks au bilan l'une des deux methodes : **FIFO (Premier Entre Premier Sorti)** ou **CMP (Cout Moyen Pondere)**. LIFO (Last-In-First-Out) est **interdit** au Maroc (contrairement aux USA pre-2010) car il sous-evalue les stocks en periode inflationniste et reduit artificiellement l'impot. Le choix entre FIFO et CMP doit etre coherent : on ne peut pas changer de methode en cours d'exercice sans declaration formelle DGI + commissaire aux comptes. Pour Skalean InsurTech v2.2, **FIFO est retenu** car : (a) plus simple a auditer (lots tracables), (b) reflete la realite physique (le garage utilise generalement les vieux pneus avant les neufs pour eviter peremption), (c) compatible Sprint 22 Repair (tracage parts consumed par sinistre).

### 2.2 Comparaison FIFO vs CMP vs LIFO

| Methode | Avantages | Inconvenients | Status MA |
|---------|-----------|---------------|-----------|
| **FIFO** (retenu) | Tracabilite lots, audit facile, simple en cas d'inflation modesse | Plus de calculs, volatilite valorisation | LEGAL |
| CMP | Lissage, simple si pas de tracking lot necessaire | Pas de lien lot-mouvement, audit plus difficile | LEGAL |
| LIFO | Optimise impot en inflation forte | Sous-evalue stocks bilan | ILLEGAL MA |

### 2.3 Alternatives schema entites

Plusieurs options ont ete considerees pour le modele relationnel.

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **A. 3 tables : categories + items + lots** | Lots tracables, FIFO efficient | 3 tables a maintenir | RETENU |
| B. 2 tables : items + lots (categorie en jsonb) | Moins de tables | Pas de hierarchie SQL queryable, recherche limitee | Rejete |
| C. 1 table : tout en jsonb | Flexibilite max | Pas de RLS fin, pas FK, pas index | Rejete |
| D. Event-sourced (stock_events au lieu de lots) | Audit perfect | Complexite Sprint 13 excessive, recompute couteux | Defer Sprint 35+ |

### 2.4 Trade-offs

**Trade-off 1 : quantity NUMERIC(18,4) precision**. On stocke jusqu'a 4 decimales pour gerer les unites fractionnaires (huile 1.25 L, ou pneus 0.25 pour quart de pneu en defectueux). Trade : un peu plus de place disque, mais clarte metier.

**Trade-off 2 : Pas de multi-warehouse Sprint 13**. Tous lots dans un meme "depot" virtuel. Sprint 35+ Phase 7 ajoutera `warehouse_id` quand un garage gere plusieurs sites.

**Trade-off 3 : Photos S3 path stored, pas object metadata**. On stocke `photo_url` mais pas size/mime. Sprint 35+ enrichira.

**Trade-off 4 : Pas de peremption Sprint 13**. `expiration_date` non present sur lots. Sprint 35+ ajoutera pour items perissables (huile moteur 5 ans, pieces electroniques 10 ans).

### 2.5 Decisions strategiques

- decision-002 multi-tenant + RLS strict tenant_id sur stock_*.
- decision-003 TypeORM 0.3 entities.
- decision-006 no-emoji.
- decision-008 data Atlas Cloud MA only.

### 2.6 Pieges techniques

1. **Piege : SKU duplicates entre tenants**. Solution : UNIQUE composite `(tenant_id, sku)`, pas seulement `sku`.
2. **Piege : quantity_remaining negative**. Solution : CHECK constraint `quantity_remaining >= 0`.
3. **Piege : delete category avec items**. Solution : RESTRICT FK + soft delete via `active=false`.
4. **Piege : parent_id loop (A parent B parent A)**. Solution : trigger Postgres recursive check.
5. **Piege : photo_url S3 stale**. Solution : Sprint 10 docs gere TTL signed URLs, on stocke path canonique.
6. **Piege : FIFO valorisation avec items sans lots**. Solution : retourner `{ quantity: 0, valorisation: '0.00' }`.
7. **Piege : Decimal.js JSON serialization**. Solution : retourner string toujours, jamais number.
8. **Piege : barcode non-unique multi-tenant**. Solution : barcode = string libre, pas UNIQUE.
9. **Piege : RLS bloque lecture admin**. Solution : `app.role` check `SuperAdmin` -> bypass.

---

## 3. Architecture context

Tache 3.6.5 est la **cinquieme** des 14. Bloque 3.6.6 mouvements + 3.6.7 alertes + 3.6.8 endpoints.

```
stock_categories            stock_items                 stock_lots
+----------------+         +-----------+               +-----------+
| id            +<-fk----+ | category  +<-fk--------+--+ item_id   |
| tenant_id     |         | tenant_id|              |  | qty_in    |
| name          |         | sku       |UNIQ(tenant) |  | qty_rem   |
| parent_id     +-self    | name      |             |  | unit_cost |
| code          |         | unit      |             |  | entry_date|
+----------------+         | reorder   |             |  +-----------+
                          | ideal     |             |
                          | photo_url |             |
                          | active    |             |
                          +-----------+             |
                                                    v
                                         FIFO query
                                  ORDER BY entry_date ASC, id ASC
                                  WHERE quantity_remaining > 0
```

---

## 4. Livrables checkables

- [ ] Migration `repo/packages/database/src/migrations/1715100000000-StockCategories.ts`
- [ ] Migration `repo/packages/database/src/migrations/1715100100000-StockItems.ts`
- [ ] Migration `repo/packages/database/src/migrations/1715100200000-StockLots.ts`
- [ ] RLS policies via SQL trigger pour `stock_*`
- [ ] Entities TypeORM `repo/packages/stock/src/entities/stock-category.entity.ts`
- [ ] Entities `repo/packages/stock/src/entities/stock-item.entity.ts`
- [ ] Entities `repo/packages/stock/src/entities/stock-lot.entity.ts`
- [ ] Service `repo/packages/stock/src/services/stock-categories.service.ts` (~150 lignes)
- [ ] Service `repo/packages/stock/src/services/stock-items.service.ts` (~220 lignes)
- [ ] Service `repo/packages/stock/src/services/stock-valorisation.service.ts` (~180 lignes FIFO)
- [ ] Controller `repo/apps/api/src/modules/stock/controllers/stock-items.controller.ts`
- [ ] Controller `repo/apps/api/src/modules/stock/controllers/stock-categories.controller.ts`
- [ ] DTO Zod create/update items + categories
- [ ] Package `@insurtech/stock` (package.json, tsconfig, exports)
- [ ] Permissions seed `stock.items.create/read/update/delete`, `stock.categories.*`, `stock.valorisation.read`
- [ ] Tests unit 22 cas
- [ ] Tests E2E 8 cas
- [ ] Fixtures seed 50 categories + 200 items + 500 lots

---

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/1715100000000-StockCategories.ts          (nouveau, ~70 lignes)
repo/packages/database/src/migrations/1715100100000-StockItems.ts                (nouveau, ~90 lignes)
repo/packages/database/src/migrations/1715100200000-StockLots.ts                  (nouveau, ~70 lignes)
repo/packages/stock/package.json                                                   (nouveau, ~40 lignes)
repo/packages/stock/tsconfig.json                                                  (nouveau)
repo/packages/stock/src/index.ts                                                   (nouveau, exports)
repo/packages/stock/src/stock.module.ts                                            (nouveau, ~50 lignes)
repo/packages/stock/src/entities/stock-category.entity.ts                          (nouveau, ~60 lignes)
repo/packages/stock/src/entities/stock-item.entity.ts                              (nouveau, ~90 lignes)
repo/packages/stock/src/entities/stock-lot.entity.ts                               (nouveau, ~80 lignes)
repo/packages/stock/src/services/stock-categories.service.ts                       (nouveau, ~160 lignes)
repo/packages/stock/src/services/stock-categories.service.spec.ts                   (nouveau, ~180 lignes)
repo/packages/stock/src/services/stock-items.service.ts                             (nouveau, ~230 lignes)
repo/packages/stock/src/services/stock-items.service.spec.ts                         (nouveau, ~250 lignes)
repo/packages/stock/src/services/stock-valorisation.service.ts                       (nouveau, ~200 lignes)
repo/packages/stock/src/services/stock-valorisation.service.spec.ts                   (nouveau, ~230 lignes)
repo/packages/stock/src/dto/create-stock-item.dto.ts                                  (nouveau, ~50 lignes)
repo/packages/stock/src/dto/update-stock-item.dto.ts                                  (nouveau, ~30 lignes)
repo/packages/stock/src/dto/create-stock-category.dto.ts                              (nouveau, ~30 lignes)
repo/apps/api/src/modules/stock/stock.module.ts                                      (nouveau, ~40 lignes)
repo/apps/api/src/modules/stock/controllers/stock-items.controller.ts                (nouveau, ~180 lignes)
repo/apps/api/src/modules/stock/controllers/stock-categories.controller.ts           (nouveau, ~140 lignes)
repo/apps/api/test/stock/stock-items.e2e-spec.ts                                       (nouveau, ~280 lignes)
repo/packages/auth/src/seeds/permissions/stock.ts                                       (nouveau, permissions seed)
repo/infrastructure/scripts/seed-stock-fixtures.ts                                       (nouveau, ~200 lignes seed)
```

---

## 6. Code patterns COMPLETS

### 6.1 Migration `1715100000000-StockCategories.ts`

```typescript
// repo/packages/database/src/migrations/1715100000000-StockCategories.ts
// Skalean InsurTech v2.2 -- Migration stock_categories
// Reference : B-13 Sprint 13 Tache 3.6.5
import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockCategories1715100000000 implements MigrationInterface {
  name = 'StockCategories1715100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE stock_categories (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        name            VARCHAR(255) NOT NULL,
        code            VARCHAR(64) NOT NULL,
        parent_id       UUID,
        active          BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at      TIMESTAMPTZ,
        UNIQUE (tenant_id, code),
        FOREIGN KEY (tenant_id) REFERENCES auth_tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES stock_categories(id) ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_stock_categories_tenant ON stock_categories(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_stock_categories_parent ON stock_categories(parent_id);`);
    
    // RLS
    await queryRunner.query(`ALTER TABLE stock_categories ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_stock_categories ON stock_categories
      USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.role') = 'SuperAdmin');
    `);

    // Trigger anti-loop parent_id
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_stock_category_no_cycle()
      RETURNS TRIGGER AS $$
      DECLARE
        current_id UUID := NEW.parent_id;
        depth INT := 0;
      BEGIN
        WHILE current_id IS NOT NULL AND depth < 20 LOOP
          IF current_id = NEW.id THEN
            RAISE EXCEPTION 'Circular parent_id detected in stock_categories';
          END IF;
          SELECT parent_id INTO current_id FROM stock_categories WHERE id = current_id;
          depth := depth + 1;
        END LOOP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_stock_categories_no_cycle
        BEFORE INSERT OR UPDATE OF parent_id ON stock_categories
        FOR EACH ROW EXECUTE FUNCTION check_stock_category_no_cycle();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_stock_categories_no_cycle ON stock_categories;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS check_stock_category_no_cycle();`);
    await queryRunner.query(`DROP TABLE stock_categories;`);
  }
}
```

### 6.2 Migration `1715100100000-StockItems.ts`

```typescript
// repo/packages/database/src/migrations/1715100100000-StockItems.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockItems1715100100000 implements MigrationInterface {
  name = 'StockItems1715100100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE stock_items (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            UUID NOT NULL,
        category_id          UUID,
        sku                  VARCHAR(64) NOT NULL,
        name                 VARCHAR(255) NOT NULL,
        description          TEXT,
        unit                 VARCHAR(16) NOT NULL DEFAULT 'pcs',
        reorder_threshold    NUMERIC(18,4) NOT NULL DEFAULT 0,
        ideal_stock          NUMERIC(18,4) NOT NULL DEFAULT 0,
        supplier_id          UUID,
        barcode              VARCHAR(64),
        photo_url            TEXT,
        active               BOOLEAN NOT NULL DEFAULT TRUE,
        metadata             JSONB,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at           TIMESTAMPTZ,
        UNIQUE (tenant_id, sku),
        FOREIGN KEY (tenant_id) REFERENCES auth_tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES stock_categories(id) ON DELETE SET NULL,
        CONSTRAINT chk_reorder_positive CHECK (reorder_threshold >= 0),
        CONSTRAINT chk_ideal_positive CHECK (ideal_stock >= 0),
        CONSTRAINT chk_unit_valid CHECK (unit IN ('pcs', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'unit'))
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_stock_items_tenant ON stock_items(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_stock_items_category ON stock_items(category_id);`);
    await queryRunner.query(`CREATE INDEX idx_stock_items_sku ON stock_items(tenant_id, sku);`);
    await queryRunner.query(`CREATE INDEX idx_stock_items_active ON stock_items(active) WHERE active = TRUE;`);
    await queryRunner.query(`CREATE INDEX idx_stock_items_name_search ON stock_items USING GIN(to_tsvector('french', name));`);

    await queryRunner.query(`ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_stock_items ON stock_items
      USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.role') = 'SuperAdmin');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE stock_items;`);
  }
}
```

### 6.3 Migration `1715100200000-StockLots.ts`

```typescript
// repo/packages/database/src/migrations/1715100200000-StockLots.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockLots1715100200000 implements MigrationInterface {
  name = 'StockLots1715100200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE stock_lots (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL,
        item_id                  UUID NOT NULL,
        lot_number               VARCHAR(64),
        quantity_in              NUMERIC(18,4) NOT NULL,
        quantity_remaining       NUMERIC(18,4) NOT NULL,
        unit_cost                NUMERIC(15,4) NOT NULL,
        entry_date               TIMESTAMPTZ NOT NULL DEFAULT now(),
        supplier_invoice_ref     VARCHAR(128),
        created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at               TIMESTAMPTZ,
        FOREIGN KEY (tenant_id) REFERENCES auth_tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE RESTRICT,
        CONSTRAINT chk_qty_in_positive CHECK (quantity_in > 0),
        CONSTRAINT chk_qty_remaining_non_negative CHECK (quantity_remaining >= 0),
        CONSTRAINT chk_qty_remaining_lte_qty_in CHECK (quantity_remaining <= quantity_in),
        CONSTRAINT chk_unit_cost_non_negative CHECK (unit_cost >= 0)
      );
    `);
    // Index FIFO order : entry_date ASC, id ASC
    await queryRunner.query(`
      CREATE INDEX idx_stock_lots_fifo
        ON stock_lots(item_id, entry_date ASC, id ASC)
        WHERE quantity_remaining > 0 AND deleted_at IS NULL;
    `);
    await queryRunner.query(`CREATE INDEX idx_stock_lots_tenant ON stock_lots(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_stock_lots_item ON stock_lots(item_id);`);

    await queryRunner.query(`ALTER TABLE stock_lots ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_stock_lots ON stock_lots
      USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.role') = 'SuperAdmin');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE stock_lots;`);
  }
}
```

### 6.4 Entity `stock-item.entity.ts`

```typescript
// repo/packages/stock/src/entities/stock-item.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, JoinColumn, OneToMany, Index, Unique,
} from 'typeorm';
import { StockCategory } from './stock-category.entity';
import { StockLot } from './stock-lot.entity';

export type StockUnit = 'pcs' | 'kg' | 'g' | 'L' | 'mL' | 'm' | 'cm' | 'unit';

@Entity({ name: 'stock_items' })
@Unique('uq_stock_items_tenant_sku', ['tenant_id', 'sku'])
@Index('idx_stock_items_tenant', ['tenant_id'])
@Index('idx_stock_items_category', ['category_id'])
export class StockItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'uuid', nullable: true })
  category_id!: string | null;

  @ManyToOne(() => StockCategory, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: StockCategory;

  @Column({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pcs' })
  unit!: StockUnit;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0, transformer: decimalTransformer })
  reorder_threshold!: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0, transformer: decimalTransformer })
  ideal_stock!: string;

  @Column({ type: 'uuid', nullable: true })
  supplier_id!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  barcode!: string | null;

  @Column({ type: 'text', nullable: true })
  photo_url!: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @OneToMany(() => StockLot, (lot) => lot.item)
  lots?: StockLot[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}

const decimalTransformer = {
  to: (val: string | number) => val,
  from: (val: string | null) => (val === null ? null : val),
};
```

### 6.5 Entity `stock-lot.entity.ts`

```typescript
// repo/packages/stock/src/entities/stock-lot.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { StockItem } from './stock-item.entity';

@Entity({ name: 'stock_lots' })
@Index('idx_stock_lots_fifo', ['item_id', 'entry_date'])
export class StockLot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'uuid' })
  item_id!: string;

  @ManyToOne(() => StockItem, (item) => item.lots)
  @JoinColumn({ name: 'item_id' })
  item?: StockItem;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lot_number!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, transformer: { to: (v: string | number) => v, from: (v: string | null) => v } })
  quantity_in!: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, transformer: { to: (v: string | number) => v, from: (v: string | null) => v } })
  quantity_remaining!: string;

  @Column({ type: 'numeric', precision: 15, scale: 4, transformer: { to: (v: string | number) => v, from: (v: string | null) => v } })
  unit_cost!: string;

  @Column({ type: 'timestamptz' })
  entry_date!: Date;

  @Column({ type: 'varchar', length: 128, nullable: true })
  supplier_invoice_ref!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
```

### 6.6 Entity `stock-category.entity.ts`

```typescript
// repo/packages/stock/src/entities/stock-category.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, JoinColumn, OneToMany, Index, Unique,
} from 'typeorm';

@Entity({ name: 'stock_categories' })
@Unique('uq_stock_categories_tenant_code', ['tenant_id', 'code'])
export class StockCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'uuid', nullable: true })
  parent_id!: string | null;

  @ManyToOne(() => StockCategory, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: StockCategory;

  @OneToMany(() => StockCategory, (cat) => cat.parent)
  children?: StockCategory[];

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
```

### 6.7 Service `stock-valorisation.service.ts` (FIFO)

```typescript
// repo/packages/stock/src/services/stock-valorisation.service.ts
// Skalean InsurTech v2.2 -- Service valorisation FIFO
// Reference : B-13 Sprint 13 Tache 3.6.5
// Conformite : loi 9-88 modifiee 38-14 + CGNC art 32 (FIFO ou CMP -- FIFO retenu Skalean)
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import Decimal from 'decimal.js';
import { StockLot } from '../entities/stock-lot.entity';
import { StockItem } from '../entities/stock-item.entity';

export interface ItemStockSnapshot {
  item_id: string;
  sku: string;
  name: string;
  quantity: string;            // Decimal as string
  valorisation_fifo: string;   // Decimal as string MAD
  lots: Array<{
    lot_id: string;
    quantity_remaining: string;
    unit_cost: string;
    entry_date: string;
  }>;
}

export interface TenantValorisationSnapshot {
  tenant_id: string;
  snapshot_at: string;
  items: ItemStockSnapshot[];
  total_valorisation: string;
  items_count: number;
  active_lots_count: number;
}

@Injectable()
export class StockValorisationService {
  private readonly logger = new Logger(StockValorisationService.name);

  constructor(
    @InjectRepository(StockLot) private readonly lotRepo: Repository<StockLot>,
    @InjectRepository(StockItem) private readonly itemRepo: Repository<StockItem>,
  ) {}

  /**
   * Current stock pour un item : sum(quantity_remaining) + valorisation FIFO.
   */
  async getCurrentStock(itemId: string): Promise<{ quantity: string; valorisation_fifo: string; lots_count: number }> {
    const lots = await this.lotRepo.find({
      where: { item_id: itemId, quantity_remaining: MoreThan('0'), deleted_at: IsNull() },
      order: { entry_date: 'ASC', id: 'ASC' },
    });
    let totalQty = new Decimal(0);
    let totalValue = new Decimal(0);
    for (const lot of lots) {
      const qty = new Decimal(lot.quantity_remaining);
      const cost = new Decimal(lot.unit_cost);
      totalQty = totalQty.plus(qty);
      totalValue = totalValue.plus(qty.mul(cost));
    }
    return {
      quantity: totalQty.toFixed(4),
      valorisation_fifo: totalValue.toFixed(2),
      lots_count: lots.length,
    };
  }

  /**
   * Snapshot valorisation complete tenant.
   */
  async getValorisation(tenantId: string): Promise<TenantValorisationSnapshot> {
    const start = Date.now();
    const items = await this.itemRepo.find({
      where: { tenant_id: tenantId, active: true, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });

    const snapshots: ItemStockSnapshot[] = [];
    let total = new Decimal(0);
    let activeLots = 0;

    for (const item of items) {
      const lots = await this.lotRepo.find({
        where: { item_id: item.id, quantity_remaining: MoreThan('0'), deleted_at: IsNull() },
        order: { entry_date: 'ASC', id: 'ASC' },
      });
      let itemQty = new Decimal(0);
      let itemValue = new Decimal(0);
      const lotsView: ItemStockSnapshot['lots'] = [];
      for (const lot of lots) {
        const qty = new Decimal(lot.quantity_remaining);
        const cost = new Decimal(lot.unit_cost);
        itemQty = itemQty.plus(qty);
        itemValue = itemValue.plus(qty.mul(cost));
        lotsView.push({
          lot_id: lot.id,
          quantity_remaining: lot.quantity_remaining,
          unit_cost: lot.unit_cost,
          entry_date: lot.entry_date.toISOString(),
        });
        activeLots++;
      }
      snapshots.push({
        item_id: item.id,
        sku: item.sku,
        name: item.name,
        quantity: itemQty.toFixed(4),
        valorisation_fifo: itemValue.toFixed(2),
        lots: lotsView,
      });
      total = total.plus(itemValue);
    }

    this.logger.log({
      action: 'valorisation_computed',
      tenant_id: tenantId,
      items: items.length,
      active_lots: activeLots,
      total_mad: total.toFixed(2),
      duration_ms: Date.now() - start,
    });

    return {
      tenant_id: tenantId,
      snapshot_at: new Date().toISOString(),
      items: snapshots,
      total_valorisation: total.toFixed(2),
      items_count: items.length,
      active_lots_count: activeLots,
    };
  }

  /**
   * Items en alerte : current_quantity < reorder_threshold.
   */
  async findLowStockItems(tenantId: string): Promise<Array<ItemStockSnapshot & { reorder_threshold: string; ideal_stock: string }>> {
    const snapshot = await this.getValorisation(tenantId);
    const items = await this.itemRepo.find({ where: { tenant_id: tenantId, active: true, deleted_at: IsNull() } });
    const itemsMap = new Map(items.map((i) => [i.id, i]));
    const result: any[] = [];
    for (const sn of snapshot.items) {
      const item = itemsMap.get(sn.item_id);
      if (!item) continue;
      const qty = new Decimal(sn.quantity);
      const reorder = new Decimal(item.reorder_threshold);
      if (qty.lt(reorder)) {
        result.push({
          ...sn,
          reorder_threshold: item.reorder_threshold,
          ideal_stock: item.ideal_stock,
        });
      }
    }
    return result;
  }
}
```

### 6.8 Service `stock-items.service.ts`

```typescript
// repo/packages/stock/src/services/stock-items.service.ts
import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Like } from 'typeorm';
import { StockItem } from '../entities/stock-item.entity';

export interface CreateStockItemDto {
  category_id?: string;
  sku: string;
  name: string;
  description?: string;
  unit?: string;
  reorder_threshold?: number;
  ideal_stock?: number;
  supplier_id?: string;
  barcode?: string;
  photo_url?: string;
  metadata?: Record<string, unknown>;
}

export interface ListItemsFilters {
  category_id?: string;
  active?: boolean;
  search?: string;
  low_stock?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class StockItemsService {
  private readonly logger = new Logger(StockItemsService.name);

  constructor(
    @InjectRepository(StockItem) private readonly repo: Repository<StockItem>,
  ) {}

  async create(tenantId: string, dto: CreateStockItemDto): Promise<StockItem> {
    // Check duplicate SKU
    const existing = await this.repo.findOne({ where: { tenant_id: tenantId, sku: dto.sku, deleted_at: IsNull() } });
    if (existing) {
      throw new ConflictException(`SKU ${dto.sku} already exists for this tenant`);
    }
    const item = this.repo.create({ tenant_id: tenantId, ...dto } as any);
    const saved = await this.repo.save(item);
    this.logger.log({ action: 'stock_item_created', tenant_id: tenantId, item_id: (saved as any).id, sku: dto.sku });
    return saved as StockItem;
  }

  async findOne(tenantId: string, id: string): Promise<StockItem> {
    const item = await this.repo.findOne({ where: { id, tenant_id: tenantId, deleted_at: IsNull() } });
    if (!item) throw new NotFoundException(`Stock item ${id} not found`);
    return item;
  }

  async list(tenantId: string, filters: ListItemsFilters): Promise<{ items: StockItem[]; total: number }> {
    const qb = this.repo.createQueryBuilder('item')
      .where('item.tenant_id = :tenantId', { tenantId })
      .andWhere('item.deleted_at IS NULL');
    if (filters.category_id) qb.andWhere('item.category_id = :cat', { cat: filters.category_id });
    if (filters.active !== undefined) qb.andWhere('item.active = :active', { active: filters.active });
    if (filters.search) {
      qb.andWhere('(item.name ILIKE :s OR item.sku ILIKE :s)', { s: `%${filters.search}%` });
    }
    const total = await qb.getCount();
    const items = await qb
      .orderBy('item.name', 'ASC')
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0)
      .getMany();
    return { items, total };
  }

  async update(tenantId: string, id: string, dto: Partial<CreateStockItemDto>): Promise<StockItem> {
    const item = await this.findOne(tenantId, id);
    if (dto.sku && dto.sku !== item.sku) {
      const exists = await this.repo.findOne({ where: { tenant_id: tenantId, sku: dto.sku, deleted_at: IsNull() } });
      if (exists) throw new ConflictException(`SKU ${dto.sku} already exists`);
    }
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const item = await this.findOne(tenantId, id);
    item.active = false;
    item.deleted_at = new Date();
    await this.repo.save(item);
    this.logger.log({ action: 'stock_item_deleted', tenant_id: tenantId, item_id: id });
  }
}
```

### 6.9 DTOs Zod

```typescript
// repo/packages/stock/src/dto/create-stock-item.dto.ts
import { z } from 'zod';

export const CreateStockItemSchema = z.object({
  category_id: z.string().uuid().optional(),
  sku: z.string().min(1).max(64).regex(/^[A-Z0-9-]+$/i, { message: 'SKU must be alphanumeric with dashes' }),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  unit: z.enum(['pcs', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'unit']).default('pcs'),
  reorder_threshold: z.coerce.number().min(0).default(0),
  ideal_stock: z.coerce.number().min(0).default(0),
  supplier_id: z.string().uuid().optional(),
  barcode: z.string().max(64).optional(),
  photo_url: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateStockItemDto = z.infer<typeof CreateStockItemSchema>;
```

### 6.10 Controller items

```typescript
// repo/apps/api/src/modules/stock/controllers/stock-items.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, TenantGuard, Roles, CurrentTenantId } from '@insurtech/auth';
import { StockItemsService } from '@insurtech/stock';
import { StockValorisationService } from '@insurtech/stock';
import { CreateStockItemSchema } from '@insurtech/stock';

@Controller('api/v1/stock/items')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class StockItemsController {
  constructor(
    private readonly items: StockItemsService,
    private readonly valo: StockValorisationService,
  ) {}

  @Post()
  @Roles('stock.items.create')
  async create(@CurrentTenantId() tenantId: string, @Body() body: unknown) {
    const dto = CreateStockItemSchema.parse(body);
    return this.items.create(tenantId, dto);
  }

  @Get()
  @Roles('stock.items.read')
  async list(@CurrentTenantId() tenantId: string, @Query() q: any) {
    return this.items.list(tenantId, {
      category_id: q.category_id,
      active: q.active === 'true' ? true : q.active === 'false' ? false : undefined,
      search: q.search,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    });
  }

  @Get(':id')
  @Roles('stock.items.read')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    const item = await this.items.findOne(tenantId, id);
    const stock = await this.valo.getCurrentStock(id);
    return { ...item, ...stock };
  }

  @Patch(':id')
  @Roles('stock.items.update')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() body: any) {
    return this.items.update(tenantId, id, body);
  }

  @Delete(':id')
  @Roles('stock.items.delete')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.items.softDelete(tenantId, id);
    return { deleted: true, id };
  }
}
```

---

## 7. Tests complets

### 7.1 Tests `stock-valorisation.service.spec.ts` (extrait 12 cas)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StockValorisationService } from './stock-valorisation.service';
import { StockLot } from '../entities/stock-lot.entity';
import { StockItem } from '../entities/stock-item.entity';

describe('StockValorisationService', () => {
  let service: StockValorisationService;
  let lotRepo: any;
  let itemRepo: any;

  beforeEach(async () => {
    lotRepo = { find: vi.fn() };
    itemRepo = { find: vi.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        StockValorisationService,
        { provide: getRepositoryToken(StockLot), useValue: lotRepo },
        { provide: getRepositoryToken(StockItem), useValue: itemRepo },
      ],
    }).compile();
    service = mod.get(StockValorisationService);
  });

  it('getCurrentStock empty returns 0', async () => {
    lotRepo.find.mockResolvedValue([]);
    const r = await service.getCurrentStock('item-1');
    expect(r.quantity).toBe('0.0000');
    expect(r.valorisation_fifo).toBe('0.00');
  });

  it('getCurrentStock single lot', async () => {
    lotRepo.find.mockResolvedValue([
      { quantity_remaining: '10', unit_cost: '800' },
    ]);
    const r = await service.getCurrentStock('item-1');
    expect(r.quantity).toBe('10.0000');
    expect(r.valorisation_fifo).toBe('8000.00');
  });

  it('getCurrentStock multiple lots FIFO', async () => {
    lotRepo.find.mockResolvedValue([
      { quantity_remaining: '5', unit_cost: '100', entry_date: new Date('2026-01-01') },
      { quantity_remaining: '3', unit_cost: '120', entry_date: new Date('2026-02-01') },
      { quantity_remaining: '2', unit_cost: '150', entry_date: new Date('2026-03-01') },
    ]);
    const r = await service.getCurrentStock('item-1');
    expect(r.quantity).toBe('10.0000');
    // 5*100 + 3*120 + 2*150 = 500+360+300 = 1160
    expect(r.valorisation_fifo).toBe('1160.00');
  });

  it('getCurrentStock fractional quantities', async () => {
    lotRepo.find.mockResolvedValue([
      { quantity_remaining: '2.5', unit_cost: '15.75' },
    ]);
    const r = await service.getCurrentStock('item-1');
    expect(r.quantity).toBe('2.5000');
    expect(r.valorisation_fifo).toBe('39.38');
  });

  it('getValorisation tenant empty', async () => {
    itemRepo.find.mockResolvedValue([]);
    const r = await service.getValorisation('tenant-1');
    expect(r.items).toHaveLength(0);
    expect(r.total_valorisation).toBe('0.00');
  });

  it('getValorisation aggregates total', async () => {
    itemRepo.find.mockResolvedValue([
      { id: 'i1', sku: 'A', name: 'Pneu', active: true },
      { id: 'i2', sku: 'B', name: 'Filtre', active: true },
    ]);
    lotRepo.find
      .mockResolvedValueOnce([{ id: 'l1', quantity_remaining: '10', unit_cost: '800', entry_date: new Date() }])
      .mockResolvedValueOnce([{ id: 'l2', quantity_remaining: '5', unit_cost: '50', entry_date: new Date() }]);
    const r = await service.getValorisation('tenant-1');
    expect(r.items).toHaveLength(2);
    expect(r.total_valorisation).toBe('8250.00');
    expect(r.active_lots_count).toBe(2);
  });

  it('findLowStockItems detects under threshold', async () => {
    itemRepo.find.mockResolvedValue([
      { id: 'i1', sku: 'A', name: 'Pneu', active: true, reorder_threshold: '15', ideal_stock: '50' },
    ]);
    lotRepo.find.mockResolvedValue([{ id: 'l1', quantity_remaining: '5', unit_cost: '800', entry_date: new Date() }]);
    const r = await service.findLowStockItems('tenant-1');
    expect(r).toHaveLength(1);
    expect(r[0].quantity).toBe('5.0000');
  });

  it('findLowStockItems ignores stocked items', async () => {
    itemRepo.find.mockResolvedValue([
      { id: 'i1', reorder_threshold: '5', ideal_stock: '50' },
    ]);
    lotRepo.find.mockResolvedValue([{ id: 'l1', quantity_remaining: '20', unit_cost: '800', entry_date: new Date() }]);
    const r = await service.findLowStockItems('tenant-1');
    expect(r).toHaveLength(0);
  });

  it('Decimal precision 18,4 + 15,4', async () => {
    lotRepo.find.mockResolvedValue([
      { quantity_remaining: '0.0001', unit_cost: '9999.9999' },
    ]);
    const r = await service.getCurrentStock('item-1');
    expect(r.quantity).toBe('0.0001');
    expect(r.valorisation_fifo).toBe('1.00');
  });

  it('Multi-tenant isolation : different tenants', async () => {
    itemRepo.find.mockResolvedValue([]);
    await service.getValorisation('tenant-1');
    await service.getValorisation('tenant-2');
    expect(itemRepo.find.mock.calls[0][0].where.tenant_id).toBe('tenant-1');
    expect(itemRepo.find.mock.calls[1][0].where.tenant_id).toBe('tenant-2');
  });

  it('Lots order ASC entry_date (FIFO)', async () => {
    lotRepo.find.mockResolvedValue([]);
    await service.getCurrentStock('item-1');
    expect(lotRepo.find.mock.calls[0][0].order).toEqual({ entry_date: 'ASC', id: 'ASC' });
  });

  it('Active items only', async () => {
    itemRepo.find.mockResolvedValue([]);
    await service.getValorisation('tenant-1');
    expect(itemRepo.find.mock.calls[0][0].where.active).toBe(true);
  });
});
```

---

## 8. Variables environnement

```env
STOCK_ENABLE_FIFO_VALIDATION=true
STOCK_DEFAULT_UNIT=pcs
```

---

## 9. Commandes shell

```bash
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/stock test:coverage
pnpm tsx infrastructure/scripts/seed-stock-fixtures.ts

# Test endpoints
curl -X POST http://localhost:4000/api/v1/stock/items \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  -d '{"sku":"GAR-PNEU-001","name":"Pneu Michelin 205/55R16","unit":"pcs","reorder_threshold":5,"ideal_stock":20}'

curl http://localhost:4000/api/v1/stock/valorisation -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" | jq
```

---

## 10. Criteres validation V1-V26

### P0 (16)
- V1 : Migrations crees 3 tables
- V2 : RLS active sur stock_*
- V3 : Trigger anti-cycle parent_id fonctionne
- V4 : UNIQUE (tenant_id, sku) enforced
- V5 : CHECK unit valide
- V6 : CHECK quantity_remaining >= 0
- V7 : CHECK qty_remaining <= quantity_in
- V8 : Index FIFO (item_id, entry_date ASC)
- V9 : `getCurrentStock` retourne quantity correcte
- V10 : `getCurrentStock` retourne FIFO valorisation correcte
- V11 : `getValorisation` snapshot total correct
- V12 : Decimal precision 18,4 / 15,4
- V13 : Multi-tenant isolation
- V14 : Photos S3 URL stored
- V15 : `findLowStockItems` detecte items < threshold
- V16 : SKU duplicate rejected 409

### P1 (7)
- V17 : Search FTS sur name (GIN index)
- V18 : Categories hierarchie 3 niveaux
- V19 : Soft delete items
- V20 : Permissions stock.items.* seeded
- V21 : Coverage >= 85%
- V22 : Tests E2E auth + RBAC + isolation
- V23 : Fixtures 50 cat + 200 items + 500 lots

### P2 (3)
- V24 : Performance valorisation 100k lots < 2s
- V25 : Documentation Stock API
- V26 : Endpoint `/stock/valorisation/export-csv` (Sprint 35 defer)

---

## 11. Edge cases

1. **Lot avec qty 0**. Solution : exclu via WHERE quantity_remaining > 0 + index partiel.
2. **Decimal arrondi 4 vs 2 decimales**. Solution : toFixed(4) interne, toFixed(2) montants.
3. **Concurrent insert lot meme entry_date**. Solution : ORDER BY (entry_date, id) deterministe.
4. **Item supprime hardware**. Solution : RESTRICT FK lot -> item.
5. **Photo S3 stale**. Solution : Sprint 10 signed URL TTL 1h.
6. **SKU avec espaces**. Solution : Zod regex `[A-Z0-9-]+`.
7. **Category profonde 20 niveaux**. Solution : trigger depth limit.
8. **JSONB metadata size**. Solution : LIMIT 10kb cote app, Postgres TOAST natif.

---

## 12. Conformite Maroc

- **CGNC Article 32** : FIFO methode officielle valorisation stocks.
- **Loi 9-88 modifiee 38-14** : tenir registre detaille mouvements.
- **DGI conservation 10 ans** (Sprint 12 deja).
- **TVA** : valorisation HT, TVA recuperable -> Sprint 12 books.
- **Atlas Cloud Benguerir** (decision-008).

---

## 13. Conventions absolues

Multi-tenant RLS strict, Zod, Pino, pnpm, TypeScript strict, Vitest >=85%, RBAC stock.*, decision-006, decision-008.

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/stock typecheck
pnpm --filter @insurtech/stock test:coverage
pnpm --filter @insurtech/database migration:run
psql $DATABASE_URL -c "SELECT count(*) FROM stock_items"
```

---

## 15. Commit message

```bash
git commit -m "feat(sprint-13): stock items + categories + lots + valorisation FIFO

Sprint 13 Tache 3.6.5 : 3 entities stock + RLS multi-tenant + service
valorisation FIFO conforme CGNC art 32 + loi 9-88.

Livrables :
- 3 migrations TypeORM (categories/items/lots) + RLS + indexes FIFO
- 3 entities TypeORM 0.3
- StockItemsService (CRUD + search)
- StockCategoriesService (hierarchie)
- StockValorisationService (FIFO + snapshot)
- 2 controllers REST + RBAC stock.*
- 38 tests (22 unit + 8 E2E + 8 integration)
- Seed fixtures 50 cat + 200 items + 500 lots

Tests: 38
Coverage: 88%

Task: 3.6.5
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.5"
```

---

## 16. Workflow next step

Tache suivante : `task-3.6.6-stock-movements-fifo-exit-logic.md` (mouvements + FIFO consumption + Kafka events).

---

## ENRICHISSEMENT v2 -- Sections supplementaires

### A. Comparaison detaillee FIFO vs CMP vs LIFO sur exemple chiffre

**Donnees test** : 3 entrees d'un meme item sur 6 mois :
- Janvier : 10 unites a 800 MAD = 8 000 MAD
- Mars : 5 unites a 850 MAD = 4 250 MAD
- Mai : 8 unites a 900 MAD = 7 200 MAD

**Total stock physique** : 23 unites, cout total achat 19 450 MAD.

**Operation** : sortie de 15 unites pour sinistre.

#### FIFO (Sprint 13 retenu)
```
Consume Janvier : 10 a 800 = 8 000 MAD
Consume Mars : 5 a 850 = 4 250 MAD
Total cout sortie = 12 250 MAD
Stock restant : 8 unites a 900 = 7 200 MAD
Valorisation bilan : 7 200 MAD
```

#### CMP (Cout Moyen Pondere)
```
CMP = (8000 + 4250 + 7200) / 23 = 845.65 MAD/unite
Cout sortie 15 unites = 15 * 845.65 = 12 684.78 MAD
Stock restant : 8 unites * 845.65 = 6 765.22 MAD
Valorisation bilan : 6 765.22 MAD
```

#### LIFO (ILLEGAL MA mais comparaison)
```
Consume Mai : 8 a 900 = 7 200 MAD
Consume Mars : 5 a 850 = 4 250 MAD
Consume Janvier : 2 a 800 = 1 600 MAD
Total cout sortie = 13 050 MAD
Stock restant : 8 unites a 800 = 6 400 MAD
Valorisation bilan : 6 400 MAD
```

**Conclusion** : en inflation continue (prix unites montent), FIFO donne stock value plus eleve au bilan (resultat plus fort visible). LIFO inverse. CMP intermediate. CGNC MA permet FIFO ou CMP, Skalean retient FIFO pour tracabilite lots.

### B. Patterns photo S3 stock items

```typescript
// Sprint 10 docs S3 reuse pattern :

@Injectable()
export class StockPhotoUploadService {
  constructor(private readonly docsService: DocsService) {}

  async uploadItemPhoto(tenantId: string, itemId: string, file: Buffer, mimeType: string): Promise<string> {
    // Validation type + taille (max 5 MB images)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException(`Unsupported mime type ${mimeType}`);
    }
    if (file.length > 5 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 5 MB');
    }

    // Upload to S3 via Sprint 10 docs
    const result = await this.docsService.upload({
      tenantId,
      resourceType: 'stock_item',
      resourceId: itemId,
      filename: `item-${itemId}-photo.${mimeType.split('/')[1]}`,
      buffer: file,
      mimeType,
      isPublic: false,           // signed URL
    });

    return result.url;
  }
}
```

Endpoint controller :
```typescript
@Post(':id/photo')
@UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }))
@Roles('stock.items.update')
async uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
  const url = await this.photoService.uploadItemPhoto(tenantId, id, file.buffer, file.mimetype);
  await this.itemsService.update(tenantId, id, { photo_url: url });
  return { photo_url: url };
}
```

### C. SKU naming conventions garage MA

Convention recommandee Sprint 23 web-garage UI :

```
{TENANT_PREFIX}-{CATEGORY_CODE}-{SUBCATEGORY}-{REF}

Exemples :
- GAR-PNEU-4X4-205-55R16   (Pneu 4x4 dimension)
- GAR-FILT-HUI-W50          (Filtre huile Wesco W50)
- GAR-PLAQ-AV-PEUGEOT-307   (Plaquettes avant Peugeot 307)
- GAR-AMOR-AR-RENAULT-CLIO  (Amortisseurs arriere Renault Clio)
- GAR-BATT-12V-60AH         (Batterie 12V 60Ah)
- GAR-HUI-MOT-5W30           (Huile moteur 5W30)
```

Regex enforce : `^[A-Z0-9-]+$` (uppercase + numeric + dash).

### D. Inventory categories hierarchy exemples (4 niveaux)

```
Level 0 (root) : Pneus
  Level 1 : Pneus tourisme
    Level 2 : Pneus tourisme summer
      Level 3 : Pneus tourisme summer 16"
    Level 2 : Pneus tourisme winter
  Level 1 : Pneus 4x4
    Level 2 : Pneus 4x4 summer
    Level 2 : Pneus 4x4 winter

Level 0 : Filtres
  Level 1 : Filtres huile
  Level 1 : Filtres air
  Level 1 : Filtres carburant
  Level 1 : Filtres habitacle (cabine)

Level 0 : Plaquettes freins
  Level 1 : Plaquettes avant
    Level 2 : Plaquettes avant ceramique
    Level 2 : Plaquettes avant standard
  Level 1 : Plaquettes arriere
```

Profondeur recommandee max 4 niveaux (lisibilite UI). Trigger Postgres check max 20 niveaux (anti-cycle protection).

### E. Tests supplementaires (10 cas)

```typescript
describe('StockValorisationService -- enrichis', () => {
  it('Multi-lots different unit_cost FIFO correct calcul', async () => {
    lotRepo.find.mockResolvedValue([
      { quantity_remaining: '5', unit_cost: '100', entry_date: new Date('2026-01-01') },
      { quantity_remaining: '3', unit_cost: '120', entry_date: new Date('2026-02-01') },
      { quantity_remaining: '2', unit_cost: '150', entry_date: new Date('2026-03-01') },
    ]);
    const r = await service.getCurrentStock('item-1');
    expect(r.quantity).toBe('10.0000');
    expect(r.valorisation_fifo).toBe('1160.00');
  });

  it('Performance valorisation 1000 items < 3s', async () => {
    // Setup 1000 items + 5000 lots
    const start = Date.now();
    await service.getValorisation('t1');
    expect(Date.now() - start).toBeLessThan(3000);
  });

  it('SnapshotAtDate exclude movements posterieurs', async () => { });
  it('Hierarchy 4-niveau category retrieve OK', async () => { });
  it('SKU normalize uppercase dash OK', async () => { });
  it('Item active=false exclu de valorisation', async () => { });
  it('Lot deleted_at NOT NULL exclu', async () => { });
  it('Photo upload validation mimetype', async () => { });
  it('Photo upload size 6 MB rejected', async () => { });
  it('Decimal 18,4 + 15,4 precision conservee', async () => { });
});
```

### F. Edge cases supplementaires

1. Item sans lots = quantity 0, valorisation 0 (pas error)
2. Lot avec qty_remaining = 0 exclu auto (index partiel)
3. SKU avec espaces normalises (' GAR-001 ' -> 'GAR-001')
4. Category hierarchie 10 niveaux -> trigger limite max 20
5. Photo S3 path stale apres delete bucket -> signed URL 401 -> retry upload
6. Item desactive temporairement -> reactivable PATCH active=true
7. SKU regex enforce uppercase strict -> 'gar-001' rejected
8. Decimal precision 0.00005 -> arrondi 0.0001 (4 chiffres)
9. NUMERIC overflow > 1e18 -> Postgres error
10. JSONB metadata > 10 KB -> warning (Sprint 35 TOAST)

### G. Conformite Maroc complement

- **CGNC article 32** : FIFO ou CMP, choix unique annee fiscale, declaration DGI obligatoire si changement.
- **Audit DGI** : tracabilite lots + mouvements + valorisation snapshot fin annee.
- **TVA recuperable** : compte 34555 (Sprint 12) auto au cas par cas via consumer stock-entry-books (Tache 3.6.8).
- **Inspection commerce** : registre des achats obligatoire (export CSV Sprint 13 facilite).

---

**Fin enrichissement task-3.6.5.**

**Fin task-3.6.5-stock-items-categories-valorisation-fifo.md.**

## ANNEXE A -- Patterns transverses Sprint 13 (conventions communes)

### A.1 Multi-tenant strict (decision-002)

Toutes les operations Sprint 13 doivent inclure tenant_id filter strict :
- Postgres : trigger RLS app.current_tenant via SET LOCAL
- ClickHouse : tenant_id dans ORDER BY pour partition pruning  
- Kafka : tenant_id obligatoire dans event payload
- Redis cache keys : prefixe tenant_id pour isolation cross-tenant impossible
- AsyncLocalStorage Node : TenantContext propage tenant_id sans param explicite
- Tests obligatoires : multi-tenant isolation (2 tenants -> 2 datasets distincts)

### A.2 Zod validation runtime stricte

Pattern uniforme partout Sprint 13 :

```typescript
const Schema = z.object({
  tenant_id: z.string().uuid(),
  field: z.string().min(1).max(255),
  amount: z.coerce.number().min(0),
  date: z.coerce.date(),
});
type Type = z.infer<typeof Schema>;

// Au controller :
const dto = Schema.parse(body);  // throws ZodError -> 400 automatic
```

JAMAIS class-validator/yup/joi -- decision conventions strictes.

### A.3 Pino logger structures

Format obligatoire pour tous logs metier :

```typescript
this.logger.log({
  action: 'snake_case_action_name',
  tenant_id: tid,
  user_id: uid,
  resource_id: rid,
  duration_ms: durationMs,
  outcome: 'success' | 'failed',
  metadata: { ... },
});
```

Permet :
- Datadog/Sentry parsing automatique
- Correlation logs cross-services
- Audit trail tenant_id systematique
- Performance monitoring duration_ms aggregations

JAMAIS console.log dans code production. Toleré uniquement dans scripts CLI infrastructure/scripts/*.

### A.4 Kafka events topics standardises

Format strict : `insurtech.events.{vertical_or_horizontal}.{entity}.{action_past}`

Topics Sprint 13 utilises :
- `insurtech.events.stock.movement_recorded` (Tache 3.6.6)
- `insurtech.events.stock.low_stock` (Tache 3.6.7)
- `insurtech.events.hr.employee_hired` (Tache 3.6.9)
- `insurtech.events.hr.employee_terminated` (Tache 3.6.9)
- `insurtech.events.hr.contract_signed` (Tache 3.6.9)
- `insurtech.events.hr.contract_renewed` (Tache 3.6.9)
- `insurtech.events.hr.contract_terminated` (Tache 3.6.9)
- `insurtech.events.hr.leave_requested` (Tache 3.6.10)
- `insurtech.events.hr.leave_approved` (Tache 3.6.10)
- `insurtech.events.hr.leave_rejected` (Tache 3.6.10)
- `insurtech.events.hr.leave_cancelled` (Tache 3.6.10)
- `insurtech.events.hr.payslip_generated` (Tache 3.6.11)
- `insurtech.events.hr.payslip_validated` (Tache 3.6.11)
- `insurtech.events.hr.payslip_paid` (Tache 3.6.11)
- `insurtech.events.analytics.etl_completed` (Tache 3.6.2)
- `insurtech.events.repair.parts_consumed` (Sprint 22 future, consume Tache 3.6.8)

### A.5 Idempotency-Key obligatoire mutations sensibles

Endpoints concernes Sprint 13 :
- POST /api/v1/stock/movements/entry
- POST /api/v1/stock/movements/exit
- POST /api/v1/stock/movements/adjustment
- POST /api/v1/stock/inventory-count
- POST /api/v1/hr/payroll/generate-period
- POST /api/v1/hr/payroll/payslips/:id/validate
- POST /api/v1/hr/payroll/payslips/:id/mark-paid

Pattern :

```
Header : Idempotency-Key: <uuid-v4>
Server check : SELECT WHERE tenant_id AND idempotency_key
Si exists : retourner reponse precedente (409 + ID si conflict)
Sinon : execute + store key 24h Redis OR UNIQUE constraint Postgres
TTL 24h pour replay safe
```


## ANNEXE B -- Conformite Maroc detaillee (rappel Sprint 13)

### B.1 Lois et decrets applicables Sprint 13

#### Loi 09-08 du 18 fevrier 2009 (CNDP)

- **Article 3** : definition donnees personnelles -- CIN, CNSS, salaire, DOB, email, IBAN, photo concerned.
- **Article 7** : transfert hors Maroc INTERDIT sans autorisation CNDP -> decision-008 Atlas Cloud Benguerir.
- **Article 13** : consentement -- embauche + signup CRM = consentement implicite stockage.
- **Article 14** : droit acces/rectification/suppression -- Sprint 35 portail employee self-service.
- **Article 21** : declaration obligatoire CNDP pour traitements automatises -- Sprint 35.

#### Loi 65-99 du 11 septembre 2003 (Code du Travail)

- **Articles 6-7** : embauche mineur < 15 ans interdite -> CHECK constraint.
- **Articles 14-17** : duree travail 44h/sem, repos hebdomadaire 24h continues.
- **Article 13** : CDI -- periode essai 3 mois cadres / 1.5 mois employes / 15j ouvriers.
- **Articles 16-22** : CDD max 1 an renouvelable 1 fois (max 2 ans cumules).
- **Article 152** : conges maternite 14 semaines, dont 6 obligatoires apres accouchement.
- **Article 269** : conges paternite 3 jours dans le mois.
- **Articles 231-251** : conges payes 1.5j/mois travaille, min 18j/an, max 30j.
- **Article 232** : 1.5j additionnel par bloc 5 ans anciennete.
- **Articles 35-39** : licenciement motif legitime + procedure + indemnite 1.5 mois/an apres 5 ans anciennete.
- **Article 254** : maladie -- certificat medical obligatoire > 4 jours.
- **Articles 41-46** : SMIG/SMAG salaire minimum legal.

#### Decret 2-22-742 du 14 fevrier 2023 (CNSS)

- **Article 5** : taux 4.48% employee + 8.98% employer (prestations long terme).
- **Article 5 bis** : taux 6.40% employer allocations familiales.
- **Article 6** : plafond cotisable 6 000 MAD/mois = 72 000 MAD/an.
- **Article 12** : declaration BPC mensuelle obligatoire avant le 10 du mois suivant.
- **Article 15** : declaration prealable embauche 8 jours apres recrutement.

#### Loi 65-00 du 3 octobre 2002 (AMO)

- **Article 12** : taux 2.26% employee + 4.11% employer.
- **Article 13** : assiette ensemble elements remuneration, pas de plafond.
- **Article 21** : exoneration partielle famille (Sprint 35).

#### Loi 47-06 du 30 novembre 2007 (Impot sur le Revenu)

- **Article 28** : frais professionnels 25% plafonne 35 000 MAD/an.
- **Article 73** : bareme IR 6 tranches MA 2026 (0% / 10% / 20% / 30% / 34% / 38%).
- **Article 74** : charges famille 360 MAD/an x enfants (max 6).
- **Article 78** : retenue source obligatoire employeur, declaration Etat 9421 annuelle.

#### Loi 9-88 modifiee 38-14 (Obligations comptables)

- **Article 18** : conservation 10 ans pieces comptables.
- **Article 32 CGNC** : valorisation stocks FIFO ou CMP (LIFO INTERDIT MA).

#### Decret SMIG 2023

- SMIG non-agricole : 2 970 MAD/mois (depuis revalorisation 2023).
- SMAG agricole : 80% SMIG.
- Implementation : CHECK constraint base_salary >= 2970.

#### Loi 53-05 du 30 novembre 2007 (Signature electronique)

- **Article 9** : conservation 10 ans signatures qualifiees -> TTL ClickHouse fct_documents_signed.

### B.2 Implementation Sprint 13 conformite

| Convention | Implementation Sprint 13 |
|------------|---------------------------|
| Data residency MA | Atlas Cloud Benguerir DC1 + DC2 replica |
| Encryption at rest | AES-256-GCM via Atlas KMS |
| Encryption in transit | TLS 1.3 obligatoire prod |
| Audit log | Pino structured logs + audit_logs table (Sprint 12) |
| Conservation 10 ans | TTL ClickHouse + partition Postgres Sprint 35 |
| Right to forget | Sprint 35 portail employee + soft delete |


## ANNEXE C -- Performance SLO Sprint 13

### C.1 Latences ciblees par categorie

#### Endpoints CRUD basiques (Stock items, HR employees, Categories)
- POST/PATCH/DELETE : p50 80ms / p95 200ms / p99 400ms
- GET single : p50 60ms / p95 150ms / p99 300ms
- GET list (50 items) : p50 100ms / p95 250ms / p99 500ms

#### Endpoints transactionnels (Stock movements, HR payslips)
- POST entry (1 lot) : p50 100ms / p95 250ms / p99 500ms
- POST exit FIFO (5 lots) : p50 250ms / p95 500ms / p99 900ms
- POST exit FIFO (10 lots) : p50 450ms / p95 850ms / p99 1.4s
- POST payslip validate : p50 150ms / p95 350ms / p99 700ms

#### Endpoints aggregation (Reports, Dashboards)
- GET valorisation 100 items : p50 200ms / p95 400ms / p99 800ms
- GET valorisation 1000 items : p50 800ms / p95 1.5s / p99 2.5s
- GET inventory historique date 6 mois ago : p50 1.5s / p95 3s / p99 5s
- GET dashboards revenue 1 an : p50 350ms / p95 700ms / p99 1.5s
- GET dashboards activity heatmap : p50 250ms / p95 500ms / p99 1s

#### Endpoints batch (Payroll generation, Inventory count)
- POST payroll generate 10 employees : p50 1.5s / p95 3s / p99 5s
- POST payroll generate 50 employees : p50 5s / p95 8s / p99 12s
- POST payroll generate 200 employees : p50 18s / p95 30s / p99 45s
- POST inventory-count 100 items : p50 3s / p95 6s / p99 10s
- POST inventory-count 1000 items : p50 12s / p95 25s / p99 40s

#### Endpoints export (CSV, XML, PDF)
- GET valorisation export.csv 1000 items : p50 1s / p95 2s / p99 4s
- GET CNSS declaration XML : p50 300ms / p95 600ms / p99 1s
- GET IR declaration CSV : p50 800ms / p95 1.5s / p99 3s
- GET payslip PDF : p50 800ms / p95 1.5s / p99 3s

### C.2 Throughput ciblesSprint 13 vs Sprint 35

| Operation | Sprint 13 RPS | Sprint 35 hardening RPS |
|-----------|----------------|---------------------------|
| Stock CRUD | 50 req/s | 500 req/s |
| Stock movements | 30 req/s | 300 req/s |
| HR CRUD | 20 req/s | 100 req/s |
| HR payroll generate | 1 req/s | 10 req/s |
| Analytics dashboards | 100 req/s | 1000 req/s |
| ETL polling cycle | 1 cycle/5min | Real-time CDC Debezium |

### C.3 Availability targets

- Sprint 13 : 99.5% (heures ouvrables 8h-20h Casablanca)
- Sprint 35 hardening : 99.9% (24/7)
- Window maintenance : 1h/semaine fenetre 3am-4am Casablanca
- RTO (Recovery Time Objective) : 1h Sprint 13 / 15min Sprint 35
- RPO (Recovery Point Objective) : 5min Sprint 13 / 1min Sprint 35

### C.4 Storage growth Sprint 13

Estimation pour 100 tenants moyens (50 employees + 1000 items + 200 movements/jour) :
- Postgres : +50 GB/an
- ClickHouse : +30 GB/an (compression columnar 5x)
- S3 documents (PDF, photos) : +20 GB/an
- Redis cache : +5 GB peak (TTL eviction)
- Kafka logs : +10 GB/an (retention 7 jours)
- Total : ~115 GB/an pour 100 tenants

### C.5 Monitoring metrics Prometheus

Sprint 13 expose metriques :
- `etl_rows_synced_total{table}` (Tache 3.6.2)
- `etl_duration_seconds{table}` (histogram)
- `etl_errors_total{table}` (counter)
- `stock_movements_total{tenant_id,type}` (Tache 3.6.6)
- `stock_alerts_sent_total{tenant_id,channel}` (Tache 3.6.7)
- `hr_payslips_generated_total{tenant_id,period}` (Tache 3.6.11)
- `hr_payslips_total_amount_mad{tenant_id}` (gauge)
- `clickhouse_query_duration_seconds{method}` (Tache 3.6.3)
- `analytics_cache_hits_total{method}` (counter)
- `analytics_cache_misses_total{method}` (counter)

Dashboards Grafana Sprint 35 :
- ETL lag par table
- API latencies par endpoint
- Cache hit ratio
- Stock movements volume par tenant
- Paie performance generation


## ANNEXE D -- Edge cases + troubleshooting Sprint 13

### D.1 Edge cases multi-tenant

1. **Tenant cree apres seed initial** : ETL Tache 3.6.2 inclut auto via full sync dim_tenants. Premier sync analytics peut etre vide pour ce tenant.
2. **Tenant churned** : ETL marque churned_at, dashboards filtrent active. Sprint 35 : retention 6 mois apres churn pour audit.
3. **Tenant fusion (acquisitions)** : Sprint 35 outil consolidation tenant cible. Sprint 13 = non supporte.
4. **Tenant split (separation)** : Sprint 35 outil migration partielle. Sprint 13 = manual.
5. **Tenant data residency exception** : Sprint 35 multi-region MA + EU pour clients europeens. Sprint 13 = MA only.

### D.2 Edge cases temps + dates

1. **Timezone Casablanca DST** : MA n'observe pas DST depuis 2018 (UTC+1 toute annee). Stockage UTC, presentation locale.
2. **Periode fiscale chevauchant** : MA = annee civile (1 jan - 31 dec). Pas de fiscal year offset.
3. **Date debut activite tenant futur** : autoriser, ETL skip jusqu'a date.
4. **Date naissance employee tres ancien (> 100 ans)** : warning flag, pas reject.
5. **Period payslip futur** : autoriser (planification), warning si > +6 mois.
6. **Period payslip passe > 5 ans** : warning + audit log.
7. **Movements occurred_at futur > 30 min** : Zod reject (anti-fraud).
8. **Movements occurred_at retroactif > 90 jours** : warning + audit.

### D.3 Edge cases concurrence + race conditions

1. **2 concurrent exits same item FIFO** : SELECT FOR UPDATE serialise -> 1 succeed first, 2nd INSUFFICIENT_STOCK ou succeed selon stock.
2. **2 concurrent payroll generate same period** : UNIQUE (tenant, employee, period) -> 1 succeed, 2nd 409 IDEMPOTENCY.
3. **2 concurrent leave requests same employee dates** : trigger PG anti-overlap rejette.
4. **2 concurrent contract activate same employee** : trigger single_active_contract rejette.
5. **Idempotency replay simultane** : UNIQUE constraint Postgres = 1 first wins.
6. **Kafka consumer parallel processing same event** : group_id partition = 1 consumer par partition (idempotent au niveau handler).

### D.4 Edge cases financiers (paie, stock valorisation)

1. **Salaire SMIG exact 2970** : net positif obligatoire (cotisations + IR + AMO ne doivent pas mettre net negatif).
2. **Bracket IR boundary 30000 exact** : tranche 0% applique, IR = 0.
3. **Bracket IR boundary 30001** : bascule 10%, IR = 30001 * 0.10 - 3000 = 0.10 MAD.
4. **CNSS plafond 6000 exact** : cotisation = 268.80 (4.48% x 6000).
5. **Family children > 6** : capped a 6 (max legal art 74).
6. **AMO no plafond** : 100 000 MAD/mois brut -> 2 260 MAD AMO/mois.
7. **Frais pro plafond 35000/an** : seul brut > 11 666 MAD/mois est plafonne.
8. **FIFO consume lot avec qty < requested** : continue consume lot suivant.
9. **FIFO 0 lots disponibles** : INSUFFICIENT_STOCK error 400.
10. **Decimal precision rounding** : toFixed(2) pour MAD, toFixed(4) pour quantites.

### D.5 Troubleshooting common issues

#### Issue : ETL lag > 30 min
- Cause : ClickHouse insert lent / Postgres delta gros / Kafka consumer down
- Diagnostic : `GET /admin/analytics/etl-state` -> regarder last_synced_at
- Solution : `POST /admin/analytics/resync` force resync OU restart consumer

#### Issue : Dashboards 503 timeout
- Cause : ClickHouse query lente / cache Redis down
- Diagnostic : logs Pino query_duration_ms / Redis ping
- Solution : verify ClickHouse health / restart Redis / abort_signal 25s

#### Issue : Stock movement INSUFFICIENT_STOCK alors que stock visible
- Cause : autre transaction concurrent en cours (SELECT FOR UPDATE bloque)
- Diagnostic : `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%stock_lots%'`
- Solution : retry quelques secondes plus tard ; verifier pas de transaction longue duration

#### Issue : Payslip Books ecriture manquante
- Cause : Kafka consumer down apres payslip_validated emit
- Diagnostic : `SELECT * FROM hr_payslips WHERE id = X` -> status=validated mais pas dans journal_entries
- Solution : manual re-emit Kafka event OU appel direct Books.recordEntry avec idempotency-key

#### Issue : CNSS XML rejected Damancom
- Cause : format invalide (encoding, ICE, CIN normalisation)
- Diagnostic : valider XML schema XSD Damancom
- Solution : verifier tenant.cnss_employer_number + ICE + CIN normalize uppercase no spaces


## ANNEXE E -- Architecture + Roadmap Sprint 14+

### E.1 Architecture Sprint 13 detaillee

```
+-----------------------------------------------------------+
|                  Frontend (Sprint 17 / 23)                |
|  web-broker UI  +  web-garage UI  +  Sprint 19 portail   |
+----------------------------+------------------------------+
                             |
                             | HTTPS + JWT + x-tenant-id
                             v
+----------------------------+------------------------------+
|              API Gateway NestJS (apps/api)                |
|  + JwtAuthGuard + RolesGuard + TenantGuard + Throttle    |
+----------------------------+------------------------------+
                             |
       +---------------------+-------------------+
       v                     v                   v
   +-------+           +-----------+      +-----------+
   | CRM   |           |  Stock    |      |    HR     |
   +---+---+           +-----+-----+      +-----+-----+
       |                     |                  |
       +---------+-----------+------------------+
                 |
                 v
+----------------+-----------------+
| Postgres 16 OLTP Atlas DC1        |
| RLS multi-tenant strict           |
| Triggers anti-overlap/cycle       |
| Migrations TypeORM 0.3            |
+----------------+-----------------+
                 |
                 | ETL polling 5min (Tache 3.6.2)
                 v
+----------------+-----------------+
| ClickHouse 24.10 OLAP             |
| 5 fct_* + 2 dim_* + 1 dim_dates  |
| TTL 5-10 ans selon legal          |
+----------------+-----------------+
                 |
                 | Queries (AnalyticsService)
                 v
+----------------+-----------------+
| 6 Dashboards REST endpoints       |
+----------------------------------+

Side channels :
+ Redis cache (Sprint 9) : analytics cache + idempotency keys
+ Kafka 3.7 (Sprint 9) : events cross-module + consumers Books/Repair
+ S3 Atlas (Sprint 10) : documents, photos, bulletins PDF
+ SendGrid (Sprint 9) : emails notifications
+ Meta WhatsApp API (Sprint 9) : WA notifications
```

### E.2 Sprint 14+ Vertical Insure (Phase 4)

Sprint 14 demarre avec :
- Tous modules horizontaux ready as building blocks
- CRM contacts -> souscripteurs polices
- Pay -> primes paiements
- Books -> commissions courtier ecritures
- Docs -> polices PDF + signatures Barid
- Analytics -> dashboards Insure-specific (a creer)

Modules Insure prevus B-14 a B-19 :

| Sprint | Module | Effort |
|--------|--------|--------|
| B-14 | Insure foundation : polices + souscriptions + ACAPS reporting | 70h |
| B-15 | Insure sinistres : workflow + expertise + reglement | 75h |
| B-16 | Insure commissions courtier + reconciliation | 60h |
| B-17 | Web Broker UI : dashboards + CRM + souscriptions | 80h |
| B-18 | Web Customer Portal SEO + acquisition prospects | 70h |
| B-19 | Web Assure Portal + capture NPS Sprint 13 framework | 75h |

### E.3 Sprint 20+ Vertical Repair (Phase 5)

Sprint 20-23 consume Stock + HR Sprint 13 :
- Sprint 22 : Repair sinistres + parts_consumed -> consume Stock FIFO via Kafka
- Sprint 23 : Web Garage UI + dashboards Stock + HR + Repair
- Atelier mecanicien PWA mobile

### E.4 Sprint 24-30 Phase 6+ SaaS Front + Mobile + IA

Sprint 24-30 :
- B-24/25 : Web Insurtech Admin (super admin Skalean)
- B-26/27 : Web admin tenants
- B-28/29 : PWA mobile garage + assure
- B-30 : Skalean AI integration via Sprint 31 MCP (decision-005)

### E.5 Sprint 31-35 Hardening + Production

- B-31 : Agent Sky MCP tools (get_revenue_trend, get_stock_alerts, get_payslip)
- B-32 : Materialized views ClickHouse + cache HTTP layer
- B-33 : Backup/restore + disaster recovery DC2
- B-34 : Security audit + pentest + ANRT certification
- B-35 : Production hardening + observability complete


## ANNEXE F -- Cheatsheet permissions RBAC Sprint 13

### F.1 Permissions Stock (15 permissions)

```typescript
// repo/packages/auth/src/seeds/permissions/stock.ts
export const STOCK_PERMISSIONS = [
  // Categories
  'stock.categories.create',
  'stock.categories.read',
  'stock.categories.update',
  'stock.categories.delete',
  // Items
  'stock.items.create',
  'stock.items.read',
  'stock.items.update',
  'stock.items.delete',
  // Movements
  'stock.movements.create',
  'stock.movements.read',
  'stock.adjust',
  // Reports
  'stock.valorisation.read',
  'stock.alerts.read',
  'stock.alerts.snooze',
  // Admin
  'stock.admin.force_unlock',
];
```

### F.2 Permissions HR (20 permissions)

```typescript
// repo/packages/auth/src/seeds/permissions/hr.ts
export const HR_PERMISSIONS = [
  // Employees
  'hr.employees.create',
  'hr.employees.read',
  'hr.employees.read_own',           // employee voit son propre dossier
  'hr.employees.update',
  'hr.employees.delete',
  // Contracts
  'hr.contracts.create',
  'hr.contracts.read',
  'hr.contracts.update',
  'hr.contracts.terminate',
  // Leaves
  'hr.leaves.request',
  'hr.leaves.approve',
  'hr.leaves.cancel',
  'hr.leaves.read',
  'hr.leaves.read_own',
  // Payroll
  'hr.payroll.generate',
  'hr.payroll.validate',
  'hr.payroll.mark_paid',
  'hr.payslips.read',
  'hr.payslips.read_own',
  // Declarations
  'hr.declarations.read',
  'hr.declarations.export',
];
```

### F.3 Mapping roles -> permissions Sprint 13

| Role | Permissions Stock | Permissions HR |
|------|--------------------|------------------|
| SuperAdmin | All stock.* | All hr.* |
| BrokerAdmin | -- | hr.employees.* (employes courtage) |
| GarageAdmin | All stock.* + hr.* | All hr.* |
| GarageManager | stock.items.{r,u} + stock.movements.{c,r} + stock.alerts.* | hr.leaves.approve + hr.employees.read |
| GarageMechanic | stock.items.read + stock.movements.create | hr.employees.read_own + hr.payslips.read_own + hr.leaves.request |
| GarageStock | All stock.* | -- |
| Accountant | stock.valorisation.read + stock.reports.read | hr.payroll.* + hr.declarations.* |
| ComplianceOfficer | -- | hr.declarations.read |
| FinanceOfficer | stock.valorisation.read | hr.payroll.read + hr.payslips.read |
| ReadOnly | stock.items.read + stock.valorisation.read | hr.employees.read |

### F.4 Permissions Analytics (5)

```typescript
export const ANALYTICS_PERMISSIONS = [
  'analytics.dashboards.read',
  'analytics.exports.create',
  'analytics.admin.etl_resync',
  'analytics.admin.cache_invalidate',
  'analytics.developer.raw_query',     // Sprint 35
];
```

### F.5 Endpoints API summary Sprint 13 (44 endpoints)

#### Analytics (8)
- GET /api/v1/analytics/dashboards/revenue
- GET /api/v1/analytics/dashboards/conversion
- GET /api/v1/analytics/dashboards/activity
- GET /api/v1/analytics/dashboards/sinistre-rate
- GET /api/v1/analytics/dashboards/nps
- GET /api/v1/analytics/dashboards/funnel-tenant
- GET /api/v1/admin/analytics/etl-state
- POST /api/v1/admin/analytics/resync

#### Stock (15)
- POST/GET/PATCH/DELETE /api/v1/stock/items
- POST/GET /api/v1/stock/categories
- POST /api/v1/stock/movements/{entry,exit,adjustment}
- GET /api/v1/stock/items/:id/movements
- GET /api/v1/stock/alerts/low-stock
- GET /api/v1/stock/valorisation
- GET /api/v1/stock/valorisation/export.csv
- GET /api/v1/stock/reports/inventory
- POST /api/v1/stock/inventory-count

#### HR (21)
- POST/GET/PATCH/DELETE /api/v1/hr/employees
- POST /api/v1/hr/employees/:id/terminate
- POST/GET /api/v1/hr/employees/:id/contracts
- POST /api/v1/hr/contracts/:id/{activate,terminate,renew}
- POST /api/v1/hr/leaves/{request,approve,reject,cancel}
- GET /api/v1/hr/leaves/balance/:employeeId
- POST /api/v1/hr/payroll/{generate-period,payslips/:id/validate,payslips/:id/mark-paid}
- GET /api/v1/hr/payroll/payslips
- GET /api/v1/hr/payroll/payslips/:id/pdf
- GET /api/v1/hr/reports/declaration-cnss(/xml)
- GET /api/v1/hr/reports/declaration-ir(/csv)
- GET /api/v1/hr/dashboard


## ANNEXE G -- Testing strategy detaillee Sprint 13

### G.1 Test pyramid Sprint 13

```
                    /\
                   /  \   E2E + Integration (Tests Sprint 13)
                  /----\  35+ tests E2E + 8 integration concurrence
                 /      \
                /--------\ Service unit tests (mock repos)
               /          \ 200+ tests unit
              /------------\
             /              \ Pure logic tests (calculators, validators)
            /----------------\ 100+ tests (PayrollCalculator, LeaveBalance, FIFO)
```

### G.2 Coverage targets Sprint 13

| Module | Coverage target | Rationale |
|--------|-------------------|-----------|
| @insurtech/hr payroll-calculator | >= 95% | Critical legal computations IR/CNSS/AMO |
| @insurtech/hr leave-balance-calculator | >= 90% | Legal compliance (art 231-232) |
| @insurtech/stock valorisation | >= 90% | FIFO accuracy mandatory CGNC art 32 |
| @insurtech/stock movements | >= 90% | Concurrence + atomicity critical |
| @insurtech/analytics services | >= 85% | Standard cover |
| @insurtech/hr services | >= 85% | Standard |
| Controllers REST | >= 80% | E2E covers integration |

### G.3 Fixtures realistes Sprint 13

Seed script `seed-phase-3-fixtures.ts` produit :
- 5 tenants types (3 garages + 2 cabinets courtage)
- 50 employees total (10 per tenant)
- 50 contrats CDI actives
- 100+ conges historiques (50% paid + 30% sick + 20% maternity/paternity)
- 600 payslips (50 employees x 12 mois retroactifs)
- 1000 stock items + 5000 lots
- 30 000 stock movements (24000 entries + 6000 exits)
- 150 alertes historiques

Execution : `pnpm tsx infrastructure/scripts/seed-phase-3-fixtures.ts`
Idempotency : ON CONFLICT DO NOTHING (relancable safely).
Duree : ~60 secondes sur Atlas Cloud Benguerir DC1.

### G.4 Tests E2E parcours critiques

```typescript
// 35+ tests E2E groups :

describe('Group 1 : ClickHouse + ETL (5)', () => {
  // ping, schemas, dim_dates, ETL sync, idempotency
});

describe('Group 2 : Dashboards (8)', () => {
  // 6 endpoints + format + multi-tenant + cache
});

describe('Group 3 : Stock (12)', () => {
  // CRUD + FIFO multi-lots + alertes + inventory
});

describe('Group 4 : HR employees (5)', () => {
  // CIN MA + SMIG + CDD/CDI + termination
});

describe('Group 5 : HR conges (5)', () => {
  // Workflow + balance + maternity + sick certif
});

describe('Group 6 : HR paie (7)', () => {
  // CNSS + AMO + IR brackets + Books + declarations
});
```

### G.5 Tests integration concurrence

```typescript
// 100 concurrent exits FIFO same item -> 50 succeed + 50 fail INSUFFICIENT_STOCK
// 50 concurrent payroll generate -> 1 success + 49 IDEMPOTENCY_REPLAY
// 10 concurrent leave requests overlap -> trigger PG rejette
```

### G.6 Performance tests benchmark

```typescript
// Benchmark scenarios :
- 1000 stock items + 5000 lots -> valorisation < 3s
- 200 employees -> payroll generate-period < 30s
- 50 concurrent dashboard requests -> p95 < 1s
- ETL sync 100k transactions -> < 60s
- Inventory historique 6 mois -> < 5s
```


## ANNEXE H -- Pre-commit + workflow CI/CD Sprint 13

### H.1 Pre-commit hooks Husky configuration

```json
// .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# 1. Lint-staged : Biome auto-fix + format
pnpm exec lint-staged

# 2. Typecheck strict TypeScript
pnpm typecheck

# 3. Tests unit ONLY pour packages modifies
pnpm exec turbo test --filter=...HEAD --since=HEAD~1

# 4. No-emoji check (decision-006 absolu)
./infrastructure/scripts/check-no-emoji.sh

# 5. No console.log dans production
./infrastructure/scripts/check-no-console.sh

# 6. Conventional commit message format
pnpm exec commitlint --edit "$1"
```

### H.2 Conventional Commits Sprint 13

Format strict :
```
<type>(scope): description courte 50-72 chars

Description longue 2-4 lignes (optionnel)

Livrables:
- bullet 1
- bullet 2

Tests: <n> total / Coverage: <X>%

Task: 3.6.<X>
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.<X>
```

Types autorises Sprint 13 :
- `feat` : nouvelle fonctionnalite (taches 3.6.1-3.6.14)
- `fix` : bugfix
- `docs` : documentation seulement
- `test` : ajout tests sans code metier
- `refactor` : refacto sans changement comportement
- `perf` : amelioration performance
- `chore` : maintenance (deps, build)
- `ci` : configuration CI/CD

Scopes Sprint 13 :
- `sprint-13` : tout sprint
- `analytics` : module analytics
- `stock` : module stock
- `hr` : module HR
- `books-consumer` : consumers Books
- `tests` : tests E2E

Exemples conformes :
```
feat(sprint-13): ClickHouse setup + 8 schemas analytics

Sprint 13 Tache 3.6.1 : pose le socle infrastructure ClickHouse 24.10 OLAP
separe Postgres OLTP, charge 8 schemas (5 faits + 2 dims + 1 calendar).

Livrables :
- docker-compose service clickhouse 24.10-alpine
- 9 schemas SQL (database + 5 fct_* + 2 dim_* + dim_dates 1827 rows)
- @insurtech/analytics package + ClickHouseService

Tests: 36 / Coverage: 88%

Task: 3.6.1
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.1
```

### H.3 CI/CD pipeline Sprint 13

```yaml
# .github/workflows/sprint-13.yml
name: Sprint 13 CI

on:
  push:
    branches: [main, sprint-13]
  pull_request:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '22.11.0'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: ./infrastructure/scripts/check-no-emoji.sh
      - run: ./infrastructure/scripts/check-no-console.sh

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v4

  test-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test
        ports: [5432:5432]
      clickhouse:
        image: clickhouse/clickhouse-server:24.10-alpine
        ports: [8123:8123]
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm migration:run
      - run: pnpm tsx infrastructure/scripts/init-clickhouse.ts
      - run: pnpm test:integration
      - run: pnpm test:e2e

  build:
    runs-on: ubuntu-latest
    needs: [lint-typecheck, test-unit, test-integration]
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### H.4 Workflow developpement Sprint 13

1. **Pre-tache** : lire B-13 + cette task prompt + decision-strategiques referencees.
2. **Setup branch** : `git checkout -b sprint-13/task-3.6.X-<slug>`.
3. **Implement** : suivre 17 sections du prompt + code patterns fournis.
4. **Tests** : ecrire tests AVANT ou en parallele (TDD-friendly).
5. **Pre-commit** : `pnpm typecheck && pnpm lint && pnpm test:coverage`.
6. **Commit** : Conventional Commits + metadata Task/Sprint/Phase.
7. **Push + PR** : titre format `Sprint 13 -- Task 3.6.X : <description>`.
8. **CI** : attendre green (lint + types + tests + integration).
9. **Review** : 1 lead minimum + 1 reviewer metier.
10. **Merge** : squash + tag `sprint-13-task-3.6.X-done`.
11. **Next task** : passer a 3.6.(X+1).

### H.5 Definition of Done Sprint 13

Chaque tache 3.6.X consideree done quand :
- [ ] Tous livrables checkables coches
- [ ] Code TypeScript strict no any implicite
- [ ] Tests unit coverage >= cible (85% standard, 90-95% critique)
- [ ] Tests integration passent (Postgres + Redis + ClickHouse reels)
- [ ] Tests E2E passent (au moins parcours nominaux)
- [ ] CI green sur tous jobs
- [ ] Code reviewed par minimum 1 lead
- [ ] Documentation API a jour (Swagger/OpenAPI export)
- [ ] Aucune emoji (decision-006)
- [ ] Aucune reference vague type "voir B-XX"
- [ ] Commit message Conventional + metadata
- [ ] Conformite legale verifiee (liste lois applicables)
- [ ] Performance SLO respectes (latences + throughput)
- [ ] Multi-tenant isolation testee
- [ ] RBAC permissions seedees + assignees aux roles

