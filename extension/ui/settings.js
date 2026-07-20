/* =============================================
   設定ページ  settings.js
   OpenAI APIキーの入力・保存・表示切り替えを行う。
   独立した拡張機能ページなので、marker_book.js等と同様に
   background.js（chrome.storage.local）へ自前でデータ要求する。
   ============================================= */

const apiKeyInput       = document.getElementById("api-key-input");
const toggleVisibilityBtn = document.getElementById("toggle-visibility-btn");
const saveBtn            = document.getElementById("save-btn");
const saveStatus         = document.getElementById("save-status");

async function ichniteDataRequest(action, payload) {
  const response = await chrome.runtime.sendMessage({
    type: "ichnite:data",
    action,
    payload,
  });
  if (!response) throw new Error("拡張機能のバックグラウンドと通信できませんでした");
  if (!response.ok) throw new Error(response.error || "不明なエラーが発生しました");
  return response.data;
}

async function loadSettings() {
  try {
    const settings = await ichniteDataRequest("getSettings");
    apiKeyInput.value = settings?.openaiApiKey || "";
  } catch (error) {
    console.log("設定の取得に失敗:", error);
  }
}

toggleVisibilityBtn.addEventListener("click", () => {
  const isHidden = apiKeyInput.type === "password";
  apiKeyInput.type = isHidden ? "text" : "password";
  toggleVisibilityBtn.textContent = isHidden ? "隠す" : "表示";
});

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  saveStatus.hidden = true;

  try {
    await ichniteDataRequest("saveSettings", {
      openaiApiKey: apiKeyInput.value.trim(),
    });
    saveStatus.hidden = false;
    setTimeout(() => { saveStatus.hidden = true; }, 2000);
  } catch (error) {
    console.log("設定の保存に失敗:", error);
    alert(`設定の保存に失敗しました。\n${error.message}`);
  } finally {
    saveBtn.disabled = false;
  }
});

loadSettings();
