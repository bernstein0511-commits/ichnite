// ==========================================================
// modules/storage.js — バックエンドAPIを呼び出す関数をまとめた層。
// marker.js・restore.js・panel.js・popup.js は直接fetchせず、必ずここの
// 関数（saveMarker・fetchMarkersForPage 等）経由でAPIとやり取りする。
// ==========================================================

// content scriptから直接localhostへfetchすると、ChromeのPrivate Network Access
// によりブロックされ、開発者向けフラグ付き起動（--disable-web-security 等）が必要になる。
// バックグラウンド（host_permissionsにより制限を受けない）に代行させることでこれを回避する。
async function ichniteApiRequest(path, { method = "GET", body } = {}) {
  const response = await chrome.runtime.sendMessage({
    type: "ichnite:api",
    path,
    method,
    body,
  });

  if (!response) {
    throw new Error("拡張機能のバックグラウンドと通信できませんでした");
  }
  if (!response.ok) {
    throw new Error(response.error || `HTTP ${response.status}`);
  }
  return response.data;
}


// ページをDBに登録してpage_idを返す
async function getOrCreatePage() {
  const url = window.location.href;
  const title = document.title;

  const data = await ichniteApiRequest("/pages/", {
    method: "POST",
    body: { url, title },
  });
  return data.page_id;
}


// マーカーをDBに保存してmarker_idを返す
// occurrenceIndex: ページ内で同じselectedTextが何番目に出現するか（0始まり）。
// 同じ文字列がページ内に複数あっても位置を一意に復元できるよう、
// position_start / position_end 列を occurrenceIndex の保存に転用している。
async function saveMarker(selectedText, color, occurrenceIndex) {
  const page_id = await getOrCreatePage();

  const data = await ichniteApiRequest("/markers/", {
    method: "POST",
    body: {
      page_id,
      selected_text: selectedText,
      color,
      position_start: occurrenceIndex,
      position_end: occurrenceIndex,
    },
  });
  return data.marker_id;
}


// AI解説を生成してDBに保存、結果を返す
async function generateAiNote(markerId, selectedText) {
  return await ichniteApiRequest("/ai_notes/generate", {
    method: "POST",
    body: {
      marker_id: markerId,
      selected_text: selectedText,
    },
  });
}


// マーカーをDBから削除
async function deleteMarker(markerId) {
  await ichniteApiRequest(`/markers/${markerId}`, { method: "DELETE" });
}


// 現在のページに対応するpageレコードを取得（未登録ならnull）
async function getCurrentPage() {
  const url = window.location.href;
  const pages = await ichniteApiRequest("/pages/");
  return pages.find(p => p.url === url) || null;
}


// マーカー一覧をDBから全件取得
async function fetchAllMarkers() {
  return await ichniteApiRequest("/markers/");
}


// 現在のページのマーカー一覧をDBから取得（他ページのマーカーは含めない）
async function fetchMarkersForPage() {
  const page = await getCurrentPage();
  if (!page) return [];

  const all = await fetchAllMarkers();
  return all.filter(m => m.page_id === page.page_id);
}


// 記録帳ページ用の結合済みマーカー一覧をDBから取得（page_urlを含む）
// サイドパネルの一覧表示・他ページへの遷移に利用する
async function fetchMarkerBookEntries() {
  return await ichniteApiRequest("/marker_book/full");
}


// 指定マーカーのAI解説をDBから取得（未生成ならnull）
async function fetchAiNote(markerId) {
  try {
    return await ichniteApiRequest(`/ai_notes/${markerId}`);
  } catch {
    return null;
  }
}


// マーカーのメモを保存する（未登録なら新規作成、登録済みなら上書き）
async function saveMarkerMemo(markerId, memo) {
  return await ichniteApiRequest(`/marker_book/${markerId}`, {
    method: "PUT",
    body: { memo },
  });
}


// 他のUI（サイドパネル・記録帳ページ）へマーカーの変更を通知する
// extra.deletedMarkerId を渡すと、他タブでそのマーカーがページ上に表示されていた場合に
// ハイライトの解除まで行える
function notifyMarkersUpdated(extra = {}) {
  chrome.runtime.sendMessage({ type: "ichnite:markers-updated", ...extra }).catch(() => {});
}
