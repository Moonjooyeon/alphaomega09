const REQUESTED_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const GEMINI_MODEL =
  REQUESTED_GEMINI_MODEL === "gemini-2.5-flash-lite"
    ? "gemini-3.1-flash-lite"
    : REQUESTED_GEMINI_MODEL;
const GEMINI_THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET || 2048);
const COST_LIMIT_KRW = Number(process.env.GEMINI_COST_LIMIT_KRW || 10000);
const USD_TO_KRW = Number(process.env.USD_TO_KRW || 1400);
const INPUT_USD_PER_MILLION = Number(process.env.GEMINI_INPUT_USD_PER_MILLION || 0.25);
const OUTPUT_USD_PER_MILLION = Number(process.env.GEMINI_OUTPUT_USD_PER_MILLION || 1.5);
const USAGE_STORE = "gemini-usage";
const MAX_REQUEST_BYTES = Number(process.env.MAX_REQUEST_BYTES || 4_500_000);

async function getUsageStore(event) {
  if (process.env.NETLIFY_LOCAL === "true") {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = path.join(process.cwd(), ".netlify", "local-blobs", USAGE_STORE);

    return {
      async list({ prefix = "" } = {}) {
        try {
          const names = await fs.readdir(path.join(root, "requests"));
          return {
            blobs: names
              .filter((name) => name.endsWith(".json"))
              .map((name) => ({ key: `requests/${name}` }))
              .filter(({ key }) => key.startsWith(prefix)),
          };
        } catch {
          return { blobs: [] };
        }
      },
      async get(key, { type } = {}) {
        try {
          const text = await fs.readFile(path.join(root, key), "utf8");
          return type === "json" ? JSON.parse(text) : text;
        } catch {
          return null;
        }
      },
      async setJSON(key, value) {
        const file = path.join(root, key);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, JSON.stringify(value, null, 2));
      },
    };
  }

  const { connectLambda, getStore } = await import("@netlify/blobs");
  connectLambda(event);
  return getStore({ name: USAGE_STORE });
}

async function readUsage(store) {
  const usage = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, costKrw: 0 };
  const listed = await store.list({ prefix: "requests/" });

  await Promise.all(
    listed.blobs.map(async ({ key }) => {
      const entry = await store.get(key, { type: "json" });
      if (!entry) return;
      usage.requests += 1;
      usage.inputTokens += Number(entry.inputTokens || 0);
      usage.outputTokens += Number(entry.outputTokens || 0);
      usage.costUsd += Number(entry.costUsd || 0);
      usage.costKrw += Number(entry.costKrw || 0);
    })
  );

  usage.remainingKrw = Math.max(0, COST_LIMIT_KRW - usage.costKrw);
  return usage;
}

function getTokenUsage(body) {
  const metadata = body?.usageMetadata || {};
  const inputTokens = Number(metadata.promptTokenCount || 0);
  const outputTokens = Number(metadata.candidatesTokenCount || 0) + Number(metadata.thoughtsTokenCount || 0);
  return { inputTokens, outputTokens };
}

function estimateCost({ inputTokens, outputTokens }) {
  const inputUsd = (inputTokens / 1_000_000) * INPUT_USD_PER_MILLION;
  const outputUsd = (outputTokens / 1_000_000) * OUTPUT_USD_PER_MILLION;
  const costUsd = inputUsd + outputUsd;
  return { costUsd, costKrw: costUsd * USD_TO_KRW };
}

async function recordUsage(store, entry) {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await store.setJSON(`requests/${Date.now()}-${id}.json`, {
    ...entry,
    createdAt: new Date().toISOString(),
    model: GEMINI_MODEL,
    usdToKrw: USD_TO_KRW,
  });
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(body),
  };
}

function getRequestBodyText(event) {
  if (!event.body) return "{}";
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
}

function getPromptText(requestBody) {
  return (requestBody?.contents || [])
    .flatMap((content) => content.parts || [])
    .map((part) => part.text || "")
    .join("\n");
}

function extractField(prompt, pattern, fallback) {
  const match = prompt.match(pattern);
  return match?.[1]?.trim() || fallback;
}

function mockGeminiResponse(requestBody) {
  const prompt = getPromptText(requestBody);
  const solo = prompt.includes("[검사 구분] 단일 개체 검사");
  const nameA = extractField(prompt, /대상 A — 이름:\s*([^/]+)/, "테스트 개체");
  const lineA = extractField(prompt, /대상 A — 이름:[^\n]*\/ 한 줄:\s*([^/]+)/, "냉정한 표정을 유지하는 불면 개체");
  const roleA = extractField(prompt, /대상 A — 이름:[^\n]*\/ 판정 지정:\s*([^/]+)/, "자동");
  const gradeA = extractField(prompt, /대상 A — 이름:[^\n]*\/ 등급 지정:\s*([^\n]+)/, "자동");
  const role = roleA === "자동" ? "오메가" : roleA;
  const grade = gradeA === "자동" ? "우성" : gradeA;
  const subject = {
    name: nameA,
    role,
    grade,
    confidence: 62,
    pheromone: {
      family: "우디",
      top: "마른 편백 조각과 차가운 잉크",
      heart: "젖은 셔츠 안쪽에 남은 백차",
      base: "밤새 식은 담요와 닫힌 서랍",
      intensity: 3,
      persistence: "반나절",
      diffusion: "한 팔 거리",
      trigger: "상대가 시야에서 사라질 때 잔향이 먼저 짙어진다.",
      scent_code: "GM-S-12 «편백과 잉크»",
    },
    evidence: [lineA, "시선 회피와 자세 고정"],
    remarks: "평시에는 억제 상태가 안정적이다. 다만 결핍 자극 앞에서 호흡 간격이 짧아진다.",
  };

  const soloBody = {
    subject,
    codename: "제4류 · 잠복향형",
    rarity: { total: 42000, count: 37 },
    counterfactual: "만약 열성으로 판정되었다면 발현 전조가 이보다 늦게 관찰되었을 것으로 추정된다.",
    warning: "본 개체는 장시간 무응답 상황에서 억제선이 급격히 낮아질 수 있음.",
    oneline: "안정은 유지되나, 결핍에는 오래 버티지 못한다.",
    traits: {
      metrics: [
        { label: "신호 발신 강도", level: 3 },
        { label: "감응 역치", level: 2 },
        { label: "자기 억제력", level: 4 },
        { label: "유대 형성 경향", level: 3 },
        { label: "각인 수용성", level: 4 },
      ],
      note: "겉으로는 안정형이나, 반복 접촉 뒤에는 회피보다 보존 반응이 먼저 나온다.",
    },
    imprint_history: { status: "부분 흔적", note: "후경부 반응은 낮으나 손목 안쪽의 방어 반응이 남아 있다." },
    cycle_profile: {
      heat_cycle: role === "오메가" ? "31~36일 간격. 전조는 수면 단축과 둥지 재배열로 시작된다." : "비주기성. 히트 신호에 노출될 때 6~8시간 지연 감응이 관찰된다.",
      rut_cycle: role === "알파" ? "42~48일 간격. 통제 욕구가 먼저 올라오고 향은 뒤늦게 확산된다." : "비주기성. 강한 러트 신호 앞에서는 체온 상승보다 회피 동선이 먼저 나타난다.",
      precursor: "발현 48시간 전부터 목소리의 높낮이가 낮아지고 같은 물건을 반복 정리한다.",
      suppression_failure: "응답 지연과 향 잔류가 동시에 발생하면 억제가 가장 먼저 풀린다.",
      heat_management: [
        { label: "둥지 고정", note: "세탁하지 않은 천과 낮은 조도의 공간을 한곳에 모아 감응 범위를 줄인다." },
        { label: "향 차단", note: "목덜미와 손목 안쪽의 잔향 노출을 줄이고 낯선 향을 배제한다." },
        { label: "접촉 제한", note: "첫 2시간은 직접 접촉보다 같은 공간의 안정 신호만 허용한다." },
      ],
      rut_management: [
        { label: "동선 격리", note: "문이 보이는 위치를 피하고 퇴로가 두 개인 방에 둔다." },
        { label: "냉각", note: "손목과 후경부를 낮은 온도로 유지해 발신 강도를 낮춘다." },
        { label: "명령 자극 차단", note: "짧은 지시어와 반복 호출을 피해야 반응 상승을 막을 수 있다." },
      ],
      nesting: role === "오메가" ? "둥지는 넓은 침구보다 좁은 가장자리에서 안정된다. 낯선 천보다 오래 입은 겉옷에 더 빠르게 반응한다." : "둥지 대신 통제 가능한 퇴피 구역이 필요하다. 문과 창을 직접 확인할 수 있을 때 안정된다.",
      isolation_warning: "본 개체는 완전 격리보다 낮은 밀도의 동반 감시에서 안정도가 높다.",
    },
    prognosis: {
      phase_1: "평시에는 관찰자보다 환경을 먼저 통제한다.",
      phase_2: "과부하 시 말수가 줄고 향이 옷깃 안쪽에 고인다.",
      phase_3: "장기적으로는 안정 구역이 확보될 때 발현 간격이 길어진다.",
    },
    examiner_note: "기록상 위험도는 낮다. 다만 가까이 두면 먼저 무너지는 쪽은 방이 아니라 관찰자의 판단일 가능성이 있다.",
  };

  const pairBody = {
    subjects: [
      subject,
      {
        ...subject,
        name: extractField(prompt, /대상 B — 이름:\s*([^/]+)/, "테스트 개체 B"),
        role: "알파",
        grade: "열성",
        confidence: 59,
      },
    ],
    codename: "제2류 · 잔향접속형",
    rarity: { total: 31000, count: 118 },
    counterfactual: "만약 접촉 빈도가 낮았다면 반응은 표층에 머물렀을 것으로 추정된다.",
    warning: "본 조합은 연락 두절 상황에서 향 동조율이 급락할 수 있음.",
    oneline: "멀어질수록 먼저 남는 것은 말보다 향이다.",
    cross_reaction: {
      type_name: "저온 접속형",
      compatibility: 72,
      scent_sync: 68,
      scent_note: "식은 백차 위에 젖은 편백 조각이 가라앉는 냄새로 수렴한다.",
      metrics: [
        { label: "유대 형성 속도", level: 3 },
        { label: "신호 간섭도", level: 2 },
        { label: "상호 억제 가능성", level: 4 },
        { label: "분리 내성", level: 2 },
        { label: "장기 안정성", level: 4 },
      ],
      caution: "재검 시 동일 문항에서 분리 반응을 다시 확인할 것.",
    },
    imprint: {
      from: nameA,
      to: "테스트 개체 B",
      site_code: "WR",
      fixation: "부분",
      stability: 67,
      rationale: "손목 안쪽 방어 반응이 반복된다.",
      note: "방향은 안정되었으나 정착은 완전하지 않다.",
    },
    prognosis: {
      phase_1: "초기에는 거리 조절이 먼저 발생한다.",
      phase_2: "중기에는 향 잔류 시간이 늘어난다.",
      phase_3: "장기적으로는 부분 각인이 안정 신호로 굳어진다.",
    },
    examiner_note: "두 표본은 서로를 크게 흔들지 않는 척한다. 기록상으로는 그 점이 오히려 가장 수상하다.",
  };

  const body = solo ? soloBody : pairBody;
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 700, thoughtsTokenCount: 0 },
    mock: true,
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: { message: "POST 요청만 허용됩니다." } });
  }

  let usageStore;
  let usage;
  try {
    usageStore = await getUsageStore(event);
    usage = await readUsage(usageStore);
  } catch (error) {
    return json(500, { error: { message: error?.message || "사용량 저장소를 읽지 못했습니다." } });
  }

  if (usage.costKrw >= COST_LIMIT_KRW) {
    return json(429, {
      error: {
        message: `누적 사용 한도 ${COST_LIMIT_KRW.toLocaleString("ko-KR")}원을 초과하여 검사를 닫았습니다.`,
        usage,
      },
    });
  }

  const requestText = getRequestBodyText(event);
  if (Buffer.byteLength(requestText, "utf8") > MAX_REQUEST_BYTES) {
    return json(413, { error: { message: "요청 이미지가 너무 큽니다. 더 작은 이미지로 다시 접수해 주십시오." } });
  }

  let requestBody;
  try {
    requestBody = JSON.parse(requestText);
  } catch {
    return json(400, { error: { message: "요청 본문이 올바른 JSON이 아닙니다." } });
  }

  const { contents, generationConfig = {} } = requestBody;
  if (!Array.isArray(contents) || contents.length === 0) {
    return json(400, { error: { message: "contents가 비어 있습니다." } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (process.env.NETLIFY_LOCAL === "true") {
      const body = mockGeminiResponse(requestBody);
      const tokens = getTokenUsage(body);
      const cost = estimateCost(tokens);
      await recordUsage(usageStore, { ...tokens, ...cost, ok: true, status: 200, mock: true });
      body.usageLimit = {
        before: usage,
        request: { ...tokens, ...cost },
        limitKrw: COST_LIMIT_KRW,
        estimatedTotalKrw: usage.costKrw + cost.costKrw,
        estimatedRemainingKrw: Math.max(0, COST_LIMIT_KRW - usage.costKrw - cost.costKrw),
      };
      return json(200, body);
    }
    return json(500, { error: { message: "서버에 GEMINI_API_KEY가 설정되지 않았습니다." } });
  }

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            ...generationConfig,
            thinkingConfig: {
              thinkingBudget: GEMINI_THINKING_BUDGET,
              ...(generationConfig.thinkingConfig || {}),
            },
          },
        }),
      }
    );
  } catch (error) {
    return json(502, { error: { message: error?.message || "Gemini 요청에 실패했습니다." } });
  }

  let body;
  try {
    body = await geminiRes.json();
  } catch {
    return json(geminiRes.status, {
      error: { message: `Gemini 응답을 JSON으로 읽지 못했습니다. HTTP ${geminiRes.status}` },
    });
  }

  const tokens = getTokenUsage(body);
  const cost = estimateCost(tokens);

  try {
    await recordUsage(usageStore, {
      ...tokens,
      ...cost,
      ok: geminiRes.ok,
      status: geminiRes.status,
    });
  } catch (error) {
    return json(500, { error: { message: error?.message || "사용량을 저장하지 못했습니다." } });
  }

  body.usageLimit = {
    before: usage,
    request: { ...tokens, ...cost },
    limitKrw: COST_LIMIT_KRW,
    estimatedTotalKrw: usage.costKrw + cost.costKrw,
    estimatedRemainingKrw: Math.max(0, COST_LIMIT_KRW - usage.costKrw - cost.costKrw),
  };

  return json(geminiRes.status, body);
};
