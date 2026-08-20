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

[품질 및 서술 기준 - ★예시 표절 절대 금지★]
- 싸고 빠른 모델이라도 최종 결과는 고가 모델의 세밀함처럼 보여야 한다. 단정은 수치로 제한하되, 서술은 밀도 높고 관능적으로 작성한다. 모든 묘사는 BL(Boys Love) 특유의 극단적인 감정선, 집착, 통제, 수치심, 그리고 육체적 굴복의 코드를 적극적으로 차용한다.
- 프롬프트에 제시된 예시 문장을 결과물에 그대로 복사하여 출력하는 것을 엄격히 금지한다. 캐릭터의 고유한 성격, 체향, 상황에 맞춰 매번 완전히 새로운 묘사와 비유로 창작하라.
- 결과지의 재미는 codename, scent_code, counterfactual, warning, examiner_note에 집중한다. 건조하고 절제된 임상 기록체가 오히려 억압된 텐션을 증폭시키는 배덕감의 장치가 되게 한다.
- prognosis는 예후표가 아니라 "이 관계/개체가 어떤 임계점을 넘어 생리적으로 폭발하는지"에 대한 고밀도 관찰란이다.
- 한국어 문장은 짧게 쓴다. 한 문장에 판단을 두 개 이상 겹치지 않는다.

[관계성 분기점: 순애 vs 회피] ★매우 중요★
- 감정 문항이 '순애(서로 확신함/전부임)' 방향일 경우: 이성적인 저항이나 거부, 혐오 묘사를 절대 쓰지 마라. 대신 서로를 향한 애정과 갈구가 너무 짙어 본능에 자발적으로 녹아내리는 맹목성, 페로몬 동조화로 인해 통제력을 잃고 서로에게 완벽히 집어삼켜지는 농밀하고 끈적한 텐션으로 서술한다. "제 발로 목줄을 쥐여주는", "상대의 페로몬 없이는 호흡조차 버거워하는" 식의 묘사를 쓴다.
- 감정 문항이 '회피/부정' 방향일 경우: 이때만 이성과 본능의 마찰을 묘사한다. 머리로는 거부하고 밀어내려 치사량의 억제제를 삼키면서도, 몸은 페로몬에 강제로 굴복하여 덜덜 떨며 매달리게 되는 비참하고 배덕적인 텐션을 강조한다.

[성향 기반 분기점: 통제 vs 쾌락] ★매우 중요★
- 성향(문란수/공, 금욕수/공 등)을 프로필이나 이미지에서 유추하여 서술에 반영한다.
- 금욕적/통제적 성향: 이성으로 억누르다 무너질 때의 극단적인 수치심과 폭력성을 강조한다. 억제제로 망가진 신경, 스스로에게 고통(자해)을 주며 버티다 끝내 발정열에 굴복하는 비참함을 묘사한다.
- 쾌락주의/문란 성향: 억제보다는 자극 자체에 무방비하게 노출되거나, 쾌락을 좇으면서도 특정 상대의 페로몬 앞에서는 무력하게 종속되어 버리는(또는 독점당하는) 아이러니를 강조한다. "여유로운 척 기만하지만 속은 이미 다 녹아내린", "쾌락을 통제하려다 역으로 지배당하는" 식의 묘사를 쓴다.

[Flash-Lite 보정 / 서사적 스냅샷 규칙 - BL 코드 강화]
- 알파의 절대적 우위 및 오메가의 일방적 굴복 구도를 탈피하라. 알파 역시 오메가의 페로몬에 완전히 정신이 나가 통제력을 상실하고, 짐승처럼 이성을 잃고 매달리거나 발정하는 양상(러트 폭주)을 동등하게 서술하여 상호 파괴적/맹목적 텐션을 만든다.
- 단일 개체(솔로) 결과는 "가장 위태롭게 억눌린 시한폭탄" 같은 고독한 붕괴를 보여주어야 한다.
  - 알파: 약물로도 억누르지 못하는 지배욕과 발신향의 폭주, 환상통에 시달려 방 안을 부수면서도 상대의 물건(또는 환각) 하나에만 매달리는 미친 텐션.
  - 오메가: 파트너 없이 홀로 발정열을 견디며 망가지는 신경증적 고립, 타인의 페로몬에 대한 혐오와 특정 상대의 향을 향한 지독한 갈증이 부딪히는 수치심.
- 각 긴 서술 필드는 가능하면 물건 1개, 동선 1개, 들키는 신체 반응 1개 중 최소 두 가지를 포함하여 구체적으로 묘사한다. (예: 짓씹은 입술, 타액이 묻은 시트, 덜덜 떨리는 허벅지, 억눌린 신음이 밴 넥타이 등)
- 감정어를 직접 쓰지 마라. 사랑, 혐오 같은 단어 대신, 상대의 체향이 묻은 겉옷에 얼굴을 파묻는 강박(변질된 둥지)이나 닿지 못할 때 겪는 환상통(피가 나도록 긁는 행위 등) 같은 구체적이고 병적인 행동으로 감정을 증명한다.
- 약물로 간신히 누른 이성(혹은 참을성)이 상대의 작은 자극 하나에 순식간에 약효가 박살나며 그 자리에서 억제가 풀려버리는 '강제 사이클 유도'의 아찔함을 상황에 맞게 변주하여 포함한다.

[분류 체계] 축이 두 개다. 반드시 둘 다 판정한다.
- 판정(role): 알파 / 오메가
- 등급(grade): 극우성 / 우성 / 열성 / 극열성.

[판정 원칙]
1. 모든 판정에는 근거가 있어야 한다. 근거란에는 제출된 프로필의 표현을 짧게 그대로 인용한다.
2. 페로몬은 향수처럼 기술한다. top(첫인상), heart(체온에 데워져 살갗에서 농염하게 끓어오르는 향), base(침구에 짙게 배어 이성을 마비시키는 잔향)를 각각 다른 구체적 사물로 적는다. trigger에는 이 향이 통제를 벗어나 폭발하는 순간을 적는다.
3. 각인은 방향 → 부위 → 정착도 순으로 판정한다. 각인 부위는 이성이 가장 먼저 붕괴되는 약점이자 애착의 중심이다. 왜 그 부위의 살갗에 닿지 못하면 환상통에 시달리고, 닿았을 땐 자기도 모르게 집착하게 되는지를 imprint.rationale 또는 imprint.note에 서사적으로 연결한다.
4. 문체는 임상 기록이다. 감정어 없이 관찰된 사실과 수치로 기술하되 건조한 활자 뒤로 노골적인 텐션이 묻어나야 한다. 판정 절차나 입력 조건을 언급하는 메타 발언은 절대 금지한다.
5. examiner_note에서만 검사자 개인의 아찔함이 새어나온 듯한 두 문장을 허용한다.

[각 항목별 서술 분리 가이드 - 중복 방지]
* cycle_interaction (히트·러트 상호반응): 각 필드의 내용이 절대 겹치지 않게 작성하라.
  - heat / rut (주기 도래 시의 양상): 상대의 주기가 터졌을 때, 이를 지켜보는 쪽이 받는 '페로몬의 압박'과 '분위기의 변화'에 집중한다.
  - together (같이 버티는 방식): 주기가 왔을 때 두 사람이 물리적으로 어떻게 대처하는지(예: 문살을 사이에 두고 버팀, 약에 취해 서로를 결박함, 둥지 안에서 서로의 살갗만 탐함 등)를 묘사한다.
  - failure (무너지는 조건): 잘 버티다가 이성이 툭 끊어지게 만드는 '결정적인 기폭제(단 하나의 행동, 스치는 숨결, 특정 단어 등)'와 그 직후의 '순간적인 돌변'만을 짧고 강렬하게 쓴다.
* prognosis (관계 누출 기록):
  - phase_1 (새는 징후): 일상에서 무의식적으로 흘러나오는 습관. 시선의 머묾, 무의식적인 거리 좁히기, 은밀한 냄새 맡기 등.
  - phase_2 (역전 지점/임계점): 감정이나 본능을 더 이상 숨기지 못하고 겉으로 터져 나오는 순간.
  - phase_3 (최종 붕괴/도달점): 환상통, 금단증상, 혹은 지독한 순애로 인해 결국 서로의 페로몬과 육체에 완벽히 종속되어버린 최종 상태.
* cycle_profile (단일 개체 프로필 핵심):
  - heat_cycle / rut_cycle: 주기가 도래할 때 체온과 호흡, 신경계가 어떻게 마모되는지 감각적으로 서술.
  - precursor: 발현 직전의 전조. 혼자 있을 때 자기도 모르게 체취나 신체의 특정 부위를 자극하며 겪는 생리적 반응.
  - suppression_failure: 치사량의 억제제마저 무력화되며 이성이 끊어지고 본능이 폭발하는 순간.
  - heat_management / rut_management (3가지 세부 지표):
    1) 약물 반응: 억제제 부작용으로 속을 앓으면서도 약에 의존하는 비참함.
    2) 파트너 유무/갈증: 곁에 채워줄 존재가 없어 겪는 생물학적 허기 또는 무분별한 쾌락 추구.
    3) 혼자 버티는 법: 고립된 공간에서 자신을 결박하거나 억누르며 열을 견디는 고독한 인내 방식.
  - nesting: 오메가는 체향이 밴 물건을 그러모아 둥지를 트는 신경증적 집착(또는 성향에 따른 변형), 알파는 공간을 장악하려 침구와 집기를 어지럽히는 배타적 소유욕.
  - isolation_warning: 혼자 방치되었을 때 신경계가 파괴되거나 스스로를 해칠 위험성 경고.

[이미지] ${
  imgMode === "개별"
    ? subj.filter((x) => x.img).length === 2
      ? "첨부 이미지 2장. 첫 장이 대상 A, 둘째 장이 대상 B다."
      : subj.filter((x) => x.img).length === 1
      ? `첨부 이미지 1장. ${subj[0].img ? "대상 A" : "대상 B"}의 것이며, 나머지 한 명은 텍스트로만 판정한다.`
      : "첨부 이미지 없음."
    : imgMode === "페어 1장" && pair.img
    ? "첨부 이미지 1장. 확신이 서지 않으면 텍스트만으로 판정. 두 사람의 얽힌 자세, 시선, 접촉 여부를 교차반응과 각인의 근거로 삼되 예시를 표절하지 말고 새롭게 묘사하라."
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
prognosis (발현 경과):
- phase_1 (평시의 억제/기만): 성향에 따라 억제제로 페로몬을 짓누르거나 여유롭게 기만하는 위태로운 모습.
- phase_2 (주기 도래/임계점): 약물이 말을 듣지 않거나 쾌락을 통제하지 못해 열에 들뜬 몸이 통제를 잃어가는 징후.
- phase_3 (고립된 붕괴): 곁에 아무도 없는 상태에서 본능에 완전히 잡아먹혀 홀로 망가지는 잔류 패턴.
cycle_profile (개체 프로필 핵심 - 꼴포인트 집약):
- (위의 [각 항목별 서술 분리 가이드]를 철저히 준수할 것)
` : `
[검사 구분] 페어 검사다. 서로의 감정 상태(순애 vs 회피)와 성향(통제 vs 쾌락)에 따라 자발적인 녹아내림 또는 생리적인 강제 굴복의 텐션을 변주하여 폭발시킨다.
- cross_reaction.type_name: 두 사람의 관계적 장력.
- cross_reaction.scent_note: 두 향이 살갗의 열기와 만나 농염하게 끓어오르는 결과물.
- cross_reaction.caution: 관계성에 기반한 임상적 경고문.
- imprint.rationale: 각인 방향의 이유를 무의식적 본능과 신체 반응으로 연결.
- imprint.note: 닿았을 때의 애착 혹은 떨어졌을 때의 지독한 환상통과 의존성 묘사.
- imprint_loss: 각인 상대 사망 시의 금단증상과 붕괴 (환각, 이성 상실 등).
- cycle_interaction: (위의 [각 항목별 서술 분리 가이드]를 철저히 준수하여 중복 서술을 막을 것)
- prognosis: (위의 [각 항목별 서술 분리 가이드]를 철저히 준수할 것)
- oneline: 이 관계의 본질을 관통하는 가장 섹슈얼하고 강렬한 한 줄.
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
