import React, { useEffect, useState, useRef } from "react";
import { appLogin, IAP } from "@apps-in-toss/web-framework";
import html2canvas from "html2canvas";
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
const GEMINI_TIMEOUT_MS = 70000;
const PASS_TIMEOUT_MS = 15000;
const REPAIR_TIMEOUT_MS = 25000;
const MAX_GENERATION_ATTEMPTS = 3;
const MAX_EXPORT_CANVAS_SIDE = 8192;
const SITE_CODES = Object.keys(SITES);
const NON_DEFAULT_SITE_CODES = SITE_CODES.filter((code) => code !== "NP");
const GENERIC_SITE_CODES = SITE_CODES.filter((code) => !["NP", "CL"].includes(code));
const SITE_ALIASES = [
  [/NECK|목덜미|뒷목/i, "NP"],
  [/CLAVICLE|쇄골/i, "CL"],
  [/WRIST|손목/i, "WR"],
  [/SCAPULA|견갑/i, "SC"],
  [/EAR|귀/i, "ME"],
  [/CHEST|가슴|심장/i, "TH"],
  [/RIB|옆구리/i, "RB"],
  [/ANKLE|발목/i, "AN"],
  [/PALM|손바닥/i, "PL"],
  [/HAIRLINE|머리카락|목선/i, "HL"],
];
const SITE_EVIDENCE = {
  NP: /목덜미|뒷목|목선|목 뒤|목 뒤쪽|neck/i,
  CL: /쇄골|빗장뼈|clavicle/i,
  WR: /손목|맥박|wrist/i,
  SC: /견갑|등|어깨뼈|scapula/i,
  ME: /귀 뒤|귓불|귀밑|ear/i,
  TH: /가슴|심장|흉부|heart|chest/i,
  RB: /옆구리|갈비|늑골|rib/i,
  AN: /발목|복사뼈|ankle/i,
  PL: /손바닥|손금|palm/i,
  HL: /헤어라인|머리카락|목선|hairline/i,
};
const TEXT_FIXES = [
  [/숨숨오감/g, "숨과 오감"],
  [/숨숨/g, "숨"],
];

const FALLBACK_COPY = {
  cycleHeat: "주기 신호가 감지되는 즉시 상대의 발신향이 먼저 흔들리고, 주변 공기가 낮게 가라앉는다.",
  cycleRut: "러트 압력이 올라오는 순간 호흡 간격이 무너지고, 평소의 거리 조절이 가장 먼저 실패한다.",
  cycleTogether: "둘은 같은 공간에 머무르되 직접 닿는 시간을 제한하며, 억제제와 체향 사이에서 버티는 방식을 택한다.",
  cycleFailure: "가장 약한 조건은 상대가 평소보다 낮은 목소리로 이름을 부르는 순간이다.",
  phase1: "평시에는 시선과 동선이 먼저 새어 나온다. 상대가 지나간 자리만 한 박자 늦게 확인한다.",
  phase2: "임계점에서는 말보다 몸의 방향이 먼저 바뀐다. 피하려던 쪽이 먼저 가까운 거리를 만든다.",
  phase3: "최종 단계에서는 남은 체향과 소지품을 기준으로 생활 반경이 재편된다.",
};

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

function cleanReportText(value) {
  if (typeof value !== "string") return value;
  return TEXT_FIXES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function isBlank(value) {
  return typeof value !== "string" || !value.trim();
}

function stableHash(text = "") {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function deepCleanReportText(value) {
  if (Array.isArray(value)) return value.map(deepCleanReportText);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepCleanReportText(item)]));
  }
  return cleanReportText(value);
}

function normalizeSiteCode(code = "") {
  const raw = String(code || "").trim().toUpperCase();
  if (SITES[raw]) return raw;
  const hit = SITE_ALIASES.find(([pattern]) => pattern.test(raw));
  return hit ? hit[1] : raw;
}

function pickVariedSiteCode(subjects, answer, currentCode, report) {
  const evidence = [
    answer,
    ...subjects.flatMap((subject) => [subject?.name, subject?.line]),
    report?.imprint?.rationale,
    report?.imprint?.note,
  ].join(" ");
  const normalized = normalizeSiteCode(currentCode);
  if (SITES[normalized] && SITE_EVIDENCE[normalized]?.test(evidence)) return normalized;
  if (SITES[normalized] && !["NP", "CL"].includes(normalized)) return normalized;
  const pool = GENERIC_SITE_CODES.length ? GENERIC_SITE_CODES : NON_DEFAULT_SITE_CODES;
  return pool[stableHash(`${evidence}:${normalized}`) % pool.length] || "WR";
}

function ensureText(object, key, fallback) {
  if (object && isBlank(object[key])) object[key] = fallback;
}

function ensureManagement(list, labels) {
  const current = Array.isArray(list) ? list : [];
  return labels.map((label, index) => ({
    label: current[index]?.label?.trim() || label,
    note: current[index]?.note?.trim() || `${label} 항목에서 주기 반응이 관찰되며, 결과 확정 전 보정 기록으로 유지된다.`,
  }));
}

function normalizeImprintName(name, subjects, fallbackIndex) {
  const raw = String(name || "").trim();
  const found = subjects.find((subject) => {
    const subjectName = String(subject?.name || "").trim();
    return subjectName && raw.includes(subjectName);
  });
  return found?.name || subjects[fallbackIndex]?.name || raw;
}

function normalizeReport(rawReport, subjects, answer) {
  const report = deepCleanReportText(rawReport);
  const pairSubjects = subjects.slice(0, 2);

  if (report?.imprint) {
    report.imprint.site_code = pickVariedSiteCode(pairSubjects, answer, report.imprint.site_code, report);

    if (pairSubjects.length >= 2 && report.imprint.fixation !== "미형성") {
      if (answer === "A→B") {
        report.imprint.from = pairSubjects[0].name;
        report.imprint.to = pairSubjects[1].name;
      } else if (answer === "B→A") {
        report.imprint.from = pairSubjects[1].name;
        report.imprint.to = pairSubjects[0].name;
      } else {
        report.imprint.from = normalizeImprintName(report.imprint.from, pairSubjects, 0);
        report.imprint.to = normalizeImprintName(report.imprint.to, pairSubjects, 1);
      }
    }
  }

  if (report?.cycle_interaction) {
    ensureText(report.cycle_interaction, "heat", FALLBACK_COPY.cycleHeat);
    ensureText(report.cycle_interaction, "rut", FALLBACK_COPY.cycleRut);
    ensureText(report.cycle_interaction, "together", FALLBACK_COPY.cycleTogether);
    ensureText(report.cycle_interaction, "failure", FALLBACK_COPY.cycleFailure);
  }

  if (report?.prognosis) {
    ensureText(report.prognosis, "phase_1", FALLBACK_COPY.phase1);
    ensureText(report.prognosis, "phase_2", FALLBACK_COPY.phase2);
    ensureText(report.prognosis, "phase_3", FALLBACK_COPY.phase3);
  }

  if (report?.cycle_profile) {
    ensureText(report.cycle_profile, "heat_cycle", "히트 주기 기록은 체온 상승과 호흡 간격 변화 중심으로 보정 기재된다.");
    ensureText(report.cycle_profile, "rut_cycle", "러트 주기 기록은 발신향 압력과 통제력 저하 중심으로 보정 기재된다.");
    ensureText(report.cycle_profile, "precursor", "발현 전조는 시선, 호흡, 체향 추적 행동에서 먼저 관찰된다.");
    ensureText(report.cycle_profile, "suppression_failure", "억제가 깨지는 순간에는 가장 가까운 체향 단서에 반응이 집중된다.");
    ensureText(report.cycle_profile, "nesting", "체향이 남은 물건을 기준으로 안정 구역을 재구성한다.");
    ensureText(report.cycle_profile, "isolation_warning", "장시간 고립 시 판단 저하와 주기 반응 악화가 동반될 수 있다.");
    report.cycle_profile.heat_management = ensureManagement(report.cycle_profile.heat_management, ["약물 반응", "파트너 유무", "혼자 버티는 법"]);
    report.cycle_profile.rut_management = ensureManagement(report.cycle_profile.rut_management, ["약물 반응", "파트너 유무", "혼자 버티는 법"]);
  }

  return report;
}

function hasCompleteReport(report, solo) {
  if (solo) {
    const profile = report?.cycle_profile || {};
    const prognosis = report?.prognosis || {};
    return Boolean(
      report?.subject &&
        !isBlank(report.subject.name) &&
        !isBlank(report.subject.role) &&
        !isBlank(report.subject.grade) &&
        !isBlank(profile.heat_cycle) &&
        !isBlank(profile.rut_cycle) &&
        !isBlank(profile.precursor) &&
        !isBlank(profile.suppression_failure) &&
        Array.isArray(profile.heat_management) &&
        profile.heat_management.length >= 3 &&
        Array.isArray(profile.rut_management) &&
        profile.rut_management.length >= 3 &&
        !isBlank(prognosis.phase_1) &&
        !isBlank(prognosis.phase_2) &&
        !isBlank(prognosis.phase_3)
    );
  }

  const cycle = report?.cycle_interaction || {};
  const prognosis = report?.prognosis || {};
  return Boolean(
    Array.isArray(report?.subjects) &&
      report.subjects.length >= 2 &&
      report.cross_reaction &&
      report.imprint &&
      !isBlank(cycle.heat) &&
      !isBlank(cycle.rut) &&
      !isBlank(cycle.together) &&
      !isBlank(cycle.failure) &&
      !isBlank(prognosis.phase_1) &&
      !isBlank(prognosis.phase_2) &&
      !isBlank(prognosis.phase_3)
  );
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(message);
        error.name = "TimeoutError";
        reject(error);
      }, ms);
    }),
  ]);
}

function escapeJsonStringControls(text) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      output += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      output += char;
      continue;
    }
    if (inString && char === "\n") {
      output += "\\n";
      continue;
    }
    if (inString && char === "\r") continue;
    if (inString && char === "\t") {
      output += "\\t";
      continue;
    }
    output += char;
  }
  return output;
}

function parseReportJsonPayload(raw) {
  const clean = String(raw || "").replace(/```json|```/g, "").trim();
  const a = clean.indexOf("{");
  const b = clean.lastIndexOf("}");
  if (a < 0 || b <= a) {
    return { ok: false, reason: "NO_JSON", candidate: clean };
  }

  const candidate = clean.slice(a, b + 1);
  const variants = [
    candidate,
    candidate.replace(/,\s*([}\]])/g, "$1"),
    escapeJsonStringControls(candidate).replace(/,\s*([}\]])/g, "$1"),
  ];

  let lastError = null;
  for (const variant of variants) {
    try {
      return { ok: true, value: JSON.parse(variant), candidate: variant };
    } catch (error) {
      lastError = error;
    }
  }
  return { ok: false, reason: "INVALID_JSON", candidate, error: lastError };
}

function extractGeminiText(body) {
  return (body?.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("");
}

function responseSchemaForMode(solo) {
  return solo
    ? `{"subject":{"name":"","role":"","grade":"","confidence":0,"pheromone":{"family":"","top":"","heart":"","base":"","intensity":0,"persistence":"","diffusion":"","trigger":"","scent_code":""},"evidence":["",""],"remarks":""},"codename":"","rarity":{"total":0,"count":0},"counterfactual":"","warning":"","oneline":"","traits":{"metrics":[{"label":"신호 발신 강도","level":0},{"label":"감응 역치","level":0},{"label":"자기 억제력","level":0},{"label":"유대 형성 경향","level":0},{"label":"각인 수용성","level":0}],"note":""},"imprint_history":{"status":"","note":""},"cycle_profile":{"heat_cycle":"","rut_cycle":"","precursor":"","suppression_failure":"","heat_management":[{"label":"","note":""},{"label":"","note":""},{"label":"","note":""}],"rut_management":[{"label":"","note":""},{"label":"","note":""},{"label":"","note":""}],"nesting":"","isolation_warning":""},"prognosis":{"phase_1":"","phase_2":"","phase_3":""},"examiner_note":""}`
    : `{"subjects":[{"name":"","role":"","grade":"","confidence":0,"pheromone":{"family":"","top":"","heart":"","base":"","intensity":0,"persistence":"","diffusion":"","trigger":"","scent_code":""},"evidence":["",""],"remarks":""}],"codename":"","rarity":{"total":0,"count":0},"counterfactual":"","warning":"","oneline":"","cross_reaction":{"type_name":"","compatibility":0,"scent_sync":0,"scent_note":"","metrics":[{"label":"유대 형성 속도","level":0},{"label":"신호 간섭도","level":0},{"label":"상호 억제 가능성","level":0},{"label":"분리 내성","level":0},{"label":"장기 안정성","level":0}],"caution":""},"imprint":{"from":"","to":"","site_code":"","fixation":"","stability":0,"rationale":"","note":""},"imprint_loss":{"a":"","b":"","note":""},"cycle_interaction":{"heat":"","rut":"","together":"","failure":""},"prognosis":{"phase_1":"","phase_2":"","phase_3":""},"examiner_note":""}`;
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

function makeImageEvidence({ solo, imgMode, subjects, pair }) {
  const joint = imgMode === "페어 1장" && pair?.img;
  const items = joint
    ? [{ label: "동시 촬영 검체", name: "2개체 페어 이미지", img: pair.img, mime: pair.mime, adj: { ...(pair.adj || DEF_ADJ) } }]
    : subjects
        .slice(0, solo ? 1 : 2)
        .map((subject, index) => ({
          label: solo ? "대상 검체" : `개체 ${index === 0 ? "A" : "B"} 검체`,
          name: subject.name || (solo ? "대상" : `개체 ${index === 0 ? "A" : "B"}`),
          img: subject.img,
          mime: subject.mime,
          adj: { ...(subject.adj || DEF_ADJ) },
        }))
        .filter((item) => item.img);

  return {
    joint,
    caption: joint ? "제출 검체 참조 이미지 · 2개체 동시 촬영" : "제출 검체 참조 이미지",
    items,
  };
}

function ReportSpecimens({ evidence, solo, imgMode, subjects, pair, report }) {
  const fallback = makeImageEvidence({ solo, imgMode, subjects, pair });
  const finalEvidence = evidence?.items?.length ? evidence : fallback;
  const { joint, items, caption } = finalEvidence;
  const reportSubjects = solo ? [report?.subject] : report?.subjects || [];

  if (!items.length) return null;

  return (
    <figure className={`gm-specimens ${joint ? "gm-specimens-joint" : ""}`}>
      <div className="gm-specimens-head">
        <b>IMAGE EVIDENCE</b>
        <span>{caption}</span>
      </div>
      <div className="gm-specimens-grid">
        {items.map((item, index) => (
          <div className="gm-specimen" key={`${item.label}-${index}`}>
            <div className="gm-specimen-strip">
              <span>{item.label}</span>
              <b>{joint ? "JOINT" : index === 0 ? "A" : "B"}</b>
            </div>
            <div className="gm-specimen-body">
              <div className="gm-specimen-photo">
                <img
                  src={`data:${item.mime || "image/jpeg"};base64,${item.img}`}
                  alt=""
                  style={{ transform: imageTransform(item.adj || DEF_ADJ) }}
                />
              </div>
              <div className="gm-specimen-profile">
                {joint ? (
                  (reportSubjects.length ? reportSubjects : subjects.slice(0, 2)).map((subject, subjectIndex) => (
                    <div className="gm-specimen-row" key={subjectIndex}>
                      <span>{subjectIndex === 0 ? "A" : "B"}</span>
                      <b>{subject?.name || (subjectIndex === 0 ? "개체 A" : "개체 B")}</b>
                      <i>
                        {subject?.grade || "미판정"} · {subject?.role || "미판정"}
                      </i>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="gm-specimen-name">{reportSubjects[index]?.name || item.name}</div>
                    <table>
                      <tbody>
                        <tr>
                          <th>CLASS</th>
                          <td>{reportSubjects[index]?.role || "미판정"}</td>
                        </tr>
                        <tr>
                          <th>GRADE</th>
                          <td>{reportSubjects[index]?.grade || "미판정"}</td>
                        </tr>
                        <tr>
                          <th>SCENT</th>
                          <td>{reportSubjects[index]?.pheromone?.family || reportSubjects[index]?.pheromone?.scent_code || "미기록"}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="gm-specimen-lines">
                      {(reportSubjects[index]?.evidence || []).slice(0, 2).map((line, lineIndex) => (
                        <p key={lineIndex}>{line}</p>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}

function Codename({ data }) {
  const r = data.rarity || {};
  const pct = r.total && r.count ? ((r.count / r.total) * 100).toFixed(3) : null;
  if (!data.codename && !pct) return null;
  return (
    <div className="gm-codename">
      <div>
        <span>검체 코드</span>
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
  const [savingImage, setSavingImage] = useState(false);
  const [crop, setCrop] = useState(null);
  const [no] = useState(caseNo);
  const sheetRef = useRef(null);
  const requestSeq = useRef(0);
  const activeController = useRef(null);
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
      const body = await withTimeout(
        apiFetch("/passes", { token }),
        PASS_TIMEOUT_MS,
        "이용권 조회가 지연되었습니다."
      );
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
    if (!el || savingImage) return;
    setSavingImage(true);
    setErr("");
    try {
      await document.fonts?.ready?.catch?.(() => {});
      const width = Math.ceil(el.scrollWidth);
      const height = Math.ceil(el.scrollHeight);
      const maxRatio = Math.min(MAX_EXPORT_CANVAS_SIDE / width, MAX_EXPORT_CANVAS_SIDE / height);
      const ratio = Math.max(0.35, Math.min(1.25, window.devicePixelRatio || 1, maxRatio));
      const canvas = await html2canvas(el, {
        allowTaint: true,
        backgroundColor: "#fcfcf8",
        logging: false,
        scale: ratio,
        scrollX: 0,
        scrollY: -window.scrollY,
        useCORS: true,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        ignoreElements: (node) => Boolean(node?.classList?.contains("gm-actions")),
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("empty image blob");

      const filename = `${no}.png`;
      if (typeof File !== "undefined" && navigator.share) {
        const file = new File([blob], filename, { type: "image/png" });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: "캐릭터 리포트" });
            return;
          } catch (error) {
            if (error?.name === "AbortError") return;
          }
        }
      }

      const imageUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = filename;
      a.href = imageUrl;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.open(imageUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(imageUrl), 30000);
    } catch (error) {
      setErr(`결과 이미지를 저장하지 못했습니다 — ${error?.message || "다시 시도해 주십시오."}`);
    } finally {
      setSavingImage(false);
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

  const backToForm = () => {
    activeController.current?.abort();
    requestSeq.current += 1;
    setStage("input");
    setData(null);
    setErr("");
    setReject("");
    setStep(0);
    setSavingImage(false);
  };

  async function run() {
    if (stage === "running") return;
    if (missing.length) {
      setErr(`미기재 항목이 있습니다 — ${missing.join(" · ")}`);
      return;
    }
    if (!isAuthenticated) {
      setErr("토스 로그인 후 검사를 접수할 수 있습니다.");
      return;
    }

    activeController.current?.abort();
    const runId = requestSeq.current + 1;
    requestSeq.current = runId;
    const fail = (msg) => {
      if (requestSeq.current !== runId) return;
      setErr(msg);
      setStage("input");
    };

    setStage("running");
    setStep(0);
    setData(null);
    setErr("");
    setReject("");
    const imageEvidence = makeImageEvidence({ solo, imgMode, subjects: subj, pair });

    let passes = null;
    try {
      passes = await withTimeout(
        refreshPasses(authToken),
        PASS_TIMEOUT_MS,
        "이용권 확인이 지연되었습니다."
      );
    } catch (error) {
      return fail(`${error?.message || "이용권 확인에 실패했습니다."} 이용권은 차감되지 않았습니다.`);
    }
    if (requestSeq.current !== runId) return;
    if (!passes || Number(passes.totalRemainingUses || 0) < 1) {
      setErr(PURCHASE_MOCK ? "사용 가능한 이용권이 없습니다. 테스트 이용권을 먼저 발급해 주십시오." : "사용 가능한 이용권이 없습니다.");
      setStage("input");
      return;
    }
    const tick = setInterval(() => {
      if (requestSeq.current === runId) setStep((s) => (s + 1) % LOADING.length);
    }, 2600);
    let timeout = null;

    const prompt = `당신은 성선의학연구소의 감별 담당 임상병리사다. 제출된 두 개체의 프로필과 이미지를 근거로 등급 감별·교차반응·각인 부위 검사 결과 보고서를 작성한다.

[고정 운영 절차]
출력 전 내부적으로만 다음 순서를 수행하고, 이 절차나 추론 과정은 절대 출력하지 않는다.
1. 입력 증거표 작성: 각 대상별 한 줄 설명, 지정 판정, 지정 등급, 문진 응답, 이미지 단서를 분리한다.
2. 판정 초안 작성: role, grade, confidence, pheromone, cross_reaction/imprint 또는 traits/imprint_history를 먼저 채운다.
3. 일관성 감사: 지정값 우선, role과 grade 독립성, 동일 극단 등급 금지, 감정 문항과 각인 안정도, 향 계열과 scent_sync, 부위 코드 제약을 서로 대조한다.
4. 문체 감사: 모든 서술을 검사소 임상 기록처럼 고친다. 판정 방법, 입력 부족, 이미지 여부, 모델/프롬프트/JSON 같은 메타 설명은 제거한다.
5. JSON 감사: 최상위 키와 중첩 키를 출력 스키마와 맞추고, 누락 필드는 빈 문자열/0/빈 배열이 아니라 의미 있는 최소값으로 채운다.

[품질 및 서술 기준 - ★예시 표절 절대 금지★]
- 최종 결과는 저가 모델처럼 보이면 실패다. 모든 필드는 "팬이 캡처해 저장하고 싶어 하는 임상 스냅샷"이어야 한다.
- 단순 프로필 나열을 금지한다. 말투, 시선, 손버릇, 동선, 소지품, 체향의 잔류, 약물 의존, 각인 부위 반응 중 최소 두 가지를 엮어 장면처럼 쓴다.
- 노골적인 행위 묘사 대신, 통제 실패 직전의 긴장과 관찰 가능한 신체 반응을 쓴다. 호흡, 맥박, 손끝, 체온, 거리, 냄새, 물건의 위치로 감정을 증명한다.
- 금지: "좋아한다", "사랑한다", "집착한다", "불안하다", "끌린다", "무너진다", "압도된다" 같은 직접 감정어와 뻔한 단어.
- 대체: "시선이 맥박 뛰는 곳에 고정됨", "상대의 겉옷만 다른 의자에 걸어 둠", "약병 라벨을 찢어 감춤", "문손잡이를 잡은 손끝이 식음"처럼 관찰 기록으로 쓴다.
- 프롬프트의 예시 문장을 그대로 복사하지 마라. 캐릭터 이름, 한 줄 설명, 문진 답변, 이미지 단서를 결합해 매번 새로운 문장으로 만든다.
- 결과지의 재미는 codename, scent_code, cross_reaction.type_name, imprint.site_code, warning, examiner_note에 집중한다.
- prognosis는 예후표가 아니다. "언제 티 나는지 → 어느 순간 역전되는지 → 결국 무엇을 못 버리는지"를 기록하는 누출 관찰란이다.
- 한국어 문장은 짧게 쓴다. 한 문장에 판단을 두 개 이상 겹치지 않는다.
- 각 긴 서술 필드는 45~95자 사이를 목표로 한다. 너무 길게 쓰지 말고, JSON을 깨뜨릴 따옴표와 괄호 남발을 피한다.

[관계성 분기점: 순애 vs 회피(혐관)] ★매우 중요★
- 관계 문진표의 "관계 결" 답변을 최우선으로 따른다. "순애", "순애인데 숨김"은 순애 방향이다. "혐관", "혐관인데 못 놓음"은 회피/부정(혐관) 방향이다. "겉으론 비즈니스"는 행동은 절제하되 동선과 소지품에서 새는 쪽으로 쓴다.
- 각 개체의 "이성적 태도"와 "본능적 반응"이 다르면 반드시 그 모순을 핵심 꼴포인트로 쓴다. 예: 철저한 무관심 + 본능적 동요, 다정함 + 파괴적 소유욕, 노골적 혐오 + 강제적 안정 반응.
- A→B와 B→A의 태도/반응이 다르면 비대칭 관계로 쓴다. 이성적 태도는 말투와 거리 조절에, 본능적 반응은 호흡·동선·소지품·체향 추적 행동에 반영한다.
- 순애 방향: 거부나 혐오 묘사를 쓰지 마라. 대신 상대가 곁에 있을 때만 안정되는 습관, 같은 향으로 물드는 소지품, 말없이 서로의 자리를 비워두는 행동으로 확신을 보인다.
- 회피/부정 방향: 말로는 밀어내지만 몸의 경로와 물건 배치가 이미 상대를 향하는 모순을 쓴다. 문 앞에서 멈춘 발, 버리지 못한 약병, 숨겨 둔 겉옷 같은 증거를 남긴다.
- 혐관이어도 무작정 폭력적으로 쓰지 마라. 통제권을 빼앗기지 않으려는 미세한 기싸움과, 먼저 건드린 쪽이 예상 밖 반응에 흔들리는 역전을 반드시 넣는다.
- 순애여도 밋밋하게 쓰지 마라. 너무 익숙해서 더 위험한 안정감, 상대가 없을 때만 드러나는 금단, 같은 침묵을 공유하는 습관을 쓴다.

[성향 기반 분기점: 통제 vs 해방] ★매우 중요★
- 금욕적/통제적 성향: 억제제를 정리하는 방식, 기록지의 글씨 압력, 손톱자국, 잠긴 문, 일정표의 빈칸으로 통제 강박을 보여준다.
- 쾌락주의/문란 성향: 여유로운 척하지만 특정 상대 앞에서만 농담이 끊기거나, 향수 대신 상대의 잔향을 덮어쓰는 식의 예외를 만든다.
- 회피 성향: 도망가는 쪽은 실제로 멀어지지 못한다. 가장 가까운 출구, 가장 먼 의자, 그러나 상대 물건이 있는 방향으로 돌아가는 시선을 쓴다.
- 직진 성향: 기다리는 쪽은 말보다 공간을 먼저 점유한다. 문 앞, 창가, 침구, 겉옷, 물컵처럼 상대가 지나갈 자리의 흔적을 남긴다.

[각인(Imprint)의 해석과 텐션] ★매우 중요★
- 강제(fixation: 강제): 혐관에서 주로 발생. 이성은 거부하지만 부위 반응, 호흡, 체향 추적 습관이 먼저 답을 말하는 상태다.
- 상흔(fixation: 상흔): 알파x알파, 오메가x오메가에서 주로 사용한다. 생물학적 각인이 아니라 반복 접촉과 흉터가 만든 영역 표식이다.
- 거부(fixation: 거부): 각인 시도가 끊겨 반쪽짜리 반응만 남은 상태다. 가까우면 거부하고, 멀어지면 같은 부위를 확인하는 모순을 쓴다.
- 완전/표층: 순애이거나 안정된 각인일 경우 사용한다. 안정감이 곧 약점이 되는 방식으로 쓴다.
- 각인 부위는 단순 위치가 아니다. 닿았을 때의 반응, 닿지 않을 때의 금단, 상대 사망 시 버리지 못하는 물건을 함께 연결한다.
- 각인 부위 선정 원칙: 목덜미와 쇄골을 기본값으로 쓰지 마라. 손목 안쪽은 숨기는 관계, 귀 뒤는 소리와 호흡, 견갑골 사이는 등 돌림과 방어, 왼쪽 가슴은 심박, 옆구리는 회피, 발목 안쪽은 도망 실패, 손바닥은 손버릇, 머리카락 선은 습관적 접촉에 배정한다.

[Flash-Lite 보정 / 서사적 스냅샷 규칙]
- 알파의 절대 우위와 오메가의 일방 수동 구도를 피한다. 알파도 흔들리고, 오메가도 공간을 점유하며, 같은 형질끼리는 통제권 싸움으로 장력을 만든다.
- 각 문단은 하나의 장면으로 쓴다. "언제", "무엇을", "어떤 습관으로"가 보여야 한다.
- 주기 관련 서술은 약물 의존도, 상대 존재 여부, 혼자 버틸 때의 방식이 하나의 인과로 이어져야 한다.
- 이미지가 있으면 외형 단서를 반드시 하나 이상 evidence 또는 remarks에 반영한다. 색, 자세, 표정, 거리, 시선, 손의 위치 중 하나를 사용한다.
- 이미지가 없어도 "이미지 없음"이라고 쓰지 말고, 제출된 텍스트와 문진표만 근거로 확정된 것처럼 보고서 문체를 유지한다.
- 같은 표현을 반복하지 마라. 특히 목덜미, 쇄골, 무너짐, 금단, 환상통, 약효, 숨결이 모든 필드에 반복되면 실패다.

[분류 체계 및 판정 원칙]
- 판정(role): 알파 / 오메가
- 등급(grade): 극우성 / 우성 / 열성 / 극열성.
- 모든 판정에는 근거가 있어야 하며, 제출된 프로필을 짧게 인용한다.
- 페로몬: top(첫인상), heart(가까운 거리에서 선명해지는 중심 향), base(공간과 소지품에 남는 잔향)를 구체적 사물로 적고, trigger에는 통제를 흐트러뜨리는 기폭제를 적는다.
- 각인은 방향 → 부위 → 정착도(미형성/표층/완전/강제/상흔/거부) 순으로 판정한다.
   - 각인 부위는 자동으로 목덜미를 고르지 마라. 제출 자료의 성향과 관계 역학에 따라 NP(목덜미), CL(쇄골 아래), WR(손목 안쪽), SC(견갑골 사이), ME(귀 뒤), TH(왼쪽 가슴), RB(옆구리), AN(발목 안쪽), PL(손바닥), HL(뒷목 머리카락 선) 전체에서 다양하게 선택한다.
   - 목덜미(NP)와 쇄골(CL)은 제출 자료에 직접적인 목/쇄골 단서가 있을 때만 우선한다. 단서가 없으면 WR, SC, ME, TH, RB, AN, PL, HL 중에서 성향에 맞춰 고른다.
- 문체는 임상 기록이다. 감정어 없이 관찰된 사실로 기술하되 노골적인 텐션이 묻어나야 한다. 메타 발언은 절대 금지한다.
- examiner_note에서만 검사자 개인의 아찔함이 새어나온 듯한 두 문장을 허용한다.

[각 항목별 서술 분리 가이드 - 중복 방지]
* cycle_interaction (히트·러트 상호반응): 각 필드의 내용이 절대 겹치지 않게 작성하라.
  - heat / rut (주기 도래 시의 양상): 상대의 주기가 터졌을 때, 이를 지켜보는 쪽이 받는 '페로몬의 압박'과 '분위기의 변화'에 집중한다.
  - together (같이 버티는 방식): 주기가 왔을 때 두 사람이 물리적으로 어떻게 대처하는지(예: 문살을 사이에 두고 버팀, 약기운에 기대 서로의 손목을 묶어 둠, 둥지 안에서 일정한 거리만 허용함 등)를 묘사한다.
  - failure (무너지는 조건): 잘 버티다가 이성이 툭 끊어지게 만드는 '결정적인 기폭제(단 하나의 행동, 스치는 숨결, 특정 단어 등)'와 그 직후의 '순간적인 돌변'만을 짧고 강렬하게 쓴다.
* prognosis (관계 누출 기록):
  - phase_1 (새는 징후): 일상에서 무의식적으로 흘러나오는 습관. 시선의 머묾, 무의식적인 거리 좁히기, 은밀한 냄새 맡기 등.
  - phase_2 (역전 지점/임계점): 감정이나 본능을 더 이상 숨기지 못하고 겉으로 터져 나오는 순간.
  - phase_3 (최종 도달점): 환상통, 금단증상, 혹은 지독한 순애로 인해 결국 서로의 체향과 생활 반경을 버리지 못하는 최종 상태.
* cycle_profile (단일 개체 프로필 핵심):
  - heat_cycle / rut_cycle: 주기가 도래할 때 체온과 호흡, 신경계가 어떻게 마모되는지 감각적으로 서술.
  - precursor: 발현 직전의 전조. 혼자 있을 때 자기도 모르게 체취나 신체의 특정 부위를 자극하며 겪는 생리적 반응.
  - suppression_failure: 과용 직전의 억제제마저 무력화되며 이성이 끊기려는 순간.
  - heat_management / rut_management (3가지 세부 지표):
    1) 약물 반응: 억제제 부작용으로 속을 앓으면서도 약에 의존하는 비참함.
    2) 파트너 유무/갈증: 곁에 안정시킬 존재가 없어 겪는 생물학적 허기 또는 무분별한 접촉 추구.
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
- phase_1: 평시의 위태로운 억제나 기만.
- phase_2: 약물이 무력화되며 통제를 잃어가는 징후.
- phase_3: 곁에 아무도 없는 상태에서 본능에 잡아먹혀 홀로 무너지는 고립된 붕괴.
cycle_profile (개체 프로필 핵심):
- (위의 [각 항목별 서술 분리 가이드]를 철저히 준수할 것)
` : `
[검사 구분] 페어 검사다. 관계성(순애/혐관), 성향, 각인 상태(강제/상흔 등)에 따라 자발적 안정 또는 생리적 반발의 텐션을 변주하여 폭발시킨다.
- cross_reaction.type_name: 두 사람의 관계적 장력.
- cross_reaction.scent_note: 두 향이 농염하게 끓어오르는 결과물.
- cross_reaction.caution: 관계성에 기반한 임상적 경고문.
- imprint.rationale: 각인 방향의 이유를 무의식적 본능과 신체 반응으로 연결.
- imprint.note: 닿았을 때의 애착(또는 수치심)과 떨어졌을 때의 지독한 환상통 묘사.
- imprint_loss: 각인 상대 사망 시의 금단증상과 환각.
- cycle_interaction: (위의 [각 항목별 서술 분리 가이드]를 철저히 준수할 것)
- prognosis: (위의 [각 항목별 서술 분리 가이드]를 철저히 준수할 것)
- oneline: 이 관계의 본질을 관통하는 가장 강렬하고 공유하기 좋은 한 줄.
`}
[최종 감사 규칙]
- 출력 직전에 JSON을 한 번 파싱 가능한 형태로 검사한다. 쉼표 누락, 따옴표 누락, 주석, 코드펜스, 앞뒤 설명은 모두 실패다.
- evidence는 반드시 제출된 한 줄 설명이나 관찰 가능한 이미지 단서에서 온 짧은 구절만 쓴다.
- from/to/name에는 제출된 이름을 한 글자도 바꾸지 말고 그대로 쓴다. 임의 자모, 별명, 반복 음절을 붙이지 마라.
- site_code는 반드시 NP, CL, WR, SC, ME, TH, RB, AN, PL, HL 중 하나만 쓴다. NECK-01 같은 임의 코드를 만들지 마라.
- 의미가 불명확한 조어, 실수처럼 보이는 반복어, 사전에 없는 결합어를 만들지 마라.
- examiner_note를 제외한 모든 필드는 보고서 본문이다. AI, 모델, 프롬프트, 요청, 자료 부족, 이미지 미첨부, 자동 추론이라는 말을 쓰지 마라.
- solo=false이면 subjects는 반드시 2명이다. solo=true이면 subject는 반드시 1명이며 subjects, cross_reaction, imprint를 만들지 마라.
- role은 "알파" 또는 "오메가"만, grade는 "극우성" "우성" "열성" "극열성" 중 하나만 쓴다.
- 모든 level은 1~5, 모든 percent 계열 숫자는 0~100 정수로 쓴다.
- 모든 문자열 필드는 빈 문자열로 두지 마라.
- JSON 문자열 내부에 실제 줄바꿈을 넣지 마라. 줄바꿈이 필요하면 \\n으로 이스케이프한다.
- cycle_interaction의 heat/rut/together/failure와 cycle_profile의 heat_cycle/rut_cycle/precursor/suppression_failure/management/nesting/isolation_warning은 절대 비우지 마라.
- JSON 키 이름은 출력 스키마와 철자까지 완전히 같아야 한다. 추가 키를 만들지 마라.

[출력] 어떤 경우에도 아래 JSON만 출력한다. 코드펜스·설명·서두·반려 사유를 붙이지 마라.
${responseSchemaForMode(solo)}`;

    const buildRequestParts = (text) => {
      const requestParts = [{ text }];
      if (imgMode === "개별") {
        subj.forEach((s) => {
          if (s.img)
            requestParts.push({
              inline_data: { mime_type: s.mime || "image/jpeg", data: s.img },
            });
        });
      } else if (imgMode === "페어 1장" && pair.img) {
        requestParts.push({
          inline_data: { mime_type: pair.mime || "image/jpeg", data: pair.img },
        });
      }
      return requestParts;
    };

    const callReportEndpoint = async ({ requestParts, phase, generationConfig, ms }) => {
      const controller = new AbortController();
      const localTimeout = setTimeout(() => controller.abort(), ms);
      activeController.current = controller;
      timeout = localTimeout;
      try {
        const res = await fetch(GEMINI_PROXY_ENDPOINT, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            reportMode: solo ? "solo" : "pair",
            phase,
            contents: [{ role: "user", parts: requestParts }],
            generationConfig,
          }),
        });
        if (requestSeq.current !== runId) return;

        const responseText = await res.text();
        if (requestSeq.current !== runId) return;
        let j;
        try {
          j = JSON.parse(responseText);
        } catch {
          const detail = responseText.replace(/\s+/g, " ").trim().slice(0, 180);
          throw new Error(`서버 응답을 읽지 못했습니다 (HTTP ${res.status})${detail ? ` — ${detail}` : ""}`);
        }
        return { res, j };
      } finally {
        clearTimeout(localTimeout);
        if (timeout === localTimeout) timeout = null;
        if (activeController.current === controller) activeController.current = null;
      }
    };

    try {
      const chargeKey = makeChargeKey();
      let parsed = null;
      let chargeSessionId = "";
      let lastRaw = "";
      let lastError = "결과가 완성되지 않아 이용권은 차감되지 않았습니다.";

      for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
        if (requestSeq.current !== runId) return;
        const retrySuffix =
          attempt === 1
            ? ""
            : `\n\n[자동 재시도 ${attempt}/${MAX_GENERATION_ATTEMPTS}]\n이전 응답은 JSON 형식 또는 필수 항목 검증에 실패했다. 이번에는 각 긴 서술을 한 문장으로 줄이고, 따옴표가 필요한 표현을 피하며, 반드시 유효한 JSON 하나만 출력한다.`;
        const generated = await callReportEndpoint({
          requestParts: buildRequestParts(`${prompt}${retrySuffix}`),
          phase: attempt === 1 ? "generate" : `regenerate_${attempt}`,
          ms: GEMINI_TIMEOUT_MS,
          generationConfig: {
            maxOutputTokens: attempt === 1 ? 5200 : 4400,
            temperature: attempt === 1 ? 0.66 : 0.38,
            topP: attempt === 1 ? 0.86 : 0.55,
            responseMimeType: "application/json",
          },
        });
        if (!generated) return;
        const { res, j } = generated;

        if (!res.ok || j.error) {
          const apiMessage = describeApiError(res.status, j?.error);
          if (isLocalPreview() && res.status === 500 && /GEMINI_API_KEY/.test(j?.error?.message || apiMessage)) {
            setData({ ...localMockReport(subj.slice(0, solo ? 1 : 2), solo), __imageEvidence: imageEvidence });
            setStage("report");
            return;
          }
          return fail(`요청이 거부되었습니다 (HTTP ${res.status}) — ${apiMessage}`);
        }

        const raw = extractGeminiText(j);
        let candidateSessionId = j.sessionId;
        lastRaw = raw;
        if (!raw.trim()) {
          lastError = "응답이 비어 있습니다. 이용권은 차감되지 않았습니다.";
          continue;
        }

        let parsedResult = parseReportJsonPayload(raw);
        if (!parsedResult.ok && j.candidates?.[0]?.finishReason !== "MAX_TOKENS") {
          const repairPrompt = `아래 텍스트는 JSON 형식이 깨진 검사 결과다. 내용을 새로 쓰지 말고, 의미를 보존한 채 유효한 JSON 하나로만 고쳐라.

[필수 규칙]
- 코드펜스, 설명, 사과문, 주석 금지.
- 아래 스키마의 키만 사용하고 추가 키를 만들지 마라.
- 누락된 필드는 빈 값으로 두지 말고 문맥상 가장 가까운 짧은 값으로 채워라.
- role은 "알파" 또는 "오메가"만, grade는 "극우성" "우성" "열성" "극열성" 중 하나만 쓴다.
- site_code는 NP, CL, WR, SC, ME, TH, RB, AN, PL, HL 중 하나만 쓴다.
- JSON 문자열 내부 실제 줄바꿈은 \\n으로 이스케이프한다.

[스키마]
${responseSchemaForMode(solo)}

[고칠 텍스트]
${parsedResult.candidate.slice(0, 12000)}`;

          const repaired = await callReportEndpoint({
            requestParts: [{ text: repairPrompt }],
            phase: `repair_${attempt}`,
            ms: REPAIR_TIMEOUT_MS,
            generationConfig: {
              maxOutputTokens: 4200,
              temperature: 0.05,
              topP: 0.2,
              responseMimeType: "application/json",
            },
          });
          if (!repaired) return;
          if (!repaired.res.ok || repaired.j.error) {
            const apiMessage = describeApiError(repaired.res.status, repaired.j?.error);
            lastError = `응답 형식 보정에 실패했습니다 (HTTP ${repaired.res.status}) — ${apiMessage}`;
          } else {
            const repairedRaw = extractGeminiText(repaired.j);
            lastRaw = repairedRaw || raw;
            const repairedResult = parseReportJsonPayload(repairedRaw);
            if (repairedResult.ok) {
              parsedResult = repairedResult;
              candidateSessionId = repaired.j.sessionId || j.sessionId;
            } else {
              lastError = `응답 형식 보정에 실패했습니다 (${raw.length}자).`;
            }
          }
        } else if (!parsedResult.ok) {
          lastError = `응답이 토큰 한도에서 잘렸습니다 (${raw.length}자).`;
        }

        if (parsedResult.ok) {
          const candidate = parsedResult.value;
          const normalizedCandidate = normalizeReport(candidate, subj, ans.imprint);
          if (hasCompleteReport(normalizedCandidate, solo)) {
            parsed = normalizedCandidate;
            chargeSessionId = candidateSessionId;
            break;
          }
          lastError = "결과에 필수 항목이 빠져 자동 재판별했습니다.";
        }
      }

      if (!parsed || (solo ? !parsed.subject : !parsed.subjects || !parsed.cross_reaction)) {
        setReject(lastRaw.slice(0, 1800));
        return fail(`${lastError} ${MAX_GENERATION_ATTEMPTS}회 자동 재시도 후 중단했습니다. 이용권은 차감되지 않았습니다.`);
      }

      if (!chargeSessionId) {
        return fail("검사 세션이 확인되지 않아 이용권을 차감할 수 없습니다.");
      }

      try {
        await withTimeout(
          apiFetch("/passes/consume", {
            token: authToken,
            method: "POST",
            body: JSON.stringify({ sessionId: chargeSessionId, chargeKey }),
          }),
          PASS_TIMEOUT_MS,
          "이용권 차감 확인이 지연되었습니다."
        );
        await withTimeout(
          refreshPasses(authToken),
          PASS_TIMEOUT_MS,
          "잔여 이용권 갱신이 지연되었습니다."
        );
      } catch (error) {
        return fail(`이용권 차감에 실패했습니다 — ${error?.message || "잔여 횟수를 확인해 주십시오."}`);
      }

      if (requestSeq.current !== runId) return;
      setData({ ...parsed, __imageEvidence: imageEvidence });
      setStage("report");
    } catch (e) {
      fail(e?.name === "AbortError" ? "검사 응답이 지연되어 중단했습니다. 이용권은 차감되지 않았습니다." : `통신에 실패했습니다 — ${e?.message || "네트워크 오류"}`);
    } finally {
      if (timeout) clearTimeout(timeout);
      clearInterval(tick);
      if (requestSeq.current === runId) activeController.current = null;
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
            <button className="gm-again" onClick={backToForm}>
              재 접 수
            </button>
          </div>
        )}

        {/* REPORT */}
        {stage === "report" && data && solo && (
          <div className="gm-fade">
            <div className="gm-sec">
              <div className="gm-num"><b>Ⅰ. 감별 결과</b><em>ASSAY</em></div>
              <ReportSpecimens evidence={data.__imageEvidence} solo={solo} imgMode={imgMode} subjects={subj} pair={pair} report={data} />
              <Codename data={data} />
              <div className="gm-subj">
                <div className="gm-subj-hd">
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
              <ReportSpecimens evidence={data.__imageEvidence} solo={solo} imgMode={imgMode} subjects={subj} pair={pair} report={data} />
              {data.subjects?.map((s, i) => (
                <div className="gm-subj" key={i}>
                  <div className="gm-subj-hd">
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
              <button className="gm-again" onClick={saveReportImage} disabled={savingImage}>
                {savingImage ? "이미지 준비 중" : "결과 이미지 저장"}
              </button>
              <button className="gm-again" onClick={run}>
                같은 페어 재검
              </button>
              <button className="gm-again" onClick={backToForm}>
                신청서로 돌아가기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
