# Frontend / Backend Boundary

Alphaomega를 인앱 결제/이용권 기반 서비스로 옮길 때 프론트엔드와 백엔드가 맡아야 할 역할을 분리한 문서.

## Frontend Responsibilities

프론트엔드는 사용자가 보고 만지는 경험과 최종 결과 확정 여부를 책임진다.

- 검사 입력 폼 표시
- 개인/페어 검사 모드 선택
- 캐릭터 정보, 문항 답변, 이미지 업로드/크롭/미리보기 처리
- 개인 Gemini API key 입력 UI 제공
- 개인 key가 있으면 결제/이용권 UI 숨김
- 개인 key가 없으면 구매/잔여 이용권 UI 표시
- `/api/gemini` 호출
- Gemini 응답 JSON 파싱
- 응답 길이 초과, JSON 파싱 실패, 네트워크 실패 표시
- 최종 결과 화면 렌더링
- 결과 이미지 저장/다운로드 제공
- 최종 결과가 화면에 쓸 수 있는 상태인지 판단
- 최종 결과 확정 후에만 이용권 차감 API 호출
- 결제 성공 후 잔여 이용권 다시 조회

프론트엔드가 하지 말아야 할 일:

- 공용 `GEMINI_API_KEY` 보관
- 공용 Gemini key로 직접 Gemini 호출
- 결제 영수증을 신뢰하고 단독으로 이용권 발급
- DB에 직접 접근
- Gemini 호출 성공만 보고 이용권 차감 확정
- AI 응답 파싱 실패 상태에서 차감 요청
- 가격, 발급 횟수, 모델 비용 같은 운영값을 하드코딩

## Backend Responsibilities

백엔드는 보안, 돈, 이용권, 로그, 외부 API 호출을 책임진다.

- 공용 `GEMINI_API_KEY` 환경변수 보관
- `/api/gemini` 프록시 제공
- 개인 key 요청과 공용 key 요청 분기
- Gemini API 또는 라우터 API 호출
- Gemini 모델명, API base URL, thinking budget 관리
- 공용 key 월 사용 비용 한도 확인
- Gemini 요청/토큰/비용/에러 로그 저장
- 사용자/세션 식별
- 인앱 결제 영수증 검증
- 결제 성공 시 `purchase_orders` 저장
- 결제 성공 시 `access_passes` 발급
- 잔여 이용권 조회 API 제공
- 최종 결과 확정 후 차감 API 제공
- `charge_key` 기준 중복 차감 방지
- 실패한 검사/파싱 실패/중간 호출 실패는 차감하지 않도록 보장
- 운영 설정을 `app_settings` 또는 환경변수로 관리

백엔드가 하지 말아야 할 일:

- 프론트 UI 상태를 신뢰하고 결제 성공으로 간주
- Gemini 호출 성공만으로 이용권 차감
- 한 검사 안의 1차/2차 호출을 각각 차감
- 마지막 1회권을 중간 호출에서 먼저 차감
- 특정 결제 제공자 이름을 테이블명에 고정
- 사용자에게 보여줄 결과 화면 렌더링을 담당

## Shared Contract

프론트와 백엔드는 아래 계약을 기준으로만 연결한다.

### Auth / User Persistence

로그인이 붙으면 백엔드가 로그인 제공자의 사용자 식별자를 기준으로 `app_users`를 upsert한다.

저장 기준:

- 제공자 사용자 ID를 `login_id` 또는 별도 provider identity 값으로 저장
- 표시 이름이 있으면 `display_name`에 저장
- 최초 로그인 시 `created_at` 기록
- 매 로그인마다 `last_login_at` 갱신
- 로그인된 요청의 `user_id`를 `purchase_orders`, `access_passes`, `usage_sessions`, `gemini_requests`에 연결

주의:

- 프론트가 보여주는 사용자 이름만 믿고 결제/이용권 소유자를 결정하지 않는다.
- 결제 영수증 검증 결과와 로그인된 `user_id`를 백엔드에서 연결한다.
- 로그인 없이 개인 Gemini key만 쓰는 경우에는 결제/이용권 차감 대상이 아니므로 익명 세션으로 처리할 수 있다.

현재 토스 로그인 구현:

- 프론트는 Apps in Toss `appLogin()`으로 `authorizationCode`, `referrer`만 받는다.
- 프론트는 받은 값을 즉시 `POST /api/toss/login`으로 전달한다.
- 백엔드는 mTLS 인증서로 Toss token API와 `login-me` API를 호출한다.
- 백엔드는 Toss `userKey`를 `app_users.login_id = toss:<userKey>` 형태로 저장한다.
- 프론트는 백엔드가 발급한 서비스 세션 토큰만 저장한다.
- Toss AccessToken/RefreshToken은 프론트로 내려주지 않는다.
- `/api/me`로 저장된 세션 토큰을 복구한다.
- 로그인된 `/api/gemini` 요청은 `Authorization: Bearer <token>`을 포함한다.

### `POST /api/gemini`

프론트가 검사 생성을 요청한다.

요청:

- `contents`: Gemini contents
- `generationConfig`: Gemini generation config
- `userApiKey`: 선택값. 있으면 개인 key 사용
- `reportMode`: `solo` 또는 `pair`
- `phase`: `generate`

응답:

- Gemini 원본 응답 JSON
- `sessionId`
- `usageLimit`

주의:

- 이 API는 이용권을 차감하지 않는다.
- 이 API 성공은 “Gemini 응답 수신 성공”이지 “사용자에게 결과 제공 성공”이 아니다.
- 로그인 토큰이 있으면 백엔드는 검사 세션과 Gemini 요청 로그에 `user_id`를 연결한다.

### `GET /api/passes`

프론트가 현재 사용자의 이용권 상태를 조회한다.

응답 초안:

- 사용 가능한 이용권 목록
- 총 잔여 횟수
- 만료 예정 정보

### `POST /api/passes/consume`

프론트가 최종 결과 확정 후 1회 차감을 요청한다.

요청 초안:

- `sessionId`
- `chargeKey`
- `reportMode`

백엔드 규칙:

- `chargeKey`가 이미 있으면 중복 차감하지 않는다.
- 사용 가능한 이용권이 없으면 402 또는 403으로 거부한다.
- 차감 성공 시 `access_pass_charges`에 기록한다.
- `access_passes.used_count`를 증가시킨다.
- `used_count >= allowed_uses`가 되면 이용권을 사용 완료로 바꾼다.

### Payment Verification API

인앱 결제 완료 후 프론트가 영수증/거래 정보를 백엔드에 보낸다.

백엔드 규칙:

- 제공자 서버로 영수증을 검증한다.
- 검증 성공 시에만 `purchase_orders`를 승인 상태로 저장한다.
- 승인된 주문에 대해서만 `access_passes`를 발급한다.
- 같은 제공자 거래 ID는 한 번만 처리한다.

## Safe Report Flow

1. 프론트가 입력값과 이미지를 준비한다.
2. 프론트가 `/api/gemini`를 호출한다.
3. 백엔드가 Gemini를 호출하고 `gemini_requests`, `usage_sessions`를 기록한다.
4. 프론트가 응답 JSON을 파싱한다.
5. 프론트가 결과 화면에 필요한 구조인지 검증한다.
6. 결과 렌더링 가능하면 프론트가 결과 상태를 확정한다.
7. 개인 key 사용이면 차감 없이 종료한다.
8. 공용 key 사용이면 프론트가 `/api/passes/consume`을 호출한다.
9. 백엔드가 `chargeKey` 중복 여부와 이용권 잔여 횟수를 확인한다.
10. 백엔드가 1회 차감하고 잔여 횟수를 반환한다.

## Failure Rules

아래 상황에서는 이용권을 차감하지 않는다.

- `/api/gemini` HTTP 실패
- Gemini API 4xx/5xx 실패
- 응답 길이 초과
- JSON 파싱 실패
- 결과 필수 필드 누락
- 결과 이미지 저장/렌더링 전 앱 오류
- 1차 호출 성공 후 2차 호출 실패
- 네트워크 재시도 중복 요청

## Ownership Summary

| Area | Frontend | Backend |
| --- | --- | --- |
| 입력 UI | 담당 | 비담당 |
| 이미지 크롭/미리보기 | 담당 | 비담당 |
| 결과 렌더링 | 담당 | 비담당 |
| 결과 저장 | 담당 | 비담당 |
| 공용 Gemini key | 비담당 | 담당 |
| Gemini 프록시 | 호출만 | 담당 |
| 사용량/비용 로그 | 표시만 | 담당 |
| 결제 영수증 검증 | 제출만 | 담당 |
| 이용권 발급 | 표시만 | 담당 |
| 이용권 차감 판단 | 최종 결과 확정 후 요청 | 검증 후 처리 |
| 중복 차감 방지 | `chargeKey` 생성/전송 | `chargeKey` 저장/차단 |
| 운영 설정 | 표시만 | 담당 |
