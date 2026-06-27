const API_BASE = "http://localhost:8000";


// ページをDBに登録してpage_idを返す
async function getOrCreatePage() {
  const url = window.location.href;
  const title = document.title;

  const res = await fetch(`${API_BASE}/pages/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, title }),
  });

  if (!res.ok) throw new Error("ページ登録失敗");
  const data = await res.json();
  return data.page_id;
}


// マーカーをDBに保存してmarker_idを返す
async function saveMarker(selectedText, color, positionStart, positionEnd) {
  const page_id = await getOrCreatePage();

  const res = await fetch(`${API_BASE}/markers/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      page_id,
      selected_text: selectedText,
      color,
      position_start: positionStart,
      position_end: positionEnd,
    }),
  });

  if (!res.ok) throw new Error("マーカー保存失敗");
  const data = await res.json();
  return data.marker_id;
}


// AI解説を生成してDBに保存、結果を返す
async function generateAiNote(markerId, selectedText) {
  const res = await fetch(`${API_BASE}/ai_notes/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      marker_id: markerId,
      selected_text: selectedText,
    }),
  });

  if (!res.ok) throw new Error("AI解説生成失敗");
  return await res.json();
}


// マーカーをDBから削除
async function deleteMarker(markerId) {
  const res = await fetch(`${API_BASE}/markers/${markerId}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error("マーカー削除失敗");
}


// 現在のページのマーカー一覧をDBから取得
async function fetchMarkersForPage() {
  const url = window.location.href;

  const res = await fetch(`${API_BASE}/markers/`);
  if (!res.ok) throw new Error("マーカー取得失敗");

  const all = await res.json();
  return all.filter(m => m.page_id !== undefined);
}