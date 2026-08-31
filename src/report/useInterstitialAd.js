import { useCallback, useEffect, useRef } from "react";
import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";
import { TOSS_AD_GROUP_ID } from "./config.js";

/* ─────────────────────────────────────────────
   전면 광고 — 검사 접수 대기 구간에 겹쳐 노출한다.
   광고는 어떤 경우에도 검사 흐름을 막지 않는다.
   실패·미지원·미로드는 전부 조용히 통과시킨다.
   ───────────────────────────────────────────── */

function isAdSupported() {
  try {
    return Boolean(loadFullScreenAd?.isSupported?.() && showFullScreenAd?.isSupported?.());
  } catch {
    return false;
  }
}

export function useInterstitialAd(adGroupId = TOSS_AD_GROUP_ID) {
  const loaded = useRef(false);
  const loading = useRef(false);
  const unregister = useRef(null);
  const mounted = useRef(true);

  const load = useCallback(() => {
    if (!adGroupId || !isAdSupported()) return;
    if (loaded.current || loading.current) return;
    loading.current = true;
    try {
      unregister.current = loadFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          if (event?.type !== "loaded") return;
          loading.current = false;
          if (mounted.current) loaded.current = true;
        },
        onError: () => {
          loading.current = false;
        },
      });
    } catch {
      loading.current = false;
    }
  }, [adGroupId]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
      try {
        unregister.current?.();
      } catch {
        /* 해제 실패는 무시한다. */
      }
      unregister.current = null;
    };
  }, [load]);

  // 노출을 시도하고 즉시 반환한다. 호출자는 결과를 기다리지 않는다.
  const show = useCallback(() => {
    if (!loaded.current) {
      load();
      return;
    }
    loaded.current = false;
    let release = () => {};
    // dismissed 가 오지 않는 단말(Android 5.255.0)에서도 다음 회차 로드가 막히지 않도록
    // 종료 계열 이벤트 중 먼저 오는 것으로 한 번만 정리한다.
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      try {
        release();
      } catch {
        /* 해제 실패는 무시한다. */
      }
      if (mounted.current) load();
    };
    try {
      release = showFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          if (event?.type === "dismissed" || event?.type === "failedToShow") settle();
        },
        onError: settle,
      });
    } catch {
      settle();
    }
  }, [adGroupId, load]);

  return show;
}
