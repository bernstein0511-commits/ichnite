// ==========================================================
// modules/dataStore.js — マーカーデータの読み書き先を chrome.storage.local にする層。
// 旧backend/api/crud.pyが担っていた処理をここに置き換えた。
// background.js からのみ呼ばれる（service worker内）。
//
// pages/markers/ai_notes/marker_bookに分かれていたテーブルは、結合して
// 使う場面しかなかったので、マーカー1件＝1レコードのフラットな配列にまとめている。
// ==========================================================

const MARKERS_KEY = "ichnite_markers";
const SETTINGS_KEY = "ichnite_settings";

async function getMarkers() {
  const stored = await chrome.storage.local.get(MARKERS_KEY);
  return stored[MARKERS_KEY] || [];
}

async function setMarkers(markers) {
  await chrome.storage.local.set({ [MARKERS_KEY]: markers });
}

function nextId(markers) {
  let max = 0;
  for (const m of markers) {
    if (m.marker_id > max) max = m.marker_id;
  }
  return max + 1;
}

async function dsSaveMarker({ page_url, page_title, selected_text, color, position_start, position_end }) {
  const markers = await getMarkers();
  const marker_id = nextId(markers);

  markers.push({
    marker_id,
    page_url,
    page_title: page_title || page_url,
    selected_text,
    color,
    position_start,
    position_end,
    created_at: new Date().toISOString(),
    explanation: null,
    similar_words: null,
    antonyms: null,
    usage_example: null,
    translation: null,
    memo: null,
  });

  await setMarkers(markers);
  return { marker_id };
}

async function dsFetchAllMarkers() {
  return await getMarkers();
}

async function dsFetchMarkersForPage(pageUrl) {
  const markers = await getMarkers();
  return markers.filter((m) => m.page_url === pageUrl);
}

async function dsFetchMarkerBookEntries() {
  // フラット保存なので、記録帳用の「結合済み一覧」は全件取得と同じもので済む
  return await getMarkers();
}

async function dsDeleteMarker(markerId) {
  const markers = await getMarkers();
  const remaining = markers.filter((m) => m.marker_id !== markerId);
  if (remaining.length === markers.length) {
    throw new Error("そのマーカーは見つかりませんでした");
  }
  await setMarkers(remaining);
}

async function dsSaveMarkerMemo(markerId, memo) {
  const markers = await getMarkers();
  const marker = markers.find((m) => m.marker_id === markerId);
  if (!marker) throw new Error("そのマーカーは見つかりませんでした");

  marker.memo = memo;
  await setMarkers(markers);
  return marker;
}

async function dsFetchAiNote(markerId) {
  const markers = await getMarkers();
  const marker = markers.find((m) => m.marker_id === markerId);
  if (!marker || !marker.explanation) {
    throw new Error("AI解説はまだ生成されていません");
  }

  return {
    explanation: marker.explanation,
    similar_words: marker.similar_words,
    antonyms: marker.antonyms,
    usage_example: marker.usage_example,
    translation: marker.translation,
  };
}

async function dsSaveAiNote(markerId, note) {
  const markers = await getMarkers();
  const marker = markers.find((m) => m.marker_id === markerId);
  if (!marker) throw new Error("そのマーカーは見つかりませんでした");

  marker.explanation = note.explanation;
  marker.similar_words = note.similar_words;
  marker.antonyms = note.antonyms;
  marker.usage_example = note.usage_example;
  marker.translation = note.translation;

  await setMarkers(markers);
  return marker;
}

async function dsGetSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return stored[SETTINGS_KEY] || { openaiApiKey: "" };
}

async function dsSaveSettings(patch) {
  const current = await dsGetSettings();
  const merged = { ...current, ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}
