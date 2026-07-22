export const ru: Record<string, string> = {
  // auth — generic
  unauthorized: 'Требуется авторизация',
  forbidden: 'Доступ запрещён',
  not_found: 'Ресурс не найден',
  internal_error: 'Внутренняя ошибка сервера',

  // auth — admin
  invalid_credentials: 'Неверный логин или пароль',
  invalid_current_password: 'Неверный текущий пароль',
  email_taken: 'Этот email уже зарегистрирован',
  invalid_role: 'Неверная роль',
  last_superadmin: 'Невозможно удалить последнего суперадмина',
  immutable_role: 'Эта роль не изменяется',
  protected_role: 'Эта роль защищена',
  reserved_key: 'Этот ключ зарезервирован',
  key_taken: 'Такой ключ уже существует',
  role_in_use: 'Роль назначена пользователям',
  invalid_feature: 'Неверная функция',
  invalid_platform: 'Неверная платформа',
  escalation_blocked: 'Нельзя повысить права выше собственных',
  target_id_required: 'Требуется ID пользователя',
  invalid_id: 'Неверный идентификатор',
  no_recipients: 'Получатели не найдены',

  // auth — merchant
  invalid_picker_token: 'Неверный токен выбора',
  role_not_allowed: 'Эта роль не разрешена',
  role_not_configured: 'Роль не настроена',

  // auth — client
  phone_taken: 'Этот номер телефона уже зарегистрирован',
  invalid_otp: 'Неверный код подтверждения',
  invalid_reg_token: 'Неверный токен регистрации',
  invalid_step: 'Неверный шаг',
  invalid_pinfl: 'Неверный ПИНФЛ',
  pinfl_taken: 'Этот ПИНФЛ уже зарегистрирован',
  pinfl_mismatch: 'ПИНФЛ не совпадает',
  phone_pinfl_mismatch: 'Этот ПИНФЛ зарегистрирован на другой номер телефона',
  public_offer_not_found: 'Публичная оферта не найдена',
  public_offer_stale: 'Публичная оферта была обновлена, пожалуйста, примите актуальную версию',
  file_required: 'Требуется файл',
  invalid_file_type: 'Допускаются только PDF-файлы',
  invalid_image_type: 'Допускаются только изображения PNG, JPEG или WebP',
  invalid_document_type: 'Допускаются только файлы PDF, PNG или JPEG',
  file_too_large: 'Размер файла слишком большой',
  merchant_logo_not_found: 'Логотип мерчанта не найден',
  invalid_coordinates: 'Широта и долгота должны быть указаны вместе',
  otp_cooldown: 'Пожалуйста, подождите перед запросом нового кода',
  otp_daily_limit: 'Достигнут дневной лимит запросов кода подтверждения',
  otp_attempts_exceeded: 'Слишком много неверных попыток. Запросите новый код',
  otp_required: 'Код подтверждения отправлен на ваш телефон, введите его для входа',
  invalid_reset_token: 'Срок действия запроса на сброс пароля истёк. Начните заново',
  reset_token_device_mismatch: 'Сброс пароля нужно завершить на том же устройстве',
  invalid_pin_reset_token: 'Срок действия запроса на сброс PIN-кода истёк. Начните заново',
  pin_reset_token_device_mismatch: 'Сброс PIN-кода нужно завершить на том же устройстве',
  device_not_trusted: 'Это устройство не подтверждено. Войдите по паролю',
  current_password_required: 'Введите текущий пароль',
  account_locked: 'Аккаунт заблокирован из-за слишком большого числа попыток. Сбросьте пароль',
  missing_device_id: 'Требуется заголовок x-device-id',
  invalid_device_id: 'Недопустимый заголовок x-device-id',
  no_account: 'Аккаунт не найден',
  pin_not_set: 'PIN-код ещё не установлен',
  invalid_pin: 'Неверный PIN-код',
  pin_locked: 'PIN-код заблокирован. Пожалуйста, пройдите повторную проверку через телефон и MyID',
  invalid_session: 'Сессия недействительна или истекла, войдите заново',
  device_not_registered:
    'Это устройство не зарегистрировано. Пройдите полную регистрацию через телефон и MyID',
  myid_integration_failed: 'Ошибка при работе с сервисом MyID',
  client_already_registered: 'Клиент уже зарегистрирован',
  phone_already_registered: 'Этот номер телефона уже зарегистрирован',
  invalid_passport_data:
    'Некорректные паспортные данные. Пожалуйста, проверьте введённую информацию и попробуйте снова.',
  client_pinfl_missing: 'У клиента отсутствует ПИНФЛ',

  // deals
  deal_not_found: 'Договор не найден',
  deal_not_payable: 'По этому договору нет задолженности к оплате',
  payme_not_configured: 'Оплата через Payme временно недоступна',
  invalid_signing_purpose: 'Неверное назначение токена подписи',
  invalid_signing_session: 'Неверная сессия подписи',

  // signing — MyID (личность) сначала, затем OTP (акцепт)
  myid_not_verified: 'Клиент не прошёл верификацию MyID или она устарела',
  otp_not_verified: 'Клиент не подтвердил договор кодом или подтверждение устарело',
  client_step_missing: 'Клиент не выбран',

  // payments
  invalid_date_range: 'Дата начала периода не может быть позже даты окончания',
  overpayment: 'Сумма превышает остаток по договору',
  OVERPAYMENT: 'Сумма превышает остаток по договору',

  // buyouts
  buyout_already_paid: 'Этот выкуп уже оплачен',

  // clients
  client_not_found: 'Клиент не найден',

  // products
  product_not_found: 'Продукт не найден',

  // tariffs
  tariff_not_found: 'Тариф не найден',
  amount_below_tariff_min: 'Сумма корзины меньше минимальной суммы тарифа',
  amount_above_tariff_max: 'Сумма корзины превышает максимальную сумму тарифа',
  invalid_credit_range: 'Минимальная сумма не может превышать максимальную',

  // scoring models
  scoring_model_not_found: 'Скоринговая модель не найдена',

  // mxik
  mxik_not_found: 'Код MXIK не найден',

  // scoring / sessions
  session_not_found: 'Сессия не найдена',
  session_not_running: 'Сессия не активна',
  scoring_not_found: 'Скоринг не найден',
  katm_not_completed: 'Запрос КАТМ ещё не завершён',
  client_katm_fields_missing:
    'Не хватает данных клиента для запроса в КАТМ (адрес, регион, район, тип документа)',
  user_katm_fields_missing:
    'Не хватает данных для запроса в КАТМ (адрес, регион, район, тип документа)',
  katm_one_id_locked: 'Клиент не предоставил доступ к данным через One ID',
  client_credit_banned: 'Клиент находится в реестре запрета на кредитование',
  credit_banned: 'Вы находитесь в реестре запрета на кредитование',
  katm_report_timeout: 'КАТМ не сформировал кредитный отчёт в отведённое время',
  card_scoring_already_started: 'Скоринг карты уже запущен',
  user_not_found: 'Пользователь не найден',
  version_taken: 'Ревизия с такой версией уже существует',

  // deal sessions (wizard)
  session_not_active: 'Сессия сделки уже закрыта',
  invalid_step_payload: 'Некорректные данные шага',
  session_incomplete: 'В сессии заполнены не все шаги — пройдите мастер заново',
  scoring_missing: 'Результат скоринга отсутствует в сессии',
  scoring_declined: 'Скоринг отклонён — сделка не может быть создана',

  // deal signing (myid_not_verified / otp_not_verified / otp_attempts_exceeded above)
  terms_changed: 'Условия сделки изменились после подписания — клиент должен подписать заново',
  otp_send_cap: 'Достигнут лимит отправок кода для этой сделки',
  signing_request_not_found: 'Запрос на подписание больше не активен',
  no_signing_device: 'У клиента нет устройства с установленным приложением',

  // app version / force update
  invalid_version:
    'Неверный формат версии приложения — ожидается MAJOR.MINOR.PATCH (например 1.4.0)',
  min_above_latest:
    'Минимальная версия не может быть выше последней — пользователям будет нечего установить',
  version_confirmation_mismatch: 'Повторите минимальную версию в точности для подтверждения',

  // notifications — errors
  notification_not_found: 'Уведомление не найдено',
  push_disabled: 'Push-уведомления не настроены на сервере',
  no_push_devices: 'У клиента нет устройства с установленным приложением',

  // notifications — push title/body (rendered server-side per device language)
  'notification.scoring_approved.title': 'Скоринг одобрен',
  'notification.scoring_approved.body': 'Вам одобрен кредитный лимит %{creditLimit} сум.',
  'notification.scoring_rejected.title': 'Скоринг отклонён',
  'notification.scoring_rejected.body': 'К сожалению, кредитный лимит пока не одобрен.',
  'notification.limit_updated.title': 'Кредитный лимит обновлён',
  'notification.limit_updated.body': 'Ваш кредитный лимит изменён на %{creditLimit} сум.',
  'notification.payment_received.title': 'Платёж получен',
  'notification.payment_received.body': 'Мы получили ваш платёж на %{amount} сум.',
  'notification.deal_signing_request.title': 'Подпишите договор',
  'notification.deal_signing_request.body':
    '%{merchantName} ждёт подтверждения рассрочки на %{totalPayable} сум. Откройте приложение, чтобы проверить условия.',
  'plumIntegrationErrors.-113': 'Время OTP истек',
  'plumIntegrationErrors.-108': 'Данная карта уже добавлен в системе',
  'plumIntegrationErrors.-101': 'Данные карты введены неправильно',
  'plumIntegrationErrors.-102': 'Неправильный ОТП код',
  'plumIntegrationErrors.-137': 'Введен неправильный код подтверждения',
  'plumIntegrationErrors.-111': 'Пользователь заблокирован из-за превышения лимита OTP',
};
