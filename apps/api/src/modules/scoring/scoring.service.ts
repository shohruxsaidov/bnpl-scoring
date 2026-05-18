/** Scoring engine boundary — likeliest future extraction (ADR 0001). */

import type { Score } from "@scoring/types";

export const scoringService = {
  async score(tenantId: string, dealId: string): Promise<Score> {
    void tenantId;
    return {
      dealId,
      modelId: "00000000-0000-0000-0000-0000000000m1",
      value: 720,
      decision: "approved",
      limit: 5_000_000,
      computedAt: new Date().toISOString(),
    };
  },

  async listModels(tenantId: string) {
    void tenantId;
    return [];
  },
};
