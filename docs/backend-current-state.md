# Backend Current State

Alphaomega를 프론트 단독 앱에서 결제/이용권 기반 서비스로 옮기기 위한 현재 상태 정리.

## Current Direction

- 배포 기준은 Netlify Functions가 아니라 Docker Compose 기반 서버 배포다.
- 프론트는 `/api/gemini`만 호출하고, Gemini key는 백엔드 환경변수에만 둔다.
- 결제 제공자는 특정 서비스명으로 고정하지 않는다.
- Apple/Google 같은 인앱 결제 제공자는 `purchase_orders.provider` 값으로만 구분한다.
- 이용권은 결제 성공 후 발급되고, 검사 최종 결과가 완성된 뒤에만 차감한다.
- 프론트/백엔드 역할 분리는 `docs/frontend-backend-boundary.md`를 기준으로 한다.
- 토스 로그인은 먼저 연결했다. 프론트는 `appLogin()`으로 인가 코드만 받고, 백엔드는 mTLS로 토큰 교환과 사용자 조회를 처리한다.

## Runtime Layout

- `app`: React 정적 파일 서빙 + Express API 서버
- `db`: PostgreSQL
- `Dockerfile`: 프론트 빌드 후 `server/index.js` 실행
- `docker-compose.yml`: app/db 구성, `/api/*`와 정적 파일을 같은 서버에서 처리

## Progress Snapshot

완료:

- Docker Compose 기반 Express/PostgreSQL 백엔드 골격
- Gemini 서버 프록시
- 공용 Gemini key 비용 한도/요청 로그
- 토스 로그인 프론트 버튼
- Apps in Toss `appLogin()` 인가 코드 수신
- 서버 mTLS 기반 Toss 토큰 교환/사용자 조회 라우트
- `app_users` 사용자 upsert
- 서비스 세션 토큰 발급 및 `/api/me`
- 로그인된 검사 요청의 `user_id` 로그 연결
- 프론트/백엔드 역할 경계 문서화

미완료:

- 실제 토스 앱/샌드박스에서 로그인 왕복 검증
- 인앱 결제 상품 조회/구매
- 결제 영수증 또는 order 검증
- 결제 성공 후 `access_passes` 발급
- 잔여 이용권 조회 UI
- 최종 결과 확정 후 이용권 차감 API
- 운영 서버 nginx/domain/compose 파일 확정

마지막 로컬 검증:

- `npm run build` 성공
- 서버 JS 문법 체크 성공
- `docker compose config` 성공

## API Draft

- `GET /api/health`
  - 서버, DB, Gemini 환경 설정 상태 확인
- `GET /api/usage`
  - 공용 Gemini key 누적 요청/토큰/예상 비용 확인
- `POST /api/gemini`
  - Gemini 프록시
  - `userApiKey`가 있으면 개인 key 사용
  - `userApiKey`가 없으면 공용 `GEMINI_API_KEY` 사용
  - 현재는 비용 한도 확인과 요청 로그 저장까지 구현
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
- `GEMINI_COST_LIMIT_KRW`
- `GEMINI_INPUT_USD_PER_MILLION`
- `GEMINI_OUTPUT_USD_PER_MILLION`
- `USD_TO_KRW`
- `PAYMENT_PROVIDER`
- `PASS_USES_PER_PURCHASE`
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

## Lessons Baked Into The Design

- Netlify 함수 경로로 새지 않도록 프론트 기본 endpoint는 `/api/gemini`다.
- 특정 결제 제공자 이름을 테이블명에 넣지 않는다.
- Gemini 호출 성공만으로 이용권을 차감하지 않는다.
- 프론트가 최종 JSON을 정상 파싱하고 결과 화면에 반영할 수 있을 때만 차감한다.
- 한 검사에 AI 호출이 여러 번 있어도 최종 완료 기준으로 1회만 차감한다.
- 마지막 1회권은 중간 호출에서 먼저 차감하지 않는다.
- `charge_key`를 저장해 재시도/중복 클릭/네트워크 재전송의 중복 차감을 막는다.
- 모델 폐기, 신규 사용자 제한, 라우터 endpoint 차이를 대비해 `GEMINI_MODEL`과 `GEMINI_API_BASE`를 환경변수로 둔다.
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
- 인앱 결제 영수증 또는 order 검증 API 연결
- 결제 성공 시 `access_passes` 발급
- 최종 결과 확정 후 `/passes/consume` 성격의 차감 API 추가
- 프론트 구매/잔여 횟수 UI 연결
- 실제 배포 서버 compose 파일과 도메인/nginx 구성 정리
