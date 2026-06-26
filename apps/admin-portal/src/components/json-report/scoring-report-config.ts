// Section ordering for the two KATM vendor reports, mirroring the mock
// renderers. Section *titles* are resolved via i18n (scoringReport.section.*)
// in the detail view; here we only fix the order and which keys to surface.

export const KATM_077_SECTION_KEYS = [
  'client',
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
  'sysinfo',
]

export const KATM_INPS_SECTION_KEYS = [
  'client',
  'incomes_period',
  'incomes',
  'donations',
  'credit_reports_info',
  'presence_reports',
  'notifications',
  'sysinfo',
]

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
  // overview
  contracts_qty: 'Кол-во договоров',
  credit_request_qty: 'Кол-во заявок',
  overdue_principal_qty: 'Эпизоды просрочки',
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
}
