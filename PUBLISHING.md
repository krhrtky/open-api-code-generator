# Package Publishing Guide

OpenAPI Code Generatorのパッケージ公開手順と配布戦略についてのガイドです。

## 📦 パッケージ概要

### TypeScript Implementation
- **Package Name**: `@krhrtky/openapi-codegen-typescript`
- **Registry**: GitHub Packages (npm.pkg.github.com)
- **Current Version**: 1.0.0

### Rust Implementation
- **Package Name**: `openapi-codegen-rust`
- **Registry**: crates.io (計画中)
- **Current Version**: 1.0.0

## 🚀 公開手順

### 1. TypeScript Package (GitHub Packages)

#### 手動公開手順

**前提条件:**
```bash
# GitHub Personal Access Token (PAT) が必要
# Scope: write:packages, read:packages, repo
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> ~/.npmrc
```

**手動公開ステップ:**
```bash
# 1. TypeScript実装ディレクトリに移動
cd implementation/typescript

# 2. 依存関係インストール
npm install

# 3. ビルドとテスト実行
npm run build
npm run test
npm run typecheck

# 4. バージョン確認・更新
npm version patch  # または minor, major

# 5. パッケージ公開
npm publish --registry=https://npm.pkg.github.com

# 6. 公開確認
npm view @krhrtky/openapi-codegen-typescript --registry=https://npm.pkg.github.com
```

#### 自動公開 (GitHub Actions)

```yaml
# .github/workflows/publish-typescript.yml
name: Publish TypeScript Package

on:
  push:
    tags:
      - 'typescript-v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish'
        required: true
        type: string

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@krhrtky'
      
      - name: Install dependencies
        working-directory: implementation/typescript
        run: npm ci
      
      - name: Build and test
        working-directory: implementation/typescript
        run: |
          npm run build
          npm run test
          npm run typecheck
      
      - name: Publish to GitHub Packages
        working-directory: implementation/typescript
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Rust Package (crates.io)

#### 手動公開手順

**前提条件:**
```bash
# crates.io API token が必要
cargo login <your-crates-io-token>
```

**手動公開ステップ:**
```bash
# 1. Rust実装ディレクトリに移動
cd implementation/rust

# 2. ビルドとテスト実行
cargo build --release
cargo test

# 3. パッケージ内容確認
cargo package --list

# 4. 公開前チェック
cargo publish --dry-run

# 5. パッケージ公開
cargo publish

# 6. 公開確認
cargo search openapi-codegen-rust
```

#### 自動公開 (GitHub Actions)

```yaml
# .github/workflows/publish-rust.yml
name: Publish Rust Package

on:
  push:
    tags:
      - 'rust-v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish'
        required: true
        type: string

jobs:
  publish:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Build and test
        working-directory: implementation/rust
        run: |
          cargo build --release
          cargo test
      
      - name: Publish to crates.io
        working-directory: implementation/rust
        run: cargo publish
        env:
          CARGO_REGISTRY_TOKEN: ${{ secrets.CRATES_IO_TOKEN }}
```

## 📋 バージョニング戦略

### Semantic Versioning (SemVer)

このプロジェクトは[Semantic Versioning](https://semver.org/)に従います:

- **MAJOR.MINOR.PATCH** (例: 1.2.3)
- **MAJOR**: 非互換性のあるAPI変更
- **MINOR**: 後方互換性のある機能追加
- **PATCH**: 後方互換性のあるバグ修正

### バージョン管理の例

```bash
# パッチバージョン (バグ修正)
npm version patch    # 1.0.0 -> 1.0.1

# マイナーバージョン (新機能)
npm version minor    # 1.0.1 -> 1.1.0

# メジャーバージョン (破壊的変更)
npm version major    # 1.1.0 -> 2.0.0

# プレリリース
npm version prerelease --preid=alpha  # 1.1.0 -> 1.1.1-alpha.0
npm version prerelease --preid=beta   # 1.1.1-alpha.0 -> 1.1.1-beta.0
npm version prerelease --preid=rc     # 1.1.1-beta.0 -> 1.1.1-rc.0
```

### タグ戦略

```bash
# TypeScript実装のタグ
git tag typescript-v1.0.0
git tag typescript-v1.0.1

# Rust実装のタグ  
git tag rust-v1.0.0
git tag rust-v1.0.1
```

## 📥 インストール方法

### TypeScript Implementation

#### GitHub Packagesからのインストール

**1. .npmrc設定:**
```bash
# プロジェクトルートまたはホームディレクトリ
echo "@krhrtky:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc
```

**2. パッケージインストール:**
```bash
# npm使用
npm install @krhrtky/openapi-codegen-typescript

# yarn使用
yarn add @krhrtky/openapi-codegen-typescript

# pnpm使用
pnpm install @krhrtky/openapi-codegen-typescript
```

**3. 使用例:**
```javascript
// Node.js環境
const { OpenAPIParser, OpenAPICodeGenerator } = require('@krhrtky/openapi-codegen-typescript');

// ES Modules
import { OpenAPIParser, OpenAPICodeGenerator } from '@krhrtky/openapi-codegen-typescript';

// CLI使用
npx @krhrtky/openapi-codegen-typescript --input api.yaml --output ./generated
```

### Rust Implementation

#### crates.ioからのインストール

**1. Cargo.tomlに追加:**
```toml
[dependencies]
openapi-codegen-rust = "1.0.0"
```

**2. バイナリインストール:**
```bash
# グローバルインストール
cargo install openapi-codegen-rust

# 使用例
openapi-codegen --input api.yaml --output ./generated
```

**3. プログラムからの使用:**
```rust
use openapi_codegen_rust::{OpenAPIParser, OpenAPICodeGenerator};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let parser = OpenAPIParser::new();
    let spec = parser.parse_file("api.yaml")?;
    
    let generator = OpenAPICodeGenerator::new();
    generator.generate(&spec, "./generated")?;
    
    Ok(())
}
```

## 🛠️ 開発者インストール

### TypeScript開発環境

```bash
# 1. リポジトリクローン
git clone https://github.com/krhrtky/open-api-code-generator.git
cd open-api-code-generator

# 2. TypeScript実装のセットアップ
cd implementation/typescript
npm install
npm run build

# 3. グローバルリンク (開発用)
npm link

# 4. 他のプロジェクトでの使用
cd /path/to/your/project
npm link @krhrtky/openapi-codegen-typescript
```

### Rust開発環境

```bash
# 1. リポジトリクローン
git clone https://github.com/krhrtky/open-api-code-generator.git
cd open-api-code-generator

# 2. Rust実装のセットアップ
cd implementation/rust
cargo build --release

# 3. パスに追加 (開発用)
export PATH="$PWD/target/release:$PATH"

# 4. 他のプロジェクトでの使用
openapi-codegen --input /path/to/api.yaml --output ./generated
```

## 🐛 トラブルシューティング

### GitHub Packages関連

**問題: 認証エラー**
```bash
Error: 401 Unauthorized
```

**解決策:**
```bash
# GitHub Personal Access Token確認
echo $GITHUB_TOKEN

# .npmrc設定確認
cat ~/.npmrc | grep npm.pkg.github.com

# トークン再設定
echo "//npm.pkg.github.com/:_authToken=${NEW_GITHUB_TOKEN}" >> ~/.npmrc
```

**問題: スコープエラー**
```bash
Error: Package "@krhrtky/openapi-codegen-typescript" not found
```

**解決策:**
```bash
# スコープ設定追加
echo "@krhrtky:registry=https://npm.pkg.github.com" >> .npmrc

# または直接指定
npm install @krhrtky/openapi-codegen-typescript --registry=https://npm.pkg.github.com
```

### crates.io関連

**問題: 公開権限エラー**
```bash
Error: insufficient permissions
```

**解決策:**
```bash
# トークン確認
cargo login --list

# 新しいトークン設定
cargo login <new-token>

# パッケージ所有者確認
cargo owner --list openapi-codegen-rust
```

**問題: バージョン重複エラー**
```bash
Error: version already exists
```

**解決策:**
```bash
# Cargo.tomlでバージョン更新
sed -i 's/version = "1.0.0"/version = "1.0.1"/' Cargo.toml

# または手動編集
vim Cargo.toml
```

### 一般的な問題

**問題: ビルドエラー**
```bash
Error: Build failed
```

**解決策:**
```bash
# TypeScript
cd implementation/typescript
rm -rf node_modules dist
npm install
npm run build

# Rust  
cd implementation/rust
cargo clean
cargo build --release
```

**問題: テスト失敗**
```bash
Error: Tests failed
```

**解決策:**
```bash
# TypeScript
npm run test:coverage
npm run test:unit

# Rust
cargo test --verbose
cargo test --release
```

## 📊 公開チェックリスト

### 公開前チェック

#### TypeScript Implementation
- [ ] すべてのテストがパス (`npm test`)
- [ ] TypeScriptコンパイルが正常 (`npm run typecheck`)
- [ ] ビルドが正常完了 (`npm run build`)
- [ ] パッケージ内容確認 (`npm pack --dry-run`)
- [ ] バージョン番号確認 (`package.json`)
- [ ] README.md更新
- [ ] CHANGELOG.md更新

#### Rust Implementation
- [ ] すべてのテストがパス (`cargo test`)
- [ ] リリースビルドが正常 (`cargo build --release`)
- [ ] パッケージ内容確認 (`cargo package --list`)
- [ ] バージョン番号確認 (`Cargo.toml`)
- [ ] ドキュメント生成確認 (`cargo doc`)
- [ ] README.md更新
- [ ] CHANGELOG.md更新

### 公開後確認

#### TypeScript Implementation
- [ ] GitHub Packagesでパッケージ確認
- [ ] インストールテスト (`npm install @krhrtky/openapi-codegen-typescript`)
- [ ] CLI動作確認 (`npx @krhrtky/openapi-codegen-typescript --help`)
- [ ] プログラム利用テスト

#### Rust Implementation
- [ ] crates.ioでパッケージ確認
- [ ] インストールテスト (`cargo install openapi-codegen-rust`)
- [ ] CLI動作確認 (`openapi-codegen --help`)
- [ ] ライブラリ利用テスト

## 🔄 継続的インテグレーション

### 自動公開の設定

**GitHub Secrets設定:**
```bash
# TypeScript (GitHub Packages)
GITHUB_TOKEN: <GitHub Personal Access Token>

# Rust (crates.io)
CRATES_IO_TOKEN: <crates.io API Token>
```

**自動公開トリガー:**
- タグプッシュ時: `typescript-v*`, `rust-v*`
- 手動トリガー: workflow_dispatch
- スケジュール: 毎月第1金曜日 (オプション)

### バージョン管理自動化

**自動バージョンアップ例:**
```yaml
# .github/workflows/version-bump.yml
name: Auto Version Bump

on:
  push:
    branches: [main]
    paths:
      - 'implementation/**'

jobs:
  version-bump:
    if: "!contains(github.event.head_commit.message, '[skip version]')"
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Auto version bump
        run: |
          # TypeScript implementation
          cd implementation/typescript
          npm version patch
          
          # Git commit and tag
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add -A
          git commit -m "chore: auto version bump [skip ci]"
          git push origin main --tags
```

## 📈 公開統計とモニタリング

### パッケージ使用状況確認

**TypeScript (GitHub Packages):**
```bash
# ダウンロード統計 (GitHub APIを使用)
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user/packages/npm/%40krhrtky%2Fopenapi-codegen-typescript/stats
```

**Rust (crates.io):**
```bash
# crates.io統計確認
curl https://crates.io/api/v1/crates/openapi-codegen-rust/downloads
```

### モニタリングダッシュボード

公開後のパッケージ健全性をモニタリングするための指標:

- ダウンロード数
- 新しいバージョンのダウンロード率
- 問題レポート数
- セキュリティ脆弱性
- 依存関係の更新状況

---

この公開ガイドに従って、OpenAPI Code Generatorのパッケージを安全かつ効率的に配布できます。質問や問題がある場合は、プロジェクトのIssueを確認するか、新しいIssueを作成してください。