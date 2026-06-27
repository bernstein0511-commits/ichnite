## セットアップ

### 必要なもの
- Docker Desktop
- OpenAI APIキー（有料プラン）

### 手順

**1. リポジトリをクローン**
```bash
git clone <リポジトリURL>
cd ichnite
```

**2. `.env` ファイルを作成**

`backend/api/.env.example` をコピーして `.env` を作成する

```bash
cp backend/api/.env.example backend/api/.env
```

`.env` を開いて以下を設定する
DB_HOST=mysql

DB_PORT=3306

DB_NAME=ichnite

DB_USER=root

DB_PASSWORD=root

OPENAI_API_KEY=sk-proj-xxxxxxxx  ← 自分のキーを入力

**3. 起動**
```bash
docker compose up --build
```

**4. 確認**

`http://localhost:8000/docs` が開けばOK

---

## Chrome拡張機能の読み込み

**通常のページでAPIに接続するには、Chromeをセキュリティオプション付きで起動する必要があります（開発環境のみ）**

1. Chromeを完全に閉じる
2. PowerShellで以下を実行する

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-web-security --disable-features=PrivateNetworkAccessChecks --user-data-dir="C:\tmp\chrome-dev"
```

3. 起動したChromeで `chrome://extensions` を開く
4. 右上の「デベロッパーモード」をオン
5. 「パッケージ化されていない拡張機能を読み込む」をクリック
6. `extension` フォルダを選択

---

## 現在の機能

- テキストを選択してカラーボタンでマーカーを引ける
- マーカーはMySQLにAPI経由で保存される
- ☰ボタンのサイドパネルにマーカー一覧（辞書）が表示される
- サイドパネルからマーカーを削除できる
- ページリロード後もマーカーが復元される

## 未実装

- AI解説の吹き出し表示（OpenAIクレジット要）
- 辞書パネルのCSS