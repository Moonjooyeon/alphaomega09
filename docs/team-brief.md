# Alphaomega Team Brief

작성일: 2026-08-14

## 진행사항

Alphaomega는 기존 프론트 단독 Gemini 호출 구조에서, Docker Compose 기반 Express/PostgreSQL 백엔드와 React 프론트로 분리하는 중입니다. 현재는 Gemini 서버 프록시, MonoGPT Gemini 라우터, Toss 로그인, 사용자 저장, 검사 사용 로그, Apps in Toss IAP 구매, 이용권 발급/조회/차감까지 코드 연결이 끝난 상태입니다.

## 현재 방향

- Netlify Functions 기준은 중단하고 Docker Compose 서버 배포 기준으로 전환합니다.
- 프론트는 `/api/gemini`만 호출하고, 공용 API key는 백엔드 환경변수에만 둡니다.
- Gemini 호출은 MonoGPT Gemini 라우터를 기본값으로 사용합니다.
- 결제는 토스인앱 Apps in Toss IAP를 우선 흐름으로 두고, Apple/Google 직접 검증은 보조 경로로 둡니다.
- Toss는 로그인과 토스인앱 IAP 연동에 사용합니다.
- 이용권은 결제 검증 성공 후 발급하고, 검사 최종 결과가 화면에 정상 반영된 뒤에만 차감하는 구조로 연결했습니다.
- 전체 공용키 예산 제한은 해제했습니다. 사용량/비용 추정 로그는 계속 저장합니다.

## 인수인계 목표

목표는 개발 쪽에서 프론트/백엔드/DB/결제 검증/이용권 차감까지 완성하고, 팀장님 또는 운영 담당자는 회사 서버와 도메인 연결만 처리하면 되는 상태로 넘기는 것입니다.

팀장님께 넘기기 전까지 개발 쪽에서 끝내야 하는 범위:

- Docker Compose로 프론트/백엔드/DB가 한 번에 뜨는 상태
- `.env.example`만 보고 운영 `.env`를 채울 수 있는 상태
- `/health` 또는 `/api/health`로 서버/DB/Gemini 설정을 확인할 수 있는 상태
- 로그인 사용자가 DB에 저장되는 상태
- 인앱 결제 검증 후 이용권이 발급되는 상태
- 검사 최종 결과 확정 뒤에만 이용권이 1회 차감되는 상태
- 중복 클릭/재시도/응답 파싱 실패에 이용권이 잘못 차감되지 않는 상태
- 배포 후 확인 명령과 장애 시 확인 지점이 문서화된 상태

팀장님 또는 운영 담당자에게 남길 범위:

- 회사 도메인 DNS 연결
- 서버 방화벽/보안그룹 포트 확인
- SSL 인증서 또는 nginx/프록시 설정
- 운영 `.env` 실제 값 주입
- 운영 서버에서 `docker compose up -d --build` 실행
- 배포 후 `/health`, `/api/health`, 실제 앱 접속 확인

## 진행 현황

완료된 것:

- React/Vite 프론트 유지
- 개인 감별/페어 감별 화면 유지
- 이미지 업로드, 크롭/조정 모달, 결과 이미지 저장 기능
- Express 백엔드 추가
- PostgreSQL 마이그레이션 추가
- Dockerfile / `docker-compose.yml` 추가
- `/api/health`
- `/health`
- `/api/gemini` 서버 프록시
- MonoGPT Gemini 라우터 연동 기본값 반영
- Gemini 요청별 토큰/비용/에러 로그 저장
- Toss 로그인 버튼 및 `appLogin()` 연동
- `POST /api/toss/login`
- `GET /api/me`
- Toss 사용자 `app_users` 저장
- 로그인된 사용자의 Gemini 요청을 `usage_sessions`, `gemini_requests`의 `user_id`와 연결
- `GET /api/passes` 이용권 조회
- `POST /api/passes/consume` 최종 결과 확정 후 1회 차감
- `chargeKey` 기반 중복 차감 방지
- `POST /api/purchases/verify` 결제 검증 API 진입점
- Apps in Toss IAP 구매 버튼
- `POST /api/iap/grant-pass` Apps in Toss IAP 이용권 11회 발급
- Apple/Google 직접 서버 검증 보조 경로
- Apps in Toss IAP 또는 Apple/Google 검증 성공 후 이용권 자동 발급
- 로그인 후 잔여 이용권 조회 UI
- 검사 전 잔여 이용권 확인
- 결과 JSON 파싱 성공 후 `/api/passes/consume` 호출
- `VITE_PURCHASE_MOCK=true`일 때 테스트 이용권 발급 UI
- 프론트/백엔드 역할 분리 문서화
- 지금까지 겪은 배포/결제/이용권 오류 기록 문서화

아직 남은 것:

- 실제 Toss 앱/샌드박스에서 로그인 왕복 검증
- 실제 토스인앱 sandbox IAP 결제 E2E 검증
- 운영 서버 도메인/nginx/SSL 구성 확정
- 운영 배포 후 DB에서 사용자/검사 로그 정상 저장 확인

## 프론트엔드 구성

주요 파일:

| 파일 | 역할 |
| --- | --- |
| `src/main.jsx` | React 앱 엔트리 |
| `src/report/GonadalReport.jsx` | 검사 입력, 로그인, Gemini 요청, 결과 렌더링 핵심 화면 |
| `src/report/config.js` | 프론트 설정, API endpoint, 문항/선택지 |
| `src/report/helpers.js` | 응답 파싱, 에러 메시지, 유틸 |
| `src/report/styles.js` | 화면 스타일 |
| `src/report/assets.js` | 이미지/시각 자료 |
| `src/report/mockReport.js` | 목업/샘플 결과 |

프론트가 담당하는 일:

- 사용자가 입력하는 검사 폼
- 개인/페어 감별 모드
- 캐릭터 이미지 업로드와 크롭/조정
- 결과 화면 렌더링
- 결과 이미지 저장
- 개인 Gemini API key 입력 옵션
- Toss 로그인 버튼과 백엔드 로그인 API 호출
- Gemini 응답 JSON 파싱
- 최종 결과가 정상 렌더링 가능한지 판단

프론트가 담당하지 않는 일:

- 공용 API key 보관
- 공용 API key로 Gemini 직접 호출
- 결제 영수증 단독 신뢰
- 이용권 직접 발급
- DB 직접 접근
- Gemini 호출 성공만 보고 차감 확정

## 백엔드 구성

주요 파일:

| 파일 | 역할 |
| --- | --- |
| `server/index.js` | Express 앱, API 라우팅, 정적 파일 서빙 |
| `server/config.js` | 환경변수 설정 |
| `server/db.js` | PostgreSQL 연결 및 마이그레이션 실행 |
| `server/migrations/001_initial.sql` | 초기 DB 스키마 |
| `server/routes/health.js` | 서버/DB/Gemini 설정 헬스체크 |
| `server/routes/auth.js` | Toss 로그인, 현재 사용자 조회 |
| `server/routes/gemini.js` | Gemini 프록시 및 요청 로그 |
| `server/routes/usage.js` | 공용 key 사용량 조회 |
| `server/services/gemini.js` | MonoGPT/Gemini 호출 처리 |
| `server/services/toss.js` | Toss mTLS token/login-me 호출 |
| `server/services/users.js` | 사용자 upsert/public user |
| `server/services/auth.js` | 서비스 세션 토큰 발급/검증 |
| `server/services/usage.js` | 토큰/비용 추정 및 누적 사용량 조회 |

백엔드가 담당하는 일:

- 공용 Gemini/MonoGPT API key를 환경변수로만 보관
- 프론트 대신 Gemini 호출
- MonoGPT Gemini 라우터 endpoint 구성
- Toss 로그인 토큰 교환과 사용자 조회
- 서비스 세션 토큰 발급
- 사용자 DB 저장
- Gemini 요청 로그 저장
- 토큰/예상 비용 기록
- 추후 결제 영수증 검증
- 이용권 조회/차감/중복 차감 방지
- 추후 결제 성공 후 이용권 자동 발급

## 현재 API

| API | 상태 | 설명 |
| --- | --- | --- |
| `GET /health` | 구현 | 외부 도메인/로드밸런서 확인용 공개 헬스체크 |
| `GET /api/health` | 구현 | 서버, DB, Gemini key 설정 상태 확인 |
| `POST /api/toss/login` | 구현 | Apps in Toss 인가 코드를 백엔드에서 토큰/사용자 정보로 교환 |
| `GET /api/me` | 구현 | 서비스 세션 토큰으로 현재 사용자 복구 |
| `POST /api/gemini` | 구현 | Gemini/MonoGPT 서버 프록시, 요청 로그 저장 |
| `GET /api/usage` | 구현 | 공용 key 누적 사용량/예상 비용 조회 |
| `GET /api/passes` | 구현 | 사용자 잔여 이용권 조회 |
| `POST /api/passes/consume` | 구현 | 최종 결과 확정 후 1회 차감 |
| `POST /api/iap/grant-pass` | 구현 | Apps in Toss IAP orderId 기준 이용권 발급 |
| `POST /api/purchases/verify` | 구현 | Apple/Google 인앱 거래 직접 검증 후 이용권 발급. `PURCHASE_MOCK=true`일 때 manual 발급 가능 |

## DB 스키마

현재 마이그레이션에 포함된 테이블:

| 테이블 | 목적 |
| --- | --- |
| `app_users` | 로그인 사용자 저장 |
| `purchase_orders` | 결제 주문/거래/상태 저장 |
| `access_passes` | 사용자별 이용권 |
| `access_pass_charges` | 이용권 차감 장부와 중복 차감 방지 |
| `usage_sessions` | 검사 1건 단위 세션 |
| `gemini_requests` | Gemini 단일 호출 로그 |
| `app_settings` | 운영 설정 key/value |

핵심 설계:

- `purchase_orders.provider`로 `app_store`, `play_store`, `manual` 등을 구분합니다.
- 특정 결제 제공자 이름을 테이블명에 넣지 않습니다.
- `access_pass_charges.charge_key`를 unique로 두어 중복 클릭/재시도에도 한 검사 1회만 차감되게 설계했습니다.
- `usage_sessions`와 `gemini_requests`에 `user_id`를 연결해 어떤 사용자의 검사인지 추적할 수 있게 했습니다.

## Gemini / MonoGPT 상태

현재 기본값:

- `GEMINI_API_BASE=https://monogpt.kr/api/monorouter/v1/gemini`
- `GEMINI_MODEL=gemini-3.5-flash-lite`
- `GEMINI_INPUT_USD_PER_MILLION=0.30`
- `GEMINI_OUTPUT_USD_PER_MILLION=2.50`
- `PASS_PRICE_KRW=627`
- `PASS_USES_PER_PURCHASE=11`
- MonoGPT 라우터 호출 형태:
  - `https://monogpt.kr/api/monorouter/v1/gemini/v1beta/models/{model}:generateContent`
- MonoGPT 라우터 사용 시 `Authorization: Bearer <GEMINI_API_KEY>` 헤더를 함께 보냅니다.
- MonoGPT 라우터에서는 Gemini native `thinkingConfig`를 제거합니다.

현재 정책:

- 개인 key가 있으면 개인 key로 호출하고 결제/이용권 대상에서 제외할 수 있습니다.
- 개인 key가 없으면 서버 공용 key로 호출합니다.
- 공용 key 전체 예산 제한은 해제했습니다.
- 대신 요청별 토큰/예상 비용 로그는 계속 저장합니다.

## 결제 / 이용권 설계

현재 상태:

- 토스인앱 Apps in Toss IAP 결제 버튼과 이용권 발급 API가 연결되어 있습니다.
- Apple/Google 결제 직접 검증도 백엔드에 보조 경로로 연결되어 있습니다.
- Apple은 `transactionId`, Google은 `productId`와 `purchaseToken`을 서버로 보내 검증합니다.
- `PURCHASE_MOCK=true`일 때만 manual provider로 테스트 이용권을 발급할 수 있습니다.
- 프론트는 현재 Toss 로그인 후 검사 접수 흐름을 갖고 있습니다.
- 이용권 조회/차감 API는 백엔드에 구현되어 있습니다.

가격 기준:

- 기본 운영 상품은 사용자 결제창 기준 `690원 / 11회권`으로 재산정했습니다.
- Toss 콘솔 공급가 기준은 `PASS_PRICE_KRW=627`입니다.
- 백엔드는 `PASS_PRICE_KRW=627`을 주문 기록의 fallback 금액으로만 사용하며, 실제 가격은 결제 provider 응답값을 우선합니다.
- 실제 사용자 결제 금액은 Toss/Apple/Google 상품 콘솔에 등록된 SKU 가격을 따릅니다.
- Toss가 공급가에 VAT를 더해 표시하는 구조라면 사용자 결제창 `690원` 목표 공급가는 `690 / 1.1 = 627.27원`입니다.
- Toss 콘솔에는 우선 `627원`으로 등록하고, 미리보기에서 최종 결제액이 `690원`으로 보이는지 확인해야 합니다.

API 비용 기준:

- 현재 모델은 MonoGPT Gemini 라우터의 `gemini-3.5-flash-lite`입니다.
- 비용 추정 기본값은 입력 `$0.30/M`, 출력 `$2.50/M`, 환율 `1400`입니다.
- `690원 / 11회권`은 총액 기준 1회당 약 `62.7원`입니다.
- VAT만 제외하면 약 `57.0원/회`, VAT와 30% 플랫폼 수수료를 모두 보수적으로 보면 약 `39.9원/회`입니다.
- 검사 1회가 Gemini 호출 1회로 끝나면 대체로 감당 가능하지만, 자동 재시도가 3회 이상 자주 발생하면 마진이 빠르게 줄어듭니다.

예정 흐름:

1. 사용자가 토스인앱에서 Apps in Toss IAP 결제를 진행합니다.
2. 프론트가 IAP SDK의 `processProductGrant`에서 `orderId`를 백엔드로 보냅니다.
3. 백엔드가 `orderId` 중복과 소유권을 확인합니다.
4. 검증 성공 시 `purchase_orders`를 승인 상태로 저장합니다.
5. 승인된 주문 기준으로 `access_passes`를 발급합니다.
6. 사용자가 검사를 실행합니다.
7. 프론트가 `/api/gemini` 응답을 파싱하고 결과 화면을 정상 렌더링합니다.
8. 최종 결과 확정 후에만 `/api/passes/consume`을 호출합니다.
9. 백엔드는 `charge_key` 중복 여부와 잔여 횟수를 확인한 뒤 1회 차감합니다.

차감하지 말아야 하는 경우:

- Gemini HTTP 실패
- MonoGPT/Gemini API 4xx/5xx
- 응답 길이 초과
- JSON 파싱 실패
- 결과 필수 필드 누락
- 결과 화면 렌더링 실패
- 1차 호출 성공 후 2차 호출 실패
- 네트워크 재시도 중복 요청

## 환경변수

운영에 필요한 주요 값:

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

- 실제 API key는 `.env`에만 두고 GitHub에 올리지 않습니다.
- `.env.example`에는 placeholder만 둡니다.
- Apple `.p8`, Google 서비스 계정 JSON, Toss mTLS 파일은 `secrets/` 아래에 두고 GitHub에 올리지 않습니다.
- 공용키 예산 제한 변수 `GEMINI_COST_LIMIT_KRW`는 현재 사용하지 않습니다.

## 배포 구성

현재 기준:

- `Dockerfile`로 프론트 빌드 후 Express 서버가 `dist`와 `/api/*`를 함께 서빙합니다.
- `docker-compose.yml`은 `app`과 `db` 두 서비스를 둡니다.
- DB는 `postgres:16-alpine`입니다.
- 로컬/서버 실행은 아래 형태입니다.

```bash
cp .env.example .env
# .env에 운영값 입력
docker compose up -d --build
curl http://127.0.0.1:8080/health
```

운영 서버에서는 추후 회사 도메인, nginx/SSL, 컨테이너 이름, volume, secret 경로를 서버 환경에 맞춰 확정해야 합니다.

## 지금까지 오류 반영 사항

- Netlify Functions 기반에서 `.netlify` 경로 오류가 나던 문제를 피하기 위해 Docker Compose 서버 기준으로 전환했습니다.
- 브라우저에서 React 전역이 없어 터지던 번들 문제를 Vite/React import 기준으로 정리했습니다.
- `gemini-2.5-flash-lite`, `gemini-3.1-flash-lite` 제한 문제를 피하기 위해 기본 모델을 `gemini-3.5-flash-lite`로 바꿨습니다.
- MonoGPT 라우터는 native Gemini URL과 다르므로 `GEMINI_API_BASE`와 endpoint 조립 로직을 분리했습니다.
- MonoGPT 라우터에서 `thinkingConfig`가 문제될 수 있어 라우터 호출 시 제거합니다.
- Gemini 호출 성공만으로 이용권을 차감하면 안 되므로 차감은 최종 결과 확정 뒤 별도 API로 분리했습니다.
- 마지막 1회권이 중간 호출에서 먼저 차감되는 문제를 막기 위해 최종 완료 후 1회 차감 원칙을 문서화했습니다.
- 중복 클릭/재시도 중복 차감은 `charge_key` unique 제약으로 막는 설계입니다.

## 다음 작업 우선순위

1. 실제 Toss 로그인 왕복 검증
2. 실제 토스인앱 sandbox IAP 결제 E2E 검증
3. 필요 시 Apple/Google 직접 검증 payload를 토스 구매 결과와 매칭
4. 결과 확정 후 차감 흐름 운영 E2E 검증
5. 운영 서버의 Docker Compose 배포 경로 확정
6. 회사 도메인/SSL/nginx 연결용 최종 인수인계 메모 작성

## 현재 검증 상태

마지막 로컬 검증:

- `find server -name '*.js' -print0 | xargs -0 -n1 node --check` 통과
- `npm run build` 통과
- `docker compose config` 통과

현재 최신 커밋 기준:

- `869af93 Use MonoGPT Gemini router`

현재 커밋 전 변경 포함:

- 전체 공용키 예산 제한 해제
- `GEMINI_COST_LIMIT_KRW` 제거
- 사용량 조회는 제한값 없이 누적 사용량만 반환
- 팀장님 공유용 본 문서 추가
- 이용권 조회/차감 API 추가
- 결제 검증 API 진입점 추가
- 프론트 잔여 이용권 조회/검사 후 차감 연결
- Apple/Google 인앱 결제 서버 검증 연결
- Apps in Toss IAP 구매/이용권 발급 연결
