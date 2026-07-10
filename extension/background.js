// ==========================================================
// background.js — 拡張機能のService Worker（バックグラウンド）。
// 常駐して以下の3役を担う：
//   1. content script(storage.js)の代わりにバックエンドAPIへfetchする
//      （Private Network Access回避。詳細はstorage.jsのコメント参照）
//   2. 「記録帳を開く」要求を受けて、既存タブがあればそこへ切り替え、無ければ新規作成
//   3. あるタブでのマーカー変更を、他の全タブのcontent scriptへ中継する
//      （chrome.runtime.sendMessageは他タブのcontent scriptには届かないため）
// ==========================================================

const ICHNITE_API_BASE = "http://localhost:8000";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ichnite:open-marker-book") {
    openOrFocusMarkerBook();
    return;
  }

  if (message?.type === "ichnite:markers-updated") {
    // chrome.runtime.sendMessage は拡張ページ（記録帳など）には届くが、
    // 他タブのコンテンツスクリプトには届かないため、ここで中継する。
    relayToOtherTabs(message, sender.tab?.id);
    return;
  }

  if (message?.type === "ichnite:api") {
    // 通常のWebページ上で動くコンテンツスクリプトが直接localhostへfetchすると
    // ChromeのPrivate Network Accessによりブロックされ、開発者向けフラグ付き起動が必要になる。
    // 拡張機能自身（バックグラウンド）はhost_permissionsにより制限を受けないため、ここで代行する。
    callIchniteApi(message)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true; // sendResponseを非同期で呼ぶために必要
  }
});


async function callIchniteApi({ path, method = "GET", body }) {
  const res = await fetch(`${ICHNITE_API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { ok: res.ok, status: res.status, data };
}


async function relayToOtherTabs(message, sourceTabId) {
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (tab.id === undefined || tab.id === sourceTabId) continue;
    chrome.tabs.sendMessage(tab.id, message).catch(() => {});
  }
}


// 記録帳ページが既に開いていればそのタブへ切り替え、なければ新規タブで開く
async function openOrFocusMarkerBook() {
  const url = chrome.runtime.getURL("ui/marker_book.html");
  const tabs = await chrome.tabs.query({ url: `${url}*` });

  if (tabs.length > 0) {
    const tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}
