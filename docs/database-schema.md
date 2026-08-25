# AlphaOmega Database Schema

AlphaOmega 백엔드는 PostgreSQL을 기준으로 사용자, 결제, 이용권, 검사 세션, AI 호출, 감사 로그를 분리해서 저장한다.

## 관계 요약

```text
app_users
  └─ purchase_orders
       └─ access_passes
            └─ access_pass_charges

app_users
  └─ usage_sessions
       └─ gemini_requests

audit_logs
  └─ 로그인, 결제, 이용권, AI 호출 이벤트 요약 기록
```

## 필수 테이블

### app_users

Toss 로그인 기준 사용자 계정 테이블.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `text` | 내부 사용자 ID |
| `login_id` | `text unique` | 외부 로그인 식별자. Toss는 `toss:<userKey>` 형식 |
| `password_hash` | `text` | 현재 미사용. 향후 자체 로그인용 예비 컬럼 |
| `display_name` | `text` | 화면 표시명 |
| `created_at` | `timestamptz` | 생성 시각 |
| `last_login_at` | `timestamptz` | 마지막 로그인 시각 |

### purchase_orders

Toss IAP, Apple, Google, manual 구매 기록을 저장한다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `text` | 내부 주문 ID |
| `user_id` | `text` | `app_users.id` 참조 |
| `provider` | `text` | `apps_in_toss_iap`, `app_store`, `play_store`, `manual` |
| `provider_order_id` | `text` | 결제 제공자 주문 ID |
| `provider_transaction_id` | `text` | 결제 제공자 거래 ID |
| `product_id` | `text` | 상품 ID 또는 SKU |
| `amount_krw` | `integer` | 결제 금액 |
| `currency` | `text` | 통화. 기본 `KRW` |
| `status` | `text` | `created`, `approved`, `failed`, `canceled`, `refunded` |
| `purchaser_email` | `text` | 구매자 이메일. 현재 선택 저장 |
| `purchaser_name` | `text` | 구매자 이름. 현재 선택 저장 |
| `raw_response` | `jsonb` | 검증 응답 원문 요약 |
| `created_at` | `timestamptz` | 생성 시각 |
| `approved_at` | `timestamptz` | 승인 시각 |
| `failed_at` | `timestamptz` | 실패 시각 |
| `canceled_at` | `timestamptz` | 취소 시각 |
| `refunded_at` | `timestamptz` | 환불 시각 |

중복 방지:

- `UNIQUE (provider, provider_order_id)`
- `UNIQUE (provider, provider_transaction_id)`

### access_passes

이용권 본체. 결제가 승인되면 사용자에게 11회권 같은 사용 권한이 생성된다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `text` | 이용권 ID |
| `user_id` | `text` | `app_users.id` 참조 |
| `order_id` | `text` | `purchase_orders.id` 참조 |
| `pass_code` | `text unique` | 수동 코드형 이용권 예비 컬럼 |
| `status` | `text` | `available`, `used`, `canceled` |
| `allowed_uses` | `integer` | 총 사용 가능 횟수. 운영 기본 11 |
| `used_count` | `integer` | 사용된 횟수 |
| `created_at` | `timestamptz` | 생성 시각 |
| `used_at` | `timestamptz` | 전부 사용 완료된 시각 |
| `expires_at` | `timestamptz` | 만료 시각 |
| `canceled_at` | `timestamptz` | 취소 시각 |

### access_pass_charges

이용권 1회 차감 기록. `charge_key`로 같은 검사 결과가 중복 차감되는 것을 막는다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `text` | 차감 기록 ID |
| `access_pass_id` | `text` | `access_passes.id` 참조 |
| `session_id` | `text` | `usage_sessions.id` 참조 |
| `charge_key` | `text unique` | 프론트가 생성한 중복 차감 방지 키 |
| `status` | `text` | 기본 `consumed` |
| `reason` | `text` | 기본 `report_completed` |
| `created_at` | `timestamptz` | 생성 시각 |
| `consumed_at` | `timestamptz` | 차감 시각 |
| `canceled_at` | `timestamptz` | 차감 취소 시각 |

### usage_sessions

검사 1회 실행 세션. 하나의 결과 생성 과정에서 `generate`, `repair`, `regenerate` 같은 Gemini 호출이 여러 번 발생할 수 있다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `text` | 검사 세션 ID |
| `user_id` | `text` | `app_users.id` 참조 |
| `access_pass_id` | `text` | 결과 확정 후 차감된 이용권 ID |
| `key_mode` | `text` | `shared` 또는 `personal` |
| `report_mode` | `text` | `pair`, `solo`, `unknown` |
| `status` | `text` | `started`, `completed`, `failed` |
| `gemini_request_count` | `integer` | 해당 세션의 AI 호출 수 |
| `successful_request_count` | `integer` | 성공한 AI 호출 수 |
| `started_at` | `timestamptz` | 시작 시각 |
| `completed_at` | `timestamptz` | 완료 시각 |

### gemini_requests

AI 호출 로그. MonoGPT/Gemini 호출의 성공 여부, 토큰, 예상 비용을 저장한다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `text` | AI 요청 ID |
| `session_id` | `text` | `usage_sessions.id` 참조 |
| `user_id` | `text` | `app_users.id` 참조 |
| `access_pass_id` | `text` | 차감된 이용권 ID |
| `key_mode` | `text` | `shared` 또는 `personal` |
| `requested_model` | `text` | 요청 모델 |
| `actual_model` | `text` | 실제 사용 모델 |
| `phase` | `text` | `generate`, `repair`, `regenerate_*` |
| `ok` | `boolean` | 성공 여부 |
| `status` | `integer` | upstream HTTP status |
| `input_tokens` | `integer` | 입력 토큰 |
| `output_tokens` | `integer` | 출력 토큰 |
| `cost_usd` | `numeric` | 예상 비용 USD |
| `cost_krw` | `numeric` | 예상 비용 KRW |
| `error_code` | `text` | 오류 코드 |
| `error_message` | `text` | 오류 메시지 |
| `ip_hash` | `text` | IP 해시 |
| `user_agent_hash` | `text` | User-Agent 해시 |
| `created_at` | `timestamptz` | 생성 시각 |
| `completed_at` | `timestamptz` | 완료 시각 |

### audit_logs

운영 감사 로그. 여러 테이블에 흩어진 사건을 시간순으로 확인하기 위한 요약 이벤트 로그다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `text` | audit log ID |
| `actor_user_id` | `text` | `app_users.id` 참조 |
| `event_type` | `text` | 이벤트 종류 |
| `status` | `text` | `ok`, `failed` |
| `entity_type` | `text` | 연결된 엔티티 종류 |
| `entity_id` | `text` | 연결된 엔티티 ID |
| `ip_hash` | `text` | IP 해시 |
| `user_agent_hash` | `text` | User-Agent 해시 |
| `metadata` | `jsonb` | 이벤트별 부가 정보 |
| `created_at` | `timestamptz` | 생성 시각 |

현재 기록 대상 이벤트:

- `toss_login`
- `iap_pass_granted`
- `purchase_verified`
- `pass_consumed`
- `gemini_request`
- `gemini_usage_recorded`

토큰, API key, 인가 코드, 원문 결제 응답은 audit metadata에 그대로 저장하지 않는다.

### app_settings

운영 설정 저장용 예비 테이블. 모델, 가격, 공지, feature flag 등을 코드 수정 없이 바꾸고 싶을 때 사용할 수 있다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `key` | `text` | 설정 키 |
| `value` | `jsonb` | 설정값 |
| `updated_at` | `timestamptz` | 수정 시각 |

## 운영에서 특히 볼 쿼리

잔여 이용권 확인:

```sql
SELECT
  u.display_name,
  p.id AS pass_id,
  p.status,
  p.allowed_uses,
  p.used_count,
  p.allowed_uses - p.used_count AS remaining_uses,
  p.created_at
FROM access_passes p
JOIN app_users u ON u.id = p.user_id
ORDER BY p.created_at DESC;
```

최근 AI 실패 확인:

```sql
SELECT
  created_at,
  requested_model,
  phase,
  status,
  error_code,
  error_message
FROM gemini_requests
WHERE ok = false
ORDER BY created_at DESC
LIMIT 50;
```

최근 audit log 확인:

```sql
SELECT
  created_at,
  event_type,
  status,
  entity_type,
  entity_id,
  metadata
FROM audit_logs
ORDER BY created_at DESC
LIMIT 50;
```
