# Backend Deploy

Docker Compose 기준 백엔드 배포 메모.

## 구성

- `app`: React 정적 파일 서빙 + `/api/*` 백엔드
- `db`: PostgreSQL

## API

- `GET /api/health`: 서버/DB/Gemini 환경 확인
- `GET /api/usage`: 공용 Gemini key 누적 사용량 확인
- `GET /api/passes`: 로그인 사용자의 이용권 목록/잔여 횟수 확인
- `POST /api/passes/consume`: 최종 결과 확정 후 이용권 1회 차감
- `POST /api/iap/grant-pass`: Apps in Toss IAP orderId 기준 이용권 발급
- `POST /api/purchases/verify`: Apple/Google 결제 검증 및 이용권 발급
- `POST /api/gemini`: Gemini 프록시
- `POST /api/toss/login`: 토스 로그인 인가 코드 교환 및 서비스 세션 발급
- `GET /api/me`: 현재 로그인 사용자 확인

`POST /api/gemini`은 요청 본문에 `userApiKey`가 있으면 개인 key를 쓰고, 없으면 서버 환경변수 `GEMINI_API_KEY`를 사용한다.
운영 `GEMINI_API_KEY`는 MonoGPT Gemini 라우터 key를 기준으로 둔다.
현재 구현은 공용 key 요청 로그, 인앱 결제 이용권 발급, 결과 확정 후 이용권 차감을 연결해둔 상태다.
전체 공용 key 예산 제한은 현재 적용하지 않는다.
로그인된 요청은 `Authorization: Bearer <token>` 헤더로 `usage_sessions`, `gemini_requests`에 `user_id`를 연결한다.

## 실행

```bash
cp .env.example .env
# .env에 POSTGRES_PASSWORD, SESSION_SECRET, GEMINI_API_KEY, Toss mTLS 경로 입력
# Apple: ./secrets/apple/AuthKey.p8
# Google: ./secrets/google/service-account.json
docker compose up -d --build
curl http://127.0.0.1:8080/api/health
```

## 운영 환경변수

- `POSTGRES_PASSWORD`
- `SESSION_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_API_BASE`
- `GEMINI_MODEL`
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
- `HTTP_PORT`

## 현재 진행 상태

- 토스 로그인 API와 프론트 로그인 버튼은 연결 완료.
- 토스 AccessToken/RefreshToken은 서버에서만 다루고 프론트로 내리지 않음.
- 로그인 성공 시 `app_users.login_id = toss:<userKey>`로 저장.
- 로그인된 검사 요청은 `usage_sessions`, `gemini_requests`에 `user_id`를 저장.
- 실제 토스 앱/샌드박스 + mTLS 인증서 환경에서의 왕복 검증은 아직 필요.
- Apps in Toss IAP 구매 UI와 이용권 발급 API는 연결 완료.
- Apple/Google 결제 직접 서버 검증은 보조 경로로 연결 완료.
- 실제 토스인앱 sandbox 결제 E2E 검증은 아직 필요.
- 이용권 조회와 결과 확정 후 차감 흐름은 연결되어 있다.
- 기본 `GEMINI_API_BASE`는 `https://monogpt.kr/api/monorouter/v1/gemini`.

## 운영 실수 방지

- 배포 서버에서는 compose 파일을 실행하지 말고 `docker compose -f <파일> up -d --build`에 설정으로 넘긴다.
- `secrets/` 아래 Apple `.p8`, Google 서비스 계정 JSON, Toss mTLS 파일은 GitHub에 올리지 않는다.
- GitHub pull/push 실패를 막기 위해 서버 배포 계정의 토큰/권한을 먼저 확인한다.
- 결제 성공 후에는 반드시 이용권 목록 또는 잔여 횟수를 다시 조회한다.
- Gemini 응답이 성공이어도 프론트에서 최종 JSON 파싱에 실패하면 이용권을 차감하지 않는다.
- 한 검사에 여러 AI 호출이 있어도 최종 결과 확정 후 `charge_key` 기준으로 1회만 차감한다.
- 응답 길이 초과가 잦으면 모델/토큰/프롬프트를 먼저 줄이고, 차감 로직을 먼저 건드리지 않는다.
- 앱 번들 또는 인앱 플랫폼 업로드가 필요한 배포는 빌드 산출물 경로와 업로드 버전을 기록한다.
- 토스 로그인 인가 코드는 프론트에 저장하지 않고 즉시 서버로 보낸다.
- Toss AccessToken/RefreshToken은 프론트로 내리지 않는다.

## 다음 단계

- 토스인앱 sandbox IAP 결제 E2E 검증
- 운영 도메인/SSL/nginx 연결
