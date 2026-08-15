## セットアップ

サーバーやDBは不要。拡張機能フォルダを読み込むだけで動く。

### 拡張機能の読み込み

Chrome専用のAPIは使用していないため、Chromium系ブラウザ（Chrome / Microsoft Edge / Brave など）であれば同じ手順で動作する。

| ブラウザ | 拡張機能ページ |
| --- | --- |
| Chrome | `chrome://extensions` |
| Microsoft Edge | `edge://extensions` |
| Brave | `brave://extensions` |

1. 上表の拡張機能ページを開く
2. 「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `extension` フォルダを選択

これだけでマーカーの作成・保存・記録帳が使える。

※ Firefox・Safariは拡張機能の仕組み（API・Manifestの扱い）がChromiumと異なるため、この手順では動作しない。

### AI解説を使う場合（任意）

拡張機能アイコン → 「設定」からOpenAIのAPIキーを登録すると、マーカーのAI解説（意味・類似語・対義語・例文）が生成できるようになる。キーは`chrome.storage.local`に保存され、生成時に`api.openai.com`へ直接リクエストする。未設定でも他の機能はすべて動く。

---

## アーキテクチャ概要

```
Webページ (content script)  ⇄  background.js (Service Worker)  ⇄  chrome.storage.local
        │
        └─ 拡張機能ページ（記録帳・単語詳細・設定）も同じbackground.jsに問い合わせる
```

以前はローカルのFastAPI + MySQLにデータを保存していたが、今は`chrome.storage.local`に置き換えている。content scriptはservice workerの中身に直接アクセスできないため、`chrome.runtime.sendMessage`で処理を依頼する形は変わっていない（以前はAPIプロキシ、今はデータ操作そのものを代行する）。

### 拡張機能（`extension/`）

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | 拡張機能の設定（権限・読み込むファイル一覧） |
| `background.js` | Service Worker。マーカーデータの読み書き／OpenAI呼び出し／記録帳タブの管理／タブ間の変更通知の中継 |
| `content/content.js` | 全content scriptで共有するグローバル状態・ユーティリティ（最初に読み込まれる） |
| `content/content.css` | ページ本文に挿入されるハイライト自体のスタイル |
| `content/panel-ui.css` | 拡張機能UI（サイドパネル等）のスタイル。Shadow DOM内でのみ読み込む |
| `modules/shadowHost.js` | 拡張機能UIをShadow DOMに隔離するための共通の入れ物を用意する |
| `modules/storage.js` | background.jsへの問い合わせ関数をまとめた層（content script側） |
| `modules/dataClient.js` | 同上。記録帳・詳細・設定など拡張機能ページ側で使う版 |
| `modules/dataStore.js` | `chrome.storage.local`の読み書き本体（background.js内でのみ使用） |
| `modules/aiService.js` | OpenAI APIの呼び出し（background.js内でのみ使用） |
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
- マーカーは`chrome.storage.local`に保存される（外部サーバー・DBは不要）
- ☰ボタンのサイドパネルにマーカー一覧（辞書）が表示される
- サイドパネルからマーカーを削除できる
- ページリロード後もマーカーが復元される
- **マーカー記録帳ページ**（`extension/ui/marker_book.html`）で、すべてのマーカーを一覧管理できる
  - 拡張機能アイコンのポップアップ、または☰サイドパネルの「📖 記録帳」ボタンから新しいタブで開く
  - ページ／色／期間／キーワードで絞り込み検索
  - 表示（AI解説・類似語・対義語・例文・メモをまとめて確認）
  - メモの追加・編集
  - 削除
- 拡張機能アイコンの「設定」からOpenAI APIキーを登録すると、マーカーのAI解説が生成できる（任意）

## 未実装

- 特になし（AI解説はAPIキーがあれば動作する）

## データ層について

以前バックエンドが持っていたpages/markers/ai_notes/marker_bookの4テーブルは、クライアントサイドでは結合クエリを書く必要が無いため、マーカー1件を「ページ情報・AI解説・メモ」まで含めたフラットな1レコードとして`chrome.storage.local`にまとめて保存している（`modules/dataStore.js`）。
