# Backend Architecture Notes

Alphaomega를 결제/이용권 기반 서비스로 전환할 때의 백엔드 설계 메모.

## Frontend Flow

- 사용자 입력 화면에 `PERSONAL GEMINI API KEY` 입력칸을 둔다.
- 개인 Gemini API key가 있으면 결제/이용권 UI를 숨긴다.
- 개인 Gemini API key가 없으면 결제/이용권 UI를 표시한다.
- 검사 제출 시 프론트는 항상 백엔드 `/api/gemini`로 요청한다.

## Gemini Proxy Policy

- Gemini 호출은 무조건 백엔드에서만 수행한다.
- 요청에 `userApiKey`가 있으면 해당 개인 key로 Gemini를 호출한다.
- 요청에 `userApiKey`가 없으면 DB에서 결제/이용권 상태를 확인한다.
- 결제 완료, 코드, 패스 상태를 검증한 뒤 공용 Gemini key 사용 여부를 결정한다.
- 공용 `GEMINI_API_KEY`는 백엔드 환경변수에만 저장한다.
- 프론트엔드 번들에는 공용 Gemini key를 절대 포함하지 않는다.

## Data Model Draft

### `app_users`

- 로그인 ID
- 비밀번호 해시
- 표시 이름
- 가입일
- 마지막 로그인 시간

### `paypal_orders`

- 어떤 사용자의 결제인지
- PayPal 주문 ID
- PayPal 캡처 ID
- 결제 금액
- 통화
- 결제 상태
- PayPal 결제자 이메일/이름
- PayPal 원본 응답 JSON
- 생성/결제/실패/환불 시간

### `access_passes`

- 어떤 사용자의 이용권인지
- 어떤 PayPal 결제로 발급됐는지
- 이용권 코드
- 상태: 사용 가능 / 사용 완료 / 만료 / 취소
- 사용 가능 횟수
- 사용한 횟수
- 생성/사용/만료/취소 시간

### `usage_sessions`

- 어떤 사용자의 검사인지
- 개인 key 사용인지 / 공용 key 사용인지
- 어떤 이용권을 썼는지
- 페어 검사인지 / 솔로 검사인지
- 검사 상태
- 내부 Gemini 요청 수
- 성공한 요청 수
- 시작/완료 시간

### `gemini_requests`

- 어떤 검사 세션의 호출인지
- 어떤 사용자 호출인지
- 개인 key / 공용 key 중 무엇을 썼는지
- 어떤 이용권을 썼는지
- 요청 모델 / 실제 사용 모델
- phase: 1차 판정 / 2차 서술
- 성공/실패 상태
- 토큰 수
- 예상 비용
- 에러 코드/메시지
- IP / User-Agent 해시
- 생성/완료 시간

### `app_settings`

- 설정 key
- 설정 value JSON
- 수정 시간

## Next Backend Work

- `/api/gemini` 서버 엔드포인트 설계
- 개인 Gemini key 요청과 공용 Gemini key 요청 분기
- 결제 완료 검증
- 이용권 발급 및 차감
- Gemini 요청 비용/토큰 로깅
- Toss In-App 결제 구조로 전환 시 `paypal_orders`를 Toss 결제 테이블로 교체
