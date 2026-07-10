// ui/popup.js — ツールバーの拡張機能アイコンをクリックしたときに出る
// 小さなポップアップ（ui/popup.html）の挙動。記録帳を新しいタブで開くだけの単純な入口。

document
    .getElementById("openMarkerBookBtn")
    .addEventListener("click", () => {

        window.open(chrome.runtime.getURL("ui/marker_book.html"), "_blank");

    });

document
    .getElementById("testBtn")
    .addEventListener("click", () => {

        alert("Ichnite起動中");

    });