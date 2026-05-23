let currentSelection =
  null;


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
    document.createElement(
      "div"
    );

  toolbar.id =
    "ichnite-toolbar";

  toolbar.innerText =
    "🖍 マーカー";

  toolbar.style.left =
    `${x}px`;

  toolbar.style.top =
    `${y}px`;

  toolbar.addEventListener(
    "mousedown",
    addMarker
  );

  document.body
    .appendChild(
      toolbar
    );

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
      ""
    );

    const marker =
      document.createElement(
        "span"
      );

    marker.className =
      "ichnite-highlight";

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