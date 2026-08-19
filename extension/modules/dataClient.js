// ==========================================================
// modules/dataClient.js — 拡張機能ページ（記録帳・詳細・設定）用の
// background.jsへの問い合わせ関数。content script側のstorage.jsと
// 中身はほぼ同じだが、実行コンテキストが別なので分けている。
// marker_book.html / marker_detail.html / settings.html から読み込む。
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
