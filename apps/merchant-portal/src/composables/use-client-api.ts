import { useMutation } from '@tanstack/vue-query';
import { apiFetch } from '@/utils/apiFetch';
import type { Client } from '@/types';

export function useClientApi() {
  const searchClientsMutation = useMutation({
    mutationFn: (q: string) =>
      apiFetch<{ clients: Client[] }>(`/merchant/client/search?q=${encodeURIComponent(q)}`),
  });

  const sendOtpMutation = useMutation({
    mutationFn: (phone: string) => {
      phone = phone.replace('+', '');
      return apiFetch<{ devOtp?: string }>('/merchant/client/otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) => {
      phone = phone.replace('+', '');
      return apiFetch<{ regToken: string }>('/merchant/client/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      });
    },
  });

  const myidSessionMutation = useMutation({
    mutationFn: ({
      regToken,
      pinfl,
      retry = false,
    }: {
      regToken: string;
      pinfl: string;
      retry?: boolean;
    }) =>
      apiFetch<{ regToken: string; redirectUrl?: string; mock?: boolean }>(
        '/merchant/client/myid-session',
        {
          method: 'POST',
          body: JSON.stringify({ regToken, pinfl, ...(retry ? { retry: true } : {}) }),
        },
      ),
  });

  const completeMyidMutation = useMutation({
    mutationFn: ({ regToken, myidCode }: { regToken: string; myidCode: string }) =>
      apiFetch<{ client: Client }>('/merchant/client/myid-complete', {
        method: 'POST',
        body: JSON.stringify({ regToken, myidCode }),
      }),
  });

  const myidSignSessionMutation = useMutation({
    mutationFn: (pinfl: string) =>
      apiFetch<{ signingSessionToken: string; redirectUrl: string | null; mock: boolean }>(
        '/merchant/client/myid-sign-session',
        { method: 'POST', body: JSON.stringify({ pinfl }) },
      ),
  });

  const myidSignCompleteMutation = useMutation({
    mutationFn: (input: {
      signingSessionToken: string;
      myidCode: string;
      signingToken: string;
      clientId: string;
      tariffId: string;
      basket: Array<{ productId: string; quantity: number }>;
      paymentDay: number;
      scoreSum?: number | null;
      scoringDecision?: string | null;
    }) =>
      apiFetch<{ verified: boolean; dealId: string; dealNumber: string }>('/merchant/client/myid-sign-complete', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });

  const sendSigningOtpMutation = useMutation({
    mutationFn: (phone: string) =>
      apiFetch<{ ok: boolean; devOtp?: string }>('/merchant/client/sign-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }),
  });

  const verifySigningOtpMutation = useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      apiFetch<{ signingToken: string }>('/merchant/client/sign-otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      }),
  });

  return {
    searchClientsMutation,
    sendOtpMutation,
    verifyOtpMutation,
    myidSessionMutation,
    completeMyidMutation,
    sendSigningOtpMutation,
    verifySigningOtpMutation,
    myidSignSessionMutation,
    myidSignCompleteMutation,
  };
}
