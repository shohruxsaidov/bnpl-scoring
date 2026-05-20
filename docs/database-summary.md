# База данных — подробное описание (all.sql)

Монолитный дамп нескольких микросервисов (финансы, скоринг, CRM, каталог). Каждый микросервис имеет свою схему миграций (`sys.migrations`). Некоторые таблицы дублируются в дампе из-за нескольких точек выгрузки.

- Общий размер файла: ~500 МБ (~9 млн строк)
- Дата дампа / актуальность данных: **2026-05-16** (последние строки `scoring_sessions`)
- Архитектура: несколько микросервисов, схемы `public.*`, `sys.*`, `repmgr.*`

---

## Автоплатежи и транзакции (autopayment)

### `auto_payment_states` — **4 500 825 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `auto_payment_id` | uuid FK→auto_payments | — |
| `payed_amount` | numeric | Сумма оплаты |
| `balance_amount` | numeric | Остаток после оплаты |
| `status` | integer | Статус операции |
| `date` | timestamp | Дата события |
| `is_deleted` | boolean | Мягкое удаление |

### `auto_payments` — **1 500 445 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `contract_id` | uuid | Ссылка на договор |
| `amount` | numeric | Сумма платежа |
| `date` | timestamp | Дата автоплатежа |
| `schedule_date` | date | Плановая дата по графику |
| `type` | integer | Тип (0=обычный, ...) |
| `is_deleted` | boolean | Мягкое удаление |

### `request_histories` — **1 524 788 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigint PK (identity) | — |
| `created_date` | timestamp | Дата HTTP-запроса |
| `user_id` | bigint | Идентификатор пользователя |
| `request` | text | Тело запроса |
| `response` | text | Тело ответа |
| `url` | text | URL-эндпоинт |
| `is_success` | boolean | Успех/ошибка |

---

## Скоринг клиентов (scoring)

> **Диапазон данных:** 2024-02-21 → 2026-05-16

### `scoring_sessions` — **16 357 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `identificator_id` | uuid FK→identificators | ПИНФЛ клиента |
| `provider_id` | uuid FK→providers | Провайдер скоринга |
| `provider_identifier` | text | Внешний ID заявки (например `978b8d1d3e`) |
| `type` | integer | Тип сессии (0=стандартный) |
| `data` | jsonb | Снапшот данных клиента: Age, Sex, Phone, Pinfl, Address, ClaimId, ClientId, LastName, FirstName, MiddleName, DateBirth, DocNumber, DocSeries, RegionId, Citizenship, ConfirmationId |
| `created_at` | timestamp | Дата запуска скоринга |
| `is_deleted` | boolean | Мягкое удаление |
| `card_identificator_id` | uuid | Идентификатор карты (опционально) |
| `initiator` | integer | 0=агент, 1=другой |

### `scores` — **2 996 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `provider_id` | uuid FK→providers | — |
| `score_session_id` | uuid FK→scoring_sessions | — |
| `identifier` | text | ПИНФЛ (nullable) |
| `points` | numeric | Итоговый балл |
| `enable_sum` | numeric | Одобренная сумма |
| `created_at` | timestamp | Дата расчёта |
| `expires_date` | timestamp | Срок действия скора |
| `scoring_model` | jsonb | Модель скоринга (параметры) |
| `is_deleted` | boolean | — |

### `info` — **219 412 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `score_session_id` | uuid FK→scoring_sessions | — |
| `created_at` | timestamp | Дата получения данных |
| `type_key` | text | Тип данных (см. ниже) |
| `data` | jsonb | Полезная нагрузка |
| `source` | text | Источник |
| `is_deleted` | boolean | — |

**Известные значения `type_key`:**
`IncomeLevelInfo`, `PassportInfo`, `PeriodInfo`, `DebtSumInfo`, `InfoScoreContractInfo`,
`PledgerLiabilityInfo`, `GuarantorLiabilityInfo`, `CoBorrowerLiabilityInfo`,
`ContingentLiabilityInfo`, `MortgageInfo`, `JuridicalInfo`, `DecommissionInfo`,
`LoanApplicationInfo`, `MonthlyAveragePaymentInfo`, `AveragePaymentInfo`,
`ExternalAddressInfo`, `CitizenshipInfo`, `BpiInfo`, `WaterInfo`, `ElectricityInfo`

### `info_scores` — **230 256 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `info_id` | uuid FK→info | — |
| `score` | numeric | Балл по показателю |
| `category` | text | Категория |
| `value` | text | Значение показателя |
| `source` | text | Источник данных |
| `description` | text | Описание (nullable) |
| `created_at` | timestamp | Дата расчёта |
| `is_deleted` | boolean | — |

### `score_states` — **62 186 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `score_session_id` | uuid FK→scoring_sessions | — |
| `contract_ids` | text[] | Массив ID договоров |
| `code` | text | Код состояния (nullable) |
| `status` | integer | Текущий статус |
| `created_at` | timestamp | Дата смены статуса |
| `provider_id` | uuid | — |
| `is_deleted` | boolean | — |

**Ключевые вьюхи скоринга:**
- `"Scoring_info"` — сводная таблица: сессия + ПИНФЛ + все `info` через LATERAL JOIN
- `"Scoring_base"` — упрощённый вариант: сессия, ПИНФЛ, баллы, одобренная сумма
- `scoring_sessions_enriched` — агрегация основных `info` типов
- `"Scoring JSOn"` — плоский вывод для экспорта

---

## Пользователи и идентификация (ident, finsumid)

### `identificators` (ident-сервис) — **48 424 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `identification_id` | uuid FK→identifications | — |
| `identifier` | text | ПИНФЛ |
| `type` | integer | Тип идентификатора |
| `doc_identifier` | text | Номер документа |
| `doc_type` | integer | Тип документа |
| `doc_issued_date` | date | Дата выдачи |
| `doc_expire_date` | date | Срок действия |
| `doc_issued_by` | text | Кем выдан |
| `address` | text | Адрес прописки |
| `region_id` | bigint | Регион прописки |
| `temp_region_id` | bigint | Регион временной прописки |
| `created_at` | timestamp | Дата создания записи |
| `updated_at` | timestamp | Дата обновления |
| `inactive_at` | timestamp | Дата деактивации (nullable) |
| `all_data` | jsonb | Полный ответ от провайдера |
| `is_deleted` | boolean | — |

### `identifications` — **20 724 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `identifier` | text | ПИНФЛ или ID клиента |
| `agent_id` | uuid | Агент (nullable) |
| `p_identifier` | text | Внешний идентификатор |
| `provider_id` | uuid FK→providers | — |
| `user_id` | bigint FK→users | — |
| `data` | jsonb | Ответ провайдера (nullable) |
| `is_deleted` | boolean | — |

### `identification_files` — **20 672 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `identification_id` | uuid FK→identifications | — |
| `type` | integer | Тип файла (0=фото документа) |
| `format` | integer | Формат (0=JPEG) |
| `src` | text | Путь: `/ident/{org_id}/{hash}.Jpeg` |
| `is_deleted` | boolean | — |

### `personal_info` — **20 170 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `identificator_id` | uuid FK→identificators | — |
| `first_name` | text | Имя (кириллица) |
| `last_name` | text | Фамилия (кириллица) |
| `middle_name` | text | Отчество (nullable) |
| `birth_date` | date | Дата рождения |
| `nationality_id` | bigint | Национальность |
| `citizenship_id` | bigint | Гражданство |
| `gender` | integer | Пол |
| `first_name_en` | text | Имя (латиница) |
| `last_name_en` | text | Фамилия (латиница) |
| `mrz` | text | MRZ-строка паспорта |
| `is_deleted` | boolean | — |

### `users` — **21 829 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigint PK (identity) | — |
| `first_name` / `last_name` | text | ФИО |
| `user_name` | varchar(256) | Логин |
| `email` | varchar(256) | Email |
| `phone_number` | text | Телефон |
| `password_hash` | text | Хэш пароля (ASP.NET Identity) |
| `lockout_end` | timestamptz | Блокировка до (nullable) |
| `lockout_enabled` | boolean | Разрешена ли блокировка |
| `access_failed_count` | integer | Кол-во неудачных входов |
| `two_factor_enabled` | boolean | 2FA |

### `user_tokens` — **18 138 строк**

Токены ASP.NET Identity (refresh-токены, 2FA-коды). Хранит `user_id`, `login_provider`, `name`, `value`.

---

## Счета и операции (accountingdb)

### `activities` — **68 571 строк**

> **Диапазон данных:** 2024-02-21 → актуально

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `user_id` | bigint FK→users | — |
| `initiator` | integer | Тип инициатора (3=агент, 6=система, ...) |
| `target_id` | text | ID цели действия |
| `phone` | text | Телефон клиента |
| `secret` | text | OTP-код |
| `date` | timestamptz | Дата активности |
| `intent_key` | text | Тип операции: `AgentClientSession`, `AgentAgreementConfirm`, `AgentContractConfirm`, `Invoice`, `AgentConfirmAct` |
| `data` | jsonb | Контекст (Sum, DealId, ContractNumber, InvoiceDocUrl, ...) |
| `is_deleted` | boolean | — |

### `accounts` — **31 296 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigint PK (identity) | — |
| `type` | text | Тип счёта |
| `identifier` | text | Идентификатор владельца |
| `owner_type` | integer | Тип владельца |
| `upper_id` | bigint | Родительский счёт (nullable) |
| `data` | jsonb | Дополнительные атрибуты (nullable) |
| `is_deleted` | boolean | — |

### `operation_records` — **25 448 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigint PK (identity) | — |
| `amount` | bigint | Сумма (в тийинах) |
| `currency` | integer | Валюта (860=UZS) |
| `operation_id` | bigint FK→operations | — |
| `mode` | integer | Дебет/кредит |
| `account_id` | bigint FK→accounts | — |
| `associate_id` | bigint | Контрсчёт |
| `is_deleted` | boolean | — |

### `ext_transactions` — **1 013 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigint PK (identity) | — |
| `operation_id` | bigint FK→operations | — |
| `src` | integer | Источник (провайдер) |
| `type` | varchar(32) | Тип транзакции |
| `identifier` | varchar(64) | Внешний идентификатор |
| `date_time` | timestamptz | Время транзакции |
| `amount` | bigint | Сумма |
| `currency` | integer | Валюта |
| `data` | jsonb | Дополнительные данные |
| `is_deleted` | boolean | — |

---

## Сделки (dealer, contracts)

> **Диапазон данных:** 2024-08-21 → актуально

### `deals` — **3 609 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigint PK (identity) | — |
| `agent_id` | uuid | Агент-владелец сделки |
| `is_deleted` | boolean | — |

> Вся содержательная информация — в связанных таблицах состояний.

### `deal_states` — **16 664 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `deal_id` | bigint FK→deals | — |
| `created_at` | timestamptz DEFAULT now() | Дата смены статуса |
| `pay_day` | smallint | День платежа в месяце |
| `pay_start_date` | date | Дата первого платежа |
| `deal_status` | enum(deal_status) | Статус сделки |
| `note` | text | Комментарий (nullable) |
| `reason` | integer | Причина смены статуса |
| `processing_valid_until` | timestamptz | Срок обработки (nullable) |
| `is_deleted` | boolean | — |

### `deal_agents` — **3 428 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `agent_id` | uuid | Агент |
| `deal_id` | bigint FK→deals | — |
| `managed_agent_id` | uuid | Управляющий агент |
| `created_at` | timestamptz | Дата назначения агента |
| `is_deleted` | boolean | — |

### `deal_clients` — **1 014 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `client_id` | text | Внешний ID клиента |
| `type` | integer | Роль клиента в сделке |
| `deal_id` | bigint FK→deals | — |
| `identificator_id` | uuid | — |
| `identifier` | text | ПИНФЛ |
| `scoring_id` | uuid FK→scoring_sessions | — |
| `score` | numeric | Балл на момент сделки |
| `enable_sum` | numeric | Одобренная сумма на момент сделки |
| `data` | jsonb | Доп. данные (nullable) |
| `is_deleted` | boolean | — |

### `deal_items` — **3 903 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `deal_id` | bigint FK→deals | — |
| `merchant_id` | uuid | Мерчант |
| `category_id` | bigint FK→categories | — |
| `name` | jsonb | Название (мультиязычное) |
| `sku` | text | Артикул |
| `product_code` | text | Код товара |
| `unit_code` | text | Единица измерения (код) |
| `unit` | text | Единица измерения (текст) |
| `buy_identifier` | text | Идентификатор выкупа (nullable) |
| `data` | jsonb | Доп. атрибуты (nullable) |
| `is_deleted` | boolean | — |

### `deal_fin_states` — **8 625 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `deal_id` | bigint FK→deals | — |
| `deal_item_id` | uuid FK→deal_items (nullable) | — |
| `created_at` | timestamptz DEFAULT now() | — |
| `status` | enum(deal_fin_status) | Финансовый статус |
| `fin_product_id` | uuid | Финансовый продукт |
| `fin_term_id` | bigint | Условие |
| `term_duration` | integer | Срок (в единицах term_type) |
| `term_type` | enum(term_type) | Тип срока (месяцы / дни) |
| `deal_type` | enum(deal_type) | — |
| `product_source` | enum(product_source) | — |
| `prepay` | numeric | Первоначальный взнос |
| `sum` | numeric | Сумма финансирования |
| `vat` | numeric | НДС |
| `currency` | integer | — |
| `is_deleted` | boolean | — |

### `deal_item_states` — **5 474 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `deal_item_id` | uuid FK→deal_items | — |
| `serials` | text[] | Серийные номера товара |
| `count` | integer | Количество |
| `quantity` | numeric | Количество (nullable) |
| `price` | numeric | Цена |
| `vat` | numeric | НДС |
| `m_init_price` / `m_price` / `m_vat` | numeric | Цены в валюте мерчанта |
| `currency` / `m_currency` | integer | Валюты |
| `created_at` | timestamptz DEFAULT now() | — |
| `status` | enum(deal_item_status) | — |
| `is_deleted` | boolean | — |

### `contracts` — **851 строк** / `contract_states` — **771 строк** / `contract_docs` — **831 строк**

Договоры по сделкам. `contracts`: `amount`, `identifier`, `expire_date`, `date`, `client_id`, `client_type`.

### `deal_refs` — **1 161 строк** / `deal_schedules` — **771 строк** / `confirmations` — **65 523 строк**

- `deal_refs` — внешние ссылки сделки (тип через `deal_ref_type` enum)
- `deal_schedules` — параметры графика (срок, день платежа, тип расписания)
- `confirmations` — OTP-подтверждения по договорам (`service_identifier`, `contract_id`)

---

## Платежи (payme, bankingdb, payment, plum, clientbanking)

### `payments` (payme) — **5 834 строк**

> **Диапазон данных:** 2024-05-21 → 2025-01-04

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigint PK (identity) | — |
| `payme_transaction_id` | varchar(24) | ID транзакции Payme |
| `amount` | numeric | Сумма |
| `deal_id` | bigint FK→deals | — |
| `is_acknowledged` | boolean | Подтверждён |
| `state` | integer | Статус (2=завершён) |
| `cancel_reason` | integer | Причина отмены (nullable) |
| `created_at` | timestamp | Создан |
| `performed_at` | timestamp | Выполнен (nullable) |
| `cancelled_at` | timestamp | Отменён (nullable) |
| `is_deleted` | boolean | — |

### `payment` — **29 192 строк** / `payment_orders` — **292 строк** / `payment_items` — **321 строк**

Платежи другого сервиса (`payment_orders`->`payment`->`payment_items`).

### `client_payments` — **975 строк** / `plum_payments` — **1 397 строк**

Платежи через клиентское приложение и через Plum.

---

## Графики и просрочки (schedule, overdue)

### `schedules` — **6 809 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `deal_id` | bigint FK→deals | — |
| `date` | date | Плановая дата платежа |
| `amount` | numeric | Сумма по графику |
| `currency` | integer | — |
| `provider_id` | uuid | — |
| `is_deleted` | boolean | — |

### `schedule_states` — **11 413 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `schedule_id` | uuid FK→schedules | — |
| `status` | integer | Статус строки графика |
| `remaining_amount` | numeric | Остаток к оплате |
| `covered_amount` | numeric | Оплачено |
| `created` | timestamptz | Дата смены статуса |
| `is_deleted` | boolean | — |

### `overdues` — **3 640 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigint PK (identity) | — |
| `schedule_id` | uuid FK→schedules | — |
| `deal_id` | bigint FK→deals | — |
| `date` | date | Дата наступления просрочки |
| `amount` | bigint | Сумма просрочки |
| `schedule_amount` | numeric | Плановая сумма платежа |
| `schedule_summ` | numeric | Итоговая сумма |
| `is_deleted` | boolean | — |

### `overdue_states` — **9 338 строк**

> **Диапазон данных:** 2024-05-20 → 2025-03-11

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `overdue_id` | bigint FK→overdues | — |
| `status` | integer | 0=активна, 2=погашена, 3=отменена |
| `date` | timestamptz | Дата смены статуса |
| `covered_amount` | bigint | Покрыто |
| `remaining_amount` | bigint | Остаток |
| `is_deleted` | boolean | — |

### `repayment_histories` — **4 204 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `deal_id` | bigint FK→deals | — |
| `identifier` | text | ПИНФЛ |
| `amount` | bigint | Сумма погашения |
| `end_balance` | bigint | Остаток после погашения |
| `created_at` | timestamp | Дата записи |
| `repayment_date` | timestamp | Дата погашения |
| `is_deleted` | boolean | — |

---

## Банковские карты (cards)

### `cards` — **9 174 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `provider` | integer | Провайдер (Uzcard, Humo, ...) |
| `user_id` | bigint FK→users | — |
| `phone_number` | text | Телефон |
| `service_identifier` | text | ID в системе провайдера |
| `owner` | text | Имя владельца (nullable) |
| `card_name` | text | Название карты (nullable) |
| `masked_number` | text | Маскированный номер |
| `is_trusted` | boolean | Доверенная карта |
| `balance` | numeric | Баланс (nullable) |
| `expire_date` | text | Срок действия (nullable) |
| `status` | integer | Статус (nullable) |
| `card_session_id` | uuid FK→sessions | — |
| `is_deleted` | boolean | — |

### `sessions` (карточные) — **10 155 строк**

`provider`, `user_id`, `phone_number`, `provider_key` — сессия верификации карты.

---

## Уведомления и активность (accountingdb)

### `messages` — **5 355 строк**

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | — |
| `activity_id` | uuid FK→activities | — |
| `to` | text[] | Получатели (телефоны / emails) |
| `type` | integer | Канал (SMS=0, Email=1, ...) |
| `date` | timestamptz | Дата отправки |
| `content` | text | Текст сообщения |
| `is_deleted` | boolean | — |

---

## Каталог товаров (catalog)

| Таблица | Строк | Ключевые колонки |
|---|---|---|
| `products` | **65 808** | `id`, `sku`, `category_id`, `unit_id`, `data(jsonb)`, `is_deleted` |
| `product_locales` | **197 424** | `product_id`, `locale_key`, `title`, `description` |
| `inventory` | **9 162** | `product_id`, `merchant_id`, `quantity`, `price`, `is_deleted` |
| `categories` | **42** | `id`, `parent_id`, `is_deleted` |
| `category_locales` | **126** | `category_id`, `locale_key`, `title` |

---

## Банки и финансовые организации (platform)

| Таблица | Строк | Ключевые колонки |
|---|---|---|
| `banks` | **145** | `id`, `code`, `is_deleted` |
| `bank_locale` | **435** | `bank_id`, `locale_key`, `title` |
| `bank_filials` | **6 843** | `id`, `bank_id`, `code`, `mfo`, `region_id`, `is_deleted` |
| `bank_filial_locales` | **14 191** | `filial_id`, `locale_key`, `title`, `address` |
| `bank_accounts` | **90** | `id`, `bank_id`, `number`, `currency`, `is_deleted` |

---

## Прочее

| Таблица | Строк | Описание |
|---|---|---|
| `reports` | **30 988** | Отчёты: `deal_id`, `identifier`, `date`, `type`, `data(jsonb)` |
| `agreements` | **2 032** | Соглашения клиентов |
| `regions` | **443** | Регионы Узбекистана (id, parent_id, locales) |
| `orgs` | **89** | Организации: `inn`, `name`, `region_id` |
| `merchants` | **192** | Мерчанты: `id`, `org_id`, `name`, `is_deleted` |
| `messages` | **5 355** | SMS/Email уведомления |
| `film` / `film_actor` | **2 000 / 10 924** | Тестовые данные (Sakila DB) — не используются |

---

## Связи между таблицами (основные)

```
identificators (ПИНФЛ)
  └─► scoring_sessions
        ├─► scores           (итоговый балл)
        ├─► score_states     (история статусов)
        └─► info             (детальные данные по типам)
              └─► info_scores

deals
  ├─► deal_states            (история статусов)
  ├─► deal_agents            (агенты)
  ├─► deal_clients           (клиенты + scoring_sessions)
  ├─► deal_items             (товары)
  │     └─► deal_item_states
  ├─► deal_fin_states        (финансовые условия)
  ├─► deal_refs              (внешние ссылки)
  ├─► deal_schedules         (параметры графика)
  ├─► schedules              (строки графика)
  │     └─► schedule_states
  ├─► overdues               (просрочки)
  │     └─► overdue_states
  ├─► repayment_histories
  └─► payments (payme)

users
  ├─► identifications
  │     └─► identificators (ident) → personal_info, identification_files
  ├─► cards → sessions
  └─► activities → messages

auto_payments → auto_payment_states
contracts → contract_states, contract_docs
```

---

## Диапазоны дат по ключевым таблицам

| Таблица | Первая запись | Последняя запись |
|---|---|---|
| `scoring_sessions` | 2024-02-21 | **2026-05-16** |
| `activities` | 2024-02-21 | актуально |
| `deal_agents` | 2024-08-21 | актуально |
| `payments` (payme) | 2024-05-21 | 2025-01-04 |
| `overdue_states` | 2024-05-20 | 2025-03-11 |
| `auto_payment_states` | — | — |

---

## Итоги

- Общий размер файла: ~500 МБ (~9 млн строк SQL)
- Самые тяжёлые таблицы: `auto_payment_states` (~4.5 млн), `auto_payments` (~1.5 млн), `request_histories` (~1.5 млн)
- Скоринговый кластер: ~530 тыс. строк суммарно, данные до **2026-05-16**
- Все таблицы используют `is_deleted` для мягкого удаления
- Большинство UUID-таблиц без `created_at` полагаются на связанные `*_states` таблицы для хронологии
- Дата анализа: 2026-05-20
