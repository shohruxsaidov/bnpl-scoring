/** Wizard Session management — ties OTP card scoring flow and SSE to a session. */

import type { WizardSession } from "@scoring/types";

export interface CardOtpCreateResult {
  plumgateSessionId: string;
  network: "uzcard" | "humo";
  expiresInSec: number;
}

export interface CardOtpConfirmResult {
  score: number | null;
  decision: "approved" | "declined" | "manual_review";
  limit: number;
  skipped: boolean;
}

export const wizardService = {
  async createSession(tenantId: string, agentId: string): Promise<WizardSession> {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      tenantId,
      agentId,
      dealId: null,
      currentStep: "client",
      steps: [
        { key: "client", label: "Клиент", status: "pending", error: null },
        { key: "card", label: "Karta", status: "pending", error: null },
        { key: "tariff", label: "Tarif", status: "pending", error: null },
        { key: "product", label: "Mahsulot", status: "pending", error: null },
        { key: "payment_day", label: "To'lov kuni", status: "pending", error: null },
        { key: "verification", label: "Верификация", status: "pending", error: null },
        { key: "done", label: "Готово", status: "pending", error: null },
      ],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  },

  async cardCreate(
    _tenantId: string,
    _sessionId: string,
    _input: { pinfl: string; network: "uzcard" | "humo" },
  ): Promise<CardOtpCreateResult> {
    return {
      plumgateSessionId: crypto.randomUUID(),
      network: _input.network,
      expiresInSec: 120,
    };
  },

  async cardConfirm(
    _tenantId: string,
    _sessionId: string,
    _input: { plumgateSessionId: string; otp: string },
  ): Promise<CardOtpConfirmResult> {
    return {
      score: 720,
      decision: "approved",
      limit: 8_000_000_00,
      skipped: false,
    };
  },
};
