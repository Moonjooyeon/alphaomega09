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
  const passProductPattern = /11|검사|이용권|사용권|pass/i;
  return (
    consumables.find((product) => passProductPattern.test(text(product))) ||
    consumables[0] ||
    products.find((product) => passProductPattern.test(text(product))) ||
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
- 싸고 빠른 모델이라도 최종 결과는 고가 모델의 세밀함처럼 보여야 한다. 단정은 수치로 제한하되, 서술은 폭발 직전까지 이성적으로 상대를 밀어내거나 사랑하면서도, 몸과 본능은 페로몬에 강제로 굴복하며 팽팽하게 마찰하는 모순적 고통을 담는다.
- 흔한 일반론을 피한다. "강한 끌림", "묘한 분위기" 대신, 억제제로 망가진 신경, 이성적으로는 반항하면서도 압도적인 페로몬에 무릎이 꺾이는 모습, 환상통에 시달려 피가 나도록 긁어댄 목덜미 등 이성과 신체적 본능이 충돌하며 겪는 구체적인 마찰을 서술한다.
- 결과지의 재미는 codename, scent_code, counterfactual, warning, examiner_note에 집중한다. 건조하고 절제된 임상 기록체가 오히려 억압된 텐션을 증폭시키는 배덕감의 장치가 되게 한다.
- prognosis는 예후표가 아니라 "이 관계/개체의 이성이 어떻게 마모되고, 끝내 어느 지점에서 짐승 같은 본능에 생리적으로 굴복하는지"에 대한 고밀도 관찰란이다. 이성적 통제와 생물학적 복종 사이에서 땀에 젖은 채 숨을 헐떡이며 기어이 상대의 살갗을 탐하고 마는 아슬아슬한 스냅샷으로 쓴다.
- 모순이 있으면 지정값과 문진 응답을 우선하고, 이미지 단서는 보조 근거로만 쓴다.
- 모든 숫자는 서로 맞아야 한다. compatibility, scent_sync, stability, metrics는 같은 이야기 안에서 같은 방향을 가리켜야 한다.
- 한국어 문장은 짧게 쓴다. 한 문장에 판단을 두 개 이상 겹치지 않는다.

[Flash-Lite 보정 / 서사적 스냅샷 규칙]
- 모든 결과물은 이 페어의 서사를 지켜보는 팬이 숨을 죽이고 침을 꿀꺽 삼킬 만큼, 이성과 본능의 괴리에서 오는 배덕적 텐션이 극에 달한 밀도 높은 관찰 기록이어야 한다.
- 가벼운 모델일수록 일반론으로 도망가므로, 모든 긴 서술 필드는 반드시 "이성적 거부/억제 → 페로몬에 의한 생리적 강제 굴복 → 기어이 터져 나오는 맹목적 신체적 갈구와 살갗 집착"의 3단계를 내부적으로 만든 뒤 1~2문장으로 압축한다.
- 관능의 핵심은 '이성과 본능의 불일치'와 '페로몬에 의한 생리적 복종'이다. 이성으로는 상대를 혐오하고 반항하려 하지만, 상대의 페로몬이 훅 끼치는 순간 다리에 힘이 풀려 주저앉거나, 자기도 모르게 가장 취약한 목덜미를 내어주며 헐떡이는 육체의 비참한 굴복을 노골적으로 묘사한다.
- 알파/오메가 형질에 따른 극단적인 금단증상을 포함한다. 닿지 못할 때 각인 부위에 타는 듯한 환상통을 느껴 피가 나도록 긁어대거나, 이성의 통제를 잃고 상대의 체취가 가장 짙게 밴 물건(벗어둔 셔츠 등)을 몰래 훔쳐다 둥지(Nesting)를 틀고 그 속에 처박혀 짐승처럼 숨을 들이켜는 배덕하고 수치스러운 맹목성을 자극적으로 묘사한다.
- 약물로 간신히 누른 이성이 상대의 숨결 한 번, 페로몬 한 줌에 순식간에 약효가 박살나며 그 자리에서 억제가 풀려버리는 '강제 사이클 유도'의 절망감과 쾌감을 반드시 포함한다.
- 각 긴 서술 필드는 가능하면 물건 1개, 동선 1개, 들키는 신체 반응 1개 중 최소 두 가지를 포함한다. 예: 타액으로 번들거리는 잇자국, 체향이 밴 옷자락을 부러질 듯 쥔 손, 페로몬에 짓눌려 덜덜 떨리는 무릎, 열기에 짓무른 눈가, 환상통에 시달려 붉게 긁힌 목덜미, 박살난 억제제 병.
- 감정어를 직접 쓰지 마라. 대신 상대를 사랑하면서도 몸이 거부해 밀어내는 모순, 혐오한다고 뱉으면서도 상대의 맥박 뛰는 부위를 뚫어지게 응시하며 무의식적으로 입맛을 다시는 시선으로 욕정이 질척하게 새어 나오게 쓴다.
- 페어의 상호작용에는 다음 세 포지션 중 최소 두 가지 이상이 얽혀야 한다.
  1) 먼저 도발하는 쪽: 여유롭게 선을 넘나들지만, 상대의 몸과 본능이 이성을 압도하고 포식자처럼 달려들어 제 목덜미를 물어뜯을 때 공포와 쾌감이 섞인 신음을 흘리며 굳어버린다.
  2) 생리적으로 굴복하는 쪽: 이성적으로 거부하려 치사량 직전까지 인내하며 밀어내다가, 압도적인 페로몬에 몸이 먼저 항복하여 다리가 풀리고 본능적으로 상대의 체향에 매달리며 헐떡인다.
  3) 아닌 척 기만하는 쪽: 입으로는 이성적인 관계를 말하지만, 달아오른 속내는 무의식적으로 상대가 제 목덜미를 꿰뚫고 페로몬을 강제로 주입해 주기를 기다리며 완벽히 굴복할 준비를 마친 상태다.
- 알파×알파는 서로를 향한 깊은 이성적 애정과 별개로, 알파의 본능이 상대의 페로몬을 위협으로 오인해 몸이 뻣뻣하게 굳거나 목덜미를 물어뜯고 싶어 미칠 듯한 지배욕이 충돌하는 텐션으로 쓴다.
- 오메가×오메가는 완벽히 사랑하면서도 알파의 페로몬이 없다는 생물학적 결핍 탓에 아무리 닿아도 몸이 채워지지 않아 미쳐버릴 듯 서로의 살갗을 부비고 물어뜯으려는 신경증적 집착으로 쓴다.
- 알파×오메가는 서로의 페로몬에 무의식적으로 굴복하여 강제로 사이클이 유도되며, 이성을 잃는 순간 서로의 살점을 뜯어낼 듯 맹목적으로 파고드는 지독한 족쇄로 쓴다.
- 유사어 반복을 피한다. 구체적인 페로몬의 물성이나 이성을 배반하는 신체적 굴복감으로 바꾼다.
- oneline은 억압과 짐승적 붕괴의 장력을 관통하는 가장 강렬한 한 줄이어야 한다. 예: "이성으로는 닿기를 거부하면서도, 짓눌린 몸은 기어코 상대의 페로몬을 구걸하고 있었다." / "입술이 찢어지도록 버텨낸 이성은, 상대의 숨결 한 번에 가장 비참한 발정으로 무너졌다."

[분류 체계] 축이 두 개다. 반드시 둘 다 판정한다.
- 판정(role): 알파 / 오메가
- 등급(grade): 극우성 / 우성 / 열성 / 극열성. 같은 판정 안에서의 발현 강도이며 판정과 독립이다.

[판정 원칙]
1. 모든 판정에는 근거가 있어야 한다. 근거란에는 제출된 프로필의 표현을 짧게 그대로 인용한다.
2. 기본 등급은 우성 또는 열성이다. 극우성·극열성은 명확한 근거가 있을 때만 부여하며, 두 개체를 동시에 극단 등급으로 판정하지 않는다.
3. 성별·외형의 남성성/여성성으로 판정이나 등급을 결정하지 마라.
4. 페로몬은 향수처럼 기술한다.
   각 개체마다 top(첫인상), heart(체온에 데워져 살갗에서 농염하게 끓어오르는 향), base(벗어둔 옷과 땀에 젖은 침구에 짙게 배어 이성을 마비시키는 잔향)를 각각 다른 구체적 사물로 적는다.
   trigger에는 이 향이 통제를 벗어나 폭발하는 순간을 적는다(예: 억제제가 박살나며 강제 발정할 때, 이성과 달리 몸이 반응하여 상대의 뒷덜미를 물어뜯고 싶어질 때).
5. 각인은 방향 → 부위 → 정착도 순으로 판정한다. 미형성이면 from과 to를 빈 문자열로 둔다. 부위 코드는 NP(후경부) CL(쇄골 하연) WR(손목 안쪽) SC(견갑골 사이) ME(유양돌기) TH(좌흉부) RB(늑골 하연) AN(내과부) PL(수장부) HL(후두 발제부) 중 하나만.
5-1. 각인 부위는 이성적 거부감과 환상통이 교차하다가 가장 먼저 생리적으로 붕괴되는 약점이다. 왜 그 부위의 살갗에 닿지 못하면 피가 나도록 긁어대며, 닿았을 땐 자기도 모르게 잘근잘근 씹어대려 하는지를 imprint.rationale 또는 imprint.note에 반드시 넣는다. 쇄골 하연(CL)이나 후경부(NP)면 이성을 거스르고 치아를 세워 짓씹고 제 페로몬을 강제 주입하려는 맹목적인 파고듦, 손목 안쪽(WR)이면 옭아매듯 쥐는 악력과 맥박을 입술로 탐하는 행동, 귀 뒤(ME)면 이성을 끊어내는 귓속말과 소유욕의 흔적처럼 부위별 야만적 행동을 농밀하게 연결한다.
6. 문체는 임상 기록이다. 감정어 없이 관찰된 사실과 수치로 기술하되 건조한 활자 뒤로 이성을 배반하는 신체적 발정과 욕정이 노골적으로 묻어나야 한다.
6-1. remarks·evidence·rationale·note에는 개체와 관계에 대한 관찰만 쓴다. 판정 절차나 입력 조건을 언급하는 문장은 절대 쓰지 마라.
7. 예외는 examiner_note 한 항목뿐이다. 여기서만 검사자 개인의 아찔함이 새어나온 듯한 두 문장을 쓴다. 임상 규정 위반 직전의 절제되었으나 텐션 넘치는 문장이어야 한다.
8. 교차반응 유형명은 두 축을 함께 보고 짓는다.
8-1. 감정 문항 세 개(감정 위치·감수 범위·연락 두절 시 반응)는 각인과 예후를 좌우하는 주축이다.
   순애 방향에 가까울수록: 이성적으로는 확신하나 몸의 페로몬 충돌/결핍으로 고통받는 상태. imprint.stability를 높이고, "분리 내성"을 극도로 낮게(1~2) 잡아 떨어지면 미쳐버리는 상태로 만든다.
   회피 방향에 가까울수록: 이성과 본능의 거부가 충돌하며 생기는 파괴적인 신체적 부하와 강제 복종. "분리 내성"을 4~5로 올린다.
   감정이 한쪽으로만 기운 경우는 병적 집착 또는 일방적 맹목으로 처리한다. "분리 내성"을 더 못 견디는 쪽 기준으로 깎아 미칠 듯한 환상통과 금단증상을 부여한다.
8-2. 다음 항목은 결과지의 자랑거리다.
   codename: 이 조합에 검사소가 부여한 분류 명칭. "제○류 · ○○○형" 형식. (예: 제2류 · 억제붕괴형, 제4류 · 강제복종형).
   rarity: total은 8000~90000 임의 건수, count는 동일 판정 건수.
   counterfactual: 서로를 만나지 않았다면 홀로 겪었을 파국(예: 억제제 과다복용, 환상통으로 인한 자해)을 임상 어투로 가정.
   warning: 의료 경고문 문체. 이성과 몸의 충돌 끝에 상대의 목덜미를 물어뜯거나 억제제가 무용지물이 될 생리적 위험성을 경고한다.
   oneline: 이성과 본능의 갈등 끝에 터져 나오는 가장 섹슈얼하고 파괴적인 한 문장.
   scent_code: 향에 부여된 관리번호와 별칭. GM-S-07 «짓무른 화약과 식은 땀» 형식.
9. cross_reaction.scent_note에는 억지로 참아내던 이성이 살갗의 열기와 만나 농염하게 끓어오르는 결과물을 묘사한다.
10. 각 서술 필드는 2문장 이내 압축. examiner_note와 prognosis는 3문장까지.
11. 제출 자료가 한 줄이어도 JSON을 반드시 출력한다.

[이미지] ${
  imgMode === "개별"
    ? subj.filter((x) => x.img).length === 2
      ? "첨부 이미지 2장. 첫 장이 대상 A, 둘째 장이 대상 B다."
      : subj.filter((x) => x.img).length === 1
      ? `첨부 이미지 1장. ${subj[0].img ? "대상 A" : "대상 B"}의 것이며, 나머지 한 명은 텍스트로만 판정한다.`
      : "첨부 이미지 없음."
    : imgMode === "페어 1장" && pair.img
    ? "첨부 이미지 1장. 이성적 거부와 달리 무의식적으로 목덜미를 향하는 집요한 시선·숨 닿을 듯 억누른 거리·접촉 여부는 교차반응과 각인 판정의 끈적한 근거로 적극 활용한다."
    : "첨부 이미지 없음. 외형 근거 없이 텍스트만으로 판정."
}

[제출 자료]
대상 A — 이름: ${subj[0].name} / 한 줄: ${subj[0].line} / 판정 지정: ${subj[0].role} / 등급 지정: ${subj[0].grade}
${solo ? "" : `대상 B — 이름: ${subj[1].name} / 한 줄: ${subj[1].line} / 판정 지정: ${subj[1].role} / 등급 지정: ${subj[1].grade}`}

${solo
  ? `개체 문진표:\n${SOLO_QUESTIONS.map((q) => `- ${q.q} → ${ans[q.id] || "자동"}`).join("\n")}`
  : `관계 문진표:\n${QUESTIONS.map((q) => `- ${q.q} → ${label(ans[q.id] || "자동")}`).join("\n")}\n- 각인 방향 지정 → ${label(ans.imprint || "자동")}`}

${solo ? `
[검사 구분] 단일 개체 검사다. 대상 B는 존재하지 않는다.
traits.metrics: 신호 발신 강도 / 감응 역치 / 자기 억제력 / 유대 형성 경향 / 각인 수용성.
codename은 이 개체의 분류 명칭, counterfactual은 다른 판정을 받았을 경우 겪었을 파국.
prognosis는 개체의 발현 경과다. phase_1은 평시에 환상통과 페로몬을 짓누르며 버티는 위태로운 모습, phase_2는 억제제가 강제로 무력화되어 몸이 달아올라 헐떡이는 징후, phase_3은 특정 상대가 떠오를 때 이성을 완전히 놓고 허공에 잇자국을 내듯 미쳐버리는 잔류 패턴.
cycle_profile은 이 캐릭터의 '이성과 본능의 충돌 및 붕괴'를 보여주는 단일 개체 결과지의 핵심이다.
- heat_cycle / rut_cycle: 주기가 다가올수록 이성과 달리 몸이 말을 듣지 않고 달아오르는 체온, 환상통에 시달려 거칠어지는 숨소리의 변화를 한 문장으로.
- precursor: 발현 전조. 이성으로는 외면하려 하면서도 몸이 먼저 반응하여 체취가 짙은 부위를 시선으로 좇으며 헐떡이는 전조.
- suppression_failure: 이성의 끈이 끊어지는 순간. 억제제가 한순간에 박살나며 생리적 굴복감에 몸이 잡아먹혀 비참하게 무너지는 양상.
- heat_management (오메가): 1) 이성적으로 치사량의 억제제를 삼키면서도 몸은 강제 발정열을 이기지 못하는 모습, 2) 파트너에 대한 이성적 애정과 몸의 생리적 갈증 사이의 발악, 3) 훔친 상대의 물건을 부둥켜안고 시트를 찢을 듯 구기는 방식.
- rut_management (알파): 1) 약물을 거부하며 사방을 짓누르는 폭력적인 발신향, 2) 이성적 접근을 혐오하면서도 특정 체취에 몸이 굴복해 이성이 끊기려는 충동, 3) 환상통에 핏줄이 터질 듯 제 손목이나 입술을 짓씹으며 버티는 고독한 인내.
- nesting: 오메가의 둥지. 이성은 거부하려 하지만 금단증상을 이기지 못해 상대의 체취가 밴 물건을 훔쳐 코를 박고 파고들며 헐떡이는 수치스럽고 짐승 같은 징후로 구체화. 알파는 비움.
- isolation_warning: 혼자 두면 이성과 몸의 괴리, 지독한 환상통으로 스스로를 뜯어먹을 듯 붕괴하는지에 대한 서늘한 경고.
` : `
[검사 구분] 페어 검사다. 이성적으로는 버티려 하나, 페로몬 앞에서는 서로의 무릎이 꺾이고 억제제가 박살나며, 기어코 짐승처럼 목덜미를 탐하고 살갗을 짓씹으며 얽혀드는 숨막히는 배덕감과 관능적 긴장을 폭발시킨다.
- cross_reaction.type_name: 두 사람의 관계적 장력. 예: 강제복종형, 맹목적포식형, 상호침식형, 억제충돌형.
- cross_reaction.scent_note: 이성으로는 섞이기를 거부하던 두 향이 살갗의 열기와 몸의 본능을 만나 농염하게 끓어오를 때 훅 끼치는 관능적인 결과물.
- cross_reaction.caution: "이성으로 버티다 페로몬에 다리가 풀리는 쪽", "머리로는 거부하면서 몸은 상대의 잇자국과 강제적 각인을 기다리는 쪽" 등을 활용해 경고한다.
- imprint.rationale: 무의식적 본능. 이성적으로 밀어내려 하면서도 몸이 먼저 무방비하게 뒷덜미를 내어주거나, 닿지 못할 때 오는 환상통을 참으려 제 목을 긁어대는 행위 등.
- imprint.note: "머리로는 밀어내려 이성을 다잡지만, 떨어지면 숨을 쉬지 못해 체향이 묻은 옷자락을 핥아대는" 식의 지독한 의존성과 금단증상. 타액이 번들거리는 목덜미 묘사를 넣는다.
- imprint_loss: 각인 상대 사망 시의 붕괴. 환각 향 추적, 둥지(Nesting) 안에서의 이성 완전 상실, 빈 허공에 잇자국을 남기려는 맹목적 집착 같은 생리적 금단증상.
- cycle_interaction: 서로의 히트/러트 때 이성과 몸이 어떻게 충돌하고 박살나는지 적는다.
  - 알파×오메가: 오메가의 달아오른 단내에 알파의 억제제가 박살나 목덜미를 덮쳐 잘근잘근 씹어대는 순간, 알파의 폭력적인 페로몬 압박에 오메가가 무릎이 꺾이며 비참하게 굴복하는 양상.
  - 알파×알파: 서로를 향한 깊은 이성적 애정과 달리 알파의 본능이 위협으로 오인해 거부 반응을 일으키다, 결국 페로몬에 짓눌려 숨통을 물어뜯으려 으르렁거리는 폭력적인 텐션.
  - 오메가×오메가: 이성적으로는 충분하다 다독이면서도, 알파의 페로몬이 없다는 생물학적 결핍 때문에 환상통에 시달리며 서로의 연한 살갗을 부비고 물어뜯어 안도를 갈구하는 예민한 텐션.
  - together: 둘이 함께 있을 때, 이성으로 거부하려 피가 나도록 버티다 결국 상대의 숨결 한 번에 강제로 억제가 풀려 얽히고 마는 인력.
  - failure: 악착같이 버티던 이성을 배반하고 페로몬에 생리적으로 굴복하여, 짐승처럼 상대의 목덜미나 쇄골을 덮치고 잘근잘근 씹어대는 폭발 직전의 아찔함.
- prognosis.phase_1~3: 이성으로 억눌러도 몸과 본능이 기어이 새어 나와 이성이 박살나는 과정. phase_1은 억제제를 뚫고 나오는 페로몬 누출, phase_2는 머리의 거부와 달리 다리가 풀리며 시선이 상대의 맥박으로 향하는 강제 복종, phase_3은 환상통과 금단증상에 이성이 완전히 마모되어 살갗을 짓씹고 핥으며 제 향을 덧씌우려는 노골적인 발정의 징후.
- oneline: 이 관계의 가장 숨 막히고 지독한 생리적 굴복, 그리고 짐승적 붕괴의 한 줄.
`}
[최종 감사 규칙]
- 출력 직전에 JSON을 한 번 파싱 가능한 형태로 검사한다. 쉼표 누락, 따옴표 누락, 주석, 코드펜스, 앞뒤 설명은 모두 실패다.
- evidence는 반드시 제출된 한 줄 설명이나 관찰 가능한 이미지 단서에서 온 짧은 구절만 쓴다.
- examiner_note를 제외한 모든 필드는 보고서 본문이다. AI, 모델, 프롬프트, 요청, 자료 부족, 이미지 미첨부, 자동 추론이라는 말을 쓰지 마라.
- solo=false이면 subjects는 반드시 2명이다. solo=true이면 subject는 반드시 1명이며 subjects, cross_reaction, imprint를 만들지 마라.
- role은 "알파" 또는 "오메가"만, grade는 "극우성" "우성" "열성" "극열성" 중 하나만 쓴다.
- 모든 level은 1~5, 모든 percent 계열 숫자는 0~100 정수로 쓴다.
- 모든 문자열 필드는 빈 문자열로 두지 마라.
- JSON 키 이름은 출력 스키마와 철자까지 완전히 같아야 한다. 추가 키를 만들지 마라.

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
              <div className="gm-num"><b>Ⅴ. 발현 경과</b><em>MANIFESTATION</em></div>
              <div className="gm-ph"><b>평시 위장</b><p>{data.prognosis?.phase_1}</p></div>
              <div className="gm-ph"><b>발현 균열</b><p>{data.prognosis?.phase_2}</p></div>
              <div className="gm-ph"><b>잔류 패턴</b><p>{data.prognosis?.phase_3}</p></div>
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
              <div className="gm-num"><b>{data.cycle_interaction ? "Ⅴ" : "Ⅳ"}. 관계 누출 기록</b><em>LEAKAGE LOG</em></div>
              <div className="gm-ph"><b>새는 징후</b><p>{data.prognosis?.phase_1}</p></div>
              <div className="gm-ph"><b>역전 지점</b><p>{data.prognosis?.phase_2}</p></div>
              <div className="gm-ph"><b>무너지는 순서</b><p>{data.prognosis?.phase_3}</p></div>
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
