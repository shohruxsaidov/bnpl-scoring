# E-POS API — Виртуальная касса Universal Communicator

> Source: «Руководство по интеграции Universal Communicator», версия Universal Communicator **2.0.1.4**, версия FiscalDriveAPI **8.01**.

## Общие сведения

Виртуальная касса Communicator обеспечивает доступ к ФМ (фискальному модулю) и служит фискализацией чека. У ПО Communicator есть **основные** и **вспомогательные** запросы. Основные запросы необходимо интегрировать в систему для обеспечения нормальной работы кассы. Вспомогательные запросы интегрируются по желанию клиента.

- Протокол: **JSON-RPC v2**, все запросы отправляются методом **POST**.
- Базовый адрес (локальный): `http://localhost:8347/uzpos`
- Тестовый адрес: `http://integration.epos.uz:8347/uzpos`
- Токен для запросов неизменен: `DXJFX32CN1296678504F2`

### Структура запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "method-name"
}
```

### Структура ответа

```json
{ "error": false, "message": "SUCCESS" }
```

Поле `error` (Boolean) — признак ошибки. Поле `message` — результат операции: строка, объект или массив в зависимости от метода. Перечень строковых кодов см. в разделе [3. Ошибки программы](#3-ошибки-программы).

### Признаки полей

- **(R)** — обязательно
- *(optional)* — не обязательно

### Единицы измерения

- Все денежные суммы указываются **в тийинах**: `250000` тийин = `2500` сум.
- Количество товара (`amount`) указывается **умноженным на 1000**: `1 шт` = `1000`. Так же можно указать кг, км и другие значения.
- Даты/время в фискальных данных: формат `ГГГГММДДЧСМНСК` либо `ГГГГ-ММ-ДД ЧС-МН-СК` (зависит от метода).

---

## 1. Основные запросы

### 1.1 Open Z report

**Method:** `openZreport`

Открытие Z отчёта.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `token` | String | Токен не меняется: `DXJFX32CN1296678504F2` | R |
| `method` | String | Метод запроса | R |

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "openZreport"
}
```

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `error` | Boolean | Проверка на ошибку |
| `message` | String | Информация об ошибке / результат |

#### Пример ответа

```json
{
  "error": false,
  "message": "SUCCESS"
}
```

---

### 1.2 Sale

**Method:** `sale`

Отправка запроса на покупку.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `token` | String | Токен не меняется | R |
| `method` | String | Метод запроса (`sale`) | R |
| `companyName` | String | Название компании. Убедитесь, что в чеке идут правильные адреса | R |
| `companyAddress` | String | Адрес компании | R |
| `companyINN` | Integer | ИНН компании | R |
| `staffName` | String | Инициалы кассира | R |
| `printerSize` | Integer | Размер формирования чека: поддерживается `58` или `80` мм | optional |
| `params` | Object | Тело чека | R |
| `params.discountCard` | Object | Данные дисконтных карт для выведения в чеке | optional |
| `params.discountCard.available` | Integer | Доступные средства | optional |
| `params.discountCard.addition` | Integer | Прибавление к карте | optional |
| `params.discountCard.subtraction` | Integer | Снимаемая сумма | optional |
| `params.discountCard.remainder` | Integer | Остаток суммы | optional |
| `params.paycheckNumber` | String | Номер чека для вывода в чеке. Если не указать — номер присваивается со стороны фискального модуля | optional |
| `params.items` | Object[] | Список закупленных товаров | R |
| `params.items[].discount` | Integer | Скидки для товаров, в тийинах | R |
| `params.items[].price` | Integer | Общая сумма товара с учётом количества, в тийинах | R |
| `params.items[].barcode` | String | Штрих-код товара | R |
| `params.items[].amount` | Integer | Количество товара (×1000: `1 шт` = `1000`) | R |
| `params.items[].vatPercent` | Integer | Процентная ставка НДС | R |
| `params.items[].vat` | Integer | Сумма НДС, в тийинах | R |
| `params.items[].name` | String | Наименование товара | R |
| `params.items[].classCode` | String | Код ИКПУ | R |
| `params.items[].label` | String | Код маркировки товара. Для товаров с маркировками — обязательно | optional* |
| `params.items[].commissionTIN` | String | ИНН комитента. Для комиссионных товаров — обязательно | optional* |
| `params.items[].other` | Integer | Прочие скидки (оплата по страховке и др.) | R |
| `params.receivedCash` | Integer | Наличная сумма, полученная от продажи, в тийинах | R |
| `params.receivedCard` | Integer | Безналичная сумма, полученная от продажи, в тийинах | R |
| `params.extraInfos` | Object | Дополнительные данные для вывода в чеке (`extra1`, `extra2`, `extra3`) | optional |

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "sale",
  "companyName": "Humo MCHJ",
  "companyAddress": "Tashkent",
  "companyINN": "123456",
  "staffName": "Abdulazizov Shakhboz",
  "printerSize": 80,
  "params": {
    "discountCard": {
      "available": 12345,
      "addition": 12345,
      "subtraction": 12345,
      "remainder": 12345
    },
    "paycheckNumber": "7654321",
    "items": [
      {
        "discount": 250000,
        "price": 519199,
        "barcode": "98743154313",
        "amount": 2000,
        "vatPercent": 15,
        "vat": 103839,
        "name": "AAAAAAAAAAAAAA",
        "label": "qwertyuuuuuuiopasdfghjklzxcvbnm",
        "classCode": "08510003002000000",
        "other": 9199
      },
      {
        "discount": 250000,
        "price": 519199,
        "barcode": "23412334321",
        "amount": 2000,
        "vatPercent": 15,
        "vat": 103839,
        "name": "BBBBBBBBBB",
        "classCode": "08510003002000000",
        "other": 9199
      }
    ],
    "receivedCash": 260000,
    "receivedCard": 260000,
    "extraInfos": {
      "extra1": "Bla",
      "extra2": "BlaBla",
      "extra3": "BlaBlaBla"
    }
  }
}
```

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `error` | Boolean | Проверка на ошибки |
| `paycheck` | Base64 | Чек в формате PDF, закодированный в base64 |
| `info` | Object | Фискальные данные чека |
| `info.terminalId` | String | Серийный номер ФМ |
| `info.receiptSeq` | String | Номер онлайн-чека |
| `info.fiscalSign` | String | Фискальный признак чека |
| `info.qrCodeURL` | String | URL для проверки чека. Должен быть напечатан в виде QR-кода на чеке |
| `info.dateTime` | String | Время регистрации чека (формат `ГГГГММДДЧСМНСК`) |

#### Пример ответа

```json
{
  "error": false,
  "paycheck": "JVBERi0xLjcKJeLjz9MKNSAwIG9iago8PC9GaW … RmxhdGVEZWNvZGUv+fdsfsd",
  "info": {
    "terminalId": "UZ191211501033",
    "receiptSeq": "559",
    "fiscalSign": "336289559214",
    "qrCodeURL": "https://ofd.soliq.uz/check?t=UZ191211501033&r=559&c=20211109170634&s=336289559214",
    "dateTime": "20211109170634"
  }
}
```

---

### 1.3 Refund

**Method:** `refund`

Отправка запроса на возврат. Запрос аналогичен [Sale](#12-sale), но поле `method` должно содержать значение `refund`. Ответ аналогичен ответу Sale.

---

### 1.4 Close Z report

**Method:** `closeZreport`

Закрытие Z отчёта. При закрытии убедитесь, что Z отчёт не пустой.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `token` | String | Токен не меняется | R |
| `method` | String | Метод запроса | R |

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "closeZreport"
}
```

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `error` | Boolean | Проверка на ошибку |
| `message` | String | Сообщение об итоге операции |

#### Пример ответа

```json
{
  "error": false,
  "message": "SUCCESS"
}
```

---

### 1.5 Get Z report info by number

**Method:** `getZReportInfoByNumber`

Получить состав Z отчёта по порядковому номеру, указанному в поле `zReportId`. Номер = 1 — первый Z отчёт, номер = 2 — второй Z отчёт, и т.д.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `token` | String | Токен не меняется | R |
| `method` | String | Метод запроса | R |
| `printerSize` | Integer | Размер формирования чека: `58` или `80` мм | optional |
| `zReportId` | Integer | Номер Z отчёта | R |

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getZReportInfoByNumber",
  "printerSize": 80,
  "zReportId": 1
}
```

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `error` | Boolean | Проверка на ошибку |
| `message` | Object | Данные о Z отчёте в JSON формате |
| `message.paycheck` | Base64 | Чек в формате PDF, закодированный в base64 |
| `message.number` | Integer | Порядковый номер Z отчёта |
| `message.count` | Integer | Кол-во открытых/закрытых (включая текущий) Z отчётов |
| `message.totalRefundCount` | Integer | Кол-во операций возврата в данном Z отчёте (от 1 до 9999) |
| `message.firstReceiptSeq` | String | Номер первого зарегистрированного чека в данном Z отчёте после его открытия |
| `message.lastReceiptSeq` | String | Номер последнего зарегистрированного чека в данном Z отчёте |
| `message.totalSaleCount` | Integer | Кол-во операций продаж в данном Z отчёте (от 1 до 9999) |
| `message.totalRefundCash` | Integer | Сумма наличности по возвратам, в тийинах (0 … 999999999999) |
| `message.totalRefundCard` | Integer | Сумма безналичности по возвратам, в тийинах (0 … 999999999999) |
| `message.totalRefundVAT` | Integer | Сумма НДС по возвратам, в тийинах (0 … 999999999999) |
| `message.openTime` | String | Дата и время открытия Z отчёта (`ГГГГ-ММ-ДД ЧС-МН-СК`). Если пусто — Z отчёт не был открыт |
| `message.terminalID` | String | Серийный номер ФМ |
| `message.totalSaleCard` | Integer | Сумма безналичности по продажам, в тийинах (0 … 999999999999) |
| `message.closeTime` | String | Дата и время закрытия Z отчёта (`ГГГГ-ММ-ДД ЧС-МН-СК`). Если пусто — Z отчёт не был закрыт |
| `message.appletVersion` | String | Версия апплета в ФМ |
| `message.totalSaleCash` | Integer | Сумма наличности по продажам, в тийинах (0 … 999999999999) |
| `message.totalSaleVAT` | Integer | Сумма НДС по продажам, в тийинах |

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "paycheck": "JVBERi0xLjcKJeLjz9MK....CiUlRU9GCg==",
    "number": 1,
    "count": 365,
    "totalRefundCount": 0,
    "firstReceiptSeq": "1",
    "lastReceiptSeq": "5",
    "totalSaleCount": 5,
    "totalRefundCash": 0,
    "totalRefundCard": 0,
    "totalRefundVAT": 0,
    "openTime": "2020-07-16 14:57:44",
    "terminalID": "UZ191211501031",
    "totalSaleCard": 0,
    "closeTime": "2020-07-16 15:23:12",
    "appletVersion": "0302",
    "totalSaleCash": 982560200,
    "totalSaleVAT": 128160026
  }
}
```

---

### 1.6 Get Z report info

**Method:** `getZreportInfo`

Получить состав Z отчёта по индексу, указанному в поле `zReportId`. Индекс = 0 — текущий Z отчёт (X отчёт), индекс = 1 — предыдущий Z отчёт, и т.д.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `token` | String | Токен не меняется | R |
| `method` | String | Метод запроса | R |
| `printerSize` | Integer | Размер формирования чека: `58` или `80` мм | optional |
| `zReportId` | Integer | Индекс Z отчёта | R |

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getZreportInfo",
  "printerSize": 80,
  "zReportId": 0
}
```

#### Ответ

Ответ аналогичен [Get Z report info by number](#15-get-z-report-info-by-number).

---

## 2. Вспомогательные запросы

### 2.1 Check status

**Method:** `checkStatus`

Проверка статуса программы.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "checkStatus"
}
```

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `error` | Boolean | Проверка на ошибку |
| `message` | String | Информация об ошибке / результат |

#### Пример ответа

```json
{
  "error": false,
  "message": "OK!"
}
```

---

### 2.2 Get Z report Count

**Method:** `getZReportCount`

Кол-во открытых/закрытых (включая текущий) Z отчётов. При закрытии и открытии нового Z отчёта увеличивается на единицу.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getZReportCount"
}
```

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `error` | Boolean | Проверка на ошибку |
| `message` | Object | Данные |
| `message.AppletVersion` | String | Версия апплета ФМ |
| `message.Count` | Integer | Номер / количество Z отчётов |

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "AppletVersion": "0302",
    "Count": 365
  }
}
```

---

### 2.3 Get Version

**Method:** `getVersion`

Получить версию программы.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getVersion"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": "2.0.0.9 -- UniversalTray"
}
```

---

### 2.4 Get Device ID

**Method:** `getDeviceId`

Получить уникальный ID девайса. При регистрации программы в системе «E-POS Systems» используется уникальный код.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getDeviceId"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": "66cc03cf2335842953a832e0cba3026330cf7be806f737fba41d66829a942ba1"
}
```

---

### 2.5 Print Last Paycheck

**Method:** `printLastPaycheck`

Получить последний пробитый чек.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "printLastPaycheck"
}
```

#### Ответ

Ответ аналогичен ответу [Sale](#12-sale).

---

### 2.6 Set Cash Number

**Method:** `setCashNumber`

Взять регистрационный номер ключа. Если программа зарегистрирована в системе «E-POS Systems», с помощью запроса можно взять регистрационный номер.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "setCashNumber"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": "707327"
}
```

---

### 2.7 Send receipt

**Method:** `sendReceipt`

Отправка (суммы) чека из памяти ФМ на сервер ОФД. Функция вызывается только в том случае, если файл БД, хранящий информацию полного чека, стёрся или был повреждён. Если чек не будет отправлен в течение 1 дня, ФМ заблокируется. Функция отправляет чек в ОФД, получает файл подтверждения и передаёт его в ФМ, тем самым разблокируя ФМ.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "sendReceipt"
}
```

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `error` | Boolean | Проверка на ошибку |
| `message` | Object | Данные |
| `message.AppletVersion` | String | Версия апплета ФМ |
| `message.QueuedToSendCount` | Integer | Кол-во сформированных файлов чеков, ожидающих отправки |

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "AppletVersion": "0302",
    "QueuedToSendCount": 1
  }
}
```

---

### 2.8 Acknowledge

**Method:** `acknowledge`

Acknowledge — файл подтверждения о получении чека после принятия чека сервером ОФД. Acknowledge после получения хранится в файле БД. Через определённый интервал Acknowledge передаётся в ФМ для удаления чека из памяти ФМ.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "acknowledge"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "Errors": [],
    "AppletVersion": "",
    "SuccessCount": 0,
    "ErrorCount": 0
  }
}
```

---

### 2.9 Rescan receipts

**Method:** `rescanReceipts`

Пересчитать память ФМ и определить дату первого неотправленного чека.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "rescanReceipts"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "AppletVersion": "0302",
    "FirstReceiptTime": "2021-11-13 11:10:11"
  }
}
```

---

### 2.10 Get Receipt Info

**Method:** `getReceiptInfo`

Получить состав чека (только суммы) из памяти ФМ по порядковому номеру в поле `number`.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `token` | String | Токен не меняется | R |
| `method` | String | Метод запроса | R |
| `number` | Integer | Порядковый номер чека | R |

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getReceiptInfo",
  "number": 1
}
```

#### Параметры ответа

| Поле | Тип | Описание |
|---|---|---|
| `error` | Boolean | Проверка на ошибку |
| `message` | Object | Данные чека |
| `message.AppletVersion` | String | Версия апплета в ФМ |
| `message.TerminalID` | String | Серийный номер ФМ |
| `message.Number` | Integer | Порядковый номер чека |
| `message.Count` | Integer | Кол-во неотправленных чеков |
| `message.TransactionTime` | String | Дата и время регистрации чека (`ГГГГ-ММ-ДД ЧС-МН-СК`) |
| `message.Sale` | Boolean | Продажа = `true`, возврат = `false` |
| `message.ReceiptSeq` | String | Номер чека |
| `message.TotalCash` | Integer | Сумма наличности, в тийинах |
| `message.TotalCard` | Integer | Сумма безналичности, в тийинах |
| `message.TotalVAT` | Integer | Сумма НДС, в тийинах |

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "Sale": true,
    "TransactionTime": "2021-11-13 11:11:21",
    "AppletVersion": "0302",
    "Number": 1,
    "TotalVAT": 207678,
    "TotalCard": 260000,
    "TotalCash": 260000,
    "TerminalID": "UZ191211501031",
    "Count": 1,
    "ReceiptSeq": "2627"
  }
}
```

---

### 2.11 Send Z report by number

**Method:** `sendZReportByNumber`

Ручная отправка закрытого Z отчёта с заданным порядковым номером в поле `number`. Сервис Communicator при закрытии автоматически отправит неотправленные Z отчёты. **Функция применяется только для тестирования.**

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `token` | String | Токен не меняется | R |
| `method` | String | Метод запроса | R |
| `number` | Integer | Порядковый номер Z отчёта | R |

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "sendZReportByNumber",
  "number": 72
}
```

---

### 2.12 Get Unsent Count

**Method:** `getUnsentCount`

Получить кол-во хранящихся в БД, но пока ещё не отправленных файлов в ОФД. Ненулевое кол-во может означать, что либо время отправки для только что созданного файла не наступило, либо сервис Communicator не смог установить соединение с серверами ОФД по причине отсутствия интернет-соединения или недоступности серверов ОФД.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getUnsentCount"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "TerminalID": {
      "UZ191211501031": 1
    },
    "Count": 1
  }
}
```

---

### 2.13 Get Acknowledge count

**Method:** `getAckCount`

Получить кол-во `acknowledge` файлов, ожидающих отправки в ФМ.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getAckCount"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "TerminalID": {},
    "Count": 0
  }
}
```

---

### 2.14 Get Z report Status

**Method:** `getZReportsStats`

Получить кол-во закрытых, неотправленных в ОФД Z отчётов и 16 первых номеров неотправленных в ОФД Z отчётов.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getZReportsStats"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "TotalClosedUnAckZReportsCount": 0,
    "AppletVersion": "0302",
    "LastUnAckZReportsNumbers": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "TotalClosedZReportsCount": 364
  }
}
```

---

### 2.15 Get receipts info by date

**Method:** `getReceiptsInfoByDate`

Получить фискальные данные чеков из БД за определённый промежуток времени.

#### Параметры запроса

| Поле | Тип | Описание | Признак |
|---|---|---|---|
| `token` | String | Токен не меняется | R |
| `method` | String | Метод запроса | R |
| `startDate` | String | Начало периода (формат `ГГГГММДДЧСМНСК`) | R |
| `endDate` | String | Конец периода (формат `ГГГГММДДЧСМНСК`) | R |

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getReceiptsInfoByDate",
  "startDate": "20210901110000",
  "endDate": "20210919112700"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": [
    {
      "terminalId": "UZ191211501031",
      "receiptSeq": "2624",
      "fiscalSign": "230084336577",
      "qrCodeURL": "https://ofd.soliq.uz/check?t=UZ191211501031&r=2624&c=20211110142338&s=230084336577",
      "dateTime": "2021-11-10 14:23:38.0"
    },
    {
      "terminalId": "UZ191211501031",
      "receiptSeq": "2625",
      "fiscalSign": "481239451500",
      "qrCodeURL": "https://ofd.soliq.uz/check?t=UZ191211501031&r=2625&c=20211113105752&s=481239451500",
      "dateTime": "2021-11-13 10:57:52.0"
    },
    {
      "terminalId": "UZ191211501031",
      "receiptSeq": "2626",
      "fiscalSign": "083306860386",
      "qrCodeURL": "https://ofd.soliq.uz/check?t=UZ191211501031&r=2626&c=20211113111011&s=083306860386",
      "dateTime": "2021-11-13 11:10:11.0"
    },
    {
      "terminalId": "UZ191211501031",
      "receiptSeq": "2627",
      "fiscalSign": "592435754475",
      "qrCodeURL": "https://ofd.soliq.uz/check?t=UZ191211501031&r=2627&c=20211113111121&s=592435754475",
      "dateTime": "2021-11-13 11:11:21.0"
    }
  ]
}
```

---

### 2.16 Get fiscals list

**Method:** `getFiscalsList`

Определение заводского номера фискального модуля.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getFiscalsList"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "FactoryID": ["00120000010b02056a200014002b002f4090"]
  }
}
```

---

### 2.17 Get status

**Method:** `getStatus`

Получить дополнительную информацию от сервиса Communicator.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getStatus"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "Sender": {
      "LastOnlineTime": "2021-11-13T10:58:16.7845408+05:00",
      "ZReportFilesSent": { "UZ191211501031": 1 },
      "AdvanceReceiptFilesSent": {},
      "TotalAckFilesReceived": { "UZ191211501031": 5 },
      "EncodedFullReceiptBodyFilesSent": {},
      "FullReceiptFilesSent": { "UZ191211501031": 4 },
      "TotalFilesSent": { "UZ191211501031": 5 },
      "LastSendReceiveDuration": "230.9869ms",
      "ReceiptFilesSent": {},
      "LiveAddress": "s0.ofd.uz:3447",
      "CreditReceiptFilesSent": {}
    },
    "StartTime": "2021-11-13 10:57:46",
    "DB": {
      "ArchivedFiles": {
        "2021-11": 1,
        "2021-10": 0
      }
    }
  }
}
```

---

### 2.18 Get last registered receipt

**Method:** `getLastRegisteredReceipt`

Получить ответ от последнего зарегистрированного чека.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getLastRegisteredReceipt"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "AppletVersion": "0302",
    "QRCodeURL": "https://ofd.soliq.uz/check?t=UZ191211501031&r=2628&c=20211113112502&s=221423418375",
    "TerminalID": "UZ191211501031",
    "ReceiptSeq": "2628",
    "DateTime": "20211113112502",
    "FiscalSign": "221423418375"
  }
}
```

---

### 2.19 Get receipt count

**Method:** `getReceiptCount`

Получить кол-во неотправленных чеков в памяти ФМ.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "getReceiptCount"
}
```

#### Пример ответа

```json
{
  "error": false,
  "message": {
    "AppletVersion": "0302",
    "Count": 0
  }
}
```

---

### 2.20 Resend Unsent

**Method:** `resendUnsent`

Ручная отправка файлов на сервер ОФД. Сервис Communicator по определённому интервалу автоматически отправляет неотправленные файлы. **Функция применяется только для тестирования** или для срочной отправки файлов, не дожидаясь автоматической отправки.

#### Пример запроса

```json
{
  "token": "DXJFX32CN1296678504F2",
  "method": "resendUnsent"
}
```

---

## 3. Ошибки программы

| Ответ | Описание ответа |
|---|---|
| `SUCCESS` | Успешно |
| `ERROR_RECEIPT_COUNT_ZERO` | Количество чеков равно нулю |
| `ERROR_RECEIPT_INDEX_OUT_OF_BOUNDS` | Номер чека неправильный |
| `ERROR_RECEIPT_NOT_FOUND` | Чек не найден |
| `ERROR_RECEIPT_TOTAL_PRICE_OVERFLOW` | Общая сумма превышает максимальное значение |
| `ERROR_RECEIPT_TOTAL_PRICE_MISMATCH` | Общая сумма превышает стоимость по товарным позициям |
| `ERROR_RECEIPT_MEMORY_FULL` | Память чека заполнена |
| `ERROR_RECEIPT_TIME_PAST` | Время чека старое |
| `ERROR_RECEIPT_STORE_DAYS_LIMIT_EXCEEDED` | Кол-во дней хранения чеков превышено, следует отправить чеки |
| `DISCOUNT SUM IS GRATER THEN PRICE SUM` | Сумма скидки больше, чем сумма товара |
| `ERROR_ZREPORT_SPACE_IS_FULL` | Память Z-отчётов заполнена |
| `ERROR_ZREPORT_INDEX_OUT_OF_BOUNDS` | Номер Z-отчёта неправильный |
| `ERROR_LOCKED_FOREVER` | Фискальный модуль заблокирован |
| `ERROR_CURRENT_ZREPORT_IS_EMPTY` | Текущий Z-отчёт пустой |
| `ERROR_RECEIPT_TOTAL_PRICE_ZERO` | Общая сумма чека не может быть нулём |
| `ERROR_ZREPORT_IS_NOT_OPEN` | Z-отчёт не открыт |
| `ERROR_SALE_REFUND_COUNT_OVERFLOW` | Превышено кол-во операций (продажи и возврата) в Z-отчёте |
| `ERROR_ZREPORT_IS_ALREADY_OPEN` | Z-отчёт уже открыт |
| `ERROR_NOT_ENOUGH_CASH_FOR_REFUND` | Недостаточно средств для возврата (наличка) |
| `ERROR_NOT_ENOUGH_CARD_FOR_REFUND` | Недостаточно средств для возврата (пластик) |
| `ERROR_NOT_ENOUGH_VAT_FOR_REFUND` | Недостаточно средств для возврата (НДС) |
| `ERROR_MAINTENANCE_REQUIRED` | Требуется обслуживание со стороны ОФД |
| `SUM MISMATCH` / `cannot encode receipt` | Сумма не совпадает по формуле |
| `UNSUPPORTED_REQUEST_FORMAT` | Неподдерживаемый формат запроса. Не все поля соответствуют запросу |
| `WRONG_TOKEN` | Неправильный токен |
| `CASH_REGISTERER_NUMBER_NOT_AVAILABLE` | Касса не была зарегистрирована в реестре E-POS. Обращайтесь в службу поддержки |
| `ZREPORT_ID_NOT_PROVIDED` | При проведении запроса не был указан номер Z отчёта |
| `RECEIPT_NUMBER_NOT_PROVIDED` | При проведении запроса не был указан номер онлайн-чека |
| `PERIOD_NOT_PROVIDED` | Период не был указан |
| `COULD_NOT_SEND_PAYCHECK` | Данные не были отправлены |
| `NO_SUCH_METHOD_AVAILABLE` | Такой метод недоступен |
| `FISCAL_DRIVE_IS_NOT_WORKING` | Фискальный драйвер не работает |
| `cannot select applet` | Не удалось выбрать апплет, ФМ повреждён |
| `cannot connect card` | Не удалось подключиться к ФМ: ФМ не подключён или не найден по указанному заводскому номеру |
| `try later` | Другие ошибки. Подробности смотрите в лог-файле сервиса Communicator |
| `illegal argument` | Передан недействительный параметр в JSON |
| `fiscal drive locked` | Сервер ОФД заблокировал приём чеков от ФМ, обратитесь в ОФД. После разблокировки ФМ в ОФД подождите ~10 минут, затем перезапустите сервис FiscalDriveAPI |
