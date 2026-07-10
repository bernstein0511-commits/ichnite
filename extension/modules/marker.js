// ==========================================================
// modules/marker.js — 「新しいマーカーを作る」フロー全体を担当。
// 流れ：テキスト選択(mouseup) → 色選択ツールバー表示 → 色クリックでaddMarker()
//       → ページDOMにハイライトspanを挿入 → バックエンドに保存 → AI解説を生成
// マーカーの削除（DOM解除＋DB削除＋他タブ通知）もここに集約している
// （panel.js・popup.js の削除ボタンはどちらもここのremoveMarkerCompletely()を呼ぶ）。
// ==========================================================

document.addEventListener("mouseup", (event) => {
  const selection = window.getSelection();
  const selectedText = selection.toString();

  removeToolbar();

  if (!selectedText) return;
  if (!ichniteToolbarEnabled) return;

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
    <button class="ichnite-color-swatch" data-color="yellow" title="黄"></button>
    <button class="ichnite-color-swatch" data-color="green" title="緑"></button>
    <button class="ichnite-color-swatch" data-color="blue" title="青"></button>
    <button class="ichnite-color-swatch" data-color="red" title="赤"></button>
    <button class="ichnite-color-swatch" data-color="purple" title="紫"></button>
  `;

  toolbar.style.left = `${x}px`;
  toolbar.style.top = `${y}px`;

  getIchniteRoot().appendChild(toolbar);

  // 画面端（特に右端）で見切れないよう、実際のサイズで位置を調整する
  // （popup.js の clampPopupToViewport を流用。メモポップアップと同じ問題のため）
  clampPopupToViewport(toolbar);

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

  // 既にマーカーが引かれている箇所への二重登録を防ぐ
  const alreadyMarked = currentSelection.startContainer.parentElement?.closest(".ichnite-highlight");
  if (alreadyMarked) {
    console.log("この箇所には既にマーカーが引かれています");
    removeToolbar();
    window.getSelection().removeAllRanges();
    return;
  }

  const selectedText = currentSelection.toString();
  // ページ内で同じ文字列が複数あっても位置を一意に復元できるよう、
  // 選択範囲がページ内で何番目の出現かを記録する
  const occurrenceIndex = getOccurrenceIndex(currentSelection, selectedText);

  const markerEl = document.createElement("span");
  markerEl.className = `ichnite-highlight ${selectedColor}`;
  markerEl.dataset.markerId = "";
  markerEl.dataset.aiLoaded = "false";
  markerEl.dataset.memo = "";

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
      occurrenceIndex
    );
    markerEl.dataset.markerId = markerId;
    console.log("マーカー保存成功:", markerId);

    // サイドパネル（同一タブ）と記録帳ページ（別タブ）へ即時反映
    loadMarkerList();
    notifyMarkersUpdated();
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

      // マーカー保存時点ではAI解説がまだ無い状態で通知済みのため、
      // 生成が完了した今の状態でサイドパネル・記録帳へ改めて反映する
      notifyMarkersUpdated();
    } catch (error) {
      console.log("AI解説スキップ:", error.message);
    }
  }
}


function removeToolbar() {
  const old = getIchniteRoot().getElementById("ichnite-toolbar");
  if (old) old.remove();
}


// ページ上のハイライト要素を取り除き、中のテキストだけを元に戻す（マーカーIDが
// このページに存在しない場合は何もしない＝他ページのマーカー削除通知でも安全に呼べる）
function unwrapHighlightById(markerId) {
  const el = document.querySelector(`.ichnite-highlight[data-marker-id="${markerId}"]`);
  if (!el) return;

  const parent = el.parentNode;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  el.remove();
}


// マーカーをDBから削除し、ページ上のハイライトも取り除いた上で他ビューに即時反映する
async function removeMarkerCompletely(markerId) {
  await deleteMarker(markerId);
  unwrapHighlightById(markerId);
  notifyMarkersUpdated({ deletedMarkerId: markerId });
}