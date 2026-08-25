# Lightsail Nginx Setup

AlphaOmega 운영 서버는 `web`과 `backend` 컨테이너를 분리해서 띄우고, 공용 Lightsail nginx가 회사 도메인의 HTTP/HTTPS 요청을 각각의 컨테이너로 넘기는 구조를 기준으로 둔다.

참고 기준:

- `https://github.com/ukdong-black/lightsail-nginx-configure/tree/af-levelup`

## 현재 백엔드 대상

- 웹 컨테이너 이름: `alphaomega-web`
- 웹 내부 포트: `80`
- 백엔드 컨테이너 이름: `alphaomega-backend`
- 백엔드 내부 포트: `9090`
- 웹 호스트 확인용 바인딩: `127.0.0.1:19090`
- 백엔드 호스트 확인용 바인딩: `127.0.0.1:19091`
- nginx upstream: `/` -> `alphaomega-web:80`, `/api/*` + `/health` -> `alphaomega-backend:9090`
- 공개 헬스체크: `GET /health`
- API 헬스체크: `GET /api/health`

## AlphaOmega 앱 배포

서버에서 앱을 먼저 띄운다.

```bash
cd ~/alphaomega09
docker compose --env-file .env.prod -f docker-compose.prd.yml up -d --build --remove-orphans
curl http://127.0.0.1:19090/health
curl http://127.0.0.1:19091/health
```

`HTTP_PORT`를 직접 지정한다면 다른 서비스와 겹치지 않게 둔다. 특별한 이유가 없으면 `.env.prod`에는 아래처럼 둔다.

```env
HTTP_PORT=19090
BACKEND_HTTP_PORT=19091
```

## Shared Docker Nginx 기준

`lightsail-nginx-configure`의 `af-levelup` 브랜치를 사용한다.

```bash
cd ~/lightsail-nginx-configure
git checkout af-levelup
git pull origin af-levelup
cd af-levelup
```

`af-levelup/nginx/default.conf`의 alphaomega 블록에서 upstream 대상이 아래처럼 되어 있어야 한다.

```nginx
location = /health {
    set $alphaomega_backend alphaomega-backend:9090;
    proxy_pass http://$alphaomega_backend;
}

location ^~ /api/ {
    set $alphaomega_backend alphaomega-backend:9090;
    proxy_pass http://$alphaomega_backend;
}

location / {
    set $alphaomega_web alphaomega-web:80;
    proxy_pass http://$alphaomega_web;
}
```

이 repo의 템플릿은 아래 파일에 있다.

- `deploy/lightsail/nginx/alphaomega.conf`

nginx 설정 변경 후:

```bash
docker compose up -d
docker logs --tail=80 levelup_nginx
```

도메인 연결 확인:

```bash
curl -I https://alphaomega.ashwoodfriends.com/health
curl https://alphaomega.ashwoodfriends.com/health
```

## Host Nginx를 쓰는 경우

공용 Docker nginx가 아니라 서버 호스트의 nginx를 직접 쓴다면 `/api/*`와 `/health`는 `127.0.0.1:19091`, 루트 앱은 `127.0.0.1:19090`으로 둔다.

```nginx
location = /health {
    proxy_pass http://127.0.0.1:19091;
}

location ^~ /api/ {
    proxy_pass http://127.0.0.1:19091;
}

location / {
    proxy_pass http://127.0.0.1:19090;
}
```

## 확인 포인트

- `/health`가 JSON으로 응답해야 한다.
- `/api/health`에서 `databaseConfigured`, `geminiConfigured`, `database` 상태가 보여야 한다.
- 루트 `/`는 React 앱 첫 화면이 보여야 한다.
- Apps in Toss 안에서 흰 화면이 뜨면 `/health`가 아니라 `/` 또는 앱 등록 URL이 올바른지 먼저 확인한다.
- `403 CloudFront` HTML이 앱 안에 그대로 보이면 Toss 쪽 로그인/결제 호출 URL 또는 mTLS/API base가 잘못된 경우를 먼저 본다.
