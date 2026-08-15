/* =============================================
   設定ページ  settings.js
   OpenAI APIキーの入力・保存・表示切り替え。
   background.jsへの問い合わせはmodules/dataClient.js（html側で読み込み済み）を使う。
   ============================================= */

const apiKeyInput = document.getElementById("api-key-input");
const toggleBtn = document.getElementById("toggle-visibility-btn");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");

async function loadSettings() {
  try {
    const settings = await ichniteDataRequest("getSettings");
    apiKeyInput.value = settings.openaiApiKey || "";
  } catch (error) {
    console.log("設定の取得に失敗:", error);
  }
}

toggleBtn.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleBtn.textContent = isPassword ? "隠す" : "表示";
});

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  saveStatus.hidden = true;

  try {
    await ichniteDataRequest("saveSettings", { openaiApiKey: apiKeyInput.value.trim() });
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
