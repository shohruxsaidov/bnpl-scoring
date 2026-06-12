# KATM API — Подсистема KATM API для розничных организаций (Ретейл)

> Источник: «Технологическое требование для взаимодействия с программным интерфейсом подсистемы KATM API с системами розничных организаций (Ретейл)», версия 12.4, Ташкент 2025 г. (ООО «Кредитное бюро „Кредитно-информационный аналитический центр"», КАТМ).

## Общие сведения

- Обмен данными осуществляется через **JSON** протокол. Параметры запроса передаются **POST** методом по протоколу **HTTP** в теле запроса.
- Прописать локально в DNS (или в файле `/etc/hosts`): для тестовой среды IP `10.22.50.210`, URL `testapi.infokredit.uz`; для продуктива IP `10.22.50.220`, URL `api.infokredit.uz`.

| | URL |
|---|---|
| Базовый URL (base_url) TEST | `https://api.infokredit.uz/katm-api/v1/` |
| Базовый URL (base_url) PROD | `https://testapi.infokredit.uz/katm-api/v1/` |

> Примечание: в исходном PDF значения TEST/PROD указаны именно так (вероятно, перепутаны местами: `testapi.` — тестовая среда, `api.` — продуктив).

**Swagger:** `https://api.infokredit.uz/katm-api/swagger-ui.html`

**Признаки полей:**
- **М** — обязательно
- **О** — опционально
- **М/О** — условно обязательный

---

## Методы взаимодействия

### 1. Регистрация кредитной заявки

Метод регистрирует кредитную заявку физического лица и, при успешной регистрации, возвращает уникальный номер KATM-SIR. Каждому новому субъекту кредитной информации, отсутствующему в базе КАТМ, присваивается уникальный номер KATM-SIR. В случае, если заемщик имеет KATM-SIR, то необходимо его передавать в составе сведений о кредитной заявке физического лица.

**URL:** `{base_url}/claim/registration`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String(30) | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String(30) | Пароль, предоставляется кредитным бюро | М |
| data.pCode | String(5) | Код организации | М |
| data.pClaimId | String(20) | Уникальный ID заявки | М |
| data.pClaimDate | String | Дата заявки (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pAgreementId | String(10) | Уникальный код согласия | М |
| data.pAgreementDate | String | Дата согласия клиента (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pPinfl | String(14) | ПИНФЛ код клиента | М |
| data.pDocSeries | String(5) | Серия паспорта клиента | М |
| data.pDocNumber | String(10) | Номер паспорта клиента | М |
| data.pDocType | Number(1) | Тип документа (0 — ID карта, 6 — Биометрический паспорт) | М |
| data.pRegion | String(2) | Код региона (016) | М |
| data.pLocalRegion | String(3) | Код района (052) | М |
| data.pAddress | String(100) | Адрес клиента | М |
| data.pPhone | String(13) | Телефон клиента | М |
| data.pCreditAmount | Number(20) | Сумма кредита (в тийинах) | М |
| data.pCurrency | String(3) | Код валюты (017) | М |
| data.pCreditEndDate | String | Дата завершения договора (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pIsUpdate | Number(1) | Флаг обновления данных (0 — по умолчанию, 1 — обновление)* | О |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| data.docSeries | String | Серия паспорта |
| data.docNumber | String | Номер паспорта |
| data.pinfl | String | ПИНФЛ |
| data.dateIssue | String | Дата выдачи паспорта (yyyy-MM-dd'T'HH:mm:ss.SSSZ) |
| data.issueBy | String | Кем выдан паспорт |
| data.dateExpire | String | Дата действия паспорта (yyyy-MM-dd'T'HH:mm:ss.SSSZ) |
| data.dateBirth | String | Дата рождения (yyyy-MM-dd'T'HH:mm:ss.SSSZ) |
| data.lastName | String | Фамилия |
| data.firstName | String | Имя |
| data.middleName | String | Отчество |
| data.address | String | Адрес |
| data.inn | String | ИНН |
| data.phone | String | Телефон |
| data.clientId | String | KATM-SIR |
| data.male | Number | Пол (1 — муж. / 2 — жен.) |
| data.liveStatus | Number | Жив (1) |
| errorMessage | String | Сообщение об ошибке |
| code | Number | HTTP статус (200 — успешно) |

Номер и дата документа согласия заёмщика должны оба иметь значение при наличии согласия. В случае если один реквизит отсутствует, то сведения считаются неполными. В случае если заёмщик не дал согласие на получение кредитного отчета, то оба типа сведений отсутствуют. При несогласии заемщика, кредитный отчет на данную кредитную заявку не предоставляется.

\* Обновление доступно для организаций, прошедших тестирование и согласовавших его результаты с КАТМ.

---

### 2. Регистрация кредитной заявки (Ручной ввод без проверки паспортных данных)

**URL:** `{base_url}/claim/registration/ext`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String(30) | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String(30) | Пароль, предоставляется кредитным бюро | М |
| data.pCode | String(5) | Код организации | М |
| data.pClaimId | String(20) | Уникальный ID заявки | М |
| data.pClaimDate | String | Дата заявки (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pAgreementId | String(10) | Уникальный код согласия | М |
| data.pAgreementDate | String | Дата согласия клиента (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pDocType | Number(1) | Тип документа (0 — ID карта, 6 — Биометрический паспорт) | М |
| data.pMrz | String(90) | MRZ (машино-читаемая зона), для паспорта 88 символов, для ID карты 90 | М |
| data.pRegion | String(2) | Код региона (016) | М |
| data.pLocalRegion | String(3) | Код района (052) | М |
| data.pAddress | String(100) | Адрес клиента | М |
| data.pPhone | String(13) | Телефон клиента | О |
| data.pCreditAmount | Number(20) | Сумма кредита (в тийинах) | М |
| data.pCurrency | String(3) | Код валюты (017) | М |
| data.pCreditEndDate | String | Дата завершения договора (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pIsUpdate | Number(1) | Флаг обновления данных (0 — по умолчанию, 1 — обновление)* | О |
| data.pMiddleName | String | Отчество клиента | О |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| data.docSeries | String | Серия паспорта |
| data.docNumber | String | Номер паспорта |
| data.pinfl | String | ПИНФЛ |
| data.dateIssue | String | Дата выдачи паспорта (yyyy-MM-dd'T'HH:mm:ss.SSSZ) |
| data.issueBy | String | Кем выдан паспорт |
| data.dateExpire | String | Дата действия паспорта (yyyy-MM-dd'T'HH:mm:ss.SSSZ) |
| data.dateBirth | String | Дата рождения (yyyy-MM-dd'T'HH:mm:ss.SSSZ) |
| data.lastName | String | Фамилия |
| data.firstName | String | Имя |
| data.middleName | String | Отчество |
| data.address | String | Адрес |
| data.inn | String | ИНН |
| data.phone | String | Телефон |
| data.clientId | String | KATM-SIR |
| data.male | Number | Пол (1 — муж. / 2 — жен.) |
| data.liveStatus | Number | Жив (1) |
| errorMessage | String | Сообщение об ошибке |
| code | Number | HTTP статус (200 — успешно) |

\* Обновление доступно для организаций, прошедших тестирование и согласовавших его результаты с КАТМ.

---

### 3. Регистрация кредитной заявки (Альтернативный ручной ввод)

**URL:** `{base_url}/claim/registration/trusted`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String(30) | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String(30) | Пароль, предоставляется кредитным бюро | М |
| data.pCode | String(5) | Код организации | М |
| data.pClaimId | String(20) | Уникальный ID заявки | М |
| data.pClaimDate | String | Дата заявки (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pAgreementId | String(10) | Уникальный код согласия | М |
| data.pAgreementDate | String | Дата согласия клиента (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pPinfl | String(14) | ПИНФЛ код клиента | М |
| data.pDocSeries | String(5) | Серия паспорта клиента | М |
| data.pDocNumber | Number(10) | Номер паспорта клиента | М |
| data.pInn | String(9) | ИНН клиента | О |
| data.pFirstName | String(30) | Имя клиента | М |
| data.pLastName | String(30) | Фамилия клиента | М |
| data.pMiddleName | String(30) | Отчество клиента | О |
| data.pBirthDate | String | Дата рождения (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pIssueDocDate | String | Дата выдачи паспорта (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pExpiredDocDate | String | Срок действия паспорта (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pMale | Number | Пол (1 — муж. / 2 — жен.) | М |
| data.pDocType | Number(1) | Тип документа (0 — ID карта, 6 — Биометрический паспорт) | М |
| data.pRegion | String(2) | Код региона (016) | М |
| data.pLocalRegion | String(3) | Код района (052) | М |
| data.pAddress | String(100) | Адрес клиента | М |
| data.pPhone | String(13) | Телефон клиента | М |
| data.pResident | Number(1) | Резидент (0 — нет, 1 — да) | М |
| data.pCreditAmount | Number(20) | Сумма кредита (в тийинах) | М |
| data.pCurrency | String(3) | Код валюты (017) | М |
| data.pCreditEndDate | String | Дата завершения договора (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pIsUpdate | Number(1) | Флаг обновления данных (0 — по умолчанию, 1 — обновление)* | О |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| data.clientId | String | KATM-SIR |
| errorMessage | String | Сообщение об ошибке |
| code | Number | HTTP статус (200 — успешно) |

\* Обновление доступно для организаций, прошедших тестирование и согласовавших его результаты с КАТМ.

---

### 4. Регистрация кредитной заявки юридического лица

Метод регистрирует кредитную заявку юридического лица и, при успешной регистрации, возвращает уникальный номер KATM-SIR. Каждому новому СКИ, отсутствующему в базе КАТМ, присваивается уникальный номер KATM-SIR. В случае, если заемщик имеет KATM-SIR, то необходимо его передавать в составе сведений о кредитной заявке юридического лица.

**URL:** `{base_url}/claim/legal/registration`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String(30) | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String(30) | Пароль, предоставляется кредитным бюро | М |
| data.pHead | String(3) | Код головной организации | М |
| data.pCode | String(5) | Код организации | М |
| data.pClaimId | String(20) | Уникальный ID заявки | М |
| data.pClaimDate | String | Дата заявки (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pAgreementId | String(10) | Уникальный код согласия | М |
| data.pAgreementDate | String | Дата согласия клиента (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pInn | String(9) | ИНН организации | М |
| data.pResident | Number(1) | Резидентность (1 — да, 0 — нет) | М |
| data.pGovernment | Number(1) | Вхождение в структуру государственного управления (0 — нет, 1 — да) | М |
| data.pClientType | String(2) | Код типа клиента (021) | М |
| data.pHeadCode | String(5) | Код вышестоящей организации (071) | М |
| data.pRegion | String(2) | Код региона (016) | М |
| data.pLocalRegion | String(3) | Код района (052) | М |
| data.pAddress | String(100) | Адрес организации | М |
| data.pPhone | String(13) | Телефон организации | М |
| data.pCreditAmount | Number(20) | Сумма кредита (в тийинах) | М |
| data.pCurrency | String(3) | Код валюты (017) | М |
| data.pCreditEndDate | String | Дата завершения договора (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pIsUpdate | Number(1) | Флаг обновления данных (0 — по умолчанию, 1 — обновление)* | О |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| data.fullName | String | Наименование организации |
| data.inn | String | ИНН |
| data.phone | String | Телефон |
| data.clientId | String | KATM-SIR |
| data.initId | String | ID заявки в системе КАТМ |
| data.orgData | Object | Данные об организации |
| errorMessage | String | Сообщение об ошибке |
| code | Number | HTTP статус (200 — успешно) |

Номер и дата документа согласия заёмщика должны оба иметь значение при наличии согласия. В случае если один реквизит отсутствует, то сведения считаются неполными. В случае если заёмщик не дал согласие на получение кредитного отчета, то оба типа сведений отсутствуют. При несогласии заемщика, кредитный отчет на данную кредитную заявку не предоставляется.

\* Обновление доступно для организаций, прошедших тестирование и согласовавших его результаты с КАТМ.

---

### 5. Регистрация кредитной заявки юридического лица (Ручной ввод)

**URL:** `{base_url}/claim/legal/registration/ext`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String(30) | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String(30) | Пароль, предоставляется кредитным бюро | М |
| data.pHead | String(3) | Код головной организации | М |
| data.pCode | String(5) | Код организации | М |
| data.pClaimId | String(20) | Уникальный ID заявки | М |
| data.pClaimDate | String | Дата заявки (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pAgreementId | String(10) | Уникальный код согласия | М |
| data.pAgreementDate | String | Дата согласия клиента (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pInn | String(9) | ИНН организации | М |
| data.pClientName | String(100) | Наименование ЮЛ | М |
| data.pResident | Number(1) | Резидентность (1 — да, 0 — нет) | М |
| data.pGovernment | Number(1) | Вхождение в структуру государственного управления (0 — нет, 1 — да) | М |
| data.pClientType | String(2) | Код типа клиента (021) | М |
| data.pHeadCode | String(5) | Код вышестоящей организации (071) | М |
| data.pRegion | String(2) | Код региона (016) | М |
| data.pLocalRegion | String(3) | Код района (052) | М |
| data.pAddress | String(100) | Адрес организации | М |
| data.pPhone | String(13) | Телефон организации | М |
| data.pCreditAmount | Number(20) | Сумма кредита (в тийинах) | М |
| data.pCurrency | String(3) | Код валюты (017) | М |
| data.pCreditEndDate | String | Дата завершения договора (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pOkpo | String(10) | ОКПО | О |
| data.pOkonhCd | String(10) | ОКОНХ | О |
| data.pKfsCd | String(20) | Форма собственности | О |
| data.pIsUpdate | Number(1) | Флаг обновления данных (0 — по умолчанию, 1 — обновление)* | О |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| data.fullName | String | Наименование организации |
| data.inn | String | ИНН |
| data.phone | String | Телефон |
| data.clientId | String | KATM-SIR |
| data.initId | String | ID заявки в системе КАТМ |
| data.orgData | Object | Данные об организации |
| errorMessage | String | Сообщение об ошибке |
| code | Number | HTTP статус (200 — успешно) |

\* Обновление доступно для организаций, прошедших тестирование и согласовавших его результаты с КАТМ.

---

### 6. Отказ в выдаче кредита

**URL:** `{base_url}/claim/rejection`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String(30) | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String(30) | Пароль, предоставляется кредитным бюро | М |
| data.pCode | String(5) | Код организации | М |
| data.pClaimId | String(20) | Уникальный ID заявки | М |
| data.pRejectDate | String | Дата отказа (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pReasonId | Number(1) | Код причины отказа (0A8) | М |
| data.pReason | String(1) | Причина отказа | М |
| data.pIsUpdate | Number(1) | Флаг обновления данных (0 — по умолчанию, 1 — обновление)* | О |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| errorMessage | String | Сообщение об ошибке |
| code | Number | HTTP статус (200 — успешно) |

\* Обновление доступно для организаций, прошедших тестирование и согласовавших его результаты с КАТМ.

---

### 7. Регистрация кредита

**URL:** `{base_url}/contract/registration`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String(30) | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String(30) | Пароль, предоставляется кредитным бюро | М |
| data.pCode | String(5) | Код организации | М |
| data.pClaimId | String(20) | Уникальный ID заявки | М |
| data.pContractId | String(20) | Уникальный ID кредита | М |
| data.pObject | Integer(6) | Код объекта кредитования (значение по умолчанию '060091' — Другие кредиты, выданные населению) (по справочнику 'A34': Category_code = '06', Subcategory_code = '00', Code = '91') | М |
| data.pStartDate | String | Дата начала контракта (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pEndDate | String | Дата окончания контракта (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pCreditAmount | Number(20) | Сумма кредита (в тийинах) | М |
| data.pCurrency | String(3) | Код валюты (017) | М |
| data.pStatus | Number(1) | Код статуса контракта | М |
| data.pIsUpdate | Number(1) | Флаг обновления данных (0 — по умолчанию, 1 — обновление)* | О |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| errorMessage | String | Сообщение об ошибке |
| code | Number | HTTP статус (200 — успешно) |

\* Обновление доступно для организаций, прошедших тестирование и согласовавших его результаты с КАТМ.

---

### 8. Добавление графика погашения кредита

**URL:** `{base_url}/contract/schedule/add`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String(30) | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String(30) | Пароль, предоставляется кредитным бюро | М |
| data.pCode | String(5) | Код организации | М |
| data.pClaimId | String(20) | Уникальный ID заявки | М |
| data.pContractId | String(20) | Уникальный ID кредита | М |
| data.pPlanArray | Array { date, currency, amount } | Массив данных с планом: дата (yyyy-MM-dd'T'HH:mm:ss.SSSZ), код валюты (017), сумма в тийинах | М |
| data.pIsUpdate | Number(1) | Флаг обновления данных (0 — по умолчанию, 1 — обновление)* | О |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| errorMessage | String | Сообщение об ошибке |
| code | Number | HTTP статус (200 — успешно) |

\* В случае, если график погашения кредитного договора пересмотрен, то по данному договору необходимо передавать весь пересмотренный график заново с кодом «1». Обновление доступно для организаций, прошедших тестирование и согласовавших его результаты с КАТМ.

---

### 9. Добавление погашение кредита

**URL:** `{base_url}/contract/repayment/add`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String(30) | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String(30) | Пароль, предоставляется кредитным бюро | М |
| data.pCode | String(5) | Код организации | М |
| data.pClaimId | String(20) | Уникальный ID заявки | М |
| data.pContractId | String(20) | Уникальный ID кредита | М |
| data.pRepaymentArray | Array { date, startBalance, debit, credit, endBalance } | Массив данных с планом: дата (yyyy-MM-dd'T'HH:mm:ss.SSSZ), сальдо на начало, сумма дебета, сумма кредита, сальдо на конец. Суммы указывать в тийинах. | М |
| data.pIsUpdate | Number(1) | Флаг обновления данных (0 — по умолчанию, 1 — обновление)* | О |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| errorMessage | String | Сообщение об ошибке |
| code | Number | HTTP статус (200 — успешно) |

\* В случае пересмотра условий погашения по данному кредитному договору необходимо повторно передать всю пересмотренную информацию о погашении с кодом «1». Обновление доступно для организаций, прошедших тестирование и согласовавших его результаты с КАТМ.

---

### 10. Получение кредитной истории

**URL:** `{base_url}/credit/report`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String | Пароль, предоставляется кредитным бюро | М |
| data.pHead | String | Главный код организации | М |
| data.pCode | String | Код организации | М |
| data.pLegal | Integer | 0 — юридическое лицо, 1 — физическое лицо | М |
| data.pClaimId | String | ID заявки на получение кредитной истории | М |
| data.pReportId | Integer | ID отчёта | М |
| data.pLang | String | Язык отчета (ru/uz/en) | О |
| data.pReportFormat | Integer | Формат отчёта (0 — XML, 1 — JSON) | О |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| data.reportBase64 | String | Кредитная история в формате XML в Base64 |
| data.Token | String | Токен, возвращается в случае, если по формированию кредитной истории возникли проблемы* |

\* При получении ошибки (result = 05050) необходимо через короткие интервалы (не менее 60 секунд) проверять статус кредитного отчёта по роуту `/credit/report/status`.

---

### 11. Получение кредитной истории. Проверка отчёта

**URL:** `{base_url}/credit/report/status`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| data.pHead | String | Код банка | М |
| data.pCode | String | Код организации | М |
| data.pToken | String | Токен, полученный при получении кредитной истории | М |
| data.pClaimId | String | ID заявки на получение кредитной истории | М |
| data.pReportFormat | Integer | Формат отчёта (0 — XML, 1 — JSON) | М |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| data.reportBase64 | String | Кредитная история в формате XML в Base64 |
| data.Token | String | пусто |

---

### 12. Получение адреса клиента

**URL:** `{base_url}/client/address/new`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String(30) | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String(30) | Пароль, предоставляется кредитным бюро | М |
| data.pHead | String(3) | Главный код организации | М |
| data.pCode | String(5) | Код организации | М |
| data.pPin | String(14) | ПИНФЛ клиента | М |
| data.pAgreementId | String(20) | Номер согласия | М |
| data.pAgreementDate | Date | Дата согласия (yyyy-MM-dd'T'HH:mm:ss.SSSZ) | М |
| data.pDocNumber | String(5) | Серия паспорта клиента *(в PDF поле названо pDocNumber — вероятно, опечатка вместо pDocSeries)* | О |
| data.pDocNumber | String(10) | Номер паспорта клиента | О |
| data.pReportFormat | Integer | Формат отчёта (0 — XML, 1 — JSON) | О |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| data.reportBase64 | String | Кредитная история в формате XML в Base64 |

---

### 13. Получение проводок по договору

**URL:** `{base_url}/contract/repayment/list`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String | Пароль, предоставляется кредитным бюро | М |
| data.pCode | String | Код организации | М |
| data.pContractId | String | Уникальный ID кредита | М |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| code | String | HTTP status |
| errorMessage | String | Сообщение об ошибке |
| data | Array | Массив с данными |
| data.date | String | Дата платежа |
| data.debit | String | Дебетовый оборот |
| data.credit | String | Кредитовый оборот |
| data.startBalance | String | Сальдо на начало |
| data.endBalance | String | Сальдо на конец |

---

### 14. Получение графика оплат по договору

**URL:** `{base_url}/contract/repayment/schedule`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String | Пароль, предоставляется кредитным бюро | М |
| data.pCode | String | Код организации | М |
| data.pContractId | String | Уникальный ID кредита | М |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| code | String | HTTP status |
| errorMessage | String | Сообщение об ошибке |
| data | Array | Массив с данными |
| data.date | String | Дата платежа |
| data.currency | String | Валюта |
| data.amount | String | Сумма платежа |

---

### 15. Получение информации по договору

**URL:** `{base_url}/contract/info`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String | Пароль, предоставляется кредитным бюро | М |
| data.pCode | String | Код организации | М |
| data.pContractId | String | Уникальный ID кредита | М |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| code | String | HTTP status |
| errorMessage | String | Сообщение об ошибке |
| data | Array | Массив с данными |

---

### 16. Получение информации по заявке

**URL:** `{base_url}/claim/get`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String | Пароль, предоставляется кредитным бюро | М |
| data.pCode | String | Код организации | М |
| data.pClaimtId | String | Уникальный ID заявки *(в PDF поле названо именно pClaimtId — вероятно, опечатка вместо pClaimId)* | М |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| code | String | HTTP status |
| errorMessage | String | Сообщение об ошибке |
| data | Array | Массив с данными |

---

### 17. Проверка наличия в реестре запрета на кредитование

**URL:** `{base_url}/client/credit/ban/status`

#### Входящие параметры

| Название | Тип | Описание | Признак |
|---|---|---|---|
| security.pLogin | String(30) | Логин, предоставляется кредитным бюро | М |
| security.pPassword | String(30) | Пароль, предоставляется кредитным бюро | М |
| data.pHead | String(3) | Главный код организации | М |
| data.pCode | String(5) | Код организации | М |
| data.pIdentifier | String(14) | ПИНФЛ клиента | М |
| data.pSubjectType | Number(1) | 2 — Физическое лицо | М |

#### Параметры ответа

| Название | Тип | Описание |
|---|---|---|
| data.result | String | Код ответа (05000 — успешно) |
| data.resultMessage | String | Сообщение ответа |
| data.status | Integer | 1 — активен запрет, 0 — не активен запрет |

---

## Описание справочников

### a. Перечень справочников, используемых при взаимодействии

| № | Код | Наименование |
|---|---|---|
| 1 | 14 | Банки Республики Узбекистан |
| 2 | 12 | Отделения банков Республики Узбекистан |
| 3 | 16 | Области Республики Узбекистан |
| 4 | 52 | Районы Республики Узбекистан |
| 5 | 17 | Валюты |
| 6 | 26 | Виды платёжных документов |
| 7 | 21 | Типы клиентов |
| 8 | 83 | Типы заёмщиков |
| 9 | 27 | Резидентность клиента |
| 10 | 31 | Виды кредитования |
| 11 | 34 | Объекты кредитования |
| 12 | 32 | Классы кредитоспособности заёмщика |
| 13 | 35 | Классы обеспеченности |
| 14 | 36 | Классы качества активов |
| 15 | 30 | Виды срочности |
| 16 | 53 | Интервалы срочности |
| 17 | 33 | Типы обеспечения кредитования |
| 18 | 38 | Виды источников кредитования |
| 19 | 23 | Отрасли народного хозяйства |
| 20 | 04 | Виды выдачи/погашения |
| 21 | 07 | Половая принадлежность субъекта |
| 22 | 08 | Виды удостоверяющего документа |
| 23 | 41 | Зарубежные финансовые организации |
| 24 | 09 | Нормативно-правовые акты |
| 25 | 06 | Типы субъектов |
| 26 | 57 | Формы собственности |
| 27 | 60 | Назначения платежа |
| 28 | 18 | Страны и территории |

### b. Описание внутренних справочников

| № | Код | Наименование | Примечание |
|---|---|---|---|
| 1 | A1 | Типы отчётов | |
| 2 | A2 | Виды форм собственности | |
| 3 | A3 | Признак вхождения в структуру государственного управления | |
| 4 | A4 | Виды объектов лизинга | |
| 5 | A5 | Виды органов кредитной организации | |
| 6 | A6 | Виды договора | |
| 7 | A8 | Виды причин отклонения кредитной заявки | |
| 8 | A9 | Признак депозита | |
| 9 | A10 | Тип уникального номера | Используется в ответном файле от системы АСОКИ |
| 10 | A13 | Статус залога | |
| 11 | A14 | Дополнительные данные по залогу | |
| 12 | A15 | Дополнительные данные по объекту лизинга | |
| 13 | A16 | Статус кредитного договора | |
| 14 | A17 | Причины досрочного прекращения кредитного договора | |
| 15 | A18 | Типы субъектов кредитной информации | |
| 16 | A19 | Состояния субъектов кредитной информации | |

### c. Справочник «Идентификаторы типов поставщиков»

| № | Код | Содержание |
|---|---|---|
| 1 | B | Коммерческий банк |
| 2 | T | Микрокредитная организация |
| 3 | D | Ломбард |
| 4 | L | Лизинговая компания |
| 5 | K | Органы кадастра |
| 6 | N | Нотариальные органы |
| 7 | E | Узбекэнерго |
| 8 | S | Налоговые органы |
| 9 | O | Таштеплоэнерго |
| 10 | U | Сувсоз |
| 11 | I | Страховая организация |
| 12 | G | data.gov.uz |
