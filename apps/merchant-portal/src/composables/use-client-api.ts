import { useMutation } from '@tanstack/vue-query';
import { apiFetch } from '@/utils/apiFetch';
import type { SessionSigning } from '@/composables/use-deal-session-api';
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

  // ── Kontrakt signing: MyID (identity) first, then the акцепт OTP ───────────
  // Both proofs are stamped onto the Deal Session server-side and read back off it
  // at deal creation — nothing is carried in the browser between them.

  const myidSignSessionMutation = useMutation({
    mutationFn: (dealSessionId: string) =>
      // No pinfl in the body: the server takes it from the session's client, so a
      // scan by anyone else cannot be attached to this deal.
      apiFetch<{ signingSessionToken: string; redirectUrl: string }>(
        `/merchant/deal-sessions/${dealSessionId}/myid-sign`,
        { method: 'POST' },
      ),
  });

  const myidSignCompleteMutation = useMutation({
    mutationFn: ({
      dealSessionId,
      ...body
    }: {
      dealSessionId: string;
      signingSessionToken: string;
      myidCode: string;
    }) =>
      apiFetch<{ verified: boolean; signing: SessionSigning }>(
        `/merchant/deal-sessions/${dealSessionId}/myid-sign/complete`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
  });

  const sendSigningOtpMutation = useMutation({
    mutationFn: (dealSessionId: string) =>
      apiFetch<{ ok: boolean; devOtp?: string }>(
        `/merchant/deal-sessions/${dealSessionId}/sign-otp`,
        { method: 'POST' },
      ),
  });

  // The акцепт now builds the deal too, so this response carries the outcome: the
  // agent is not asked to confirm what the client has already signed. `deal` and
  // `dealCreationError` are mutually exclusive, and exactly one is set.
  const verifySigningOtpMutation = useMutation({
    mutationFn: ({ dealSessionId, code }: { dealSessionId: string; code: string }) =>
      apiFetch<{
        ok: boolean;
        signing: SessionSigning;
        deal: { id: string; number: number | null } | null;
        dealCreationError: string | null;
      }>(`/merchant/deal-sessions/${dealSessionId}/sign-otp/verify`, {
        method: 'POST',
        body: JSON.stringify({ code }),
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
