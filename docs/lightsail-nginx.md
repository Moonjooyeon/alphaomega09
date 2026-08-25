# Lightsail Nginx Setup

AlphaOmega 운영 서버는 앱 컨테이너가 `127.0.0.1:9090`에서 뜨고, nginx가 회사 도메인의 HTTP/HTTPS 요청을 앱으로 넘기는 구조를 기준으로 둔다.

## 현재 백엔드 대상

- 앱 컨테이너 이름: `alphaomega-app`
- 앱 내부 포트: `9090`
- 호스트 바인딩: `127.0.0.1:9090`
- 공개 헬스체크: `GET /health`
- API 헬스체크: `GET /api/health`

## Host Nginx 기준

서버에서 앱을 먼저 띄운다.

```bash
cd ~/alphaomega09
docker compose --env-file .env.prod -f docker-compose.prd.yml up -d --build
curl http://127.0.0.1:9090/health
```

nginx 설정을 넣는다.

```bash
sudo cp deploy/lightsail/nginx/alphaomega.conf /etc/nginx/sites-available/alphaomega
sudo ln -sf /etc/nginx/sites-available/alphaomega /etc/nginx/sites-enabled/alphaomega
sudo nginx -t
sudo systemctl reload nginx
```

도메인 연결 확인:

```bash
curl -I http://alphaomega.ashwoodfriends.com/health
curl http://alphaomega.ashwoodfriends.com/health
```

SSL은 DNS가 서버를 보고 있는 상태에서 적용한다.

```bash
sudo certbot --nginx -d alphaomega.ashwoodfriends.com
sudo nginx -t
sudo systemctl reload nginx
curl -I https://alphaomega.ashwoodfriends.com/health
```

## Shared Docker Nginx 기준

기존 Lightsail에 `levelup_nginx` 같은 공용 nginx 컨테이너가 있고 `levelup-net`에 붙어 있다면, nginx upstream만 아래처럼 바꿔서 사용한다.

```nginx
upstream alphaomega_backend {
    server alphaomega-app:9090;
    keepalive 32;
}
```

이 경우 `docker-compose.prd.yml`의 `container_name: alphaomega-app`이 nginx DNS 이름 역할을 한다.

## 확인 포인트

- `/health`가 JSON으로 응답해야 한다.
- `/api/health`에서 `databaseConfigured`, `geminiConfigured`, `database` 상태가 보여야 한다.
- 루트 `/`는 React 앱 첫 화면이 보여야 한다.
- Apps in Toss 안에서 흰 화면이 뜨면 `/health`가 아니라 `/` 또는 앱 등록 URL이 올바른지 먼저 확인한다.
- `403 CloudFront` HTML이 앱 안에 그대로 보이면 Toss 쪽 로그인/결제 호출 URL 또는 mTLS/API base가 잘못된 경우를 먼저 본다.
