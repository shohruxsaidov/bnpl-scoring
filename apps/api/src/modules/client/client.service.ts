/** Client-portal endpoints — scoped to the authenticated client (client JWT). */

import type { Deal } from "@scoring/types";

export type NotificationKind = "overdue" | "payment" | "deal";

export interface ClientNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface ClientDeal extends Deal {
  merchant: string;
  tariffLabel: string;
  markupPercent: number;
  paymentsMade: number;
  paymentsTotal: number;
  nextPaymentDate: string | null;
  nextPaymentAmount: number;
  overdueSince?: string;
  schedule: Array<{
    no: number;
    dueDate: string;
    amount: number;
    status: "paid" | "upcoming" | "overdue";
    paidVia?: string;
  }>;
  payments: Array<{
    id: string;
    date: string;
    amount: number;
    provider: string;
    txnId: string;
  }>;
  contract: {
    number: string;
    signed: boolean;
    signedAt: string;
    myIdVerified: boolean;
  };
}

export const clientService = {
  async listDeals(_clientId: string): Promise<ClientDeal[]> {
    return [];
  },

  async getDeal(_clientId: string, _dealId: string): Promise<ClientDeal | null> {
    return null;
  },

  async listNotifications(_clientId: string): Promise<ClientNotification[]> {
    return [];
  },

  async markNotificationRead(
    _clientId: string,
    _notificationId: string,
    _read: boolean,
  ): Promise<ClientNotification | null> {
    return null;
  },

  async markAllNotificationsRead(_clientId: string): Promise<void> {
    // no-op stub
  },
};
