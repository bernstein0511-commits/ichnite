// ==========================================================
// modules/restore.js — ページ読み込みのたびに、そのページに紐づく
// マーカーをDBから取得してハイライトspanとして復元する。
// マーカーの位置特定は textLocator.js の findOccurrenceRange() に委譲。
// ==========================================================

window.addEventListener("load", restoreMarkers);


async function restoreMarkers() {
  try {
    // 現在のページに紐づくマーカーだけを取得する
    const pageMarkers = await fetchMarkersForPage();
    const memoMap = await fetchMemoMapForCurrentPage();

    for (const marker of pageMarkers) {
      await restoreSingleMarker(marker, memoMap.get(marker.marker_id) || "");
    }

    // サイドパネルの登録文字クリックで他ページから遷移してきた場合、対象位置までスクロール
    scrollToRequestedMarker();
  } catch {
    // 復元に失敗しても他の処理は継続する
  }
}


// 現在のページのマーカーについて、marker_id -> メモ の対応表を作る
// （ホバー時のメモポップアップに表示するため）
async function fetchMemoMapForCurrentPage() {
  const map = new Map();
  try {
    const entries = await fetchMarkerBookEntries();
    entries
      .filter(entry => entry.page_url === window.location.href)
      .forEach(entry => map.set(entry.marker_id, entry.memo || ""));
  } catch {
    // 取得に失敗した場合は空のままにする
  }
  return map;
}


function scrollToRequestedMarker() {
  if (!ichniteRequestedMarkerId) return;

  const el = document.querySelector(`.ichnite-highlight[data-marker-id="${ichniteRequestedMarkerId}"]`);
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ichnite-highlight-focus");
  setTimeout(() => el.classList.remove("ichnite-highlight-focus"), 1500);
}


async function restoreSingleMarker(marker, memo = "") {
  const targetText = marker.selected_text;
  const color = marker.color;
  const markerId = marker.marker_id;
  // 保存時に記録した「ページ内で何番目の出現か」（0始まり）
  const occurrenceIndex = marker.position_start;

  const location = findOccurrenceRange(targetText, occurrenceIndex);
  if (!location) return;

  const range = document.createRange();
  range.setStart(location.node, location.start);
  range.setEnd(location.node, location.end);

  const markerEl = document.createElement("span");
  markerEl.className = `ichnite-highlight ${color}`;
  markerEl.dataset.markerId = markerId;
  markerEl.dataset.aiLoaded = "false";
  markerEl.dataset.memo = memo;

  try {
    range.surroundContents(markerEl);

    // AI解説をDBから取得して紐付け
    const aiNote = await fetchAiNote(markerId);
    if (aiNote) {
      markerEl.dataset.aiNote = JSON.stringify(aiNote);
      markerEl.dataset.aiLoaded = "true";
    }
  } catch {
    // 復元に失敗しても他のマーカーの処理は続ける
  }
}
