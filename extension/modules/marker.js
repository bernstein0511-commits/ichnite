document.addEventListener("mouseup", (event) => {
  const selection = window.getSelection();
  const selectedText = selection.toString();

  removeToolbar();

  if (!selectedText) return;

  try {
    currentSelection = selection.getRangeAt(0).cloneRange();
    showToolbar(event.pageX, event.pageY);
  } catch (error) {
    console.log("選択取得失敗:", error);
  }
});


function showToolbar(x, y) {
  const toolbar = document.createElement("div");
  toolbar.id = "ichnite-toolbar";

  toolbar.innerHTML = `
    <button data-color="yellow">🟨</button>
    <button data-color="green">🟩</button>
    <button data-color="blue">🟦</button>
    <button data-color="red">🟥</button>
    <button data-color="purple">🟪</button>
  `;

  toolbar.style.left = `${x}px`;
  toolbar.style.top = `${y}px`;

  document.body.appendChild(toolbar);

  toolbar.querySelectorAll("button").forEach(button => {
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      console.log("ボタンmousedown:", button.dataset.color);
      selectedColor = button.dataset.color;
      addMarker(event);
    });
  });
}


async function addMarker(event) {
  event.preventDefault();

  if (!currentSelection) return;

  const selectedText = currentSelection.toString();
  const positionStart = currentSelection.startOffset;
  const positionEnd = currentSelection.endOffset;

  const markerEl = document.createElement("span");
  markerEl.className = `ichnite-highlight ${selectedColor}`;
  markerEl.dataset.markerId = "";
  markerEl.dataset.aiLoaded = "false";

  try {
    currentSelection.surroundContents(markerEl);
    window.getSelection().removeAllRanges();
  } catch (error) {
    console.log("マーカーDOM失敗:", error);
    removeToolbar();
    return;
  }

  removeToolbar();

  // マーカーをDBに保存
  try {
    const markerId = await saveMarker(
      selectedText,
      selectedColor,
      positionStart,
      positionEnd
    );
    markerEl.dataset.markerId = markerId;
    console.log("マーカー保存成功:", markerId);
  } catch (error) {
    console.log("マーカー保存失敗:", error.message);
  }

  // AI解説は別で試みる（失敗してもマーカーは消えない）
  if (markerEl.dataset.markerId) {
    try {
      const aiNote = await generateAiNote(
        markerEl.dataset.markerId,
        selectedText
      );
      markerEl.dataset.aiNote = JSON.stringify(aiNote);
      markerEl.dataset.aiLoaded = "true";
    } catch (error) {
      console.log("AI解説スキップ:", error.message);
    }
  }
}


function removeToolbar() {
  const old = document.getElementById("ichnite-toolbar");
  if (old) old.remove();
}