/**
 * @insurtech/comm/providers/whatsapp/types
 *
 * Types Meta Cloud API v21.0 -- input / output structures.
 */

export type MetaLanguageCode = 'fr' | 'ar' | 'en' | 'en_US';

export interface MetaTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: { fallback_value: string };
  image?: { link?: string; id?: string };
  document?: { link?: string; id?: string; filename?: string };
  video?: { link?: string; id?: string };
}

export interface MetaTemplateComponent {
  type: 'header' | 'body' | 'footer' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: number;
  parameters?: MetaTemplateParameter[];
}

export interface SendTemplateRequest {
  to: string;
  templateName: string;
  languageCode: MetaLanguageCode;
  components: MetaTemplateComponent[];
}

export interface SendTextRequest {
  to: string;
  body: string;
  contextMessageId?: string;
}

export interface SendResult {
  messageId: string;
  recipientId: string;
}

export interface PhoneNumberInfo {
  verifiedName?: string | undefined;
  codeVerificationStatus?: string | undefined;
  displayPhoneNumber?: string | undefined;
  qualityRating?: string | undefined;
  phoneNumberId?: string | undefined;
}

export interface UploadMediaResult {
  mediaId: string;
}

export interface IWhatsAppCloudApiClient {
  sendTemplate(request: SendTemplateRequest): Promise<SendResult>;
  sendText(request: SendTextRequest): Promise<SendResult>;
  markAsRead(messageId: string): Promise<void>;
  getPhoneNumberInfo(): Promise<PhoneNumberInfo>;
  uploadMedia(buffer: Buffer, mimeType: string, filename?: string): Promise<UploadMediaResult>;
  isDisabled(): boolean;
}
