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
  phone_pinfl_mismatch: "Этот ПИНФЛ зарегистрирован на другой номер телефона",
  otp_cooldown: "Пожалуйста, подождите перед запросом нового кода",
  otp_daily_limit: "Достигнут дневной лимит запросов кода подтверждения",
  missing_device_id: "Требуется заголовок x-device-id",
  invalid_device_id: "Недопустимый заголовок x-device-id",
  no_account: "Аккаунт не найден",
  myid_integration_failed: "Ошибка при работе с сервисом MyID",
  client_already_registered: "Клиент уже зарегистрирован",
  phone_already_registered: "Этот номер телефона уже зарегистрирован",
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
  invalid_credit_range: "Минимальная сумма не может превышать максимальную",

  // scoring models
  scoring_model_not_found: "Скоринговая модель не найдена",

  // mxik
  mxik_not_found: "Код MXIK не найден",

  // scoring / sessions
  session_not_found: "Сессия не найдена",
  session_not_running: "Сессия не активна",
  scoring_not_found: "Скоринг не найден",
  katm_not_completed: "Запрос КАТМ ещё не завершён",
  client_katm_fields_missing: "Не хватает данных клиента для запроса в КАТМ (адрес, регион, район, тип документа)",
  user_katm_fields_missing: "Не хватает данных для запроса в КАТМ (адрес, регион, район, тип документа)",
  katm_one_id_locked: "Клиент не предоставил доступ к данным через One ID",
  client_credit_banned: "Клиент находится в реестре запрета на кредитование",
  credit_banned: "Вы находитесь в реестре запрета на кредитование",
  katm_report_timeout: "КАТМ не сформировал кредитный отчёт в отведённое время",
  card_scoring_already_started: "Скоринг карты уже запущен",
  user_not_found: "Пользователь не найден",
  version_taken: "Ревизия с такой версией уже существует",

  // deal sessions (wizard)
  session_not_active: "Сессия сделки уже закрыта",
  invalid_step_payload: "Некорректные данные шага",
  session_incomplete: "В сессии заполнены не все шаги — пройдите мастер заново",
  scoring_missing: "Результат скоринга отсутствует в сессии",
  scoring_declined: "Скоринг отклонён — сделка не может быть создана",
}
