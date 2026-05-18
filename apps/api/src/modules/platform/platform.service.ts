/** Platform-admin cross-tenant reads and config — no tenant_id filter. */

import type { Deal, Employee } from "@scoring/types";

export type IntegrationHealth = "operational" | "degraded" | "down";

export interface IntegrationStatus {
  key: string;
  label: string;
  health: IntegrationHealth;
  detail: string;
}

export interface PlatformConfigItem {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  numeric: boolean;
}

export const platformService = {
  async listDeals(): Promise<Deal[]> {
    return [];
  },

  async listEmployees(): Promise<Employee[]> {
    return [];
  },

  async getIntegrations(): Promise<IntegrationStatus[]> {
    return [
      { key: "myid", label: "MyID", health: "operational", detail: "All systems nominal" },
      { key: "katm", label: "KATM", health: "operational", detail: "All systems nominal" },
      { key: "plumgate", label: "PlumGate", health: "operational", detail: "All systems nominal" },
      { key: "payme", label: "Payme", health: "operational", detail: "All systems nominal" },
      { key: "click", label: "Click", health: "operational", detail: "All systems nominal" },
    ];
  },

  async getConfig(): Promise<PlatformConfigItem[]> {
    return [
      { key: "scoring_timeout_sec", label: "Scoring timeout", value: 30, unit: "s", numeric: true },
      { key: "otp_expiry_sec", label: "OTP expiry", value: 120, unit: "s", numeric: true },
      { key: "max_active_deals_per_client", label: "Max active deals per client", value: 3, numeric: true },
    ];
  },

  async updateConfig(
    patch: Record<string, string | number>,
  ): Promise<PlatformConfigItem[]> {
    void patch;
    return this.getConfig();
  },
};
