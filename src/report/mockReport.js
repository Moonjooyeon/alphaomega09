export function localMockReport(subjects, solo) {
  const clean = (value, fallback) => (value || "").trim() || fallback;
  const roleOf = (s, fallback) => (s.role && s.role !== "자동" ? s.role : fallback);
  const gradeOf = (s, fallback) => (s.grade && s.grade !== "자동" ? s.grade : fallback);
  const subject = (s, fallbackName, fallbackRole, fallbackGrade, code) => ({
    name: clean(s.name, fallbackName),
    role: roleOf(s, fallbackRole),
    grade: gradeOf(s, fallbackGrade),
    confidence: s.img ? 76 : 63,
    pheromone: {
      family: code === "A" ? "우디" : "허벌",
      top: code === "A" ? "마른 편백 조각과 차가운 잉크" : "젖은 민트와 유리잔의 물기",
      heart: code === "A" ? "백차를 머금은 셔츠 안쪽" : "빗물에 식은 라벤더",
      base: code === "A" ? "밤새 식은 담요와 닫힌 서랍" : "희미한 머스크와 오래된 종이",
      intensity: code === "A" ? 3 : 4,
      persistence: "반나절",
      diffusion: "한 팔 거리",
      trigger: "상대가 시야에서 사라질 때 잔향이 먼저 짙어진다.",
      scent_code: `GM-S-${code}7 «${code === "A" ? "편백과 잉크" : "민트와 종이"}»`,
    },
    evidence: [clean(s.line, "기재된 한 줄 설명"), s.img ? "첨부 이미지의 시선과 자세" : "문진 응답의 억제 패턴"],
    remarks: "평시에는 억제 상태가 안정적이나 결핍 자극 앞에서 호흡 간격이 짧아진다.",
  });

  if (solo) {
    const one = subject(subjects[0], "대상", "오메가", "우성", "A");
    return {
      subject: one,
      codename: "폐쇄형 잔향 보유체",
      rarity: { total: 100, count: 12 },
      counterfactual: "알파 판정이었다면 발신 강도보다 통제 구역 확보가 먼저 관찰되었을 가능성이 높다.",
      warning: "장시간 방치 시 억제 피로가 누적될 수 있다.",
      oneline: "가까이 오면 멀어지고, 멀어지면 먼저 향이 돌아오는 개체.",
      traits: {
        metrics: [
          { label: "신호 발신 강도", level: 3 },
          { label: "감응 역치", level: 4 },
          { label: "자기 억제력", level: 4 },
          { label: "유대 형성 경향", level: 3 },
          { label: "각인 수용성", level: 2 },
        ],
        note: "반응은 늦게 올라오지만 한 번 고정되면 쉽게 빠지지 않는다.",
      },
      imprint_history: { status: "흔적 있음", note: "현재 유지 중인 약한 잔류 반응이 관찰된다." },
      cycle_profile: {
        heat_cycle: "약 6~8주 간격으로 올라오며, 가까워질수록 목덜미 체온과 옷깃 안쪽의 단향이 먼저 짙어진다.",
        rut_cycle: "약 5~7주 간격으로 발신성이 치솟고, 전조기에는 목소리가 낮아지며 특정 향을 끝까지 따라가려는 성향이 강해진다.",
        precursor: "발현 전에는 손끝이 차가워지고 숨을 참는 시간이 길어지며, 익숙한 향이 닿는 순간 시선이 먼저 흐트러진다.",
        suppression_failure: "밀폐된 공간에서 특정 대상의 잔향이 겹치면 목덜미를 가리고도 몸이 먼저 반응해, 피하려는 동작이 오히려 더 노골적인 신호가 된다.",
        heat_management: [
          { label: "억제제 반응", note: "정량을 먹고도 목덜미의 단향은 얇게 새며, 약효가 돌수록 오히려 숨을 참는 버릇이 노골적으로 드러난다." },
          { label: "파트너 유무", note: "고정 파트너를 두지 않으려 하지만 특정 향이 가까워지면 대체 안정 구역 밖으로 밀려나와, 거절과 대기를 같은 얼굴로 한다." },
          { label: "혼자 버티는 법", note: "혼자 견딜 때는 둥지를 만들지 못하고 문 쪽을 등진다. 손끝이 떨릴수록 상대의 물건을 보이지 않는 곳에 숨긴다." },
        ],
        rut_management: [
          { label: "억제제 반응", note: "억제제를 먹어도 발신향의 밑맛은 남아, 말수가 줄어들수록 낮은 목소리와 손등의 힘줄이 먼저 들킨다." },
          { label: "파트너 유무", note: "임시 파트너보다 특정 상대 하나에 안정성이 몰린다. 그 향이 멀어지면 동선을 장악하려는 충동이 선명해진다." },
          { label: "혼자 버티는 법", note: "혼자 버틸 때는 출입구에서 먼 곳에 앉아 손을 묶듯 감추고, 이름을 부르지 않으려고 이를 악문다." },
        ],
        nesting: "둥지 형성은 불완전하다. 좁은 공간과 익숙한 천을 찾지만, 특정 향이 밴 물건이 없으면 안정 구역을 끝까지 완성하지 못한다.",
        isolation_warning: "완전 격리는 불안을 키우지만, 너무 가까운 거리는 발현을 노골적으로 앞당긴다.",
      },
      prognosis: {
        phase_1: "평시에는 무표정한 안정 상태를 유지한다.",
        phase_2: "과부하 시 말수가 줄고 향의 끝맛이 먼저 거칠어진다.",
        phase_3: "안정 구역과 주기 기록이 확보되면 장기 예후는 양호하다.",
      },
      examiner_note: "로컬 미리보기용 임시 판정입니다.",
    };
  }

  const a = subject(subjects[0], "개체 A", "알파", "우성", "A");
  const b = subject(subjects[1], "개체 B", "오메가", "우성", "B");
  const cycleInteraction =
    a.role === "알파" && b.role === "알파"
      ? {
          heat: `${a.name}의 러트가 오면 ${b.name}은 먼저 물러나는 척하지만, 낮아진 목소리가 닿는 순간 발끝으로 거리를 다시 잰다.`,
          rut: `${b.name}의 러트가 오면 ${a.name}은 문가를 막지 않는 척 서 있다가, 발신향이 겹치는 순간 손목보다 시선을 먼저 붙든다.`,
          together: "둘 다 러트를 버틸 때는 억제제를 챙긴 쪽이 더 먼저 티가 난다. 서로의 발신향이 맞물리면 말수가 줄고, 동선만 점점 좁아진다.",
          failure: "가장 위험한 조건은 둘 중 하나가 주도권을 양보하는 척하며 상대의 퇴로를 남겨두는 순간이다.",
        }
      : a.role === "오메가" && b.role === "오메가"
      ? {
          heat: `${a.name}의 히트가 오면 ${b.name}은 둥지 밖에 남아 있으려 하지만, 상대가 둥지를 만들지 못하고 배회하면 먼저 옷소매를 접어 쥔다.`,
          rut: `${b.name}의 히트가 오면 ${a.name}은 괜찮은 척 물러나도 상대의 천과 체온을 따라 대체 안정 구역 가장자리까지 돌아온다.`,
          together: "둘 다 히트를 버틸 때는 억제제보다 안정 행동의 리듬이 먼저 무너진다. 서로의 물건을 하나씩 숨기거나 밀어내며 버틴다.",
          failure: "가장 위험한 조건은 한쪽이 만든 안정 구역에 다른 쪽의 향이 밴 물건이 섞이는 순간이다.",
        }
      : a.role === "오메가" && b.role === "알파"
      ? {
          heat: `${a.name}의 히트가 오면 ${b.name}은 문밖에 서서 안 들어가는 척하지만, 안정 구역의 향이 새는 순간 목소리부터 낮아진다.`,
          rut: `${b.name}의 러트가 오면 ${a.name}은 먼저 피하는 척 발끝으로 거리를 확인하고, 잡히기 직전에야 숨을 삼키며 멈춘다.`,
          together: "둘이 같이 버틸 때는 억제제를 챙긴 쪽이 더 먼저 무너진다. 약효보다 서로의 잔향이 빠르게 돌아서, 말 대신 손목과 발목의 거리가 가까워진다.",
          failure: "가장 위험한 조건은 한쪽이 괜찮은 척 물러난 뒤 다른 쪽이 그 향을 따라오는 순간이다.",
        }
      : {
          heat: `${b.name}의 히트가 오면 ${a.name}은 문밖에 서서 안 들어가는 척하지만, 안정 구역의 향이 새는 순간 목소리부터 낮아진다.`,
          rut: `${a.name}의 러트가 오면 ${b.name}은 먼저 피하는 척 발끝으로 거리를 확인하고, 잡히기 직전에야 숨을 삼키며 멈춘다.`,
          together: "둘이 같이 버틸 때는 억제제를 챙긴 쪽이 더 먼저 무너진다. 약효보다 서로의 잔향이 빠르게 돌아서, 말 대신 손목과 발목의 거리가 가까워진다.",
          failure: "가장 위험한 조건은 한쪽이 괜찮은 척 물러난 뒤 다른 쪽이 그 향을 따라오는 순간이다.",
        };
  return {
    subjects: [a, b],
    codename: "제4류 · 발끝도발형",
    rarity: { total: 100, count: 9 },
    counterfactual: "만약 둘 중 하나가 먼저 솔직해졌다면 교차반응은 안정됐겠지만, 지금처럼 오래 잔향을 끌고 가지는 않았을 것으로 추정된다.",
    warning: "초기 접촉보다 접촉 직후 아닌 척 떨어지는 구간에서 변수가 크다.",
    oneline: "발끝으로 먼저 건드린 쪽은 웃고, 늦게 무너진 쪽은 그 향을 밤새 기억하는 페어.",
    cross_reaction: {
      type_name: "발끝도발형 교차반응",
      compatibility: 78,
      scent_sync: 71,
      scent_note: "붙어 있을 때는 담백하게 섞이지만, 한쪽이 발끝으로 거리를 건드리고 물러난 뒤에야 잔향이 더 노골적으로 맞물린다.",
      metrics: [
        { label: "유대 형성 속도", level: 3 },
        { label: "신호 간섭도", level: 4 },
        { label: "상호 억제 가능성", level: 3 },
        { label: "분리 내성", level: 2 },
        { label: "장기 안정성", level: 4 },
      ],
      caution: "먼저 건드리는 쪽은 가볍게 넘긴 척하지만, 늦게 반응하는 쪽의 향이 더 오래 남아 재접촉을 과장한다.",
    },
    imprint: {
      from: a.name,
      to: b.name,
      site_code: "AN",
      fixation: "불완전 고정",
      stability: 64,
      rationale: "시선은 피하면서도 발끝으로 콕콕 건드리는 도발이 반복되고, 물러난 뒤에는 향 추적 반응이 더 선명해진다.",
      note: "가까이 있으면 얌전해지고 떨어지면 더 깊게 남는 반응이라, 확정 전 단계임에도 분리 구간에서 안정성이 오른다.",
    },
    imprint_loss: {
      a: `${b.name}이 사망하면 ${a.name}은 즉각적인 붕괴보다 먼저 향을 찾는 행동이 반복된다. 남은 물건을 정리하지 못하고, 발목 안쪽의 각인 반응이 통증처럼 늦게 올라온다.`,
      b: `${a.name}이 사망하면 ${b.name}은 울음보다 억제가 먼저 풀린다. 익숙한 발신향이 끊긴 자리에 자기 향을 덧씌우려 하며, 밤마다 같은 동선을 되짚는다.`,
      note: "사망 반응은 애도보다 잔향 추적이 먼저 관찰되는 유형이다. 재각인 가능성은 낮고, 대체 자극에 대한 거부가 길게 남는다.",
    },
    cycle_interaction: cycleInteraction,
    prognosis: {
      phase_1: "초기에는 둘 다 아닌 척하지만 발끝, 옷소매, 이름을 부르지 않는 침묵 같은 작은 접촉 신호가 먼저 늘어난다.",
      phase_2: "중기에는 한쪽이 건드리고 물러나면 다른 쪽이 늦게 따라붙는 식의 도발과 회피가 반복된다.",
      phase_3: "장기적으로는 떨어져 있을수록 향이 먼저 돌아와, 재회 순간보다 재회 직전의 긴장이 더 짙어진다.",
    },
    examiner_note: "두 개체는 큰 사건보다 사소한 접촉 신호에 더 민감하다. 발끝 하나가 거리 전체를 흔드는 유형으로 기록한다.",
  };
}
