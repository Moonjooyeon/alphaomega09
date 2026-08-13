# Backend Deploy

Docker Compose 기준 백엔드 배포 메모.

## 구성

- `app`: React 정적 파일 서빙 + `/api/*` 백엔드
- `db`: PostgreSQL

## API

- `GET /api/health`: 서버/DB/Gemini 환경 확인
- `GET /api/usage`: 공용 Gemini key 누적 사용량 확인
- `POST /api/gemini`: Gemini 프록시

`POST /api/gemini`은 요청 본문에 `userApiKey`가 있으면 개인 key를 쓰고, 없으면 서버 환경변수 `GEMINI_API_KEY`를 사용한다.
현재 구현은 공용 key 비용 한도와 요청 로그를 먼저 연결해둔 상태이며, 인앱 결제/이용권 차감은 다음 단계에서 켠다.

## 실행

```bash
cp .env.example .env
# .env에 POSTGRES_PASSWORD, GEMINI_API_KEY 입력
docker compose up -d --build
curl http://127.0.0.1:8080/api/health
```

## 운영 환경변수

- `POSTGRES_PASSWORD`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_COST_LIMIT_KRW`
- `USD_TO_KRW`
- `PAYMENT_PROVIDER`
- `PASS_USES_PER_PURCHASE`
- `HTTP_PORT`

## 운영 실수 방지

- 배포 서버에서는 compose 파일을 실행하지 말고 `docker compose -f <파일> up -d --build`에 설정으로 넘긴다.
- GitHub pull/push 실패를 막기 위해 서버 배포 계정의 토큰/권한을 먼저 확인한다.
- 결제 성공 후에는 반드시 이용권 목록 또는 잔여 횟수를 다시 조회한다.
- Gemini 응답이 성공이어도 프론트에서 최종 JSON 파싱에 실패하면 이용권을 차감하지 않는다.
- 한 검사에 여러 AI 호출이 있어도 최종 결과 확정 후 `charge_key` 기준으로 1회만 차감한다.
- 응답 길이 초과가 잦으면 모델/토큰/프롬프트를 먼저 줄이고, 차감 로직을 먼저 건드리지 않는다.
- 앱 번들 또는 인앱 플랫폼 업로드가 필요한 배포는 빌드 산출물 경로와 업로드 버전을 기록한다.

## 다음 단계

- 인앱 결제 승인/영수증 검증 API 연결
- 결제 성공 시 `access_passes` 발급
- 공용 key 사용 시 이용권 차감
- 로그인/세션 인증 연결
