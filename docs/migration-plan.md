# План миграции: Legacy → Comfort Scoring

**Дата:** 18 мая 2026  
**Версия:** 1.0

---

## 1. Текущее состояние

### 1.1 Legacy-система (db_viz.html)

Существующая платформа состоит из **26 микросервисных баз данных**, построенных на .NET (IdentityServer4 / Entity Framework Core):

| База данных | Назначение | Ключевые таблицы |
|---|---|---|
| `finsumid` | Auth / Identity Server | users, roles, user_roles, persisted_grants |
| `finance` | Мерчанты, продукты, тарифы | merchants, shops, fin_products, fin_terms, merchant_agents |
| `dealer` | Сделки (core) | deals, deal_states, deal_clients, deal_items, deal_fin_states |
| `scoring` | Скоринговый движок | scoring_sessions, scores, info_scores, providers, identifier_blacklists |
| `scoring_cache` | Кэш скоринга | identificators, reports |
| `ident` | Идентификация (MyID) | identificators, personal_info, identifications, providers |
| `cards` | Карты (PlumGate) | cards, sessions |
| `agreement` | Договоры | agreements, agreement_items, approvements |
| `contracts` | Контракты с подписями | contracts, contract_docs, confirmations, cancellation |
| `schedule` | Платёжный график | schedules, deal_schedules, schedule_states |
| `overdue` | Просрочки | overdues, overdue_states |
| `payment` | Платежи (core) | payments, payment_states |
| `payme` | Интеграция Payme | payments |
| `plum` | Интеграция PlumGate | plum_payments |
| `clientbanking` | Оплата клиентом | client_payments |
| `accountingdb` | Бухгалтерия / ledger | operations, accounts, ext_transactions |
| `bankingdb` | Банковские операции | payment_orders, payment_items |
| `intent` | OTP / подтверждения | intents, confirmations, messages |
| `invoice` | Инвойсы | invoices, invoice_items |
| `buyout` | Выкуп / buyout | buys, buy_states |
| `refund` | Возвраты | refund_payments, refund_transfers |
| `autopayment` | Автоплатёж | auto_payments, contracts, clients |
| `catalog` | Справочник товаров | products, categories, units |
| `platform` | Банки, регионы | banks, orgs, regions, card_bins |
| `report` | Отчёты | reports, report_requests |
| `background_jobs` | Фоновые задачи | jobs, states |

### 1.2 Новая система (apps/api)

Новый бэкенд — **Node.js / TypeScript / Fastify** с упрощённой доменной моделью:

| Модуль | Файлы | Статус |
|---|---|---|
| `auth` | agent.routes, client.routes, platform.routes | Роутинг создан |
| `tenants` | tenants.schema, tenants.service, tenants.routes | Схема + сервис есть |
| `employees` | employees.schema, employees.service, employees.routes | Схема + сервис есть |
| `clients` | clients.schema, clients.service, clients.routes | Схема + сервис есть |
| `deals` | deals.schema, deals.service, deals.routes | Схема + сервис есть |
| `tariffs` | tariffs.service, tariffs.routes | Сервис есть, схема отсутствует |
| `products` | products.service, products.routes | Сервис есть, схема отсутствует |
| `scoring` | scoring.service, scoring.routes | Сервис есть, схема отсутствует |
| `payments` | payments.service, payments.routes | Сервис есть, схема отсутствует |

---

## 2. Карта соответствия: Legacy → Новые модули

```
finsumid (users/roles)          →  auth + employees
finance (merchants/fin_products/fin_terms) → tenants + products + tariffs
dealer (deals/states)           →  deals
ident (identificators)          →  clients
scoring (sessions/scores)       →  scoring
cards                           →  clients + scoring
agreement + contracts           →  deals (documents)
schedule + overdue              →  payments
payment + payme + plum          →  payments
intent (OTP)                    →  auth
catalog                         →  products (справочник)
platform                        →  shared/reference
accountingdb + bankingdb        →  payments (ledger, Phase 3+)
invoice + buyout + refund       →  Phase 3 (не входит в v1)
autopayment                     →  Phase 3 (не входит в v1)
report                          →  analytics (Phase 3+)
```

---

## 3. Анализ пробелов (Gap Analysis)

### 3.1 Критические пробелы (блокируют v1)

| # | Пробел | Legacy-источник | Что нужно добавить |
|---|---|---|---|
| G1 | Скоринговая модель на мерчанта | `finance.fin_products.scoring_model` (text) | В `tariffs` нужна структура весов скоринга (jsonb) с UI для настройки |
| G2 | КАТМ-согласие per-deal | `scoring.scoring_sessions.initiator` | В `deals.schema` нужно поле `katmConsentAt` для подтверждения по закону №301 |
| G3 | Корзина товаров | `dealer.deal_items` | В `deals` нужны `dealItems[]` (sku, price, count) |
| G4 | История статусов сделки | `dealer.deal_states` (state machine) | В `deals` нужна таблица `deal_events` или `deal_status_history` |
| G5 | Роль-переключение | `finsumid.user_roles` | В `employees` нужна поддержка нескольких ролей + `activeRole` в JWT |
| G6 | SMS OTP для клиента | `intent.intents/confirmations` | В `auth/client.routes` нужен полный OTP-flow (send/verify) |
| G7 | Хранение подписанного договора | `contracts.contract_docs` | В `deals` нужна ссылка на документ + статус подписания MyID |
| G8 | Изоляция данных мерчанта | RLS в legacy или app-level | Все запросы в новом API должны фильтроваться по `tenantId` |

### 3.2 Пробелы Phase 2 (не блокируют v1)

| # | Пробел | Описание |
|---|---|---|
| G9 | Аналитика мерчанта | `report` DB не мигрирован |
| G10 | Автоплатёж | `autopayment` DB не мигрирован |
| G11 | Возвраты | `refund` DB не мигрирован |
| G12 | Выкуп (buyout) | `buyout` DB не мигрирован |

---

## 4. Поэтапный план миграции

### Фаза 1 — Аутентификация и пользователи
**Срок:** Sprint 1–2  
**Цель:** Заменить IdentityServer4 (finsumid) на новый auth-модуль

#### Что мигрировать из legacy:
- `finsumid.users` → новые записи сотрудников в `employees`
- `finsumid.roles` → предопределённые роли: `platform_admin`, `merchant_admin`, `agent`
- `finsumid.user_roles` → поле `roleIds: string[]` в `employees.schema`

#### Что нужно реализовать (G5, G6):
```typescript
// employees.schema.ts — добавить:
roles: Type.Array(Type.Union([
  Type.Literal('merchant_admin'),
  Type.Literal('agent'),
])),
activeRole: Type.Optional(Type.String()),  // текущая активная роль

// auth/agent.routes.ts — добавить endpoint:
POST /auth/agent/switch-role  { role: 'agent' | 'merchant_admin' }
// → обновляет activeRole в JWT без перелогина
```

#### Шаги:
1. Экспортировать пользователей из `finsumid.users` (фильтр по `merchant_agents` из `finance`)
2. Создать скрипт миграции: для каждого пользователя создать запись в новом `employees` с привязкой к `tenantId`
3. Настроить JWT с полем `tenantId`, `employeeId`, `activeRole`
4. Реализовать OTP-flow для клиентского входа (G6): `POST /auth/client/send-otp`, `POST /auth/client/verify-otp`

---

### Фаза 2 — Тенанты, продукты, тарифы
**Срок:** Sprint 2–3  
**Цель:** Заменить `finance` DB, дать мерчанту UI для настройки скоринговой модели

#### Что мигрировать из legacy:
- `finance.merchants` → `tenants` (id, name, slug, active)
- `finance.merchant_agents` → `employees` с `tenantId`
- `finance.fin_products` → `products` (один продукт = один финансовый продукт)
- `finance.fin_terms` → `tariffs` (условия: сумма, срок, первоначальный взнос, комиссия)

#### Что нужно добавить (G1):
```typescript
// tariffs.schema.ts — создать:
export const TariffSchema = Type.Object({
  id: Type.String(),
  tenantId: Type.String(),
  productId: Type.String(),
  name: Type.String(),
  termMonths: Type.Number(),           // срок рассрочки
  minAmount: Type.Number(),
  maxAmount: Type.Number(),
  prepayPercent: Type.Number(),        // % первоначального взноса
  commissionPercent: Type.Number(),    // % комиссии
  scoringWeights: Type.Object({        // настраиваемая скоринговая модель (G1)
    incomeLevel: Type.Number(),
    age: Type.Number(),
    workExperience: Type.Number(),
    creditLoad: Type.Number(),
    creditHistory: Type.Number(),
    cardBalance: Type.Number(),
  }),
  active: Type.Boolean(),
  createdAt: Type.String(),
});
```

#### Маппинг legacy-полей:
| Legacy (`finance.fin_products`) | Новое поле |
|---|---|
| `max_value`, `min_value` | `tariffs.maxAmount`, `tariffs.minAmount` |
| `scoring_model` (text) | `tariffs.scoringWeights` (jsonb структура) |
| `scoring_provider` | конфигурация в `scoring` модуле |
| `prepay_value`, `prepay_value_type` | `tariffs.prepayPercent` |
| `comission_value` | `tariffs.commissionPercent` |
| `term_duration`, `term_type` | `tariffs.termMonths` |

#### Шаги:
1. Экспорт `finance.merchants` → скрипт создания `tenants`
2. Экспорт `finance.fin_products` + `finance.fin_terms` → скрипт создания `products` и `tariffs`
3. Расширить `tariffs.schema.ts` структурой `scoringWeights`
4. Реализовать API `PATCH /tariffs/:id/scoring-weights` (только для `merchant_admin`)

---

### Фаза 3 — Идентификация клиентов
**Срок:** Sprint 3  
**Цель:** Заменить `ident` DB, обеспечить хранение PINFL и данных паспорта

#### Что мигрировать из legacy:
- `ident.identificators` → `clients` (pinfl, doc_identifier, birth_date, first/last/middle name)
- `ident.personal_info` → поля в `clients`
- `ident.identifications` → лог идентификаций (can be stored as `deals.identificationId`)

#### Что нужно добавить (G2):
```typescript
// clients.schema.ts — добавить поля:
firstName: Type.Optional(Type.String()),
lastName: Type.Optional(Type.String()),
middleName: Type.Optional(Type.String()),
passportIssueDate: Type.Optional(Type.String()),
passportExpireDate: Type.Optional(Type.String()),
passportIssuedBy: Type.Optional(Type.String()),
address: Type.Optional(Type.String()),
regionId: Type.Optional(Type.String()),

// В deals.schema.ts — добавить:
katmConsentAt: Type.Union([Type.String(), Type.Null()]),  // G2: timestamp согласия на КАТМ
myIdVerifiedAt: Type.Union([Type.String(), Type.Null()]), // метка завершения MyID
```

#### Шаги:
1. Экспорт `ident.identificators` + `ident.personal_info` → `clients`
2. Добавить endpoint `POST /clients/identify` — принимает PINFL, вызывает MyID
3. Добавить логику: если клиент уже есть в `clients` по PINFL — не требовать повторной идентификации
4. Сохранять `katmConsentAt` при каждой заявке (закон №301)

---

### Фаза 4 — Скоринг
**Срок:** Sprint 3–4  
**Цель:** Перенести логику из `scoring` DB, реализовать скоринг с весами из тарифа

#### Что мигрировать из legacy:
- `scoring.providers` → конфигурация провайдеров в `scoring.service.ts`
- `scoring.identifier_blacklists` → таблица `blacklist` в новой БД
- `scoring.org_blacklists` → таблица `org_blacklist`
- `scoring.scoring_sessions` → `scoring_sessions` в новой БД

#### Новая логика скоринга (G1):
```
score = Σ (factor_value × weight_from_tariff.scoringWeights)

Факторы берутся из:
  - КАТМ (InfoScore): кредитная история, нагрузка, просрочки
  - PlumGate: баланс карт Uzcard/Humo (scoring.card_identificator)
  - Данные идентификации: возраст, адрес, стаж

Результат:
  - score >= threshold → approved + enable_sum
  - score < threshold → rejected
```

#### Что нужно реализовать:
- `scoring.service.ts`: вызов КАТМ → вызов PlumGate → расчёт по формуле из `tariff.scoringWeights`
- Таблица `scoring_sessions`: `id`, `dealId`, `clientId`, `tenantId`, `katmData`(jsonb), `cardData`(jsonb), `score`, `enableSum`, `status`, `createdAt`
- Отдельный endpoint для карт: `POST /scoring/card-verify` — привязка/верификация карты через SMS

#### Маппинг legacy-полей:
| Legacy (`scoring.Scoring_info`) | Новое поле |
|---|---|
| `Уровень_дохода`, `Возраст`, etc. (jsonb) | `katmData.factors` (jsonb) |
| `points`, `enable_sum` | `scoring_sessions.score`, `enableSum` |
| `scoring_sessions.card_identificator_id` | `scoring_sessions.cardId` |

---

### Фаза 5 — Сделки (Deal Flow)
**Срок:** Sprint 4–5  
**Цель:** Заменить `dealer` + `agreement` + `contracts` DB, реализовать полный жизненный цикл заявки

#### Статусная машина сделки (G4):
```
draft → client_identified → katm_checked → scored →
  → rejected (терминальный)
  → tariff_selected → cart_filled → contract_generated →
    → signing → active → completed / cancelled
```

#### Что нужно добавить (G3, G4, G7):
```typescript
// deals.schema.ts — добавить:
export const DealItemSchema = Type.Object({        // G3: корзина
  sku: Type.String(),
  name: Type.String(),
  price: Type.Number(),
  count: Type.Integer(),
  unit: Type.Optional(Type.String()),
});

export const DealEventSchema = Type.Object({       // G4: история статусов
  id: Type.String(),
  dealId: Type.String(),
  status: Type.String(),
  note: Type.Optional(Type.String()),
  actorId: Type.String(),
  createdAt: Type.String(),
});

// В DealHeaderSchema добавить:
items: Type.Array(DealItemSchema),
katmConsentAt: Type.Union([Type.String(), Type.Null()]),
scoringSessionId: Type.Union([Type.String(), Type.Null()]),
contractDocUrl: Type.Union([Type.String(), Type.Null()]),  // G7
contractSignedAt: Type.Union([Type.String(), Type.Null()]),
```

#### Маппинг legacy-полей:
| Legacy | Новое |
|---|---|
| `dealer.deals.id` | `deals.id` |
| `dealer.deal_states.deal_status` | `deals.status` |
| `dealer.deal_clients.scoring_id` | `deals.scoringSessionId` |
| `dealer.deal_items` | `deals.items[]` |
| `dealer.deal_fin_states.sum` | `deals.principal` |
| `agreement.agreements` | `deals.contractDocUrl` |
| `contracts.contract_docs.src` | `deals.contractDocUrl` |

#### Шаги:
1. Экспорт активных сделок из `dealer.deals` + `dealer.deal_states` → новый `deals`
2. Экспорт `dealer.deal_items` → вложенный массив `items` в `deals`
3. Реализовать endpoint-цепочку:
   - `POST /deals` → создаёт черновик
   - `POST /deals/:id/identify-client` → step 2 (PINFL + MyID)
   - `POST /deals/:id/katm-consent` → step 2 (согласие, G2)
   - `POST /deals/:id/verify-card` → step 3
   - `GET /deals/:id/score` → step 4 (возвращает результат скоринга)
   - `POST /deals/:id/select-tariff` → step 5
   - `POST /deals/:id/items` → step 6 (корзина, G3)
   - `POST /deals/:id/sign` → step 7 (инициация подписи MyID)
   - `POST /deals/:id/confirm-sign` → step 7 (подтверждение от MyID webhook)

---

### Фаза 6 — Платёжный график и просрочки
**Срок:** Sprint 5–6  
**Цель:** Заменить `schedule` + `overdue` + `payment` DB

#### Что мигрировать из legacy:
- `schedule.deal_schedules` + `schedule.schedules` → `payments` (платёжные строки)
- `schedule.schedule_states` → статус строки (`paid`, `overdue`, `pending`)
- `overdue.overdues` → просроченные строки (пересечение с schedule)
- `payment.payments` + `payme.payments` → лог платежей

#### Финальная схема:
```typescript
// payments.schema.ts — создать:
export const PaymentScheduleRowSchema = Type.Object({
  id: Type.String(),
  dealId: Type.String(),
  tenantId: Type.String(),
  sequence: Type.Number(),        // номер платежа (1, 2, 3...)
  dueDate: Type.String(),         // дата погашения
  amount: Type.Number(),
  status: Type.Union([
    Type.Literal('pending'),
    Type.Literal('paid'),
    Type.Literal('overdue'),
    Type.Literal('partial'),
  ]),
  paidAt: Type.Union([Type.String(), Type.Null()]),
  paidAmount: Type.Union([Type.Number(), Type.Null()]),
  paymentSource: Type.Optional(Type.String()),  // 'payme' | 'click'
});
```

#### Шаги:
1. Экспорт `schedule.schedules` → `payment_schedule_rows`
2. Экспорт `overdue.overdues` → обновить статус строк на `overdue`
3. Реализовать webhook-обработчики для Payme и Click
4. Реализовать cron-задачу: ежедневно проверять просроченные строки → отправлять SMS

---

### Фаза 7 — Личный кабинет покупателя
**Срок:** Sprint 6–7  
**Цель:** Реализовать `client-portal` (нет аналога в legacy)

#### Что нужно:
- SMS OTP вход (G6): `POST /auth/client/send-otp { phone }` → `POST /auth/client/verify-otp { phone, code }`
- `GET /portal/deals` — активные и закрытые рассрочки клиента
- `GET /portal/schedule` — ближайшие платежи и история
- `GET /portal/notifications` — просрочки и уведомления
- `GET /portal/deals/:id/contract` — скачать договор (из `deals.contractDocUrl`)

#### Приложение `client-portal` (apps/client-portal):
- Уже есть директория `apps/client-portal`
- Аутентификация — отдельный JWT с `clientId` (не `employeeId`)
- Данные клиента изолированы по `clientId` в JWT

---

### Фаза 8 — Аналитика и отчёты (Phase 2)
**Срок:** Sprint 8+  
**Цель:** Перенести функциональность `report` DB

Вне scope v1 согласно ТЗ раздел 10.

---

## 5. Данные к миграции: приоритет

| Приоритет | Legacy-таблицы | Новый модуль | Объём (оценка) |
|---|---|---|---|
| 🔴 Критичный | `finance.merchants` | `tenants` | ~десятки записей |
| 🔴 Критичный | `finance.fin_products` + `fin_terms` | `products` + `tariffs` | ~сотни |
| 🔴 Критичный | `finsumid.users` + `finance.merchant_agents` | `employees` | ~тысячи |
| 🔴 Критичный | `dealer.deals` (активные) | `deals` | ~тысячи |
| 🟡 Важный | `ident.identificators` | `clients` | ~десятки тысяч |
| 🟡 Важный | `schedule.schedules` (активные) | `payment_schedule_rows` | ~сотни тысяч |
| 🟢 Низкий | Исторические данные (закрытые сделки) | read-only archive | миллионы |

---

## 6. Стратегия миграции данных

### 6.1 Подход: Двойная запись (Dual Write)

Для активных сделок и клиентов (нельзя потерять):
1. **Новый сервис пишет в оба места** — в legacy DB и в новую DB одновременно
2. **Читает из нового** — как только данные проверены
3. **Отключает запись в legacy** после стабилизации (2–4 недели)

### 6.2 Одноразовая миграция (Batch Migration)

Для исторических данных и справочников:
```bash
# Пример скрипта миграции мерчантов:
# 1. Выгрузить из legacy
SELECT id, name, org_id FROM finance.merchants WHERE is_deleted = false;

# 2. Преобразовать и вставить в новую БД
INSERT INTO tenants (id, name, slug, active, created_at)
VALUES (:id, :name, slugify(:name), true, now());
```

### 6.3 Readonly-архив

Для закрытых сделок (нет активных платежей):
- Legacy БД остаётся доступной для чтения через read-only API
- Клиент может скачать старый договор через `/portal/archive/:dealId`
- **Не мигрировать** — слишком большой объём, нет бизнес-ценности

---

## 7. Риски и меры

| Риск | Вероятность | Влияние | Мера |
|---|---|---|---|
| Потеря КАТМ-согласий (закон №301) | Средняя | Высокое | Перенести `scoring_sessions` первым, до любых новых заявок |
| Расхождение ID клиентов (разные форматы) | Высокая | Среднее | Хранить `legacyId` в `clients` как переходное поле |
| Дублирование карт при миграции | Средняя | Среднее | Дедупликация по `masked_number` + `user_id` перед импортом |
| Нарушение изоляции мерчантов (G8) | Низкая | Критичное | Row-level Security (RLS) в PostgreSQL + middleware-проверка `tenantId` |
| Downtime при переключении | Средняя | Высокое | Blue-green deployment: новый API на новом домене, переключение DNS |
| Потеря подписанных договоров | Низкая | Критичное | `contract_docs.src` (URL файла) мигрировать первым, до всего остального |

---

## 8. Чеклист готовности к запуску v1

### Инфраструктура
- [ ] PostgreSQL с RLS-политиками по `tenant_id`
- [ ] JWT с полями `tenantId`, `employeeId`, `activeRole`, `clientId`
- [ ] Webhook-endpoints для Payme и Click
- [ ] SMS-сервис для OTP (клиент) и уведомлений (просрочки)
- [ ] Защищённое хранилище договоров (S3-compatible, не сторонние облака)

### Данные
- [ ] Мерчанты мигрированы → `tenants`
- [ ] Продукты и тарифы мигрированы → `products` + `tariffs`
- [ ] Сотрудники мигрированы → `employees`
- [ ] Активные сделки мигрированы → `deals`
- [ ] Активные клиенты мигрированы → `clients`
- [ ] Активные графики мигрированы → `payment_schedule_rows`
- [ ] Подписанные договоры → URL сохранён в `deals.contractDocUrl`

### Функциональность
- [ ] G1: Настройка scoringWeights через UI мерчанта
- [ ] G2: КАТМ-согласие сохраняется в `deals.katmConsentAt`
- [ ] G3: Корзина товаров в `deals.items[]`
- [ ] G4: История статусов сделки в `deal_events`
- [ ] G5: Переключение ролей (agent ↔ merchant_admin)
- [ ] G6: SMS OTP для клиентского входа
- [ ] G7: URL подписанного договора в `deals.contractDocUrl`
- [ ] G8: Изоляция данных мерчанта (проверено на тестах)

---

## 9. Временная шкала (оценка)

```
Sprint 1–2 (2 нед): Фаза 1 — Auth + Employees (G5, G6)
Sprint 2–3 (2 нед): Фаза 2 — Tenants + Products + Tariffs (G1)
Sprint 3   (1 нед): Фаза 3 — Clients + Identification (G2)
Sprint 3–4 (2 нед): Фаза 4 — Scoring Engine (КАТМ + PlumGate)
Sprint 4–5 (2 нед): Фаза 5 — Deal Flow полный цикл (G3, G4, G7)
Sprint 5–6 (2 нед): Фаза 6 — Payments + Schedule + Overdue
Sprint 6–7 (2 нед): Фаза 7 — Client Portal (G8)
─────────────────────────────────────────────
Итого до v1: ~13 недель / ~3 месяца
```
