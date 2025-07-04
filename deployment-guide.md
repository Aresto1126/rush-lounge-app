# Rush Lounge 経営管理システム - デプロイメントガイド

## 🚀 リアルタイム共有機能

**自動連携**: システムは**常時共有機能**が有効です。従業員全員のデータが自動的に同期されます。

### 共有機能の特徴
- 🌐 **自動同期**: システムを開くだけでデータが即座に同期開始
- 👥 **全従業員対応**: Rush Lounge従業員全員でデータを共有
- 🔄 **リアルタイム更新**: 複数人が同時に操作してもリアルタイムで反映
- 💾 **自動バックアップ**: クラウドに自動的にデータが保存されます

### 使用方法
1. システムを開くと**自動的に共有機能が開始**されます
2. 他の従業員も同じリンクからアクセスするだけで自動連携
3. 特別な設定や操作は一切不要です

### 接続状態の確認
- ヘッダー部分に接続状態が表示されます
- **同期中**: 緑のドット + 「同期中」表示（正常動作）
- **接続中...**: 赤のドット + 「接続中...」表示（接続処理中）
- **接続中人数**: 現在作業している従業員数が表示されます

---

## 🌐 共有・デプロイ方法

### 方法1: ローカルファイル共有
**最も簡単な方法**

1. **ファイル構成**
   ```
   rush-lounge-app/
   ├── index.html
   ├── script.js
   ├── style.css
   └── README.md
   ```

2. **手順**
   - 上記4ファイルを同じフォルダに配置
   - フォルダを ZIP 圧縮
   - 他のプレイヤーに送信
   - 受け取った人は ZIP を解凍し、`index.html` をダブルクリック

3. **必要なもの**
   - モダンなWebブラウザ（Chrome、Edge、Firefox、Safari）
   - VSCode不要！

### 方法2: GitHub Pages（推奨）
**無料でWebサイトとして公開**

1. **GitHubアカウント作成**
   - https://github.com にアクセス
   - 無料アカウント作成

2. **リポジトリ作成**
   - 「New repository」をクリック
   - 名前: `rush-lounge-app`
   - Public を選択

3. **ファイルアップロード**
   - 「uploading an existing file」をクリック
   - 4つのファイルをドラッグ&ドロップ
   - 「Commit changes」をクリック

4. **GitHub Pages有効化**
   - Settings → Pages
   - Source: Deploy from a branch
   - Branch: main
   - Save

5. **URL取得**
   - `https://[ユーザー名].github.io/rush-lounge-app`
   - このURLを他のプレイヤーに共有

### 方法3: Netlify Drop
**最も簡単なホスティング**

1. **Netlify.com にアクセス**
   - https://netlify.com

2. **ファイルをドラッグ&ドロップ**
   - 4つのファイルを選択
   - Netlifyのページにドラッグ&ドロップ

3. **URL取得**
   - 自動的にランダムURLが生成
   - URLを他のプレイヤーに共有

### 方法4: Vercel
**プロ仕様のホスティング**

1. **Vercel.com にアクセス**
   - https://vercel.com

2. **GitHubと連携**
   - GitHubアカウントでサインイン
   - リポジトリを選択

3. **自動デプロイ**
   - Push時に自動更新
   - カスタムドメイン設定可能

## 🔧 データの注意事項

### 従業員専用システム
- **自動共有**: 全従業員のデータがリアルタイムで自動同期
- **クラウド保存**: Firebase Realtime Databaseで安全に管理
- **ローカルバックアップ**: 各ブラウザにも自動でバックアップ保存

### データの安全性
- **自動保存**: 入力と同時にクラウドに保存
- **複数人同時作業**: 安全にマージされ、データ消失なし
- **オフライン対応**: 一時的にネットが切れても使用可能

## 📱 対応ブラウザ

### 推奨ブラウザ
- ✅ Google Chrome
- ✅ Microsoft Edge
- ✅ Mozilla Firefox
- ✅ Safari

### 動作要件
- モダンなWebブラウザ
- JavaScript有効
- LocalStorage対応

## 🚀 推奨デプロイ方法

**初心者向け**: Netlify Drop
**継続運用**: GitHub Pages
**ローカル使用**: ZIPファイル共有

## 📞 サポート

共有やデプロイでお困りの場合は、この手順に従って設定してください。各方法とも無料で利用できます。 