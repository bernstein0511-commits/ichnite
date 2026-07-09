/* =============================================
   マーカー記録帳  marker_book.js
   拡張機能のバックエンド(FastAPI)から実データを取得し、
   一覧表示・検索/絞り込み・詳細表示・メモ編集・削除を行う。
   ============================================= */

const API_BASE = "http://localhost:8000";

// ── 色の日本語ラベル ─────────────────────────────
const COLOR_LABEL = {
  yellow: "黄",
  green: "緑",
  blue: "青",
  red: "赤",
  purple: "紫",
};

// ── SVG アイコン ────────────────────────────────
const ICON = {
  eye: `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  edit: `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
};

// ── データ ──────────────────────────────────────
let markers = []; // サーバから取得した全件（画面表示用に加工済み）

// ── DOM 参照 ────────────────────────────────────
const tableBody     = document.getElementById("marker-table-body");
const loadingState   = document.getElementById("loading-state");
const emptyState     = document.getElementById("empty-state");
const errorState     = document.getElementById("error-state");
const statusBar      = document.getElementById("status-bar");
const filterPage     = document.getElementById("filter-page");
const filterColor    = document.getElementById("filter-color");
const filterPeriod   = document.getElementById("filter-period");
const filterKeyword  = document.getElementById("filter-keyword");
const modalOverlay   = document.getElementById("modal-overlay");
const modalBox       = document.getElementById("modal-box");

// ── データ取得 ──────────────────────────────────
async function loadMarkerBook() {
  setViewState("loading");

  try {
    const res = await fetch(`${API_BASE}/marker_book/full`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    markers = data.map(item => ({
      id: item.marker_id,
      word: item.selected_text,
      color: item.color,
      memo: item.memo || "",
      explanation: item.explanation || "",
      similarWords: item.similar_words || "",
      antonyms: item.antonyms || "",
      usageExample: item.usage_example || "",
      pageId: item.page_id,
      pageUrl: item.page_url,
      pageTitle: item.page_title || item.page_url,
      createdAt: item.created_at,
    }));

    populateSelects();
    applyFilters();
    showStatus(`全 ${markers.length} 件のマーカーを読み込みました`, false);
  } catch (error) {
    console.log("記録帳の取得に失敗:", error);
    setViewState("error");
  }
}

// ── 表示状態の切り替え ──────────────────────────
function setViewState(state) {
  loadingState.hidden = state !== "loading";
  errorState.hidden = state !== "error";
  emptyState.hidden = true;
  if (state === "loading" || state === "error") {
    tableBody.innerHTML = "";
  }
}

function showStatus(message, isError) {
  statusBar.textContent = message;
  statusBar.hidden = false;
  statusBar.classList.toggle("error", !!isError);
  if (!isError) {
    setTimeout(() => {
      statusBar.hidden = true;
    }, 3000);
  }
}

// ── フィルター選択肢を動的生成 ──────────────────
function populateSelects() {
  const currentPage = filterPage.value;
  const currentColor = filterColor.value;

  const pages = [...new Set(markers.map(m => m.pageTitle))];
  const colors = [...new Set(markers.map(m => m.color))];

  filterPage.innerHTML = '<option value="">すべてのページ</option>';
  pages.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    filterPage.appendChild(opt);
  });

  filterColor.innerHTML = '<option value="">すべての色</option>';
  colors.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = COLOR_LABEL[c] || c;
    filterColor.appendChild(opt);
  });

  // 再読み込み後も選択状態を維持する
  if ([...filterPage.options].some(o => o.value === currentPage)) {
    filterPage.value = currentPage;
  }
  if ([...filterColor.options].some(o => o.value === currentColor)) {
    filterColor.value = currentColor;
  }
}

// ── 行 HTML を生成 ──────────────────────────────
function createRow(m) {
  const tr = document.createElement("tr");
  tr.dataset.id = m.id;

  const date = new Date(m.createdAt);
  const dateStr = date.toLocaleDateString("ja-JP");
  const timeStr = date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  const explanationHtml = m.explanation
    ? escapeHtml(m.explanation)
    : "（AI解説は未生成です）";

  tr.innerHTML = `
    <td class="cell-word">
      <div class="word-name">${escapeHtml(m.word)}</div>
      <span class="tag"><span class="color-dot ${escapeHtml(m.color)}"></span>${COLOR_LABEL[m.color] || escapeHtml(m.color)}</span>
    </td>
    <td class="cell-memo">
      <div class="memo-desc${m.explanation ? "" : " empty"}">${explanationHtml}</div>
      ${m.memo ? `<div class="memo-note">${escapeHtml(m.memo)}</div>` : ""}
    </td>
    <td class="cell-source">
      <a class="source-link" href="${escapeHtml(m.pageUrl)}" target="_blank" rel="noopener">${escapeHtml(m.pageTitle)}</a>
      <div class="source-url">${escapeHtml(shortenUrl(m.pageUrl))}</div>
    </td>
    <td class="cell-date">
      <div class="date-main">${dateStr}</div>
      <div class="date-time">${timeStr}</div>
    </td>
    <td class="cell-actions">
      <div class="action-group">
        <button class="action-btn" data-action="view">${ICON.eye}表示</button>
        <button class="action-btn" data-action="edit">${ICON.edit}編集</button>
        <button class="action-btn delete" data-action="delete">${ICON.trash}削除</button>
      </div>
    </td>
  `;

  tr.querySelector('[data-action="view"]').addEventListener("click", () => openViewModal(m));
  tr.querySelector('[data-action="edit"]').addEventListener("click", () => openEditModal(m));
  tr.querySelector('[data-action="delete"]').addEventListener("click", () => onDelete(m, tr));

  return tr;
}

// ── テーブル描画 ────────────────────────────────
function renderTable(list) {
  tableBody.innerHTML = "";
  loadingState.hidden = true;
  errorState.hidden = true;

  if (list.length === 0) {
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
    list.forEach(m => tableBody.appendChild(createRow(m)));
  }
}

// ── フィルタリング ──────────────────────────────
function applyFilters() {
  const page    = filterPage.value;
  const color   = filterColor.value;
  const period  = parseInt(filterPeriod.value, 10);
  const keyword = filterKeyword.value.trim().toLowerCase();

  const now = new Date();

  const filtered = markers.filter(m => {
    if (page && m.pageTitle !== page) return false;
    if (color && m.color !== color) return false;

    if (period) {
      const recordDate = new Date(m.createdAt);
      const diffDays = (now - recordDate) / (1000 * 60 * 60 * 24);
      if (diffDays > period) return false;
    }

    if (keyword) {
      const haystack = [m.word, m.explanation, m.memo, m.similarWords,
        m.antonyms, m.usageExample, m.pageTitle].join(" ").toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    return true;
  });

  renderTable(filtered);
}

// ── 詳細表示モーダル ────────────────────────────
function openViewModal(m) {
  const date = new Date(m.createdAt);
  const dateStr = `${date.toLocaleDateString("ja-JP")} ${date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;

  modalBox.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">${escapeHtml(m.word)}</div>
      <button class="modal-close" id="modal-close-btn">×</button>
    </div>
    <div class="modal-tag-row">
      <span class="tag"><span class="color-dot ${escapeHtml(m.color)}"></span>${COLOR_LABEL[m.color] || escapeHtml(m.color)}</span>
    </div>

    <div class="modal-section">
      <div class="modal-section-label">AIによる解説</div>
      <div class="modal-section-body${m.explanation ? "" : " empty"}">${m.explanation ? escapeHtml(m.explanation) : "まだ生成されていません"}</div>
    </div>

    ${m.similarWords ? `
    <div class="modal-section">
      <div class="modal-section-label">類似語</div>
      <div class="modal-section-body">${escapeHtml(m.similarWords)}</div>
    </div>` : ""}

    ${m.antonyms ? `
    <div class="modal-section">
      <div class="modal-section-label">対義語</div>
      <div class="modal-section-body">${escapeHtml(m.antonyms)}</div>
    </div>` : ""}

    ${m.usageExample ? `
    <div class="modal-section">
      <div class="modal-section-label">例文</div>
      <div class="modal-section-body">${escapeHtml(m.usageExample)}</div>
    </div>` : ""}

    <div class="modal-section">
      <div class="modal-section-label">メモ</div>
      <div class="modal-section-body${m.memo ? "" : " empty"}">${m.memo ? escapeHtml(m.memo) : "メモはまだありません"}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-label">記録元</div>
      <div class="modal-source">
        <a href="${escapeHtml(m.pageUrl)}" target="_blank" rel="noopener">${escapeHtml(m.pageTitle)}</a><br>
        ${dateStr} に記録
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn" id="modal-edit-btn">メモを編集</button>
      <button class="btn primary" id="modal-close-btn2">閉じる</button>
    </div>
  `;

  showModal();

  modalBox.querySelector("#modal-close-btn").addEventListener("click", closeModal);
  modalBox.querySelector("#modal-close-btn2").addEventListener("click", closeModal);
  modalBox.querySelector("#modal-edit-btn").addEventListener("click", () => openEditModal(m));
}

// ── メモ編集モーダル ────────────────────────────
function openEditModal(m) {
  modalBox.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">「${escapeHtml(m.word)}」のメモを編集</div>
      <button class="modal-close" id="modal-close-btn">×</button>
    </div>
    <div class="modal-section">
      <textarea id="memo-textarea" placeholder="気づいたことや覚えておきたいことをメモしましょう">${escapeHtml(m.memo)}</textarea>
    </div>
    <div class="modal-footer">
      <span class="modal-save-status" id="save-status" hidden>保存しました</span>
      <button class="btn" id="modal-cancel-btn">キャンセル</button>
      <button class="btn primary" id="modal-save-btn">保存</button>
    </div>
  `;

  showModal();

  const textarea = modalBox.querySelector("#memo-textarea");
  textarea.focus();

  modalBox.querySelector("#modal-close-btn").addEventListener("click", closeModal);
  modalBox.querySelector("#modal-cancel-btn").addEventListener("click", closeModal);
  modalBox.querySelector("#modal-save-btn").addEventListener("click", async () => {
    const newMemo = textarea.value.trim();
    const saveBtn = modalBox.querySelector("#modal-save-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";

    try {
      await saveMemo(m.id, newMemo);
      m.memo = newMemo;
      applyFilters();
      const status = modalBox.querySelector("#save-status");
      if (status) status.hidden = false;
      setTimeout(closeModal, 600);
    } catch (error) {
      console.log("メモ保存失敗:", error);
      saveBtn.disabled = false;
      saveBtn.textContent = "保存";
      alert("メモの保存に失敗しました。バックエンドが起動しているか確認してください。");
    }
  });
}

async function saveMemo(markerId, memo) {
  const res = await fetch(`${API_BASE}/marker_book/${markerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memo }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// ── 削除 ────────────────────────────────────────
async function onDelete(m, tr) {
  if (!confirm(`「${m.word}」を削除しますか？\nこの操作は取り消せません。`)) return;

  try {
    const res = await fetch(`${API_BASE}/markers/${m.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    markers = markers.filter(x => x.id !== m.id);
    tr.remove();
    if (tableBody.rows.length === 0) emptyState.hidden = false;
    showStatus(`「${m.word}」を削除しました`, false);
  } catch (error) {
    console.log("削除失敗:", error);
    alert("削除に失敗しました。バックエンドが起動しているか確認してください。");
  }
}

// ── モーダル制御 ────────────────────────────────
function showModal() {
  modalOverlay.hidden = false;
}

function closeModal() {
  modalOverlay.hidden = true;
  modalBox.innerHTML = "";
}

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalOverlay.hidden) closeModal();
});

// ── ユーティリティ ──────────────────────────────
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

// ── イベントリスナー登録 ────────────────────────
filterPage.addEventListener("change", applyFilters);
filterColor.addEventListener("change", applyFilters);
filterPeriod.addEventListener("change", applyFilters);
filterKeyword.addEventListener("input", applyFilters);

document.getElementById("btn-search").addEventListener("click", () => {
  filterKeyword.focus();
});

document.getElementById("btn-refresh").addEventListener("click", loadMarkerBook);
document.getElementById("btn-retry").addEventListener("click", loadMarkerBook);

// ── 初期化 ─────────────────────────────────────
loadMarkerBook();
