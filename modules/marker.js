// 選択テキストを保持
let currentSelection =
  null;

// テキスト選択時の処理
// ↓マウスを離したとき
document.addEventListener(
  "mouseup",
  (event) => {

    const selection =
      window.getSelection();

    const selectedText =
      selection.toString();

    removeToolbar();

    if (!selectedText) return;

    try {

      currentSelection =
        selection
          .getRangeAt(0)
          .cloneRange();

      showToolbar(
        event.pageX,
        event.pageY
      );

    } catch (error) {

      console.log(
        "選択取得失敗:",
        error
      );

    }

  }
);


function showToolbar(x, y) {

  const toolbar =
    document.createElement("div");

  toolbar.id =
    "ichnite-toolbar";

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

  toolbar.addEventListener(
    "mousedown",
    addMarker
  );

  toolbar.querySelectorAll("button").forEach(button => {
    button.onclick =
      (event) => {
        event.preventDefault();
        selectedColor =
          button.dataset.color;
        addMarker(event);
      };
  });


}


function addMarker(event) {

  event.preventDefault();

  if (!currentSelection)
    return;

  try {

    const selectedText =
      currentSelection
        .toString();

    saveMarker(
      selectedText,
      "",
      selectedColor
    );

    const marker =
      document.createElement(
        "span"
      );

    marker.className =
      `ichnite-highlight ${selectedColor}`;

    marker.dataset.memo =
      "";

    currentSelection
      .surroundContents(
        marker
      );

    window
      .getSelection()
      .removeAllRanges();

  } catch (error) {

    console.log(
      "マーカー失敗:",
      error
    );

  }

  removeToolbar();

}


function removeToolbar() {

  const oldToolbar =
    document.getElementById(
      "ichnite-toolbar"
    );

  if (oldToolbar) {

    oldToolbar.remove();

  }
}