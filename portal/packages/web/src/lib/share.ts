// 공유 — Web Share API(네이티브 공유시트: 카톡·인스타·문자) 우선.
// 미지원(카카오톡 인앱브라우저·일부 PC)에선 브랜드 공유 모달을 띄운다(건조한 시스템 토스트 대신).
// 현재 페이지 URL을 공유하므로 per-page OG 카드가 미리보기로 뜬다.

export interface SharePayload { title: string; text: string; url: string }

/** 폴백 모달 트리거 — App에 마운트된 ShareModal이 구독한다. */
function openShareModal(p: SharePayload) {
  window.dispatchEvent(new CustomEvent<SharePayload>("portal:share", { detail: p }));
}

/** 현재 페이지 공유(헤더 공유 버튼). */
export async function sharePage(title: string): Promise<void> {
  return shareResult(title, `${title} · 사주플랜 무료 운세`);
}

/** 결과 텍스트 + URL 공유. url 미지정 시 현재 페이지. 네이티브 시트 우선, 미지원이면 모달. */
export async function shareResult(title: string, text: string, url: string = window.location.href): Promise<void> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title, text, url });
      return; // 네이티브 시트 성공(또는 사용자 취소) — 모달 안 띄움
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // 사용자가 시트 닫음
      // 그 외 실패 → 모달 폴백
    }
  }
  openShareModal({ title, text, url });
}
