window.addEventListener("load", createSidePanel);


function createSidePanel() {

  if (document.getElementById("ichnite-side-panel")) return;

  const panel = document.createElement("div");
  panel.id = "ichnite-side-panel";

  panel.innerHTML = `
    <div id="ichnite-panel-header">
      <span>Ichnite 辞書</span>
      <button id="closePanel">×</button>
    </div>
    <div id="ichnite-marker-toggle-row">
      <span>🖍️ マーカーを表示</span>
      <label class="switch">
        <input type="checkbox" id="ichniteMarkerToggleCheckbox">
        <span class="slider"></span>
      </label>
    </div>
    <div id="ichnite-panel-content">
      <p id="ichnite-loading">読み込み中...</p>
      <ul id="ichnite-marker-list"></ul>
    </div>
  `;

  document.body.appendChild(panel);

  // マーカー表示トグル
  const markerToggleCheckbox = document.getElementById("ichniteMarkerToggleCheckbox");
  chrome.storage.local.get({ markersVisible: true }, (data) => {
    markerToggleCheckbox.checked = data.markersVisible;
  });
  markerToggleCheckbox.addEventListener("change", () => {
    chrome.storage.local.set({ markersVisible: markerToggleCheckbox.checked });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.markersVisible) {
      markerToggleCheckbox.checked = changes.markersVisible.newValue;
    }
  });

  // フローティングボタン
  const floatingButton = document.createElement("div");
  floatingButton.id = "ichnite-floating-button";
  floatingButton.innerHTML = "☰";
  document.body.appendChild(floatingButton);

  // 閉じる
  document.getElementById("closePanel").onclick = () => {
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
    panel.style.display = "block";
    floatingButton.style.display = "none";
    loadMarkerList();  // パネルを開くたびに最新を取得
  });

  // 初回読み込み
  loadMarkerList();
}


async function loadMarkerList() {
  const list = document.getElementById("ichnite-marker-list");
  const loading = document.getElementById("ichnite-loading");

  if (!list) return;

  loading.style.display = "block";
  list.innerHTML = "";

  try {
    const res = await fetch("http://localhost:8000/markers/");
    if (!res.ok) throw new Error("取得失敗");

    const markers = await res.json();

    loading.style.display = "none";

    if (markers.length === 0) {
      list.innerHTML = "<li>まだマーカーがありません</li>";
      return;
    }

    markers.forEach(marker => {
      const li = document.createElement("li");
      li.className = "ichnite-dict-item";
      li.innerHTML = `
        <div class="ichnite-dict-word">${marker.selected_text}</div>
        <div class="ichnite-dict-meta">🎨 ${marker.color} ・ 📅 ${new Date(marker.created_at).toLocaleDateString("ja-JP")}</div>
        <button class="ichnite-dict-delete" data-id="${marker.marker_id}">削除</button>
      `;

      // 削除ボタン
      li.querySelector(".ichnite-dict-delete").addEventListener("click", async () => {
        await deleteMarker(marker.marker_id);
        li.remove();
      });

      list.appendChild(li);
    });

  } catch (error) {
    loading.textContent = "取得できませんでした（APIに接続できません）";
  }
}