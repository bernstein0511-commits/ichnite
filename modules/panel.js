function createSidePanel() {

  if (
    document.getElementById(
      "ichnite-side-panel"
    )
  ) {
    return;
  }
  // パネル生成
  const panel =
    document.createElement(
      "div"
    );

  panel.id =
    "ichnite-side-panel";

  panel.innerHTML = `

    <div id="ichnite-panel-header">

      <span>
        Ichnite
      </span>

      <button id="closePanel">
        ×
      </button>

    </div>

    <div id="ichnite-panel-content">

      <h3>辞書</h3>

      <p>
        今後ここに機能追加
      </p>

    </div>

  `;

  document.body.appendChild(
    panel
  );


  // フローティングボタン
  const floatingButton =
    document.createElement(
      "div"
    );

  floatingButton.id =
    "ichnite-floating-button";

  floatingButton.innerHTML =
    "☰";

  document.body.appendChild(
    floatingButton );


  // 最小化
  document
    .getElementById(
      "closePanel"
    )
    .onclick = () => {
      panel.style.display =
        "none";

      floatingButton.style.display =
        "flex";
    };


  // 再展開
  floatingButton.onclick =
    () => {

      panel.style.display =
        "block";

      floatingButton.style.display =
        "none";

    };


  // 初期状態
  panel.style.display =
    "none";

  floatingButton.style.display =
    "flex";


  // ドラッグ移動
  let isDragging =
    false;
  let offsetX = 0;
  let offsetY = 0;

  floatingButton.addEventListener(
    "mousedown",
    (event) => {
      isDragging = true;

      offsetX =
        event.clientX -
        floatingButton.offsetLeft;

      offsetY =
        event.clientY -
        floatingButton.offsetTop;
    }
  );


  document.addEventListener(
    "mousemove",
    (event) => {
      if (!isDragging) return;

      floatingButton.style.left =
        `${event.clientX - offsetX}px`;

      floatingButton.style.top =
        `${event.clientY - offsetY}px`;
    }
  );


  document.addEventListener(
    "mouseup",
    () => {
      isDragging = false;
    }
  );

}

window.addEventListener(
  "load",
  createSidePanel
);