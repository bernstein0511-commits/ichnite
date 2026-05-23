document.addEventListener(
  "mouseover",
  (event) => {

    const target =
      event.target;

    if (
      target.classList.contains(
        "ichnite-highlight"
      )
    ) {

      showMemoPopup(
        target,
        event.pageX,
        event.pageY
      );

    }

  }
);


document.addEventListener(
  "click",
  (event) => {

    const popup =
      document.getElementById(
        "ichnite-memo-popup"
      );

    if (!popup) return;

    const isPopup =
      popup.contains(
        event.target
      );

    const isHighlight =
      event.target
        .classList
        ?.contains(
          "ichnite-highlight"
        );

    if (
      !isPopup &&
      !isHighlight
    ) {

      removeMemoPopup();

    }

  }
);


function showMemoPopup(
  target,
  x,
  y
) {

  removeMemoPopup();

  const popup =
    document.createElement(
      "div"
    );

  popup.id =
    "ichnite-memo-popup";

  popup.style.position =
    "absolute";

  popup.style.left =
    `${x}px`;

  popup.style.top =
    `${y}px`;

  const memo =
    target.dataset.memo;

  const hasMemo =
    memo && memo.trim() !== "";

  popup.innerHTML = `

        ${hasMemo
      ? `<div>${memo}</div>`
      : `<div>注釈なし</div>`
    }

        <button id="editMemo">

            ${hasMemo
      ? "✏ 編集"
      : "📝 注釈を追加"
    }

        </button>

        <button id="deleteMemo">
            🗑 削除
        </button>

    `;

  document.body
    .appendChild(
      popup
    );

  document
    .getElementById(
      "editMemo"
    )
    .onclick = () => {

      const newMemo =
        prompt(
          hasMemo
            ? "メモを編集"
            : "注釈を入力",
          memo
        );

      if (
        newMemo !== null
      ) {

        target.dataset.memo =
          newMemo;

      }

    };

  document
    .getElementById(
      "deleteMemo"
    )
    .onclick = () => {

      const parent =
        target.parentNode;

      while (
        target.firstChild
      ) {

        parent.insertBefore(
          target.firstChild,
          target
        );

      }

      target.remove();

      removeMemoPopup();

    };
}


function removeMemoPopup() {

  const popup =
    document.getElementById(
      "ichnite-memo-popup"
    );

  if (popup) {

    popup.remove();
  }
}