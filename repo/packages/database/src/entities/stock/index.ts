export { StockItemEntity, type StockUnit } from './stock-item.entity.js';
export { StockMovementEntity, type StockMovementType } from './stock-movement.entity.js';

import { StockItemEntity } from './stock-item.entity.js';
import { StockMovementEntity } from './stock-movement.entity.js';

export const stockEntities = [StockItemEntity, StockMovementEntity] as const;
