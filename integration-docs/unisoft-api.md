# UniAccess API — UniSoft Auto-Debit Partner Integration

> Source: «UniAccess Web Service API Documentation» prepared by Gafurov Shakhzod (UniSoft).

## Общие сведения

- Протокол: **JSON-RPC v2.0** поверх **HTTPS**, метод **POST**.
- Все запросы направляются на единый endpoint: `{{autopay-v4-host}}/api/v1/partners` (кроме `login`).
- Ответ всегда содержит три поля: `status` (boolean), `result` (object|null), `error` (object|null).

### Заголовки запроса

| Заголовок | Значение |
|---|---|
| `Content-Type` | `application/json; charset=utf-8` |
| `Accept` | `application/json` |
| `Authorization` | `Bearer <token>` |

### Структура запроса

```json
{
  "method": "method-name",
  "params": { /* тело запроса */ }
}
```

### Структура успешного ответа

```json
{ "status": true, "result": { /* данные */ }, "error": null }
```

### Структура ошибки

```json
{ "status": false, "result": null, "error": { "message": "Error message!" } }
```

### Признаки полей

- **(R)** — обязательно
- *(optional)* — опционально

---

## 1. Login

### 1.1 Authentication and Token Generation

**URL:** `POST {{autopay-v4-host}}/api/login`

Токен не имеет срока истечения. При передаче существующего токена в поле `token` он будет установлен как активный.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `username` | String(max:255) | Имя пользователя | R |
| `password` | String(max:255) | Пароль | R |
| `token` | String(min:32) | Токен партнёра (если передан — используется как активный) | optional |

#### Пример запроса

```json
{
  "method": "login",
  "params": {
    "username": "test",
    "password": "test",
    "token": "ZXlKMGIydGxiaUk2SWlJc0luUnZhMlZ1WDJacGJHpT2xzaU1UU"
  }
}
```

#### Пример успешного ответа

```json
{
  "status": true,
  "result": { "token": "ZXlKMGIydGxiaUk2SWlJc0luUnZhMlZ1WDJacGJHpT2xzaU1UU" },
  "error": null
}
```

---

## 2. Terminal

### 2.1 Terminal Check

**Method:** `terminal.check`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `terminal_id` | String | ID терминала | R |
| `merchant_id` | String | ID мерчанта | R |

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `terminal_id` | String | ID терминала |
| `merchant_id` | String | ID мерчанта |
| `status` | String | Статус (`success`) |
| `commission` | String | Комиссия |
| `comment` | String\|null | Комментарий |
| `type` | String | Тип (`sv` или `humo`) |

---

### 2.2 Terminal Add

**Method:** `terminal.add`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `terminal_id` | String(max:100), Unique | ID терминала (уникальный) | R |
| `merchant_id` | String | ID мерчанта | R |
| `commission` | Number(max:10) | Комиссия | R |
| `type` | String | Тип: `sv` или `humo` | R |

---

### 2.3 Terminal Get

**Method:** `terminal.get`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `page_size` | Integer, Max:500 | Размер страницы | R |
| `page_number` | Integer, Min:1 | Номер страницы | R |
| `search` | Object | Фильтр: `type`, `terminal_id`, `merchant_id` | optional |

#### Пример запроса

```json
{
  "method": "terminal.get",
  "params": {
    "page_number": 1,
    "page_size": 10,
    "search": { "type": "sv" }
  }
}
```

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `data` | Array | Список терминалов |
| `total` | Integer | Всего записей |
| `page` | Integer | Текущая страница |
| `page_size` | Integer | Размер страницы |
| `last_page` | Integer | Последняя страница |
| `current_page` | Integer | Текущая страница |

---

### 2.4 Terminal Delete

**Method:** `terminal.delete`

> Нельзя удалить терминал, привязанный к мерчанту.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `terminal_id` | String, Max:100 | ID терминала | R |

---

## 3. Merchants (Filials)

### 3.1 Merchant Create

**Method:** `merchant.create`

Мерчант — это филиал, содержащий контракты. Каждый мерчант имеет собственные настройки.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `name` | String(255), Unique | Название мерчанта | R |
| `sv_terminal` | String(max:50) | ID терминала типа `sv` | R |
| `humo_terminal` | String(max:50) | ID терминала типа `humo` | R |
| `phone` | String(max:30) | Телефон мерчанта | optional |
| `limit` | Integer, Min:0 | Минимальная сумма списания (тийин). Если баланс карты ниже лимита — запрос не отправляется (кроме случая, когда долг < лимита) | optional |
| `sv_commission` | Float, Min:0 | Комиссия Uzcard | optional |
| `humo_commission` | Float, Min:0 | Комиссия Humo | optional |
| `is_strict` | Boolean | `true` — оплата только при достаточном балансе для полного погашения; `false` — списывается максимально возможная сумма | optional |
| `address` | String, Max:255 | Юридический адрес | optional |
| `auto` | Boolean | Статус автоплатежа | optional |

#### Пример запроса

```json
{
  "method": "merchant.create",
  "params": {
    "name": "OOO Alfa",
    "sv_terminal": "55555",
    "humo_terminal": "236379VO",
    "phone": "975553366",
    "auto": true,
    "is_strict": true,
    "limit": 200000,
    "sv_commission": 0.3,
    "humo_commission": 1.5
  }
}
```

---

### 3.2 Merchant Update

**Method:** `merchant.update`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `id` | Integer | ID мерчанта | R |
| `data` | Object | Поля для обновления (те же, что в `merchant.create`) | R |

#### Пример запроса

```json
{
  "method": "merchant.update",
  "params": {
    "id": 21,
    "data": { "name": "Main-6", "auto": false, "is_strict": false, "sv_terminal": "92450306" }
  }
}
```

---

### 3.3 Merchant Get

**Method:** `merchant.get`

Возвращает список мерчантов с фильтрацией по атрибутам: `name`, `address`, `phone`, `sv_terminal`, `sv_merchant`, `humo_terminal`, `humo_merchant`, `auto`.

#### Пример запроса

```json
{
  "method": "merchant.get",
  "params": { "name": "Merchant name" }
}
```

---

### 3.4 Merchant Delete

**Method:** `merchant.delete`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `name` | String(255) | Название мерчанта | R |

---

## 4. Clients

### 4.1 Clients Create

**Method:** `client.create`

Создаёт новых клиентов. Кириллические символы автоматически конвертируются в латиницу.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `clients` | Array(max:250) | Массив клиентов | R |
| `clients[].pinfl` | Number(14 digits) | ПИНФЛ клиента | R |
| `clients[].passport` | String(size:9) | Номер паспорта (9 символов) | R |
| `clients[].first_name` | String(max:100) | Имя | R |
| `clients[].last_name` | String(max:100) | Фамилия | R |
| `clients[].middle_name` | String(max:100) | Отчество | R |

#### Пример запроса

```json
{
  "method": "client.create",
  "params": {
    "clients": [
      { "pinfl": "12345678912345", "passport": "AC1234567", "first_name": "Ali", "last_name": "Aliyev", "middle_name": "XXX" }
    ]
  }
}
```

#### Пример успешного ответа

```json
{
  "status": true,
  "result": {
    "created": { "12345678912345": { "pinfl": "12345678912345", "passport": "AC1234567", "first_name": "ALI", "last_name": "ALIYEV", "middle_name": "XXX", "created_at": "2024-12-19T08:55:54.995416Z", "updated_at": "2024-12-19T08:55:54.995425Z" } },
    "exists": []
  },
  "error": null
}
```

---

### 4.2 Clients Phone Add

**Method:** `client.phone.add`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `clients` | Array(max:250) | Массив клиентов | R |
| `clients[].pinfl` | Number(14 digits) | ПИНФЛ клиента | R |
| `clients[].phones` | Array(max:25, min:9 digits) | Массив номеров телефонов | R |

---

### 4.3 Clients Phone Delete

**Method:** `client.phone.delete`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `pinfl` | Number(14 digits) | ПИНФЛ клиента | R |
| `phones` | Array(max:25, min:9 chars) | Массив номеров для удаления | R |

---

### 4.4 Client Update

**Method:** `client.update`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `pinfl` | Number(14 digits) | ПИНФЛ клиента | R |
| `passport` | String(size:9) | Номер паспорта | R |
| `first_name` | String(max:100) | Имя | R |
| `last_name` | String(max:100) | Фамилия | R |
| `middle_name` | String(max:100) | Отчество | R |

---

### 4.5 Clients Get

**Method:** `client.get`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `page_size` | Number, Max:500 | Размер страницы | R |
| `page_number` | Number, Min:1 | Номер страницы | R |
| `search` | Object | Фильтр: `pinfl`, `passport`, `first_name`, `last_name`, `middle_name` | optional |

---

## 5. Contracts

### 5.1 Contracts Create

**Method:** `contract.create`

#### Поведение в зависимости от параметров

| Условие | Поведение |
|---|---|
| `debt > 0` | Контракт создаётся немедленно. Продукт: `name=loan_id`, `amount=debt`, `mode=daily`, даты = сегодня, `period=1`. График генерируется автоматически. Поле `product` игнорируется. |
| `debt = 0` + `product` | Создаётся контракт, затем продукт и график по параметрам `product`. |
| Без `product` | Создаётся только контракт. |

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `contracts` | Array(max:250) | Массив контрактов | R |
| `contracts[].pinfl` | Number(14 digits) | ПИНФЛ клиента | R |
| `contracts[].merchant_id` | Integer | ID мерчанта | R |
| `contracts[].loan_id` | String(max:150) | Уникальный ID займа | optional |
| `contracts[].debt` | Integer | Сумма долга (тийин) | R |
| `contracts[].ext` | String(max:255) | Внешний ID | optional |
| `contracts[].account` | String(max:255) | Счёт | optional |
| `contracts[].info` | String(max:255) | Доп. информация | optional |
| `contracts[].auto` | Boolean | Управление автоплатежом | optional |
| `contracts[].product` | Object | Параметры продукта (см. ниже) | optional |
| `product.name` | String | Название продукта | — |
| `product.initial_amount` | Integer | Начальный платёж (тийин) — создаёт успешную транзакцию | — |
| `product.percentage` | Float | Процент увеличения суммы | — |
| `product.amount` | Integer | Сумма продукта (тийин) | — |
| `product.start_date` | String (YYYY-MM-DD) | Дата начала | — |
| `product.due_date` | String (YYYY-MM-DD) | Дата окончания | — |
| `product.period` | Integer | Период (кол-во платежей) | — |
| `product.mode` | String | Режим: `monthly`, `daily`, и др. | — |
| `product.comment` | String | Комментарий | — |

#### Пример успешного ответа

```json
{
  "status": true,
  "result": {
    "created": ["42141312313242341", "143214142121421"],
    "exists": [],
    "not_found_clients": []
  },
  "error": null
}
```

---

### 5.2 Contract Update

**Method:** `contract.update`

#### Режимы обновления

| Условие | Поведение |
|---|---|
| `data.product` присутствует | Обновляет только `name`, `start_date`, `comment` первого продукта. Долг, транзакции и график не затрагиваются. |
| `data.debt` присутствует (без `data.product`) | Сбрасывает `current_debt`, `total_debt`, `paid_amount`, очищает транзакции. Сохраняет первый элемент графика. |
| Ни `data.product`, ни `data.debt` | Обновляет только `ext`, `account`, `info`, `auto`, очищает транзакции. |

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `loan_id` | String(max:100) | ID займа | R |
| `data` | Object | Поля для обновления | R |
| `data.debt` | Integer | Новая сумма долга | optional |
| `data.auto` | Boolean | Статус автоплатежа | optional |
| `data.ext` | String(max:255) | Внешний ID | optional |
| `data.account` | String(max:255) | Счёт | optional |
| `data.info` | String(max:255) | Доп. информация | optional |

---

### 5.3 Contracts Get

**Method:** `contract.get`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `page_size` | Number, Max:500 | Размер страницы | R |
| `page_number` | Number, Min:1 | Номер страницы | R |
| `search` | Object | Фильтр: `pinfl`, `loan_id`, `total_debit`, `current_debit`, `paid_amount`, `ext`, `auto` | optional |

---

### 5.4 Contract Delete

**Method:** `contract.delete`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `pinfl` | Number(14 digits) | ПИНФЛ клиента | R |
| `loan_id` | String(max:100) | ID займа | R |

---

### 5.5 Contract Auto Toggle

**Method:** `contract.auto.toggle`

Массовое переключение `auto` у списка контрактов. Ошибка не возвращается, если `loan_id` не найден.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `auto` | Boolean | Значение `auto` для установки | R |
| `loan_ids` | Array, Max:250 | Список `loan_id` | R |

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `updated` | Integer | Кол-во обновлённых строк |
| `auto` | Boolean | Установленное значение |

---

### 5.6 Contract Find

**Method:** `contract.find`

Возвращает единственный контракт по `loan_id`.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `loan_id` | String, Max:150 | ID займа | R |

---

## 6. Transactions

### 6.1 Transactions Get

**Method:** `transaction.get`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `page_size` | Number, Max:500 | Размер страницы | R |
| `page_number` | Number, Min:1 | Номер страницы | R |
| `search` | Object | Фильтр: `pinfl`, `merchant_id`, `loan_id`, `ext`, `rrn`, `amount`, `status`, `date`, `terminal`, `merchant` | optional |

#### Параметры ответа (`data[]`)

| Поле | Тип | Описание |
|---|---|---|
| `merchant_id` | Integer | ID мерчанта |
| `pinfl` | String | ПИНФЛ клиента |
| `loan_id` | String | ID займа |
| `ext` | String | Уникальный внешний ID транзакции |
| `rrn` | String | Референсный номер транзакции |
| `card.pan` | String | Маска номера карты |
| `card.owner` | String | Держатель карты |
| `card.phone` | String | Телефон SMS-уведомлений |
| `card.token` | String | Токен карты (только для sv-транзакций) |
| `status` | String | `success` или `cancelled` |
| `date` | Date | Дата транзакции (Y-m-d) |
| `amount` | BigInt | Сумма (тийин) |
| `terminal` | String | ID терминала |
| `merchant` | String | ID мерчанта (банковский) |
| `is_synced` | Boolean | Синхронизирована ли транзакция с партнёром |
| `push_id` | Integer\|null | ID push-уведомления после транзакции |

---

### 6.2 Transactions Mark as Synchronized

**Method:** `transaction.synchronize`

Партнёр подтверждает, что транзакции сохранены в их системе. Ошибка не возвращается, если `ext` не найден.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `is_synced` | Boolean | Статус синхронизации | R |
| `transactions` | Array, Max:100 | Список `ext` значений транзакций | R |

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `updated` | Integer | Кол-во обновлённых транзакций |
| `is_synced` | Boolean | Установленное значение |

---

### 6.3 Transaction Find by Ext

**Method:** `transaction.find`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `ext` | String | Внешний ID транзакции | R |

---

### 6.4 Transaction Cancel

**Method:** `transaction.cancel`

Отменяет успешную транзакцию.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `ext` | String | Внешний ID транзакции | R |

---

### 6.5 Transaction Verification Set

**Method:** `transaction.verification.set`

Настраивает хост для подтверждения платежей перед обработкой (pre-payment verification).

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `host` | String (URL) | Endpoint для подтверждения | R |
| `token` | String, Min:32, Max:250 | Токен авторизации | R |
| `status` | Boolean | `true` — включить верификацию | R |
| `delay` | Integer, Min:0, Max:3600 | Задержка (сек) между запросами по одному контракту. Default: 10 | optional |

#### Сценарий верификации

Система отправляет на `host` запрос:
```json
{ "loan_id": "XYZ-12345" }
```

Партнёр должен ответить **HTTP 200** в одном из форматов:

| Код | Действие |
|---|---|
| `100` | Успех — платёж разрешён. Обязательно вернуть `debt` (тийин) |
| `101` | Контракт не найден/закрыт — отключить `auto` для контракта |
| `102` | Контракт занят другим процессом — заблокировать максимум на 6 часов |

```json
{ "code": 100, "debt": 2000000 }
```

> **Важно:** После 5 последовательных ошибок автоплатёж будет отключён. Система будет опрашивать хост раз в минуту, и восстановит автоплатёж только после успешного ответа.

---

### 6.6 Transaction Verification Check

**Method:** `transaction.verification.check`

Возвращает текущий статус настроек верификации. Параметры запроса не требуются.

#### Пример запроса

```json
{ "method": "transaction.verification.check" }
```

---

## 7. Webhook

### 7.1 Webhook Definition

Webhook — endpoint партнёра, на который система отправляет данные о транзакции после успешного выполнения.

**Логика повторных попыток:**

| Ответ | Действие |
|---|---|
| `200`, `201`, `202` | Отмечается как успешно отправлено |
| `401`, `403`, `404` | Повторные попытки прекращаются |
| `429` | Ожидание 120 секунд перед повторной попыткой |
| Иные ошибки | Повтор: сразу → +25 сек → +50 сек (максимум 3 попытки) |

Авторизация: `Authorization: Bearer {Token}`

#### Структура данных, отправляемых на webhook

```json
{
  "merchant_id": 4,
  "pinfl": "32422964310034",
  "loan_id": "xy-123",
  "ext": "0d98ae44-6235-4f95-8167-071ef3788020",
  "rrn": "023085879912",
  "card": { "pan": "860057******3599", "owner": "GOFUROV SHAHZODBEK", "phone": "" },
  "status": "cancelled",
  "processing": "sv",
  "date": "2024-12-14",
  "amount": 1000,
  "terminal": "92450306",
  "merchant": "904815948",
  "is_synced": true,
  "created_at": "2024-12-14T12:38:31.000000Z"
}
```

---

### 7.2 Webhook Check

**Method:** `webhook.check`

Возвращает текущий статус настроек webhook. Параметры не требуются.

---

### 7.3 Webhook Set

**Method:** `webhook.set`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `host` | String (URL) | Endpoint webhook | R |
| `token` | String, Min:32 | Токен авторизации | R |
| `status` | Boolean | `false` — отключить webhook | R |

---

## 8. Cards

### 8.1 Card Info

**Method:** `card.info`

Возвращает информацию о картах клиента (Uzcard и Humo) по ПИНФЛ.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `pinfl` | String(14 digits) | ПИНФЛ клиента | R |

#### Параметры ответа

Возвращает два объекта: `uzcard` и `humo`, каждый содержит:

| Поле | Тип | Описание |
|---|---|---|
| `count` | Integer | Кол-во карт |
| `data[].pinfl` | String | ПИНФЛ клиента |
| `data[].uuid` | String | Токен карты |
| `data[].auto` | Boolean | Статус автоплатежа |
| `data[].is_verified` | Boolean | Верифицирована ли карта |
| `data[].is_blocked` | Boolean | Заблокирована ли карта |
| `data[].block_reason` | String\|null | Причина блокировки |
| `data[].blocked_at` | String\|null | Дата блокировки |
| `data[].owner` | String | Держатель карты |
| `data[].pan` | String | Маска номера |
| `data[].phone` | String | Привязанный телефон |

---

### 8.2 Cards Count by PINFL

**Method:** `card.count`

Возвращает количество карт Uzcard и Humo по массиву ПИНФЛ.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `pinfl` | Array(max:250) | Массив ПИНФЛ | R |

#### Пример ответа

```json
{
  "status": true,
  "result": {
    "41310***270086": { "uzcard": 1, "humo": 2 },
    "42903***310064": { "uzcard": 0, "humo": 11 }
  },
  "error": null
}
```

---

### 8.3 Card Sync Local

**Method:** `card.sync.local`

Синхронизирует карточные данные для указанных ПИНФЛ — создаёт токены карт, если они ещё не существуют.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `pinfl` | Array(max:250) | Массив ПИНФЛ | R |

---

## 9. Processing (Paid methods)

> **Платный сервис.** Каждый запрос по ПИНФЛ включается в ежемесячный счёт.

### 9.1 Search Uzcard Cards

**Method:** `processing.uzcard.search`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `pinfl` | Array, Max:30 | Список ПИНФЛ | R |
| `pinfl[]` | String(14 digits) | ПИНФЛ клиента | R |

#### Параметры ответа (на каждый ПИНФЛ)

| Поле | Тип | Описание |
|---|---|---|
| `cards_count` | Integer | Кол-во найденных карт |
| `cards[].pan` | String | Маска номера карты |
| `cards[].owner` | String | Держатель карты |
| `cards[].phone` | String | Телефон |

> При частичных сбоях ответ содержит `ok` (успешные) и `fails_key` (ключ для перепроверки неудачных). Неудачные запросы автоматически ставятся в очередь на повтор.

---

### 9.2 Search Humo Cards

**Method:** `processing.humo.search`

Аналогично `processing.uzcard.search` — те же параметры и формат ответа.

---

### 9.3 Failed Cards Recheck by Key

**Method:** `processing.check`

Перепроверяет неудавшиеся запросы по ключу из `fails_key`.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `key` | String | Ключ верификации из `fails_key` | R |

---

### 9.4 Card Search History

**Method:** `processing.get.history`

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `page_size` | Number, Max:500 | Размер страницы | R |
| `page_number` | Number, Min:1 | Номер страницы | R |
| `search.date_from` | Date (YYYY-MM-DD) | Дата с | optional |
| `search.date_to` | Date (YYYY-MM-DD) | Дата по | optional |
| `search.pinfls` | Array, Max:250 | Список ПИНФЛ для фильтрации | optional |
| `search.status` | String | `created`, `processing`, `success` | optional |

#### Статусы запросов

| Статус | Описание |
|---|---|
| `created` | Задача создана, но не отправлена в процессинг |
| `processing` | Находится в очереди |
| `success` | Успешно отправлена в процессинг |

---

## 10. Monitoring (Paid methods)

> **Платный сервис.** Требует верификации через OTP.

### 10.1 Card Registration

**Method:** `card.register`

Регистрирует карту и отправляет OTP на телефон держателя.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `card_number` | String(16 digits) | Полный номер карты (16 цифр) | R |
| `expire` | String(4 digits) | Срок действия в формате `YYMM` | R |
| `type` | String | `humo` или `uzcard` | R |
| `phone` | String(12 digits) | Телефон для OTP (только для Humo) | R (если humo) |

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `ext` | String | Внешний ID для шага верификации |
| `phone_mask` | String | Маска телефона |
| `type` | String | Тип карты |
| `expires_at` | Integer | Unix timestamp истечения OTP |
| `expires_in` | Integer | Секунд до истечения (120 сек) |
| `expires_at_utc` | String | Время истечения в UTC |

> **Важно:** OTP действителен 2 минуты. После 3 неверных попыток: Uzcard — блокировка 4 часа, Humo — 24 часа. Повторная отправка OTP до истечения таймаута невозможна. Одна карта — один активный токен.

---

### 10.2 Card Verify

**Method:** `card.verify`

Проверяет OTP и привязывает карту.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `ext` | String(max:50) | Внешний ID из `card.register` | R |
| `otp_code` | Numeric(4 digits) | OTP-код из SMS | R |
| `type` | String | `humo` или `uzcard` | R |

---

### 10.3 Monitoring Humo

**Method:** `monitoring.humo`

Возвращает историю транзакций по карте Humo за указанный период.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `card_number` | Numeric(16 digits) | Полный номер карты | R |
| `date_from` | String (YYYY-MM-DD) | Дата начала (включительно) | R |
| `date_to` | String (YYYY-MM-DD) | Дата конца (включительно). По умолчанию — сегодня | optional |

#### Ключевые поля ответа (`rows[]`)

| Поле | Описание |
|---|---|
| `CARD` | Номер карты |
| `TRAN_TYPE` | Тип транзакции |
| `TRAN_AMT` | Сумма транзакции |
| `TRAN_DATE_TIME` | Дата и время |
| `ABVR_NAME` | Сокращённое название мерчанта |
| `CITY` | Город |
| `DEAL_DESC` | Описание операции |
| `REF_NUMBER` | Референсный номер |

---

### 10.4 Monitoring Uzcard

**Method:** `monitoring.uzcard`

Возвращает историю транзакций по карте Uzcard за указанный период (с пагинацией).

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `card_number` | Numeric(16 digits) | Полный номер карты | R |
| `date_from` | String (YYYY-MM-DD) | Дата начала (включительно) | R |
| `date_to` | String (YYYY-MM-DD) | Дата конца. По умолчанию — сегодня | optional |
| `page_number` | Numeric, default:0 | Номер страницы (с 0) | optional |

#### Ключевые поля ответа

| Поле | Описание |
|---|---|
| `total_elements` | Всего транзакций |
| `total_pages` | Всего страниц |
| `page_number` | Текущая страница |
| `total_debit` | Суммарный дебет |
| `total_credit` | Суммарный кредит |
| `content[].utrnno` | ID транзакции |
| `content[].transType` | Тип транзакции |
| `content[].hpan` | Маска карты |
| `content[].reqamt` | Запрошенная сумма |
| `content[].merchantName` | Название мерчанта |
| `content[].credit` | `true` — кредит, `false` — дебет |
| `content[].acctbal` | Остаток на счёте после операции |

---

## 11. Scoring (Paid methods)

> **Платный сервис.** Требует верификации через OTP.

### 11.1 Scoring By PINFL

**Method:** `scoring.humo`

Возвращает ежемесячные итоги кредитов и дебетов по всем картам Humo, привязанным к ПИНФЛ.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `pinfl` | String(14 digits) | ПИНФЛ клиента | R |
| `date_from` | String (DD-MM-YYYY) | Дата начала | R |
| `date_to` | String (DD-MM-YYYY) | Дата конца | R |

#### Структура ответа

```json
{
  "status": true,
  "result": [
    {
      "pan": "986004******8232",
      "data": [
        {
          "Jan": [
            { "type": "110", "count": "1", "amount": "517880" },
            { "type": "205", "count": "13", "amount": "1034132.5" }
          ]
        }
      ]
    }
  ],
  "error": null
}
```

---

## 12. E-GOV (Paid methods)

### 12.1 Services (free)

**Method:** `egov.services`

Возвращает список доступных e-gov сервисов.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `page_size` | Integer, Max:500 | Размер страницы | R |
| `page_number` | Integer, Min:1 | Номер страницы | R |
| `search` | Object | Фильтр | optional |

#### Пример ответа (data[])

| Поле | Описание |
|---|---|
| `name_uz` | Название сервиса (узбекский) |
| `name_ru` | Название сервиса (русский) |
| `service_id` | ID сервиса |

---

### 12.2 Store

**Method:** `egov.store`

Создаёт запись о гражданине и запрашивает данные по всем e-gov сервисам.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `pinfl` | String(14 digits) | ПИНФЛ | R |
| `passport` | String(9 chars) | Номер паспорта (напр. `AC1234567`) | R |

> **Важно:** Метод можно вызывать не чаще одного раза в месяц. При каждом вызове производится новый платёж.

---

### 12.3 Get (free)

**Method:** `egov.get`

Возвращает сохранённые данные e-gov сервиса для гражданина.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `pinfl` | String(14 digits) | ПИНФЛ | R |
| `service_id` | Integer | ID сервиса (должен существовать в `egov.services`) | R |

---

### 12.4 Update

**Method:** `egov.update`

Обновляет данные e-gov сервисов для гражданина, повторно запрашивая все сервисы.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `pinfl` | String(14 digits) | ПИНФЛ | R |
| `passport` | String(9 chars) | Номер паспорта | R |
