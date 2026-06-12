# PLUM Payment Gate — Справочное руководство по API

> Источник: «PLUM Payment Gate. Справочное руководство по API», редакция № 2.0.0 (история изменений до версии 2.0.1 от 2025-07-11), АО «Plum Technologies». Контакт: info@plumtech.uz.

## Общие сведения

- Web-сервис служит шлюзом с возможностью прикрепления/открепления карт, списания средств (после прикрепления карты или посредством OTP), автоматического списания, холдирования, безакцептного списания со всех карт плательщика по ПИНФЛ, а также скоринга по карте и ПИНФЛ.
- Взаимодействие по протоколу **HTTPS**, все ответы — **JSON**.
- Аутентификация — **Basic** (логин:пароль в Base64).

| | URL |
|---|---|
| Адрес Web-сервиса (разработка и тестирование) | `https://pay.myuzcard.uz` |
| Базовый URL (`$baseUrl`) | `https://pay.myuzcard.uz/api` |

**Обязательные заголовки запроса:**

| Заголовок | Значение |
|---|---|
| Content-Type | `application/json; charset=utf-8` |
| Accept | `application/json` |
| Authorization | `Basic <Base64(логин:пароль)>` |
| Language | Язык ошибок: `ru` / `uz` (кириллица) / `en`. Без заголовка — русский |

**Формат ответа (общая обёртка):**

| Поле | Описание |
|---|---|
| result | Данные, которые вернул метод. При ошибке — `null` |
| error | Данные ошибки `{ errorCode, errorMessage }`. При успехе — `null` |

**Признак «О*»** в таблицах входящих параметров — обязательность поля (Да / Нет).

---

## Модуль BRANCHEPOS

### 1. GetClientBranches — Получение списка филиалов партнера

**GET** `$baseUrl/branchEpos/GetClientBranches`

Без параметров.

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| id | Long | ID филиала |
| label | String | Наименование филиала |

Ответ: `result.items[]` + `result.allCount`.

---

### 2. GetBranchEpos — Получение данных E-POS по филиалу

**GET** `$baseUrl/branchEpos/GetBranchEpos`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| branchId | Long | Нет | ID филиала |

#### Параметры ответа (`result.items[]`)

| Параметр | Тип | Описание |
|---|---|---|
| id | Int | ID E-POS |
| branchId | Int | ID филиала |
| branchName | String | Наименование филиала |
| merchantId | String | MerchantID E-POS |
| terminalId | String | TerminalID E-POS |
| name | String | Наименование E-POS |
| eposType | Int | Тип E-POS |
| eposTypeComment | String | Описание типа E-POS |
| emitterType | Int | Тип эмитента E-POS (0 — Uzcard, 1 — Humo) |
| emitterTypeComment | String | Описание типа эмитента E-POS |
| isActive | Bool | Активен ли E-POS |

---

## Модуль CARDS

### 1. CreateUserCard — Попытка прикрепления карты

**POST** `$baseUrl/UserCard/createUserCard`

Метод позволяет прикрепить карту. На номер телефона, на который подключено СМС-информирование, отправляется код подтверждения.

> Примечание: если передано поле `pinfl`, при подтверждении карта будет проверена на принадлежность указанному ПИНФЛ. Применимо только к картам Uzcard и кобейдж-Uzcard.

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| userId | String | Да | Идентификатор пользователя на стороне клиента |
| cardNumber | String | Да | Номер карты |
| expireDate | String | Да | Срок действия карты (ГГММ) |
| userPhone | String | Да | Номер телефона пользователя |
| pinfl | String | Нет | ПИНФЛ клиента (см. примечание) |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| session | Long | Сессия запроса |
| otpSentPhone | String | Номер, на который отправлен код подтверждения (маскированный) |

---

### 2. GetCardOwnerInfoByPan — Получение данных владельца карты

**POST** `$baseUrl/UserCard/getCardOwnerInfoByPan`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| cardNumber | String | Да | Номер карты |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| cardNumber | String | Маскированный номер карты |
| owner | String | ФИО владельца в маскированном виде |
| bankName | String | Название банка (в примере вложено в объект `bankInfo`) |

---

### 3. ConfirmUserCardCreate — Подтверждение прикрепления карты

**POST** `$baseUrl/UserCard/confirmUserCardCreate`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| session | Long | Да | Сессия запроса |
| otp | String | Да | Код подтверждения, полученный через СМС |
| isTrusted | Int | Нет | 1 — доверять, 0 — не доверять. При 1 все последующие операции проводятся без подтверждения; иначе каждая транзакция должна быть подтверждена OTP |
| cardName | String | Нет | Название карты |

#### Параметры ответа (`result.card`)

| Параметр | Тип | Описание |
|---|---|---|
| id | Long | Идентификатор прикрепления |
| userId | String | Идентификатор пользователя на стороне клиента |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| owner | String | Имя владельца карты |
| cardName | String | Название карты |
| number | String | Номер карты (маскированный) |
| balance | Decimal | Баланс карты |
| expireDate | String | Срок действия карты (ГГММ) |
| status | Int | Статус карты |
| errorCode | Int | Код ошибки |
| errorMessage | String | Описание ошибки |
| isTrusted | Int | Доверенный аккаунт |

---

### 4. GetAllUserCards — Получение списка прикрепленных карт пользователя

**GET** `$baseUrl/UserCard/getAllUserCards`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| userId | String | Да | Идентификатор пользователя на стороне клиента |

#### Параметры ответа (`result.cards[]`)

| Параметр | Тип | Описание |
|---|---|---|
| id | Long | Идентификатор прикрепления |
| userId | String | Идентификатор пользователя на стороне клиента |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| owner | String | Имя владельца карты |
| cardName | String | Название карты |
| number | String | Номер карты (маскированный) |
| balance | Decimal | Баланс карты |
| expireDate | String | Срок действия карты (ГГММ) |
| status | Int | Статус карты |
| errorCode | Int | Код ошибки |
| errorMessage | String | Описание ошибки |
| isTrusted | Int | Доверенный аккаунт |
| isSmsActivated | Boolean | Статус подключения услуги СМС-информирования |
| pcType | Int | Тип эмитента карты (0 — Uzcard, 1 — Humo) |

---

### 5. GetUserCardsBalances — Получение баланса карт по выбранным пользователям

**POST** `$baseUrl/UserCard/getUserCardsBalances`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| (без названия, тело запроса) | List\<String\> | Да | Список идентификаторов пользователей на стороне клиента, например `["1", "2"]` |

#### Параметры ответа (`result.userCards[]`, внутри — `cards[]`)

| Параметр | Тип | Описание |
|---|---|---|
| userId | String | Идентификатор пользователя на стороне клиента |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| balance | Decimal | Баланс карты |
| cardStatus | Int | Статус карты |
| statusComment | String | Описание статуса карты |

---

### 6. GetUserCardsBalancesById — Получение баланса выбранных карт

**POST** `$baseUrl/UserCard/getUserCardsBalancesById`

#### Входящие параметры (массив объектов)

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| userId | String | Да | Идентификатор пользователя на стороне клиента |
| cardId | Long | Да | Идентификатор карты в системе My Uzcard |

#### Параметры ответа (`result.userCards[]`)

| Параметр | Тип | Описание |
|---|---|---|
| userId | String | Идентификатор пользователя на стороне клиента |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| balance | Decimal | Баланс карты |
| cardStatus | Int | Статус карты |
| statusComment | String | Описание статуса карты |

---

### 7. GetUserCardInfo — Получение информации по выбранной карте

**GET** `$baseUrl/UserCard/getUserCardInfo`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| userId | String | Да | Идентификатор пользователя на стороне клиента |
| cardId | Long | Да | Идентификатор карты в системе My Uzcard |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| id | Long | Идентификатор прикрепления |
| isSmsActivated | Boolean | Статус подключения услуги СМС-информирования |
| userId | String | Идентификатор пользователя на стороне клиента |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| owner | String | Имя владельца карты |
| cardName | String | Название карты |
| number | String | Номер карты (маскированный) |
| balance | Decimal | Баланс карты |
| expireDate | String | Срок действия карты (ГГММ) |
| status | Int | Статус карты |
| errorCode | Int | Код ошибки |
| errorMessage | String | Описание ошибки |
| isTrusted | Int | Доверенный аккаунт |
| pcType | Int | Тип эмитента карты (0 — Uzcard, 1 — Humo) |

---

### 8. DeleteUserCard — Открепление карты пользователя

**DELETE** `$baseUrl/UserCard/deleteUserCard`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| userCardId | Long | Да | Идентификатор привязки карты (поле `id` из метода getAllUserCards) |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| success | Boolean | Статус выполнения запроса |

---

### 9. ResendOtp — Повторная отправка OTP

**GET** `$baseUrl/UserCard/resendOtp`

> Примечание: метод применим ко всем операциям, где подразумевается отправка OTP. Нельзя повторно отправить OTP, если ещё не прошло 2 минуты с момента последней отправки, а также если прошло больше 5 минут. По выполнении запроса вернётся новая сессия запроса.

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| session | Long | Да | Сессия запроса |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| session | Long | Новая сессия запроса |
| otpSentPhone | String | Номер телефона, на который отправлен код подтверждения |

---

### 10. CheckCardPinfl — Проверка принадлежности карты заданному ПИНФЛ

**POST** `$baseUrl/UserCard/CheckCardPinfl`

> Примечание: метод работает исключительно с картами Uzcard.

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| cardId | Long | Да | Идентификатор карты в системе My Uzcard |
| pinfl | String | Да | ПИНФЛ |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| doesMatch | Boolean | Индикатор принадлежности |

---

## Модуль PAYMENT

### 1. PaymentWithoutRegistration — Транзакция без регистрации

**POST** `$baseUrl/Payment/paymentWithoutRegistration`

Метод позволяет создать запрос на проведение транзакции без регистрации (подтверждается через OTP методом ConfirmPayment).

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| amount | Decimal | Да | Сумма (в сумах) |
| cardNumber | String | Да | Номер карты |
| expireDate | String | Да | Срок действия карты (ГГММ) |
| extraId | String | Да | Дополнительный идентификатор на стороне клиента (уникален для каждой транзакции) |
| transactionData | String | Нет | Дополнительная информация по платежу |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| session | Long | Сессия запроса |
| transactionId | Long | Идентификатор транзакции в системе My Uzcard |
| otpSentPhone | String | Номер телефона, на который отправлен код подтверждения |
| error | String | Описание ошибки |

---

### 2. Payment — Транзакция при прикрепленной карте

**POST** `$baseUrl/Payment/payment`

> Примечание: если при прикреплении карты было отправлено `isTrusted=0` (не доверять) или поле `sendOtp` установлено в `true`, отправится СМС с кодом подтверждения (ответ такой же, как в paymentWithoutRegistration), и транзакцию нужно подтвердить методом ConfirmPayment. Иначе транзакция будет выполнена сразу.

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| userId | String | Да | Идентификатор пользователя на стороне клиента |
| cardId | Long | Да | Идентификатор карты в системе My Uzcard |
| amount | Decimal | Да | Сумма в сумах |
| extraId | String | Да | Дополнительный идентификатор на стороне клиента (уникален для каждой транзакции) |
| sendOtp | Boolean | Нет | Необходимость отправки кода подтверждения платежа |
| transactionData | String | Нет | Дополнительная информация по платежу |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| transactionId | Long | Идентификатор транзакции в системе My Uzcard |
| utrno | String | Номер транзакции в процессинговом центре |
| terminalId | String | Идентификатор терминала |
| merchantId | String | Идентификатор продавца |
| cardNumber | String | Номер карты в маскированном виде |
| date | DateTime | Дата и время транзакции |

---

### 3. ConfirmPayment — Подтверждение транзакции

**POST** `$baseUrl/Payment/confirmPayment`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| session | Long | Да | Сессия запроса |
| otp | String | Да | Код подтверждения |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| transactionId | Long | Идентификатор транзакции в системе My Uzcard |
| utrno | String | Номер транзакции в процессинговом центре |
| status | Int | Статус операции |
| statusComment | String | Описание статуса транзакции |
| terminalId | String | Идентификатор терминала |
| merchantId | String | Идентификатор продавца |
| cardNumber | String | Номер карты в маскированном виде |
| date | DateTime | Дата и время транзакции |
| amount | Decimal | Сумма транзакции |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| commission | Decimal | Комиссия транзакции |
| totalAmount | Decimal | Общая сумма транзакции с комиссией |
| transactionData | String | Дополнительная информация по платежу |

---

### 4. PaymentReverse — Возврат средств

**POST** `$baseUrl/Payment/paymentReverse`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| transactionId | Long | Да | Идентификатор транзакции в системе My Uzcard |

#### Параметры ответа (`result.transaction`)

| Параметр | Тип | Описание |
|---|---|---|
| id | Long | Идентификатор транзакции в системе My Uzcard |
| userId | String | Идентификатор пользователя на стороне клиента |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| isCredit | Boolean | Кредитовая ли операция или дебетовая |
| cardNumber | String | Номер карты в маскированном виде |
| utrno | String | Номер транзакции в процессинговом центре |
| amount | Decimal | Сумма |
| totalAmount | Decimal | Итоговая сумма с комиссией |
| extraId | String | Идентификатор транзакции на стороне клиента |
| createdDate | DateTime | Время начала проведения транзакции |
| finishedDate | DateTime | Время окончания проведения транзакции |
| status | Int | Статус операции |
| statusComment | String | Описание статуса транзакции |
| type | Int | Тип транзакции |
| typeComment | String | Описание типа транзакции |
| merchantId | String | Идентификатор продавца |
| terminalId | String | Идентификатор терминала |
| embosName | String | Владелец карты |
| totalTransactions | Int | Количество транзакций по выбранным фильтрам |

---

### 5. ReversePartial — Частичный возврат средств

**POST** `$baseUrl/Payment/reversePartial`

> Примечание: метод работает только для карт Uzcard.

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| transactionId | Long | Да | Идентификатор транзакции в системе My Uzcard |
| reverseAmount | Decimal | Да | Сумма частичного возврата |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| transactionId | Long | Идентификатор транзакции в системе My Uzcard |
| utrno | String | Номер транзакции в процессинговом центре |
| status | Int | Статус операции |
| statusComment | String | Описание статуса транзакции |
| terminalId | String | Идентификатор терминала |
| merchantId | String | Идентификатор продавца |
| cardNumber | String | Номер карты в маскированном виде |
| date | DateTime | Дата и время транзакции |
| amount | Decimal | Сумма транзакции |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| commission | Decimal | Комиссия транзакции |
| totalAmount | Decimal | Общая сумма транзакции с комиссией |
| transactionData | String | Дополнительная информация по платежу |

---

### 6. GetTransactions — Получение списка транзакций

**POST** `$baseUrl/Payment/getTransactions`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| userId | String | Нет | Идентификатор пользователя на стороне клиента |
| transactionId | Long | Нет | Идентификатор транзакции в системе My Uzcard |
| beginDate | DateTime | Да | Дата начала |
| endDate | DateTime | Да | Дата конца |
| page | Int | Да | Страница |
| count | Int | Да | Количество элементов на одной странице |
| transactionStatus | Int | Нет | Статус транзакции |
| IsWithRegistration | Nullable boolean | Нет | Только с регистрацией или без (null для общего списка) |

#### Параметры ответа (`result.transactions[]` + `result.totalTransactions`)

| Параметр | Тип | Описание |
|---|---|---|
| id | Long | Идентификатор транзакции в системе My Uzcard |
| userId | String | Идентификатор пользователя на стороне клиента |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| isCredit | Boolean | Кредитовая ли операция или дебетовая |
| cardNumber | String | Номер карты в маскированном виде |
| utrno | String | Номер транзакции в процессинговом центре |
| amount | Decimal | Сумма |
| totalAmount | Decimal | Итоговая сумма с комиссией |
| extraId | String | Идентификатор транзакции на стороне клиента |
| createdDate | DateTime | Время начала проведения транзакции |
| finishedDate | DateTime | Время окончания проведения транзакции |
| status | Int | Статус операции |
| statusComment | String | Описание статуса транзакции |
| type | Int | Тип транзакции |
| typeComment | String | Описание типа транзакции |
| merchantId | String | Идентификатор продавца |
| terminalId | String | Идентификатор терминала |
| embosName | String | Владелец карты |
| totalTransactions | Int | Количество транзакций по выбранным фильтрам |

---

### 7. GetTransactionByExt — Получение транзакции по extraId / transactionId

**GET** `$baseUrl/Payment/getTransactionByExt`

Метод позволяет получить данные транзакции по `extraId` или `transactionId`. Данный метод также обновляет статус транзакции при условных статусах.

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| extraId | String | Да/Нет | Дополнительный идентификатор на стороне клиента |
| transactionId | Long | Да/Нет | Идентификатор транзакции в системе My Uzcard |

(достаточно одного из двух параметров)

#### Параметры ответа (`result.transaction`)

Состав полей идентичен ответу метода GetTransactions.

---

## Модуль PAYMENT HOLD

### 1. CreateHold — Создание запроса на холдирование средств

**POST** `$baseUrl/Hold/CreateHold`

> Примечание: если поле `sendOtp` отправить равным `true`, результатом операции вернётся `sessionId` (сессия запроса), `transactionId` и `otpSentPhone`. Средства холдируются: карты Uzcard — на 30 дней, Humo — на 7 дней.

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| userId | String | Да | Идентификатор пользователя на стороне клиента |
| cardId | Long | Да | Идентификатор карты в системе My Uzcard |
| amount | Decimal | Да | Сумма для холдирования |
| extraId | String | Да | Идентификатор транзакции на стороне клиента (уникален для каждой транзакции) |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| transactionId | Long | Идентификатор транзакции в системе My Uzcard |
| holdId | Long | Идентификатор холдирования в системе My Uzcard |

---

### 2. ConfirmCreateHold — Подтверждение запроса на холдирование

**POST** `$baseUrl/Hold/ConfirmCreateHold`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| session | Long | Да | Сессия запроса |
| otp | String | Да | Код подтверждения |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| transactionId | Long | Идентификатор транзакции в системе My Uzcard |
| holdId | Long | Идентификатор холдирования в системе My Uzcard |

---

### 3. DismissHeldTransaction — Расхолдирование средств

**POST** `$baseUrl/Hold/DismissHeldTransaction`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| transactionId | Long | Да | Идентификатор транзакции в системе My Uzcard |
| holdId | Long | Да | Идентификатор холдирования в системе My Uzcard |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| success | Boolean | Статус успешности выполнения запроса |

---

### 4. ChargeHold — Снятие средств с холдирования

**POST** `$baseUrl/Hold/ChargeHold`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| transactionId | Long | Да | Идентификатор транзакции в системе My Uzcard |
| holdId | Long | Да | Идентификатор холдирования в системе My Uzcard |
| chargeAmount | Decimal | Да | Сумма для снятия с холдирования на E-POS продавца (может быть меньше захолдированной) |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| transactionId | Long | Идентификатор транзакции в системе My Uzcard |
| holdId | Long | Идентификатор холдирования в системе My Uzcard |
| utrno | String | Номер транзакции в процессинговом центре |
| terminalId | String | Идентификатор терминала |
| merchantId | String | Идентификатор продавца |
| cardNumber | String | Номер карты в маскированном виде |
| date | DateTime | Дата совершения операции |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| amount | Decimal | Сумма |
| commission | Decimal | Комиссия |
| totalAmount | Decimal | Общая сумма с комиссией |

---

## Модуль SCORING

Состав методов:

| Метод | Назначение |
|---|---|
| CreateScoringCard | Создание скоринга по карте (Uzcard) |
| CreateScoringAmount | Создание скоринга по карте и сумме (Uzcard) |
| ScoringGetMonth | Получение отчета о приходах на карту по месяцам (Uzcard) |
| ScoringGetPoint | Получение результата скоринга по шаблону (Uzcard) |
| HumoScoring | Получение отчета о приходах на карту по месяцам (Humo) |
| GetTaxDebtScore | Получение данных по задолженностям по налогам |
| GetEbDebtScore | Получение данных по задолженностям по Бюро принудительного исполнения |
| HumoScoringAvg | Получение отчета о приходах на карту (среднее, Humo) |
| HumoScoringMonth | Получение отчета по картам Humo по поступлениям на карту по месяцам |
| CreateScoringByPersonCodeByCard | Создание скоринга по ПИНФЛ в разрезе карт (Uzcard) |
| CreateScoringByPersonCodeSummary | Создание скоринга по ПИНФЛ (агрегировано) (Uzcard) |
| ConfirmCreateScoring | Подтверждение создания скоринга |
| GetScoringByPersonCodeByCard | Получение значения скоринга по ПИНФЛ в разрезе карт (Uzcard) |
| GetScoringByPersonCodeSummary | Получение значения скоринга по ПИНФЛ (агрегировано) (Uzcard) |
| CreateHumoScoringCardsByPersonCodeByCard | Создание скоринга по ПИНФЛ в разрезе карт и месяцев (Humo) |
| CreateHumoScoringCardsByPersonCodeByCardSummary | Создание скоринга по ПИНФЛ в разрезе карт (Humo) |
| CreateHumoScoringCardsByPersonCodeSummary | Создание скоринга по ПИНФЛ в разрезе месяцев (Humo) |
| CreateHumoScoringCardsByPersonCodeTotalSummary | Создание скоринга по ПИНФЛ (агрегировано) (Humo) |
| GetHumoScoringCardsByPersonCodeByCard | Получение значения скоринга по ПИНФЛ в разрезе карт и месяцев (Humo) |
| GetHumoScoringCardsByPersonCodeByCardSummary | Получение значения скоринга по ПИНФЛ в разрезе карт (Humo) |
| GetHumoScoringCardsByPersonCodeSummary | Получение значения скоринга по ПИНФЛ в разрезе месяцев (Humo) |
| GetHumoScoringCardsByPersonCodeTotalSummary | Получение значения скоринга по ПИНФЛ (агрегировано) (Humo) |

### 1. CreateScoringCard — Создание скоринга по карте (Uzcard)

**POST** `$baseUrl/Scoring/createScoringCard`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| cardId | Long | Да | Идентификатор карты в системе My Uzcard |
| templateId | Long | Да | ID шаблона скоринга |
| beginDate | DateTime | Да | Дата начала |
| endDate | DateTime | Да | Дата конца |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| scoringId | Long | Идентификатор скоринга |

---

### 2. CreateScoringAmount — Создание скоринга по карте и сумме (Uzcard)

**POST** `$baseUrl/Scoring/createScoringAmount`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| cardId | Long | Да | Идентификатор карты в системе My Uzcard |
| templateId | Long | Да | ID шаблона скоринга |
| amount | Decimal | Да | Сумма |
| beginDate | DateTime | Да | Дата начала |
| endDate | DateTime | Да | Дата конца |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| scoringId | Long | Идентификатор скоринга |

---

### 3. ScoringGetMonth — Отчет о приходах на карту по месяцам (Uzcard)

**GET** `$baseUrl/Scoring/scoringGetMonth`

Используется идентификатор скоринга, полученный в методе CreateScoringAmount.

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| scoringId | Long | Да | Идентификатор скоринга |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| values | Dictionary\<String, Boolean\> | Ключ — месяц (`"2021.06"`); `true` — указанная в amount сумма поступила на карту, `false` — в противном случае |
| scoringId | Long | Идентификатор скоринга |

---

### 4. ScoringGetPoint — Результат скоринга по шаблону (Uzcard)

**GET** `$baseUrl/Scoring/scoringGetPoint`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| scoringId | Long | Да | Идентификатор скоринга |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| maxScoreBall | Number | Максимально возможное количество баллов |
| scoredBall | Number | Набранное количество баллов |
| jsonBody | String | JSON-строка с детализацией (`total_items`, `total_ball`, `earned_ball`, `items[]` с `templ_id`, `templ_name`, `templ_option`, `templ_ball`) |
| scoreList | List\<object\> | Результаты скоринга: `templateName`, `categoryName`, `ball`, `scoringId` |
| scoringId | Long | Идентификатор скоринга |

Примеры критериев в scoreList: возраст, % соотношение доход/расход за период, количество активных карт, средние ежемесячные расходы/поступления, максимальное поступление, сумма максимального разового расхода, блокировка карты, среднее ежемесячное количество запросов на скоринг, средняя ежемесячная сумма обналичивания (см. справочник «Категории шаблонов скоринга»).

---

### 5. HumoScoring — Отчет о приходах на карту по месяцам (Humo)

**POST** `$baseUrl/Scoring/HumoScoring`

> Примечание: значения баллов см. в справочнике «Баллы скоринга (Humo)».

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| cardId | Long | Да | Идентификатор карты в системе My Uzcard |
| startDate | DateTime | Да | Дата начала |
| endDate | DateTime | Да | Дата конца |

#### Параметры ответа (`result` + `result.report[]`)

| Параметр | Тип | Описание |
|---|---|---|
| cardNumber | String | Номер карты в маскированном виде |
| fullName | String | Владелец карты |
| connectedPhone | String | Номер телефона СМС-информирования (маскированный) |
| month | Int | Месяц (в порядке возрастания по дате) |
| totalDebitScore | Int | Балл общего расхода |
| totalDebitCount | Int | Количество транзакций по расходам |
| replenishmentScore | Int | Балл пополнения со счета |
| replenishmentCount | Int | Количество пополнений карты со счета |
| creditScore | Int | Балл поступлений на карту (переводы, пополнения через АТМ) |
| creditCount | Int | Количество поступлений на карту |

---

### 6. GetTaxDebtScore — Задолженности по налогам

**GET** `$baseUrl/Scoring/GetTaxDebtScore`

> Примечание: значения баллов см. в справочнике «Баллы скоринга по задолженностям».

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| pinfl | String | Да | ПИНФЛ клиента |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| debtBal | Int | Балл задолженности |

---

### 7. GetEbDebtScore — Задолженности по Бюро принудительного исполнения

**GET** `$baseUrl/Scoring/GetEbDebtScore`

> Примечание: значения баллов см. в справочнике «Баллы скоринга по задолженностям».

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| pinfl | String | Да | ПИНФЛ клиента |
| phone | String | Да | Номер телефона клиента |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| debtBal | Int | Балл задолженности |

---

### 8. HumoScoringAvg — Отчет о приходах на карту (среднее, Humo)

**POST** `$baseUrl/Scoring/HumoScoringAvg`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| cardId | Long | Да | Идентификатор карты в системе My Uzcard |
| startDate | DateTime | Да | Дата начала |
| endDate | DateTime | Да | Дата конца |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| month | Int | Всегда возвращается 0 |
| totalDebitScore | Int | Балл общего расхода |
| totalDebitCount | Int | Количество транзакций по расходам |
| replenishmentScore | Int | Балл пополнения со счета |
| replenishmentCount | Int | Количество пополнений карты со счета |
| creditScore | Int | Балл поступлений на карту (переводы, пополнения через АТМ) |
| creditCount | Int | Количество поступлений на карту |

---

### 9. HumoScoringMonth — Поступления на карту Humo по месяцам

**POST** `$baseUrl/Scoring/HumoScoringMonth`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| cardId | Long | Да | Идентификатор карты в системе My Uzcard |
| startDate | DateTime | Да | Дата начала |
| endDate | DateTime | Да | Дата конца |
| amount | Decimal | Да | Сумма для проверки в сумах |

#### Параметры ответа (`result` + `result.report[]`)

| Параметр | Тип | Описание |
|---|---|---|
| cardNumber | String | Номер карты в маскированном виде |
| fullName | String | Владелец карты |
| connectedPhone | String | Номер телефона СМС-информирования (маскированный) |
| month | Int | Месяц |
| hasCredit | Boolean | Было ли достаточных поступлений на карту в данный месяц |

---

### 10. CreateScoringByPersonCodeByCard / CreateScoringByPersonCodeSummary — Создание скоринга по ПИНФЛ (Uzcard)

**POST** `$baseUrl/Scoring/CreateScoringByPersonCodeByCard` — скоринг по ПИНФЛ в разрезе карт
**POST** `$baseUrl/Scoring/CreateScoringByPersonCodeSummary` — скоринг по ПИНФЛ (агрегировано)

Входящие и ответные параметры обоих методов идентичны. Создание подтверждается методом ConfirmCreateScoring.

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| personCode | String | Да | ПИНФЛ клиента |
| templateId | Int | Да | Идентификатор шаблона для скоринга |
| beginDate | DateTime | Да | Дата начала для скоринга |
| endDate | DateTime | Да | Дата окончания для скоринга |
| phoneNumber | String | Да | Номер телефона клиента |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| session | Int | Сессия запроса |
| otpSentPhone | String | Номер телефона, на который отправляется OTP-код |

---

### 11. ConfirmCreateScoring — Подтверждение создания скоринга

**POST** `$baseUrl/Scoring/ConfirmCreateScoring`

Используется для подтверждения всех Create*-методов скоринга по ПИНФЛ (Uzcard и Humo).

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| session | Int | Да | Сессия запроса |
| otp | String | Да | OTP |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| scoringId | Int | Идентификатор скоринга |

---

### 12. GetScoringByPersonCodeByCard — Значение скоринга по ПИНФЛ в разрезе карт (Uzcard)

**GET** `$baseUrl/Scoring/GetScoringByPersonCodeByCard`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| scoringId | Int | Да | Идентификатор скоринга |

#### Параметры ответа (`result.items[]`: `cardNumber` + `data[]`)

| Параметр | Тип | Описание |
|---|---|---|
| cardNumber | String | Маскированный номер карты |
| category | String | Категория критерия (см. справочник «Категории шаблонов скоринга») |
| templateDetails | String | Описание критерия |
| ball | Int | Значение |

---

### 13. GetScoringByPersonCodeSummary — Значение скоринга по ПИНФЛ, агрегировано (Uzcard)

**GET** `$baseUrl/Scoring/GetScoringByPersonCodeSummary`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| scoringId | Int | Да | Идентификатор скоринга |

#### Параметры ответа (`result.items[]`)

| Параметр | Тип | Описание |
|---|---|---|
| category | String | Категория критерия (см. справочник «Категории шаблонов скоринга») |
| templateDetails | String | Описание критерия |
| ball | Int | Значение |

---

### 14. CreateHumoScoringCardsByPersonCode* — Создание скоринга по ПИНФЛ (Humo)

Четыре метода с идентичными входящими и ответными параметрами (различаются только разрезом результата, который затем запрашивается соответствующим Get*-методом):

| Метод (POST) | Разрез |
|---|---|
| `$baseUrl/Scoring/CreateHumoScoringCardsByPersonCodeByCard` | в разрезе карт и месяцев |
| `$baseUrl/Scoring/CreateHumoScoringCardsByPersonCodeByCardSummary` | в разрезе карт |
| `$baseUrl/Scoring/CreateHumoScoringCardsByPersonCodeSummary` | в разрезе месяцев |
| `$baseUrl/Scoring/CreateHumoScoringCardsByPersonCodeTotalSummary` | агрегировано |

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| phoneNumber | String | Да | Номер телефона клиента |
| personCode | String | Да | ПИНФЛ клиента |
| beginDate | DateTime | Да | Дата начала для скоринга |
| endDate | DateTime | Да | Дата окончания для скоринга |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| session | Int | Сессия запроса |
| otpSentPhone | String | Номер телефона, на который отправляется OTP-код |

Далее — подтверждение через ConfirmCreateScoring, затем получение значения соответствующим Get*-методом по `scoringId`.

---

### 15. GetHumoScoringCardsByPersonCodeByCard — Скоринг по ПИНФЛ в разрезе карт и месяцев (Humo)

**GET** `$baseUrl/Scoring/GetHumoScoringCardsByPersonCodeByCard`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| scoringId | Int | Да | Идентификатор скоринга |

#### Параметры ответа (`result.items[]`: `cardNumber` + `data[]` по месяцам)

| Параметр | Тип | Описание |
|---|---|---|
| cardNumber | String | Маскированный номер карты |
| month | Int | Месяц |
| totalDebitScore | Int | Балл общего расхода |
| totalDebitCount | Int | Количество транзакций по расходам |
| replenishmentScore | Int | Балл пополнения со счета |
| replenishmentCount | Int | Количество пополнений карты со счета |
| creditScore | Int | Балл поступлений на карту (переводы, пополнения через АТМ) |
| creditCount | Int | Количество поступлений на карту |

---

### 16. GetHumoScoringCardsByPersonCodeByCardSummary — Скоринг по ПИНФЛ в разрезе карт (Humo)

**GET** `$baseUrl/Scoring/GetHumoScoringCardsByPersonCodeByCardSummary`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| scoringId | Int | Да | Идентификатор скоринга |

#### Параметры ответа (`result.item[]`: `cardNumber` + `data`)

| Параметр | Тип | Описание |
|---|---|---|
| cardNumber | String | Маскированный номер карты |
| month | Int | Количество месяцев, в течение которых проводились транзакции |
| totalDebitScore | Int | Балл общего расхода |
| totalDebitCount | Int | Количество транзакций по расходам |
| replenishmentScore | Int | Балл пополнения со счета |
| replenishmentCount | Int | Количество пополнений карты со счета |
| creditScore | Int | Балл поступлений на карту (переводы, пополнения через АТМ) |
| creditCount | Int | Количество поступлений на карту |

---

### 17. GetHumoScoringCardsByPersonCodeSummary — Скоринг по ПИНФЛ в разрезе месяцев (Humo)

**GET** `$baseUrl/Scoring/GetHumoScoringCardsByPersonCodeSummary`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| scoringId | Int | Да | Идентификатор скоринга |

#### Параметры ответа (`result.item[]` по месяцам)

| Параметр | Тип | Описание |
|---|---|---|
| cardCount | Int | Количество карт, по которым проводились транзакции |
| month | Int | Месяц |
| totalDebitScore | Int | Балл общего расхода |
| totalDebitCount | Int | Количество транзакций по расходам |
| replenishmentScore | Int | Балл пополнения со счета |
| replenishmentCount | Int | Количество пополнений карты со счета |
| creditScore | Int | Балл поступлений на карту (переводы, пополнения через АТМ) |
| creditCount | Int | Количество поступлений на карту |

---

### 18. GetHumoScoringCardsByPersonCodeTotalSummary — Скоринг по ПИНФЛ, агрегировано (Humo)

**GET** `$baseUrl/Scoring/GetHumoScoringCardsByPersonCodeTotalSummary`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| scoringId | Int | Да | Идентификатор скоринга |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| cardCount | Int | Количество карт, по которым проводились транзакции |
| month | Int | Количество месяцев, в течение которых проводились транзакции |
| totalDebitScore | Int | Балл общего расхода |
| totalDebitCount | Int | Количество транзакций по расходам |
| replenishmentScore | Int | Балл пополнения со счета |
| replenishmentCount | Int | Количество пополнений карты со счета |
| creditScore | Int | Балл поступлений на карту (переводы, пополнения через АТМ) |
| creditCount | Int | Количество поступлений на карту |

---

## Модуль FISCAL

### 1. RegisterFiscal — Отправка фискального чека для привязки к транзакции

**POST** `$baseUrl/Fiscal/RegisterFiscal`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| transactionId | Long | Да | Идентификатор транзакции в системе My Uzcard |
| fiscalUrl | String | Да | URL фискального чека |
| refundType | Int | Да | Тип чека (0 — оплата, 1 — возврат) |

> Примечание: в примере запроса из PDF поля `fiscalUrl`/`refundType` передаются массивом `fiscals: [{ fiscalUrl, refundType }, …]` — можно привязать несколько чеков за один вызов.

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| success | Boolean | Успешность выполнения операции |

---

## Модуль AUTOPAYMENT

Безакцептное списание средств со всех карт плательщика, привязанных к его ПИНФЛ, на основе контракта.

### 1. CreateClient — Создание сущности «клиент»

**POST** `$baseUrl/AutoPayment/CreateClient`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| userId | String | Да | Идентификатор пользователя на стороне клиента |
| pnfl | String | Да | ПИНФЛ |
| lastName | String | Да | Фамилия |
| firstName | String | Да | Имя |
| middleName | String | Да | Отчество |
| birthDate | DateTime | Да | Дата рождения |
| passportSeries | String | Да | Серия паспорта |
| passportNumber | String | Да | Номер паспорта |
| passportIssueDate | DateTime | Да | Дата выдачи паспорта |
| passportExpirationDate | DateTime | Да | Срок действия паспорта |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| autoPayClientId | String | Идентификатор клиента в модуле автосписания |

---

### 2. CreateContractWithOtp — Регистрация контракта клиента

**POST** `$baseUrl/AutoPayment/CreateContractWithOtp`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| autoPayClientId | String | Да | Идентификатор клиента в модуле автосписания |
| expiry | DateTime | Да | Срок действия контракта |
| amount | Decimal | Да | Общая сумма контракта |
| extraId | String | Да | Идентификатор контракта клиента на стороне партнера |
| description | String | Да | Описание контракта |
| creditNumber | String | Да | Номер контракта (только латинские буквы и цифры) |
| phoneNumber | String | Да | Номер телефона клиента |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| session | Int | Идентификатор сессии создания контракта |
| otpSentPhone | String | Номер телефона, куда был отправлен OTP для подтверждения контракта |

---

### 3. ConfirmCreatedContract — Подтверждение создания контракта

**POST** `$baseUrl/AutoPayment/ConfirmCreatedContract`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| extraId | String | Да | Идентификатор контракта клиента на стороне партнера |
| session | Int | Да | Идентификатор сессии создания контракта |
| otp | String | Да | OTP-код для подтверждения |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| autoPayClientId | String | Идентификатор клиента в модуле автосписания |
| autoPayContractId | String | Идентификатор контракта в модуле автосписания |

---

### 4. ContractPayment — Списание средств на основе контракта

**POST** `$baseUrl/AutoPayment/ContractPayment`

Метод позволяет списать средства на основе контракта со всех доступных карт Uzcard.

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| autoPayContractId | String | Да | Идентификатор контракта в модуле автосписания |
| amount | Decimal | Да | Сумма к списанию |
| extraId | String | Да | Дополнительный идентификатор на стороне клиента (уникален для каждой транзакции; для группы списаний по ПИНФЛ идентификатор общий) |
| transactionData | String | Да | Дополнительная информация по платежу (причина инициации списания) |
| isToDebitFullAmount | Boolean | Да | `true` — списать всю указанную сумму целиком либо не списывать вовсе; `false` — списать всю имеющуюся на картах сумму в рамках запроса |
| minAmount | Decimal | Нет | Минимальная сумма для списания |

#### Параметры ответа (`result` + `result.transactions[]`)

| Параметр | Тип | Описание |
|---|---|---|
| transactionCount | Int | Количество транзакций |
| sentAmount | Decimal | Полученная на списание сумма |
| debitAmount | Decimal | Фактически снятая сумма |
| reversedAmount | Decimal | Отмененная сумма |
| transactionId | Long | Идентификатор транзакции в системе My Uzcard |
| utrno | String | Номер транзакции в процессинговом центре |
| merchantId | String | Идентификатор продавца |
| terminalId | String | Идентификатор терминала |
| cardNumber | String | Номер карты в маскированном виде |
| createdDate | DateTime | Время создания запроса |
| date | DateTime | Время совершения текущей транзакции |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| amount | Decimal | Сумма |
| totalAmount | Decimal | Итоговая сумма с комиссией |
| commission | Decimal | Сумма комиссии |
| extraId | String | Идентификатор транзакции на стороне клиента |
| status | Int | Статус операции |
| statusComment | String | Описание статуса транзакции |
| transactionData | String | Дополнительная информация по платежу |

---

### 5. GetClient — Получение данных клиента

**GET** `$baseUrl/AutoPayment/GetClient`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| userId | String | Да | Идентификатор пользователя на стороне клиента |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| autoPayClientId | String | Идентификатор клиента в модуле автосписания |
| pnfl | String | ПИНФЛ |
| lastName | String | Фамилия |
| firstName | String | Имя |
| middleName | String | Отчество |
| birthDate | DateTime | Дата рождения |
| passportSeries | String | Серия паспорта |
| passportNumber | String | Номер паспорта |
| passportIssueDate | DateTime | Дата выдачи паспорта |
| passportExpDate | DateTime | Срок действия паспорта |

---

### 6. GetContracts — Получение списка контрактов клиента

**GET** `$baseUrl/AutoPayment/GetContracts`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| userId | String | Да | Идентификатор пользователя на стороне клиента |

#### Параметры ответа (`result.items[]` + `result.allCount`)

| Параметр | Тип | Описание |
|---|---|---|
| autoPayClientId | String | Идентификатор клиента в модуле автосписания |
| autoPayContractId | String | Идентификатор контракта в модуле автосписания |
| pnfl | String | ПИНФЛ |
| lastName | String | Фамилия |
| firstName | String | Имя |
| middleName | String | Отчество |
| birthDate | DateTime | Дата рождения |
| passportSeries | String | Серия паспорта |
| passportNumber | String | Номер паспорта |
| passportIssueDate | DateTime | Дата выдачи паспорта |
| passportExpDate | DateTime | Срок действия паспорта |
| expireDate | DateTime | Срок действия контракта |
| description | String | Описание контракта |
| amount | Decimal | Сумма контракта |
| ext | String | Идентификатор контракта клиента в системе партнера |
| status | Int | Статус контракта |
| creditNumber | String | Номер контракта |

---

### 7. GetContract — Получение данных конкретного контракта

**GET** `$baseUrl/AutoPayment/GetContract`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| autoPayContractId | String | Да | Идентификатор контракта в модуле автосписания |

#### Параметры ответа

Состав полей идентичен элементу ответа метода GetContracts.

---

### 8. CancelContract — Закрытие контракта

**GET** `$baseUrl/AutoPayment/CancelContract`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| autoPayContractId | String | Да | Идентификатор контракта в модуле автосписания |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| success | Boolean | Успешность выполнения запроса |

---

### 9. ContractPaymentCompletionStatus — Статус завершения списания по контракту

**GET** `$baseUrl/AutoPayment/ContractPaymentCompletionStatus`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| extraId | String | Да | Идентификатор списания на стороне клиента |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| isCompleted | Boolean | Статус завершения |

---

### 10. GetContractTransactions — Список транзакций по контракту

**GET** `$baseUrl/AutoPayment/GetContractTransactions`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| autoPayContractId | String | Да | Идентификатор контракта в модуле автосписания |

#### Параметры ответа (`result.items[]` + `result.allCount`)

| Параметр | Тип | Описание |
|---|---|---|
| transactionId | Long | Идентификатор транзакции в системе My Uzcard |
| utrno | String | Номер транзакции в процессинговом центре |
| terminalId | String | Идентификатор терминала |
| merchantId | String | Идентификатор продавца |
| cardNumber | String | Номер карты в маскированном виде |
| createdDate | DateTime | Время создания транзакции в системе My Uzcard |
| date | DateTime | Время фактического исполнения транзакции |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| amount | Decimal | Сумма транзакции |
| commission | Decimal | Комиссия |
| totalAmount | Decimal | Общая сумма транзакции |
| extraId | String | Идентификатор транзакции в системе партнера |
| status | Int | Статус транзакции |
| statusComment | String | Описание статуса транзакции |
| transactionData | String | Детали транзакции |

---

### 11. ContractPaymentReverse — Отмена транзакции автосписания

**POST** `$baseUrl/AutoPayment/ContractPaymentReverse`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| extraId | String | Да/Нет | Идентификатор транзакции в системе партнера |
| transactionId | Decimal | Да/Нет | Идентификатор транзакции в системе My Uzcard |

(достаточно одного из двух параметров)

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| transactionId | Long | Идентификатор транзакции в системе My Uzcard |
| utrno | String | Номер транзакции в процессинговом центре |
| terminalId | String | Идентификатор терминала |
| merchantId | String | Идентификатор продавца |
| cardNumber | String | Номер карты в маскированном виде |
| createdDate | DateTime | Время создания транзакции в системе My Uzcard |
| date | DateTime | Время фактического исполнения транзакции |
| cardId | Long | Идентификатор карты в системе My Uzcard |
| amount | Decimal | Сумма транзакции |
| commission | Decimal | Комиссия |
| totalAmount | Decimal | Общая сумма транзакции |
| extraId | String | Идентификатор транзакции в системе партнера |
| status | Int | Статус транзакции |
| statusComment | String | Описание статуса транзакции |
| transactionData | String | Дополнительная информация по платежу |
| cancelledDate | DateTime | Время отмены транзакции |

---

### 12. UpdateClientHumoCards / UpdateClientUzcardCards — Обновление списка карт клиента с ПЦ

**GET** `$baseUrl/AutoPayment/UpdateClientHumoCards` — карты Humo
**GET** `$baseUrl/AutoPayment/UpdateClientUzcardCards` — карты Uzcard

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| autoPayClientId | String | Да | Идентификационный номер клиента в модуле AutoPayment |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| jobId | Decimal | Идентификатор задачи для проверки статуса завершения |
| autoPayClientId | String | Идентификационный номер клиента в модуле AutoPayment |

---

### 13. CheckUpdateCards — Проверка завершения обновления списка карт

**GET** `$baseUrl/AutoPayment/CheckUpdateCards`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| jobId | Decimal | Да | Идентификатор задачи для проверки статуса завершения |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| isCompleted | Boolean | Выполнена ли задача |

---

### 14. ContractFullPayment — Списание средств на основе контракта (с выбором эмитента)

**POST** `$baseUrl/AutoPayment/ContractFullPayment`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| autoPayContractId | String | Да | Идентификатор контракта в модуле автосписания |
| amount | Decimal | Да | Сумма к списанию |
| extraId | String | Да | Дополнительный идентификатор на стороне клиента (уникален для каждой транзакции; для группы списаний по ПИНФЛ идентификатор общий) |
| transactionData | String | Да | Дополнительная информация по платежу (причина инициации списания) |
| isToDebitFullAmount | Boolean | Да | `true` — списать всю указанную сумму; `false` — списать всю имеющуюся на всех картах сумму в рамках запроса |
| emitterType | Decimal | Да | Тип эмитента карты для списания (0 — All, 1 — Uzcard, 2 — Humo) |

#### Параметры ответа

Состав полей идентичен ответу метода ContractPayment (`transactionCount`, `sentAmount`, `debitAmount`, `reversedAmount`, `transactions[]`).

---

## Модуль CREDIT

Пополнение карт Uzcard/Humo.

### 1. Credit — Пополнение карты

**POST** `$baseUrl/Credit/Credit`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| amount | Decimal | Да | Сумма в сумах |
| extraId | String | Да | Дополнительный идентификатор на стороне клиента (уникален для каждой транзакции) |
| cardNumber | String | Да | Номер карты |
| transactionData | String | Да | Дополнительная информация по платежу |
| pinfl | String | Да | ПИНФЛ |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| transactionId | Long | Идентификатор транзакции в системе MyUzcard |
| utrno | String | Номер транзакции в процессинговом центре |
| terminalId | String | Идентификатор терминала |
| merchantId | String | Идентификатор продавца |
| cardNumber | String | Номер карты в маскированном виде |
| createdDate | DateTime | Время начала проведения транзакции |
| date | DateTime | Дата и время транзакции |
| amount | Decimal | Сумма транзакции |
| extraId | String | Идентификатор транзакции на стороне партнера |
| status | Int | Статус операции |
| statusComment | String | Описание статуса транзакции |
| transactionData | String | Дополнительная информация по платежу (причина инициации пополнения) |

---

### 2. GetCardOwnerInfoByPan — Получение данных владельца карты

**POST** `$baseUrl/Credit/getCardOwnerInfoByPan`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| cardNumber | String | Да | Номер карты |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| cardNumber | String | Маскированный номер карты |
| owner | String | ФИО владельца в маскированном виде |
| bankName | String | Название банка (в примере вложено в объект `bankInfo`) |

---

### 3. CreditToSelfEmployed — Пополнение карты самозанятого лица

**POST** `$baseUrl/Credit/CreditToSelfEmployed`

> Примечание: метод проверяет статус самозанятости по ПИНФЛ.

Входящие и ответные параметры идентичны методу Credit.

---

### 4. ReverseCredit — Отмена транзакции пополнения

**POST** `$baseUrl/Credit/ReverseCredit`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| transactionId | Long | Да | Идентификатор транзакции в системе MyUzcard |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| transactionId | Long | Идентификатор транзакции в системе MyUzcard |
| utrno | String | Номер транзакции в процессинговом центре |
| terminalId | String | Идентификатор терминала |
| merchantId | String | Идентификатор продавца |
| cardNumber | String | Номер карты в маскированном виде |
| createdDate | DateTime | Время начала проведения транзакции |
| date | DateTime | Дата и время транзакции |
| amount | Decimal | Сумма транзакции |
| extraId | String | Идентификатор транзакции на стороне партнера |
| status | Int | Статус операции |
| statusComment | String | Описание статуса транзакции |
| cancelledDate | DateTime | Дата и время отмены транзакции |
| transactionData | String | Дополнительная информация по платежу |

---

### 5. GetCreditTransactions — Получение списка пополнений

**POST** `$baseUrl/Credit/GetCreditTransactions`

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| extraId | String | Нет | Дополнительный идентификатор на стороне клиента |
| cardId | Long | Нет | ID карты в системе MyUzcard |
| cardNumber | String | Нет | Номер карты |
| transactionId | Long | Нет | Идентификатор транзакции в системе MyUzcard |
| terminalId | String | Нет | Идентификатор терминала |
| merchantId | String | Нет | Идентификатор продавца |
| transactionData | String | Нет | Дополнительная информация по платежу |
| utrNo | String | Нет | Номер транзакции в процессинговом центре |
| beginDate | DateTime | Да | Начало периода |
| endDate | DateTime | Да | Конец периода |
| page | Int | Да | Номер страницы |
| count | Int | Да | Количество транзакций |
| transactionStatus | Int | Нет | Статус транзакции |
| isAll | Boolean | Да | Получить весь список или нет |
| pinfl | String | Нет | ПИНФЛ |

#### Параметры ответа (`result.items[]` + `result.allCount`)

| Параметр | Тип | Описание |
|---|---|---|
| id | Long | Идентификатор транзакции в системе MyUzcard |
| utrno | String | Номер транзакции в процессинговом центре |
| terminalId | String | Идентификатор терминала |
| merchantId | String | Идентификатор продавца |
| cardNumber | String | Номер карты в маскированном виде |
| createdDate | DateTime | Время начала проведения транзакции |
| finishedDate | DateTime | Дата и время транзакции |
| cancelledDate | DateTime | Дата и время отмены транзакции |
| amount | Decimal | Сумма транзакции |
| extraId | String | Идентификатор транзакции на стороне партнера |
| status | Int | Статус операции |
| statusComment | String | Описание статуса транзакции |
| transactionData | String | Дополнительная информация по платежу |
| allCount | Int | Общее количество транзакций по заданному фильтру |

---

### 6. GetCreditTransactionsExcel — Список пополнений для файла Excel

**POST** `$baseUrl/Credit/GetCreditTransactionsExcel`

Входящие параметры идентичны методу GetCreditTransactions.

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| base64String | String | Содержимое файла (Base64). Необходимо преобразовать в файл |

---

### 7. GetCreditTransactionByData — Данные по конкретному пополнению

**GET** `$baseUrl/Credit/GetCreditTransactionByData`

> Примечание: для получения данных можно использовать либо `transactionId`, либо `extraId`, либо оба.

#### Входящие параметры

| Параметр | Тип | О* | Описание |
|---|---|---|---|
| transactionId | Long | Да/Нет | Идентификатор транзакции в системе MyUzcard |
| extraId | String | Да/Нет | Дополнительный идентификатор на стороне клиента |

#### Параметры ответа

| Параметр | Тип | Описание |
|---|---|---|
| id | Long | Идентификатор транзакции в системе MyUzcard |
| utrno | String | Номер транзакции в процессинговом центре |
| terminalId | String | Идентификатор терминала |
| merchantId | String | Идентификатор продавца |
| cardNumber | String | Номер карты в маскированном виде |
| createdDate | DateTime | Время начала проведения транзакции |
| finishedDate | DateTime | Дата и время транзакции |
| cancelledDate | DateTime | Дата и время отмены транзакции |
| amount | Decimal | Сумма транзакции |
| extraId | String | Идентификатор транзакции на стороне партнера |
| status | Int | Статус операции |
| statusComment | String | Описание статуса транзакции |
| transactionData | String | Дополнительная информация по платежу |

---

## Справочники данных

### a. Статусы транзакций

| Значение | Описание |
|---|---|
| 0 | Создана |
| 1 | Успешно |
| 2 | Ошибка |
| 3 | Ошибка в ПЦ |
| 4 | Отменена |
| 6 | Требует проверки |
| 7 | Сумма захолдирована |
| 8 | Сумма расхолдирована |
| 9 | Требует отмены |
| 10 | Требует ручной проверки |
| 11 | Отменено администратором шлюза |
| 12 | Ошибка при автосписании |

### b. Статусы карт

| Значение | Описание |
|---|---|
| 0 | Активна |
| 1 | Превышен лимит ввода кода подтверждения |
| 2 | Заблокирована из-за ввода неверного PIN-кода |
| 3 | Временно заблокирована со стороны клиента |
| 4 | Заблокирована в ПЦ |
| 5 | Не удалось обновить данные |
| 6 | Истек срок действия карты |
| 7 | Неактивна |
| 8 | Заблокирована в My Uzcard |
| 9 | СМС-информирование отключено |
| 10 | Перевыпущена |

### c. Статусы контрактов (модуль AutoPayment)

| Значение | Описание |
|---|---|
| 0 | Контракт создан в системе My Uzcard, но не подтвержден в модуле автосписания |
| 1 | Контракт подтвержден в модуле автосписания |
| 2 | Контракт закрыт |

### d. Баллы скоринга (Humo)

| Значение | Описание |
|---|---|
| 0 | 0 сум |
| 1 | С 1 сума до 1 000 000 сум |
| 2 | С 1 000 000 сум до 2 000 000 сум |
| 3 | С 2 000 000 сум до 3 000 000 сум |
| 4 | С 3 000 000 сум до 4 000 000 сум |
| N | С (N − 1) × 1 000 000 сум до N × 1 000 000 сум |

### e. Баллы скоринга по задолженностям

| Значение | Описание |
|---|---|
| 0 | 0 сум |
| 1 | С 1 сума до 500 000 сум |
| 2 | С 500 000 сум до 1 000 000 сум |
| 3 | С 1 000 000 сум до 1 500 000 сум |
| 4 | С 1 500 000 сум до 2 000 000 сум |
| N | С (N − 1) × 500 000 сум до N × 500 000 сум |

### f. Категории шаблонов скоринга по картам Uzcard

| Значение | Описание |
|---|---|
| age | Возраст |
| creditDebitRatio | % соотношение доход/расход за период |
| activeCardsCount | Количество активных карт |
| averageMonthlyDebit | Средние ежемесячные расходы по карте |
| averageMonthlyCredit | Средние ежемесячные поступления на карту |
| maxCredit | Максимальное поступление на карту |
| maxDebit | Сумма максимального разового расхода |
| cardBlock | Блокировка карты |
| averageScoringRequestCount | Среднее ежемесячное количество запросов на скоринг |
| averageWithdrawAmount | Средняя ежемесячная сумма обналичивания с карты |
| averageCreditExceptP2P | Средние ежемесячные поступления на карту кроме P2P |
| debitUniqueMerchantsCount | Количество уникальных мерчантов по исходящим транзакциям |
| averageP2PDebit | Средние ежемесячные P2P расходы с карты |
| averageP2PCredit | Средние ежемесячные P2P поступления на карту |
| maxP2PDebit | Максимальный P2P расход с карты |
| maxP2PCredit | Максимальное P2P поступление на карту |
| P2PCreditDebitRatio | % соотношение поступлений и расходов P2P на карту |
| averageConversionDebit | Средняя ежемесячная конверсионная сумма с карты |
| averageConversionCredit | Средняя ежемесячная конверсионная сумма на карту |
| maxConversionDebit | Максимальная конверсионная сумма с карты |
| maxConversionCredit | Максимальная конверсионная сумма на карту |
| averageCreditByATM | Средняя ежемесячная сумма пополнения с банкомата на карты |
| notP2PCredit | Сумма всех поступлений, не являющихся P2P транзакциями, на карту |

---

## Числовые коды ошибок

### a. Общие ошибки

| Код | Идентификатор | Значение |
|---|---|---|
| -101 | WrongInputParams | Неправильные входные данные |
| -102 | CardNumberIsIncorrect | Неверный номер карты |
| -103 | CardExpireIsIncorrect | Срок карты истек |
| -104 | CardIsNotActive | Карта неактивна |
| -105 | UserNotFound | Пользователь не найден |
| -106 | OtpSmsText | Код подтверждения |
| -107 | CardAddingError | Ошибка в добавлении карты |
| -108 | CardExists | Карта существует |
| -109 | OtpSendError | Ошибка при отправке одноразового пароля |
| -110 | CardIsBlockedByOtp | Карта заблокирована из-за превышения лимита OTP |
| -111 | UserIsBlockedByOtp | Пользователь заблокирован из-за превышения лимита OTP |
| -113 | OtpTimeExpired | Время ввода OTP истекло |
| -114 | CardNotFound | Карта не найдена |
| -115 | CardIsCorporate | Нельзя добавить корпоративную карту |
| -116 | NotEnoughMoney | Недостаточно средств |
| -117 | PaymentError | Ошибка при оплате |
| -118 | ClientExists | Клиент уже существует |
| -119 | PhoneNumberIsIncorrect | Неправильный номер телефона |
| -120 | SvGateError | Ошибка сервера Uzcard |
| -121 | TransactionWasNotFound | Транзакция не найдена |
| -122 | TransactionExists | Транзакция уже существует |
| -123 | TransactionStateError | Ошибка в статусе транзакции |
| -124 | NoCardOwnerInfo | Нет информации о владельце карты |
| -125 | ProviderError | Ошибка на стороне поставщика |
| -126 | TryLater | Пожалуйста, попробуйте позже |
| -127 | NoSmsInfo | Услуга СМС-информирования не подключена |
| -128 | BankNotFound | Банк не обслуживается |
| -129 | LessThanMinAmount | Минимальная сумма |
| -130 | AmountLessThanMinimum | Сумма меньше минимума |
| -131 | OnlyCorporateCards | Действует только корпоративная карта |
| -132 | ReceiverCardNotFound | Карта получателя не найдена |
| -133 | TransferBetweenSameCards | Нельзя перевести средства между одинаковыми картами |
| -134 | ReceiverBankIsNotSupported | Банк получателя не обслуживается |
| -135 | AmountMoreThanMaximum | Сумма превышает лимит максимума |
| -136 | TransactionIsAlreadyHeld | Транзакция уже холдирована |
| -137 | IncorrectOtp | Введен неверный код подтверждения |
| -138 | HoldTimeExpired | Время холдирования уже истекло |
| -139 | OtpLimitExceeded | Превышен лимит отправки одноразового пароля |
| -140 | ExpiredCard | Срок карты истек |
| -141 | CardBlocked | Карта заблокирована |
| -142 | OnlyCorporateCard | Оплату можно совершить только с корпоративной карты |
| -143 | NoUzcardEpos | Нет E-POS для Uzcard |
| -144 | NoHumoEpos | Нет E-POS для Humo |
| -145 | BranchNotFound | Филиал не найден |
| -145 | BranchEposNotFound | E-POS филиала не найден *(дубликат кода в исходном PDF)* |
| -146 | ScoringExists | Скоринг уже существует |
| -147 | TemplateNotFound | Шаблон не найден |
| -148 | ScoringNotFound | Скоринг не найден |
| -149 | IncorrectPassword | Неверный пароль |
| -150 | ChargeAmountMoreThanHeld | Сумма больше холдированной суммы |
| -151 | TransactionsIntervalError | Временной интервал между транзакциями не закончен |
| -151 | LimitIsExceeded | Превышен лимит *(дубликат кода в исходном PDF)* |
| -152 | CannotGenerateExcel | Не получилось сгенерировать Excel |
| -300 | HumoIsNotWorking | Карты Humo временно не принимаются |
| -301 | NoHumoHistory | Карты Humo временно не принимаются |
| -302 | WrongInterval | Неправильный период |
| -401 | Unauthorized | Ошибка авторизации |
| -500 | InternalServerError | Ошибка при подключении |
| 13 | HumoIsNotAcceptable | Вызываемый метод не поддерживает карты Humo |
| 14 | CardsPinflAndReceivedPinflMismatches | ПИНФЛ, привязанный к карте, и введенный ПИНФЛ не совпадают |
| 15 | MibAndTaxServiceNotWorking | Сервисы ГНК и БПИ не работают |
| 16 | TaxServiceNotWorking | Сервис ГНК не работает |
| 17 | MibServiceNotWorking | Сервис БПИ не работает |
| 18 | NoDebtsForTin | Нет задолженностей по долгам |
| 19 | MibParametersNotComplete | Не все параметры для получения задолженности в БПИ заполнены |
| 20 | NoDataTinService | Нет данных от сервиса ГНК |
| 21 | PersonalNumberIsIncorrect | ПИНФЛ неверный |
| 24 | TinNotRegistered | ИНН не зарегистрирован для использования партнером |
| 25 | TinNotFound | ИНН не найден |
| 26 | PinflNotFound | ПИНФЛ не найден / Не удалось создать контракт в модуле автосписания |
| 27 | ContractNotFound | Контракт не найден |
| 28 | ContractIsExist | Контракт уже существует |

### b. Ошибки SV-Gate

| Код | Идентификатор | Значение |
|---|---|---|
| -393 | PINFLNotFound | ПИНФЛ не найден |
| -392 | CardDoesNotBelongToThisPINFL | Карта не принадлежит указанному ПИНФЛ |
| -310 | CheckOutTransExtMethodLater_310 | Проверьте транзакцию позже |
| -309 | CheckOutTransExtMethodLater_309 | Проверьте транзакцию позже |
| -308 | CheckOutTransExtMethodLater_308 | Проверьте транзакцию позже |
| -307 | TimeoutSV_307 | Таймаут в SV-Gate |
| -306 | ServiceIsNotAvailable_306 | Сервис недоступен |
| -305 | ServiceIsNotAvailable_305 | Сервис недоступен |
| -304 | ServiceIsNotAvailable_304 | Сервис недоступен |
| -303 | ServiceIsNotAvailable_303 | Сервис недоступен |
| -302 | CheckOutTransExtMethodLater_302 | Проверьте транзакцию позже |
| -301 | CheckOutTransExtMethodLater_301 | Проверьте транзакцию позже |
| -300 | ServiceIsNotAvailable_300 | Сервис недоступен |
| -297 | PhoneIsNotCorrect_297 | Неверный номер телефона |
| -296 | CardDoesNotBelongToYourBank_296 | Карта не принадлежит вашему банку |
| -295 | NoAccessToSmsNotifyActivation_295 | Нет доступа к активированию СМС-информирования |
| -294 | RequestPinResetNotFound_294 | Запрос на сброс PIN-кода не найден |
| -293 | DailyLimitUsed_293 | Дневной лимит на пользование услугой уже использован |
| -292 | DailyLimitUsed_292 | Дневной лимит на пользование услугой уже использован |
| -291 | AccessDenied_291 | Доступ запрещен |
| -290 | PhoneInvalidWrongFormat_290 | Неверный формат номера телефона |
| -289 | CardNotBlocked_289 | Карта не заблокирована |
| -288 | ActionsNotFound_288 | Действия не найдены |
| -287 | UserNotFound_287 | Пользователь не найден |
| -286 | EposNotFound_286 | E-POS не найден |
| -285 | AttoCardNotFound_285 | Карта АТТО не найдена |
| -284 | AttoCheckCardException_284 | Ошибка при проверке карты АТТО |
| -283 | AttoPayException_283 | Ошибка при оплате АТТО |
| -282 | TransactionNotFoundOrCancelled_282 | Транзакция не найдена или была отменена |
| -281 | ErrorWhileExecutingRequest_281 | Ошибка при выполнении запроса |
| -280 | InformationNotFound_280 | Информация не найдена |
| -279 | CardIsNotMain_279 | Карта не является основной |
| -278 | SmsInformingAlreadyActive_278 | СМС-информирование уже было подключено |
| -277 | AttachedNumberAndSentNumberMismatch_277 | Привязанный и отправленный номера телефонов не совпадают |
| -276 | CardNotBelongToBank_276 | Карта не принадлежит банку |
| -275 | CardDoesNotBelongToBankCannotChange_275 | Карта не принадлежит банку, нельзя изменить |
| -274 | NoAccessToChangeCardStatus_274 | Нет доступа к изменению статуса карты |
| -273 | NoAccessToGetCardInformation_273 | Нет доступа к получению информации по карте |
| -272 | NoAccessToStatus_272 | Нет доступа к статусу |
| -271 | TokenAlreadyExist_271 | Токен уже существует |
| -270 | OtpIsExpired_270 | Время действия OTP истекло |
| -269 | OtpIsIncorrect_269 | OTP неверен |
| -268 | EposIsNotAuthorized_268 | E-POS не авторизован |
| -267 | TransactionNotFoundInSv_267 | Транзакция не найдена в SV |
| -266 | SmsIsAlreadyActivated_266 | СМС-информирование уже было подключено |
| -265 | UnknownExceptionInPackage_265 | Неизвестная ошибка в пакете |
| -264 | MccCodeNotFound_264 | Вид деятельности продавца не найден |
| -263 | StatusIdRangeLimit_263 | Ограничение диапазона статусов |
| -262 | AllowedAmountExceeded_262 | Превышена допустимая сумма |
| -261 | CardBlockedInSv_261 | Карта заблокирована в SV |
| -260 | InsufficientFunds_260 | Недостаточно средств |
| -259 | AmountCreditExceedsTheAmount_259 | Пополняемая сумма превышает снимаемую |
| -258 | OperationIsNotPossibleWithCorpCards_258 | Данная операция невозможна с корпоративной карты |
| -257 | TokenNotFound_257 | Токен не найден |
| -256 | NoAccessToTheMethod_256 | Метод недоступен |
| -255 | TermIdAndMerchantIdNotRegistered_255 | Идентификаторы продавца и терминала не зарегистрированы |
| -254 | TermIdAndMerchantIdNotFoundInDb_254 | Идентификаторы продавца и терминала не найдены в БД |
| -253 | TermIdAndMerchantIdNotFoundInSv_253 | Идентификаторы продавца и терминала не найдены в SV |
| -252 | WrongFormatMerchantId_252 | Неверный формат идентификатора продавца |
| -251 | WrongFormatTerminalId_251 | Неверный формат идентификатора терминала |
| -250 | WrongTerminalType_250 | Неправильный тип терминала |
| -249 | TermIdAndMerchantIdAlreadyExists_249 | Идентификаторы продавца и терминала уже существуют |
| -248 | CardValid_248 | Карта действительна |
| -247 | EposDoesNotExist_247 | E-POS не существует |
| -246 | PaymentToProviderIsProhibited_246 | Оплата поставщику запрещена |
| -245 | AmountDoesNotFit_245 | Сумма не подходит |
| -244 | ServiceIsTemplyUnavailForThisBank_244 | Услуга недоступна для этого банка |
| -243 | DeviceNotFound_243 | Устройство недоступно |
| -242 | HoldNotFound_242 | Удержание не найдено |
| -241 | WrongHoldingPeriod_241 | Неправильный период хранения |
| -240 | InsufficientFunds_240 | Недостаточно средств |
| -239 | ImproperFundsForHolding_239 | Ненадлежащие средства для холдирования |
| -238 | AccountNotFound_238 | Расчетный счет не найден |
| -237 | MerchantNotFound_237 | Продавец не найден |
| -236 | SupportedTerminalNotFound_236 | Поддерживаемый терминал не найден |
| -235 | SupportedCardNotFound_235 | Поддерживаемая карта не найдена |
| -234 | ThisCardIsMain_234 | Эта карта является основной |
| -233 | OtherMainCardInThisAccount_233 | Другая карта установлена основной для расчетного счета |
| -232 | NoMainCardsInThisAccount_232 | На этом счете нет основных карт |
| -231 | MainCardError_231 | Ошибка основной карты |
| -230 | CannotSetLimitToMainCard_230 | Нельзя установить лимит на основную карту |
| -229 | FamilyCardError_229 | Ошибка семейной карты |
| -228 | LimitNotFound_228 | Лимит не найден |
| -227 | OldMainNotExists_227 | Старая основная карта не существует |
| -226 | NewMainNotExists_226 | Новая основная карта не существует |
| -225 | NewMainIsExpired_225 | Новая основная карта имеет истекший срок |
| -224 | PhoneNumbersAreNotSame_224 | Номера телефонов неодинаковы |
| -223 | OldMainNotExists_223 | Старая основная карта не существует |
| -222 | OldAndNewMainCardsNotInSameAccount_222 | Новая и старая основные карты не принадлежат одному расчётному счету |
| -221 | CardIsNotMain_221 | Карта не основная |
| -220 | CardIsAddedToMainCards_220 | Карта добавлена в список основных карт |
| -219 | CardAlreadyEnteredToMainCards_219 | Карта уже добавлена в список основных карт |
| -218 | CardNumLenMustBe6Digits_218 | Номер карты должен состоять из 6 цифр |
| -217 | WrongPhoneNumberFormat_217 | Неверный формат номера телефона |
| -216 | ExpirationDateIncorrect_216 | Неверный срок истечения |
| -215 | PanAndPhoneNotFound_215 | Пользователь с таким номером карты и телефона не найден |
| -214 | InvalidDate_214 | Неверная дата |
| -213 | CardNumbersAreSame_213 | Номера карты одинаковы |
| -212 | PanOrExpiryInvalid_212 | Срок действия неверный |
| -211 | ServerNotResponding_211 | Сервер не отвечает |
| -210 | TransferBetweenSameCardIsNotPossible_210 | Перевод между одной и той же картой недоступен |
| -209 | WrongFormat_209 | Неправильный формат |
| -208 | TransactionNotFound_208 | Транзакция не найдена |
| -207 | TransactionAlreadyExistsInDb_207 | Транзакция уже существует |
| -206 | SmsIsNotActive_206 | СМС-информирование не было активировано |
| -205 | CardBlocked_205 | Карта заблокирована |
| -204 | CardStatusIsNotActive_204 | Карта неактивна |
| -203 | CardNotReIssue_203 | Карта не перевыпущена |
| -202 | PanInvalid_202 | Неверный номер карты |
| -201 | CardExpired_201 | Срок карты истек |
| -200 | CardNotFound_200 | Карта не найдена |
| -102 | ErrorWhileExecutingRequest_102 | Ошибка при выполнении запроса |
| -101 | ErrorWhileExecutingRequest_101 | Ошибка при выполнении запроса |
| -100 | EmptyParameters_100 | Пустые параметры |
| 0 | CardIsAddedToMainCards0 | Карта добавлена в список основных карт |
| 500 | InternalServerError | Внутренняя ошибка сервера |
| -999 | ServiceNotAvailable | Сервис недоступен |
| 51 | NotEnoughBalance | Недостаточно средств |

### c. Ошибки HUMO

| Код | Идентификатор | Значение |
|---|---|---|
| 100 | PcDeclined | Отклонено в процессинговом центре HUMO |
| -101 | ErrorWhileExecutingRequest | Ошибка при выполнении запроса |
| 107 | CardIssuerError | Отклонено, обратитесь к эмитенту карты |
| 109 | PcInvalidMerchant | Отклонено, недействительный продавец |
| 116 | NotEnoughMoney | Недостаточно средств |
| 125 | UnknownError | Неизвестная ошибка в ПЦ HUMO |
| -200 | CardNotFound2 | Карта не найдена |
| -201 | CardExpired | Срок карты истек |
| -202 | PanInvalid | Неверный номер карты |
| -203 | CardNotReissue | Карта не перевыпущена |
| -204 | CardStatusIsNotActive | Карта не активна |
| -205 | CardBlocked | Карта заблокирована |
| -206 | CardSmsIsNotActive | СМС-информирование не подключено |
| -236 | SupportedTerminalNotFound | Поддерживаемый терминал не найден |
| -237 | MerchantNotFound | Мерчант не найден |
| -238 | AccountNotFound | Аккаунт не найден |
| -239 | WrongAmountToHold | Неправильная сумма для холдирования |
| -240 | InsufficientFunds | Недостаточно средств |
| -241 | WrongPeriodForHolding | Неверный период для холдирования |
| -242 | HoldNotFound | Холдирование не найдено |
| -249 | EposAlreadyRegistered | E-POS уже зарегистрирован |
| -250 | WrongTerminalType | Неверный тип терминала |
| -251 | WrongFormatTerminalId | Неверный формат TerminalId |
| -252 | WrongFormatMerchantId | Неверный формат MerchantId |
| -253 | EposNotFoundInSv | E-POS не найден |
| -254 | EposNotFoundInDb | E-POS не найден |
| -255 | EposNotRegistered | E-POS не зарегистрирован |
| 400 | MissingRequiredParameters | Отсутствуют необходимые параметры |
| 404 | PaymentNotFound | Транзакция не найдена в ПЦ |
| 405 | CardNotFound | Карта не найдена |
| 500 | ServiceTemporarilyUnavailable | Услуга временно недоступна |
| -31000 | ProcCenterIsUnavailableCard | Карта недоступна в ПЦ |
| -31100 | ProcCenterIsUnavailable | ПЦ недоступен |
| -31101 | WrongCardNumber | Неверный номер карты |
| -31102 | InvalidCardExpire | Неверный срок истечения карты |
| -31624 | ProcessingCenterIsUnavailable | ПЦ недоступен |
| -31700 | CardIsBlocked | Карта заблокирована в ПЦ. Перевод средств недоступен |
| -31900 | CardIsNotServed | Данный тип карты не обслуживается |
| -36001 | RequiredParamsAreEmpty | Требуемые параметры пусты |
| -36002 | InvalidMethodName | Неизвестный метод |
| -36042 | InvalidToken | Неверный токен |
| -36058 | UnsupportedMethodRequest | Запрос не поддерживается |
| -37000 | MappingError | Ошибка при сопоставлении данных |
