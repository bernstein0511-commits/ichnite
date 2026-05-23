function createSidePanel() {

  // 既に存在するなら作らない
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

            <span>Ichnite</span>

            <button id="togglePanel">
                ×
            </button>

        </div>

        <div id="ichnite-panel-content">

            <h3>辞書</h3>

            <p>
                今後ここに
                機能追加
            </p>

        </div>

    `;

  document.body.appendChild(
    panel
  );

  // 最小化
  document
    .getElementById(
      "togglePanel"
    )
    .onclick = () => {

      panel.classList.toggle(
        "minimized"
      );

    };

}

// ページ読み込み時生成
window.addEventListener(
  "load",
  createSidePanel
);