# Incident Lessons

이 프로젝트에서 같은 실수를 반복하지 않기 위한 운영 기록.

## Deployment

- SSH `Permission denied (publickey)`가 나면 사용자명을 바꿔가며 추측하지 말고 배포 계정/키/콘솔 접근 경로를 먼저 확인한다.
- `docker-compose*.yml`은 실행 파일이 아니다. `docker compose -f docker-compose.yml up -d --build`로 실행한다.
- `git pull` 403은 서버 문제가 아니라 GitHub 권한/토큰 문제일 수 있으므로 collaborator 권한과 토큰 scope를 먼저 확인한다.
- 컨테이너 갱신 뒤에는 프론트, 백엔드, DB 컨테이너 이름과 상태를 명시적으로 확인한다.

## Payment And Passes

- 결제 제공자는 Apple, Google 등으로 바뀔 수 있으므로 DB 테이블명에 특정 제공자 이름을 박지 않는다.
- 상품 가격/최소 금액/검토 규정은 제공자마다 바뀔 수 있으므로 금액과 발급 횟수는 환경변수 또는 설정값으로 둔다.
- 결제 성공 후에는 클라이언트가 잔여 이용권을 다시 조회해야 한다.
- 이용권 차감은 Gemini 호출 성공 시점이 아니라 최종 결과 JSON 파싱과 화면 반영이 가능한 시점 뒤에만 수행한다.
- `charge_key`를 저장해 같은 검사 제출이 재시도되어도 1회만 차감한다.
- 마지막 1회권은 중간 AI 호출에서 차감하지 않는다. 전체 검사 완료 후 한 번만 차감한다.

## AI Router

- Gemini 네이티브 API와 라우터 API는 endpoint 형식이 다를 수 있다. `GEMINI_API_BASE`를 도입할 때는 호출 경로를 함께 검증한다.
- MonoGPT Gemini 라우터 key는 Google 기본 endpoint가 아니라 `https://monogpt.kr/api/monorouter/v1/gemini`를 base로 써야 한다.
- 401은 키 오입력/비활성, 403은 라우터 인증/차단, 404는 endpoint/model 불일치 가능성을 먼저 본다.
- 모델 폐기 또는 신규 사용자 제한이 생길 수 있으므로 모델명은 환경변수로 두고 서버에서 fallback을 둘 수 있게 한다.
- 응답 길이 초과는 결제 차감 문제가 아니라 프롬프트/토큰/재요청 UX 문제로 분리해 다룬다.

## Frontend UX

- 실패 원인은 사용자에게 짧고 행동 가능한 문장으로 보여준다.
- 재요청 UI에는 반복 숫자와 초 단위 카운트를 노출하지 않는다.
- 결과 저장 기능은 캡처 노동을 줄이는 핵심 기능으로 유지한다.
