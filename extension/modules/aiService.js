// ==========================================================
// modules/aiService.js — OpenAIのChat Completions APIを直接叩く。
// 旧backend/api/services/{ai_service,prompt}.pyの置き換え。
// APIキーはui/settings.htmlで入力してもらい、dataStore.js経由でchrome.storage.localに置く。
// ==========================================================

function buildPrompt(selectedText) {
  return `以下の語句または文章について、日本語で次の5項目を答えてください。
出力はJSONのみで、前置きや説明は書かないでください。

対象: 「${selectedText}」

{
  "explanation": "意味・解説（2〜4文）",
  "similar_words": "類似語・同義語（カンマ区切りで3〜5語）",
  "antonyms": "対義語（カンマ区切りで1〜3語、なければ「なし」）",
  "translation": "日本語訳（対象がすでに日本語なら「なし」）",
  "usage_example": "例文（自然な日本語で1文）"
}`;
}

async function generateAiNoteViaOpenAi(selectedText) {
  const settings = await dsGetSettings();
  const apiKey = (settings.openaiApiKey || "").trim();

  if (!apiKey) {
    throw new Error("OpenAIのAPIキーが設定されていません。拡張機能の設定画面から登録してください。");
  }

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "語句の解説を行うアシスタントです。JSONのみで回答してください。" },
          { role: "user", content: buildPrompt(selectedText) },
        ],
      }),
    });
  } catch (error) {
    throw new Error(`OpenAIに接続できませんでした: ${error.message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let message = `OpenAI APIエラー (${response.status})`;
    try {
      message = JSON.parse(body).error.message;
    } catch {
      // JSONで返ってこなければ上のステータスコードのみのメッセージを使う
    }
    throw new Error(message);
  }

  const data = await response.json();
  let note;
  try {
    note = JSON.parse(data.choices[0].message.content);
  } catch {
    throw new Error("AIの応答を解析できませんでした");
  }

  for (const key of ["explanation", "similar_words", "antonyms", "translation", "usage_example"]) {
    if (!(key in note)) note[key] = "";
  }
  return note;
}
