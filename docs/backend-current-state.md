# Backend Current State

Alphaomega를 프론트 단독 앱에서 결제/이용권 기반 서비스로 옮기기 위한 현재 상태 정리.

## Current Direction

- 배포 기준은 Netlify Functions가 아니라 Docker Compose 기반 서버 배포다.
- 프론트는 `/api/gemini`만 호출하고, Gemini key는 백엔드 환경변수에만 둔다.
- 운영 Gemini key는 MonoGPT Gemini 라우터 key를 쓴다.
- 결제 제공자는 특정 서비스명으로 고정하지 않는다.
- Apple/Google 같은 인앱 결제 제공자는 `purchase_orders.provider` 값으로만 구분한다.
- 이용권은 결제 성공 후 발급되고, 검사 최종 결과가 완성된 뒤에만 차감한다.
- 프론트/백엔드 역할 분리는 `docs/frontend-backend-boundary.md`를 기준으로 한다.
- 토스 로그인은 먼저 연결했다. 프론트는 `appLogin()`으로 인가 코드만 받고, 백엔드는 mTLS로 토큰 교환과 사용자 조회를 처리한다.

## Runtime Layout

- `web`: React 정적 파일 nginx 서버
- `backend`: Express API 서버
- `db`: PostgreSQL
- `Dockerfile`: 프론트 빌드용 `web` target과 API용 `backend` target 분리
- `docker-compose.yml`: web/backend/db 구성

## Progress Snapshot

완료:

- Docker Compose 기반 Express/PostgreSQL 백엔드 골격
- Gemini 서버 프록시
- 공용 Gemini key 요청 로그
- 토스 로그인 프론트 버튼
- Apps in Toss `appLogin()` 인가 코드 수신
- 서버 mTLS 기반 Toss 토큰 교환/사용자 조회 라우트
- `app_users` 사용자 upsert
- 서비스 세션 토큰 발급 및 `/api/me`
- 로그인된 검사 요청의 `user_id` 로그 연결
- `GET /api/passes` 이용권 조회
- `POST /api/passes/consume` 최종 결과 확정 후 이용권 차감
- `POST /api/purchases/verify` 결제 검증 API 진입점
- `POST /api/iap/grant-pass` Apps in Toss IAP 이용권 11회 발급
- Apps in Toss IAP 구매 버튼
- Apple App Store Server API 거래 검증
- Google Play Developer API 인앱 상품 검증
- Apple/Google 검증 성공 후 `access_passes` 자동 발급
- 로그인 후 잔여 이용권 조회 UI
- 검사 전 잔여 이용권 확인
- 결과 JSON 파싱 성공 후 이용권 차감 호출
- `VITE_PURCHASE_MOCK=true`일 때 테스트 이용권 발급 UI
- 프론트/백엔드 역할 경계 문서화

미완료:

- 실제 토스 앱/샌드박스에서 로그인 왕복 검증
- 실제 토스인앱 sandbox IAP 결제 E2E 검증
- 운영 서버 nginx/domain/compose 파일 확정
- 운영 서버에서 web/backend 분리 배포 검증

마지막 로컬 검증:

- `npm run build` 성공
- 서버 JS 문법 체크 성공
- `docker compose config` 성공

## API Draft

- `GET /api/health`
  - 서버, DB, Gemini 환경 설정 상태 확인
- `GET /api/usage`
  - 공용 Gemini key 누적 요청/토큰/예상 비용 확인
- `GET /api/passes`
  - 로그인 사용자의 이용권 목록과 총 잔여 횟수 확인
- `POST /api/passes/consume`
  - 최종 결과 확정 뒤 1회 차감
  - `chargeKey` 기준 중복 차감 방지
  - 성공한 검사 세션이 없으면 차감하지 않음
- `POST /api/iap/grant-pass`
  - Apps in Toss IAP `orderId` 기준 이용권 발급
  - 기본 발급 횟수는 `PASS_USES_PER_PURCHASE=11`
  - 같은 `orderId`는 중복 발급하지 않음
  - 다른 사용자 재사용은 409로 차단
- `POST /api/purchases/verify`
  - Apple/Google 결제 검증
  - 검증 성공 시 `purchase_orders` 승인 저장과 `access_passes` 발급
  - Apple 요청: `provider=app_store`, `transactionId`, 선택 `productId`
  - Google 요청: `provider=play_store`, `productId`, `purchaseToken`, 선택 `packageName`
  - `PURCHASE_MOCK=true`일 때만 `manual` provider 테스트 발급 가능
- `POST /api/gemini`
  - Gemini 프록시
  - `userApiKey`가 있으면 개인 key 사용
  - `userApiKey`가 없으면 공용 `GEMINI_API_KEY` 사용
  - 기본 `GEMINI_API_BASE`는 MonoGPT Gemini 라우터다.
  - 현재는 요청 로그 저장까지 구현
  - 전체 공용 key 예산 제한은 적용하지 않음
  - 이용권 차감은 아직 직접 수행하지 않음
- `POST /api/toss/login`
  - Apps in Toss `appLogin()`에서 받은 `authorizationCode`, `referrer`를 서버로 전달
  - 서버가 Toss 토큰 교환/사용자 조회를 수행
  - `app_users`에 `toss:<userKey>`로 사용자 upsert
  - 서비스 세션 토큰 반환
- `GET /api/me`
  - 저장된 서비스 세션 토큰으로 현재 사용자 확인

## Database Tables

### `app_users`

- 로그인 ID
- 비밀번호 해시
- 표시 이름
- 가입/마지막 로그인 시간

### `purchase_orders`

- 결제 제공자: `app_store`, `play_store`, `manual` 등
- 제공자 주문 ID
- 제공자 거래 ID
- 상품 ID
- 금액/통화/상태
- 구매자 정보
- 제공자 원본 응답 JSON
- 생성/승인/실패/취소/환불 시간

### `access_passes`

- 사용자별 이용권
- 어떤 구매 주문으로 발급됐는지
- 이용 가능 횟수와 사용 횟수
- 사용 가능/사용 완료/만료/취소 상태

### `access_pass_charges`

- 실제 차감 장부
- `charge_key`로 중복 차감 방지
- 어떤 검사 세션에서 차감됐는지 기록
- 같은 검사 제출이 재시도되어도 한 번만 차감하기 위한 테이블

### `usage_sessions`

- 검사 세션
- 개인 key/공용 key 사용 여부
- 페어/개인 검사 모드
- Gemini 내부 요청 수와 성공 요청 수
- 시작/완료 시간

### `gemini_requests`

- Gemini 단일 호출 로그
- 요청 모델/실제 모델
- phase
- 성공/실패 상태
- 토큰 수
- 예상 비용
- 에러 코드/메시지
- IP/User-Agent 해시

### `app_settings`

- 운영 설정 key/value JSON 저장용

## Environment Variables

- `POSTGRES_PASSWORD`
- `SESSION_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_API_BASE`
- `GEMINI_MODEL`
- `GEMINI_THINKING_BUDGET`
- `GEMINI_INPUT_USD_PER_MILLION`
- `GEMINI_OUTPUT_USD_PER_MILLION`
- `USD_TO_KRW`
- `PAYMENT_PROVIDER`
- `PASS_PRICE_KRW`
- `PASS_USES_PER_PURCHASE`
- `PURCHASE_MOCK`
- `APPLE_ENV`
- `APPLE_BUNDLE_ID`
- `APPLE_ISSUER_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`
- `APPLE_PRIVATE_KEY_PATH`
- `APPLE_PRODUCT_IDS`
- `GOOGLE_PACKAGE_NAME`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`
- `GOOGLE_PRODUCT_IDS`
- `MAX_REQUEST_BYTES`
- `HTTP_PORT`
- `TOSS_API_BASE`
- `TOSS_MTLS_CERT_PATH`
- `TOSS_MTLS_KEY_PATH`
- `TOSS_MTLS_KEY_PASSWORD`
- `TOSS_LOGIN_MOCK`
- `VITE_API_BASE_ENDPOINT`
- `VITE_GEMINI_ENDPOINT`
- `VITE_TOSS_LOGIN_MOCK`
- `VITE_PURCHASE_MOCK`
- `VITE_TOSS_IAP_SKU`

주의:

- 운영 서버 `.env.prod`에 Toss 공급가 fallback `PASS_PRICE_KRW=627`, `PASS_USES_PER_PURCHASE=11`이 들어 있어야 현재 상품 기준과 맞는다.
- 실제 결제 가격은 Toss/Apple/Google 상품 콘솔의 SKU 설정을 따른다.
- Toss 결제창에서 사용자에게 `690원`으로 보이게 하려면 공급가를 `690 / 1.1 = 627.27원` 기준으로 역산한다.
- Toss 콘솔에는 우선 `627원`으로 등록하고, 미리보기에서 최종 결제액이 `690원`으로 보이는지 확인한다.
- Toss mTLS 파일은 `secrets/toss/alpha_public.crt`, `secrets/toss/alpha_private.key` 이름으로 맞춘다.

## 690원 11회권 비용 기준

- 총액 기준 1회당 매출은 약 `62.7원`이다.
- VAT만 제외하면 약 `57.0원/회`, VAT와 30% 플랫폼 수수료를 모두 제외하면 약 `39.9원/회`다.
- `gemini-3.5-flash-lite` 비용 추정 기본값은 입력 `$0.30/M`, 출력 `$2.50/M`, 환율 `1400`이다.
- 검사 1회가 Gemini 호출 1회로 끝나면 대체로 감당 가능하다.
- 자동 재시도가 3회 이상 반복되면 비용이 1회 매출을 넘길 수 있으므로 재시도 상한과 응답 검증이 중요하다.

## Lessons Baked Into The Design

- Netlify 함수 경로로 새지 않도록 프론트 기본 endpoint는 `/api/gemini`다.
- 특정 결제 제공자 이름을 테이블명에 넣지 않는다.
- Gemini 호출 성공만으로 이용권을 차감하지 않는다.
- 프론트가 최종 JSON을 정상 파싱하고 결과 화면에 반영할 수 있을 때만 차감한다.
- 한 검사에 AI 호출이 여러 번 있어도 최종 완료 기준으로 1회만 차감한다.
- 마지막 1회권은 중간 호출에서 먼저 차감하지 않는다.
- `charge_key`를 저장해 재시도/중복 클릭/네트워크 재전송의 중복 차감을 막는다.
- 모델 폐기, 신규 사용자 제한, 라우터 endpoint 차이를 대비해 `GEMINI_MODEL`과 `GEMINI_API_BASE`를 환경변수로 둔다.
- MonoGPT Gemini 라우터는 `https://monogpt.kr/api/monorouter/v1/gemini/v1beta/models/{model}:generateContent` 형태로 호출한다.
- 응답 길이 초과는 차감 실패와 분리해서 다룬다.

## Deployment Checklist

```bash
cp .env.example .env
# .env에 운영값 입력
docker compose up -d --build
curl http://127.0.0.1:8080/api/health
```

- 서버에서는 compose 파일을 직접 실행하지 않는다.
- `docker compose -f <compose-file> up -d --build` 형식으로 실행한다.
- 배포 전 GitHub pull/push 권한과 토큰을 확인한다.
- 배포 후 app/db 컨테이너 상태를 확인한다.
- 결제 연동 후에는 구매 완료 뒤 잔여 이용권 재조회가 반드시 필요하다.

## Next Work

- 토스 앱/샌드박스에서 `POST /api/toss/login` 실제 왕복 검증
- 로그인 성공 후 `app_users.last_login_at` 갱신 확인
- `/api/gemini` 요청이 `usage_sessions.user_id`, `gemini_requests.user_id`에 연결되는지 DB 확인
- 인앱 결제 상품 조회/구매 연결
- 실제 토스인앱 sandbox IAP 결제 E2E 검증
- 실제 배포 서버 compose 파일과 도메인/nginx 구성 정리
