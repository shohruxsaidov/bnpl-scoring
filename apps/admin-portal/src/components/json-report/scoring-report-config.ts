import type { ColumnDef, TableConfig } from '@/utils/json-report'

// Section ordering for the two KATM vendor reports, mirroring the mock
// renderers. Section *titles* are resolved via i18n (scoringReport.section.*)
// in the detail view; here we only fix the order and which keys to surface.

export const KATM_077_SECTION_KEYS = [
  'scorring',
  'overview',
  'credit_ban',
  'open_contracts',
  'contracts',
  'contingent_liabilities',
  'credit_requests',
  'claims_wo_contracts',
  'subscriptions',
  'dynamics_of_scoring_ball',
  'blacklist',
]

export const KATM_INPS_SECTION_KEYS = ['incomes', 'donations', 'notifications']

// Russian-leaning labels for the high-value leaf keys across both reports.
// Anything unmapped falls back to a humanized key (see utils/json-report.ts).
export const VENDOR_LABELS: Record<string, string> = {
  // person / client
  pinfl: 'ПИНФЛ',
  name: 'ФИО',
  gender: 'Пол',
  birth_date: 'Дата рождения',
  inn: 'ИНН',
  address: 'Адрес',
  resident: 'Резидентство',
  document_type: 'Документ',
  document_serial: 'Серия',
  document_number: 'Номер',
  document_date: 'Дата выдачи',
  document_type_id: 'Тип документа (код)',
  registration_address: 'Адрес прописки',
  registration_region: 'Регион прописки',
  registration_district: 'Район прописки',
  live_address: 'Адрес проживания',
  client_type_name: 'Тип клиента',
  // scoring
  scoring_grade: 'Скоринговый балл',
  scoring_class: 'Класс',
  scoring_level: 'Уровень',
  scoring_ball: 'Балл',
  scoring_version: 'Версия скоринга',
  // overview
  contracts_qty: 'Кол-во договоров',
  credit_request_qty: 'Кол-во заявок',
  overdue_principal_qty: 'Эпизоды просрочки',
  claims_qty: 'Кол-во обращений',
  subscriptions_qty: 'Кол-во подписок',
  contingent_liabilities_qty: 'Кол-во условных обязательств',
  max_overdue_principal_sum: 'Макс. просроч. осн. долг',
  total_overdue_percent_sum: 'Просроч. проценты (всего)',
  max_overdue_principal_days: 'Макс. дней просрочки (осн. долг)',
  actual_average_monthly_payment: 'Факт. средний платёж/мес',
  max_uninter_overdue_percent_days: 'Макс. непрер. просрочка (проц.), дней',
  // credit ban
  credit_ban_status: 'Статус запрета',
  // income
  period: 'Период',
  orgname: 'Работодатель',
  org_inn: 'ИНН работодателя',
  send_date: 'Дата отправки',
  oper_date: 'Дата операции',
  inps_summa: 'Отчисления (ИНПС)',
  income_summa: 'Зарплата / доход',
  incomes_period_begin: 'Период с',
  incomes_period_end: 'Период по',
  incomes_all_summa: 'Итого доход за период',
  // donations / pension
  total_remain: 'Остаток (всего)',
  voluntary_remain: 'Добровольный остаток',
  forced_remain: 'Обязательный остаток',
  // credit report info
  scoring_katm: 'Скоринг КАТМ',
  scoring_katm_date: 'Дата скоринга КАТМ',
  credit_info: 'Кредитная информация',
  credit_info_date: 'Дата кредитной информации',
  // presence
  report_name: 'Отчёт',
  presence: 'Доступен',
  // mib
  resultCode: 'Код результата',
  resultMessage: 'Сообщение',
  // sysinfo
  date: 'Сформирован',
  bank: 'Банк-запросчик',
  id_demand: 'ID запроса',
  user_id: 'Пользователь',
  claim_id: 'ID заявки',
  branch: 'Филиал',
  claim_date: 'Дата заявки',
  report_code: 'Код отчёта',
  report_name_full: 'Наименование отчёта',
  // contracts / liabilities
  org_name: 'Кредитор',
  org_type: 'Тип организации',
  credit_type_name: 'Тип кредита',
  credit_type: 'Тип кредита (код)',
  currency_name: 'Валюта',
  amount: 'Сумма',
  amount_issued: 'Выдано',
  total_debt_sum: 'Текущий долг',
  overdue_principal_sum: 'Просрочка (осн. долг)',
  overdue_debt_sum: 'Просроченный долг',
  overdue_percent_sum: 'Просроченные проценты',
  immediate_principal_sum: 'Срочный осн. долг',
  immediate_percent_sum: 'Срочные проценты',
  reserve_bal_sum: 'Резерв',
  remaining_limit_sum: 'Остаток лимита',
  unused_limit: 'Неиспользованный лимит',
  discount_sum: 'Дисконт',
  class_asset_quality: 'Класс качества актива',
  security_qty: 'Кол-во обеспечений',
  security_amount: 'Сумма обеспечения',
  contract_status_name: 'Статус',
  contract_status: 'Статус (код)',
  contract_date: 'Дата договора',
  contract_end_date: 'Дата окончания',
  contract_closing_date: 'Дата закрытия',
  monthly_average_payment: 'Платёж в месяц',
  average_monthly_payment: 'Средний платёж/мес',
  all_debt_sum: 'Долг (всего)',
  all_overdue_debt_sum: 'Просрочка (всего)',
  max_overdue_principal: 'Макс. просрочка (осн. долг), дней',
  max_current_overdue: 'Текущая просрочка, дней',
  fio: 'ФИО',
  full_name: 'ФИО',
  // credit requests
  report_type: 'Тип отчёта',
  consent_date: 'Дата согласия',
  demand_date_time: 'Дата запроса',
  // claims without contracts
  summa: 'Сумма',
  percent: 'Ставка',
  credit_duration: 'Срок (мес)',
  rejection_date: 'Дата отказа',
  rejection_reason: 'Причина отказа',
  // nested contract mini-tables
  balance: 'Остатки',
  actual_repayment: 'Фактический график',
  forecasted_payment: 'Прогнозный график',
  security: 'Обеспечение',
  month: 'Месяц',
  begin_sum: 'Остаток на начало',
  end_sum: 'Остаток на конец',
  repayment_date: 'Дата погашения',
  principal_sum: 'Основной долг',
  percent_sum: 'Проценты',
  remaining_principal_sum: 'Остаток осн. долга',
  forecasted_payment_period: 'Период',
  security_type: 'Тип обеспечения',
}

// --- 077 table configs -------------------------------------------------------

// Overview metrics rendered as a key/value table (ordered + formatted).
export const OVERVIEW_FIELDS: ColumnDef[] = [
  { key: 'contracts_qty' },
  { key: 'open_contracts_qty' },
  { key: 'claims_qty' },
  { key: 'credit_request_qty' },
  { key: 'subscriptions_qty' },
  { key: 'contingent_liabilities_qty' },
  { key: 'overdue_principal_qty' },
  { key: 'max_overdue_principal_days' },
  { key: 'max_uninter_overdue_percent_days' },
  { key: 'average_monthly_payment', format: 'money' },
  { key: 'actual_average_monthly_payment', format: 'money' },
  { key: 'max_overdue_principal_sum', format: 'money' },
  { key: 'total_overdue_percent_sum', format: 'money' },
]

// Summary columns for the contracts table; the rest of each contract's fields
// render in the expandable detail row.
export const CONTRACT_COLUMNS: ColumnDef[] = [
  { key: 'org_name' },
  { key: 'credit_type_name' },
  { key: 'amount_issued', format: 'money' },
  { key: 'total_debt_sum', format: 'money' },
  { key: 'overdue_principal_sum', format: 'money' },
  { key: 'contract_status_name' },
  { key: 'contract_date', format: 'date' },
  { key: 'contract_end_date', format: 'date' },
]

// Nested lists surfaced as mini-tables inside an expanded contract row, as
// [wrapperKey, innerArrayKey] paths.
export const CONTRACT_DETAIL_TABLES: [string, string][] = [
  ['balances', 'balance'],
  ['actual_schedule', 'actual_repayment'],
  ['forecasted_schedule', 'forecasted_payment'],
  ['securities', 'security'],
]

export const OPEN_CONTRACTS_TABLE: TableConfig = {
  arrayKey: 'open_contract',
  aggregates: [
    { key: 'all_debt_sum', format: 'money' },
    { key: 'all_overdue_debt_sum', format: 'money' },
    { key: 'average_monthly_payment', format: 'money' },
  ],
  columns: [
    { key: 'org_name' },
    { key: 'currency_name' },
    { key: 'total_debt_sum', format: 'money' },
    { key: 'overdue_debt_sum', format: 'money' },
    { key: 'monthly_average_payment', format: 'money' },
  ],
}

export const CREDIT_REQUESTS_TABLE: TableConfig = {
  arrayKey: 'credit_request',
  sortKeys: ['demand_date_time', 'consent_date'],
  pageSize: 25,
  columns: [
    { key: 'org_name' },
    { key: 'report_type' },
    { key: 'consent_date', format: 'date' },
    { key: 'demand_date_time', format: 'date' },
  ],
}

export const CLAIMS_WO_CONTRACTS_TABLE: TableConfig = {
  arrayKey: 'claim_wo_contract',
  sortKeys: ['claim_date'],
  pageSize: 25,
  columns: [
    { key: 'org_name' },
    { key: 'summa', format: 'money' },
    { key: 'percent', format: 'percent' },
    { key: 'credit_type' },
    { key: 'credit_duration' },
    { key: 'claim_date', format: 'date' },
    { key: 'rejection_date', format: 'date' },
    { key: 'rejection_reason' },
  ],
}

export const CONTINGENT_LIABILITIES_TABLE: TableConfig = {
  arrayKey: 'contingent_liability',
  columns: [
    { key: 'full_name' },
    { key: 'org_name' },
    { key: 'amount', format: 'money' },
    { key: 'total_debt_sum', format: 'money' },
    { key: 'overdue_debt_sum', format: 'money' },
    { key: 'max_overdue_principal', align: 'right' },
    { key: 'contract_date', format: 'date' },
  ],
}

// --- INPS table configs ------------------------------------------------------
// INPS amounts are already in som (no tiyin division).
export const INPS_INCOMES_TABLE: TableConfig = {
  arrayKey: 'income',
  sortKeys: ['period', 'send_date', 'oper_date'],
  columns: [
    { key: 'period', format: 'date' },
    { key: 'orgname' },
    { key: 'org_inn' },
    { key: 'income_summa', format: 'money' },
    { key: 'inps_summa', format: 'money' },
    { key: 'send_date', format: 'date' },
  ],
}
