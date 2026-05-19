import { z } from 'zod';
import { ULID_REGEX } from '../event-envelope.js';

export const UlidSchema = z.string().regex(ULID_REGEX, 'Must be 26-char ULID');
export type Ulid = z.infer<typeof UlidSchema>;
