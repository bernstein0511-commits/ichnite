## セットアップ

### 必要なもの
- Docker Desktop
- （任意）OpenAI APIキー … 未設定でもマーカーの作成・保存・記録帳などコア機能はすべて動作する。設定した場合のみ、マーカーのAI解説が追加で生成される。

### 手順

**1. リポジトリをクローン**
```bash
git clone <リポジトリURL>
cd ichnite
```

**2. `.env` ファイルを作成**

`backend/api/.env.example` をコピーして `.env` を作成する（DB関連は初期値のままでOK。OpenAI APIキーを使う場合のみ`OPENAI_API_KEY`に自分のキーを入力する）

```bash
cp backend/api/.env.example backend/api/.env
```

**3. 起動**
```bash
docker compose up --build
```

**4. 確認**

`http://localhost:8000/docs` が開けばOK

---

## 拡張機能の読み込み

Chrome専用のAPIは使用していないため、Chromium系ブラウザ（Chrome / Microsoft Edge / Brave など）であれば同じ手順でそのまま動作する。

| ブラウザ | 拡張機能ページ |
| --- | --- |
| Chrome | `chrome://extensions` |
| Microsoft Edge | `edge://extensions` |
| Brave | `brave://extensions` |

1. 上表の拡張機能ページを開く
2. 「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `extension` フォルダを選択

特殊なフラグ付きでブラウザを起動する必要はない。APIへの通信は拡張機能のバックグラウンド（Service Worker）が代行するため、通常のプロファイルでそのまま動作する。

※ Firefox・Safariは拡張機能の仕組み（API・Manifestの扱い）がChromiumと異なるため、この手順では動作しない。

---

## アーキテクチャ概要

```
Webページ (content script)  ⇄  background.js (Service Worker)  ⇄  FastAPI (backend)  ⇄  MySQL
        │
        └─ 拡張機能ページ（記録帳・単語詳細・ポップアップ）も同じFastAPIを直接叩く
```

content script（Webページ上で動くコード）は Private Network Access の制約で
`localhost`へ直接fetchできないため、必ず`background.js`経由でAPIを呼ぶ。
一方、記録帳ページ等の拡張機能ページ（`chrome-extension://`）はその制約を受けないため直接fetchしている。

### 拡張機能（`extension/`）

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | 拡張機能の設定（権限・読み込むファイル一覧） |
| `background.js` | Service Worker。APIプロキシ／記録帳タブの管理／タブ間の変更通知の中継 |
| `content/content.js` | 全content scriptで共有するグローバル状態・ユーティリティ（最初に読み込まれる） |
| `content/content.css` | ページ本文に挿入されるハイライト自体のスタイル |
| `content/panel-ui.css` | 拡張機能UI（サイドパネル等）のスタイル。Shadow DOM内でのみ読み込む |
| `modules/shadowHost.js` | 拡張機能UIをShadow DOMに隔離するための共通の入れ物を用意する |
| `modules/storage.js` | バックエンドAPIを呼ぶ関数をまとめた層（content script側） |
| `modules/textLocator.js` | 「ページ内で同じ文字列の何番目の出現か」でマーカー位置を特定するロジック |
| `modules/marker.js` | 新規マーカー作成（選択→ツールバー→保存→AI解説生成）と削除の実処理 |
| `modules/restore.js` | ページ読み込み時に保存済みマーカーをDOMへ復元する |
| `modules/popup.js` | ページ上のハイライトにホバーした時に出るメモポップアップ |
| `modules/panel.js` | 右上のサイドパネル（マーカー一覧・絞り込み・メモ編集） |
| `ui/popup.html` `.js` | ツールバーアイコンをクリックした時の小さなポップアップ |
| `ui/marker_book.html` `.js` `.css` | マーカー記録帳ページ（一覧・検索・学習統計・削除） |
| `ui/marker_detail.html` `.js` `.css` | 単語1件ごとの詳細ページ（メモ編集・AI解説の生成/再生成） |
| `icons/` | ロゴ画像（サイドパネル・記録帳ページで使用） |

### バックエンド（`backend/api/`）

| ファイル | 役割 |
| --- | --- |
| `main.py` | FastAPIアプリの起動点。CORS設定とrouter登録のみ |
| `config.py` | `.env`の読み込み（DB接続情報・OpenAI APIキー） |
| `database.py` | DB接続・セッション管理 |
| `models.py` | テーブル定義（`pages` / `markers` / `ai_notes` / `marker_book`） |
| `schemas.py` | APIのリクエスト/レスポンスの型（Pydantic） |
| `crud.py` | 実際のDB読み書き処理 |
| `routers/*.py` | エンドポイント定義（HTTPの窓口。処理自体はcrud.pyに委譲） |
| `services/prompt.py` | AIに送るプロンプト文の組み立て |
| `services/ai_service.py` | OpenAI API呼び出しのラッパー |

---

## 現在の機能

- テキストを選択してカラーボタンでマーカーを引ける
- マーカーはMySQLにAPI経由で保存される
- ☰ボタンのサイドパネルにマーカー一覧（辞書）が表示される
- サイドパネルからマーカーを削除できる
- ページリロード後もマーカーが復元される
- **マーカー記録帳ページ**（`extension/ui/marker_book.html`）で、すべてのマーカーを一覧管理できる
  - 拡張機能アイコンのポップアップ、または☰サイドパネルの「📖 記録帳」ボタンから新しいタブで開く
  - ページ／色／期間／キーワードで絞り込み検索
  - 表示（AI解説・類似語・対義語・例文・メモをまとめて確認）
  - メモの追加・編集（`marker_book`テーブルに保存）
  - 削除（紐づくAI解説・メモも連鎖削除）

## 未実装

- AI解説の表示（要OpenAIクレジット）

## 記録帳ページ用に追加したAPI

- `GET /marker_book/full`
  Page・Marker・AiNote・MarkerBookを結合した一覧を返す（記録帳ページの一覧表示用）
- `PUT /marker_book/{marker_id}`
  指定したマーカーのメモを更新する（未登録なら新規作成、登録済みなら上書き）