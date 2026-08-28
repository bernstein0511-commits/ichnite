// ==========================================================
// modules/popup.js — ページ上のハイライト済みマーカーにマウスを
// 乗せたときに出る小さなメモポップアップ（表示／メモ編集／削除）。
// サイドパネル(panel.js)の各項目にあるメモ編集と機能的には同じもので、
// 見た目・置き場所（ページ内 vs パネル内）が違うだけ。
// ==========================================================

document.addEventListener(
  "mouseover",
  (event) => {

    if (!ichniteToolbarEnabled) return;

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
      getIchniteRoot().getElementById(
        "ichnite-memo-popup"
      );

    if (!popup) return;

    // popupはShadow DOM内にあるため、event.targetは再ターゲット化されて
    // shadow hostになってしまう。実際のクリック経路はcomposedPath()で取得する。
    const path = event.composedPath();

    const isPopup =
      path.includes(popup);

    const isHighlight =
      path.some(
        (el) =>
          el.classList
            ?.contains(
              "ichnite-highlight"
            )
      );

    if (
      !isPopup &&
      !isHighlight
    ) {
      removeMemoPopup();
    }
  }
);


function showMemoPopup(target, x, y) {
  removeMemoPopup();

  const popup = document.createElement("div");
  popup.id = "ichnite-memo-popup";
  popup.style.position = "absolute";
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;

  getIchniteRoot().appendChild(popup);

  renderMemoPopupView(popup, target);
  clampPopupToViewport(popup);
}


// 画面端（特に右端）でポップアップが見切れないよう、実際のサイズで
// はみ出していたら位置をずらす。表示内容が変わって高さが増える
// 編集モードへの切り替え時にも呼び直す。
function clampPopupToViewport(popup) {
  const margin = 8;
  const rect = popup.getBoundingClientRect();

  let left = parseFloat(popup.style.left) || 0;
  let top = parseFloat(popup.style.top) || 0;

  if (rect.right > window.innerWidth - margin) {
    left -= rect.right - (window.innerWidth - margin);
  }
  if (rect.left < margin) {
    left += margin - rect.left;
  }
  if (rect.bottom > window.innerHeight - margin) {
    top -= rect.bottom - (window.innerHeight - margin);
  }
  if (rect.top < margin) {
    top += margin - rect.top;
  }

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}


// メモまたはAI解説の表示＋操作ボタン
function renderMemoPopupView(popup, target, showAi = false) {
  const memo = target.dataset.memo || "";
  const hasMemo = memo.trim() !== "";
  const aiNote = readAiNote(target);
  const hasAiNote = !!aiNote;

  // 同じページ・同じ単語・同じ色のハイライトが複数あるときだけ、登場順の番号を出す
  const dupIndex = target.dataset.dupIndex;
  const dupHtml = dupIndex
    ? `<div class="ichnite-memo-dup" title="このページ内で同じ単語・同じ色が${target.dataset.dupTotal}件あるうちの${dupIndex}番目">${dupIndex}</div>`
    : "";

  popup.innerHTML = `
    ${dupHtml}
    ${showAi && hasAiNote
      ? renderAiNote(aiNote)
      : hasMemo
        ? `<div class="ichnite-memo-text">${escapeIchniteHtml(memo)}</div>`
        : `<div class="ichnite-memo-empty">メモなし</div>`
    }
    <div class="ichnite-memo-popup-actions">
      <button id="toggleAi">${showAi ? "メモ" : "AI生成"}</button>
      <button id="editMemo">${showAi ? "再生成" : hasMemo ? "メモを編集" : "メモを追加"}</button>
      <button id="deleteMemo">削除</button>
    </div>
  `;

  popup.querySelector("#toggleAi").onclick = async () => {
    if (readAiNote(target)) {
      renderMemoPopupView(popup, target, !showAi);
      clampPopupToViewport(popup);
      return;
    }
    await generateMemoPopupAiNote(popup, target);
  };

  popup.querySelector("#editMemo").onclick = () => {
    if (showAi) {
      generateMemoPopupAiNote(popup, target);
    } else {
      renderMemoPopupEdit(popup, target);
    }
  };

  popup.querySelector("#deleteMemo").onclick = async () => {
    try {
      await removeMarkerCompletely(target.dataset.markerId);
    } catch (error) {
      console.log("マーカー削除失敗:", error.message);
      alert(`マーカーの削除に失敗しました。\n${error.message}`);
    }

    removeMemoPopup();
  };
}


function readAiNote(target) {
  if (!target.dataset.aiNote) return null;
  try {
    return JSON.parse(target.dataset.aiNote);
  } catch {
    return null;
  }
}


function renderAiNote(aiNote) {
  const fields = [
    ["解説", aiNote.explanation],
    ["類似語", aiNote.similar_words],
    ["対義語", aiNote.antonyms],
    ["日本語訳", aiNote.translation],
    ["例文", aiNote.usage_example],
  ].filter(([, value]) => value);

  return `<div class="ichnite-ai-note">${fields.map(([label, value]) =>
    `<div class="ichnite-ai-note-row"><strong>${label}</strong><span>${escapeIchniteHtml(value)}</span></div>`
  ).join("")}</div>`;
}


async function generateMemoPopupAiNote(popup, target) {
  const buttons = popup.querySelectorAll("button");
  buttons.forEach(button => { button.disabled = true; });

  try {
    const aiNote = await generateAiNote(target.dataset.markerId, target.textContent);
    target.dataset.aiNote = JSON.stringify(aiNote);
    target.dataset.aiLoaded = "true";
    notifyMarkersUpdated();
    renderMemoPopupView(popup, target, true);
    clampPopupToViewport(popup);
  } catch (error) {
    console.log("AI解説生成失敗:", error.message);
    alert(`AI解説の生成に失敗しました。\n${error.message}`);
    buttons.forEach(button => { button.disabled = false; });
  }
}


// メモのインライン編集（テーマに合わせたUI。prompt()は使わない）
function renderMemoPopupEdit(popup, target) {
  const memo = target.dataset.memo || "";

  popup.innerHTML = `
    <textarea id="ichnite-memo-popup-textarea" placeholder="気づいたことや覚えておきたいことをメモしましょう">${escapeIchniteHtml(memo)}</textarea>
    <div class="ichnite-memo-popup-actions">
      <button id="cancelMemo">キャンセル</button>
      <button id="saveMemo">保存</button>
    </div>
  `;

  clampPopupToViewport(popup);

  const textarea = popup.querySelector("#ichnite-memo-popup-textarea");
  textarea.focus();

  popup.querySelector("#cancelMemo").onclick = () => {
    renderMemoPopupView(popup, target);
  };

  popup.querySelector("#saveMemo").onclick = async () => {
    const saveBtn = popup.querySelector("#saveMemo");
    const newMemo = textarea.value.trim();
    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";

    try {
      await saveMarkerMemo(target.dataset.markerId, newMemo);
      target.dataset.memo = newMemo;
      // 同一タブのサイドパネル一覧にも即座に反映する（notifyMarkersUpdated()経由の
      // メッセージ通知だけでは同一タブに反映されないことがあったため）
      loadMarkerList();
      notifyMarkersUpdated();
      renderMemoPopupView(popup, target);
    } catch (error) {
      console.log("メモ保存失敗:", error.message);
      alert(`メモの保存に失敗しました。\n${error.message}`);
      saveBtn.disabled = false;
      saveBtn.textContent = "保存";
    }
  };
}


function removeMemoPopup() {

  const popup =
    getIchniteRoot().getElementById(
      "ichnite-memo-popup"
    );

  if (popup) {
    popup.remove();
  }
}
