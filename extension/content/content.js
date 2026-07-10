// ==========================================================
// content.js — 閲覧中の全ページに最初に注入されるcontent script。
// manifest.jsonのcontent_scripts配列で一番先に読み込まれ、他のmodules/*.jsが
// 共有して使うグローバルな状態・ユーティリティをここで用意する。
// （Chrome拡張機能では、同じcontent_scripts配列内の複数jsファイルは同じ
// 　JS実行コンテキストを共有するため、ここで宣言したletやfunctionは
// 　storage.js・marker.js・panel.js等から直接参照・変更できる）
// ==========================================================

let selectedColor = "yellow";       // ツールバーで選んだ色（marker.js が参照）
let currentSelection = null;        // 直前にユーザーが選択したテキスト範囲（Range）

// サイドパネルの「カラー選択」トグルで、文字選択時のツールバー表示を止められるようにする
let ichniteToolbarEnabled = true;

// サイドパネルの登録文字クリックで別ページから遷移してきた場合、
// 対象のmarker_idをURLから読み取り、ページ登録用のURLを汚さないよう即座に取り除く
const ichniteRequestedMarkerId = (() => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("ichniteMarkerId");
  if (!id) return null;

  params.delete("ichniteMarkerId");
  const newSearch = params.toString();
  const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
  history.replaceState(null, "", newUrl);

  return id;
})();

// ユーザー由来の文字列（選択テキスト・メモ）をinnerHTMLへ差し込む際のエスケープ
function escapeIchniteHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

console.log("Ichnite content.js 読み込み成功");
