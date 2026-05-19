export { HrEmployeeEntity, type HrRole } from './hr-employee.entity.js';
export { HrAttendanceEntity } from './hr-attendance.entity.js';

import { HrEmployeeEntity } from './hr-employee.entity.js';
import { HrAttendanceEntity } from './hr-attendance.entity.js';

export const hrEntities = [HrEmployeeEntity, HrAttendanceEntity] as const;
