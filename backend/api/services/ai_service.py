# ==========================================================
# services/ai_service.py — OpenAI呼び出しのラッパー。
# プロンプト文自体は services/prompt.py が組み立てる。
# ここではAPIキー未設定時のガード、実際のAPI呼び出し、
# JSON応答のパース・不足キーの補完だけを担当する。
# ==========================================================

import json
from openai import OpenAI
from fastapi import HTTPException
import traceback

import config
from services.prompt import build_prompt


def generate_ai_note(selected_text: str) -> dict:

    if not config.OPENAI_API_KEY:
        # AI解説は任意機能。キー未設定時にモジュール読み込み時点でクラッシュしないよう、
        # クライアントはここで初めて生成し、事前にわかりやすいエラーを返す。
        # 呼び出し側（拡張機能）はこの失敗を無視してマーカー機能自体は継続する。
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEYが未設定のため、AI解説は生成されません。",
        )

    client = OpenAI(api_key=config.OPENAI_API_KEY)

    prompt = build_prompt(selected_text)

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "あなたは語句の解説をするアシスタントです。"
                        "必ずJSON形式のみで返してください。"
                        "余計な文字列は一切含めないでください。"
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,
            max_tokens=500,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        result = json.loads(raw)

        required_keys = ["explanation", "similar_words", "antonyms", "translation", "usage_example"]
        for key in required_keys:
            if key not in result:
                result[key] = ""

        return result

    except Exception as e:
        # 詳細なエラーをログに出力
        print("=== AI SERVICE ERROR ===")
        print(f"Type: {type(e).__name__}")
        print(f"Message: {str(e)}")
        traceback.print_exc()
        print("========================")
        raise HTTPException(
            status_code=500,
            detail=f"{type(e).__name__}: {str(e)}"
        )