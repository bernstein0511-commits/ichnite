// ==========================================================
// modules/storage.js — マーカーデータを読み書きする関数をまとめた層。
// marker.js・restore.js・panel.js・popup.jsはここの関数
// （saveMarker・fetchMarkersForPage等）を経由してデータを扱う。
//
// 保存先はbackground.js（chrome.storage.local、実処理はmodules/dataStore.js）。
// content scriptからはservice workerの中身に直接触れないので、
// chrome.runtime.sendMessageで依頼する形にしている。
// ==========================================================

async function ichniteDataRequest(action, payload) {
  const response = await chrome.runtime.sendMessage({ type: "ichnite:data", action, payload });

  if (!response) {
    throw new Error("拡張機能のバックグラウンドと通信できませんでした");
  }
  if (!response.ok) {
    throw new Error(response.error || "不明なエラーが発生しました");
  }
  return response.data;
}


// マーカーを保存してmarker_idを返す
// occurrenceIndex: ページ内で同じselectedTextが何番目に出現するか（0始まり）。
// 同じ文言が複数あっても位置を復元できるよう、position_start/endをそのまま流用している。
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


// AI解説を生成して保存し、結果を返す
async function generateAiNote(markerId, selectedText) {
  return await ichniteDataRequest("generateAiNote", { markerId: Number(markerId), selectedText });
}


// マーカーを削除
async function deleteMarker(markerId) {
  await ichniteDataRequest("deleteMarker", { markerId: Number(markerId) });
}


// マーカー一覧を全件取得
async function fetchAllMarkers() {
  return await ichniteDataRequest("fetchAllMarkers");
}


// 現在のページのマーカーだけを取得
async function fetchMarkersForPage() {
  return await ichniteDataRequest("fetchMarkersForPage", { pageUrl: window.location.href });
}


// 記録帳ページ用の一覧を取得（page_urlを含む）
async function fetchMarkerBookEntries() {
  return await ichniteDataRequest("fetchMarkerBookEntries");
}


// 指定マーカーのAI解説を取得（未生成ならnull）
async function fetchAiNote(markerId) {
  try {
    return await ichniteDataRequest("fetchAiNote", { markerId: Number(markerId) });
  } catch {
    return null;
  }
}


// マーカーのメモを保存（未登録なら新規作成、登録済みなら上書き）
async function saveMarkerMemo(markerId, memo) {
  return await ichniteDataRequest("saveMarkerMemo", { markerId: Number(markerId), memo });
}


// 他のUI（サイドパネル・記録帳ページ）へマーカーの変更を通知する
function notifyMarkersUpdated(extra = {}) {
  chrome.runtime.sendMessage({ type: "ichnite:markers-updated", ...extra }).catch(() => {});
}
