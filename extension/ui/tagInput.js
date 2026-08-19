/* =============================================
   ui/tagInput.js — Google Keepのラベルのような、自由記述＋既存候補の
   両方に対応したタグ入力UIを組み立てる共通部品。
   marker_detail.html（単語詳細）・marker_book.html（記録帳一覧のメモ編集モーダル）
   の両方から読み込んで使う。データの保存自体は呼び出し側（onChange）が担当する。

   候補はブラウザ標準の<datalist>ではなく、入力欄のすぐ下に横スクロールの
   候補チップ行として自前で描画する（<datalist>は見た目・操作感をブラウザに
   委ねてしまい、クリック一発で追加という動きにできないため）。
   ============================================= */

// entries（マーカーの配列。各要素は.tagsを持つ）から、全マーカー横断のタグ候補一覧を作る。
// 使われている回数が多い順（同数ならあいうえお順）に並べ、よく使うタグほど候補の上に出るようにする。
function collectAllTags(entries) {
  const counts = new Map();
  for (const entry of entries) {
    for (const tag of entry.tags || []) {
      const key = tag.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .map(([tag]) => tag);
}

// knownTags（dsFetchKnownTagsで取れる、一度でも使われたタグの永続候補一覧）を、
// 今の実際の使用頻度が高い順に並べ替える。頻度0（今は使っているマーカーが無い）の
// タグも除外はしない＝候補としては残り続ける。
function sortTagsByUsage(knownTags, entries) {
  const counts = new Map();
  for (const entry of entries) {
    for (const tag of entry.tags || []) {
      const key = tag.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...knownTags].sort((a, b) => {
    const diff = (counts.get(b.toLowerCase()) || 0) - (counts.get(a.toLowerCase()) || 0);
    return diff !== 0 ? diff : a.localeCompare(b, "ja");
  });
}

// container（タグ編集UIを差し込む親要素）にタグ入力UIを構築する。
//   tags             … このマーカーの現在のタグ配列
//   allTags          … 候補として出す、永続的なタグ候補一覧（sortTagsByUsage()の戻り値）
//   onChange         … タグが増減するたびに呼ばれる (newTags: string[]) => void（保存はここで行う）
//   onDeleteCandidate … 候補チップの×で完全削除した時に呼ばれる (tag: string) => void（永続削除はここで行う）
function createTagEditor({ container, tags, allTags, onChange, onDeleteCandidate }) {
  let current = [...(tags || [])];
  let candidatePool = [...(allTags || [])];

  container.innerHTML = "";
  container.classList.add("tag-editor");

  const chipsWrap = document.createElement("div");
  chipsWrap.className = "tag-editor-chips";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "tag-editor-input";
  input.autocomplete = "off";
  input.spellcheck = false;

  chipsWrap.appendChild(input);
  container.appendChild(chipsWrap);

  // 入力欄の一行下に出す、候補タグの横スクロール行
  const suggestionsWrap = document.createElement("div");
  suggestionsWrap.className = "tag-editor-suggestions";
  container.appendChild(suggestionsWrap);

  function addTag(value) {
    const tag = value.trim();
    if (!tag) return;
    if (current.some((t) => t.toLowerCase() === tag.toLowerCase())) return;

    current.push(tag);
    input.value = "";
    renderChips();
    renderSuggestions();
    onChange([...current]);
  }

  function removeTag(tag) {
    current = current.filter((t) => t !== tag);
    renderChips();
    renderSuggestions();
    onChange([...current]);
  }

  function renderChips() {
    chipsWrap.querySelectorAll(".tag-chip").forEach((el) => el.remove());

    current.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";

      const label = document.createElement("span");
      label.className = "tag-chip-label";
      label.textContent = tag;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "tag-chip-remove";
      removeBtn.setAttribute("aria-label", `「${tag}」を削除`);
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => removeTag(tag));

      chip.appendChild(label);
      chip.appendChild(removeBtn);
      chipsWrap.insertBefore(chip, input);
    });

    input.placeholder = current.length ? "" : "タグを追加（Enterで確定）";
  }

  // 候補チップ行を再描画する。入力欄に文字があれば前方一致で絞り込み、
  // 既に付いているタグは候補から除外する。クリックした瞬間にそのまま追加される。
  function renderSuggestions() {
    suggestionsWrap.innerHTML = "";

    const existingLower = new Set(current.map((t) => t.toLowerCase()));
    const typed = input.value.trim().toLowerCase();

    const candidates = candidatePool
      .filter((t) => !existingLower.has(t.toLowerCase()))
      .filter((t) => !typed || t.toLowerCase().includes(typed));

    suggestionsWrap.hidden = candidates.length === 0;

    candidates.forEach((t) => {
      const pill = document.createElement("span");
      pill.className = "tag-suggestion";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "tag-suggestion-add";
      addBtn.textContent = t;
      // mousedownの時点で追加する（inputのblurより先に発火するため、
      // 「候補をクリックしたら押しただけで追加される」が確実に動く）
      addBtn.addEventListener("mousedown", (event) => {
        event.preventDefault();
        addTag(t);
        input.focus();
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "tag-suggestion-delete";
      deleteBtn.setAttribute("aria-label", `候補「${t}」を完全に削除`);
      deleteBtn.textContent = "×";
      deleteBtn.addEventListener("mousedown", (event) => {
        // 追加ボタンのmousedownと違い、こちらはタグを付けたいわけではないので
        // 確認してから、候補一覧そのものから消す（このマーカーのタグとは無関係）
        event.preventDefault();
        event.stopPropagation();
        if (!confirm(`候補「${t}」を一覧から完全に削除しますか？\n（今このマーカーに付いているタグには影響しません）`)) return;

        candidatePool = candidatePool.filter((c) => c !== t);
        renderSuggestions();
        onDeleteCandidate?.(t);
      });

      pill.appendChild(addBtn);
      pill.appendChild(deleteBtn);
      suggestionsWrap.appendChild(pill);
    });
  }

  input.addEventListener("input", renderSuggestions);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(input.value);
    } else if (event.key === "Backspace" && input.value === "" && current.length > 0) {
      // 空欄でBackspaceを押すと直前のタグを消す（Keep等の入力欄でおなじみの挙動）
      removeTag(current[current.length - 1]);
    }
  });

  // フォーカスが外れた時点で入力中の文字列を確定させる（保存ボタンを別途押す必要はない）
  input.addEventListener("blur", () => addTag(input.value));

  renderChips();
  renderSuggestions();
}
