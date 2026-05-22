console.log("Ichnite content.js 読み込み成功");

let currentSelection = null;


// ========================
// テキスト選択時
// ========================
document.addEventListener("mouseup", (event) => {

    const selection = window.getSelection();

    const selectedText = selection.toString();

    // 古いツールバー削除
    removeToolbar();

    // 未選択なら終了
    if (!selectedText) return;

    try {

        // Rangeをコピーして保存
        currentSelection =
            selection
                .getRangeAt(0)
                .cloneRange();

        console.log(
            "選択文字:",
            selectedText
        );

        // ボタン表示
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

});


// ========================
// ツールバー表示
// ========================
function showToolbar(x, y) {

    const toolbar =
        document.createElement("div");

    toolbar.id =
        "ichnite-toolbar";

    toolbar.innerText =
        "🖍 マーカー";

    toolbar.style.left =
        `${x}px`;

    toolbar.style.top =
        `${y}px`;


    // clickではなくmousedown
    toolbar.addEventListener(
        "mousedown",
        addMarker
    );

    document.body.appendChild(
        toolbar
    );

}


// ========================
// マーカー追加
// ========================
function addMarker(event) {

    // 選択解除防止
    event.preventDefault();

    console.log(
        "マーカーボタン押下"
    );

    console.log(
        currentSelection
    );

    if (!currentSelection) {

        console.log(
            "Rangeがありません"
        );

        return;

    }

    try {

        // メモ入力
        const memo =
            prompt(
                "注釈を入力してください"
            );

            const selectedText =
                currentSelection.toString();

            saveMarker(
                selectedText,
                memo
            );


        // span生成
        const marker =
            document.createElement(
                "span"
            );

        marker.className =
            "ichnite-highlight";

        marker.dataset.memo =
            memo || "";


        // 選択範囲に挿入
        currentSelection
            .surroundContents(
                marker
            );


        // 選択解除
        window
            .getSelection()
            .removeAllRanges();


        console.log(
            "マーカー追加成功"
        );

    } catch (error) {

        console.log(
            "マーカー失敗:",
            error
        );

    }

    // ツールバー削除
    removeToolbar();

}


// ========================
// ツールバー削除
// ========================
function removeToolbar() {

    const oldToolbar =
        document.getElementById(
            "ichnite-toolbar"
        );

    if (oldToolbar) {

        oldToolbar.remove();

    }

}


// ========================
// ホバー時注釈表示
// ========================
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

// 保存
function saveMarker(text, memo) {

    const url =
        window.location.href;

    chrome.storage.local.get(
        ["markers"],
        (result) => {

            let markers =
                result.markers || [];

            markers.push({

                url: url,

                text: text,

                memo: memo

            });

            chrome.storage.local.set({

                markers: markers

            });

            console.log(
                "保存成功"
            );

        }
    );

}


// ========================
// ページ読み込み時に復元
// ========================
window.addEventListener(
    "load",
    restoreMarkers
);


function restoreMarkers() {

    const url =
        window.location.href;

    chrome.storage.local.get(
        ["markers"],
        (result) => {

            const markers =
                result.markers || [];

            const pageMarkers =
                markers.filter(
                    marker =>
                        marker.url === url
                );

            pageMarkers.forEach(
                marker => {

                    highlightSavedText(
                        marker.text,
                        marker.memo
                    );

                }
            );

        }
    );

}


function highlightSavedText(
    targetText,
    memo
) {

    const walker =
        document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT
        );

    let node;

    while (
        node = walker.nextNode()
    ) {

        const text =
            node.textContent;

        const index =
            text.indexOf(
                targetText
            );

        if (
            index !== -1
        ) {

            const range =
                document.createRange();

            range.setStart(
                node,
                index
            );

            range.setEnd(
                node,
                index +
                targetText.length
            );

            const marker =
                document.createElement(
                    "span"
                );

            marker.className =
                "ichnite-highlight";

            marker.dataset.memo =
                memo;

            try {

                range
                    .surroundContents(
                        marker
                    );

                console.log(
                    "復元成功:",
                    targetText
                );

            } catch (error) {

                console.log(
                    "復元失敗:",
                    error
                );

            }

            break;

        }

    }

}


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


    popup.innerHTML = `

        <div>${memo}</div>

        <button id="editMemo">
            ✏ 編集
        </button>

        <button id="deleteMemo">
            🗑 削除
        </button>

    `;


    document.body
        .appendChild(
            popup
        );


    // 編集
    document
        .getElementById(
            "editMemo"
        )
        .onclick = () => {

            const newMemo =
                prompt(
                    "新しいメモ",
                    memo
                );

            if (
                newMemo !== null
            ) {

                target.dataset.memo =
                    newMemo;

            }

        };


    // 削除
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