// ==========================================================
// background.js — 拡張機能のService Worker（バックグラウンド）。
// 常駐して以下の役割を担う：
//   1. マーカー・メモ・AI解説の読み書き（chrome.storage.localを直接操作。
//      実処理は modules/dataStore.js）
//      ※以前はローカルで動かすFastAPIバックエンドにfetchしていたが、
//        この構成では拡張機能単体で完結する（外部サーバー・Python等は不要）
//   2. OpenAI APIの直接呼び出し（AI解説の生成。実処理は modules/aiService.js。
//      APIキーは ui/settings.html で登録し、chrome.storage.localに保存する）
//   3. 「記録帳を開く」要求を受けて、既存タブがあればそこへ切り替え、無ければ新規作成
//   4. 別タブでマーカー位置へ移動する要求を受けて新しいタブを開く
//   5. あるタブでのマーカー変更を、他の全タブのcontent scriptへ中継する
//      （chrome.runtime.sendMessageは他タブのcontent scriptには届かないため）
// ==========================================================

importScripts("modules/dataStore.js", "modules/aiService.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ichnite:open-marker-book") {
    openOrFocusMarkerBook();
    return;
  }

  if (message?.type === "ichnite:open-tab") {
    // サイドパネルから別ページのマーカーへ移動する際、現在のタブを奪わず新しいタブで開く
    chrome.tabs.create({ url: message.url });
    return;
  }

  if (message?.type === "ichnite:markers-updated") {
    // chrome.runtime.sendMessage は拡張ページ（記録帳など）には届くが、
    // 他タブのコンテンツスクリプトには届かないため、ここで中継する。
    relayToOtherTabs(message, sender.tab?.id);
    return;
  }

  if (message?.type === "ichnite:data") {
    handleDataAction(message.action, message.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true; // sendResponseを非同期で呼ぶために必要
  }
});


// modules/dataStore.js・modules/aiService.js の関数へディスパッチする窓口。
// content script・拡張ページ側は必ずこのactionの形でメッセージを送る
// （storage.js の ichniteDataRequest 参照）。
async function handleDataAction(action, payload = {}) {
  switch (action) {
    case "saveMarker":
      return await dsSaveMarker(payload);
    case "fetchAllMarkers":
      return await dsFetchAllMarkers();
    case "fetchMarkersForPage":
      return await dsFetchMarkersForPage(payload.pageUrl);
    case "fetchMarkerBookEntries":
      return await dsFetchMarkerBookEntries();
    case "deleteMarker":
      return await dsDeleteMarker(payload.markerId);
    case "saveMarkerMemo":
      return await dsSaveMarkerMemo(payload.markerId, payload.memo);
    case "fetchAiNote":
      return await dsFetchAiNote(payload.markerId);
    case "generateAiNote": {
      const aiResult = await generateAiNoteViaOpenAi(payload.selectedText);
      return await dsSaveAiNote(payload.markerId, aiResult);
    }
    case "getSettings":
      return await dsGetSettings();
    case "saveSettings":
      return await dsSaveSettings(payload);
    default:
      throw new Error(`unknown action: ${action}`);
  }
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
