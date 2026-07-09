window.addEventListener("load", async () => {
  await restoreMarkers();
  jumpToHashMarker();
});


function jumpToHashMarker() {
  const match = location.hash.match(/^#ichnite-marker-(\d+)$/);
  if (!match) return;

  const targetEl = document.querySelector(
    `.ichnite-highlight[data-marker-id="${match[1]}"]`
  );
  if (!targetEl) return;

  targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
  targetEl.classList.add("ichnite-jump-flash");
  setTimeout(() => targetEl.classList.remove("ichnite-jump-flash"), 1200);
}


async function restoreMarkers() {
  const currentUrl = window.location.href;

  try {
    // 全マーカーを取得（バックエンドにURLフィルタAPIがないため全件取得後に絞る）
    const res = await fetch("http://localhost:8000/markers/");
    if (!res.ok) return;

    const allMarkers = await res.json();

    // ページのURLで絞り込む（page_idからURLを逆引きするより簡易的な方法）
    // ※ Step 7 でページ別取得APIを追加したら差し替える
    for (const marker of allMarkers) {
      await restoreSingleMarker(marker);
    }
  } catch (error) {
    console.log("マーカー復元失敗:", error);
  }
}


async function restoreSingleMarker(marker) {
  const targetText = marker.selected_text;
  const color = marker.color;
  const markerId = marker.marker_id;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );

  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent;
    const index = text.indexOf(targetText);

    if (index !== -1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + targetText.length);

      const markerEl = document.createElement("span");
      markerEl.className = `ichnite-highlight ${color}`;
      markerEl.dataset.markerId = markerId;
      markerEl.dataset.aiLoaded = "false";

      try {
        range.surroundContents(markerEl);

        // AI解説をDBから取得して紐付け
        const aiRes = await fetch(`http://localhost:8000/ai_notes/${markerId}`);
        if (aiRes.ok) {
          const aiNote = await aiRes.json();
          markerEl.dataset.aiNote = JSON.stringify(aiNote);
          markerEl.dataset.aiLoaded = "true";
        }

        console.log("復元成功:", targetText);
      } catch (error) {
        console.log("復元失敗:", error);
      }

      break;
    }
  }
}