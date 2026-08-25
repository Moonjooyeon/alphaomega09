# Alphaomega

알파/오메가 감별 결과지를 생성하는 React + Express + PostgreSQL 앱입니다.

현재는 프론트 단독 Gemini 호출 구조에서 벗어나, Docker Compose 기반 백엔드 서버가 Gemini/MonoGPT 호출, 로그인 사용자 저장, 이용권 조회/차감, 인앱 구매 후 이용권 발급을 맡는 구조로 옮겨둔 상태입니다.

## 현재 진도

완료된 것:

- React/Vite 프론트 화면 유지
- 개인 감별 / 페어 감별 결과지 생성 UI
- 이미지 업로드, 조정 모달, 결과 이미지 저장
- Express 백엔드 추가
- PostgreSQL 마이그레이션 추가
- Dockerfile / `docker-compose.yml` 추가
- Docker Compose 컨테이너 `web` / `backend` 분리
- `/api/health` 서버 상태 확인
- `/health` 공개 서버 상태 확인
- `/api/gemini` 서버 프록시
- MonoGPT Gemini 라우터 기본 설정
- Gemini 요청별 로그, 토큰, 예상 비용 저장
- audit log 테이블 및 주요 백엔드 이벤트 기록
- 전체 공용 API key 예산 제한 해제
- Toss 로그인 `appLogin()` 연동
- Toss 로그인 사용자를 `app_users`에 저장
- 로그인 사용자의 검사 요청을 `usage_sessions`, `gemini_requests`에 연결
- `GET /api/passes` 잔여 이용권 조회
- `POST /api/passes/consume` 최종 결과 확정 후 1회 차감
- `chargeKey` 기반 중복 차감 방지
- Apps in Toss IAP 구매 버튼
- `POST /api/iap/grant-pass` Apps in Toss IAP 이용권 11회 발급
- Apple/Google 인앱 결제 직접 검증 보조 경로
- `POST /api/purchases/verify` 결제 검증 API
- `GET /api/audit/recent` 운영 확인용 audit log 조회
- 테스트 모드에서 mock 이용권 발급
- 프론트/백엔드 역할 분리 문서화
- 지금까지 겪은 배포/결제/이용권 오류 반영 문서화

남은 것:

- 실제 Toss 앱/샌드박스에서 로그인 왕복 검증
- 실제 토스인앱 sandbox IAP 결제 E2E 검증
- 운영 서버에서 Docker Compose 배포
- 회사 도메인 DNS 연결
- nginx/SSL 구성
- Lightsail shared nginx 백엔드 프록시 설정 템플릿
- 운영 `.env` 실제 값 주입
- 운영 DB에서 사용자/검사/이용권 로그 저장 확인

## 실행

```bash
cp .env.example .env
# .env에 운영 또는 로컬 테스트 값을 입력
docker compose up -d --build
curl http://127.0.0.1:8080/health
```

로컬 프론트 개발 서버만 볼 때:

```bash
npm run dev
```

빌드 확인:

```bash
npm run build
```

Apps in Toss 업로드용 AIT 생성:

```bash
npm run build:ait
# 프로젝트 루트에 aoreport.ait 생성
```

## 주요 환경변수

서버 운영에 필요한 핵심 값:

- `POSTGRES_PASSWORD`
- `SESSION_SECRET`
- `AUDIT_LOG_TOKEN`
- `GEMINI_API_KEY`
- `GEMINI_API_BASE`
- `GEMINI_MODEL`
- `GEMINI_INPUT_USD_PER_MILLION`
- `GEMINI_OUTPUT_USD_PER_MILLION`
- `USD_TO_KRW`
- `PASS_PRICE_KRW`
- `PASS_USES_PER_PURCHASE`
- `PURCHASE_MOCK`
- `TOSS_API_BASE`
- `TOSS_MTLS_CERT_PATH`
- `TOSS_MTLS_KEY_PATH`
- `TOSS_MTLS_KEY_PASSWORD`
- `APPLE_ENV`
- `APPLE_BUNDLE_ID`
- `APPLE_ISSUER_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY_PATH`
- `APPLE_PRODUCT_IDS`
- `GOOGLE_PACKAGE_NAME`
- `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`
- `GOOGLE_PRODUCT_IDS`
- `VITE_TOSS_IAP_SKU`
- `VITE_PURCHASE_MOCK`

주의:

- 실제 API key와 인증서는 GitHub에 올리지 않습니다.
- `secrets/`는 git ignore 처리되어 있습니다.
- 운영 Gemini key는 MonoGPT의 Gemini 라우터 key를 기준으로 둡니다.
- 공용 key 전체 예산 제한 변수는 현재 사용하지 않습니다.
- 운영 이용권은 Toss 공급가 fallback `PASS_PRICE_KRW=627`, `PASS_USES_PER_PURCHASE=11` 기준입니다. 서버 `.env.prod`에도 같은 값을 넣어야 합니다.
- 가격은 백엔드가 강제하지 않고, 실제 결제 금액은 Toss/Apple/Google 상품 콘솔의 SKU 가격을 따릅니다.
- Toss 결제창에서 사용자에게 `690원`으로 보이게 하려면 공급가를 `690 / 1.1 = 627.27원` 기준으로 역산합니다.
- Toss 콘솔에는 우선 `627원`으로 등록하고, 콘솔 미리보기에서 최종 결제액이 `690원`으로 보이는지 확인합니다.
- Toss mTLS 인증서 경로는 alpha 기준으로 `alpha_public.crt`, `alpha_private.key`를 사용합니다.
- 운영 호스트 확인용 포트는 기본 `HTTP_PORT=19090`, `BACKEND_HTTP_PORT=19091`입니다.
- 공용 nginx는 `levelup-net`의 `alphaomega-web:80`, `alphaomega-backend:9090`으로 붙습니다.

## 구성

프론트:

- `src/main.jsx`: React 엔트리
- `src/report/GonadalReport.jsx`: 검사 입력, Toss 로그인, IAP 구매, Gemini 요청, 결과 렌더링
- `src/report/config.js`: API endpoint, 모델/SDK 설정, 문항/선택지
- `src/report/styles.js`: 화면 스타일

백엔드:

- `server/index.js`: Express 앱, API 라우팅, 정적 파일 서빙
- `server/config.js`: 환경변수 설정
- `server/db.js`: PostgreSQL 연결 및 마이그레이션
- `server/routes/gemini.js`: Gemini/MonoGPT 프록시
- `server/routes/auth.js`: Toss 로그인, 현재 사용자 조회
- `server/routes/passes.js`: 이용권 조회/차감
- `server/routes/iap.js`: Apps in Toss IAP 이용권 발급
- `server/routes/purchases.js`: Apple/Google 결제 검증
- `server/routes/audit.js`: 운영 확인용 audit log 조회
- `server/services/passes.js`: 이용권 차감과 중복 차감 방지
- `server/services/purchases.js`: 구매 승인/이용권 발급 공통 로직
- `server/services/audit.js`: 로그인, 결제, 이용권, AI 호출 이벤트 기록

컨테이너:

- `alphaomega-web`: React 정적 파일 nginx 서빙
- `alphaomega-backend`: Express API, Gemini 프록시, 로그인/결제/이용권 처리

## API

| API | 설명 |
| --- | --- |
| `GET /health` | 외부 도메인/로드밸런서 확인용 공개 헬스체크 |
| `GET /api/health` | 서버, DB, Gemini 설정 상태 확인 |
| `POST /api/toss/login` | Toss 로그인 인가 코드 교환 및 서비스 세션 발급 |
| `GET /api/me` | 현재 로그인 사용자 확인 |
| `POST /api/gemini` | Gemini/MonoGPT 서버 프록시 |
| `GET /api/usage` | 공용 key 누적 사용량/예상 비용 조회 |
| `GET /api/audit/recent` | `AUDIT_LOG_TOKEN`으로 보호되는 최근 audit log 조회 |
| `GET /api/passes` | 로그인 사용자의 잔여 이용권 조회 |
| `POST /api/passes/consume` | 최종 결과 확정 후 이용권 1회 차감 |
| `POST /api/iap/grant-pass` | Apps in Toss IAP `orderId` 기준 11회권 발급 |
| `POST /api/purchases/verify` | Apple/Google 인앱 거래 검증 후 이용권 발급 |

## 운영 인수인계 기준

개발 쪽에서 현재 준비한 것:

- 프론트/백엔드/DB 분리
- Docker Compose 서버 구동 기준
- 로그인 사용자 저장
- Gemini 프록시
- Apps in Toss IAP 구매 후 이용권 발급 API
- 결과 확정 후 이용권 차감 API
- 결제/이용권/검사 로그 DB 구조
- 로그인/결제/이용권/AI 호출 audit log 구조

운영에서 붙이면 되는 것:

- 회사 도메인 DNS
- nginx/SSL
- 서버 `.env` 운영값
- `AUDIT_LOG_TOKEN` 운영값
- Toss/Apple/Google 콘솔의 실제 앱 설정
- 토스 앱 안에서 최종 로그인/구매/검사 E2E 확인

## 참고 문서

- `docs/team-brief.md`: 팀장님 공유용 전체 진행 요약
- `docs/backend-current-state.md`: 백엔드 현재 상태
- `docs/backend-deploy.md`: 배포 메모
- `docs/lightsail-nginx.md`: Lightsail nginx 연결 순서
- `docs/frontend-backend-boundary.md`: 프론트/백엔드 역할 분리
- `docs/database-schema.md`: DB 테이블과 스키마 정리
- `docs/incident-lessons.md`: 지금까지 겪은 오류와 재발 방지 기준
- `docs/backend-architecture.md`: 백엔드 구조 설계

## Audit Log

주요 백엔드 이벤트는 `audit_logs`에 요약 저장합니다.

- `toss_login`
- `iap_pass_granted`
- `purchase_verified`
- `pass_consumed`
- `gemini_request`
- `gemini_usage_recorded`

조회:

```bash
curl -H "x-audit-token: $AUDIT_LOG_TOKEN" "https://alphaomega.ashwoodfriends.com/api/audit/recent?limit=50"
```

토큰, API key, 인가 코드, 원문 결제 응답은 audit metadata에 그대로 저장하지 않습니다.
