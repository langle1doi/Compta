import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/tenant/client';
import { DocumentType } from '../../generated/tenant/enums';
import { DEFAULT_FORMATS, renderNumber, YEARLESS } from './number-format';

/**
 * Gapless numbering (F03 BR-01). Must be called inside the transaction that inserts the document:
 * the row-level lock taken by UPDATE serializes concurrent callers and a rollback releases the number.
 */
@Injectable()
export class NumberingService {
  async next(tx: Prisma.TransactionClient, companyId: string, docType: DocumentType, date = new Date()): Promise<string> {
    const year = YEARLESS.has(docType) ? 0 : date.getUTCFullYear();

    await tx.$executeRaw`
      INSERT INTO number_sequences (id, company_id, doc_type, year, format, next_value, updated_at)
      VALUES (gen_random_uuid(), ${companyId}::uuid, ${docType}::document_type, ${year}, ${DEFAULT_FORMATS[docType]}, 1, now())
      ON CONFLICT (company_id, doc_type, year) DO NOTHING`;

    const [row] = await tx.$queryRaw<{ value: number; format: string }[]>`
      UPDATE number_sequences SET next_value = next_value + 1, updated_at = now()
      WHERE company_id = ${companyId}::uuid AND doc_type = ${docType}::document_type AND year = ${year}
      RETURNING next_value - 1 AS value, format`;

    return renderNumber(row.format, year, row.value);
  }
}
