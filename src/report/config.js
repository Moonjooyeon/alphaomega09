export const SITES = {
  NP: { name: "목덜미", meaning: "가장 노골적인 자리. 고개를 숙이는 순간 숨길 의사가 없다는 것까지 같이 드러난다." },
  CL: { name: "쇄골 아래", meaning: "옷깃 하나로 가려지지만, 숨을 크게 들이마시면 가장 먼저 당겨지는 자리다." },
  WR: { name: "손목 안쪽", meaning: "맥박이 뛸 때마다 확인되는 자리. 손을 잡히지 않으려 할수록 더 먼저 들킨다." },
  SC: { name: "견갑골 사이", meaning: "본인은 볼 수 없고 상대만 기억하는 자리. 등 돌린 순간에도 소유권이 남아 있다." },
  ME: { name: "귀 뒤", meaning: "여기까지 오려면 목소리보다 숨이 먼저 닿는다. 모르는 척하기에 너무 가까운 자리다." },
  TH: { name: "왼쪽 가슴", meaning: "뛰는 속도를 감출 수 없는 자리. 아닌 척할수록 옷감 아래에서 먼저 대답한다." },
  RB: { name: "옆구리", meaning: "피하려고 몸을 틀 때 가장 먼저 드러나는 급소. 손을 내린 적이 있다는 기록이다." },
  AN: { name: "발목 안쪽", meaning: "도망가는 방향까지 따라붙는 자리. 걸음이 흐트러질 때마다 먼저 반응한다." },
  PL: { name: "손바닥", meaning: "쥐면 가려지고 펴면 들킨다. 닿았던 감각을 지우려고 할수록 다시 확인하게 된다." },
  HL: { name: "뒷목 머리카락 선", meaning: "목덜미보다 반 뼘 위, 완전히 맡기지는 못한 자리. 머리카락을 넘길 때만 진짜가 보인다." },
};

export const API_BASE_ENDPOINT = import.meta.env.VITE_API_BASE_ENDPOINT || "/api";
export const GEMINI_PROXY_ENDPOINT = import.meta.env.VITE_GEMINI_ENDPOINT || `${API_BASE_ENDPOINT}/gemini`;
export const TOSS_LOGIN_MOCK = import.meta.env.VITE_TOSS_LOGIN_MOCK === "true";
export const PURCHASE_MOCK = import.meta.env.VITE_PURCHASE_MOCK === "true";
export const TOSS_IAP_SKU = import.meta.env.VITE_TOSS_IAP_SKU || "";
export const IMG_MODES = ["개별", "페어 1장", "없음"];
export const MODES = ["페어 감별", "개인 감별"];

export const SOLO_QUESTIONS = [
  { id: "s_first", q: "처음 보는 사람들 사이에서는?", o: ["자동", "먼저 말을 건다", "관찰만 한다", "시선을 피한다", "자리를 뜬다"] },
  { id: "s_lose", q: "통제를 잃을 것 같을 때는?", o: ["자동", "더 몰아붙인다", "자리를 벗어난다", "아무렇지 않은 척한다", "누군가를 찾는다"] },
  { id: "s_show", q: "자기 상태를 드러내는 편인가?", o: ["자동", "숨기지 않음", "가까운 한 명에게만", "끝까지 숨김", "본인도 모름"] },
  { id: "s_line", q: "누군가 선을 넘으면?", o: ["자동", "즉시 밀어냄", "참다가 터짐", "넘어오게 둠", "선이 없음"] },
  { id: "s_alone", q: "혼자 있는 시간은?", o: ["자동", "반드시 필요함", "견딜 만함", "괴로움", "생각해본 적 없음"] },
  { id: "s_mark", q: "각인된 적이 있나?", o: ["자동", "없음", "있음 · 현재 유지", "있음 · 과거", "본인은 모름"] },
];

export const ROLE_OPTS = ["자동", "알파", "오메가"];
export const GRADE_OPTS = ["자동", "극우성", "우성", "열성", "극열성"];
export const IMPRINT_OPTS = ["자동", "A→B", "B→A", "상호", "미형성"];

export const QUESTIONS = [
  { id: "approach", q: "첫 접촉에서 거리를 좁힌 쪽은?", o: ["자동", "개체 A", "개체 B", "동시", "사건에 의해"] },
  { id: "yield", q: "갈등 시 먼저 물러서는 쪽은?", o: ["자동", "개체 A", "개체 B", "둘 다 아님", "갈등이 드묾"] },
  { id: "disclose", q: "관계를 주변에 밝히고 있나?", o: ["자동", "공개", "일부만", "숨김", "규정하지 않음"] },
  { id: "apart", q: "떨어져 있는 동안의 상태는?", o: ["자동", "평소와 같음", "한쪽만 불안정", "양쪽 다 불안정", "오히려 안정"] },
  { id: "distance", q: "물리적 거리를 정하는 쪽은?", o: ["자동", "개체 A", "개체 B", "그때그때", "정한 적 없음"] },
  { id: "reunion", q: "결별 후 재회한 이력이 있나?", o: ["자동", "없음", "한 번", "여러 번", "아직 관계 이전"] },
  { id: "feeling", q: "두 사람의 감정은 지금 어디쯤인가?", o: ["자동", "서로 확신함", "개체 A만 확신", "개체 B만 확신", "둘 다 모름", "부정하는 중"] },
  { id: "devotion", q: "상대를 위해 어디까지 감수할 수 있나?", o: ["자동", "둘 다 전부", "개체 A만 전부", "개체 B만 전부", "둘 다 적당히", "각자가 먼저"] },
  { id: "separation", q: "연락이 끊기면 어떻게 되나?", o: ["자동", "둘 다 못 견딤", "개체 A만 못 견딤", "개체 B만 못 견딤", "둘 다 버팀", "오히려 편함"] },
];

export const LOADING = [
  "검체 접수 및 개체 식별 중",
  "페로몬 계열 분광 분석 중",
  "교차 반응 시뮬레이션 중",
  "각인 부위 스캔 중",
  "담당 감별사 검토 중",
];

export const GRADES = { 극우성: "EX-D", 우성: "D", 열성: "R", 극열성: "EX-R" };
