<<<<<<< HEAD
"# ichnite" 
"sobue kouki"
"kawakami joi"
=======
# ichnite

読解の足跡を残すマーカーツール（Chrome拡張機能 + FastAPI + MySQL）

## セットアップ

### 必要なもの
- Docker Desktop

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

**3. 起動**
```bash
docker compose up --build
```

**4. 確認**

`http://localhost:8000/docs` が開けばOK

---

## Chrome拡張機能の読み込み

1. Chromeで `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `extension` フォルダを選択

---

## 構成

```
ichnite/
├── backend/
│   └── api/          # FastAPI
├── extension/        # Chrome拡張機能
└── docker-compose.yaml
```
>>>>>>> origin/main
