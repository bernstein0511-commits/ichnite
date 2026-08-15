// ==========================================================
// background.js — 拡張機能のService Worker。常駐して以下を担う：
//   1. マーカー・メモ・AI解説の読み書き（chrome.storage.local。実処理はmodules/dataStore.js）
//   2. OpenAI APIの呼び出し（AI解説の生成。実処理はmodules/aiService.js。
//      キーはui/settings.htmlで登録する）
//   3. 「記録帳を開く」要求を受けて、既存タブがあれば切り替え、無ければ新規作成
//   4. サイドパネル等からの「別タブで開く」要求
//   5. あるタブでのマーカー変更を、他の全タブのcontent scriptへ中継する
//      （chrome.runtime.sendMessageは他タブのcontent scriptには届かないため）
//
// バックエンドサーバーには依存していない。拡張機能単体で完結する。
// ==========================================================

importScripts("modules/dataStore.js", "modules/aiService.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ichnite:open-marker-book") {
    openOrFocusMarkerBook();
    return;
  }

  if (message?.type === "ichnite:open-tab") {
    chrome.tabs.create({ url: message.url });
    return;
  }

  if (message?.type === "ichnite:markers-updated") {
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


// modules/dataStore.js・modules/aiService.jsへのディスパッチ窓口
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
      const note = await generateAiNoteViaOpenAi(payload.selectedText);
      return await dsSaveAiNote(payload.markerId, note);
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
    chrome.tabs.sendMessage(tab.id, message).catch(() => { });
  }
}


// 記録帳ページが既に開いていればそのタブへ切り替え、なければ新規タブで開く
async function openOrFocusMarkerBook() {
  const url = chrome.runtime.getURL("ui/marker_book.html");
  const tabs = await chrome.tabs.query({ url: `${url}*` });

  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}
