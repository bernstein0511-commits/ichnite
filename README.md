## セットアップ

バックエンドサーバーは不要。拡張機能単体で完結する。

### 必要なもの

- Chromium系ブラウザ（Chrome / Microsoft Edge / Brave など）
- （任意）OpenAI APIキー … 未設定でもマーカーの作成・保存・記録帳などコア機能はすべて動作する。設定した場合のみ、マーカーのAI解説が追加で生成される。

### 手順

**1. リポジトリをクローン（またはダウンロード）**

```bash
git clone <リポジトリURL>
cd ichnite
```

**2. 拡張機能を読み込む**

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

これだけで完了。サーバーの起動や `.env` の準備は不要。

※ Firefox・Safariは拡張機能の仕組み（API・Manifestの扱い）がChromiumと異なるため、この手順では動作しない。

**3.（任意）OpenAI APIキーを設定する**

拡張機能アイコンのポップアップ →「設定（APIキーなど）」から入力できる。
未設定のままでも、マーカーの作成・保存・記録帳・検索・学習統計などのコア機能はすべて利用できる。設定するとマーカーのAI解説（意味・類似語・対義語・例文）が生成されるようになる。

---

## アーキテクチャ概要

```
Webページ (content script)  ⇄  background.js (Service Worker)  ⇄  chrome.storage.local
        │                              │
        │                              └─ OpenAI API（AI解説生成時のみ、任意）
        │
        └─ 拡張機能ページ（記録帳・単語詳細・ポップアップ・設定）も
           background.js経由で同じデータにアクセスする
```

マーカーやメモ、AI解説などのデータはすべて `chrome.storage.local` に保存される。外部サーバー・DB・Dockerは不要。
content script（Webページ上で動くコード）はService Workerの内部（`chrome.storage`）に直接アクセスできないため、必ず`chrome.runtime.sendMessage`で`background.js`に処理を依頼する。拡張機能ページ（`chrome-extension://`）も同じ仕組みでデータをやり取りする。

OpenAIへの通信のみ、`background.js`から`https://api.openai.com`へ直接fetchする（APIキーは`ui/settings.html`で登録し、`chrome.storage.local`に保存される）。

### 拡張機能（`extension/`）

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | 拡張機能の設定（権限・読み込むファイル一覧） |
| `background.js` | Service Worker。データ操作の窓口／記録帳タブの管理／タブ間の変更通知の中継 |
| `modules/dataStore.js` | `chrome.storage.local`への実際の読み書き処理（マーカー・メモ・設定） |
| `modules/aiService.js` | OpenAI Chat Completions APIの直接呼び出し（AI解説生成） |
| `content/content.js` | 全content scriptで共有するグローバル状態・ユーティリティ（最初に読み込まれる） |
| `content/content.css` | ページ本文に挿入されるハイライト自体のスタイル |
| `content/panel-ui.css` | 拡張機能UI（サイドパネル等）のスタイル。Shadow DOM内でのみ読み込む |
| `modules/shadowHost.js` | 拡張機能UIをShadow DOMに隔離するための共通の入れ物を用意する |
| `modules/storage.js` | データ操作関数をまとめた層（content script側。実処理はbackground.js経由） |
| `modules/textLocator.js` | 「ページ内で同じ文字列の何番目の出現か」でマーカー位置を特定するロジック |
| `modules/marker.js` | 新規マーカー作成（選択→ツールバー→保存→AI解説生成）と削除の実処理 |
| `modules/restore.js` | ページ読み込み時に保存済みマーカーをDOMへ復元する |
| `modules/popup.js` | ページ上のハイライトにホバーした時に出るメモポップアップ |
| `modules/panel.js` | 右上のサイドパネル（マーカー一覧・絞り込み・メモ編集） |
| `ui/popup.html` `.js` | ツールバーアイコンをクリックした時の小さなポップアップ |
| `ui/marker_book.html` `.js` `.css` | マーカー記録帳ページ（一覧・検索・学習統計・削除） |
| `ui/marker_detail.html` `.js` `.css` | 単語1件ごとの詳細ページ（メモ編集・AI解説の生成/再生成） |
| `ui/settings.html` `.js` `.css` | OpenAI APIキーの登録画面 |
| `icons/` | ロゴ画像（サイドパネル・記録帳ページで使用） |

---

## 現在の機能

- テキストを選択してカラーボタンでマーカーを引ける
- マーカーは`chrome.storage.local`に保存される（サーバー・DB不要）
- ☰ボタンのサイドパネルにマーカー一覧（辞書）が表示される
- サイドパネルからマーカーを削除できる
- ページリロード後もマーカーが復元される
- **マーカー記録帳ページ**（`extension/ui/marker_book.html`）で、すべてのマーカーを一覧管理できる
  - 拡張機能アイコンのポップアップ、または☰サイドパネルの「記録帳」ボタンから新しいタブで開く
  - ページ／色／期間／キーワードで絞り込み検索
  - 表示（AI解説・類似語・対義語・例文・メモをまとめて確認）
  - メモの追加・編集
  - 削除（紐づくAI解説・メモも一緒に削除）
  - 学習の可視化（ヒートマップ・連続記録日数・色の内訳などの統計）
- **設定ページ**（`extension/ui/settings.html`）でOpenAI APIキーを登録すると、マーカーのAI解説が生成されるようになる（任意機能）
