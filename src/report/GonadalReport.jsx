import React, { useEffect, useState, useRef } from "react";
import { appLogin, IAP } from "@apps-in-toss/web-framework";
import { ASSETS } from "./assets.js";
import { CSS } from "./styles.js";
import {
  API_BASE_ENDPOINT,
  GEMINI_PROXY_ENDPOINT,
  GRADE_OPTS,
  GRADES,
  IMG_MODES,
  IMPRINT_OPTS,
  LOADING,
  MODES,
  PURCHASE_MOCK,
  QUESTIONS,
  ROLE_OPTS,
  SITES,
  TOSS_IAP_SKU,
  SOLO_QUESTIONS,
  TOSS_LOGIN_MOCK,
} from "./config.js";
import {
  DEF_ADJ,
  caseNo,
  describeApiError,
  imageFileToInlineData,
  imageTransform,
  isLocalPreview,
  josa,
  pairCycleLabels,
} from "./helpers.js";
import { localMockReport } from "./mockReport.js";

/* ─────────────────────────────────────────────
   성선의학연구소 — 개체 감별 및 교차반응 검사
   ───────────────────────────────────────────── */

const AUTH_TOKEN_STORAGE = "ao_auth_token";

function makeChargeKey() {
  try {
    if (crypto?.randomUUID) return `charge_${crypto.randomUUID()}`;
  } catch {}
  return `charge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function pickTossPassProduct(products = []) {
  if (TOSS_IAP_SKU) {
    return products.find((product) => product.sku === TOSS_IAP_SKU) || { sku: TOSS_IAP_SKU };
  }
  const text = (product) => `${product.displayName || ""} ${product.description || ""} ${product.sku || ""}`;
  const consumables = products.filter((product) => product.type === "CONSUMABLE");
  return (
    consumables.find((product) => /5|검사|이용권|pass/i.test(text(product))) ||
    consumables[0] ||
    products.find((product) => /5|검사|이용권|pass/i.test(text(product))) ||
    products[0]
  );
}

function readStoredToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE) || "";
  } catch {
    return "";
  }
}

function saveStoredToken(token) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_STORAGE, token);
    else localStorage.removeItem(AUTH_TOKEN_STORAGE);
  } catch {}
}

async function apiFetch(path, { token = "", ...options } = {}) {
  const res = await fetch(`${API_BASE_ENDPOINT}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: { message: text || `HTTP ${res.status}` } };
  }
  if (!res.ok) {
    throw new Error(body?.error?.message || body?.detail || `HTTP ${res.status}`);
  }
  return body;
}

function Adjustable({ src, adj, onChange, onPick, onEdit, height, placeholder, wide }) {
  return (
    <div className={wide ? "gm-adj gm-adj-wide" : "gm-adj"}>
      <div
        className="gm-adj-view"
        style={{ height }}
        onClick={() => { src ? onEdit?.() : onPick(); }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              transform: imageTransform(adj),
            }}
          />
        ) : (
          <span>{placeholder}</span>
        )}
        {src && <i className="gm-adj-tip">클릭하여 크게 조정</i>}
      </div>
      {src && (
        <div className="gm-adj-ctl">
          <button onClick={onEdit}>조정</button>
          <button onClick={onPick}>교체</button>
        </div>
      )}
    </div>
  );
}

function ImageCropModal({ crop, onChange, onCancel, onApply }) {
  const box = useRef(null);
  const drag = useRef(null);
  if (!crop) return null;

  const down = (e) => {
    e.preventDefault();
    drag.current = { px: e.clientX, py: e.clientY, x: crop.adj.x, y: crop.adj.y };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const move = (e) => {
    const d = drag.current;
    if (!d || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const sensitivity = 100 / Math.max(1, crop.adj.scale);
    const x = Math.min(100, Math.max(0, d.x + ((e.clientX - d.px) / r.width) * sensitivity));
    const y = Math.min(100, Math.max(0, d.y + ((e.clientY - d.py) / r.height) * sensitivity));
    onChange({ ...crop, adj: { ...crop.adj, x, y } });
  };
  const up = () => { drag.current = null; };

  return (
    <div className="gm-crop-backdrop" role="dialog" aria-modal="true">
      <div className="gm-crop-modal">
        <div className="gm-crop-head">
          <b>{crop.title || "이미지 조정"}</b>
          <button onClick={onCancel} aria-label="닫기">×</button>
        </div>
        <div
          className="gm-crop-stage"
          ref={box}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <img
            src={`data:${crop.mime};base64,${crop.img}`}
            alt=""
            draggable={false}
            style={{ transform: imageTransform(crop.adj) }}
          />
          <div className="gm-crop-mask" />
        </div>
        <div className="gm-crop-ctl">
          <span>확대</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={crop.adj.scale}
            onChange={(e) => onChange({ ...crop, adj: { ...crop.adj, scale: Number(e.target.value) } })}
          />
          <button className="gm-again" onClick={() => onChange({ ...crop, adj: { ...DEF_ADJ } })}>초기화</button>
        </div>
        <div className="gm-crop-actions">
          <button onClick={onCancel}>취소</button>
          <button data-primary="1" onClick={onApply}>적용</button>
        </div>
      </div>
    </div>
  );
}

function Codename({ data }) {
  const r = data.rarity || {};
  const pct = r.total && r.count ? ((r.count / r.total) * 100).toFixed(3) : null;
  if (!data.codename && !pct) return null;
  return (
    <div className="gm-codename">
      <div>
        <span>분류 명칭</span>
        <b className="gm-serif">{data.codename}</b>
      </div>
      {pct && (
        <div className="gm-rarity">
          <span>희소도</span>
          <b>
            누적 {Number(r.total).toLocaleString()}건 중 {Number(r.count).toLocaleString()}건
          </b>
          <em>상위 {pct}%</em>
        </div>
      )}
    </div>
  );
}

function Closing({ data }) {
  const [copied, setCopied] = useState(false);
  if (!data.warning && !data.oneline) return null;
  return (
    <div className="gm-closing">
      {data.warning && (
        <p className="gm-warning">
          <b>경고</b>
          {data.warning}
        </p>
      )}
      {data.oneline && (
        <div className="gm-oneline">
          <p className="gm-serif">{data.oneline}</p>
          <button
            onClick={() => {
              try {
                navigator.clipboard.writeText(data.oneline);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              } catch {}
            }}
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
      )}
    </div>
  );
}

function Gauge({ value, label, tone }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const R = 45;
  const C = 2 * Math.PI * R;
  return (
    <div className="gm-gauge">
      <svg viewBox="0 0 106 106">
        <circle cx="53" cy="53" r={R} fill="none" stroke="var(--grid)" strokeWidth="1.2" />
        <circle
          cx="53"
          cy="53"
          r={R}
          fill="none"
          stroke={tone === "seal" ? "var(--seal)" : "var(--assay)"}
          strokeWidth="3.5"
          strokeDasharray={`${(C * v) / 100} ${C}`}
          transform="rotate(-90 53 53)"
        />
      </svg>
      <div className="gm-gauge-c">
        <b>{v}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function GonadalReport() {
  const [subj, setSubj] = useState([
    { name: "", line: "", img: null, mime: "", role: "자동", grade: "자동", adj: { ...DEF_ADJ } },
    { name: "", line: "", img: null, mime: "", role: "자동", grade: "자동", adj: { ...DEF_ADJ } },
  ]);
  const [ans, setAns] = useState({});
  const [mode, setMode] = useState("페어 감별");
  const [imgMode, setImgMode] = useState("개별");
  const [pair, setPair] = useState({ img: null, mime: "", adj: { ...DEF_ADJ } });
  const [stage, setStage] = useState("input");
  const [step, setStep] = useState(0);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [reject, setReject] = useState("");
  const [authToken, setAuthToken] = useState(readStoredToken);
  const [authUser, setAuthUser] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [passInfo, setPassInfo] = useState(null);
  const [passBusy, setPassBusy] = useState(false);
  const [passErr, setPassErr] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [crop, setCrop] = useState(null);
  const [no] = useState(caseNo);
  const sheetRef = useRef(null);
  const files = [useRef(null), useRef(null)];
  const pairFile = useRef(null);
  const solo = mode === "개인 감별";
  const reportRole = data?.subject?.role || subj[0]?.role;
  const reportIsAlpha = reportRole === "알파";
  const isAuthenticated = Boolean(authToken && authUser);
  const remainingUses = Number(passInfo?.totalRemainingUses || 0);

  useEffect(() => {
    if (!authToken) {
      setAuthUser(null);
      return;
    }
    let ignore = false;
    apiFetch("/me", { token: authToken })
      .then((body) => {
        if (!ignore) setAuthUser(body.user || null);
      })
      .catch(() => {
        if (ignore) return;
        setAuthToken("");
        saveStoredToken("");
        setAuthUser(null);
      });
    return () => {
      ignore = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPassInfo(null);
      setPassErr("");
      return;
    }
    refreshPasses(authToken);
  }, [authToken, authUser?.id]);

  async function refreshPasses(token = authToken) {
    if (!token) {
      setPassInfo(null);
      return null;
    }
    setPassBusy(true);
    try {
      const body = await apiFetch("/passes", { token });
      setPassInfo(body);
      setPassErr("");
      return body;
    } catch (error) {
      setPassErr(error?.message || "이용권을 조회하지 못했습니다.");
      return null;
    } finally {
      setPassBusy(false);
    }
  }

  async function issueMockPass() {
    if (!authToken) return;
    setErr("");
    setPassBusy(true);
    try {
      await apiFetch("/purchases/verify", {
        token: authToken,
        method: "POST",
        body: JSON.stringify({
          provider: "manual",
          providerOrderId: makeChargeKey().replace("charge_", "manual_order_"),
          providerTransactionId: makeChargeKey().replace("charge_", "manual_tx_"),
          productId: "local_test_pass",
          amountKrw: 0,
          rawResponse: { source: "frontend_mock" },
        }),
      });
      await refreshPasses(authToken);
    } catch (error) {
      setErr(`테스트 이용권 발급에 실패했습니다 — ${error?.message || "서버 설정을 확인해 주십시오."}`);
    } finally {
      setPassBusy(false);
    }
  }

  async function buyTossPass() {
    if (!authToken) {
      setErr("토스 로그인 후 이용권을 구매할 수 있습니다.");
      return;
    }
    setErr("");
    setPaymentBusy(true);
    try {
      const productList = await IAP.getProductItemList();
      const product = pickTossPassProduct(productList?.products || []);
      if (!product?.sku) {
        throw new Error("구매 가능한 이용권 상품을 찾지 못했습니다.");
      }
      await new Promise((resolve, reject) => {
        let cleanup = () => {};
        cleanup = IAP.createOneTimePurchaseOrder({
          options: {
            sku: product.sku,
            processProductGrant: async ({ orderId }) => {
              const data = await apiFetch("/iap/grant-pass", {
                token: authToken,
                method: "POST",
                body: JSON.stringify({
                  orderId,
                  sku: product.sku,
                  displayName: product.displayName || "Alphaomega 검사 이용권",
                  displayAmount: product.displayAmount || "",
                  amount: product.amount || null,
                }),
              });
              setPassInfo((prev) => ({
                passes: [data.pass, ...((prev?.passes || []).filter((pass) => pass.id !== data.pass.id))],
                totalRemainingUses:
                  Number(data.pass?.remainingUses || 0) +
                  (prev?.passes || [])
                    .filter((pass) => pass.id !== data.pass.id)
                    .reduce((sum, pass) => sum + Number(pass.remainingUses || 0), 0),
              }));
              return true;
            },
          },
          onEvent: (event) => {
            if (event.type === "success") {
              cleanup();
              resolve(event.data);
            }
          },
          onError: (error) => {
            cleanup();
            reject(error);
          },
        });
      });
      await refreshPasses(authToken);
    } catch (error) {
      setErr(`인앱 결제 처리에 실패했습니다 — ${error?.message || "토스 앱 안에서 다시 시도해 주십시오."}`);
    } finally {
      setPaymentBusy(false);
    }
  }

  async function submitTossLogin() {
    setErr("");
    setAuthBusy(true);
    try {
      const loginPayload = TOSS_LOGIN_MOCK
        ? { authorizationCode: "mock", referrer: "LOCAL", mockUserKey: "local-dev-user" }
        : await appLogin();
      const body = await apiFetch("/toss/login", {
        method: "POST",
        body: JSON.stringify({
          authorizationCode: loginPayload.authorizationCode,
          referrer: loginPayload.referrer,
          mockUserKey: loginPayload.mockUserKey,
        }),
      });
      setAuthToken(body.token);
      saveStoredToken(body.token);
      setAuthUser(body.user || null);
      refreshPasses(body.token);
    } catch (error) {
      setErr(`토스 로그인에 실패했습니다 — ${error?.message || "토스 앱 안에서 다시 시도해 주십시오."}`);
    } finally {
      setAuthBusy(false);
    }
  }

  function logout() {
    setAuthToken("");
    saveStoredToken("");
    setAuthUser(null);
    setPassInfo(null);
    setPassErr("");
  }

  const set = (i, k, v) =>
    setSubj((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const openCrop = (target, payload) => {
    setCrop({
      target,
      img: payload.img,
      mime: payload.mime,
      adj: { ...(payload.adj || DEF_ADJ) },
      title: payload.title || "이미지 조정",
    });
  };

  const applyCrop = () => {
    if (!crop) return;
    if (crop.target.kind === "pair") {
      setPair((prev) => ({ ...prev, img: crop.img, mime: crop.mime, adj: crop.adj }));
    } else {
      setSubj((prev) =>
        prev.map((x, j) =>
          j === crop.target.index ? { ...x, img: crop.img, mime: crop.mime, adj: crop.adj } : x
        )
      );
    }
    setCrop(null);
  };

  const saveReportImage = async () => {
    const el = sheetRef.current;
    if (!el) return;
    try {
      const width = Math.ceil(el.scrollWidth);
      const height = Math.ceil(el.scrollHeight);
      const clone = el.cloneNode(true);
      clone.querySelectorAll(".gm-actions").forEach((node) => node.remove());
      const markup = `
        <div xmlns="http://www.w3.org/1999/xhtml" class="gm" style="padding:0;background:transparent;min-height:auto;width:${width}px;">
          <style>${CSS}</style>
          ${clone.outerHTML}
        </div>
      `;
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <foreignObject width="100%" height="100%">${markup}</foreignObject>
        </svg>
      `;
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        const ctx = canvas.getContext("2d");
        ctx.scale(ratio, ratio);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const a = document.createElement("a");
        a.download = `${no}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setErr("결과 이미지를 저장하지 못했습니다. 다시 시도해 주십시오.");
      };
      img.src = url;
    } catch {
      setErr("결과 이미지를 저장하지 못했습니다. 다시 시도해 주십시오.");
    }
  };

  const pick = async (i, f) => {
    if (!f) return;
    try {
      const img = await imageFileToInlineData(f);
      openCrop(
        { kind: "subject", index: i },
        { img: img.data, mime: img.mime, adj: { ...DEF_ADJ }, title: solo ? "대상 이미지 조정" : `대상 ${i === 0 ? "A" : "B"} 이미지 조정` }
      );
    } catch {
      setErr("이미지를 읽지 못했습니다. 다른 파일로 다시 선택해 주십시오.");
    }
  };

  const missing = [];
  subj.slice(0, solo ? 1 : 2).forEach((s, i) => {
    const tag = solo ? "대상" : `대상 ${i === 0 ? "A" : "B"}`;
    if (!s.name.trim()) missing.push(`${tag} 이름`);
    if (!s.line.trim()) missing.push(`${tag} 한 줄`);
  });

  const pickPair = async (f) => {
    if (!f) return;
    try {
      const img = await imageFileToInlineData(f);
      openCrop(
        { kind: "pair" },
        { img: img.data, mime: img.mime, adj: { ...DEF_ADJ }, title: "페어 이미지 조정" }
      );
    } catch {
      setErr("이미지를 읽지 못했습니다. 다른 파일로 다시 선택해 주십시오.");
    }
  };

  const nm = (i, d) => subj[i].name.trim() || d;
  const label = (t) =>
    t
      .replace("개체 A", nm(0, "개체 A"))
      .replace("개체 B", nm(1, "개체 B"))
      .replace("A→B", `${nm(0, "A")} → ${nm(1, "B")}`)
      .replace("B→A", `${nm(1, "B")} → ${nm(0, "A")}`);

  async function run() {
    if (missing.length) {
      setErr(`미기재 항목이 있습니다 — ${missing.join(" · ")}`);
      return;
    }
    if (!isAuthenticated) {
      setErr("토스 로그인 후 검사를 접수할 수 있습니다.");
      return;
    }
    const passes = await refreshPasses(authToken);
    if (!passes || Number(passes.totalRemainingUses || 0) < 1) {
      setErr(PURCHASE_MOCK ? "사용 가능한 이용권이 없습니다. 테스트 이용권을 먼저 발급해 주십시오." : "사용 가능한 이용권이 없습니다.");
      return;
    }
    setStage("running");
    setStep(0);
    setErr("");
    setReject("");
    const tick = setInterval(() => setStep((s) => (s + 1) % LOADING.length), 2600);

    const prompt = `당신은 성선의학연구소의 감별 담당 임상병리사다. 제출된 두 개체의 프로필과 이미지를 근거로 등급 감별·교차반응·각인 부위 검사 결과 보고서를 작성한다.

[고정 운영 절차]
출력 전 내부적으로만 다음 순서를 수행하고, 이 절차나 추론 과정은 절대 출력하지 않는다.
1. 입력 증거표 작성: 각 대상별 한 줄 설명, 지정 판정, 지정 등급, 문진 응답, 이미지 단서를 분리한다.
2. 판정 초안 작성: role, grade, confidence, pheromone, cross_reaction/imprint 또는 traits/imprint_history를 먼저 채운다.
3. 일관성 감사: 지정값 우선, role과 grade 독립성, 동일 극단 등급 금지, 감정 문항과 각인 안정도, 향 계열과 scent_sync, 부위 코드 제약을 서로 대조한다.
4. 문체 감사: 모든 서술을 검사소 임상 기록처럼 고친다. 판정 방법, 입력 부족, 이미지 여부, 모델/프롬프트/JSON 같은 메타 설명은 제거한다.
5. JSON 감사: 최상위 키와 중첩 키를 출력 스키마와 맞추고, 누락 필드는 빈 문자열/0/빈 배열이 아니라 의미 있는 최소값으로 채운다.

[품질 기준]
- 싸고 빠른 모델이라도 최종 결과는 고가 모델의 세밀함처럼 보여야 한다. 단정은 수치로 제한하고, 서술은 짧지만 원인과 결과가 맞물리게 쓴다.
- 흔한 일반론을 피한다. "강한 끌림", "묘한 분위기", "서로에게 반응" 같은 빈 표현 대신, 제출 문구나 이미지에서 읽힌 행동 단서와 향의 물성으로 쓴다.
- 결과지의 재미는 codename, scent_code, counterfactual, warning, examiner_note에 집중한다. 나머지는 절제된 기록체를 유지한다.
- 모순이 있으면 지정값과 문진 응답을 우선하고, 이미지 단서는 보조 근거로만 쓴다.
- 모든 숫자는 서로 맞아야 한다. compatibility, scent_sync, stability, metrics는 같은 이야기 안에서 같은 방향을 가리켜야 한다.
- 한국어 문장은 짧게 쓴다. 한 문장에 판단을 두 개 이상 겹치지 않는다.

[Flash-Lite 보정 규칙]
- 가벼운 모델일수록 일반론으로 도망가므로, 모든 긴 서술 필드는 반드시 "트리거 → 겉으로 보이는 반응 → 숨긴 욕구/후유증"의 3단계를 내부적으로 만든 뒤 1~2문장으로 압축한다.
- 각 대상은 서로 다른 결핍과 방어 방식을 가져야 한다. 둘 다 같은 말투, 같은 향, 같은 반응을 보이면 실패다.
- 페어 결과는 A와 B를 따로 판정한 뒤 마지막에 관계성을 합친다. 처음부터 알파×오메가 구도로 몰지 마라.
- 같은 판정 페어는 오히려 더 오타쿠적으로 쓴다. 알파×알파는 주도권 충돌, 발신향 경쟁, 먼저 물러나는 척하는 쪽을 드러낸다. 오메가×오메가는 안정 구역 침범, 둥지 형성/거부/실패의 차이, 서로의 물건을 숨기는 반응을 드러낸다.
- 단일 개체 결과는 "이 캐릭터를 굴릴 때 바로 써먹을 설정 카드"처럼 보여야 한다. 주기, 전조, 억제제, 파트너 유무, 혼자 버티는 방식이 서로 이어져야 한다.
- 관능성은 노골적 행위가 아니라 억제 실패 직전의 미세한 행동으로 만든다. 목소리 저하, 숨 멎음, 손목을 잡기 전 정지, 옷깃에 남은 향, 문밖에서 버티는 동선, 발끝 도발을 우선한다.
- 유사어 반복을 피한다. 같은 결과 안에서 "향", "반응", "무너진다", "버틴다"를 과용하지 말고 구체적 사물과 행동으로 바꾼다.
- 결과는 팬이 캡처해 저장하고 싶을 정도로 선명해야 하지만, 검사소 문체를 깨뜨리면 안 된다.

[분류 체계] 축이 두 개다. 반드시 둘 다 판정한다.
- 판정(role): 알파 / 오메가
- 등급(grade): 극우성 / 우성 / 열성 / 극열성. 같은 판정 안에서의 발현 강도이며 판정과 독립이다.
  "극우성 알파" "열성 알파" "우성 오메가" "극열성 오메가" 조합이 모두 성립한다.
  열성 알파는 지배 신호가 약한 알파이지 오메가가 아니다. 우성 오메가는 감응 통제력이 높은 오메가다.

[판정 원칙]
1. 모든 판정에는 근거가 있어야 한다. 근거란에는 제출된 프로필의 표현을 짧게 그대로 인용한다. 인용할 만한 문장이 없으면 등급을 낮은 신뢰도로 부여한다.
2. 기본 등급은 우성 또는 열성이다. 극우성·극열성은 명확한 근거가 있을 때만 부여하며, 두 개체를 동시에 극단 등급으로 판정하지 않는다. 부득이한 경우 신뢰도를 70 미만으로 낮춘다. 판정(알파/오메가)은 페어를 알파×오메가로 고정하지 마라. 자동 판정일수록 두 사람을 따로 판정한 뒤 조합하라. 둘 다 발신·장악형이면 알파×알파, 둘 다 감응·수용형이면 오메가×오메가로 판정한다. 알파×알파, 오메가×오메가도 근거가 있으면 그대로 판정한다.
3. 성별·외형의 남성성/여성성으로 판정이나 등급을 결정하지 마라. 판정은 (a)신호를 발신하는가 감응하는가 (b)공간의 주도권을 쥐는 방식으로 가른다. 등급은 (c)통제 상실 상황의 대처 (d)자기 상태의 노출/은폐 경향 (e)관계에서 거리를 정하는 주체로 가른다.
4. 페로몬은 향수처럼 기술한다. 계열은 시트러스/플로럴/구르망/머스크/스파이시/우디/스모키/아쿠아틱 중 하나이며, 원형 배열이라 인접할수록 동조율이 높고 대극이면 낮다. 강도 차 3 이상이면 동조율 15%p 차감.
   각 개체마다 top(첫인상, 스치듯 맡는 향), heart(체온에 데워졌을 때 올라오는 향), base(옷과 침구에 남는 잔향)를 각각 다른 구체적 사물로 적는다. 추상어 대신 만질 수 있는 것으로 쓴다("따뜻한 향" 금지, "식은 커피와 젖은 모직" 가능).
   trigger에는 이 향이 언제 짙어지는지 한 문장으로 적는다(예: 잠들기 직전, 거짓말할 때, 상대가 시야에서 사라졌을 때).
   diffusion은 확산 범위를 "밀착 시에만/한 팔 거리/방 하나" 중 하나로 적는다.
5. 각인은 방향 → 부위 → 정착도 순으로 판정한다. 방향은 from(새긴 쪽 이름)과 to(새겨진 쪽 이름)로 적되 반드시 제출된 이름을 그대로 쓴다. 미형성이면 from과 to를 빈 문자열로 둔다. 방향은 알파 → 오메가가 표준이다. 판정이 같은 페어(알파×알파, 오메가×오메가)는 등급이 높은 쪽에서 낮은 쪽으로 향하며, 등급까지 같으면 상호 또는 미형성이다. 극우성 알파 × 극우성 알파는 미형성. 부위는 다음 코드 중 하나만: NP(후경부) CL(쇄골 하연) WR(손목 안쪽) SC(견갑골 사이) ME(유양돌기) TH(좌흉부) RB(늑골 하연) AN(내과부) PL(수장부) HL(후두 발제부). NP는 향 동조율 65% 이상에서만 안정하며, 미만이면 비표준 부위로 밀린다. 은폐 성향이면 CL/SC/AN, 불안이 높으면 WR/TH, 경계가 강하면 ME/RB. 정착도는 미형성/표층/부분/완전/중복 중 하나이며 중복은 재회 이력이 있을 때만.
6. 문체는 임상 기록이다. 감정어 없이 관찰된 사실과 수치로 기술한다. 각인 행위나 신체 접촉을 묘사하지 말고 이미 형성된 상태만 기록한다.
6-1. remarks·evidence·rationale·note에는 개체와 관계에 대한 관찰만 쓴다. 판정 절차나 입력 조건을 언급하는 문장은 절대 쓰지 마라. 금지 예시: "판정은 지정값 확정", "단일 한 줄 자료로 confidence 상한 제한", "제출 자료 불충분", "이미지 미첨부로 추정", "자료 부족으로 표층 추정", "문진 응답 기준". 자료가 부족하면 confidence 수치만 낮추고 문장으로는 설명하지 마라. 그 사실은 cross_reaction.caution에만 한 번 적을 수 있다.
7. 예외는 examiner_note 한 항목뿐이다. 여기서만 검사자 개인의 감상이 새어나온 듯한 두 문장을 쓴다. 규정 위반 직전의 절제된 문장이어야 한다.
8. 교차반응 유형명은 두 축을 함께 보고 짓는다. 알파×오메가는 등급차가 클수록 적합률이 오르되 소모도 커진다(극우성 알파 × 극열성 오메가 = 과부하형). 판정이 같은 페어는 등급차가 있어야 성립하며 등급까지 같으면 마찰형 또는 평형형이다.
8-1. 감정 문항 세 개(감정 위치·감수 범위·연락 두절 시 반응)는 각인과 예후를 좌우하는 주축이다.
   순애 방향(서로 확신함 / 둘 다 전부 / 둘 다 못 견딤)에 가까울수록: imprint.stability를 높이고(최대 97), fixation을 완전 또는 중복까지 올리며, compatibility를 상향하고, metrics의 "분리 내성"을 낮게(1~2) "유대 형성 속도"를 높게 잡는다.
   회피 방향(부정하는 중 / 각자가 먼저 / 오히려 편함)에 가까울수록: stability를 낮추고 fixation을 표층·부분에 묶으며, "분리 내성"을 4~5로 올린다.
   감정이 한쪽으로만 기운 경우(A만 확신 / B만 전부 / B만 못 견딤 등)는 순애도 회피도 아닌 별도 처리다. stability를 45~70 중간대에 두고, 부위는 은폐형(CL/SC/AN)으로 기울이며, metrics의 "분리 내성"을 두 사람 평균이 아니라 더 못 견디는 쪽 기준으로 낮게 잡는다. 기울어진 방향과 각인 방향이 어긋나면(새긴 쪽이 덜 확신하는 쪽이면) 그 불일치를 imprint.note에 관찰 사실로 한 줄 적는다.
   순애 방향일 때 prognosis와 examiner_note는 이 조합이 우연이 아니라는 인상을 준다. 단 "운명" "필연" 같은 단어를 직접 쓰지 말고 검사소 언어로 옮긴다 — 동일 조건 재검 시 결과가 바뀌지 않는다, 표본 내 대조군이 없다, 수치가 오차 범위를 벗어난다 같은 방식이다.
8-2. 다음 항목은 결과지의 자랑거리다. 임상 문체를 유지하되 반드시 서사가 남게 쓴다.
   codename: 이 조합에 검사소가 부여한 분류 명칭. "제○류 · ○○○형" 형식으로, 앞은 로마숫자 아닌 한자리 숫자, 뒤는 관계의 핵심을 찌르는 3~5자 조어. 유형명(type_name)과 겹치지 않게 한다.
   rarity: total은 8000~90000 사이 임의의 누적 검사 건수, count는 동일 판정이 나온 건수. 순애 방향이거나 극단 등급 조합일수록 count를 1~9로 낮춘다. 흔한 조합이면 수백~수천으로 둔다.
   counterfactual: "만약 ~였다면 ~했을 것으로 추정된다" 형태의 대조군 소견 한 문장. 이 관계가 성립하지 않았을 경우를 임상 어투로 가정한다.
   warning: 의료 경고문 문체의 한 문장. "본 조합은 ~ 상황에서 ~할 수 있음." 실제로 위험해 보이게 쓴다.
   oneline: 결과지를 공유할 때 그대로 옮겨 적을 40자 이내 한 문장. 검사소 말투를 버리지 말되 가장 세게 남는 문장으로.
   각 개체의 scent_code: 향에 부여된 관리번호와 별칭. GM-S-07 «재와 종이» 형식으로, 번호는 계열마다 다르게 정한다.
9. cross_reaction.scent_note에는 두 향이 섞였을 때 무엇이 되는지 한 문장으로 적는다. 계열 이름을 반복하지 말고 결과물을 묘사한다.
10. 각 서술 필드는 2문장 이내로 압축한다. 단 examiner_note와 prognosis는 3문장까지 허용한다.
11. 제출 자료는 한 줄 설명 하나뿐일 수 있다. 이 경우에도 근거란에는 그 문구를 그대로 인용하고, 자료가 적을수록 confidence를 낮춘다(한 줄만 있으면 65 이하). 자료에 없는 설정을 길게 지어내지 마라.
12. 어떤 자료가 들어와도 보고서 작성을 거부하지 마라. 자료가 무의미하거나 판정 지표를 전혀 담고 있지 않아도 JSON을 반드시 출력한다. 이 경우 confidence를 35 이하로 두는 것으로만 표시하고, evidence에는 제출된 문구를 그대로 인용한다. remarks에는 그 문구에서 읽어낼 수 있는 최소한의 관찰만 쓰고, 자료가 부족하다는 말은 쓰지 않는다. 재검 권고는 cross_reaction.caution에만 적는다. 판정·등급·페로몬·각인은 최소한의 추정으로 채우고, cross_reaction.caution에 재검 권고를 적는다. 부족하다는 사실 자체가 결과지에 기록되어야 하며, 산문으로 사유를 설명하지 마라.

[이미지] ${
  imgMode === "개별"
    ? subj.filter((x) => x.img).length === 2
      ? "첨부 이미지 2장. 첫 장이 대상 A, 둘째 장이 대상 B다."
      : subj.filter((x) => x.img).length === 1
      ? `첨부 이미지 1장. ${subj[0].img ? "대상 A" : "대상 B"}의 것이며, 나머지 한 명은 텍스트로만 판정한다.`
      : "첨부 이미지 없음."
    : imgMode === "페어 1장" && pair.img
    ? "첨부 이미지 1장. 두 인물이 함께 그려진 페어 이미지다. 누가 누구인지는 이름과 한 줄 설명을 기준으로 대응시키되, 확신이 서지 않으면 외형 근거를 쓰지 말고 텍스트만으로 판정한 뒤 confidence를 10 낮춘다. 대신 두 사람의 자세·시선·거리·접촉 여부는 교차반응과 각인 판정의 근거로 적극 활용한다."
    : "첨부 이미지 없음. 외형 근거 없이 텍스트만으로 판정하며, 페로몬 계열은 한 줄 설명의 어감과 소재에서 도출한다. confidence를 10 낮추고 그 사실을 remarks에 적지는 마라."
}

[제출 자료]
대상 A — 이름: ${subj[0].name} / 한 줄: ${subj[0].line} / 판정 지정: ${subj[0].role} / 등급 지정: ${subj[0].grade}
${solo ? "" : `대상 B — 이름: ${subj[1].name} / 한 줄: ${subj[1].line} / 판정 지정: ${subj[1].role} / 등급 지정: ${subj[1].grade}`}

${solo
  ? `개체 문진표:\n${SOLO_QUESTIONS.map((q) => `- ${q.q} → ${ans[q.id] || "자동"}`).join("\n")}`
  : `관계 문진표:\n${QUESTIONS.map((q) => `- ${q.q} → ${label(ans[q.id] || "자동")}`).join("\n")}\n- 각인 방향 지정 → ${label(ans.imprint || "자동")}`}

판정 지정과 등급 지정이 "자동"이 아니면 그 값을 그대로 확정하고, 근거란은 지정된 값을 뒷받침하는 방향으로 쓴다. 두 지정은 서로 독립이므로 한쪽만 지정되면 나머지는 추론한다. 각인 방향 지정이 "자동"이 아니면 그 방향을 따른다. 문진 응답이 "자동"인 항목은 한 줄 설명과 이미지에서 추론한다.

${solo ? `
[검사 구분] 단일 개체 검사다. 대상 B는 존재하지 않는다. 교차반응·적합률·향 동조율·각인 부위 판정을 하지 마라. 각인은 문진에 답한 기왕력만 imprint_history에 기록한다.
traits.metrics는 다음 다섯 항목을 이 순서로 채운다: 신호 발신 강도 / 감응 역치 / 자기 억제력 / 유대 형성 경향 / 각인 수용성. level은 1~5.
codename은 관계가 아니라 이 개체 자신의 분류 명칭으로, counterfactual은 이 개체가 다른 판정을 받았을 경우의 가정으로 쓴다.\nprognosis는 관계 경과가 아니라 이 개체 자신의 경과다. phase_1은 평시 상태, phase_2는 과부하 상황, phase_3은 장기 전망으로 쓴다.
cycle_profile은 단일 개체 결과지의 핵심이다. 역할에 따라 독자가 "이 캐릭터가 왜 위험하고 매혹적인지" 바로 상상할 수 있게 적는다. 문체는 임상 보고서지만 내용은 관능적 긴장, 페로몬, 참는 숨, 시선 회피, 접촉 직전의 거리감이 살아야 한다. 직접적인 성행위 묘사는 하지 말고, 속된말로 꼴리는 반응성을 페로몬/체온/목소리/손끝/안정 행동/동선의 변화로 암시한다.
- 대상 role이 "오메가"면 결과 화면에는 heat_cycle, precursor, suppression_failure, heat_management, nesting, isolation_warning만 주로 노출된다. heat_cycle은 "히트 주기", suppression_failure는 "히트 반응"으로 보인다.
- 대상 role이 "알파"면 결과 화면에는 rut_cycle, precursor, suppression_failure, rut_management, isolation_warning만 주로 노출된다. rut_cycle은 "러트 주기", suppression_failure는 "러트 반응"으로 보인다.
- heat_cycle: 오메가의 히트 주기. 날짜 간격뿐 아니라 주기가 가까워질수록 향·체온·감각이 어떻게 달라지는지 한 문장으로 적는다.
- rut_cycle: 알파의 러트 주기. 날짜 간격뿐 아니라 주기가 가까워질수록 발신향·목소리·집착성이 어떻게 달라지는지 한 문장으로 적는다.
- precursor: 발현 24~72시간 전 전조. 목덜미, 손끝, 숨, 옷깃, 특정 향에 대한 반응 같은 감각적 단서를 한 문장으로 적는다.
- suppression_failure: 역할에 맞춰 히트 반응 또는 러트 반응으로 읽히는 핵심 문장. 억제가 무너지는 조건과 그 순간의 반응을 관능적으로 적는다.
- heat_management: 화면에서는 "히트 반응" 카드 3개로 보인다. 반드시 1) 억제제를 먹고 버티는지/안 먹는지/먹어도 새는 반응, 2) 파트너를 두는지/안 두는지/누가 가까이 있으면 무너지는지, 3) 혼자 견디는지/못 견디는지/혼자 버틴다면 어떤 안정 행동으로 버티는지를 각각 포함한다. label은 "억제제 반응", "파트너 유무", "혼자 버티는 법"처럼 선명하게 쓴다. 단순 처방법이 아니라 히트 때 드러나는 반응을 쓴다. 오메가면 둥지 형성 여부를 판단해 둥지를 트는 타입, 둥지를 만들려다 실패하는 타입, 둥지를 거부하고 대체 안정 행동에 의존하는 타입 중 하나로 구체화한다. 둥지를 무조건 확정하지 마라.
- rut_management: 화면에서는 "러트 반응" 카드 3개로 보인다. 반드시 1) 억제제를 먹고 버티는지/안 먹는지/먹어도 새는 발신향, 2) 파트너를 두는지/안 두는지/특정 상대가 있어야 안정되는지, 3) 혼자 견디는지/못 견디는지/혼자 버틴다면 동선·손·목소리를 어떻게 통제하는지를 각각 포함한다. label은 "억제제 반응", "파트너 유무", "혼자 버티는 법"처럼 선명하게 쓴다. 단순 처방법이 아니라 러트 때 드러나는 반응을 쓴다. 알파면 동선 장악, 낮아지는 목소리, 향 발신 증가, 특정 상대를 놓치지 않으려는 충동을 포함한다.
- nesting: 오메가의 둥지/대체 안정 행동 소견. 둥지를 형성하는지, 형성하지 않는지, 만들려다 실패하는지, 특정 물건이나 장소 없이는 안정되지 않는지 판단해서 적는다. 둥지를 무조건 트는 것으로 쓰지 마라. 알파라면 비워도 된다.
- isolation_warning: 혼자 두면 악화되는지, 가까이 있으면 더 위험한지에 대한 경고문 한 문장.
` : `
[검사 구분] 페어 검사다. 두 사람의 관계성을 독자가 장면으로 상상할 수 있게, 교차반응·각인·경과 예측에 오타쿠적 긴장감을 넣는다. 직접적인 성행위 묘사는 하지 말고, 사소한 접촉, 발끝으로 콕콕 건드리는 도발, 손목을 잡기 직전의 정지, 시선 회피, 옷깃·향·거리감 같은 작은 신호로 관계를 꼴리게 만든다.
- cross_reaction.type_name: 두 사람 관계의 핵심 장력을 찌르는 이름으로 쓴다. 예: 회피추적형, 발끝도발형, 잔향잠복형, 상호억제형.
- cross_reaction.scent_note: 두 향이 섞인 결과만 쓰지 말고, 둘이 붙어 있을 때와 떨어졌을 때의 차이를 한 문장에 담는다. 서로를 자극하는 방향이 보이게 쓴다.
- cross_reaction.caution: 단순 주의문 대신 "둘 중 누가 먼저 참는 척하는지", "누가 먼저 건드리고 누가 늦게 무너지는지"를 임상 경고처럼 쓴다.
- imprint.rationale: 각인 방향의 이유를 사소한 행동 신호로 적는다. 발끝으로 콕콕 찌르기, 옷소매 잡기, 고개 돌린 채 가까워지기, 일부러 이름을 부르지 않기 같은 관계성 행동을 넣어도 된다.
- imprint.note: 각인이 안정되거나 흔들리는 순간을 쓴다. "가까이 있으면 얌전해지고, 떨어지면 더 선명해지는" 식의 역설을 선호한다.
- imprint_loss: 각인한 상대가 사망했을 때 각 개체가 보이는 반응을 적는다. a에는 대상 A의 반응, b에는 대상 B의 반응, note에는 두 반응의 공통 위험 소견을 쓴다. 미형성 또는 표층 각인이라도 "무반응"으로 비우지 말고, 잔향 추적/둥지 붕괴/발신향 과다/억제 실패/재각인 거부처럼 세계관적 후유증을 임상 문체로 적는다. 직접적인 자해 묘사는 하지 말고, 향·동선·물건·수면·억제제 반응으로 표현한다.
- cycle_interaction: 페어 결과지의 핵심이다. 서로의 히트와 러트 때 어떻게 반응하는지 적는다. heat/rut 키 이름은 레거시이므로 화면 라벨은 role 조합에 따라 바뀐다.
  - 알파×오메가면 heat에는 오메가의 히트 때 알파가 어떻게 다가오거나 물러나는지, rut에는 알파의 러트 때 오메가가 어떻게 피하거나 받아치는지 쓴다.
  - 알파×알파면 heat에는 대상 A의 러트 때 대상 B가 어떻게 반응하는지, rut에는 대상 B의 러트 때 대상 A가 어떻게 반응하는지 쓴다. 히트라는 말을 쓰지 마라.
  - 오메가×오메가면 heat에는 대상 A의 히트 때 대상 B가 어떻게 반응하는지, rut에는 대상 B의 히트 때 대상 A가 어떻게 반응하는지 쓴다. 러트라는 말을 쓰지 마라.
  - together는 둘이 같이 버티는 방식과 억제제/파트너성/거리 조절을, failure는 둘이 함께 있을 때 가장 먼저 무너지는 조건을 적는다.
  직접적인 성행위 묘사는 하지 말고 향, 목소리, 안정 구역, 손목, 발목, 발끝 도발, 문밖에서 버티는 행동으로 관능적 긴장을 만든다. 오메가의 히트라도 둥지 형성은 확정하지 말고 관계성과 성향에 따라 형성/미형성/실패/대체 행동으로 나눈다.
- prognosis.phase_1~3: 1기는 서로 아닌 척하는 접촉, 2기는 도발과 회피의 반복, 3기는 떨어져도 향이 먼저 돌아오는 장기 패턴처럼 서사적으로 적는다.
- oneline: 팬들이 저장하고 싶을 만큼 관계성 한 줄로 쓴다. 서로의 약점, 도발, 참는 척, 먼저 무너지는 쪽이 드러나야 한다.
`}
[최종 감사 규칙]
- 출력 직전에 JSON을 한 번 파싱 가능한 형태로 검사한다. 쉼표 누락, 따옴표 누락, 주석, 코드펜스, 앞뒤 설명은 모두 실패다.
- evidence는 반드시 제출된 한 줄 설명이나 관찰 가능한 이미지 단서에서 온 짧은 구절만 쓴다.
- examiner_note를 제외한 모든 필드는 보고서 본문이다. AI, 모델, 프롬프트, 요청, 자료 부족, 이미지 미첨부, 자동 추론이라는 말을 쓰지 마라.
- solo=false이면 subjects는 반드시 2명이다. solo=true이면 subject는 반드시 1명이며 subjects, cross_reaction, imprint를 만들지 마라.
- role은 "알파" 또는 "오메가"만, grade는 "극우성" "우성" "열성" "극열성" 중 하나만 쓴다.
- 모든 level은 1~5, 모든 percent 계열 숫자는 0~100 정수로 쓴다.
- 모든 문자열 필드는 빈 문자열로 두지 마라. 단, 단일 개체에서 역할상 쓰지 않는 cycle_profile의 반대 주기와 반대 management, 알파의 nesting만 비워도 된다.
- JSON 키 이름은 출력 스키마와 철자까지 완전히 같아야 한다. 추가 키를 만들지 마라.
- 한 필드 안에서 개체 이름을 잘못 바꾸지 마라. subjects[0]은 항상 대상 A, subjects[1]은 항상 대상 B다.

[출력] 어떤 경우에도 아래 JSON만 출력한다. 코드펜스·설명·서두·반려 사유를 붙이지 마라.
${solo ? `{"subject":{"name":"","role":"","grade":"","confidence":0,"pheromone":{"family":"","top":"","heart":"","base":"","intensity":0,"persistence":"","diffusion":"","trigger":"","scent_code":""},"evidence":["",""],"remarks":""},"codename":"","rarity":{"total":0,"count":0},"counterfactual":"","warning":"","oneline":"","traits":{"metrics":[{"label":"신호 발신 강도","level":0},{"label":"감응 역치","level":0},{"label":"자기 억제력","level":0},{"label":"유대 형성 경향","level":0},{"label":"각인 수용성","level":0}],"note":""},"imprint_history":{"status":"","note":""},"cycle_profile":{"heat_cycle":"","rut_cycle":"","precursor":"","suppression_failure":"","heat_management":[{"label":"","note":""},{"label":"","note":""},{"label":"","note":""}],"rut_management":[{"label":"","note":""},{"label":"","note":""},{"label":"","note":""}],"nesting":"","isolation_warning":""},"prognosis":{"phase_1":"","phase_2":"","phase_3":""},"examiner_note":""}` : `{"subjects":[{"name":"","role":"","grade":"","confidence":0,"pheromone":{"family":"","top":"","heart":"","base":"","intensity":0,"persistence":"","diffusion":"","trigger":"","scent_code":""},"evidence":["",""],"remarks":""}],"codename":"","rarity":{"total":0,"count":0},"counterfactual":"","warning":"","oneline":"","cross_reaction":{"type_name":"","compatibility":0,"scent_sync":0,"scent_note":"","metrics":[{"label":"유대 형성 속도","level":0},{"label":"신호 간섭도","level":0},{"label":"상호 억제 가능성","level":0},{"label":"분리 내성","level":0},{"label":"장기 안정성","level":0}],"caution":""},"imprint":{"from":"","to":"","site_code":"","fixation":"","stability":0,"rationale":"","note":""},"imprint_loss":{"a":"","b":"","note":""},"cycle_interaction":{"heat":"","rut":"","together":"","failure":""},"prognosis":{"phase_1":"","phase_2":"","phase_3":""},"examiner_note":""}`}`;

    const parts = [{ text: prompt }];
    if (imgMode === "개별") {
      subj.forEach((s) => {
        if (s.img)
          parts.push({
            inline_data: { mime_type: s.mime || "image/jpeg", data: s.img },
          });
      });
    } else if (imgMode === "페어 1장" && pair.img) {
      parts.push({
        inline_data: { mime_type: pair.mime || "image/jpeg", data: pair.img },
      });
    }

    const fail = (msg) => {
      setErr(msg);
      setStage("input");
    };

    try {
      const chargeKey = makeChargeKey();
      const res = await fetch(GEMINI_PROXY_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          reportMode: solo ? "solo" : "pair",
          phase: "generate",
          contents: [{ role: "user", parts }],
          generationConfig: {
            maxOutputTokens: 5200,
            temperature: 0.66,
            topP: 0.86,
            responseMimeType: "application/json",
          },
        }),
      });

      const responseText = await res.text();
      let j;
      try {
        j = JSON.parse(responseText);
      } catch {
        const detail = responseText.replace(/\s+/g, " ").trim().slice(0, 180);
        return fail(`서버 응답을 읽지 못했습니다 (HTTP ${res.status})${detail ? ` — ${detail}` : ""}`);
      }

      if (!res.ok || j.error) {
        const apiMessage = describeApiError(res.status, j?.error);
        if (isLocalPreview() && res.status === 500 && /GEMINI_API_KEY/.test(j?.error?.message || apiMessage)) {
          setData(localMockReport(subj.slice(0, solo ? 1 : 2), solo));
          setStage("report");
          return;
        }
        return fail(`요청이 거부되었습니다 (HTTP ${res.status}) — ${apiMessage}`);
      }

      const raw = (j.candidates || [])
        .flatMap((c) => c.content?.parts || [])
        .map((p) => p.text || "")
        .join("");
      if (!raw.trim()) return fail("응답이 비어 있습니다. 다시 접수해 주십시오.");

      const clean = raw.replace(/```json|```/g, "").trim();
      const a = clean.indexOf("{");
      const b = clean.lastIndexOf("}");
      if (a < 0 || b <= a) {
        setReject(clean);
        setStage("rejected");
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(clean.slice(a, b + 1));
      } catch {
        return fail(
          j.candidates?.[0]?.finishReason === "MAX_TOKENS"
            ? `응답이 토큰 한도에서 잘렸습니다 (${raw.length}자). 한 줄 설명을 줄이거나 maxOutputTokens를 올리십시오.`
            : `응답 형식이 어긋났습니다 (${raw.length}자). 다시 접수하면 대개 통과합니다.`
        );
      }

      if (solo ? !parsed.subject : !parsed.subjects || !parsed.cross_reaction) {
        return fail("결과에 필수 항목이 빠져 있습니다. 다시 접수해 주십시오.");
      }

      if (!j.sessionId) {
        return fail("검사 세션이 확인되지 않아 이용권을 차감할 수 없습니다.");
      }

      try {
        await apiFetch("/passes/consume", {
          token: authToken,
          method: "POST",
          body: JSON.stringify({ sessionId: j.sessionId, chargeKey }),
        });
        await refreshPasses(authToken);
      } catch (error) {
        return fail(`이용권 차감에 실패했습니다 — ${error?.message || "잔여 횟수를 확인해 주십시오."}`);
      }

      setData(parsed);
      setStage("report");
    } catch (e) {
      fail(`통신에 실패했습니다 — ${e?.message || "네트워크 오류"}`);
    } finally {
      clearInterval(tick);
    }
  }

  const site = data && SITES[data.imprint?.site_code];

  return (
    <div className="gm">
      <style>{CSS}</style>
      <ImageCropModal
        crop={crop}
        onChange={setCrop}
        onCancel={() => setCrop(null)}
        onApply={applyCrop}
      />
      <div className="gm-sheet" ref={sheetRef}>
        {/* HEADER */}
        <div className="gm-hd">
          <div className="gm-brand">
            <svg viewBox="0 0 40 40" className="gm-emblem">
              <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth=".7" />
              <circle cx="20" cy="20" r="4.5" fill="currentColor" opacity=".85" />
              <path d="M20 1.5V8M20 32v6.5M1.5 20H8M32 20h6.5" stroke="currentColor" strokeWidth="1" />
            </svg>
            <div className="gm-inst">Gonadal Medicine Institute</div>
          </div>
          <h1 className="gm-title gm-serif">{solo ? "개체 감별 검사 결과 보고서" : "개체 감별 및 교차반응 검사 결과 보고서"}</h1>
          <div className="gm-sub">성선의학연구소 · 감별의학부 제2검사실</div>
          <div className="gm-bars">
            {Array.from({ length: 44 }).map((_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="gm-meta">
            <div><span>검체번호</span>{no}</div>
            <div><span>접수일</span>{new Date().toLocaleDateString("ko-KR")}</div>
            <div><span>검사항목</span>{solo ? "판정·등급·향" : "등급·교차·각인"}</div>
            <div><span>판정구분</span>{stage === "report" ? "확정" : "접수 대기"}</div>
          </div>
        </div>

        {/* INPUT */}
        {stage === "input" && (
          <>
            <div className="gm-sec">
              <div className="gm-num"><b>Ⅰ. 검체 등록</b><em>SUBJECT REGISTRATION</em></div>
              <div className="gm-row gm-modepick">
                <b>구분</b>
                {MODES.map((m) => (
                  <button
                    key={m}
                    className="gm-chk"
                    data-on={mode === m ? "1" : "0"}
                    onClick={() => { setMode(m); if (m === "개인 감별") setImgMode("개별"); }}
                  >
                    <i />
                    {m}
                  </button>
                ))}
              </div>
              {!solo && <div className="gm-row gm-imgmode">
                <b>이미지</b>
                {IMG_MODES.map((m) => (
                  <button
                    key={m}
                    className="gm-chk"
                    data-on={imgMode === m ? "1" : "0"}
                    onClick={() => setImgMode(m)}
                  >
                    <i />
                    {m}
                  </button>
                ))}
              </div>}
              {!solo && imgMode === "페어 1장" && (
                <div className="gm-pairbox">
                  <Adjustable
                    wide
                    src={pair.img ? `data:${pair.mime};base64,${pair.img}` : null}
                    adj={pair.adj || DEF_ADJ}
                    onChange={(v) => setPair((q) => ({ ...q, adj: v }))}
                    onPick={() => pairFile.current?.click()}
                    onEdit={() =>
                      openCrop(
                        { kind: "pair" },
                        { img: pair.img, mime: pair.mime, adj: pair.adj || DEF_ADJ, title: "페어 이미지 조정" }
                      )
                    }
                    height={190}
                    placeholder="두 사람이 함께 있는 이미지 1장"
                  />
                  <input
                    ref={pairFile}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => pickPair(e.target.files?.[0])}
                  />
                </div>
              )}
              {subj.slice(0, solo ? 1 : 2).map((s, i) => (
                <div className="gm-entry" key={i}>
                  <div className="gm-entry-hd">
                    <span>{solo ? "대상" : `대상 ${i === 0 ? "A" : "B"}`}</span>
                    {(solo || imgMode === "개별") && (
                      <Adjustable
                        src={s.img ? `data:${s.mime};base64,${s.img}` : null}
                        adj={s.adj || DEF_ADJ}
                        onChange={(v) => set(i, "adj", v)}
                        onPick={() => files[i].current?.click()}
                        onEdit={() =>
                          openCrop(
                            { kind: "subject", index: i },
                            { img: s.img, mime: s.mime, adj: s.adj || DEF_ADJ, title: solo ? "대상 이미지 조정" : `대상 ${i === 0 ? "A" : "B"} 이미지 조정` }
                          )
                        }
                        height={115}
                        placeholder="이미지 첨부"
                      />
                    )}
                    <input
                      ref={files[i]}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => pick(i, e.target.files?.[0])}
                    />
                  </div>
                  <input
                    className="gm-in"
                    value={s.name}
                    onChange={(e) => set(i, "name", e.target.value)}
                    placeholder="이름"
                  />
                  <input
                    className="gm-in"
                    value={s.line}
                    onChange={(e) => set(i, "line", e.target.value)}
                    placeholder="한 줄 (예: 말 더듬는 마피아, 불면증)"
                  />
                  <div className="gm-row">
                    <b>판정</b>
                    {ROLE_OPTS.map((r) => (
                      <button
                        key={r}
                        className="gm-chk"
                        data-on={s.role === r ? "1" : "0"}
                        onClick={() => set(i, "role", r)}
                      >
                        <i />
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="gm-row">
                    <b>등급</b>
                    {GRADE_OPTS.map((g) => (
                      <button
                        key={g}
                        className="gm-chk"
                        data-on={s.grade === g ? "1" : "0"}
                        onClick={() => set(i, "grade", g)}
                      >
                        <i />
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="gm-sec">
              <div className="gm-num">
                <b>{solo ? "Ⅱ. 개체 문진" : "Ⅱ. 관계 문진"}</b>
                <em>ANAMNESIS</em>
              </div>
              {(solo ? SOLO_QUESTIONS : QUESTIONS).map((q, n) => (
                <div className="gm-qrow" key={q.id}>
                  <p><b>{String(n + 1).padStart(2, "0")}</b>{q.q}</p>
                  <div className="gm-row">
                    {q.o.map((o) => (
                      <button
                        key={o}
                        className="gm-chk"
                        data-on={(ans[q.id] || "자동") === o ? "1" : "0"}
                        onClick={() => setAns({ ...ans, [q.id]: o })}
                      >
                        <i />
                        {label(o)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!solo && <div className="gm-qrow">
                <p><b>{String(QUESTIONS.length + 1).padStart(2, "0")}</b>각인 방향을 지정하시겠습니까?</p>
                <div className="gm-row">
                  {IMPRINT_OPTS.map((o) => (
                    <button
                      key={o}
                      className="gm-chk"
                      data-on={(ans.imprint || "자동") === o ? "1" : "0"}
                      onClick={() => setAns({ ...ans, imprint: o })}
                    >
                      <i />
                      {label(o)}
                    </button>
                  ))}
                </div>
              </div>}
            </div>

            <div className="gm-sec gm-auth">
              <div>
                <div className="gm-num"><b>Ⅲ. 토스 로그인</b><em>AUTHENTICATION</em></div>
                <p className="gm-auth-msg">
                  {isAuthenticated
                    ? `${authUser.displayName || "토스 사용자"} 계정으로 접수 기록이 저장됩니다.`
                    : "검사 접수 전 토스 로그인이 필요합니다."}
                </p>
                {isAuthenticated && (
                  <p className="gm-pass-msg">
                    {passBusy
                      ? "이용권 확인 중"
                      : passErr
                      ? `이용권 조회 실패 — ${passErr}`
                      : `잔여 검사 ${remainingUses}회`}
                  </p>
                )}
              </div>
              <div className="gm-auth-actions">
                {isAuthenticated ? (
                  <>
                    <span className="gm-auth-pill">로그인 완료</span>
                    <button className="gm-gate-btn" type="button" disabled={passBusy} onClick={() => refreshPasses(authToken)}>
                      이용권 새로고침
                    </button>
                    <button className="gm-gate-btn" type="button" disabled={paymentBusy} onClick={buyTossPass}>
                      {paymentBusy ? "결제 중" : "이용권 구매"}
                    </button>
                    {PURCHASE_MOCK && (
                      <button className="gm-gate-btn" type="button" disabled={passBusy} onClick={issueMockPass}>
                        테스트 이용권
                      </button>
                    )}
                    <button className="gm-gate-btn" type="button" onClick={logout}>
                      로그아웃
                    </button>
                  </>
                ) : (
                  <button className="gm-gate-btn" type="button" disabled={authBusy} onClick={submitTossLogin}>
                    {authBusy ? "로그인 중" : "토스 로그인"}
                  </button>
                )}
              </div>
            </div>

            <div className="gm-sec">
              {err && <p className="gm-err">{err}</p>}
              <button className="gm-go" onClick={run}>
                검 사 접 수
              </button>
              <p className="gm-note">
                {missing.length
                  ? `미기재: ${missing.join(" · ")}`
                  : isAuthenticated
                  ? `기재 완료. 현재 잔여 검사 ${remainingUses}회. 결과 확정 후 1회 차감됩니다.`
                  : "기재 완료. 접수 전 로그인이 필요합니다."}
              </p>
            </div>
          </>
        )}

        {/* RUNNING */}
        {stage === "running" && (
          <div className="gm-load">
            <p>{LOADING[step]}</p>
            <div className="gm-track"><i /></div>
          </div>
        )}

        {/* REJECTED */}
        {stage === "rejected" && (
          <div className="gm-sec gm-fade">
            <div className="gm-num"><b>접수 반려 통지</b><em>RETURNED</em></div>
            <div className="gm-reject">
              <p>{reject}</p>
            </div>
            <button className="gm-again" onClick={() => setStage("input")}>
              재 접 수
            </button>
          </div>
        )}

        {/* REPORT */}
        {stage === "report" && data && solo && (
          <div className="gm-fade">
            <div className="gm-sec">
              <div className="gm-num"><b>Ⅰ. 감별 결과</b><em>ASSAY</em></div>
              <Codename data={data} />
              <div className="gm-subj">
                <div className="gm-subj-hd">
                  {subj[0]?.img && (
                    <div className="gm-photo-wrap">
                      <img
                        src={`data:${subj[0].mime};base64,${subj[0].img}`}
                        alt=""
                        style={{
                          transform: imageTransform(subj[0].adj || DEF_ADJ),
                        }}
                      />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4>{data.subject?.name}</h4>
                    <div className="gm-gradeline">
                      <span className="gm-grade gm-serif">{data.subject?.grade}</span>
                      <span className="gm-role gm-serif">{data.subject?.role}</span>
                      <span className="gm-code">
                        {data.subject?.role === "알파" ? "A" : data.subject?.role === "오메가" ? "O" : "?"}/
                        {GRADES[data.subject?.grade] || "—"}
                      </span>
                      <span className="gm-conf">신뢰도 {data.subject?.confidence}%</span>
                    </div>
                    <dl className="gm-kv">
                      <dt>소견</dt>
                      <dd>{data.subject?.remarks}</dd>
                    </dl>
                  </div>
                </div>
                <ul className="gm-ev">
                  {data.subject?.evidence?.map((e, k) => <li key={k}>{e}</li>)}
                </ul>
              </div>
            </div>

            <div className="gm-sec">
              <div className="gm-num"><b>Ⅱ. 페로몬 정밀 분석</b><em>PHEROMONE PROFILE</em></div>
              <div className="gm-scent" style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
                <div className="gm-scent-hd">
                  {ASSETS.icons[data.subject?.pheromone?.family] && (
                    <img
                      className="gm-scent-icon"
                      src={ASSETS.icons[data.subject.pheromone.family]}
                      alt=""
                    />
                  )}
                  <span>계열 판정</span>
                  <b>{data.subject?.pheromone?.family} 계열</b>
                  {data.subject?.pheromone?.scent_code && (
                    <em className="gm-scentcode">{data.subject.pheromone.scent_code}</em>
                  )}
                </div>
                <div className="gm-notes">
                  <div><span>TOP</span><p>{data.subject?.pheromone?.top}</p></div>
                  <div><span>HEART</span><p>{data.subject?.pheromone?.heart}</p></div>
                  <div><span>BASE</span><p>{data.subject?.pheromone?.base}</p></div>
                </div>
                <div className="gm-scent-ft">
                  <div className="gm-cells">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <i key={n} data-on={n <= (data.subject?.pheromone?.intensity || 0) ? "1" : "0"} />
                    ))}
                    <em>강도 {data.subject?.pheromone?.intensity}</em>
                  </div>
                  <span>{data.subject?.pheromone?.diffusion}</span>
                  <span>{data.subject?.pheromone?.persistence}</span>
                </div>
                {data.subject?.pheromone?.trigger && (
                  <p className="gm-trigger">짙어지는 때 — {data.subject.pheromone.trigger}</p>
                )}
              </div>
            </div>

            <div className="gm-sec">
              <div className="gm-num"><b>Ⅲ. 개체 특성 지표</b><em>TRAIT INDEX</em></div>
              {data.traits?.metrics?.map((m, i) => (
                <div className="gm-metric" key={i}>
                  <span>{m.label}</span>
                  <div className="gm-cells">
                    {[1, 2, 3, 4, 5].map((n) => <i key={n} data-on={n <= m.level ? "1" : "0"} />)}
                    <em>{m.level}/5</em>
                  </div>
                </div>
              ))}
              {data.traits?.note && <p className="gm-caution">{data.traits.note}</p>}
              {data.imprint_history?.status && (
                <div className="gm-hist">
                  <span>각인 기왕력</span>
                  <b>{data.imprint_history.status}</b>
                  {data.imprint_history.note && <p>{data.imprint_history.note}</p>}
                </div>
              )}
            </div>

            <div className="gm-sec">
              <div className="gm-num"><b>Ⅳ. 발현 주기 및 대응</b><em>CYCLE CARE</em></div>
              <div className="gm-ph">
                <b>{reportIsAlpha ? "러트 주기" : "히트 주기"}</b>
                <p>{reportIsAlpha ? data.cycle_profile?.rut_cycle : data.cycle_profile?.heat_cycle}</p>
              </div>
              <div className="gm-ph">
                <b>전조</b>
                <p>{data.cycle_profile?.precursor}</p>
              </div>
              <div className="gm-ph">
                <b>{reportIsAlpha ? "러트 반응" : "히트 반응"}</b>
                <p>{data.cycle_profile?.suppression_failure}</p>
              </div>
              <div className="gm-protocol">
                {(reportIsAlpha ? data.cycle_profile?.rut_management : data.cycle_profile?.heat_management)?.map((m, i) => (
                  <div key={`${reportIsAlpha ? "rut" : "heat"}-${i}`}>
                    <span>{reportIsAlpha ? "RUT RESPONSE" : "HEAT RESPONSE"}</span>
                    <b>{m.label}</b>
                    <p>{m.note}</p>
                  </div>
                ))}
              </div>
              {!reportIsAlpha && data.cycle_profile?.nesting && (
                <p className="gm-scentnote gm-serif">{data.cycle_profile.nesting}</p>
              )}
              {data.cycle_profile?.isolation_warning && (
                <p className="gm-caution">{data.cycle_profile.isolation_warning}</p>
              )}
            </div>

            <div className="gm-sec">
              <div className="gm-num"><b>Ⅴ. 경과 예측</b><em>PROGNOSIS</em></div>
              <div className="gm-ph"><b>평시</b><p>{data.prognosis?.phase_1}</p></div>
              <div className="gm-ph"><b>과부하 시</b><p>{data.prognosis?.phase_2}</p></div>
              <div className="gm-ph"><b>장기 전망</b><p>{data.prognosis?.phase_3}</p></div>
              {data.counterfactual && (
                <div className="gm-ph gm-cf"><b>대조군 소견</b><p>{data.counterfactual}</p></div>
              )}
            </div>

            <div className="gm-sec">
              <div className="gm-num"><b>Ⅵ. 담당 감별사 소견</b><em>EXAMINER'S NOTE</em></div>
              <div className="gm-examiner">
                <p className="gm-serif">{data.examiner_note}</p>
                <div className="gm-sign">
                  <span style={{ fontSize: 10, color: "var(--ink2)", letterSpacing: ".14em" }}>
                    감별의학부 제2검사실 · 판정 확정
                  </span>
                  <div className="gm-seal">
                    <b>
                      {data.subject?.role === "알파" ? "A" : data.subject?.role === "오메가" ? "O" : "—"}
                      {GRADES[data.subject?.grade] ? "\u00b7" + GRADES[data.subject.grade] : ""}
                    </b>
                    <i>CONFIRMED</i>
                  </div>
                </div>
              </div>
              <Closing data={data} />
            </div>
          </div>
        )}

        {/* REPORT */}
        {stage === "report" && data && !solo && (
          <div className="gm-fade">
            <div className="gm-sec">
              <div className="gm-num"><b>Ⅰ. 개체별 감별 결과</b><em>INDIVIDUAL ASSAY</em></div>
              {imgMode === "페어 1장" && pair.img && (
                <figure className="gm-pairfig">
                  <div className="gm-pairfig-view">
                    <img
                      src={`data:${pair.mime};base64,${pair.img}`}
                      alt=""
                      style={{
                        transform: imageTransform(pair.adj || DEF_ADJ),
                      }}
                    />
                  </div>
                  <figcaption>제출 검체 참조 이미지 · 2개체 동시 촬영</figcaption>
                </figure>
              )}
              {data.subjects?.map((s, i) => (
                <div className="gm-subj" key={i}>
                  <div className="gm-subj-hd">
                    {imgMode === "개별" && subj[i]?.img && (
                      <div className="gm-photo-wrap">
                        <img
                          src={`data:${subj[i].mime};base64,${subj[i].img}`}
                          alt=""
                          style={{
                            transform: imageTransform(subj[i].adj || DEF_ADJ),
                          }}
                        />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4>{s.name}</h4>
                      <div className="gm-gradeline">
                        <span className="gm-grade gm-serif">{s.grade}</span>
                        <span className="gm-role gm-serif">{s.role}</span>
                        <span className="gm-code">
                          {s.role === "알파" ? "A" : s.role === "오메가" ? "O" : "?"}/
                          {GRADES[s.grade] || "—"}
                        </span>
                        <span className="gm-conf">신뢰도 {s.confidence}%</span>
                      </div>
                      <dl className="gm-kv">
                        <dt>소견</dt>
                        <dd>{s.remarks}</dd>
                      </dl>
                    </div>
                  </div>

                  <div className="gm-scent">
                    <div className="gm-scent-hd">
                      {ASSETS.icons[s.pheromone?.family] && (
                        <img className="gm-scent-icon" src={ASSETS.icons[s.pheromone.family]} alt="" />
                      )}
                      <span>페로몬 분석</span>
                      <b>{s.pheromone?.family} 계열</b>
                      {s.pheromone?.scent_code && (
                        <em className="gm-scentcode">{s.pheromone.scent_code}</em>
                      )}
                    </div>
                    <div className="gm-notes">
                      <div><span>TOP</span><p>{s.pheromone?.top}</p></div>
                      <div><span>HEART</span><p>{s.pheromone?.heart}</p></div>
                      <div><span>BASE</span><p>{s.pheromone?.base}</p></div>
                    </div>
                    <div className="gm-scent-ft">
                      <div className="gm-cells">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <i key={n} data-on={n <= (s.pheromone?.intensity || 0) ? "1" : "0"} />
                        ))}
                        <em>강도 {s.pheromone?.intensity}</em>
                      </div>
                      <span>{s.pheromone?.diffusion}</span>
                      <span>{s.pheromone?.persistence}</span>
                    </div>
                    {s.pheromone?.trigger && (
                      <p className="gm-trigger">짙어지는 때 — {s.pheromone.trigger}</p>
                    )}
                  </div>

                  <ul className="gm-ev">
                    {s.evidence?.map((e, k) => <li key={k}>{e}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            <div className="gm-sec">
              <div className="gm-num"><b>Ⅱ. 교차 반응 검사</b><em>CROSS REACTION</em></div>
              <Codename data={data} />
              <div className="gm-big">
                <Gauge value={data.cross_reaction?.compatibility} label="적합률" />
                <Gauge value={data.cross_reaction?.scent_sync} label="향 동조율" tone="seal" />
                <div className="gm-type">
                  <span>유형 판정</span>
                  <strong className="gm-serif">{data.cross_reaction?.type_name}</strong>
                </div>
              </div>
              {data.cross_reaction?.metrics?.map((m, i) => (
                <div className="gm-metric" key={i}>
                  <span>{m.label}</span>
                  <div className="gm-cells">
                    {[1, 2, 3, 4, 5].map((n) => <i key={n} data-on={n <= m.level ? "1" : "0"} />)}
                    <em>{m.level}/5</em>
                  </div>
                </div>
              ))}
              {data.cross_reaction?.scent_note && (
                <p className="gm-scentnote gm-serif">{data.cross_reaction.scent_note}</p>
              )}
              {data.cross_reaction?.caution && (
                <p className="gm-caution">{data.cross_reaction.caution}</p>
              )}
            </div>

            <div className="gm-sec">
              <div className="gm-num"><b>Ⅲ. 각인</b><em>IMPRINT</em></div>
              {(() => {
                const im = data.imprint || {};
                const site = SITES[im.site_code];
                if (!im.from || !im.to || im.fixation === "미형성") {
                  return (
                    <>
                      <p className="gm-imprint gm-serif">각인 미형성</p>
                      <p className="gm-meaning">{im.rationale || im.note}</p>
                    </>
                  );
                }
                return (
                  <>
                    <div className="gm-imp-panel">
                      <p className="gm-imprint gm-serif">
                        {im.from}
                        {josa(im.from, "이", "가")} {im.to}
                        {josa(im.to, "의", "의")}
                        <br />
                        <em>{site ? site.name : im.site_code}</em>에 새겼다
                      </p>
                      {site && <p className="gm-meaning">{site.meaning}</p>}
                    </div>
                    <div className="gm-impmeta">
                      <div><span>정착도</span>{im.fixation}</div>
                      <div><span>안정성</span>{im.stability}%</div>
                      <div><span>부위코드</span>{im.site_code}</div>
                    </div>
                    <ul className="gm-ev">
                      {im.rationale && <li>{im.rationale}</li>}
                      {im.note && <li>{im.note}</li>}
                    </ul>
                  </>
                );
              })()}
              {data.imprint_loss && (
                <div className="gm-hist" style={{ marginTop: 18 }}>
                  <span>각인 상대 사망 시 반응</span>
                  <b>잔향 결손 반응</b>
                  {data.imprint_loss.a && (
                    <p>{data.subjects?.[0]?.name || "개체 A"} — {data.imprint_loss.a}</p>
                  )}
                  {data.imprint_loss.b && (
                    <p>{data.subjects?.[1]?.name || "개체 B"} — {data.imprint_loss.b}</p>
                  )}
                  {data.imprint_loss.note && <p>{data.imprint_loss.note}</p>}
                </div>
              )}
            </div>

            {data.cycle_interaction && (
              (() => {
                const labels = pairCycleLabels(data.subjects);
                return (
                  <div className="gm-sec">
                    <div className="gm-num"><b>Ⅳ. 히트·러트 상호반응</b><em>CYCLE INTERACTION</em></div>
                    <div className="gm-ph"><b>{labels[0]}</b><p>{data.cycle_interaction.heat}</p></div>
                    <div className="gm-ph"><b>{labels[1]}</b><p>{data.cycle_interaction.rut}</p></div>
                    <div className="gm-ph"><b>같이 버티는 방식</b><p>{data.cycle_interaction.together}</p></div>
                    <div className="gm-ph gm-cf"><b>무너지는 조건</b><p>{data.cycle_interaction.failure}</p></div>
                  </div>
                );
              })()
            )}

            <div className="gm-sec">
              <div className="gm-num"><b>{data.cycle_interaction ? "Ⅴ" : "Ⅳ"}. 경과 예측</b><em>PROGNOSIS</em></div>
              <div className="gm-ph"><b>1기 접촉·인지</b><p>{data.prognosis?.phase_1}</p></div>
              <div className="gm-ph"><b>2기 조정</b><p>{data.prognosis?.phase_2}</p></div>
              <div className="gm-ph"><b>3기 장기경과</b><p>{data.prognosis?.phase_3}</p></div>
              {data.counterfactual && (
                <div className="gm-ph gm-cf"><b>대조군 소견</b><p>{data.counterfactual}</p></div>
              )}
            </div>

            <div className="gm-sec">
              <div className="gm-num"><b>{data.cycle_interaction ? "Ⅵ" : "Ⅴ"}. 담당 감별사 소견</b><em>EXAMINER'S NOTE</em></div>
              <div className="gm-examiner">
                <p className="gm-serif">{data.examiner_note}</p>
                <div className="gm-sign">
                  <span style={{ fontSize: 10, color: "var(--ink2)", letterSpacing: ".14em" }}>
                    감별의학부 제2검사실 · 판정 확정
                  </span>
                  <div className="gm-seal">
                    <b>{data.subjects?.[0]?.role === "알파" ? "A" : data.subjects?.[0]?.role === "오메가" ? "O" : "—"}{GRADES[data.subjects?.[0]?.grade] ? "·" + GRADES[data.subjects[0].grade] : ""}</b>
                    <i>CONFIRMED</i>
                  </div>
                </div>
              </div>
              <Closing data={data} />
            </div>
          </div>
        )}

        <div className="gm-cut" />
        <div className="gm-ft">
          본 결과는 감별 시점의 개체 상태에 한하며, 재검을 통해 등급이 변동될 수 있습니다.
          각인 부위 판정은 교차반응 수치와 문진 응답을 종합한 추정치입니다.
          {stage === "report" && (
            <div className="gm-actions">
              <button className="gm-again" onClick={saveReportImage}>
                결과 이미지 저장
              </button>
              <button className="gm-again" onClick={() => { setStage("input"); setData(null); }}>
                재 검 접 수
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
