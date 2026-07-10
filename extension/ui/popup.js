// ui/popup.js — ツールバーの拡張機能アイコンをクリックしたときに出る
// 小さなポップアップ（ui/popup.html）の挙動。記録帳を開くだけの単純な入口。
// 「記録帳」自体はサイドパネルと同じ仕組み（background.js経由でタブを使い回す）で開く。

document
    .getElementById("recordsBtn")
    .addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "ichnite:open-marker-book" });
    });
