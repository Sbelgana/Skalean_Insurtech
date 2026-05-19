import { z } from 'zod';

export const LocaleSchema = z.enum(['fr-MA', 'ar-MA', 'en-US', 'fr-FR']);
export type Locale = z.infer<typeof LocaleSchema>;

export const ChannelSchema = z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app']);
export type Channel = z.infer<typeof ChannelSchema>;
