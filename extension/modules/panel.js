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
        <button id="toggleToolbar" title="文字選択時のカラー選択ポップアップを切り替え">カラー選択: 表示</button>
        <button id="openMarkerBook" title="マーカー記録帳を開く">記録帳</button>
      </div>
    </div>
    <div id="ichnite-panel-content">
      <div id="ichnite-filter-bar">
        <label>
          <input type="checkbox" id="filterCurrentPage" />
          このページのみ表示
        </label>
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

  // ページ上のマーカー表示/非表示を切り替える
  let markersVisible = true;
  const toggleMarkersBtn = root.getElementById("toggleMarkers");
  toggleMarkersBtn.onclick = () => {
    markersVisible = !markersVisible;
    document.documentElement.classList.toggle("ichnite-markers-hidden", !markersVisible);
    toggleMarkersBtn.textContent = markersVisible ? "マーカー: 表示" : "マーカー: 非表示";
    toggleMarkersBtn.classList.toggle("is-off", !markersVisible);
  };

  // 文字選択時のカラー選択ポップアップ（ツールバー）表示/非表示を切り替える
  let toolbarEnabled = true;
  const toggleToolbarBtn = root.getElementById("toggleToolbar");
  toggleToolbarBtn.onclick = () => {
    toolbarEnabled = !toolbarEnabled;
    ichniteToolbarEnabled = toolbarEnabled;
    toggleToolbarBtn.textContent = toolbarEnabled ? "カラー選択: 表示" : "カラー選択: 非表示";
    toggleToolbarBtn.classList.toggle("is-off", !toolbarEnabled);
    if (!toolbarEnabled) removeToolbar();
  };

  // 現在のページのマーカーだけに絞り込む
  root.getElementById("filterCurrentPage").addEventListener("change", loadMarkerList);

  // フローティングボタン（初期状態はこちらを表示する）
  const floatingButton = document.createElement("div");
  floatingButton.id = "ichnite-floating-button";
  floatingButton.innerHTML = "☰";
  root.appendChild(floatingButton);

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

  document.addEventListener("mouseup", () => { isDragging = false; });

  floatingButton.addEventListener("click", () => {
    if (hasMoved) { hasMoved = false; return; }
    // CSS側のレイアウト（display: flex; flex-direction: column;）を壊さないよう、
    // "block"ではなく"flex"に戻す
    panel.style.display = "flex";
    floatingButton.style.display = "none";
    loadMarkerList();  // パネルを開くたびに最新を取得
  });
}


async function loadMarkerList() {
  const root = getIchniteRoot();
  const list = root.getElementById("ichnite-marker-list");
  const loading = root.getElementById("ichnite-loading");
  const filterCheckbox = root.getElementById("filterCurrentPage");

  if (!list) return;

  loading.style.display = "block";
  loading.textContent = "読み込み中...";
  list.innerHTML = "";

  const onlyCurrentPage = !!filterCheckbox?.checked;

  try {
    const entries = await fetchMarkerBookEntries();
    const markers = onlyCurrentPage
      ? entries.filter(m => m.page_url === window.location.href)
      : entries;

    loading.style.display = "none";

    if (markers.length === 0) {
      list.innerHTML = onlyCurrentPage
        ? "<li>このページにはまだマーカーがありません</li>"
        : "<li>まだマーカーがありません</li>";
      return;
    }

    markers.forEach(marker => list.appendChild(createMarkerListItem(marker)));

  } catch (error) {
    loading.textContent = "取得できませんでした（APIに接続できません）";
  }
}


function createMarkerListItem(marker) {
  const colorLabel = ICHNITE_COLOR_LABEL[marker.color] || marker.color;
  const dateLabel = new Date(marker.created_at).toLocaleDateString("ja-JP");

  const li = document.createElement("li");
  li.className = "ichnite-dict-item";
  li.innerHTML = `
    <div class="ichnite-dict-word" title="このページ内の登録位置へ移動">${escapeIchniteHtml(marker.selected_text)}</div>
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
      alert("マーカーの削除に失敗しました。バックエンドが起動しているか確認してください。");
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
      alert("メモの保存に失敗しました。バックエンドが起動しているか確認してください。");
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
      window.location.href = target.toString();
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
