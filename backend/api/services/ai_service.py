import json
from openai import OpenAI
from fastapi import HTTPException
import traceback

import config
from services.prompt import build_prompt


client = OpenAI(api_key=config.OPENAI_API_KEY)


def generate_ai_note(selected_text: str) -> dict:

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

        required_keys = ["explanation", "similar_words", "antonyms", "usage_example"]
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