/* =============================================
   マーカー記録帳  marker_book.js
   拡張機能のバックエンド(FastAPI)から実データを取得し、
   一覧表示・検索/絞り込み・学習統計（ヒートマップ等）・メモ編集・削除を行う。

   ※ ui/marker_book.html は content script ではなく独立した拡張機能ページ
   （chrome-extension://.../ui/marker_book.html）として開かれるため、
   modules/*.js（content.js・storage.js等）とはJSの実行コンテキストが別。
   そのためAPI_BASEやnotifyMarkersUpdated()等をこのファイル内で
   自前に定義している（modules/storage.jsの関数は使えない）。
   単語1件だけの詳細はui/marker_detail.jsが同じ構成で担当する。
   データの実体はbackground.js経由のchrome.storage.local（バックエンド不要）。
   ============================================= */

// background.js（chrome.storage.local）へのデータ要求。
// modules/storage.js の ichniteDataRequest と同じ形の呼び出し方だが、
// このページはcontent scriptとは別の実行コンテキストのため自前で定義する。
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

// ── 色の日本語ラベル ─────────────────────────────
const COLOR_LABEL = {
  yellow: "黄",
  green: "緑",
  blue: "青",
  red: "赤",
  purple: "紫",
};

// ── 曜日ラベル（0:日 〜 6:土） ───────────────────
const WEEKDAY_LABEL = ["日", "月", "火", "水", "木", "金", "土"];

// ── SVG アイコン ────────────────────────────────
const ICON = {
  eye: `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  edit: `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
};

// ── データ ──────────────────────────────────────
let markers = []; // サーバから取得した全件（画面表示用に加工済み）

// サイドパネルなど他コンテキストへマーカーの変更を通知する
function notifyMarkersUpdated(extra = {}) {
  chrome.runtime.sendMessage({ type: "ichnite:markers-updated", ...extra }).catch(() => {});
}

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
const statTotal          = document.getElementById("stat-total");
const statDays           = document.getElementById("stat-days");
const statCurrentStreak  = document.getElementById("stat-current-streak");
const statLongestStreak  = document.getElementById("stat-longest-streak");
const statsHeatmap       = document.getElementById("stats-heatmap");
const statsHeatmapMonths = document.getElementById("stats-heatmap-months");
const statsHeatmapSummary = document.getElementById("stats-heatmap-summary");
const statsColorBreakdown = document.getElementById("stats-color-breakdown");

// ── データ取得 ──────────────────────────────────
async function loadMarkerBook() {
  setViewState("loading");

  try {
    const data = await ichniteDataRequest("fetchMarkerBookEntries");

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
    renderStats(markers);
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
      <div class="word-badge ${escapeHtml(m.color)}">
        <span class="word-name">${escapeHtml(m.word)}</span>
      </div>
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
        <button class="action-btn" data-action="view" title="表示">${ICON.eye}</button>
        <button class="action-btn" data-action="edit" title="編集">${ICON.edit}</button>
        <button class="action-btn delete" data-action="delete" title="削除">${ICON.trash}</button>
      </div>
    </td>
  `;

  tr.querySelector('[data-action="view"]').addEventListener("click", () => {
    window.location.href = `marker_detail.html?id=${m.id}`;
  });
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
      alert(`メモの保存に失敗しました。\n${error.message}`);
    }
  });
}

async function saveMemo(markerId, memo) {
  return await ichniteDataRequest("saveMarkerMemo", { markerId, memo });
}

// ── 削除 ────────────────────────────────────────
async function onDelete(m, tr) {
  if (!confirm(`「${m.word}」を削除しますか？\nこの操作は取り消せません。`)) return;

  try {
    await ichniteDataRequest("deleteMarker", { markerId: m.id });

    markers = markers.filter(x => x.id !== m.id);
    tr.remove();
    if (tableBody.rows.length === 0) emptyState.hidden = false;
    renderStats(markers);
    showStatus(`「${m.word}」を削除しました`, false);
    notifyMarkersUpdated({ deletedMarkerId: m.id });
  } catch (error) {
    console.log("削除失敗:", error);
    alert(`削除に失敗しました。\n${error.message}`);
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

// ── 学習の可視化 ────────────────────────────────
function toDateKey(dateInput) {
  const d = new Date(dateInput);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function renderStats(list) {
  renderStatCards(list);
  renderHeatmap(list);
  renderColorBreakdown(list);
}

function renderStatCards(list) {
  const dateCounts = new Map();
  list.forEach(m => {
    const key = toDateKey(m.createdAt);
    dateCounts.set(key, (dateCounts.get(key) || 0) + 1);
  });

  const { current, longest } = computeStreaks(new Set(dateCounts.keys()));

  statTotal.textContent = list.length;
  statDays.textContent = dateCounts.size;
  statCurrentStreak.textContent = `${current}日`;
  statLongestStreak.textContent = `${longest}日`;
}

// 現在の連続記録日数・最長連続記録日数を求める
function computeStreaks(dateSet) {
  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // 今日の記録がまだ無くてもstreakが途切れていない扱いにするため、昨日を起点にする
  if (!dateSet.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dateSet.has(toDateKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sortedKeys = [...dateSet].sort();
  let longest = 0;
  let run = 0;
  let prevDate = null;

  for (const key of sortedKeys) {
    const d = new Date(`${key}T00:00:00`);
    if (prevDate) {
      const diffDays = Math.round((d - prevDate) / 86400000);
      run = diffDays === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prevDate = d;
  }

  return { current, longest };
}

// GitHub風のヒートマップ（直近18週間、日曜始まり）
function renderHeatmap(list) {
  if (!statsHeatmap) return;

  const dateCounts = new Map();
  list.forEach(m => {
    const key = toDateKey(m.createdAt);
    dateCounts.set(key, (dateCounts.get(key) || 0) + 1);
  });

  const WEEKS = 18;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() - (WEEKS * 7 - 1));
  start.setDate(start.getDate() - start.getDay()); // 週の始まり（日曜）に揃える

  const days = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = toDateKey(cursor);
    days.push({ key, date: new Date(cursor), count: dateCounts.get(key) || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const maxCount = Math.max(1, ...days.map(d => d.count));

  statsHeatmap.innerHTML = "";
  statsHeatmap.style.setProperty("--heatmap-weeks", Math.ceil(days.length / 7));

  days.forEach(day => {
    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    cell.dataset.level = heatLevel(day.count, maxCount);
    cell.title = `${day.key}（${WEEKDAY_LABEL[day.date.getDay()]}）：${day.count}件`;
    statsHeatmap.appendChild(cell);
  });

  renderHeatmapMonths(days);
  renderHeatmapSummary(days);
}

// 週（列）の先頭日が月替わりのときだけ、その月をラベル表示する
function renderHeatmapMonths(days) {
  if (!statsHeatmapMonths) return;

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  let prevMonth = null;
  statsHeatmapMonths.innerHTML = weeks.map(week => {
    const month = week[0].date.getMonth();
    const label = month !== prevMonth ? `${month + 1}月` : "";
    prevMonth = month;
    return `<span class="heatmap-month-label">${label}</span>`;
  }).join("");
}

// ヒートマップの上に「直近◯週間で計◯件、記録した日は◯日」のサマリーを表示する
function renderHeatmapSummary(days) {
  if (!statsHeatmapSummary) return;

  const totalCount = days.reduce((sum, d) => sum + d.count, 0);
  const activeDays = days.filter(d => d.count > 0).length;
  const avgPerDay = (totalCount / days.length).toFixed(1);

  statsHeatmapSummary.textContent =
    `直近${days.length}日間で計${totalCount}件のマーカーを記録（記録した日は${activeDays}日、1日あたり平均${avgPerDay}件）`;
}

function heatLevel(count, maxCount) {
  if (count === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function renderColorBreakdown(list) {
  if (!statsColorBreakdown) return;

  const counts = { yellow: 0, green: 0, blue: 0, red: 0, purple: 0 };
  list.forEach(m => {
    if (counts[m.color] !== undefined) counts[m.color]++;
  });

  const total = list.length || 1;

  statsColorBreakdown.innerHTML = Object.entries(counts).map(([color, count]) => `
    <div class="color-bar-row">
      <span class="tag"><span class="color-dot ${color}"></span>${COLOR_LABEL[color] || color}</span>
      <div class="color-bar-track">
        <div class="color-bar-fill ${color}" style="width: ${(count / total) * 100}%"></div>
      </div>
      <span class="color-bar-count">${count}</span>
    </div>
  `).join("");
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

// 他コンテキスト（サイドパネル等）での変更を即時反映
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ichnite:markers-updated") {
    loadMarkerBook();
  }
});

// ── 初期化 ─────────────────────────────────────
loadMarkerBook();
