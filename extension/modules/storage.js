// ==========================================================
// modules/storage.js — マーカーデータを読み書きする関数をまとめた層。
// marker.js・restore.js・panel.js・popup.js は直接chrome.storageを触らず、
// 必ずここの関数（saveMarker・fetchMarkersForPage 等）経由でやり取りする。
//
// 実際の保存先はbackground.js（chrome.storage.local。modules/dataStore.js）。
// content scriptはService Workerの内部に直接アクセスできないため、
// chrome.runtime.sendMessageでbackground.jsに処理を依頼する。
// ==========================================================

async function ichniteDataRequest(action, payload) {
  const response = await chrome.runtime.sendMessage({
    type: "ichnite:data",
    action,
    payload,
  });

  if (!response) {
    throw new Error("拡張機能のバックグラウンドと通信できませんでした");
  }
  if (!response.ok) {
    throw new Error(response.error || "不明なエラーが発生しました");
  }
  return response.data;
}


// マーカーをDBに保存してmarker_idを返す
// occurrenceIndex: ページ内で同じselectedTextが何番目に出現するか（0始まり）。
// 同じ文字列がページ内に複数あっても位置を一意に復元できるよう、
// position_start / position_end 列を occurrenceIndex の保存に転用している。
async function saveMarker(selectedText, color, occurrenceIndex) {
  const data = await ichniteDataRequest("saveMarker", {
    page_url: window.location.href,
    page_title: document.title,
    selected_text: selectedText,
    color,
    position_start: occurrenceIndex,
    position_end: occurrenceIndex,
  });
  return data.marker_id;
}


// AI解説を生成してDBに保存、結果を返す
async function generateAiNote(markerId, selectedText) {
  return await ichniteDataRequest("generateAiNote", {
    markerId: Number(markerId),
    selectedText,
  });
}


// マーカーをDBから削除
async function deleteMarker(markerId) {
  await ichniteDataRequest("deleteMarker", { markerId: Number(markerId) });
}


// マーカー一覧をDBから全件取得
async function fetchAllMarkers() {
  return await ichniteDataRequest("fetchAllMarkers");
}


// 現在のページのマーカー一覧をDBから取得（他ページのマーカーは含めない）
async function fetchMarkersForPage() {
  return await ichniteDataRequest("fetchMarkersForPage", {
    pageUrl: window.location.href,
  });
}


// 記録帳ページ用の結合済みマーカー一覧をDBから取得（page_urlを含む）
// サイドパネルの一覧表示・他ページへの遷移に利用する
async function fetchMarkerBookEntries() {
  return await ichniteDataRequest("fetchMarkerBookEntries");
}


// 指定マーカーのAI解説をDBから取得（未生成ならnull）
async function fetchAiNote(markerId) {
  try {
    return await ichniteDataRequest("fetchAiNote", { markerId: Number(markerId) });
  } catch {
    return null;
  }
}


// マーカーのメモを保存する（未登録なら新規作成、登録済みなら上書き）
async function saveMarkerMemo(markerId, memo) {
  return await ichniteDataRequest("saveMarkerMemo", {
    markerId: Number(markerId),
    memo,
  });
}


// 他のUI（サイドパネル・記録帳ページ）へマーカーの変更を通知する
// extra.deletedMarkerId を渡すと、他タブでそのマーカーがページ上に表示されていた場合に
// ハイライトの解除まで行える
function notifyMarkersUpdated(extra = {}) {
  chrome.runtime.sendMessage({ type: "ichnite:markers-updated", ...extra }).catch(() => {});
}
