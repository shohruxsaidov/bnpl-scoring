import { env } from '@env';
import { eposClient } from '../../client';
import { getOrganization } from '../../../../admin/organization/queries/get-organization/get-organization.handler';
import { CreateReceiptCommand } from './create-receipt.command';

export function extractVat(total: number, vatRate = 12) {
  if (vatRate === 0) {
    return {
      total: total,
      amount: total,
      vat: 0,
    };
  }
  const amount = total / (1 + vatRate / 100);
  const vat = total - amount;

  return {
    total,
    amount: Number(amount.toFixed(2)),
    vat: Number(vat.toFixed(2)),
  };
}

export const createReceiptHandler = async ({ products }: CreateReceiptCommand) => {
  const org = await getOrganization();
  let allPriceInTiyin = 0;
  products.forEach((item) => {
    allPriceInTiyin += item.amount * +item.price * 100;
  });
  const items = products.map((item) => {
    const productPrice = +item.price * 100;
    const productVat = extractVat(productPrice, item.vatPercent);
    return {
      price: productPrice,
      amount: item.amount,
      name: item.name,
      vat: productVat.vat,
      vatPercent: item.vatPercent,
      classCode: item.classCode,
      packageCode: item.packageCode,
      label: item.label,
    };
  });
  const data = {
    token: env.EPOS_TOKEN,
    method: 'sale',
    companyName: org.legalName,
    companyAddress: org.address,
    companyINN: org.inn,
    staffName: org.directorName,
    printerSize: '58',
    params: {
      receivedCard: allPriceInTiyin,
      receivedCash: 0,
      items: items,
    },
  };
  return await eposClient('', {
    method: 'POST',
    json: data,
  }).json<{
    info: {
      terminalId: string;
      receiptSeq: string;
      fiscalSign: string;
      dateTime: string;
      qrCodeURL: string;
    };
  }>();
};
