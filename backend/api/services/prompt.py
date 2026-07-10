# services/prompt.py — AIに送るプロンプト文をここで一元管理する。
# 出力形式（4項目のJSON）を変えたい場合はこのテンプレートだけを直せばよい。
def build_prompt(selected_text: str) -> str:
    return f"""以下の語句または文章について、日本語で以下の4項目を答えてください。
必ずJSON形式のみで返してください。前置きや説明文は不要です。

対象: 「{selected_text}」

{{
  "explanation": "意味・解説（2〜4文で簡潔に）",
  "similar_words": "類似語・同義語（カンマ区切りで3〜5語）",
  "antonyms": "対義語（カンマ区切りで1〜3語。ない場合は「なし」）",
  "usage_example": "例文（自然な日本語で1文）"
}}"""