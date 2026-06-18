import { env } from '@env';
import { callKatm, assertOk, security } from '../../service/shared';

export async function checkCreditBan(params: { pinfl: string }): Promise<{ banned: boolean }> {
  const data = await callKatm<{ status?: number }>('client/credit/ban/status', {
    security: security(),
    data: {
      pHead: env.KATM_HEAD,
      pCode: env.KATM_CODE,
      pIdentifier: params.pinfl,
      pSubjectType: 2,
    },
  });
  assertOk('client/credit/ban/status', data);
  return { banned: data.status === 1 };
}
