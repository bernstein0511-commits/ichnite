// ==========================================================
// modules/panel.js — 画面右上に出るサイドパネル（☰ハンバーガーメニューで開閉）。
// このファイルの責務は大きく3つ：
//   1. createSidePanel()  … パネルとフローティングボタンのDOM構築・イベント登録
//   2. loadMarkerList()   … /marker_book/full を取得して一覧を描画
//   3. createMarkerListItem() … 1件分の行を作る（登録位置へ移動／メモ編集／削除）
// マーカーの削除・メモ保存の実処理はmarker.js/storage.jsに委譲し、ここではUIに徹する。
// ==========================================================

window.addEventListener("load", createSidePanel);

// 記録帳ページ・他タブでの変更をサイドパネルへ即時反映
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ichnite:markers-updated") {
    // このタブで該当マーカーが表示中であればハイライトも解除する
    if (message.deletedMarkerId) unwrapHighlightById(message.deletedMarkerId);
    loadMarkerList();
  }
});

const ICHNITE_COLOR_LABEL = {
  yellow: "黄",
  green: "緑",
  blue: "青",
  red: "赤",
  purple: "紫",
};


function createSidePanel() {
  const root = getIchniteRoot();

  if (root.getElementById("ichnite-side-panel")) return;

  const panel = document.createElement("div");
  panel.id = "ichnite-side-panel";
  // 初期状態ではハンバーガーメニュー（フローティングボタン）側を表示するため、パネルは閉じておく
  panel.style.display = "none";

  panel.innerHTML = `
    <div id="ichnite-panel-header">
      <div id="ichnite-panel-header-top">
        <span class="ichnite-panel-title">
          <img src="${chrome.runtime.getURL("icons/icon_white.png")}" alt="" id="ichnite-panel-logo" />
          Ichnite
        </span>
        <button id="closePanel">×</button>
      </div>
      <div id="ichnite-panel-header-actions">
        <h2>表示設定（ON / OFF）</h2>
        <button class="ichnite-setting-card" id="toggleMarkers" title="ページ上のマーカー表示を切り替え">
          <span class="ichnite-marker-icon" aria-hidden="true"></span>
          <span class="ichnite-setting-copy">
            <strong>マーカー</strong>
            <small id="markersStatus">現在：表示中</small>
          </span>
          <span class="ichnite-setting-toggle" id="markersToggle" aria-hidden="true"><span></span></span>
        </button>
        <button class="ichnite-setting-card" id="toggleToolbar" title="文字のポップアップ表示を切り替え">
          <span class="ichnite-setting-icon ichnite-popup-icon" aria-hidden="true">•••</span>
          <span class="ichnite-setting-copy">
            <strong>ポップアップ</strong>
            <small id="popupStatus">現在：表示中</small>
          </span>
          <span class="ichnite-setting-toggle" id="popupToggle" aria-hidden="true"><span></span></span>
        </button>
        <button class="ichnite-setting-card ichnite-records-card" id="openMarkerBook" title="マーカー記録帳を開く">
          <span class="ichnite-setting-icon ichnite-book-icon" aria-hidden="true"><span></span></span>
          <span class="ichnite-setting-copy">
            <strong>記録帳</strong>
            <small>保存したメモを一覧で確認する</small>
          </span>
          <span class="ichnite-records-arrow" aria-hidden="true">›</span>
        </button>
      </div>
    </div>
    <div id="ichnite-panel-content">
      <div id="ichnite-filter-bar">
        <select id="filterCurrentPageSelect" title="表示範囲">
          <option value="all">表示範囲: 全ページ</option>
          <option value="current">表示範囲: このページ</option>
        </select>
        <select id="panelSortSelect" title="並び替え">
          <option value="created_desc">新しい順</option>
          <option value="created_asc">古い順</option>
          <option value="word_asc">あいうえお順</option>
          <option value="word_desc">あいうえお逆順</option>
          <option value="page_asc">元のページ順</option>
          <option value="color">色順</option>
        </select>
      </div>
      <p id="ichnite-loading">読み込み中...</p>
      <ul id="ichnite-marker-list"></ul>
    </div>
  `;

  root.appendChild(panel);

  // 記録帳ページを開く（既に開いていればそのタブに切り替える）
  root.getElementById("openMarkerBook").onclick = () => {
    chrome.runtime.sendMessage({ type: "ichnite:open-marker-book" });
  };

  // ページ上のマーカー表示/非表示・ポップアップ表示/非表示は、タブごとではなく
  // 全タブ共通の設定として扱う（chrome.storage.localに保存し、他タブの変更は
  // chrome.storage.onChangedで即座に反映する。保存先はdataStore.jsのdsGetSettings/dsSaveSettings）。
  let markersVisible = true;
  let toolbarEnabled = true;
  const toggleMarkersBtn = root.getElementById("toggleMarkers");
  const toggleToolbarBtn = root.getElementById("toggleToolbar");

  function applyMarkersVisible(visible) {
    markersVisible = visible;
    document.documentElement.classList.toggle("ichnite-markers-hidden", !visible);
    root.getElementById("markersStatus").textContent = visible ? "現在：表示中" : "現在：非表示";
    root.getElementById("markersToggle").classList.toggle("is-on", visible);
    toggleMarkersBtn.classList.toggle("is-off", !visible);
  }

  function applyToolbarEnabled(enabled) {
    toolbarEnabled = enabled;
    ichniteToolbarEnabled = enabled;
    root.getElementById("popupStatus").textContent = enabled ? "現在：表示中" : "現在：非表示";
    root.getElementById("popupToggle").classList.toggle("is-on", enabled);
    toggleToolbarBtn.classList.toggle("is-off", !enabled);
    if (!enabled) {
      removeToolbar();
      removeMemoPopup();
    }
  }

  // 起動時に他タブと共通の設定を読み込んで反映する
  ichniteDataRequest("getSettings").then((settings) => {
    applyMarkersVisible(settings.markersVisible !== false);
    applyToolbarEnabled(settings.popupEnabled !== false);
    if (settings.floatingButtonPos) applyFloatingButtonPos(settings.floatingButtonPos);
  }).catch((error) => {
    console.log("設定の取得に失敗:", error.message);
  });

  toggleMarkersBtn.onclick = async () => {
    const next = !markersVisible;
    applyMarkersVisible(next);
    try {
      await ichniteDataRequest("saveSettings", { markersVisible: next });
    } catch (error) {
      console.log("設定の保存に失敗:", error.message);
    }
  };

  toggleToolbarBtn.onclick = async () => {
    const next = !toolbarEnabled;
    applyToolbarEnabled(next);
    try {
      await ichniteDataRequest("saveSettings", { popupEnabled: next });
    } catch (error) {
      console.log("設定の保存に失敗:", error.message);
    }
  };

  // 他タブ・記録帳ページ等での切り替えを即座に反映する
  // （content scriptからも chrome.storage.onChanged は直接購読できる）
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.ichnite_settings) return;
    const newSettings = changes.ichnite_settings.newValue || {};
    if (newSettings.markersVisible !== undefined && newSettings.markersVisible !== markersVisible) {
      applyMarkersVisible(newSettings.markersVisible);
    }
    if (newSettings.popupEnabled !== undefined && newSettings.popupEnabled !== toolbarEnabled) {
      applyToolbarEnabled(newSettings.popupEnabled);
    }
    if (newSettings.floatingButtonPos) {
      applyFloatingButtonPos(newSettings.floatingButtonPos);
    }
  });

  // 表示範囲はDOM上のselect値で保持し、一覧取得時に参照する。
  const filterCurrentPageSelect = root.getElementById("filterCurrentPageSelect");
  filterCurrentPageSelect.addEventListener("change", () => {
    loadMarkerList();
  });

  // 並び替え
  const panelSortSelect = root.getElementById("panelSortSelect");
  panelSortSelect.addEventListener("change", loadMarkerList);

  // フローティングボタン(初期状態はこちらを表示する)
  const floatingButton = document.createElement("div");
  floatingButton.id = "ichnite-floating-button";
  floatingButton.innerHTML = `<img src="${chrome.runtime.getURL("icons/icon_white.png")}" alt="" id="ichnite-floating-icon" />`;
  root.appendChild(floatingButton);

  // フローティングボタンの位置も全タブ共通にする。他タブでウィンドウサイズが違うと
  // 画面外に出てしまう可能性があるため、反映後は必ず画面内へ収まるよう補正する。
  //
  // 注意：clampPopupToViewport()（getBoundingClientRect()で実測して補正する版）は
  // ここでは使えない。この関数はページ読み込み直後、panel-ui.cssの読み込みが
  // まだ完了していない可能性があるタイミングで呼ばれるため、position:fixedが
  // 効く前の「ページの通常の流れの中の位置」（ページが長いと大きく下の方など）を
  // 実測してしまい、それを基準に補正すると逆に画面外はるか彼方へ飛んでいって
  // ボタンが完全に消えてしまう。そのためDOM計測に頼らず、CSS側のサイズ(56px)を
  // 決め打ちで使って座標だけを計算する。
  function applyFloatingButtonPos(pos) {
    const SIZE = 56;
    const MARGIN = 8;
    let left = parseFloat(pos.left) || 0;
    let top = parseFloat(pos.top) || 0;

    const maxLeft = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN);
    const maxTop = Math.max(MARGIN, window.innerHeight - SIZE - MARGIN);
    left = Math.min(Math.max(left, MARGIN), maxLeft);
    top = Math.min(Math.max(top, MARGIN), maxTop);

    floatingButton.style.left = `${left}px`;
    floatingButton.style.top = `${top}px`;
  }

  // 閉じる
  root.getElementById("closePanel").onclick = () => {
    panel.style.display = "none";
    floatingButton.style.display = "flex";
  };

  // 再展開
  let isDragging = false;
  let hasMoved = false;
  let startX = 0, startY = 0, offsetX = 0, offsetY = 0;

  floatingButton.addEventListener("mousedown", (event) => {
    isDragging = true;
    hasMoved = false;
    startX = event.clientX;
    startY = event.clientY;
    offsetX = event.clientX - floatingButton.offsetLeft;
    offsetY = event.clientY - floatingButton.offsetTop;
  });

  document.addEventListener("mousemove", (event) => {
    if (!isDragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
    floatingButton.style.left = `${event.clientX - offsetX}px`;
    floatingButton.style.top = `${event.clientY - offsetY}px`;
  });

  document.addEventListener("mouseup", async () => {
    if (isDragging && hasMoved) {
      // 実際にドラッグで動かした場合だけ、位置を全タブ共通の設定として保存する
      try {
        await ichniteDataRequest("saveSettings", {
          floatingButtonPos: { left: floatingButton.style.left, top: floatingButton.style.top },
        });
      } catch (error) {
        console.log("フローティングボタン位置の保存に失敗:", error.message);
      }
    }
    isDragging = false;
  });

  floatingButton.addEventListener("click", () => {
    if (hasMoved) { hasMoved = false; return; }
    // CSS側のレイアウト（display: flex; flex-direction: column;）を壊さないよう、
    // "block"ではなく"flex"に戻す
    panel.style.display = "flex";
    floatingButton.style.display = "none";
    loadMarkerList();  // パネルを開くたびに最新を取得
  });

  // サイドパネル自体のドラッグ移動（フローティングボタンと同じ仕組み）。
  // ドラッグ開始はタイトル帯だけに限定し、閉じるボタンは通常のクリックとして扱う。
  const panelHeaderTop = root.getElementById("ichnite-panel-header-top");
  let isPanelDragging = false;
  let panelOffsetX = 0, panelOffsetY = 0;

  panelHeaderTop.addEventListener("mousedown", (event) => {
    if (event.currentTarget !== panelHeaderTop) return;
    if (event.target.closest("button")) return;
    isPanelDragging = true;
    panelOffsetX = event.clientX - panel.offsetLeft;
    panelOffsetY = event.clientY - panel.offsetTop;
  });

  panel.addEventListener("mousedown", (event) => {
    if (!event.target.closest("#ichnite-panel-header-top")) {
      isPanelDragging = false;
    }
  });

  document.addEventListener("mousemove", (event) => {
    if (!isPanelDragging) return;
    panel.style.left = `${event.clientX - panelOffsetX}px`;
    panel.style.top = `${event.clientY - panelOffsetY}px`;
  });

  document.addEventListener("mouseup", () => { isPanelDragging = false; });
}


// 色順のときの並び順（ツールバーの色スウォッチと同じ並び）
const ICHNITE_COLOR_ORDER = ["yellow", "green", "blue", "red", "purple"];

function sortPanelMarkers(list, sortKey) {
  const sorted = [...list];

  switch (sortKey) {
    case "created_asc":
      sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      break;
    case "word_asc":
      sorted.sort((a, b) => a.selected_text.localeCompare(b.selected_text, "ja"));
      break;
    case "word_desc":
      sorted.sort((a, b) => b.selected_text.localeCompare(a.selected_text, "ja"));
      break;
    case "page_asc":
      sorted.sort((a, b) => (a.page_title || a.page_url || "").localeCompare(b.page_title || b.page_url || "", "ja"));
      break;
    case "color":
      sorted.sort((a, b) => ICHNITE_COLOR_ORDER.indexOf(a.color) - ICHNITE_COLOR_ORDER.indexOf(b.color));
      break;
    case "created_desc":
    default:
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
  }

  return sorted;
}

async function loadMarkerList() {
  const root = getIchniteRoot();
  const list = root.getElementById("ichnite-marker-list");
  const loading = root.getElementById("ichnite-loading");
  const filterSelect = root.getElementById("filterCurrentPageSelect");
  const sortSelect = root.getElementById("panelSortSelect");

  if (!list) return;

  loading.style.display = "block";
  loading.textContent = "読み込み中...";
  list.innerHTML = "";

  const onlyCurrentPage = filterSelect?.value === "current";
  const sortKey = sortSelect?.value || "created_desc";

  try {
    const entries = await fetchMarkerBookEntries();
    // 同じページ・同じ単語・同じ色が複数あるものだけ、登場順の番号を割り当てる
    const dupMap = computeDuplicateNumbers(entries);
    const filtered = onlyCurrentPage
      ? entries.filter(m => m.page_url === window.location.href)
      : entries;
    const markers = sortPanelMarkers(filtered, sortKey);

    loading.style.display = "none";

    if (markers.length === 0) {
      list.innerHTML = onlyCurrentPage
        ? "<li>このページにはまだマーカーがありません</li>"
        : "<li>まだマーカーがありません</li>";
      return;
    }

    markers.forEach(marker => list.appendChild(createMarkerListItem(marker, dupMap.get(marker.marker_id))));

  } catch (error) {
    loading.textContent = "取得できませんでした（APIに接続できません）";
  }
}


function createMarkerListItem(marker, dup) {
  const colorLabel = ICHNITE_COLOR_LABEL[marker.color] || marker.color;
  const dateLabel = new Date(marker.created_at).toLocaleDateString("ja-JP");
  const dupHtml = dup
    ? `<span class="dup-number" title="このページ内で同じ単語・同じ色が${dup.total}件あるうちの${dup.index}番目">${dup.index}</span>`
    : "";

  const li = document.createElement("li");
  li.className = `ichnite-dict-item ${marker.color || ""}`;
  li.innerHTML = `
    <div class="ichnite-dict-word" title="このページ内の登録位置へ移動">${escapeIchniteHtml(marker.selected_text)}${dupHtml}</div>
    <div class="ichnite-dict-meta">
      <span><span class="ichnite-color-dot ${marker.color}"></span>${colorLabel}</span>
      <span class="ichnite-dict-date">${dateLabel}</span>
    </div>
    <div class="ichnite-dict-memo-area"></div>
    <div class="ichnite-dict-actions">
      <button class="ichnite-dict-ai-btn">AI生成</button>
      <button class="ichnite-dict-memo-btn"></button>
      <button class="ichnite-dict-delete">削除</button>
    </div>
  `;

  const memoArea = li.querySelector(".ichnite-dict-memo-area");
  const memoBtn = li.querySelector(".ichnite-dict-memo-btn");
  const aiBtn = li.querySelector(".ichnite-dict-ai-btn");
  renderPanelMemoView(memoArea, memoBtn, aiBtn, marker);

  // 登録文字クリックで該当位置へ遷移
  li.querySelector(".ichnite-dict-word").addEventListener("click", () => {
    goToMarker(marker);
  });

  // メモの追加・編集（テーマに合わせたインライン編集。prompt()は使わない）
  memoBtn.addEventListener("click", () => {
    if (memoBtn.textContent === "再生成") {
      generatePanelAiNote(memoArea, memoBtn, aiBtn, marker);
    } else {
      renderPanelMemoEdit(memoArea, memoBtn, aiBtn, marker);
    }
  });

  aiBtn.addEventListener("click", () => {
    if (aiBtn.textContent === "メモ") {
      renderPanelMemoView(memoArea, memoBtn, aiBtn, marker);
      return;
    }
    if (marker.explanation) {
      renderPanelAiView(memoArea, memoBtn, aiBtn, marker);
      return;
    }
    generatePanelAiNote(memoArea, memoBtn, aiBtn, marker);
  });

  // 削除ボタン（ページ上のハイライトも合わせて除去する）
  li.querySelector(".ichnite-dict-delete").addEventListener("click", async () => {
    try {
      await removeMarkerCompletely(marker.marker_id);
      li.remove();
    } catch (error) {
      console.log("マーカー削除失敗:", error.message);
      alert(`マーカーの削除に失敗しました。\n${error.message}`);
    }
  });

  return li;
}

function renderPanelMemoView(memoArea, memoBtn, aiBtn, marker) {
  const detailUrl = chrome.runtime.getURL(`ui/marker_detail.html?id=${encodeURIComponent(marker.marker_id)}`);
  memoArea.innerHTML = marker.memo
    ? `<a class="ichnite-dict-detail-link" href="${detailUrl}" target="_blank" rel="noopener"><div class="ichnite-dict-memo">${escapeIchniteHtml(marker.memo)}</div></a>`
    : "";
  bindPanelDetailLink(memoArea);
  memoBtn.textContent = marker.memo ? "メモを編集" : "メモを追加";
  aiBtn.disabled = false;
  aiBtn.textContent = "AI生成";
}

function renderPanelAiView(memoArea, memoBtn, aiBtn, marker) {
  const detailUrl = chrome.runtime.getURL(`ui/marker_detail.html?id=${encodeURIComponent(marker.marker_id)}`);
  const aiFields = [
    ["解説", marker.explanation],
    ["類似語", marker.similar_words],
    ["対義語", marker.antonyms],
    ["訳", marker.translation],
    ["例文", marker.usage_example],
  ].filter(([, value]) => value);

  memoArea.innerHTML = `<a class="ichnite-dict-detail-link" href="${detailUrl}" target="_blank" rel="noopener"><div class="ichnite-dict-ai">${aiFields.map(([label, value]) =>
    `<div><strong>${label}</strong><span>${escapeIchniteHtml(value)}</span></div>`
  ).join("")}</div></a>`;
  bindPanelDetailLink(memoArea);
  memoBtn.textContent = "再生成";
  aiBtn.disabled = false;
  aiBtn.textContent = "メモ";
}

function bindPanelDetailLink(memoArea) {
  const detailLink = memoArea.querySelector(".ichnite-dict-detail-link");
  detailLink?.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.runtime.sendMessage({ type: "ichnite:open-tab", url: detailLink.href });
  });
}

async function generatePanelAiNote(memoArea, memoBtn, aiBtn, marker) {
  aiBtn.disabled = true;
  memoBtn.disabled = true;
  aiBtn.textContent = "生成中...";
  try {
    const aiNote = await generateAiNote(marker.marker_id, marker.selected_text);
    Object.assign(marker, aiNote);
    notifyMarkersUpdated();
    renderPanelAiView(memoArea, memoBtn, aiBtn, marker);
  } catch (error) {
    console.log("AI解説生成失敗:", error.message);
    alert(`AI解説の生成に失敗しました。\n${error.message}`);
    aiBtn.disabled = false;
    memoBtn.disabled = false;
    aiBtn.textContent = "AI生成";
  }
}

function renderPanelMemoEdit(memoArea, memoBtn, aiBtn, marker) {
  memoArea.innerHTML = `
    <textarea class="ichnite-dict-memo-textarea" placeholder="気づいたことや覚えておきたいことをメモしましょう">${escapeIchniteHtml(marker.memo || "")}</textarea>
    <div class="ichnite-dict-memo-edit-actions">
      <button class="ichnite-dict-memo-cancel">キャンセル</button>
      <button class="ichnite-dict-memo-save">保存</button>
    </div>
  `;

  const textarea = memoArea.querySelector(".ichnite-dict-memo-textarea");
  textarea.focus();

  memoArea.querySelector(".ichnite-dict-memo-cancel").addEventListener("click", () => {
    renderPanelMemoView(memoArea, memoBtn, aiBtn, marker);
  });

  memoArea.querySelector(".ichnite-dict-memo-save").addEventListener("click", async () => {
    const saveBtn = memoArea.querySelector(".ichnite-dict-memo-save");
    const newMemo = textarea.value.trim();
    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";

    try {
      await saveMarkerMemo(marker.marker_id, newMemo);
      marker.memo = newMemo;
      renderPanelMemoView(memoArea, memoBtn, aiBtn, marker);
      notifyMarkersUpdated();
    } catch (error) {
      console.log("メモ保存失敗:", error.message);
      alert(`メモの保存に失敗しました。\n${error.message}`);
      saveBtn.disabled = false;
      saveBtn.textContent = "保存";
    }
  });
}


// マーカーが登録された位置まで遷移する。別ページのマーカーならそのページへ移動してからスクロールする。
function goToMarker(marker) {
  if (marker.page_url && marker.page_url !== window.location.href) {
    try {
      const target = new URL(marker.page_url);
      target.searchParams.set("ichniteMarkerId", marker.marker_id);
      // 現在のタブを奪わないよう、別タブで開く（background.js経由。content scriptはchrome.tabsを直接使えない）
      chrome.runtime.sendMessage({ type: "ichnite:open-tab", url: target.toString() });
    } catch (error) {
      console.log("遷移先URLの解析に失敗:", error.message);
    }
    return;
  }

  const el = document.querySelector(`.ichnite-highlight[data-marker-id="${marker.marker_id}"]`);
  if (!el) {
    alert("このページ内にマーカーが見つかりませんでした。");
    return;
  }

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ichnite-highlight-focus");
  setTimeout(() => el.classList.remove("ichnite-highlight-focus"), 1500);
}
