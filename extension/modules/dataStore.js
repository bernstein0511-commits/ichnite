// ==========================================================
// modules/dataStore.js — chrome.storage.local を使ったデータ層。
// 旧バックエンド(FastAPI)のcrud.pyに相当する処理をここに集約する。
//
// 以前は pages / markers / ai_notes / marker_book の4テーブルに分けて
// MySQL(→SQLite)へ保存していたが、クライアントサイドで結合クエリを書く
// 必要は無いため、マーカー1件を「ページ情報・AI解説・メモ」まで含めた
// フラットな1レコードとして chrome.storage.local に保存する。
//
// このファイルは background.js の importScripts() から読み込まれ、
// background.js からのみ呼ばれる（service workerの実行コンテキスト）。
// ==========================================================

const ICHNITE_MARKERS_KEY = "ichnite_markers";
const ICHNITE_SETTINGS_KEY = "ichnite_settings";


async function dsGetAllMarkersRaw() {
  const data = await chrome.storage.local.get(ICHNITE_MARKERS_KEY);
  return data[ICHNITE_MARKERS_KEY] || [];
}

async function dsSetAllMarkersRaw(markers) {
  await chrome.storage.local.set({ [ICHNITE_MARKERS_KEY]: markers });
}

function dsNextMarkerId(markers) {
  return markers.reduce((max, m) => Math.max(max, m.marker_id), 0) + 1;
}


// ==========================
// マーカー
// ==========================

// マーカーを1件保存する。pageはmarker_idとは別に正規化せず、
// URL/タイトルをそのままレコードに持たせる（クライアントサイドでは
// 結合の必要が無いため、正規化のコストに見合わない）。
async function dsSaveMarker({ page_url, page_title, selected_text, color, position_start, position_end }) {
  const markers = await dsGetAllMarkersRaw();
  const marker_id = dsNextMarkerId(markers);

  const record = {
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
  };

  markers.push(record);
  await dsSetAllMarkersRaw(markers);
  return { marker_id };
}

async function dsFetchAllMarkers() {
  return await dsGetAllMarkersRaw();
}

async function dsFetchMarkersForPage(pageUrl) {
  const markers = await dsGetAllMarkersRaw();
  return markers.filter(m => m.page_url === pageUrl);
}

// 記録帳ページ用の結合済み一覧に相当。フラット保存のため実質全件取得と同じ。
async function dsFetchMarkerBookEntries() {
  return await dsGetAllMarkersRaw();
}

async function dsDeleteMarker(markerId) {
  const markers = await dsGetAllMarkersRaw();
  const filtered = markers.filter(m => m.marker_id !== markerId);

  if (filtered.length === markers.length) {
    throw new Error("Marker not found");
  }

  await dsSetAllMarkersRaw(filtered);
  return { message: "deleted" };
}


// ==========================
// メモ（旧marker_bookテーブル相当）
// ==========================

async function dsSaveMarkerMemo(markerId, memo) {
  const markers = await dsGetAllMarkersRaw();
  const marker = markers.find(m => m.marker_id === markerId);
  if (!marker) throw new Error("Marker not found");

  marker.memo = memo;
  await dsSetAllMarkersRaw(markers);
  return marker;
}


// ==========================
// AI解説（旧ai_notesテーブル相当）
// ==========================

// 未生成の場合は例外を投げる（旧APIの404相当）。
// 呼び出し側(storage.jsのfetchAiNote)はこれをキャッチしてnullに変換する。
async function dsFetchAiNote(markerId) {
  const markers = await dsGetAllMarkersRaw();
  const marker = markers.find(m => m.marker_id === markerId);
  if (!marker || !marker.explanation) {
    throw new Error("AI Note not found");
  }

  return {
    explanation: marker.explanation,
    similar_words: marker.similar_words,
    antonyms: marker.antonyms,
    usage_example: marker.usage_example,
    translation: marker.translation,
  };
}

// AI生成結果（aiService.js側で取得したもの）をマーカーに書き戻す。
// 既存の解説を上書きする形になるため、生成・再生成のどちらでもそのまま使える。
async function dsSaveAiNote(markerId, aiResult) {
  const markers = await dsGetAllMarkersRaw();
  const marker = markers.find(m => m.marker_id === markerId);
  if (!marker) throw new Error("Marker not found");

  marker.explanation = aiResult.explanation;
  marker.similar_words = aiResult.similar_words;
  marker.antonyms = aiResult.antonyms;
  marker.usage_example = aiResult.usage_example;
  marker.translation = aiResult.translation;

  await dsSetAllMarkersRaw(markers);
  return marker;
}


// ==========================
// 設定（OpenAI APIキー等）
// ==========================

async function dsGetSettings() {
  const data = await chrome.storage.local.get(ICHNITE_SETTINGS_KEY);
  return data[ICHNITE_SETTINGS_KEY] || { openaiApiKey: "" };
}

async function dsSaveSettings(settings) {
  const current = await dsGetSettings();
  const merged = { ...current, ...settings };
  await chrome.storage.local.set({ [ICHNITE_SETTINGS_KEY]: merged });
  return merged;
}
