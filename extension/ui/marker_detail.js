/* =============================================
   単語の詳細ページ  marker_detail.js
   URLの ?id= で指定されたマーカー1件について、
   詳細表示・メモ編集・AI解説の生成/再生成・削除を行う。

   記録帳の一覧（marker_book.js）で「表示」を押すと
   marker_detail.html?id=<marker_id> にこのタブ内で遷移してくる。
   独立した拡張機能ページなので、marker_book.jsと同様にAPI呼び出し等を
   自前で持っている（modules/storage.jsとは別コンテキスト）。
   ============================================= */

const API_BASE = "http://localhost:8000";

const COLOR_LABEL = {
  yellow: "黄",
  green: "緑",
  blue: "青",
  red: "赤",
  purple: "紫",
};

const markerId = Number(new URLSearchParams(window.location.search).get("id"));

// ── DOM 参照 ────────────────────────────────────
const loadingState   = document.getElementById("loading-state");
const detailView     = document.getElementById("detail-view");
const errorState     = document.getElementById("error-state");

const wordText        = document.getElementById("word-text");
const wordBadge       = document.getElementById("word-badge");
const recordDate      = document.getElementById("record-date");
const rowMemo         = document.getElementById("row-memo");
const memoView        = document.getElementById("memo-view");
const explanationView = document.getElementById("explanation-view");
const usageView       = document.getElementById("usage-view");
const similarView     = document.getElementById("similar-view");
const antonymsView    = document.getElementById("antonyms-view");
const sourceView      = document.getElementById("source-view");

const btnEdit           = document.getElementById("btn-edit");
const btnDelete         = document.getElementById("btn-delete");
const btnRegenerateAi   = document.getElementById("btn-regenerate-ai");

let marker = null;
let allEntries = [];

// サイドパネルなど他コンテキストへマーカーの変更を通知する
function notifyMarkersUpdated(extra = {}) {
  chrome.runtime.sendMessage({ type: "ichnite:markers-updated", ...extra }).catch(() => {});
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname;
  } catch {
    return url;
  }
}

// text内に、自分以外の登録済みマーカーの単語が含まれていれば、その単語詳細ページへのリンクに変換する
function linkifyRegisteredWords(text, currentMarkerId) {
  const escaped = escapeHtml(text || "");
  if (!escaped) return escaped;

  // 同じ単語が複数登録されていても最初の1件だけを採用し、長い単語ほど優先してマッチさせる
  // （例："good"と"good idea"が両方登録されていた場合、"good idea"を先にリンク化する）
  const seenWords = new Set();
  const candidates = [];
  for (const entry of allEntries) {
    if (entry.marker_id === currentMarkerId) continue;
    const word = (entry.selected_text || "").trim();
    if (!word || seenWords.has(word)) continue;
    seenWords.add(word);
    candidates.push({ id: entry.marker_id, escapedWord: escapeHtml(word) });
  }
  if (candidates.length === 0) return escaped;

  candidates.sort((a, b) => b.escapedWord.length - a.escapedWord.length);

  const idByEscapedWord = new Map(candidates.map(c => [c.escapedWord, c.id]));
  const pattern = candidates
    .map(c => c.escapedWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  return escaped.replace(new RegExp(`(${pattern})`, "g"), (match) => {
    const id = idByEscapedWord.get(match);
    return `<a href="marker_detail.html?id=${id}" class="linked-word">${match}</a>`;
  });
}

// ── データ取得 ──────────────────────────────────
async function loadMarker() {
  if (!markerId) {
    showError();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/marker_book/full`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    allEntries = data;
    const entry = data.find(item => item.marker_id === markerId);

    if (!entry) {
      showError();
      return;
    }

    marker = {
      id: entry.marker_id,
      word: entry.selected_text,
      color: entry.color,
      memo: entry.memo || "",
      explanation: entry.explanation || "",
      similarWords: entry.similar_words || "",
      antonyms: entry.antonyms || "",
      usageExample: entry.usage_example || "",
      pageUrl: entry.page_url,
      pageTitle: entry.page_title || entry.page_url,
      createdAt: entry.created_at,
    };

    renderMarker();
  } catch (error) {
    console.log("マーカー詳細の取得に失敗:", error);
    showError();
  }
}

function showError() {
  loadingState.hidden = true;
  detailView.hidden = true;
  errorState.hidden = false;
}

// ── 表示 ────────────────────────────────────────
function renderMarker() {
  loadingState.hidden = true;
  errorState.hidden = true;
  detailView.hidden = false;

  document.title = `${marker.word} - Ichnite`;

  wordText.textContent = marker.word;
  wordBadge.innerHTML = `<span class="tag"><span class="color-dot ${marker.color}"></span>${COLOR_LABEL[marker.color] || marker.color}</span>`;

  const date = new Date(marker.createdAt);
  recordDate.textContent = date.toLocaleDateString("ja-JP");
  recordDate.dateTime = date.toISOString();

  renderMemo();

  if (marker.explanation) {
    explanationView.innerHTML = linkifyRegisteredWords(marker.explanation, marker.id);
  } else {
    explanationView.textContent = "まだ生成されていません";
  }
  explanationView.classList.toggle("empty", !marker.explanation);
  btnRegenerateAi.textContent = marker.explanation ? "再生成" : "生成";

  usageView.textContent = marker.usageExample || "―";
  usageView.classList.toggle("empty", !marker.usageExample);

  similarView.textContent = marker.similarWords || "―";
  similarView.classList.toggle("empty", !marker.similarWords);

  antonymsView.textContent = marker.antonyms || "―";
  antonymsView.classList.toggle("empty", !marker.antonyms);

  sourceView.innerHTML = marker.pageUrl
    ? `<a href="${escapeHtml(marker.pageUrl)}" target="_blank" rel="noopener">${escapeHtml(marker.pageTitle)}</a><br><span class="source-url">${escapeHtml(shortenUrl(marker.pageUrl))}</span>`
    : "―";
}

function renderMemo() {
  if (marker.memo) {
    memoView.innerHTML = linkifyRegisteredWords(marker.memo, marker.id);
  } else {
    memoView.textContent = "メモはまだありません";
  }
  memoView.classList.toggle("empty", !marker.memo);
}

// ── メモのインライン編集 ────────────────────────
btnEdit.addEventListener("click", () => {
  if (document.getElementById("memo-edit")) return; // 編集中は多重起動しない

  const textarea = document.createElement("textarea");
  textarea.id = "memo-edit";
  textarea.value = marker.memo || "";
  textarea.placeholder = "気づいたことや覚えておきたいことをメモしましょう";

  const actions = document.createElement("div");
  actions.className = "inline-edit-actions";
  actions.innerHTML = `
    <button type="button" class="btn" id="memo-cancel-btn">キャンセル</button>
    <button type="button" class="btn primary" id="memo-save-btn">保存</button>
  `;

  memoView.replaceWith(textarea);
  textarea.after(actions);
  textarea.focus();

  const restoreView = () => {
    textarea.remove();
    actions.remove();
    rowMemo.appendChild(memoView);
    renderMemo();
  };

  actions.querySelector("#memo-cancel-btn").addEventListener("click", restoreView);

  actions.querySelector("#memo-save-btn").addEventListener("click", async () => {
    const saveBtn = actions.querySelector("#memo-save-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";

    try {
      await saveMemo(marker.id, textarea.value.trim());
      marker.memo = textarea.value.trim();
      restoreView();
      notifyMarkersUpdated();
    } catch (error) {
      console.log("メモ保存失敗:", error);
      alert("メモの保存に失敗しました。バックエンドが起動しているか確認してください。");
      saveBtn.disabled = false;
      saveBtn.textContent = "保存";
    }
  });
});

async function saveMemo(id, memo) {
  const res = await fetch(`${API_BASE}/marker_book/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memo }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// ── AI解説の生成／再生成 ────────────────────────
btnRegenerateAi.addEventListener("click", async () => {
  btnRegenerateAi.disabled = true;
  const original = btnRegenerateAi.textContent;
  btnRegenerateAi.textContent = "生成中...";

  try {
    const res = await fetch(`${API_BASE}/ai_notes/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marker_id: marker.id, selected_text: marker.word }),
    });

    if (!res.ok) {
      // バックエンドの実際のエラー理由（detail）を拾う。取れない場合のみHTTPステータスにフォールバックする
      let detail = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        if (errBody?.detail) detail = errBody.detail;
      } catch {
        // レスポンスがJSONでない場合はHTTPステータスのままにする
      }
      throw new Error(detail);
    }

    const aiNote = await res.json();

    marker.explanation = aiNote.explanation || "";
    marker.similarWords = aiNote.similar_words || "";
    marker.antonyms = aiNote.antonyms || "";
    marker.usageExample = aiNote.usage_example || "";

    renderMarker();
    notifyMarkersUpdated();
  } catch (error) {
    console.log("AI解説生成失敗:", error);
    alert(`AI解説の生成に失敗しました。\n${error.message}`);
    btnRegenerateAi.disabled = false;
    btnRegenerateAi.textContent = original;
  }
});

// ── 削除 ────────────────────────────────────────
btnDelete.addEventListener("click", async () => {
  if (!marker) return;
  if (!confirm(`「${marker.word}」を削除しますか？\nこの操作は取り消せません。`)) return;

  try {
    const res = await fetch(`${API_BASE}/markers/${marker.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    notifyMarkersUpdated({ deletedMarkerId: marker.id });
    window.location.href = "marker_book.html";
  } catch (error) {
    console.log("削除失敗:", error);
    alert("削除に失敗しました。バックエンドが起動しているか確認してください。");
  }
});

// ── 初期化 ─────────────────────────────────────
loadMarker();
