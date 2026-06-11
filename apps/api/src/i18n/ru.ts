export const ru: Record<string, string> = {
  // auth — generic
  unauthorized: "Требуется авторизация",
  forbidden: "Доступ запрещён",
  not_found: "Ресурс не найден",
  internal_error: "Внутренняя ошибка сервера",

  // auth — admin
  invalid_credentials: "Неверный email или пароль",
  invalid_current_password: "Неверный текущий пароль",
  email_taken: "Этот email уже зарегистрирован",
  invalid_role: "Неверная роль",
  last_superadmin: "Невозможно удалить последнего суперадмина",
  immutable_role: "Эта роль не изменяется",
  protected_role: "Эта роль защищена",
  reserved_key: "Этот ключ зарезервирован",
  key_taken: "Такой ключ уже существует",
  role_in_use: "Роль назначена пользователям",
  invalid_feature: "Неверная функция",
  invalid_platform: "Неверная платформа",
  escalation_blocked: "Нельзя повысить права выше собственных",
  target_id_required: "Требуется ID пользователя",
  invalid_id: "Неверный идентификатор",
  no_recipients: "Получатели не найдены",

  // auth — merchant
  invalid_picker_token: "Неверный токен выбора",
  role_not_allowed: "Эта роль не разрешена",
  role_not_configured: "Роль не настроена",

  // auth — client
  phone_taken: "Этот номер телефона уже зарегистрирован",
  invalid_otp: "Неверный код подтверждения",
  invalid_reg_token: "Неверный токен регистрации",
  invalid_step: "Неверный шаг",
  invalid_pinfl: "Неверный ПИНФЛ",
  pinfl_taken: "Этот ПИНФЛ уже зарегистрирован",
  pinfl_mismatch: "ПИНФЛ не совпадает",
  no_account: "Аккаунт не найден",
  myid_integration_failed: "Ошибка при работе с сервисом MyID",
  client_already_registered: "Клиент уже зарегистрирован",
  client_pinfl_missing: "У клиента отсутствует ПИНФЛ",

  // deals
  deal_not_found: "Договор не найден",
  invalid_signing_token: "Неверный токен подписи",
  invalid_signing_purpose: "Неверное назначение токена подписи",
  invalid_signing_session: "Неверная сессия подписи",

  // payments
  overpayment: "Сумма превышает остаток по договору",
  OVERPAYMENT: "Сумма превышает остаток по договору",

  // clients
  client_not_found: "Клиент не найден",

  // products
  product_not_found: "Продукт не найден",

  // tariffs
  tariff_not_found: "Тариф не найден",
  amount_below_tariff_min: "Сумма корзины меньше минимальной суммы тарифа",
  amount_above_tariff_max: "Сумма корзины превышает максимальную сумму тарифа",

  // scoring models
  scoring_model_not_found: "Скоринговая модель не найдена",

  // mxik
  mxik_not_found: "Код MXIK не найден",

  // scoring / sessions
  session_not_found: "Сессия не найдена",
  session_not_running: "Сессия не активна",
  scoring_not_found: "Скоринг не найден",
  katm_not_completed: "Запрос КАТМ ещё не завершён",
  card_scoring_already_started: "Скоринг карты уже запущен",
  user_not_found: "Пользователь не найден",
  version_taken: "Ревизия с такой версией уже существует",
}
