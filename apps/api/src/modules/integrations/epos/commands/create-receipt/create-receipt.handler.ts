import { db } from '@db';
import { env } from '@env';
import { eposClient } from '../../client';
import { logIntegration } from '../../../log';
import { IntegrationError, handleHttpError } from '@lib/integrations';
import { getOrganization } from '../../../../admin/organization/queries/get-organization/get-organization.handler';
import { CreateReceiptCommand } from './create-receipt.command';

/** EPOS encodes quantity ×1000 — `1 шт` is `1000`. */
const AMOUNT_SCALE = 1000;

export interface EposReceiptInfo {
  terminalId: string;
  receiptSeq: string;
  fiscalSign: string;
  dateTime: string;
  qrCodeURL: string;
}

/**
 * Splits a VAT-inclusive total into net amount and VAT, both in tiyin.
 * Prices in this system are gross, so VAT is extracted, not added.
 */
export function extractVat(total: number, vatRate = 12) {
  if (vatRate === 0) {
    return { total, amount: total, vat: 0 };
  }
  const amount = total / (1 + vatRate / 100);
  return {
    total,
    amount: Math.round(amount),
    vat: Math.round(total - amount),
  };
}

export const createReceiptHandler = async ({ products }: CreateReceiptCommand) => {
  const org = await getOrganization();
  // The receipt is filed under the platform's own requisites — we resell the
  // goods. Without them there is no legal seller to name, so refuse.
  if (!org) throw new Error('organization_requisites_missing');
  if (!org.directorName) throw new Error('organization_director_name_missing');

  const items = products.map((item) => {
    // items[].price is the LINE total in tiyin (quantity included), not unit price.
    const lineTotal = Math.round(Number(item.price) * 100) * item.amount;
    const { vat } = extractVat(lineTotal, item.vatPercent);
    return {
      price: lineTotal,
      amount: item.amount * AMOUNT_SCALE,
      name: item.name,
      vat,
      vatPercent: item.vatPercent,
      discount: 0,
      other: 0,
      // Omitted entirely when absent — a null is not the same as no field.
      ...(item.classCode ? { classCode: item.classCode } : {}),
      ...(item.packageCode ? { packageCode: item.packageCode } : {}),
      ...(item.label ? { label: item.label } : {}),
    };
  });

  const total = items.reduce((sum, i) => sum + i.price, 0);

  const data = {
    token: env.EPOS_TOKEN,
    method: 'sale',
    companyName: org.legalName,
    companyAddress: org.address,
    companyINN: org.inn,
    staffName: org.directorName,
    printerSize: '58',
    params: {
      // The client pays nothing at the till — the merchant is settled by the
      // platform via non-cash transfer, so the whole sum is receivedCard.
      receivedCard: total,
      receivedCash: 0,
      items,
    },
  };

  const requestTimestamp = new Date();
  try {
    const response = await eposClient('', { method: 'POST', json: data }).json<{
      info: EposReceiptInfo;
    }>();

    logIntegration(db, {
      integration: 'epos',
      methodName: 'sale',
      methodType: 'POST',
      request: data,
      response,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });

    return response;
  } catch (err) {
    // The only trace a failed attempt leaves — deal_receipts keeps successes only.
    logIntegration(db, {
      integration: 'epos',
      methodName: 'sale',
      methodType: 'POST',
      request: data,
      response: err instanceof IntegrationError ? err.body : null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    return handleHttpError(err, 'epos.sale');
  }
};
