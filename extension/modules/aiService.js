// ==========================================================
// modules/aiService.js — OpenAI Chat Completions APIを拡張機能から直接呼び出す。
// 旧バックエンドの services/ai_service.py・services/prompt.py に相当する処理。
// APIキーはdataStore.js（chrome.storage.local）に保存された設定から読む。
//
// このファイルは background.js の importScripts() から読み込まれる。
// ==========================================================

function aiBuildPrompt(selectedText) {
  return `以下の語句または文章について、日本語で以下の5項目を答えてください。
必ずJSON形式のみで返してください。前置きや説明文は不要です。

対象: 「${selectedText}」

{
  "explanation": "意味・解説（2〜4文で簡潔に）",
  "similar_words": "類似語・同義語（カンマ区切りで3〜5語）",
  "antonyms": "対義語（カンマ区切りで1〜3語。ない場合は「なし」）",
  "translation": "対象の日本語訳（単語・熟語なら1〜2語、文なら自然な日本語訳。対象がすでに日本語の場合は「なし」）",
  "usage_example": "例文（自然な日本語で1文）"
}`;
}


// selectedTextについてのAI解説を生成して返す。
// APIキー未設定・OpenAI側のエラー時は分かりやすいメッセージのエラーを投げる
// （呼び出し側=拡張機能のUIはこれを表示するだけで、マーカー機能自体は継続する）。
async function generateAiNoteViaOpenAi(selectedText) {
  const settings = await dsGetSettings();
  const apiKey = (settings.openaiApiKey || "").trim();

  if (!apiKey) {
    throw new Error("OpenAI APIキーが未設定です。拡張機能の「設定」からキーを登録してください。");
  }

  let res;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "あなたは語句の解説をするアシスタントです。必ずJSON形式のみで返してください。余計な文字列は一切含めないでください。",
          },
          { role: "user", content: aiBuildPrompt(selectedText) },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    throw new Error(`OpenAIへの通信に失敗しました: ${error.message}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let detail = `OpenAI APIエラー（HTTP ${res.status}）`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson?.error?.message) detail = errJson.error.message;
    } catch {
      // JSONでなければステータスコードのみのメッセージのままにする
    }
    throw new Error(detail);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;

  let result;
  try {
    result = JSON.parse(raw);
  } catch (error) {
    throw new Error("AIの応答をJSONとして解釈できませんでした。");
  }

  // 応答に不足しているキーがあっても空文字で補い、表示側で落ちないようにする
  const requiredKeys = ["explanation", "similar_words", "antonyms", "translation", "usage_example"];
  for (const key of requiredKeys) {
    if (!(key in result)) result[key] = "";
  }

  return result;
}
