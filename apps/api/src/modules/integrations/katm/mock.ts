import type {
  KatmResult,
  RegisterClaimParams,
  RegisterClaimResult,
  ReportOutcome,
} from './service';

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// Deterministic behaviour from the PINFL tail:
//   last 2 digits < 30  → risky profile
//   last 2 digits < 70  → good profile
//   otherwise           → excellent profile
// Special tails:
//   ends with '00'      → active credit ban
//   ends with '77'      → report is async: /credit/report returns 05050,
//                         the first /credit/report/status poll returns it
function profileFromPinfl(pinfl: string): 'excellent' | 'good' | 'risky' {
  const tail = parseInt(pinfl.slice(-2), 10);
  if (tail < 30) return 'risky';
  if (tail < 70) return 'good';
  return 'excellent';
}

function buildResult(pinfl: string, claimId: string): KatmResult {
  const profile = profileFromPinfl(pinfl);
  const today = new Date().toISOString().slice(0, 10);
  const demandId = `MOCK${today.replace(/-/g, '')}${Math.floor(Math.random() * 9000 + 1000)}`;

  const profiles = {
    excellent: {
      score: 780,
      scoringClass: 'B1',
      scoringLevel: 'ХОРОШИЙ',
      activeLoans: 1,
      allDebtSum: 22_966_178,
      overdueCount: 0,
      overdueAmount: 0,
      maxOverdueDays: 0,
      totalContracts: 4,
      totalClaims: 10,
      avgMonthlyPayment: 500_000,
      hasDefaults: false,
      hasCreditBan: false,
    },
    good: {
      score: 550,
      scoringClass: 'C1',
      scoringLevel: 'УДОВЛЕТВОРИТЕЛЬНЫЙ',
      activeLoans: 3,
      allDebtSum: 120_000_000,
      overdueCount: 1,
      overdueAmount: 50_000_000,
      maxOverdueDays: 0,
      totalContracts: 6,
      totalClaims: 10,
      avgMonthlyPayment: 500_000,
      hasDefaults: false,
      hasCreditBan: false,
    },
    risky: {
      score: 424,
      scoringClass: 'A1',
      scoringLevel: 'ОТЛИЧНЫЙ',
      activeLoans: 5,
      allDebtSum: 250_000_000,
      overdueCount: 2,
      overdueAmount: 277_765_021,
      maxOverdueDays: 11,
      totalContracts: 8,
      totalClaims: 10,
      avgMonthlyPayment: 165_876_898,
      hasDefaults: true,
      hasCreditBan: false,
    },
  };

  const p = profiles[profile];

  const raw = {
    sysinfo: {
      report_type: '077',
      report_name: 'InfoScore (JSON)',
      org: 'MOCK',
      branch: '00000',
      demand_id: demandId,
      demand_date_time: new Date().toISOString().replace('T', ' ').slice(0, 16),
      consent_id: '',
      consent_date: today,
      claim_id: claimId,
      claim_date: today,
    },
    client: {
      pinfl,
      name: 'MOCK CLIENT',
      gender: 'M',
      birth_date: '1990-01-01',
    },
    overview: {
      claims_qty: '10',
      contracts_qty: String(p.activeLoans + 3),
      overdue_principal_qty: String(p.overdueCount),
      max_overdue_principal_days: p.hasDefaults ? '11' : '0',
      max_overdue_principal_sum: String(p.overdueAmount),
      average_monthly_payment: '957689',
      actual_average_monthly_payment: '500000',
    },
    scorring: {
      scoring_grade: String(p.score),
      scoring_class: p.scoringClass,
      scoring_level: p.scoringLevel,
      scoring_version: '3.0',
    },
    open_contracts: {
      open_contract: Array.from({ length: p.activeLoans }, (_, i) => ({
        contract_id: `MOCK-CONTRACT-${i + 1}`,
        org_name: ['TBC BANK', 'KAPITALBANK', 'HAMKORBANK'][i % 3],
        total_debt_sum: String(Math.floor(p.allDebtSum / p.activeLoans)),
        overdue_debt_sum: i === 0 && p.overdueCount > 0 ? String(p.overdueAmount) : '0',
      })),
      all_debt_sum: String(p.allDebtSum),
      all_overdue_debt_sum: String(p.overdueAmount),
      average_monthly_payment: '957690',
    },
    credit_ban: {
      credit_ban_status: p.hasCreditBan ? '1' : '0',
      credit_ban_date: '',
    },
  };

  return {
    demandId,
    consentId: '',
    ...p,
    raw,
  };
}
