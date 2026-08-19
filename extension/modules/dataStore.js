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
// タグ入力UIの候補一覧。マーカーのtagsとは別に持ち、一度作ったタグは
// 使っているマーカーが無くなっても消えないようにする（明示的な削除のみで消える）。
const KNOWN_TAGS_KEY = "ichnite_known_tags";

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
    tags: [],
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

// タグを丸ごと置き換える（追加・削除どちらもここに集約。呼び出し側で配列を組み立てて渡す）。
// 空文字は捨て、大文字小文字を区別せず重複除去してから保存する
// （"Idiom"と"idiom"を別タグとして増やし続けるのを防ぐため）。
async function dsSaveMarkerTags(markerId, tags) {
  const markers = await getMarkers();
  const marker = markers.find((m) => m.marker_id === markerId);
  if (!marker) throw new Error("そのマーカーは見つかりませんでした");

  const seen = new Set();
  const normalized = [];
  for (const raw of tags || []) {
    const tag = String(raw ?? "").trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(tag);
  }

  marker.tags = normalized;
  await setMarkers(markers);

  // 新しく使ったタグは候補一覧(ichnite_known_tags)にも記録する。
  // このマーカーから後で外れても候補からは消えない（消すにはdsDeleteKnownTagを明示的に呼ぶ）。
  const known = await getKnownTags();
  await setKnownTags(mergeKnownTags(known, normalized));

  return marker;
}

async function getKnownTags() {
  const stored = await chrome.storage.local.get(KNOWN_TAGS_KEY);
  return stored[KNOWN_TAGS_KEY] || [];
}

async function setKnownTags(tags) {
  await chrome.storage.local.set({ [KNOWN_TAGS_KEY]: tags });
}

// 大文字小文字を区別せず重複を除きつつ、既存の並び順を保ったまま新しいタグを追加する
function mergeKnownTags(known, newTags) {
  const seen = new Set(known.map((t) => t.toLowerCase()));
  const merged = [...known];
  for (const tag of newTags) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(tag);
  }
  return merged;
}

// タグ入力UIの候補一覧を返す。dsSaveMarkerTagsを経由していない古いデータ等でも
// 取りこぼしが無いよう、実際に使われているタグを毎回マージしてから返す
// （候補から消したタグまで復活することはない。あくまで「現在使われているのに
// 候補に無い」ものだけを補う一方向の同期）。
async function dsFetchKnownTags() {
  const [known, markers] = await Promise.all([getKnownTags(), getMarkers()]);

  const inUse = [];
  for (const m of markers) {
    for (const tag of m.tags || []) inUse.push(tag);
  }

  const merged = mergeKnownTags(known, inUse);
  if (merged.length !== known.length) {
    await setKnownTags(merged);
  }
  return merged;
}

// タグ候補を完全に削除する（この操作でのみ候補から消える）。
// 既にこのタグを持っているマーカー側のtagsはそのまま残す（履歴として保持）。
async function dsDeleteKnownTag(tag) {
  const known = await getKnownTags();
  const key = String(tag ?? "").trim().toLowerCase();
  const remaining = known.filter((t) => t.toLowerCase() !== key);
  await setKnownTags(remaining);
  return remaining;
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
  // markersVisible/popupEnabled/floatingButtonPos は全タブ共通のUI設定
  // （サイドパネルの表示切り替え・フローティングボタンの位置）。
  // タブごとに独立させず、ここに保存して他タブと同期させる（modules/panel.js参照）。
  return {
    openaiApiKey: "",
    markersVisible: true,
    popupEnabled: true,
    floatingButtonPos: null,
    ...(stored[SETTINGS_KEY] || {}),
  };
}

async function dsSaveSettings(patch) {
  const current = await dsGetSettings();
  const merged = { ...current, ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}
