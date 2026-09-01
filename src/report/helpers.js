export function josa(w, withBatchim, without) {
  const t = (w || "").trim();
  if (!t) return without;
  const c = t.charCodeAt(t.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return without;
  return (c - 0xac00) % 28 !== 0 ? withBatchim : without;
}

export function caseNo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `GM-${d.getFullYear()}-${p(d.getMonth() + 1)}${p(d.getDate())}-${String(
    Math.floor(Math.random() * 9000) + 1000
  )}`;
}

export function imageFileToInlineData(file, maxSize = 1800, quality = 0.92) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => resolve({ data: String(reader.result).split(",")[1], mime: file.type || "application/octet-stream" });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ data: dataUrl.split(",")[1], mime: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function describeApiError(status, error) {
  const message = error?.message || "";
  if ([402, 429].includes(status) && /credit|prepayment|depleted|insufficient/i.test(message)) {
    return "공용 Gemini 라우터 크레딧이 소진되었습니다. 서버의 보조 API 키 설정 또는 크레딧 충전 상태를 확인해 주십시오.";
  }
  if (status === 404 && /no longer available|not found/i.test(message)) {
    return "현재 API 키에서 이 Gemini 모델을 사용할 수 없습니다. 서버 재배포가 끝났는지 확인하거나 GEMINI_MODEL 값을 갱신해 주십시오.";
  }
  return message || error?.status || "사유 미상";
}

export function isLocalPreview() {
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
}

export const DEF_ADJ = { scale: 1, x: 50, y: 50 };

export function imageTransform(adj = DEF_ADJ) {
  return `scale(${adj.scale}) translate(${50 - adj.x}%, ${50 - adj.y}%)`;
}

export function pairCycleLabels(subjects = []) {
  const a = subjects[0] || {};
  const b = subjects[1] || {};
  const an = a.name || "개체 A";
  const bn = b.name || "개체 B";
  if (a.role === "알파" && b.role === "알파") {
    return [`${an} 러트 때`, `${bn} 러트 때`];
  }
  if (a.role === "오메가" && b.role === "오메가") {
    return [`${an} 히트 때`, `${bn} 히트 때`];
  }
  if (a.role === "오메가" && b.role === "알파") {
    return [`${an} 히트 때`, `${bn} 러트 때`];
  }
  if (a.role === "알파" && b.role === "오메가") {
    return [`${bn} 히트 때`, `${an} 러트 때`];
  }
  return ["히트 때", "러트 때"];
}
