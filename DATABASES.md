# Database Documentation

Imported from `all.sql`. Total: 28 databases.


---

## 1. accountingdb


### `public.Accounting_payments`

| Column | Type |
|--------|------|
| name | varchar(30) |
| id | bigint |
| type_id | bigint |
| amount | bigint |
| currency | integer |
| date_time | timestamptz |
| doc_identifier | varchar(128) |
| doc_type | varchar(32) |
| linked_id | bigint |
| ext_transaction_id | bigint |
| is_deleted | boolean |

**Example:**
```json
{
  "name": "ClientFinOrgDebtTransfer",
  "id": 1,
  "type_id": 3,
  "amount": 390000000,
  "currency": 860,
  "date_time": "2024-02-21T11:39:23.279866+00:00",
  "doc_identifier": "1",
  "doc_type": "Deal",
  "linked_id": null,
  "ext_transaction_id": null,
  "is_deleted": false
}
```

### `public.accounts`

| Column | Type |
|--------|------|
| id | bigint |
| type | text |
| identifier | text |
| owner_type | integer |
| upper_id | bigint |
| data | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "type": "Plum",
  "identifier": "Plum",
  "owner_type": 4,
  "upper_id": null,
  "data": null,
  "is_deleted": false
}
```

### `public.ext_transactions`

| Column | Type |
|--------|------|
| id | bigint |
| operation_id | bigint |
| src | integer |
| type | varchar(32) |
| identifier | varchar(64) |
| date_time | timestamptz |
| amount | bigint |
| currency | integer |
| data | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "operation_id": 24,
  "src": 3,
  "type": "Plum",
  "identifier": "22247258",
  "date_time": "2024-06-05T02:15:07.653255+00:00",
  "amount": 55400000,
  "currency": 860,
  "data": "{...}",
  "is_deleted": false
}
```

### `public.operation_records`

| Column | Type |
|--------|------|
| id | bigint |
| amount | bigint |
| currency | integer |
| operation_id | bigint |
| mode | integer |
| account_id | bigint |
| associate_id | bigint |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "amount": -390000000,
  "currency": 860,
  "operation_id": 1,
  "mode": 3,
  "account_id": 4,
  "associate_id": 7,
  "is_deleted": false
}
```

### `public.operation_types`

| Column | Type |
|--------|------|
| id | bigint |
| name | varchar(30) |
| sub_types | ARRAY |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "name": "PlumPspTransfer",
  "sub_types": [],
  "is_deleted": false
}
```

### `public.operations`

| Column | Type |
|--------|------|
| id | bigint |
| type_id | bigint |
| amount | bigint |
| currency | integer |
| date_time | timestamptz |
| doc_identifier | varchar(128) |
| doc_type | varchar(32) |
| linked_id | bigint |
| ext_transaction_id | bigint |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "type_id": 3,
  "amount": 390000000,
  "currency": 860,
  "date_time": "2024-02-21T11:39:23.279866+00:00",
  "doc_identifier": "1",
  "doc_type": "Deal",
  "linked_id": null,
  "ext_transaction_id": null,
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20240110141938_Initial",
  "product_version": "7.0.14"
}
```

---

## 2. agreement


### `public.agreement_items`

| Column | Type |
|--------|------|
| id | uuid |
| deal_id | bigint |
| deal_item_id | uuid |
| serial_numbers | ARRAY |
| names | jsonb |
| sku | text |
| price | numeric |
| m_price | numeric |
| m_vat | numeric |
| vat | numeric |
| currency | integer |
| m_currency | integer |
| count | integer |
| unit | text |
| is_deleted | boolean |
| data | jsonb |

**Example:**
```json
{
  "id": "40a1d8d8-9c06-4024-8fd8-8268760cb7d1",
  "deal_id": 1,
  "deal_item_id": "09977f9f-7412-485c-adbc-5a7095ee6f69",
  "serial_numbers": [
    "test"
  ],
  "names": "{...}",
  "sku": "Плоскопанельный_телевизор_TV_ARTEL_A43KF5500_android_чёрный",
  "price": 3900000.0,
  "m_price": 3000000.0,
  "m_vat": 321429.0,
  "vat": 417857.14285714284,
  "currency": 860,
  "m_currency": 860,
  "count": 1,
  "unit": "pc",
  "is_deleted": false,
  "data": null
}
```

### `public.agreements`

| Column | Type |
|--------|------|
| id | uuid |
| owner_id | text |
| deal_id | bigint |
| fin_product_id | uuid |
| term_duration | integer |
| term_type | integer |
| deal_type | integer |
| product_source | integer |
| type | integer |
| prepayment | numeric |
| sum | numeric |
| vat | numeric |
| currency | integer |
| data | jsonb |
| pre_schedule | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "310cd75b-848d-4144-ad69-f1800c3f0f01",
  "owner_id": "6bbec1c1-7875-4698-8447-77e5a148c7c2",
  "deal_id": 1,
  "fin_product_id": "46e00118-b0b8-4b08-9b17-2dc8618fc89b",
  "term_duration": 12,
  "term_type": 0,
  "deal_type": 0,
  "product_source": 0,
  "type": 3,
  "prepayment": 0.0,
  "sum": 3900000.0,
  "vat": 417857.14285714284,
  "currency": 860,
  "data": null,
  "pre_schedule": "[{'Amount': 325000.0, 'InTerm': {'Type': 0, 'Duration': 1}, 'Currency': 860}, {'...",
  "is_deleted": false
}
```

### `public.approvements`

| Column | Type |
|--------|------|
| id | uuid |
| agreement_id | uuid |
| type | integer |
| approved_at | timestamptz |
| status | integer |
| rejection_reason | text |
| reference | text |
| approver_id | text |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "2b851ced-1303-4ef4-b655-acbad6782cc8",
  "agreement_id": "310cd75b-848d-4144-ad69-f1800c3f0f01",
  "type": 2,
  "approved_at": "2024-02-21T06:28:48.913909+00:00",
  "status": 1,
  "rejection_reason": null,
  "reference": "0637c0c1-0f64-41a2-8716-5b110ac5b08a",
  "approver_id": "6",
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20230819173447_Initial",
  "product_version": "7.0.5"
}
```

---

## 3. autopayment


### `public.auto_payment_states`

| Column | Type |
|--------|------|
| id | uuid |
| auto_payment_id | uuid |
| payed_amount | numeric |
| balance_amount | numeric |
| status | integer |
| date | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "b5ee09ae-8144-452f-811c-7702c818c3c9",
  "auto_payment_id": "902f48c9-2c0b-445c-b906-fa7f1e00671b",
  "payed_amount": 0,
  "balance_amount": 0,
  "status": 0,
  "date": "2024-06-05T07:15:02.466147",
  "is_deleted": false
}
```

### `public.auto_payments`

| Column | Type |
|--------|------|
| id | uuid |
| contract_id | uuid |
| amount | numeric |
| date | timestamp |
| schedule_date | date |
| type | integer |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "902f48c9-2c0b-445c-b906-fa7f1e00671b",
  "contract_id": "a57d85d1-3c74-456f-92f9-339389f9a8b7",
  "amount": 554000,
  "date": "2024-06-05T07:15:02.46605",
  "schedule_date": "2024-06-05",
  "type": 0,
  "is_deleted": false
}
```

### `public.card_update_states`

| Column | Type |
|--------|------|
| id | uuid |
| update_card_id | uuid |
| job_status | integer |
| date | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "34027985-c21e-4132-b7f2-1e14ce888ce3",
  "update_card_id": "37203779-1962-4f16-b8d5-c8a8232450c5",
  "job_status": 0,
  "date": "2025-02-05T14:04:07.357649",
  "is_deleted": false
}
```

### `public.card_updates`

| Column | Type |
|--------|------|
| id | uuid |
| client_id | uuid |
| job_id | numeric |
| auto_pay_client_id | text |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "37203779-1962-4f16-b8d5-c8a8232450c5",
  "client_id": "c6c140f6-bb76-4cb5-897c-c8377f37e6cf",
  "job_id": 66173,
  "auto_pay_client_id": "DFD313F6B06F460780857884F48DCAD6",
  "is_deleted": false
}
```

### `public.clients`

| Column | Type |
|--------|------|
| id | uuid |
| identifier | text |
| user_id | text |
| service_identifier | text |
| doc | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "3f3722c5-a6c1-4e35-9f00-6bfe283b4f65",
  "identifier": "30801900171453",
  "user_id": "8",
  "service_identifier": "850CA6F591A44D9DAF7CB703BCC4D17F",
  "doc": "{...}",
  "is_deleted": false
}
```

### `public.confirmations`

| Column | Type |
|--------|------|
| id | uuid |
| service_identifier | text |
| contract_id | uuid |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "df195695-253e-406f-a85a-42b28b90cc02",
  "service_identifier": "CF32F29BDA7D4F4C9C64C3C27A0E1CBF",
  "contract_id": "a57d85d1-3c74-456f-92f9-339389f9a8b7",
  "is_deleted": false
}
```

### `public.contract_states`

| Column | Type |
|--------|------|
| id | uuid |
| contract_id | uuid |
| status | integer |
| date | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "94f2c7f7-fe23-441d-81d0-e7d39195504c",
  "contract_id": "005695b6-0fbd-4e5f-9dab-9bab7de1e093",
  "status": 0,
  "date": "2024-09-07T05:40:05.360638",
  "is_deleted": false
}
```

### `public.contracts`

| Column | Type |
|--------|------|
| id | uuid |
| amount | numeric |
| identifier | text |
| expire_date | timestamp |
| date | timestamp |
| description | text |
| client_id | uuid |
| client_type | integer |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "38f537b8-76d4-4de7-836a-acc020830b39",
  "amount": 3780000.0,
  "identifier": "8",
  "expire_date": "2026-05-22T00:00:00",
  "date": "2024-05-22T11:54:26.593872",
  "description": "Рассрочка #8. Контракт заключен: 05/22/2024",
  "client_id": "3f3722c5-a6c1-4e35-9f00-6bfe283b4f65",
  "client_type": 0,
  "is_deleted": false
}
```

### `public.request_histories`

| Column | Type |
|--------|------|
| id | bigint |
| created_date | timestamp |
| user_id | bigint |
| request | text |
| response | text |
| url | text |
| is_success | boolean |

**Example:**
```json
{
  "id": 1,
  "created_date": "2024-05-22T11:19:32.543454",
  "user_id": 0,
  "request": "{\"userId\":\"8\",\"pnfl\":\"30801900171453\",\"lastName\":\"ALIASQAROV\",\"firstName\":\"OTABE...",
  "response": "{\"result\":null,\"error\":{\"errorCode\":-257,\"errorMessage\":\"Услуга временно недосту...",
  "url": "https://pay.myuzcard.uz/api/AutoPayment/CreateClient",
  "is_success": false
}
```

### `public.transaction_states`

| Column | Type |
|--------|------|
| id | uuid |
| date | timestamp |
| status | integer |
| status_comment | text |
| transaction_id | uuid |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "eae923e8-cfbd-4faf-be2b-4e272487889e",
  "date": "2024-06-05T07:15:05.933245",
  "status": 1,
  "status_comment": "Успешно",
  "transaction_id": "6807e0c6-d603-455e-b7b2-b8f04bade2ef",
  "is_deleted": false
}
```

### `public.transactions`

| Column | Type |
|--------|------|
| id | uuid |
| service_identifier | text |
| amount | numeric |
| currency | integer |
| terminal_id | text |
| merchant_id | text |
| date | timestamp |
| extra_id | text |
| auto_payment_id | uuid |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "6807e0c6-d603-455e-b7b2-b8f04bade2ef",
  "service_identifier": "22247258",
  "amount": 554000.0,
  "currency": 860,
  "terminal_id": "97011263",
  "merchant_id": "903100000031056",
  "date": "2024-06-05T07:15:05.933245",
  "extra_id": "902f48c9-2c0b-445c-b906-fa7f1e00671b",
  "auto_payment_id": "902f48c9-2c0b-445c-b906-fa7f1e00671b",
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20240404043311_InitialMigration",
  "product_version": "7.0.5"
}
```

---

## 4. background_jobs


### `public.jobs`

| Column | Type |
|--------|------|
| id | uuid |
| identifier | text |
| type | text |
| queue | text |
| reason | text |
| data | jsonb |
| message_types | ARRAY |
| destination_address | text |
| date | timestamptz |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "a7d1c67a-7827-4406-ac5f-b9fbb658d0c8",
  "identifier": "1130",
  "type": "Taqsim.Finance.Models.AutoPayment.AutoPayRequest",
  "queue": "AutoPaymentRequest",
  "reason": "Connection refused (taqsim-schedule-inner-api:80)",
  "data": "{...}",
  "message_types": [
    "urn:message:Taqsim.Finance.Models.AutoPayment:AutoPayRequest"
  ],
  "destination_address": "rabbitmq://rabbitmq/AutoPaymentRequest?bind=true",
  "date": "2024-12-11T18:07:31.086493+00:00",
  "is_deleted": false
}
```

### `public.states`

| Column | Type |
|--------|------|
| id | uuid |
| job_id | uuid |
| status | integer |
| created_at | timestamptz |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "ad8f179f-c04b-4513-8c46-7296276d86fe",
  "job_id": "a7d1c67a-7827-4406-ac5f-b9fbb658d0c8",
  "status": 0,
  "created_at": "2024-12-11T18:07:31.095135+00:00",
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20241014080728_InitialMigration",
  "product_version": "7.0.5"
}
```

---

## 5. bankingdb


### `public.payment_confirmations`

| Column | Type |
|--------|------|
| id | uuid |
| payment_order_id | uuid |
| user_id | text |
| date | timestamptz |
| is_deleted | boolean |
| sert_num | text |
| signature | text |
| type | integer |

**Example:**
```json
_empty table_
```

### `public.payment_items`

| Column | Type |
|--------|------|
| id | bigint |
| identifier | text |
| amount | bigint |
| payment_order_id | uuid |
| is_deleted | boolean |
| date | date |
| schedule_id | uuid |

**Example:**
```json
{
  "id": 1,
  "identifier": "4",
  "amount": 280000000,
  "payment_order_id": "b90a7193-fb88-483e-9279-72d832e18927",
  "is_deleted": false,
  "date": "-infinity",
  "schedule_id": "00000000-0000-0000-0000-000000000000"
}
```

### `public.payment_order_fin`

| Column | Type |
|--------|------|
| id | uuid |
| sum | bigint |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "a6aa92ee-bd13-4d58-add7-86d9323fec53",
  "sum": 0,
  "is_deleted": false
}
```

### `public.payment_order_states`

| Column | Type |
|--------|------|
| id | uuid |
| payment_order_id | uuid |
| provider_status | text |
| status | integer |
| created_at | timestamptz |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "29ceccc7-6167-4810-86fe-f9adb654aa51",
  "payment_order_id": "c8c76093-25af-49bc-b1fc-1c24dbd96441",
  "provider_status": "",
  "status": 0,
  "created_at": "2024-02-21T12:30:03.665101+00:00",
  "is_deleted": false
}
```

### `public.payment_orders`

| Column | Type |
|--------|------|
| id | uuid |
| mfo | text |
| document_number | text |
| sender_acc | text |
| sender_inn | text |
| sender_name | text |
| sender_mfo | text |
| receiver_acc | text |
| receiver_inn | text |
| receiver_name | text |
| receiver_mfo | text |
| purpose | text |
| owner_identifier | text |
| date | timestamptz |
| is_deleted | boolean |
| currency | integer |
| fin_id | uuid |

**Example:**
```json
{
  "id": "c8c76093-25af-49bc-b1fc-1c24dbd96441",
  "mfo": "00444",
  "document_number": "merchant",
  "sender_acc": "20214000405726197001",
  "sender_inn": "310971100",
  "sender_name": "'FINSUM MARKET' mas’uliyati cheklangan jamiyati qo’shma korxonasi",
  "sender_mfo": "00444",
  "receiver_acc": "20208000905614792001",
  "receiver_inn": "310236000",
  "receiver_name": "SARVAR 8888",
  "receiver_mfo": "ТОШКЕНТ Ш., `ДАВР-БАНК` ХАТ БАНКИНИНГ ОЛМАЗОР ФИЛИАЛИ                           ",
  "purpose": "Исходящий платёж",
  "owner_identifier": "202402211230036649df6d3e9-3ee5-4c0d-8f37-790cdb1e626e",
  "date": "2024-02-21T12:30:03.664903+00:00",
  "is_deleted": false,
  "currency": 0,
  "fin_id": "d3c1a6b1-2f30-46f0-890f-6189fb72a922"
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20240103103741_InitialMigration",
  "product_version": "7.0.14"
}
```

---

## 6. buyout


### `public.buy_fin_states`

| Column | Type |
|--------|------|
| id | uuid |
| buy_id | bigint |
| buy_item_id | uuid |
| created_at | timestamptz |
| status | enum |
| payday | smallint |
| pay_start_date | date |
| term_duration | integer |
| term_type | integer |
| product_source | enum |
| prepay | numeric |
| sum | numeric |
| vat | numeric |
| currency | integer |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "6767c203-77e5-4faf-9c21-7a2cc81833f0",
  "buy_id": 1,
  "buy_item_id": null,
  "created_at": "2024-02-21T11:29:01.033031+00:00",
  "status": "created",
  "payday": 31,
  "pay_start_date": null,
  "term_duration": null,
  "term_type": null,
  "product_source": "on_order",
  "prepay": 0,
  "sum": 3000000.0,
  "vat": 321429.0,
  "currency": 860,
  "is_deleted": false
}
```

### `public.buy_item_states`

| Column | Type |
|--------|------|
| id | uuid |
| buy_item_id | uuid |
| serials | ARRAY |
| count | integer |
| quantity | numeric |
| m_init_price | numeric |
| m_price | numeric |
| m_vat | numeric |
| m_currency | integer |
| created_at | timestamptz |
| status | enum |
| is_deleted | boolean |
| commission | numeric |

**Example:**
```json
{
  "id": "3c38b9b6-08d6-4aa8-886a-81732bd0929e",
  "buy_item_id": "497a9e64-a769-4bf4-b9bd-44e60950f798",
  "serials": [
    "test"
  ],
  "count": 1,
  "quantity": null,
  "m_init_price": 3000000.0,
  "m_price": 3000000.0,
  "m_vat": 321429.0,
  "m_currency": 860,
  "created_at": "2024-02-21T11:29:00.496016+00:00",
  "status": "created",
  "is_deleted": false,
  "commission": 0
}
```

### `public.buy_items`

| Column | Type |
|--------|------|
| id | uuid |
| buy_id | bigint |
| category_id | bigint |
| name | jsonb |
| sku | text |
| product_code | text |
| unit_code | text |
| unit | text |
| data | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "497a9e64-a769-4bf4-b9bd-44e60950f798",
  "buy_id": 1,
  "category_id": 20,
  "name": "{...}",
  "sku": "Плоскопанельный_телевизор_TV_ARTEL_A43KF5500_android_чёрный",
  "product_code": "08528001001006299",
  "unit_code": "1349945",
  "unit": "pc",
  "data": null,
  "is_deleted": false
}
```

### `public.buy_refs`

| Column | Type |
|--------|------|
| id | uuid |
| buy_id | bigint |
| ref_id | uuid |
| type | enum |
| ref_type | text |
| is_deleted | boolean |
| data | jsonb |

**Example:**
```json
{
  "id": "9208407f-ea8c-4f68-9d95-e77adbd94b60",
  "buy_id": 1,
  "ref_id": "00000000-0000-0000-0000-000000000000",
  "type": "agreement",
  "ref_type": null,
  "is_deleted": false,
  "data": "[{'Id': '310cd75b-848d-4144-ad69-f1800c3f0f01', 'OwnerId': '6bbec1c1-7875-4698-8..."
}
```

### `public.buy_state_dealID`

| Column | Type |
|--------|------|
| deal_identifier | text |
| buy_id | bigint |
| created_at | timestamptz |
| buy_status | enum |
| is_deleted | boolean |
| id | uuid |

**Example:**
```json
{
  "deal_identifier": "1",
  "buy_id": 1,
  "created_at": "2024-02-21T11:29:00.310147+00:00",
  "buy_status": "created",
  "is_deleted": false,
  "id": "048cf5d7-dc76-4bc4-8889-ba9d29fd66b8"
}
```

### `public.buy_states`

| Column | Type |
|--------|------|
| id | uuid |
| buy_id | bigint |
| created_at | timestamptz |
| buy_status | enum |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "048cf5d7-dc76-4bc4-8889-ba9d29fd66b8",
  "buy_id": 1,
  "created_at": "2024-02-21T11:29:00.310147+00:00",
  "buy_status": "created",
  "is_deleted": false
}
```

### `public.buys`

| Column | Type |
|--------|------|
| id | bigint |
| agent_id | uuid |
| merchant_id | uuid |
| is_deleted | boolean |
| deal_identifier | text |

**Example:**
```json
{
  "id": 1,
  "agent_id": "b665e8bd-d360-4b1b-9b03-ecf41e825755",
  "merchant_id": "9df6d3e9-3ee5-4c0d-8f37-790cdb1e626e",
  "is_deleted": false,
  "deal_identifier": "1"
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20231120062611_Initial",
  "product_version": "7.0.5"
}
```

---

## 7. cards


### `public.cards`

| Column | Type |
|--------|------|
| id | uuid |
| provider | integer |
| user_id | bigint |
| phone_number | text |
| service_identifier | text |
| owner | text |
| card_name | text |
| masked_number | text |
| is_trusted | boolean |
| balance | numeric |
| expire_date | text |
| status | integer |
| card_session_id | uuid |
| is_deleted | boolean |
| id_by_service | text |

**Example:**
```json
{
  "id": "b560563a-e965-4968-9256-7511b4af0509",
  "provider": 1,
  "user_id": 6,
  "phone_number": "998974550331",
  "service_identifier": "1780016",
  "owner": "SULTANBAEV SHERZOD",
  "card_name": "",
  "masked_number": "860048******0309",
  "is_trusted": true,
  "balance": 0.0,
  "expire_date": "2712",
  "status": 0,
  "card_session_id": "58e95930-f088-43ca-9c72-a7e70ef6ebb1",
  "is_deleted": false,
  "id_by_service": ""
}
```

### `public.sessions`

| Column | Type |
|--------|------|
| id | uuid |
| provider | integer |
| user_id | bigint |
| phone_number | text |
| provider_key | text |
| is_deleted | boolean |
| card_info_hash | text |
| card_salt | text |

**Example:**
```json
{
  "id": "58e95930-f088-43ca-9c72-a7e70ef6ebb1",
  "provider": 0,
  "user_id": 6,
  "phone_number": "998974550331",
  "provider_key": "20403098",
  "is_deleted": false,
  "card_info_hash": "",
  "card_salt": ""
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20230517103522_Initial",
  "product_version": "7.0.5"
}
```

---

## 8. catalog


### `public.locales`

| Column | Type |
|--------|------|
| key | varchar(10) |
| title | varchar(32) |
| code | varchar(15) |

**Example:**
```json
{
  "key": "ru",
  "title": "Русский",
  "code": "ru-RU"
}
```

### `public.product_locales`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| product_id | uuid |
| title | text |

**Example:**
```json
{
  "locale_key": "ru",
  "product_id": "ca6e9cbe-9e3e-4ff8-879e-09d9c8e210d4",
  "title": "Стиральная машина бытовая: VOLMER, автомат VL-06SL8"
}
```

### `public.products`

| Column | Type |
|--------|------|
| id | uuid |
| category_id | bigint |
| merchant_id | uuid |
| unit_key | text |
| name | text |
| sku | text |
| product_code | text |
| price | numeric |
| vat | numeric |
| currency | integer |
| is_deleted | boolean |
| unit_code | text |

**Example:**
```json
{
  "id": "059db849-f13c-48bf-b731-caf590df25a0",
  "category_id": 20,
  "merchant_id": "256bb0bb-32b9-4c12-beba-2529923e9402",
  "unit_key": "pc",
  "name": "Xiaomi Redmi Note 13 Pro 12/512GB Midnight Black",
  "sku": "Xiaomi Redmi Note 13 Pro 12/512GB Midnight Black",
  "product_code": "08517001001000000",
  "price": 4460000,
  "vat": 477857.142857143,
  "currency": 860,
  "is_deleted": false,
  "unit_code": "1349766"
}
```

### `public.unit_locales`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| unit_key | text |
| title | text |

**Example:**
```json
{
  "locale_key": "ru",
  "unit_key": "pc",
  "title": "шт."
}
```

### `public.units`

| Column | Type |
|--------|------|
| key | text |
| unit_code | text |
| name | text |
| inc_value | numeric |

**Example:**
```json
{
  "key": "pc",
  "unit_code": "1349945",
  "name": "шт",
  "inc_value": 0
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20230510082543_Initial",
  "product_version": "7.0.5"
}
```

---

## 9. clientbanking


### `public.client_payments`

| Column | Type |
|--------|------|
| id | uuid |
| target_identifier | text |
| target | integer |
| schema | integer |
| amount | bigint |
| sender_mfo | text |
| receiver_bank_account_id | uuid |
| purpose | text |
| document_number | text |
| registered_by | text |
| performed_at | timestamp |
| created_at | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "1de738be-3cfc-401c-96ff-1197c53e44a6",
  "target_identifier": "566",
  "target": 0,
  "schema": 0,
  "amount": 100000,
  "sender_mfo": "00973",
  "receiver_bank_account_id": "65ce5780-923a-49dd-868d-19d78d22ea42",
  "purpose": "oplata universalbankdan olingan summa",
  "document_number": "1",
  "registered_by": "1",
  "performed_at": "2025-03-05T14:57:00",
  "created_at": "2025-03-05T09:59:40.602242",
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20240703122756_Initial",
  "product_version": "7.0.5"
}
```

---

## 10. contracts


### `public.cancellation`

| Column | Type |
|--------|------|
| id | uuid |
| contract_id | uuid |
| date | timestamp |
| reason | text |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "93a7e70c-7793-48fa-ba89-7813b34164b4",
  "contract_id": "6ae034d1-a961-4ae8-baa1-965b76d5f14a",
  "date": "2024-09-27T13:27:13.91437",
  "reason": null,
  "is_deleted": false
}
```

### `public.confirmations`

| Column | Type |
|--------|------|
| id | uuid |
| confirmed_date | timestamp |
| contract_id | uuid |
| doc_type | text |
| token | text |
| owner_id | text |
| is_deleted | boolean |
| contract_doc_id | uuid |

**Example:**
```json
{
  "id": "9f4b26d6-ab75-4863-9dfd-05dc822e2f78",
  "confirmed_date": "2024-02-21T11:39:01.776104",
  "contract_id": "d2723187-9c92-4d82-b6a2-308568999c1b",
  "doc_type": "Murobaxa",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaWQiOiI4MTg5NjMyOC1kYzgxLTQzMzUtYjBmZC1...",
  "owner_id": "6",
  "is_deleted": false,
  "contract_doc_id": null
}
```

### `public.contract_docs`

| Column | Type |
|--------|------|
| id | uuid |
| contract_id | uuid |
| owner_ids | ARRAY |
| type | text |
| status | enum |
| src | text |
| is_deleted | boolean |
| contract_date | timestamp |
| serial | text |

**Example:**
```json
{
  "id": "82b4a1d9-341d-4301-8db9-a8d7ee3aec70",
  "contract_id": "d2723187-9c92-4d82-b6a2-308568999c1b",
  "owner_ids": [
    "3",
    "b665e8bd-d360-4b1b-9b03-ecf41e825755"
  ],
  "type": "Murobaxa",
  "status": "initial",
  "src": "contracts/d2723187-9c92-4d82-b6a2-308568999c1b/9ba47932-57b8-49b6-a6dc-76e39d621...",
  "is_deleted": false,
  "contract_date": "2024-02-21T11:29:21.348008",
  "serial": "1M"
}
```

### `public.contracts`

| Column | Type |
|--------|------|
| id | uuid |
| number | bigint |
| serials | ARRAY |
| created_at | timestamp |
| term_duration | integer |
| term_type | integer |
| schedule | jsonb |
| deal_info | jsonb |
| deal_type | text |
| deal_identifier | text |
| delivery_type | enum |
| deliver_address | text |
| is_deleted | boolean |
| dealers | ARRAY |

**Example:**
```json
{
  "id": "d2723187-9c92-4d82-b6a2-308568999c1b",
  "number": 1,
  "serials": [
    "test"
  ],
  "created_at": "2024-02-21T11:29:21.348008",
  "term_duration": 12,
  "term_type": 0,
  "schedule": "[{'Id': '00000000-0000-0000-0000-000000000000', 'Date': '2024-02-29', 'Amount': ...",
  "deal_info": "{...}",
  "deal_type": "Murobaxa",
  "deal_identifier": "1",
  "delivery_type": "pickup",
  "deliver_address": null,
  "is_deleted": false,
  "dealers": [
    "b665e8bd-d360-4b1b-9b03-ecf41e825755"
  ]
}
```

### `public.org_contractors`

| Column | Type |
|--------|------|
| id | uuid |
| org_id | uuid |
| contract_id | uuid |
| role_type | text |
| name | text |
| executive | text |
| accountant | text |
| bank_account | text |
| bank_name | text |
| bank_mfo | text |
| phone | text |
| tin | text |
| data | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "51c6cc80-c936-42f6-ab4d-efb4222c84ca",
  "org_id": "96cac2eb-78f9-40ff-955f-a4bdbfccde24",
  "contract_id": "d2723187-9c92-4d82-b6a2-308568999c1b",
  "role_type": "Merchant",
  "name": "SARVAR 8888",
  "executive": "Xayitov Sarvar Zabixullayevich",
  "accountant": null,
  "bank_account": "20208000905614792001",
  "bank_name": "01121",
  "bank_mfo": "ТОШКЕНТ Ш., `ДАВР-БАНК` ХАТ БАНКИНИНГ ОЛМАЗОР ФИЛИАЛИ                           ",
  "phone": "998908178885",
  "tin": "310236000",
  "data": "{...}",
  "is_deleted": false
}
```

### `public.personal_contractors`

| Column | Type |
|--------|------|
| id | uuid |
| user_id | bigint |
| contract_id | uuid |
| role_type | text |
| identifier | text |
| doc_identifier | text |
| doc_type | integer |
| doc_issued_date | date |
| doc_expire_date | date |
| doc_issued_by | text |
| first_name | text |
| last_name | text |
| middle_name | text |
| address | text |
| birth_date | date |
| data | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "50bd3957-8761-4845-b3ce-b02e41644364",
  "user_id": 0,
  "contract_id": "d2723187-9c92-4d82-b6a2-308568999c1b",
  "role_type": "Client",
  "identifier": "33103940270022",
  "doc_identifier": "AD3449838",
  "doc_type": 1,
  "doc_issued_date": "2023-05-27",
  "doc_expire_date": "2033-05-26",
  "doc_issued_by": "МИРЗО-УЛУГБЕКСКИЙ РУВД ГОРОДА ТАШКЕНТА",
  "first_name": "SHERZOD",
  "last_name": "SULTANBAYEV",
  "middle_name": "SARVAR O‘G‘LI",
  "address": "Шалола МФЙ, Шалола, туп. 1 кучаси, 7-уй",
  "birth_date": "1994-03-31",
  "data": "{...}",
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20231005171445_Initial",
  "product_version": "7.0.5"
}
```

---

## 11. dealer


### `public.deal_agents`

| Column | Type |
|--------|------|
| id | uuid |
| agent_id | uuid |
| deal_id | bigint |
| managed_agent_id | uuid |
| created_at | timestamptz |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "7e946896-e56f-42d5-b342-f064e5b9285c",
  "agent_id": "18b3b4e0-6596-46e3-ac0b-60e3a3a5b929",
  "deal_id": 3,
  "managed_agent_id": "18b3b4e0-6596-46e3-ac0b-60e3a3a5b929",
  "created_at": "2024-08-21T12:45:47.005573+00:00",
  "is_deleted": false
}
```

### `public.deal_clients`

| Column | Type |
|--------|------|
| id | uuid |
| client_id | text |
| type | integer |
| deal_id | bigint |
| identificator_id | uuid |
| identifier | text |
| identificator_type | integer |
| scoring_id | uuid |
| score | numeric |
| enable_sum | numeric |
| is_deleted | boolean |
| data | jsonb |

**Example:**
```json
{
  "id": "6bbec1c1-7875-4698-8447-77e5a148c7c2",
  "client_id": "6",
  "type": 0,
  "deal_id": 1,
  "identificator_id": "c4fd306b-0c36-477f-8cbc-95f0339541c9",
  "identifier": "33103940270022",
  "identificator_type": 0,
  "scoring_id": "4141faa0-cc7a-4438-ae45-43450ace6e0a",
  "score": 652.0,
  "enable_sum": 7678453.091826923,
  "is_deleted": false,
  "data": "{...}"
}
```

### `public.deal_fin_states`

| Column | Type |
|--------|------|
| id | uuid |
| deal_id | bigint |
| deal_item_id | uuid |
| created_at | timestamptz |
| status | enum |
| fin_product_id | uuid |
| fin_term_id | bigint |
| term_duration | integer |
| term_type | enum |
| deal_type | enum |
| product_source | enum |
| prepay | numeric |
| sum | numeric |
| vat | numeric |
| currency | integer |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "565f77c3-5e2f-4ec5-977d-7c093e90c856",
  "deal_id": 1,
  "deal_item_id": null,
  "created_at": "2024-02-21T10:28:21.904165+00:00",
  "status": "created",
  "fin_product_id": "46e00118-b0b8-4b08-9b17-2dc8618fc89b",
  "fin_term_id": 1,
  "term_duration": 12,
  "term_type": "month",
  "deal_type": "murobaxa",
  "product_source": "in_stock",
  "prepay": 0.0,
  "sum": 3900000.0,
  "vat": 417857.14285714284,
  "currency": 860,
  "is_deleted": false
}
```

### `public.deal_item_states`

| Column | Type |
|--------|------|
| id | uuid |
| deal_item_id | uuid |
| serials | ARRAY |
| count | integer |
| quantity | numeric |
| price | numeric |
| vat | numeric |
| m_init_price | numeric |
| m_price | numeric |
| m_vat | numeric |
| currency | integer |
| m_currency | integer |
| created_at | timestamptz |
| status | enum |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "a978670c-e94c-4e31-8fbc-d68e5e9a54dd",
  "deal_item_id": "09977f9f-7412-485c-adbc-5a7095ee6f69",
  "serials": [
    "test"
  ],
  "count": 1,
  "quantity": null,
  "price": 3900000.0,
  "vat": 417857.14285714284,
  "m_init_price": 3000000.0,
  "m_price": 3000000.0,
  "m_vat": 321429.0,
  "currency": 860,
  "m_currency": 860,
  "created_at": "2024-02-21T10:28:21.386311+00:00",
  "status": "created",
  "is_deleted": false
}
```

### `public.deal_items`

| Column | Type |
|--------|------|
| id | uuid |
| deal_id | bigint |
| merchant_id | uuid |
| category_id | bigint |
| name | jsonb |
| sku | text |
| product_code | text |
| unit_code | text |
| unit | text |
| is_deleted | boolean |
| data | jsonb |
| buy_identifier | text |

**Example:**
```json
{
  "id": "09977f9f-7412-485c-adbc-5a7095ee6f69",
  "deal_id": 1,
  "merchant_id": "9df6d3e9-3ee5-4c0d-8f37-790cdb1e626e",
  "category_id": 20,
  "name": "{...}",
  "sku": "Плоскопанельный_телевизор_TV_ARTEL_A43KF5500_android_чёрный",
  "product_code": "08528001001006299",
  "unit_code": "1349945",
  "unit": "pc",
  "is_deleted": false,
  "data": null,
  "buy_identifier": null
}
```

### `public.deal_refs`

| Column | Type |
|--------|------|
| id | uuid |
| deal_id | bigint |
| deal_client_id | uuid |
| ref_id | uuid |
| type | enum |
| ref_type | text |
| is_deleted | boolean |
| data | jsonb |

**Example:**
```json
{
  "id": "68fefe09-84d6-4956-88d8-6594917e26dd",
  "deal_id": 1,
  "deal_client_id": null,
  "ref_id": "00000000-0000-0000-0000-000000000000",
  "type": "buyout",
  "ref_type": "Buyout",
  "is_deleted": false,
  "data": [
    {
      "BuyoutId": 1,
      "IsConfirmed": false
    }
  ]
}
```

### `public.deal_states`

| Column | Type |
|--------|------|
| id | uuid |
| deal_id | bigint |
| created_at | timestamptz |
| pay_day | smallint |
| pay_start_date | date |
| deal_status | enum |
| is_deleted | boolean |
| note | text |
| reason | integer |
| processing_valid_until | timestamptz |

**Example:**
```json
{
  "id": "bb4c0368-eed8-48b0-8410-408b7b427214",
  "deal_id": 1,
  "created_at": "2024-02-21T10:28:21.192055+00:00",
  "pay_day": 21,
  "pay_start_date": null,
  "deal_status": "created",
  "is_deleted": false,
  "note": null,
  "reason": 0,
  "processing_valid_until": null
}
```

### `public.deals`

| Column | Type |
|--------|------|
| id | bigint |
| agent_id | uuid |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 3,
  "agent_id": "18b3b4e0-6596-46e3-ac0b-60e3a3a5b929",
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20230821174240_Initial",
  "product_version": "7.0.5"
}
```

---

## 12. finance


### `public.agents`

| Column | Type |
|--------|------|
| id | uuid |
| user_id | bigint |
| app_id | uuid |
| is_deleted | boolean |
| manager_agent_id | uuid |

**Example:**
```json
{
  "id": "b665e8bd-d360-4b1b-9b03-ecf41e825755",
  "user_id": 3,
  "app_id": "fb05e821-09ed-4795-a381-0c6d356f39f6",
  "is_deleted": false,
  "manager_agent_id": null
}
```

### `public.app_versions`

| Column | Type |
|--------|------|
| id | bigint |
| name | text |
| is_active | boolean |
| created | timestamptz |
| is_deleted | boolean |
| app_type | enum |
| app_identifier | integer |

**Example:**
```json
{
  "id": 54,
  "name": "303",
  "is_active": false,
  "created": "2025-11-21T00:00:00+00:00",
  "is_deleted": false,
  "app_type": "ios",
  "app_identifier": 1
}
```

### `public.apps`

| Column | Type |
|--------|------|
| id | uuid |
| name | text |
| app_type | enum |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "fb05e821-09ed-4795-a381-0c6d356f39f6",
  "name": "App",
  "app_type": "offline_agent",
  "is_deleted": false
}
```

### `public.categories`

| Column | Type |
|--------|------|
| id | bigint |
| name | text |
| upper_id | bigint |
| image_src | text |
| is_deleted | boolean |
| priority | integer |

**Example:**
```json
{
  "id": 20,
  "name": "electronics",
  "upper_id": null,
  "image_src": null,
  "is_deleted": false,
  "priority": 0
}
```

### `public.category_locales`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| category_id | bigint |
| title | text |
| description | text |

**Example:**
```json
{
  "locale_key": "ru",
  "category_id": 20,
  "title": "Электроника",
  "description": null
}
```

### `public.fin_org_locales`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| fin_org_id | uuid |
| title | text |

**Example:**
```json
{
  "locale_key": "ru",
  "fin_org_id": "d1c3f879-ee4a-4096-9010-17e60249f33d",
  "title": "ООО \"FINSUM MARKET\""
}
```

### `public.fin_orgs`

| Column | Type |
|--------|------|
| id | uuid |
| org_id | uuid |
| contract_identifier | text |
| contract_date | date |
| mfo | text |
| auto_approvement | boolean |
| is_deleted | boolean |
| bank_account_id | uuid |
| bank_info | jsonb |

**Example:**
```json
{
  "id": "d1c3f879-ee4a-4096-9010-17e60249f33d",
  "org_id": "9a0dd68e-b2a1-4419-8d82-092f4d52f200",
  "contract_identifier": " 1",
  "contract_date": "2024-02-21",
  "mfo": null,
  "auto_approvement": false,
  "is_deleted": false,
  "bank_account_id": "65ce5780-923a-49dd-868d-19d78d22ea42",
  "bank_info": "{...}"
}
```

### `public.fin_product_categories`

| Column | Type |
|--------|------|
| fin_product_id | uuid |
| category_id | bigint |

**Example:**
```json
{
  "fin_product_id": "926f143a-8bcc-4f04-9b9d-66c1d87baa03",
  "category_id": 1
}
```

### `public.fin_product_contracts`

| Column | Type |
|--------|------|
| id | uuid |
| fin_product_id | uuid |
| deal_client_type | integer |
| doc_type | text |
| stage | enum |
| sign | enum |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "82e06fb7-e902-446c-b2c1-becbd30e3b48",
  "fin_product_id": "46e00118-b0b8-4b08-9b17-2dc8618fc89b",
  "deal_client_type": 0,
  "doc_type": "None",
  "stage": "agreement",
  "sign": "otp",
  "is_deleted": false
}
```

### `public.fin_product_locales`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| fin_product_id | uuid |
| title | text |
| description | text |

**Example:**
```json
{
  "locale_key": "ru",
  "fin_product_id": "46e00118-b0b8-4b08-9b17-2dc8618fc89b",
  "title": "Start",
  "description": null
}
```

### `public.fin_product_merchants`

| Column | Type |
|--------|------|
| merchant_id | uuid |
| fin_product_id | uuid |

**Example:**
```json
{
  "merchant_id": "9df6d3e9-3ee5-4c0d-8f37-790cdb1e626e",
  "fin_product_id": "4791b239-014c-4c50-92a3-7db7dde94cfe"
}
```

### `public.fin_products`

| Column | Type |
|--------|------|
| id | uuid |
| fin_org_id | uuid |
| max_value | numeric |
| min_value | numeric |
| prepay_timeout | interval |
| prepay_mode | enum |
| product_source | enum |
| deal_type | enum |
| schedule_on | enum |
| buyout_on | enum |
| scheduler_provider | enum |
| scheduler_method | text |
| scoring_provider | enum |
| scoring_model | text |
| scoring_type | text |
| identification_provider | enum |
| identification_method | text |
| co_borrower_min | integer |
| co_borrower_max | integer |
| guarantee_min | integer |
| guarantee_max | integer |
| score_guarantee | boolean |
| is_deleted | boolean |
| currency | integer |
| score_offer | boolean |
| data | jsonb |
| pricing_model | text |
| pricing_provider | enum |

**Example:**
```json
{
  "id": "926f143a-8bcc-4f04-9b9d-66c1d87baa03",
  "fin_org_id": "d1c3f879-ee4a-4096-9010-17e60249f33d",
  "max_value": 30000000,
  "min_value": 1000000,
  "prepay_timeout": "00:03:00",
  "prepay_mode": "as_max",
  "product_source": "in_stock",
  "deal_type": "murobaxa",
  "schedule_on": "act",
  "buyout_on": "agreement",
  "scheduler_provider": "default",
  "scheduler_method": "Evenly",
  "scoring_provider": "default",
  "scoring_model": "LegacyGnk",
  "scoring_type": "Strict",
  "identification_provider": "default",
  "identification_method": "MyId",
  "co_borrower_min": 0,
  "co_borrower_max": 0,
  "guarantee_min": 0,
  "guarantee_max": 0,
  "score_guarantee": false,
  "is_deleted": false,
  "currency": 860,
  "score_offer": false,
  "data": null,
  "pricing_model": "InterestOnFullSum",
  "pricing_provider": "default"
}
```

### `public.fin_terms`

| Column | Type |
|--------|------|
| id | bigint |
| term_duration | integer |
| term_type | enum |
| fin_product_id | uuid |
| max_value | numeric |
| min_value | numeric |
| added_value | numeric |
| comission_value | numeric |
| prepay_value | numeric |
| prepay_value_type | enum |
| is_deleted | boolean |
| data | jsonb |

**Example:**
```json
{
  "id": 4,
  "term_duration": 6,
  "term_type": "month",
  "fin_product_id": "46e00118-b0b8-4b08-9b17-2dc8618fc89b",
  "max_value": 30000000,
  "min_value": 1000000,
  "added_value": 18,
  "comission_value": 0,
  "prepay_value": 0,
  "prepay_value_type": "percent",
  "is_deleted": false,
  "data": null
}
```

### `public.locales`

| Column | Type |
|--------|------|
| key | varchar(10) |
| title | varchar(32) |
| code | varchar(15) |

**Example:**
```json
{
  "key": "ru",
  "title": "Русский",
  "code": "ru-RU"
}
```

### `public.merchant_agents`

| Column | Type |
|--------|------|
| id | uuid |
| merchant_id | uuid |
| agent_id | uuid |
| contract_identifier | text |
| contract_date | date |
| is_disabled | boolean |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "ad776a76-8c6f-488d-aea9-42640763b23a",
  "merchant_id": "b2720cda-8203-4b65-ace0-a1ebef29df20",
  "agent_id": "84fd97e0-1b30-48f5-aa22-2e9c018e9db3",
  "contract_identifier": "Identifier",
  "contract_date": "2024-09-20",
  "is_disabled": false,
  "is_deleted": true
}
```

### `public.merchant_locales`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| merchant_id | uuid |
| title | text |
| address | text |

**Example:**
```json
{
  "locale_key": "ru",
  "merchant_id": "f344985c-aa84-41e0-97f9-bb177037191c",
  "title": "DISCONT(CALL CENTER)",
  "address": "Г. ТАШКЕНТ, ЯШНАБАДСКИЙ РАЙОН, МУМТОЗ, 5"
}
```

### `public.merchants`

| Column | Type |
|--------|------|
| id | uuid |
| org_id | uuid |
| name | text |
| bank_account_id | uuid |
| region_id | bigint |
| contract_identifier | text |
| contract_date | date |
| auto_approvement | boolean |
| is_deleted | boolean |
| contract_mode | enum |
| invoice_mode | enum |
| invoice_approve_mode | integer |
| payment_order_mode | integer |
| prepay_stage | enum |

**Example:**
```json
{
  "id": "5af78004-9eff-4b07-bdf6-c3b86ad56d7f",
  "org_id": "e5a46290-582d-40c4-9c99-e3a77ef6e327",
  "name": "ARTEL SHOWROOM",
  "bank_account_id": "9cfa9899-e044-42d6-9f33-3f48085e431c",
  "region_id": 1726,
  "contract_identifier": "10",
  "contract_date": "2024-03-05",
  "auto_approvement": true,
  "is_deleted": false,
  "contract_mode": "general",
  "invoice_mode": "per_deal",
  "invoice_approve_mode": 0,
  "payment_order_mode": 0,
  "prepay_stage": "on_offer"
}
```

### `public.shop_locales`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| shop_id | uuid |
| name | text |
| address | text |
| description | text |

**Example:**
```json
{
  "locale_key": "ru",
  "shop_id": "26dbb6a2-759c-438c-89e9-0a629f0b5320",
  "name": "RADIUS Brand shop Samarqand Darvoza",
  "address": "ул. Коратош, 5А, ТРЦ Samarqand Darvoza\" 2 этаж",
  "description": "RADIUS Brand shop Samarqand Darvoza"
}
```

### `public.shops`

| Column | Type |
|--------|------|
| id | uuid |
| upper_id | uuid |
| name | text |
| latitude | float8 |
| longitude | float8 |
| image_src | text |
| logo_src | text |
| color | text |
| category_ids | ARRAY |
| type | integer |
| merchant_id | uuid |
| is_deleted | boolean |
| priority | integer |
| phone | text |

**Example:**
```json
{
  "id": "37d0443d-6631-40aa-8f07-eabcff290bca",
  "upper_id": "4712db01-1ba1-425a-bd09-0c8cbcb9340f",
  "name": "ELMAKON \"Andijon\"",
  "latitude": 40.78997,
  "longitude": 72.321702,
  "image_src": "/shops/37d0443d-6631-40aa-8f07-eabcff290bca/e0d69b6483634ef29d9f5338da83e42c.png",
  "logo_src": "/shops/37d0443d-6631-40aa-8f07-eabcff290bca/057beadfe27648ba9e0c86ddfb11e2b6.png",
  "color": "#8c3f3f",
  "category_ids": [
    20,
    18,
    3,
    4,
    2
  ],
  "type": 2,
  "merchant_id": "c1d988f0-3d6a-4e9c-b539-d29c519fb17e",
  "is_deleted": true,
  "priority": 3,
  "phone": "998712031203"
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20231218100046_Initial",
  "product_version": "7.0.5"
}
```

---

## 13. finsumid


### `public.api_resource`

| Column | Type |
|--------|------|
| id | integer |
| enabled | boolean |
| name | varchar(200) |
| display_name | varchar(200) |
| description | varchar(1000) |
| allowed_access_token_signing_algorithms | varchar(100) |
| show_in_discovery_document | boolean |
| created | timestamp |
| updated | timestamp |
| last_accessed | timestamp |
| non_editable | boolean |

**Example:**
```json
{
  "id": 1,
  "enabled": true,
  "name": "FinanceAPI",
  "display_name": null,
  "description": null,
  "allowed_access_token_signing_algorithms": null,
  "show_in_discovery_document": true,
  "created": "2024-02-20T13:52:01.088411",
  "updated": null,
  "last_accessed": null,
  "non_editable": false
}
```

### `public.api_resource_claim`

| Column | Type |
|--------|------|
| id | integer |
| api_resource_id | integer |
| type | varchar(200) |

**Example:**
```json
_empty table_
```

### `public.api_resource_property`

| Column | Type |
|--------|------|
| id | integer |
| api_resource_id | integer |
| key | varchar(250) |
| value | varchar(2000) |

**Example:**
```json
_empty table_
```

### `public.api_resource_scope`

| Column | Type |
|--------|------|
| id | integer |
| scope | varchar(200) |
| api_resource_id | integer |

**Example:**
```json
{
  "id": 1,
  "scope": "finance_api",
  "api_resource_id": 1
}
```

### `public.api_resource_secret`

| Column | Type |
|--------|------|
| id | integer |
| api_resource_id | integer |
| description | varchar(1000) |
| value | varchar(4000) |
| expiration | timestamp |
| type | varchar(250) |
| created | timestamp |

**Example:**
```json
_empty table_
```

### `public.api_scope`

| Column | Type |
|--------|------|
| id | integer |
| enabled | boolean |
| name | varchar(200) |
| display_name | varchar(200) |
| description | varchar(1000) |
| required | boolean |
| emphasize | boolean |
| show_in_discovery_document | boolean |

**Example:**
```json
{
  "id": 1,
  "enabled": true,
  "name": "finance_api",
  "display_name": "Finance API",
  "description": null,
  "required": true,
  "emphasize": false,
  "show_in_discovery_document": true
}
```

### `public.api_scope_claim`

| Column | Type |
|--------|------|
| id | integer |
| scope_id | integer |
| type | varchar(200) |

**Example:**
```json
{
  "id": 1,
  "scope_id": 1,
  "type": "role"
}
```

### `public.api_scope_property`

| Column | Type |
|--------|------|
| id | integer |
| scope_id | integer |
| key | varchar(250) |
| value | varchar(2000) |

**Example:**
```json
_empty table_
```

### `public.client`

| Column | Type |
|--------|------|
| id | integer |
| enabled | boolean |
| client_id | varchar(200) |
| protocol_type | varchar(200) |
| require_client_secret | boolean |
| client_name | varchar(200) |
| description | varchar(1000) |
| client_uri | varchar(2000) |
| logo_uri | varchar(2000) |
| require_consent | boolean |
| allow_remember_consent | boolean |
| always_include_user_claims_in_id_token | boolean |
| require_pkce | boolean |
| allow_plain_text_pkce | boolean |
| require_request_object | boolean |
| allow_access_tokens_via_browser | boolean |
| front_channel_logout_uri | varchar(2000) |
| front_channel_logout_session_required | boolean |
| back_channel_logout_uri | varchar(2000) |
| back_channel_logout_session_required | boolean |
| allow_offline_access | boolean |
| identity_token_lifetime | integer |
| allowed_identity_token_signing_algorithms | varchar(100) |
| access_token_lifetime | integer |
| authorization_code_lifetime | integer |
| consent_lifetime | integer |
| absolute_refresh_token_lifetime | integer |
| sliding_refresh_token_lifetime | integer |
| refresh_token_usage | integer |
| update_access_token_claims_on_refresh | boolean |
| refresh_token_expiration | integer |
| access_token_type | integer |
| enable_local_login | boolean |
| include_jwt_id | boolean |
| always_send_client_claims | boolean |
| client_claims_prefix | varchar(200) |
| pair_wise_subject_salt | varchar(200) |
| created | timestamp |
| updated | timestamp |
| last_accessed | timestamp |
| user_sso_lifetime | integer |
| user_code_type | varchar(100) |
| device_code_lifetime | integer |
| non_editable | boolean |

**Example:**
```json
{
  "id": 1,
  "enabled": true,
  "client_id": "FinanceAdminClientLocal",
  "protocol_type": "oidc",
  "require_client_secret": true,
  "client_name": "FinanceAdminClientLocal",
  "description": null,
  "client_uri": "http://localhost:3033",
  "logo_uri": null,
  "require_consent": false,
  "allow_remember_consent": true,
  "always_include_user_claims_in_id_token": false,
  "require_pkce": true,
  "allow_plain_text_pkce": false,
  "require_request_object": false,
  "allow_access_tokens_via_browser": false,
  "front_channel_logout_uri": "http://localhost:3033/signout-oidc",
  "front_channel_logout_session_required": true,
  "back_channel_logout_uri": null,
  "back_channel_logout_session_required": true,
  "allow_offline_access": true,
  "identity_token_lifetime": 300,
  "allowed_identity_token_signing_algorithms": null,
  "access_token_lifetime": 3600,
  "authorization_code_lifetime": 300,
  "consent_lifetime": null,
  "absolute_refresh_token_lifetime": 2592000,
  "sliding_refresh_token_lifetime": 1296000,
  "refresh_token_usage": 1,
  "update_access_token_claims_on_refresh": false,
  "refresh_token_expiration": 1,
  "access_token_type": 0,
  "enable_local_login": true,
  "include_jwt_id": true,
  "always_send_client_claims": false,
  "client_claims_prefix": "client_",
  "pair_wise_subject_salt": null,
  "created": "2024-02-20T13:52:01.292418",
  "updated": null,
  "last_accessed": null,
  "user_sso_lifetime": null,
  "user_code_type": null,
  "device_code_lifetime": 300,
  "non_editable": false
}
```

### `public.client_claim`

| Column | Type |
|--------|------|
| id | integer |
| type | varchar(250) |
| value | varchar(250) |
| client_id | integer |

**Example:**
```json
_empty table_
```

### `public.client_cors_origin`

| Column | Type |
|--------|------|
| id | integer |
| origin | varchar(150) |
| client_id | integer |

**Example:**
```json
{
  "id": 1,
  "origin": "http://localhost:3033",
  "client_id": 1
}
```

### `public.client_grant_type`

| Column | Type |
|--------|------|
| id | integer |
| grant_type | varchar(250) |
| client_id | integer |

**Example:**
```json
{
  "id": 1,
  "grant_type": "authorization_code",
  "client_id": 1
}
```

### `public.client_id_p_restriction`

| Column | Type |
|--------|------|
| id | integer |
| provider | varchar(200) |
| client_id | integer |

**Example:**
```json
_empty table_
```

### `public.client_post_logout_redirect_uri`

| Column | Type |
|--------|------|
| id | integer |
| post_logout_redirect_uri | varchar(2000) |
| client_id | integer |

**Example:**
```json
{
  "id": 1,
  "post_logout_redirect_uri": "http://localhost:3033/signout-callback-oidc",
  "client_id": 1
}
```

### `public.client_property`

| Column | Type |
|--------|------|
| id | integer |
| client_id | integer |
| key | varchar(250) |
| value | varchar(2000) |

**Example:**
```json
_empty table_
```

### `public.client_redirect_uri`

| Column | Type |
|--------|------|
| id | integer |
| redirect_uri | varchar(2000) |
| client_id | integer |

**Example:**
```json
{
  "id": 1,
  "redirect_uri": "http://localhost:3033/callback.html",
  "client_id": 1
}
```

### `public.client_scopes`

| Column | Type |
|--------|------|
| id | integer |
| scope | varchar(200) |
| client_id | integer |

**Example:**
```json
{
  "id": 1,
  "scope": "openid",
  "client_id": 1
}
```

### `public.client_secret`

| Column | Type |
|--------|------|
| id | integer |
| client_id | integer |
| description | varchar(2000) |
| value | varchar(4000) |
| expiration | timestamp |
| type | varchar(250) |
| created | timestamp |

**Example:**
```json
{
  "id": 1,
  "client_id": 1,
  "description": null,
  "value": "UEaZs5SHNyKMVVzeaORHBH7jEhw5ZGi9VF/Oxm/daRs=",
  "expiration": null,
  "type": "SharedSecret",
  "created": "2024-02-20T13:52:01.292625"
}
```

### `public.data_protection_keys`

| Column | Type |
|--------|------|
| id | integer |
| friendly_name | text |
| xml | text |

**Example:**
```json
{
  "id": 1,
  "friendly_name": "key-8a3ddbe0-4810-4b9c-a245-c43661f49660",
  "xml": "<key id=\"8a3ddbe0-4810-4b9c-a245-c43661f49660\" version=\"1\"><creationDate>2024-02..."
}
```

### `public.device_flow_codes`

| Column | Type |
|--------|------|
| user_code | varchar(200) |
| device_code | varchar(200) |
| subject_id | varchar(200) |
| session_id | varchar(100) |
| client_id | varchar(200) |
| description | varchar(200) |
| creation_time | timestamp |
| expiration | timestamp |
| data | varchar(50000) |

**Example:**
```json
_empty table_
```

### `public.identity_resource`

| Column | Type |
|--------|------|
| id | integer |
| enabled | boolean |
| name | varchar(200) |
| display_name | varchar(200) |
| description | varchar(1000) |
| required | boolean |
| emphasize | boolean |
| show_in_discovery_document | boolean |
| created | timestamp |
| updated | timestamp |
| non_editable | boolean |

**Example:**
```json
{
  "id": 1,
  "enabled": true,
  "name": "roles",
  "display_name": "Roles",
  "description": null,
  "required": false,
  "emphasize": false,
  "show_in_discovery_document": true,
  "created": "2024-02-20T13:52:00.515609",
  "updated": null,
  "non_editable": false
}
```

### `public.identity_resource_claim`

| Column | Type |
|--------|------|
| id | integer |
| identity_resource_id | integer |
| type | varchar(200) |

**Example:**
```json
{
  "id": 1,
  "identity_resource_id": 1,
  "type": "role"
}
```

### `public.identity_resource_property`

| Column | Type |
|--------|------|
| id | integer |
| identity_resource_id | integer |
| key | varchar(250) |
| value | varchar(2000) |

**Example:**
```json
_empty table_
```

### `public.persisted_grants`

| Column | Type |
|--------|------|
| key | varchar(200) |
| type | varchar(50) |
| subject_id | varchar(200) |
| session_id | varchar(100) |
| client_id | varchar(200) |
| description | varchar(200) |
| creation_time | timestamp |
| expiration | timestamp |
| consumed_time | timestamp |
| data | varchar(50000) |

**Example:**
```json
_empty table_
```

### `public.role_claims`

| Column | Type |
|--------|------|
| id | integer |
| role_id | bigint |
| claim_type | text |
| claim_value | text |

**Example:**
```json
_empty table_
```

### `public.roles`

| Column | Type |
|--------|------|
| id | bigint |
| name | varchar(256) |
| normalized_name | varchar(256) |
| concurrency_stamp | text |

**Example:**
```json
{
  "id": 1,
  "name": "Administrator",
  "normalized_name": "ADMINISTRATOR",
  "concurrency_stamp": "1b4686ad-57b1-47b2-8130-b8444e449b13"
}
```

### `public.user_claims`

| Column | Type |
|--------|------|
| id | integer |
| user_id | bigint |
| claim_type | text |
| claim_value | text |

**Example:**
```json
{
  "id": 1,
  "user_id": 1,
  "claim_type": "name",
  "claim_value": "admin"
}
```

### `public.user_logins`

| Column | Type |
|--------|------|
| login_provider | text |
| provider_key | text |
| provider_display_name | text |
| user_id | bigint |

**Example:**
```json
_empty table_
```

### `public.user_roles`

| Column | Type |
|--------|------|
| user_id | bigint |
| role_id | bigint |

**Example:**
```json
{
  "user_id": 1,
  "role_id": 1
}
```

### `public.user_tokens`

| Column | Type |
|--------|------|
| user_id | bigint |
| login_provider | text |
| name | text |
| value | text |

**Example:**
```json
{
  "user_id": 99,
  "login_provider": "Default",
  "name": "RefreshToken",
  "value": "CTuJ8ki9XOPGtJ5v56LP0G4pY2Nf3IY4gEr0eVTh3ulRqeUxN6dIi8FeP9mX2cgJxg+dlzGjMZHaerh8..."
}
```

### `public.users`

| Column | Type |
|--------|------|
| id | bigint |
| first_name | text |
| last_name | text |
| photo | text |
| user_name | varchar(256) |
| normalized_user_name | varchar(256) |
| email | varchar(256) |
| normalized_email | varchar(256) |
| email_confirmed | boolean |
| password_hash | text |
| security_stamp | text |
| concurrency_stamp | text |
| phone_number | text |
| phone_number_confirmed | boolean |
| two_factor_enabled | boolean |
| lockout_end | timestamptz |
| lockout_enabled | boolean |
| access_failed_count | integer |
| personal_number | text |

**Example:**
```json
{
  "id": 13,
  "first_name": "Ahrorjon",
  "last_name": "Yoqubjonov",
  "photo": null,
  "user_name": "Ahror",
  "normalized_user_name": "AHROR",
  "email": "ahror@mail.ru",
  "normalized_email": "AHROR@MAIL.RU",
  "email_confirmed": false,
  "password_hash": "AQAAAAEAACcQAAAAEHur/cROCM46onPJRVaoy8lp8wfUh/er0J88fLfdFbFjWx2HNxYFwPQj/Q+cudwV...",
  "security_stamp": "B6EELU5GKM55LXZR4F7SLCZJ56MOSV6V",
  "concurrency_stamp": "98441082-d5c2-4b92-af17-b8729ba313be",
  "phone_number": "998944129999",
  "phone_number_confirmed": true,
  "two_factor_enabled": false,
  "lockout_end": null,
  "lockout_enabled": true,
  "access_failed_count": 0,
  "personal_number": null
}
```

### `sys.id_migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20230720130741_Initial",
  "product_version": "6.0.7"
}
```

### `sys.is_migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20231009195909_Initial",
  "product_version": "6.0.7"
}
```

---

## 14. healthcheckdb


### `public.Configurations`

| Column | Type |
|--------|------|
| Id | integer |
| Uri | varchar(500) |
| Name | varchar(500) |
| DiscoveryService | varchar(100) |

**Example:**
```json
{
  "Id": 1,
  "Uri": "http://taqsim-idsts-api/health",
  "Name": "taqsim-idsts-api",
  "DiscoveryService": null
}
```

### `public.Executions`

| Column | Type |
|--------|------|
| Id | integer |
| Status | integer |
| OnStateFrom | timestamp |
| LastExecuted | timestamp |
| Uri | varchar(500) |
| Name | varchar(500) |
| DiscoveryService | varchar(50) |

**Example:**
```json
{
  "Id": 29,
  "Status": 2,
  "OnStateFrom": "2026-02-02T15:13:25.070373",
  "LastExecuted": "2026-05-16T08:24:03.502334",
  "Uri": "http://taqsim-cards-api/hc",
  "Name": "taqsim-cards-api",
  "DiscoveryService": null
}
```

### `public.Failures`

| Column | Type |
|--------|------|
| Id | integer |
| HealthCheckName | varchar(500) |
| LastNotified | timestamp |
| IsUpAndRunning | boolean |

**Example:**
```json
{
  "Id": 1,
  "HealthCheckName": "taqsim-contracts-inner-api",
  "LastNotified": "2024-02-20T18:52:37.904964",
  "IsUpAndRunning": false
}
```

### `public.HealthCheckExecutionEntries`

| Column | Type |
|--------|------|
| Id | integer |
| Name | varchar(500) |
| Status | integer |
| Description | text |
| Duration | interval |
| HealthCheckExecutionId | integer |
| Tags | text |

**Example:**
```json
{
  "Id": 2394,
  "Name": "masstransit-bus",
  "Status": 2,
  "Description": "Ready",
  "Duration": "00:00:00.000076",
  "HealthCheckExecutionId": 4,
  "Tags": "[\"ready\",\"masstransit\"]"
}
```

### `public.HealthCheckExecutionHistories`

| Column | Type |
|--------|------|
| Id | integer |
| Name | varchar(500) |
| Description | text |
| Status | integer |
| On | timestamp |
| HealthCheckExecutionId | integer |

**Example:**
```json
{
  "Id": 1,
  "Name": "masstransit-bus",
  "Description": "Ready",
  "Status": 2,
  "On": "2024-02-20T18:53:05.598817",
  "HealthCheckExecutionId": 14
}
```

### `public.__EFMigrationsHistory`

| Column | Type |
|--------|------|
| MigrationId | varchar(150) |
| ProductVersion | varchar(32) |

**Example:**
```json
{
  "MigrationId": "20200410133103_initial",
  "ProductVersion": "7.0.9"
}
```

---

## 15. ident


### `public.identification_files`

| Column | Type |
|--------|------|
| id | uuid |
| identification_id | uuid |
| type | integer |
| format | integer |
| src | text |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "8caa5bde-2212-4103-b631-859439b9af36",
  "identification_id": "16eabafa-1c31-4315-b7d2-5c7f9e5935c9",
  "type": 0,
  "format": 0,
  "src": "/ident/6/8e434aba5a934010a0f8851895ffdc64.Jpeg",
  "is_deleted": false
}
```

### `public.identifications`

| Column | Type |
|--------|------|
| id | uuid |
| identifier | text |
| agent_id | uuid |
| p_identifier | text |
| provider_id | uuid |
| user_id | bigint |
| data | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "16eabafa-1c31-4315-b7d2-5c7f9e5935c9",
  "identifier": "AD3449838",
  "agent_id": "b665e8bd-d360-4b1b-9b03-ecf41e825755",
  "p_identifier": "8Agd7PkvGgnLtwhxItk5QuqN5rGmME",
  "provider_id": "f3332984-10b8-47c5-8d22-b617f60e5a89",
  "user_id": 6,
  "data": {},
  "is_deleted": false
}
```

### `public.identificators`

| Column | Type |
|--------|------|
| id | uuid |
| type | integer |
| identification_id | uuid |
| identifier | text |
| doc_identifier | text |
| doc_type | integer |
| doc_issued_date | date |
| doc_expire_date | date |
| doc_issued_by | text |
| address | text |
| region_id | bigint |
| temp_region_id | bigint |
| created_at | timestamp |
| updated_at | timestamp |
| inactive_at | timestamp |
| all_data | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "9d1d2938-a69d-402f-9043-273e1a9d577d",
  "type": 0,
  "identification_id": "0176cd30-1a90-4b69-aced-b85feec972e6",
  "identifier": "33103940270022",
  "doc_identifier": "AD3449838",
  "doc_type": 1,
  "doc_issued_date": "2023-05-27",
  "doc_expire_date": "2033-05-26",
  "doc_issued_by": "МИРЗО-УЛУГБЕКСКИЙ РУВД ГОРОДА ТАШКЕНТА",
  "address": "Шалола МФЙ, Шалола, туп. 1 кучаси, 7-уй",
  "region_id": 1726269,
  "temp_region_id": null,
  "created_at": "2024-02-21T11:03:12.950767",
  "updated_at": "2024-02-21T11:03:12.95077",
  "inactive_at": "2024-02-21T14:03:12.950514",
  "all_data": "{...}",
  "is_deleted": false
}
```

### `public.identifiers`

| Column | Type |
|--------|------|
| identificator_id | uuid |
| type | text |
| value | text |

**Example:**
```json
_empty table_
```

### `public.locales`

| Column | Type |
|--------|------|
| key | varchar(10) |
| title | varchar(32) |
| code | varchar(15) |

**Example:**
```json
{
  "key": "ru",
  "title": "Русский",
  "code": "ru-RU"
}
```

### `public.personal_info`

| Column | Type |
|--------|------|
| id | uuid |
| identificator_id | uuid |
| first_name | text |
| last_name | text |
| middle_name | text |
| birth_date | date |
| nationality_id | bigint |
| citizenship_id | bigint |
| gender | integer |
| first_name_en | text |
| last_name_en | text |
| mrz | text |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "76b7c09a-8078-4db1-9e12-6e1024c005f1",
  "identificator_id": "9d1d2938-a69d-402f-9043-273e1a9d577d",
  "first_name": "SHERZOD",
  "last_name": "SULTANBAYEV",
  "middle_name": "SARVAR O‘G‘LI",
  "birth_date": "1994-03-31",
  "nationality_id": 44,
  "citizenship_id": -2,
  "gender": 1,
  "first_name_en": "SHERZOD",
  "last_name_en": "SULTANBAYEV",
  "mrz": "Not Valid",
  "is_deleted": false
}
```

### `public.provider_locales`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| provider_id | uuid |
| title | text |
| description | text |

**Example:**
```json
{
  "locale_key": "ru",
  "provider_id": "f3332984-10b8-47c5-8d22-b617f60e5a89",
  "title": "По умолчанию",
  "description": null
}
```

### `public.providers`

| Column | Type |
|--------|------|
| id | uuid |
| name | text |
| method | text |
| credentials | jsonb |
| is_deleted | boolean |
| type | text |

**Example:**
```json
{
  "id": "f3332984-10b8-47c5-8d22-b617f60e5a89",
  "name": "Default",
  "method": "MyId",
  "credentials": "{...}",
  "is_deleted": false,
  "type": ""
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20231121104307_Initial",
  "product_version": "7.0.5"
}
```

---

## 16. intent


### `public.activities`

| Column | Type |
|--------|------|
| id | uuid |
| user_id | bigint |
| initiator | text |
| target_id | text |
| phone | text |
| secret | text |
| date | timestamptz |
| intent_key | text |
| data | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "148178b9-f006-43a4-bf6e-ae543e877a40",
  "user_id": 6,
  "initiator": "3",
  "target_id": "6",
  "phone": "998974550331",
  "secret": "178635",
  "date": "2024-02-21T10:28:29.411326+00:00",
  "intent_key": "AgentClientSession",
  "data": null,
  "is_deleted": false
}
```

### `public.confirmations`

| Column | Type |
|--------|------|
| id | uuid |
| activity_id | uuid |
| date | timestamptz |
| is_deleted | boolean |
| confirmer | text |

**Example:**
```json
{
  "id": "3382ee27-e5f4-45ef-9cbe-9967e92cdf51",
  "activity_id": "148178b9-f006-43a4-bf6e-ae543e877a40",
  "date": "2024-02-21T10:28:48.347112+00:00",
  "is_deleted": false,
  "confirmer": ""
}
```

### `public.intent_templates`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| intent_key | text |
| type | integer |
| content | text |

**Example:**
```json
{
  "locale_key": "ru",
  "intent_key": "AgentClientSession",
  "type": 0,
  "content": "FINSUMNASIYA\r\nDannym kodom {Code} dayu svoye soglasiye na obrabotku personal'nyk..."
}
```

### `public.intents`

| Column | Type |
|--------|------|
| key | text |
| type | integer |
| target_type | text |
| duration | interval |
| created_at | timestamptz |
| eligibility | integer |

**Example:**
```json
{
  "key": "ActConfirm",
  "type": 2,
  "target_type": "Contract",
  "duration": "00:05:00",
  "created_at": "2024-02-20T13:52:07.750761+00:00",
  "eligibility": 0
}
```

### `public.locales`

| Column | Type |
|--------|------|
| key | varchar(10) |
| title | varchar(32) |
| code | varchar(15) |

**Example:**
```json
{
  "key": "ru",
  "title": "Русский",
  "code": "ru-RU"
}
```

### `public.messages`

| Column | Type |
|--------|------|
| id | uuid |
| activity_id | uuid |
| to | ARRAY |
| type | integer |
| date | timestamptz |
| content | text |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "7e70c3b6-3046-43df-8fe7-1f747ab09bae",
  "activity_id": "148178b9-f006-43a4-bf6e-ae543e877a40",
  "to": [
    "998974550331"
  ],
  "type": 0,
  "date": "2024-02-21T10:28:29.683134+00:00",
  "content": "FINSUMNASIYA\r\nDannym kodom 178635 dayu svoye soglasiye na obrabotku personal'nyk...",
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20231011004155_Initial",
  "product_version": "7.0.5"
}
```

---

## 17. invoice


### `public.Checklar FInsum`

| Column | Type |
|--------|------|
| src | text |
| data | jsonb |
| deals | ARRAY |
| sum | numeric |
| vat | numeric |
| serial | bigint |
| type | text |
| invoice_id | uuid |

**Example:**
```json
{
  "src": "Invoices/d92965e4-77cc-436f-9507-a24bef269d05/c73582ae-6920-47a3-a7ed-3d295ddfc8...",
  "data": "{...}",
  "deals": [
    "1"
  ],
  "sum": 3900000.0,
  "vat": 417857.14285714284,
  "serial": 1,
  "type": "CheckEPosSystem",
  "invoice_id": "d92965e4-77cc-436f-9507-a24bef269d05"
}
```

### `public.Invoice items client personal`

| Column | Type |
|--------|------|
| id | uuid |
| price | numeric |
| vat | numeric |
| invoice_id | uuid |
| names | jsonb |
| quantity | numeric |
| unit | text |
| count | integer |
| unit_code | text |
| product_code | text |
| sku | text |
| serials | ARRAY |
| currency | integer |
| is_deleted | boolean |
| deal_id | text |
| is_labeled | boolean |
| doc_type | text |
| doc_provider_type | text |
| doc_src | text |
| doc_data | jsonb |
| doc_deleted | boolean |

**Example:**
```json
{
  "id": "ad5db64e-6d09-4278-9873-a53efc1ce0f4",
  "price": 3900000.0,
  "vat": 417857.14285714284,
  "invoice_id": "d92965e4-77cc-436f-9507-a24bef269d05",
  "names": "{...}",
  "quantity": null,
  "unit": "pc",
  "count": 1,
  "unit_code": "1349945",
  "product_code": "08528001001006299",
  "sku": "Плоскопанельный_телевизор_TV_ARTEL_A43KF5500_android_чёрный",
  "serials": [
    "test"
  ],
  "currency": 860,
  "is_deleted": false,
  "deal_id": "",
  "is_labeled": false,
  "doc_type": "CheckEPosSystem",
  "doc_provider_type": "Taqsim",
  "doc_src": "Invoices/d92965e4-77cc-436f-9507-a24bef269d05/c73582ae-6920-47a3-a7ed-3d295ddfc8...",
  "doc_data": "{...}",
  "doc_deleted": false
}
```

### `public.cancellations`

| Column | Type |
|--------|------|
| id | uuid |
| invoice_id | uuid |
| date | timestamptz |
| reason | text |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "7321aa40-3a34-4709-8d70-bd784fa2784a",
  "invoice_id": "4d27493f-b568-4ea8-bec3-0004fa49425f",
  "date": "2026-02-27T12:08:45.305387+00:00",
  "reason": "",
  "is_deleted": false
}
```

### `public.confirmations`

| Column | Type |
|--------|------|
| id | uuid |
| invoice_id | uuid |
| created_at | timestamptz |
| confirmation_id | uuid |
| confirmation_type | enum |
| is_deleted | boolean |

**Example:**
```json
_empty table_
```

### `public.invoice_docs`

| Column | Type |
|--------|------|
| id | uuid |
| invoice_id | uuid |
| type | text |
| provider_type | text |
| src | text |
| data | jsonb |
| is_deleted | boolean |
| date | timestamptz |

**Example:**
```json
{
  "id": "06d995f4-56ae-48d3-8767-f4a2dd909b22",
  "invoice_id": "5971536f-716a-4135-a458-9e66a0ee2bb6",
  "type": "Invoice",
  "provider_type": "Taqsim",
  "src": "Invoices/5971536f-716a-4135-a458-9e66a0ee2bb6/46e6b718-ea4c-42b4-9657-f7038db9d8...",
  "data": null,
  "is_deleted": false,
  "date": "2026-03-18T06:10:31.518857+00:00"
}
```

### `public.invoice_items`

| Column | Type |
|--------|------|
| id | uuid |
| serials | ARRAY |
| sku | text |
| product_code | text |
| unit_code | text |
| count | integer |
| quantity | numeric |
| unit | text |
| price | numeric |
| vat | numeric |
| currency | integer |
| names | jsonb |
| invoice_id | uuid |
| is_deleted | boolean |
| deal_id | text |
| is_labeled | boolean |

**Example:**
```json
{
  "id": "ad5db64e-6d09-4278-9873-a53efc1ce0f4",
  "serials": [
    "test"
  ],
  "sku": "Плоскопанельный_телевизор_TV_ARTEL_A43KF5500_android_чёрный",
  "product_code": "08528001001006299",
  "unit_code": "1349945",
  "count": 1,
  "quantity": null,
  "unit": "pc",
  "price": 3900000.0,
  "vat": 417857.14285714284,
  "currency": 860,
  "names": "{...}",
  "invoice_id": "d92965e4-77cc-436f-9507-a24bef269d05",
  "is_deleted": false,
  "deal_id": "",
  "is_labeled": false
}
```

### `public.invoice_states`

| Column | Type |
|--------|------|
| id | uuid |
| invoice_id | uuid |
| state | integer |
| created_at | timestamptz |
| is_deleted | boolean |
| data | jsonb |
| provider_identifier | text |

**Example:**
```json
{
  "id": "d0d48857-2604-4625-ac5a-f41d5c1089be",
  "invoice_id": "90b35506-fa8b-4b03-8c33-62f9e6cdc925",
  "state": 0,
  "created_at": "2024-05-22T12:30:15.593818+00:00",
  "is_deleted": false,
  "data": null,
  "provider_identifier": ""
}
```

### `public.invoices`

| Column | Type |
|--------|------|
| id | uuid |
| deals | ARRAY |
| prepay | numeric |
| sum | numeric |
| vat | numeric |
| currency | integer |
| owner_type | enum |
| owner_id | text |
| creator_id | text |
| owner_info | jsonb |
| service_info | jsonb |
| created_at | timestamptz |
| is_deleted | boolean |
| contract_date | timestamptz |
| contract_serial | text |
| serial | bigint |

**Example:**
```json
{
  "id": "d92965e4-77cc-436f-9507-a24bef269d05",
  "deals": [
    "1"
  ],
  "prepay": 0.0,
  "sum": 3900000.0,
  "vat": 417857.14285714284,
  "currency": 860,
  "owner_type": "client_personal",
  "owner_id": "6",
  "creator_id": "3",
  "owner_info": "{...}",
  "service_info": "{...}",
  "created_at": "2024-02-21T11:39:48.49606+00:00",
  "is_deleted": false,
  "contract_date": "2024-02-21T11:39:48.718871+00:00",
  "contract_serial": "",
  "serial": 1
}
```

### `public.item_serials`

| Column | Type |
|--------|------|
| id | uuid |
| serials | ARRAY |
| invoice_item_id | uuid |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "b79db453-7632-47b9-9594-24768a2a673c",
  "serials": [
    "010478007990279021pg?n6Gd:XP<UOP_wI>VK"
  ],
  "invoice_item_id": "14e019f4-56d4-4400-9cdb-8a8aae344363",
  "is_deleted": false
}
```

### `public.providers`

| Column | Type |
|--------|------|
| id | uuid |
| merchant_id | text |
| name | text |
| type | integer |
| credentials | jsonb |
| is_deleted | boolean |
| is_active | boolean |
| lgota_id | text |

**Example:**
```json
{
  "id": "3ed09f11-35a0-4366-b9c1-173c3a20345f",
  "merchant_id": "e7ad4986-16ef-4719-869c-237db7f20d97",
  "name": "Didox",
  "type": 1,
  "credentials": "{...}",
  "is_deleted": false,
  "is_active": false,
  "lgota_id": ""
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20231007183023_Initial",
  "product_version": "7.0.5"
}
```

---

## 18. overdue


### `public.overdue_states`

| Column | Type |
|--------|------|
| id | uuid |
| status | integer |
| date | timestamptz |
| overdue_id | bigint |
| is_deleted | boolean |
| covered_amount | bigint |
| remaining_amount | bigint |

**Example:**
```json
{
  "id": "0fec56dd-e306-43f1-b9a7-921b01b9ab59",
  "status": 0,
  "date": "2024-05-20T07:00:02.866049+00:00",
  "overdue_id": 3,
  "is_deleted": false,
  "covered_amount": 0,
  "remaining_amount": 32500000
}
```

### `public.overdues`

| Column | Type |
|--------|------|
| id | bigint |
| amount | bigint |
| schedule_id | uuid |
| date | date |
| deal_id | bigint |
| is_deleted | boolean |
| schedule_amount | numeric |
| schedule_summ | numeric |

**Example:**
```json
{
  "id": 14,
  "amount": 55000000,
  "schedule_id": "3ce3a4e8-ed80-42f7-b496-779c53328859",
  "date": "2024-09-05",
  "deal_id": 9,
  "is_deleted": false,
  "schedule_amount": 550000,
  "schedule_summ": 3304000.0
}
```

### `public.overdues_info`

| Column | Type |
|--------|------|
| id | uuid |
| status | integer |
| date | timestamptz |
| overdue_id | bigint |
| is_deleted | boolean |
| covered_amount | bigint |
| remaining_amount | bigint |
| o.id | bigint |
| o.amount | bigint |
| o.schedule_id | uuid |
| o.date | date |
| o.deal_id | bigint |
| o.is_deleted | boolean |

**Example:**
```json
{
  "id": "0fec56dd-e306-43f1-b9a7-921b01b9ab59",
  "status": 0,
  "date": "2024-05-20T07:00:02.866049+00:00",
  "overdue_id": 3,
  "is_deleted": false,
  "covered_amount": 0,
  "remaining_amount": 32500000,
  "o.id": 3,
  "o.amount": 32500000,
  "o.schedule_id": "83a574ae-f0a4-4b64-8a01-a63e59d8a22f",
  "o.date": "2024-04-30",
  "o.deal_id": 1,
  "o.is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20240216052102_InitialMigration",
  "product_version": "7.0.15"
}
```

---

## 19. payme


### `public.payments`

| Column | Type |
|--------|------|
| id | bigint |
| payme_transaction_id | varchar(24) |
| amount | numeric |
| deal_id | bigint |
| is_acknowledged | boolean |
| state | integer |
| cancel_reason | integer |
| created_at | timestamp |
| performed_at | timestamp |
| cancelled_at | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 22,
  "payme_transaction_id": "67264759b5831eaf57932b07",
  "amount": 1390000,
  "deal_id": 737,
  "is_acknowledged": true,
  "state": 2,
  "cancel_reason": null,
  "created_at": "2024-11-02T15:38:04.636",
  "performed_at": "2024-11-02T15:38:05.488042",
  "cancelled_at": null,
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20240315055535_Initial",
  "product_version": "7.0.5"
}
```

---

## 20. payment


### `public.payment_confirmations`

| Column | Type |
|--------|------|
| id | bigint |
| payment_id | bigint |
| confirmed_otp | varchar(6) |
| confirmed_at | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "payment_id": 34,
  "confirmed_otp": "743755",
  "confirmed_at": "2025-03-03T10:55:30.772872",
  "is_deleted": false
}
```

### `public.payment_states`

| Column | Type |
|--------|------|
| id | bigint |
| payment_id | bigint |
| status | integer |
| provider_data | jsonb |
| provider_session_id | text |
| created_at | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "payment_id": 1,
  "status": 0,
  "provider_data": null,
  "provider_session_id": null,
  "created_at": "2025-02-28T11:01:30.156371",
  "is_deleted": false
}
```

### `public.payments`

| Column | Type |
|--------|------|
| id | bigint |
| deal_id | bigint |
| user_id | bigint |
| card_id | uuid |
| card_number | varchar(16) |
| expire_date | varchar(4) |
| otp_sent_phone | varchar(16) |
| amount | numeric |
| provider | integer |
| created_at | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "deal_id": 149,
  "user_id": 8,
  "card_id": "5e8afe18-d1a6-4468-9037-3a33c5626704",
  "card_number": "986027******7275",
  "expire_date": "2808",
  "otp_sent_phone": "998940070748",
  "amount": 100.0,
  "provider": 0,
  "created_at": "2025-02-28T11:01:30.153476",
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20240517101318_Initial",
  "product_version": "7.0.5"
}
```

---

## 21. platform


### `public.bank_accounts`

| Column | Type |
|--------|------|
| id | uuid |
| org_id | uuid |
| account | text |
| bank_filial_id | bigint |
| is_deleted | boolean |
| created_at | timestamptz |
| is_active | boolean |
| updated_at | timestamptz |

**Example:**
```json
{
  "id": "5bd0b019-0b63-43ab-bf20-2a8ae21c39d4",
  "org_id": "6c7ab7da-696e-4edf-8037-ac52c90fb97d",
  "account": "0145588596300800",
  "bank_filial_id": -3,
  "is_deleted": false,
  "created_at": "2002-01-20T00:00:00+00:00",
  "is_active": true,
  "updated_at": "2024-02-20T13:52:11.589+00:00"
}
```

### `public.bank_filial_codes`

| Column | Type |
|--------|------|
| id | bigint |
| bank_filial_id | bigint |
| type | text |
| code | text |
| is_deleted | boolean |

**Example:**
```json
_empty table_
```

### `public.bank_filial_locales`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| fillial_id | bigint |
| name | text |
| address | text |

**Example:**
```json
{
  "locale_key": "ru",
  "fillial_id": -3,
  "name": "Test Fillial Ru 3",
  "address": " Toshkent Uchtepa 3"
}
```

### `public.bank_filials`

| Column | Type |
|--------|------|
| id | bigint |
| bank_id | bigint |
| code | text |
| tin | text |
| region_id | bigint |
| district_id | bigint |
| header_id | text |
| union_id | text |
| tcc_id | text |
| ccc_id | text |
| status | integer |
| date_open | date |
| date_close | date |
| date_active | date |
| date_deactive | date |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 2,
  "bank_id": 1,
  "code": "00002",
  "tin": "         ",
  "region_id": 1726,
  "district_id": 1726273,
  "header_id": "00002",
  "union_id": "00002",
  "tcc_id": "00001",
  "ccc_id": "00014",
  "status": 0,
  "date_open": "2013-09-12",
  "date_close": null,
  "date_active": "2020-02-17",
  "date_deactive": null,
  "is_deleted": false
}
```

### `public.bank_locale`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| bank_id | bigint |
| name | text |

**Example:**
```json
{
  "locale_key": "ru",
  "bank_id": -3,
  "name": "Тест-банк уз. 3"
}
```

### `public.banks`

| Column | Type |
|--------|------|
| id | bigint |
| code | text |
| name | text |
| date_open | date |
| date_close | date |
| date_active | date |
| date_deactive | date |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "code": "001",
  "name": "УЗБ.РЕСП. МАРКАЗИЙ БАНКИ                ",
  "date_open": "1997-03-05",
  "date_close": null,
  "date_active": "1997-03-05",
  "date_deactive": null,
  "is_deleted": false
}
```

### `public.card_bins`

| Column | Type |
|--------|------|
| id | uuid |
| bin | text |
| card_provider_type | integer |
| bank_name | text |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "fdc49518-b735-4485-96d7-40cae375d815",
  "bin": "98600101",
  "card_provider_type": 1,
  "bank_name": "Ipotekabank",
  "is_deleted": false
}
```

### `public.locales`

| Column | Type |
|--------|------|
| key | varchar(10) |
| title | varchar(32) |
| code | varchar(15) |

**Example:**
```json
{
  "key": "ru",
  "title": "Русский",
  "code": "ru-RU"
}
```

### `public.org_locales`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| org_id | uuid |
| title | text |
| logo_src | text |
| executive | text |
| accountant | text |
| address | text |
| description | text |
| content | text |

**Example:**
```json
{
  "locale_key": "ru",
  "org_id": "6c7ab7da-696e-4edf-8037-ac52c90fb97d",
  "title": "Таксим Т",
  "logo_src": null,
  "executive": null,
  "accountant": null,
  "address": "Т.Шевченко 21А",
  "description": null,
  "content": null
}
```

### `public.orgs`

| Column | Type |
|--------|------|
| id | uuid |
| upper_id | uuid |
| name | text |
| registered_at | date |
| phone | text |
| status | integer |
| tin | text |
| thsht | integer |
| dbibt | integer |
| ifut | integer |
| is_deleted | boolean |
| vat_code | text |

**Example:**
```json
{
  "id": "6c7ab7da-696e-4edf-8037-ac52c90fb97d",
  "upper_id": null,
  "name": "TaqsimTest",
  "registered_at": null,
  "phone": "998900000000",
  "status": 0,
  "tin": "123456789",
  "thsht": null,
  "dbibt": null,
  "ifut": null,
  "is_deleted": false,
  "vat_code": null
}
```

### `public.region_codes`

| Column | Type |
|--------|------|
| id | bigint |
| region_id | bigint |
| type | text |
| code | text |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "region_id": -1,
  "type": "cbu",
  "code": "0000",
  "is_deleted": false
}
```

### `public.region_locales`

| Column | Type |
|--------|------|
| locale_key | varchar(10) |
| region_id | bigint |
| title | text |

**Example:**
```json
{
  "locale_key": "ru",
  "region_id": -1,
  "title": "Неизвестный"
}
```

### `public.regions`

| Column | Type |
|--------|------|
| id | bigint |
| type | integer |
| upper_id | bigint |
| is_deleted | boolean |

**Example:**
```json
{
  "id": -1,
  "type": 1,
  "upper_id": null,
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20230613162905_Initial",
  "product_version": "7.0.5"
}
```

---

## 22. plum


### `public.plum_payments`

| Column | Type |
|--------|------|
| id | bigint |
| deal_id | bigint |
| amount | numeric |
| is_paid | boolean |
| is_acknowledged | boolean |
| transaction_id | varchar(16) |
| card_number | varchar(16) |
| processed_at | timestamp |
| created_at | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "deal_id": 3,
  "amount": 10000,
  "is_paid": false,
  "is_acknowledged": false,
  "transaction_id": null,
  "card_number": null,
  "processed_at": null,
  "created_at": "2024-03-04T07:35:13.179566",
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20240214140830_InitialDb",
  "product_version": "7.0.5"
}
```

---

## 23. refund


### `public.refund_payments`

| Column | Type |
|--------|------|
| id | bigint |
| deal_id | bigint |
| amount | numeric |
| deal_amount | numeric |
| date | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "deal_id": 1,
  "amount": 0,
  "deal_amount": 3900000.0,
  "date": "2024-10-16T13:33:34.954438",
  "is_deleted": false
}
```

### `public.refund_states`

| Column | Type |
|--------|------|
| id | uuid |
| payment_id | bigint |
| status | integer |
| date | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "6207930d-c2fd-41f0-87de-ac3d486cd4ae",
  "payment_id": 1,
  "status": 1,
  "date": "2024-10-16T13:33:34.954549",
  "is_deleted": false
}
```

### `public.refund_transfers`

| Column | Type |
|--------|------|
| id | uuid |
| payment_id | bigint |
| amount | numeric |
| type | integer |
| date | timestamp |
| is_deleted | boolean |

**Example:**
```json
_empty table_
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20240805050701_InitialMigration",
  "product_version": "7.0.5"
}
```

---

## 24. report


### `public.providers`

| Column | Type |
|--------|------|
| id | uuid |
| name | text |
| method | text |
| valid_time | interval |
| report_type | integer |
| credentials | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "6477f18e-496a-4a9c-9e1e-109f5e1c834a",
  "name": "reportprovidertype",
  "method": "dealyfullpaiddealcountmock",
  "valid_time": "00:05:00",
  "report_type": 0,
  "credentials": null,
  "is_deleted": false
}
```

### `public.report_requests`

| Column | Type |
|--------|------|
| id | uuid |
| name | text |
| valid_until | timestamptz |
| type | integer |
| provider_id | uuid |
| report_id | uuid |
| data | jsonb |
| is_deleted | boolean |
| created | timestamptz |

**Example:**
```json
{
  "id": "a2847fa6-f682-43ce-9f45-d576a5c352e4",
  "name": "reportprovidertype",
  "valid_until": "2025-05-21T05:51:03.339415+00:00",
  "type": 2,
  "provider_id": "cfb86490-c119-4623-93e5-60c5d1a1e7a7",
  "report_id": "69d0ae19-fa21-482a-b2db-ba090461987f",
  "data": {
    "to": "2025-05-21",
    "from": "2023-01-01"
  },
  "is_deleted": false,
  "created": "2025-05-19T07:17:01.314717+00:00"
}
```

### `public.reports`

| Column | Type |
|--------|------|
| id | uuid |
| src | text |
| data | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "69d0ae19-fa21-482a-b2db-ba090461987f",
  "src": "/app/Files/reports/0736005d-1557-46d3-9a8b-7d2f74e75f5d.xlsx",
  "data": null,
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20250228115205_Initial_Database",
  "product_version": "7.0.5"
}
```

---

## 25. schedule


### `public.deal_schedule_info`

| Column | Type |
|--------|------|
| sch_id | uuid |
| sch_deal_id | bigint |
| sch_date | date |
| sch_amount | numeric |
| sch_currency | integer |
| sch_provider_id | uuid |
| sch_deleted | boolean |
| ds_id | bigint |
| ds_deal_id | bigint |
| ds_term_duration | integer |
| ds_term_type | integer |
| ds_payday | smallint |
| ds_pay_start_date | date |
| ds_schedule_type | integer |
| ds_prepayment | numeric |
| ds_sum | numeric |
| ds_currency | integer |
| ds_is_deleted | boolean |

**Example:**
```json
{
  "sch_id": "30f4bd97-d0ec-4fdf-9da2-150ede2b93cd",
  "sch_deal_id": 1,
  "sch_date": "2024-06-30",
  "sch_amount": 325000,
  "sch_currency": 860,
  "sch_provider_id": "b5d7db2b-3c5b-45aa-9c94-f43e4727eb58",
  "sch_deleted": false,
  "ds_id": 1,
  "ds_deal_id": 1,
  "ds_term_duration": 12,
  "ds_term_type": 0,
  "ds_payday": 31,
  "ds_pay_start_date": "-infinity",
  "ds_schedule_type": 0,
  "ds_prepayment": 0.0,
  "ds_sum": 3900000.0,
  "ds_currency": 860,
  "ds_is_deleted": false
}
```

### `public.deal_schedules`

| Column | Type |
|--------|------|
| id | bigint |
| deal_id | bigint |
| term_duration | integer |
| term_type | integer |
| pay_day | smallint |
| pay_start_date | date |
| schedule_type | integer |
| prepayment | numeric |
| sum | numeric |
| currency | integer |
| is_deleted | boolean |

**Example:**
```json
{
  "id": 1,
  "deal_id": 1,
  "term_duration": 12,
  "term_type": 0,
  "pay_day": 31,
  "pay_start_date": "-infinity",
  "schedule_type": 0,
  "prepayment": 0.0,
  "sum": 3900000.0,
  "currency": 860,
  "is_deleted": false
}
```

### `public.payments`

| Column | Type |
|--------|------|
| id | uuid |
| deal_schedule_id | bigint |
| amount | numeric |
| source | integer |
| date | timestamptz |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "1ee242c3-0833-4745-8703-637a61fe33cf",
  "deal_schedule_id": 21,
  "amount": 30.12,
  "source": 2,
  "date": "2024-11-18T06:24:33.260707+00:00",
  "is_deleted": false
}
```

### `public.providers`

| Column | Type |
|--------|------|
| id | uuid |
| name | text |
| method | text |
| credentials | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "b5d7db2b-3c5b-45aa-9c94-f43e4727eb58",
  "name": "Default",
  "method": "Evenly",
  "credentials": null,
  "is_deleted": false
}
```

### `public.schedule_states`

| Column | Type |
|--------|------|
| id | uuid |
| status | integer |
| remaining_amount | numeric |
| covered_amount | numeric |
| created | timestamptz |
| schedule_id | uuid |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "0a736d25-dadd-4e54-a3fb-9eef362bb16c",
  "status": 2,
  "remaining_amount": 0,
  "covered_amount": 550000.0,
  "created": "2025-10-09T01:31:38.519038+00:00",
  "schedule_id": "7129cba9-5f29-4225-bca3-79045b30570c",
  "is_deleted": false
}
```

### `public.schedules`

| Column | Type |
|--------|------|
| id | uuid |
| deal_id | bigint |
| date | date |
| amount | numeric |
| currency | integer |
| provider_id | uuid |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "30f4bd97-d0ec-4fdf-9da2-150ede2b93cd",
  "deal_id": 1,
  "date": "2024-06-30",
  "amount": 325000,
  "currency": 860,
  "provider_id": "b5d7db2b-3c5b-45aa-9c94-f43e4727eb58",
  "is_deleted": false
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20230724101332_InitialDB",
  "product_version": "7.0.5"
}
```

---

## 26. scoring


### `public.Scoring JSOn`

| Column | Type |
|--------|------|
| clientPINFL | text |
| provider_identifier | text |
| provider_id | uuid |
| created_at | timestamp |
| type_key | text |
| data | jsonb |
| points | numeric |
| enable_sum | numeric |

**Example:**
```json
{
  "clientPINFL": "33103940270022",
  "provider_identifier": "6b6e412b15",
  "provider_id": "14159ef5-4c72-4cf6-865b-efc3768c694c",
  "created_at": "2024-02-21T11:25:37.266282",
  "type_key": "Taqsim.Scoring.Core.Entities.Infos.WaterInfo",
  "data": {
    "FmalSaldo": 0
  },
  "points": 652.0,
  "enable_sum": 7678453.091826923
}
```

### `public.Scoring info`

| Column | Type |
|--------|------|
| id | uuid |
| identificator_id | uuid |
| provider_id | uuid |
| provider_identifier | text |
| type | integer |
| data | jsonb |
| created_at | timestamp |
| is_deleted | boolean |
| info_id | uuid |
| info_sesion_id | uuid |
| info_created_at | timestamp |
| info_type_key | text |
| info_data | jsonb |
| info_is_deleted | boolean |
| clientPINFL | text |

**Example:**
```json
{
  "id": "f07c41e1-c59a-4878-ab03-77b819f02e90",
  "identificator_id": "dd06c329-7c6c-4523-abcb-58afc71f9036",
  "provider_id": "14159ef5-4c72-4cf6-865b-efc3768c694c",
  "provider_identifier": "978b8d1d3e",
  "type": 0,
  "data": "{...}",
  "created_at": "2024-02-21T07:20:27.768661",
  "is_deleted": false,
  "info_id": "8beef71e-f687-4402-8715-65daa1c13278",
  "info_sesion_id": "f07c41e1-c59a-4878-ab03-77b819f02e90",
  "info_created_at": "2024-02-21T11:20:28.81219",
  "info_type_key": "Taqsim.Scoring.Core.Entities.Infos.WaterInfo",
  "info_data": {
    "FmalSaldo": 0
  },
  "info_is_deleted": false,
  "clientPINFL": "33103940270022"
}
```

### `public.Scoring_Sessions`

| Column | Type |
|--------|------|
| identifier | text |
| identificator_id | uuid |
| enable_sum | numeric |
| points | numeric |
| created_at | timestamp |
| id | uuid |

**Example:**
```json
{
  "identifier": "33103940270022",
  "identificator_id": "dd06c329-7c6c-4523-abcb-58afc71f9036",
  "enable_sum": 7678453.091826923,
  "points": 652.0,
  "created_at": "2024-02-21T11:25:36.98555",
  "id": "c5644dff-9ed5-45ec-ac8c-f30cc15a51a2"
}
```

### `public.Scoring_base`

| Column | Type |
|--------|------|
| Session_id | uuid |
| Itinitiator | integer |
| PINFL | text |
| data_type | text |
| data | jsonb |
| Scoring_points | numeric |
| Enable_sum | numeric |
| Scoring_date | timestamp |

**Example:**
```json
{
  "Session_id": "f07c41e1-c59a-4878-ab03-77b819f02e90",
  "Itinitiator": 0,
  "PINFL": "33103940270022",
  "data_type": "Taqsim.Scoring.Core.Entities.Infos.WaterInfo",
  "data": {
    "FmalSaldo": 0
  },
  "Scoring_points": null,
  "Enable_sum": null,
  "Scoring_date": "2024-02-21T07:20:27.768661"
}
```

### `public.Scoring_info`

| Column | Type |
|--------|------|
| score_session_id | uuid |
| identifier | text |
| created_at | timestamp |
| initiator | integer |
| points | numeric |
| enable_sum | numeric |
| Уровень_дохода | jsonb |
| Возраст | jsonb |
| Трудовой_стаж | jsonb |
| кредитная_нагрузка_доход | jsonb |
| кредитная_нагрузка_платеж | jsonb |
| условное_обязательство_кол_во | jsonb |
| Кредитная_история | jsonb |
| Судебные | jsonb |
| Списанные | jsonb |
| обязательство_залогодателя | jsonb |
| макс_просроченная_залогодателя | jsonb |
| гарант_обязательства | jsonb |
| макс_просрочка_гарант | jsonb |
| обязательство_созаемщика | jsonb |
| мекс_просрочка_созаемщик | jsonb |
| ипотека | jsonb |
| условное_обязательство | jsonb |
| Пол | jsonb |
| Адрес_временной | jsonb |
| Адрес_постоянный | jsonb |
| Гражданство | jsonb |
| Вся_задолженность | jsonb |

**Example:**
```json
{
  "score_session_id": "f07c41e1-c59a-4878-ab03-77b819f02e90",
  "identifier": "33103940270022",
  "created_at": "2024-02-21T07:20:27.768661",
  "initiator": 0,
  "points": null,
  "enable_sum": null,
  "Уровень_дохода": null,
  "Возраст": null,
  "Трудовой_стаж": null,
  "кредитная_нагрузка_доход": null,
  "кредитная_нагрузка_платеж": null,
  "условное_обязательство_кол_во": null,
  "Кредитная_история": null,
  "Судебные": null,
  "Списанные": null,
  "обязательство_залогодателя": null,
  "макс_просроченная_залогодателя": null,
  "гарант_обязательства": null,
  "макс_просрочка_гарант": null,
  "обязательство_созаемщика": null,
  "мекс_просрочка_созаемщик": null,
  "ипотека": null,
  "условное_обязательство": null,
  "Пол": null,
  "Адрес_временной": null,
  "Адрес_постоянный": null,
  "Гражданство": null,
  "Вся_задолженность": null
}
```

### `public.card_identificator`

| Column | Type |
|--------|------|
| id | uuid |
| provider_id | uuid |
| masked | text |
| type | integer |
| is_deleted | boolean |

**Example:**
```json
_empty table_
```

### `public.identificators`

| Column | Type |
|--------|------|
| id | uuid |
| identifier | text |
| type | integer |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "dd06c329-7c6c-4523-abcb-58afc71f9036",
  "identifier": "33103940270022",
  "type": 0,
  "is_deleted": false
}
```

### `public.identifier_blacklists`

| Column | Type |
|--------|------|
| id | uuid |
| identifier | text |
| is_deleted | boolean |
| fio | text |

**Example:**
```json
{
  "id": "0f2d4df1-4c03-4ef1-a918-760cfe70515e",
  "identifier": "42510900660010",
  "is_deleted": false,
  "fio": "42510900660010"
}
```

### `public.info`

| Column | Type |
|--------|------|
| id | uuid |
| score_session_id | uuid |
| created_at | timestamp |
| type_key | text |
| data | jsonb |
| is_deleted | boolean |
| source | text |

**Example:**
```json
{
  "id": "8beef71e-f687-4402-8715-65daa1c13278",
  "score_session_id": "f07c41e1-c59a-4878-ab03-77b819f02e90",
  "created_at": "2024-02-21T11:20:28.81219",
  "type_key": "Taqsim.Scoring.Core.Entities.Infos.WaterInfo",
  "data": {
    "FmalSaldo": 0
  },
  "is_deleted": false,
  "source": ""
}
```

### `public.info_scores`

| Column | Type |
|--------|------|
| id | uuid |
| score | numeric |
| category | text |
| value | text |
| source | text |
| description | text |
| created_at | timestamp |
| info_id | uuid |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "b352d7b8-e76b-4174-91b3-b65f25321f0e",
  "score": 52.5,
  "category": "Age",
  "value": "31",
  "source": "Passport",
  "description": "от 31 по 40 лет",
  "created_at": "2025-04-03T06:58:05.989926",
  "info_id": "21e89784-489e-4b2d-b31e-7e996a2889b3",
  "is_deleted": false
}
```

### `public.org_blacklists`

| Column | Type |
|--------|------|
| id | uuid |
| org_inn | text |
| is_deleted | boolean |
| org_name | text |

**Example:**
```json
{
  "id": "b9d36073-fc9a-4de2-be00-85cebf54e5cd",
  "org_inn": "311582236",
  "is_deleted": false,
  "org_name": "\"QUYOSHLI QISHLOQ\" MCHJ\t"
}
```

### `public.providers`

| Column | Type |
|--------|------|
| id | uuid |
| params | integer |
| name | text |
| method | text |
| credentials | jsonb |
| is_deleted | boolean |
| stop_factors | ARRAY |
| type | text |
| visibility | smallint |

**Example:**
```json
{
  "id": "2416a282-ce72-48ed-af5d-66096f742538",
  "params": 0,
  "name": "Default",
  "method": "TaqsimEstateV1",
  "credentials": null,
  "is_deleted": false,
  "stop_factors": [
    2,
    4,
    1,
    5,
    6,
    7,
    9,
    10,
    8,
    11,
    12,
    13,
    15
  ],
  "type": "Strict",
  "visibility": 0
}
```

### `public.repayment_histories`

| Column | Type |
|--------|------|
| id | uuid |
| deal_id | bigint |
| identifier | text |
| amount | bigint |
| end_balance | bigint |
| created_at | timestamp |
| repayment_date | timestamp |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "bf202ea9-a167-4a03-b168-b74248fd6f98",
  "deal_id": 1,
  "identifier": "6b6e412b15",
  "amount": 390000000,
  "end_balance": 0,
  "created_at": "2024-10-16T13:33:28.041507",
  "repayment_date": "-infinity",
  "is_deleted": false
}
```

### `public.score_states`

| Column | Type |
|--------|------|
| id | uuid |
| score_session_id | uuid |
| contract_ids | ARRAY |
| code | text |
| status | integer |
| created_at | timestamp |
| is_deleted | boolean |
| provider_id | uuid |

**Example:**
```json
{
  "id": "fc36f393-29d8-4d6b-abad-d12d106138d4",
  "score_session_id": "f07c41e1-c59a-4878-ab03-77b819f02e90",
  "contract_ids": [],
  "code": null,
  "status": 1,
  "created_at": "2024-02-21T11:20:27.848036",
  "is_deleted": false,
  "provider_id": "14159ef5-4c72-4cf6-865b-efc3768c694c"
}
```

### `public.scores`

| Column | Type |
|--------|------|
| id | uuid |
| provider_id | uuid |
| score_session_id | uuid |
| identifier | text |
| points | numeric |
| enable_sum | numeric |
| created_at | timestamp |
| expires_date | timestamp |
| scoring_model | jsonb |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "4141faa0-cc7a-4438-ae45-43450ace6e0a",
  "provider_id": "14159ef5-4c72-4cf6-865b-efc3768c694c",
  "score_session_id": "c5644dff-9ed5-45ec-ac8c-f30cc15a51a2",
  "identifier": null,
  "points": 652.0,
  "enable_sum": 7678453.091826923,
  "created_at": "2024-02-21T11:25:56.445208",
  "expires_date": "2024-02-21T14:25:56.445209",
  "scoring_model": "{...}",
  "is_deleted": false
}
```

### `public.scoring_sessions`

| Column | Type |
|--------|------|
| id | uuid |
| identificator_id | uuid |
| provider_id | uuid |
| provider_identifier | text |
| type | integer |
| data | jsonb |
| created_at | timestamp |
| is_deleted | boolean |
| card_identificator_id | uuid |
| initiator | integer |

**Example:**
```json
{
  "id": "f07c41e1-c59a-4878-ab03-77b819f02e90",
  "identificator_id": "dd06c329-7c6c-4523-abcb-58afc71f9036",
  "provider_id": "14159ef5-4c72-4cf6-865b-efc3768c694c",
  "provider_identifier": "978b8d1d3e",
  "type": 0,
  "data": "{...}",
  "created_at": "2024-02-21T07:20:27.768661",
  "is_deleted": false,
  "card_identificator_id": null,
  "initiator": 0
}
```

### `public.scoring_sessions_enriched`

| Column | Type |
|--------|------|
| initiator | integer |
| score_session_id | uuid |
| identificator_id | uuid |
| identifier | text |
| created_at | timestamp |
| loan_application_info | jsonb |
| info_score_contract_info | jsonb |
| monthly_average_payment_info | jsonb |
| overdue_info | jsonb |
| pledger_liability_info | jsonb |
| guarantor_liability_info | jsonb |
| coborrower_liability_info | jsonb |
| contingent_liability_info | jsonb |

**Example:**
```json
{
  "initiator": 0,
  "score_session_id": "f07c41e1-c59a-4878-ab03-77b819f02e90",
  "identificator_id": "dd06c329-7c6c-4523-abcb-58afc71f9036",
  "identifier": "33103940270022",
  "created_at": "2024-02-21T07:20:27.768661",
  "loan_application_info": null,
  "info_score_contract_info": null,
  "monthly_average_payment_info": null,
  "overdue_info": null,
  "pledger_liability_info": null,
  "guarantor_liability_info": null,
  "coborrower_liability_info": null,
  "contingent_liability_info": null
}
```

### `public.scoring_state_session`

| Column | Type |
|--------|------|
| score_session_id | uuid |
| contract_ids | ARRAY |
| code | text |
| status | integer |
| data | jsonb |

**Example:**
```json
{
  "score_session_id": "f07c41e1-c59a-4878-ab03-77b819f02e90",
  "contract_ids": [],
  "code": null,
  "status": 1,
  "data": "{...}"
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20230613104026_init",
  "product_version": "7.0.5"
}
```

---

## 27. scoring_cache


### `public.identificators`

| Column | Type |
|--------|------|
| id | uuid |
| type | integer |
| identifier | text |
| external_identifiers | ARRAY |
| source | integer |
| inactive_at | timestamp |
| created_at | timestamp |
| status | integer |
| is_deleted | boolean |

**Example:**
```json
{
  "id": "b83c897d-30b0-4797-9b10-0eecd7a1228f",
  "type": 1,
  "identifier": "33103940270022",
  "external_identifiers": [
    "095008e86d"
  ],
  "source": 0,
  "inactive_at": "2025-04-03T09:58:03.829413",
  "created_at": "2025-04-03T06:58:03.82915",
  "status": 1,
  "is_deleted": false
}
```

### `public.reports`

| Column | Type |
|--------|------|
| id | uuid |
| type | integer |
| data | text |
| is_success | boolean |
| identificator_id | uuid |
| is_deleted | boolean |

**Example:**
```json
_empty table_
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20250120065724_InitialMigration",
  "product_version": "7.0.5"
}
```

---

## 28. urls


### `public.shortened_urls`

| Column | Type |
|--------|------|
| id | bigint |
| long_url | text |
| short_url | text |
| code | varchar(7) |
| created_on_utc | timestamptz |

**Example:**
```json
{
  "id": 3,
  "long_url": "https://finance.finsum.uz/files/Invoices/90b35506-fa8b-4b03-8c33-62f9e6cdc925/6c...",
  "short_url": "https://fnc.finsum.uz/XCmKS87",
  "code": "XCmKS87",
  "created_on_utc": "2024-05-23T10:03:13.128432+00:00"
}
```

### `sys.migrations`

| Column | Type |
|--------|------|
| migration_id | varchar(150) |
| product_version | varchar(32) |

**Example:**
```json
{
  "migration_id": "20240208102733_InitialDb",
  "product_version": "7.0.15"
}
```
