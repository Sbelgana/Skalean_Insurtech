export { BooksInvoiceEntity, type BooksInvoiceType, type BooksInvoiceStatus } from './books-invoice.entity.js';
export { BooksInvoiceLineEntity } from './books-invoice-line.entity.js';
export { BooksAccountEntity, type BooksAccountType } from './books-account.entity.js';

import { BooksInvoiceEntity } from './books-invoice.entity.js';
import { BooksInvoiceLineEntity } from './books-invoice-line.entity.js';
import { BooksAccountEntity } from './books-account.entity.js';

export const booksEntities = [
  BooksInvoiceEntity,
  BooksInvoiceLineEntity,
  BooksAccountEntity,
] as const;
