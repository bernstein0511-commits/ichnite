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
        <button id="toggleMarkers" title="ページ上のマーカー表示を切り替え">マーカー: 表示</button>
        <button id="toggleToolbar" title="文字のポップアップ表示を切り替え">ポップアップ: 表示</button>
        <button id="openMarkerBook" title="マーカー記録帳を開く">記録帳</button>
      </div>
    </div>
    <div id="ichnite-panel-content">
      <div id="ichnite-filter-bar">
        <button type="button" id="filterCurrentPageBtn" title="このページのマーカーだけに絞り込む">表示範囲: 全ページ</button>
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
    toggleMarkersBtn.textContent = visible ? "マーカー: 表示" : "マーカー: 非表示";
    toggleMarkersBtn.classList.toggle("is-off", !visible);
  }

  function applyToolbarEnabled(enabled) {
    toolbarEnabled = enabled;
    ichniteToolbarEnabled = enabled;
    toggleToolbarBtn.textContent = enabled ? "ポップアップ: 表示" : "ポップアップ: 非表示";
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

  // 現在のページのマーカーだけに絞り込む（チェックボックスではなくトグルボタン）。
  // loadMarkerList()はモジュール直下の関数でここのローカル変数は見えないため、
  // 状態は（旧チェックボックスの.checkedと同じように）DOM側（classList）に持たせる。
  const filterCurrentPageBtn = root.getElementById("filterCurrentPageBtn");
  filterCurrentPageBtn.onclick = () => {
    const next = !filterCurrentPageBtn.classList.contains("is-active");
    filterCurrentPageBtn.classList.toggle("is-active", next);
    filterCurrentPageBtn.textContent = next ? "表示範囲: このページ" : "表示範囲: 全ページ";
    loadMarkerList();
  };

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
  // ヘッダーのボタン（閉じる／マーカー切替等）の上から始めた場合はドラッグにせず、通常のクリックとして扱う。
  const panelHeader = root.getElementById("ichnite-panel-header");
  let isPanelDragging = false;
  let panelOffsetX = 0, panelOffsetY = 0;

  panelHeader.addEventListener("mousedown", (event) => {
    if (event.target.closest("button")) return;
    isPanelDragging = true;
    panelOffsetX = event.clientX - panel.offsetLeft;
    panelOffsetY = event.clientY - panel.offsetTop;
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
  const filterBtn = root.getElementById("filterCurrentPageBtn");
  const sortSelect = root.getElementById("panelSortSelect");

  if (!list) return;

  loading.style.display = "block";
  loading.textContent = "読み込み中...";
  list.innerHTML = "";

  const onlyCurrentPage = !!filterBtn?.classList.contains("is-active");
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
  li.className = "ichnite-dict-item";
  li.innerHTML = `
    <div class="ichnite-dict-word" title="このページ内の登録位置へ移動">${escapeIchniteHtml(marker.selected_text)}${dupHtml}</div>
    <div class="ichnite-dict-meta">
      <span><span class="ichnite-color-dot ${marker.color}"></span>${colorLabel}</span>
      <span class="ichnite-dict-date">${dateLabel}</span>
    </div>
    <div class="ichnite-dict-memo-area"></div>
    <div class="ichnite-dict-actions">
      <button class="ichnite-dict-memo-btn"></button>
      <button class="ichnite-dict-delete">削除</button>
    </div>
  `;

  const memoArea = li.querySelector(".ichnite-dict-memo-area");
  const memoBtn = li.querySelector(".ichnite-dict-memo-btn");
  renderPanelMemoView(memoArea, memoBtn, marker);

  // 登録文字クリックで該当位置へ遷移
  li.querySelector(".ichnite-dict-word").addEventListener("click", () => {
    goToMarker(marker);
  });

  // メモの追加・編集（テーマに合わせたインライン編集。prompt()は使わない）
  memoBtn.addEventListener("click", () => {
    renderPanelMemoEdit(memoArea, memoBtn, marker);
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

function renderPanelMemoView(memoArea, memoBtn, marker) {
  memoArea.innerHTML = marker.memo
    ? `<div class="ichnite-dict-memo">${escapeIchniteHtml(marker.memo)}</div>`
    : "";
  memoBtn.textContent = marker.memo ? "メモを編集" : "メモを追加";
}

function renderPanelMemoEdit(memoArea, memoBtn, marker) {
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
    renderPanelMemoView(memoArea, memoBtn, marker);
  });

  memoArea.querySelector(".ichnite-dict-memo-save").addEventListener("click", async () => {
    const saveBtn = memoArea.querySelector(".ichnite-dict-memo-save");
    const newMemo = textarea.value.trim();
    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";

    try {
      await saveMarkerMemo(marker.marker_id, newMemo);
      marker.memo = newMemo;
      renderPanelMemoView(memoArea, memoBtn, marker);
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
