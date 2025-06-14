# TypeScript実装 - ビルドガイド

## 概要

TypeScript実装は豊富なエコシステムと開発者親和性を重視した OpenAPI Code Generator の実装です。npm の豊富なライブラリ群と馴染みやすい構文により、迅速な開発とカスタマイズが可能です。

## 特徴

- **実行速度**: ~1.0秒（良好）
- **メモリ使用量**: ~45MB（適度）
- **エコシステム**: npm の豊富なライブラリ
- **適用場面**: 開発チーム、プロトタイピング、Node.js環境統合

## 前提条件

- Node.js 16.0以上  
- npm または yarn パッケージマネージャー
- TypeScript 5.3以上（devDependencies に含まれる）

## ディレクトリ構造

```
implementation/typescript/
├── package.json           # プロジェクト設定・依存関係・スクリプト
├── tsconfig.json         # TypeScript コンパイル設定
├── jest.config.js        # テスト設定
├── dist/                 # ビルド出力（生成される）
├── locales/              # 多言語対応ファイル
│   ├── en.json
│   └── ja.json
└── src/
    ├── index.ts          # メインエントリーポイント
    ├── generator.ts      # コード生成ロジック
    ├── parser.ts         # OpenAPI仕様解析
    ├── types.ts          # 型定義
    ├── i18n.ts           # 国際化対応
    └── test-output/      # テスト用出力
```

## ビルド方法

### 1. 依存関係のインストール

```bash
cd implementation/typescript/
npm install
```

**インストールされる主要パッケージ:**
- `commander`: CLI引数解析
- `yaml`: YAML処理
- `fs-extra`: ファイルシステム操作
- `chalk`: コンソール出力装飾
- `i18next`: 国際化対応
- `typescript`: TypeScript コンパイラ
- `jest`: テストフレームワーク

### 2. TypeScript ビルド

```bash
# 標準ビルド
npm run build

# または直接 TypeScript コンパイラを使用
npx tsc
```

**ビルド処理:**
- `src/` ディレクトリの `.ts` ファイルを JavaScript にコンパイル
- `dist/` ディレクトリに出力
- ソースマップ生成（`.map` ファイル）
- 型定義ファイル生成（`.d.ts` ファイル）

### 3. クリーンビルド

```bash
# ビルド成果物を削除してから再ビルド
npm run clean
npm run build
```

### 4. 開発モード（TypeScript 直接実行）

```bash
# ts-node を使用して TypeScript を直接実行
npm run dev -- --input ../../examples/sample-api.yaml --output ./generated --package com.example.api
```

## 使用方法

### 基本的な使用方法

```bash
# 1. ビルド
npm run build

# 2. 実行
npm start -- --input path/to/api-spec.yaml --output ./generated --package com.example.api

# または Node.js で直接実行
node dist/index.js --input path/to/api-spec.yaml --output ./generated --package com.example.api
```

### コマンドラインオプション

| オプション | 必須 | 説明 | 例 |
|------------|------|------|-----|
| `--input` | ✅ | OpenAPI仕様ファイルのパス | `--input api-spec.yaml` |
| `--output` | ✅ | 出力ディレクトリのパス | `--output ./generated` |
| `--package` | ✅ | 生成するKotlinパッケージ名 | `--package com.example.api` |
| `--verbose` | ❌ | 詳細ログ出力 | `--verbose` |
| `--lang` | ❌ | 出力言語（多言語対応） | `--lang ja` |

### 実用例

```bash
# 1. サンプルAPI仕様からコード生成
npm run build
node dist/index.js \
  --input ../../examples/sample-api.yaml \
  --output ./sample-generated \
  --package com.example.userapi \
  --verbose

# 2. 日本語ログでコード生成
node dist/index.js \
  --input /path/to/api-spec.yaml \
  --output ./generated \
  --package com.company.api \
  --lang ja \
  --verbose

# 3. 開発モード（ビルド不要）
npm run dev -- \
  --input ../../examples/sample-api.yaml \
  --output ./dev-generated \
  --package com.example.api
```

## パッケージスクリプト詳細

### package.json のスクリプト

```json
{
  "scripts": {
    "build": "tsc",              # TypeScript ビルド
    "start": "node dist/index.js", # ビルド済みバイナリ実行
    "dev": "ts-node src/index.ts",  # 開発モード（直接実行）
    "test": "jest",              # テスト実行
    "clean": "rimraf dist"       # ビルド成果物削除
  }
}
```

### 各スクリプトの用途

#### `npm run build`
- TypeScript ソースを JavaScript にコンパイル
- `dist/` ディレクトリに出力
- 型定義ファイル（`.d.ts`）も生成
- 本番環境向けビルド

#### `npm start`
- ビルド済みの JavaScript を実行
- 高速起動（コンパイル済み）
- 本番環境での使用に適している

#### `npm run dev`
- TypeScript を直接実行（ts-node使用）
- ビルド工程を省略
- 開発時の迅速なテストに適している

#### `npm test`
- Jest テストフレームワークでテスト実行
- テストカバレッジレポート生成
- CI/CD パイプラインでの品質保証

#### `npm run clean`
- `dist/` ディレクトリを削除
- クリーンビルドの前処理

## TypeScript設定の詳細

### tsconfig.json の設定

```json
{
  "compilerOptions": {
    "target": "ES2020",                    # ES2020 にコンパイル
    "module": "commonjs",                  # CommonJS モジュール形式
    "lib": ["ES2020"],                     # ES2020 ライブラリを使用
    "outDir": "./dist",                    # 出力ディレクトリ
    "rootDir": "./src",                    # ソースディレクトリ
    "strict": true,                        # 厳密型チェック有効
    "esModuleInterop": true,               # ES モジュール互換性
    "skipLibCheck": true,                  # ライブラリ型チェック省略
    "forceConsistentCasingInFileNames": true, # ファイル名大文字小文字厳密
    "declaration": true,                   # 型定義ファイル生成
    "sourceMap": true,                     # ソースマップ生成
    "resolveJsonModule": true              # JSON モジュール解決
  }
}
```

### Jest テスト設定

```javascript
module.exports = {
  preset: 'ts-jest',                    # TypeScript 用プリセット
  testEnvironment: 'node',              # Node.js テスト環境
  roots: ['<rootDir>/src'],             # テストルートディレクトリ
  testMatch: [                          # テストファイルパターン
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\.ts$': 'ts-jest'              # TypeScript 変換設定
  },
  coverageDirectory: 'coverage',        # カバレッジ出力ディレクトリ
  collectCoverageFrom: [                # カバレッジ対象
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  verbose: true                         # 詳細テスト結果表示
};
```

## 多言語対応（i18n）

### 対応言語

```
locales/
├── en.json    # 英語
└── ja.json    # 日本語
```

### 使用例

```bash
# 英語でログ出力
node dist/index.js --input api.yaml --output ./generated --package com.example --lang en

# 日本語でログ出力
node dist/index.js --input api.yaml --output ./generated --package com.example --lang ja
```

### 多言語メッセージ例

```json
// locales/en.json
{
  "generation": {
    "start": "Starting code generation...",
    "complete": "Code generation completed successfully!",
    "error": "Error occurred during generation: {{error}}"
  }
}

// locales/ja.json
{
  "generation": {
    "start": "コード生成を開始します...",
    "complete": "コード生成が正常に完了しました！",
    "error": "生成中にエラーが発生しました: {{error}}"
  }
}
```

## 生成されるファイル

実行後、指定した出力ディレクトリに以下のファイルが生成されます：

```
generated/
├── build.gradle.kts                    # Spring Boot プロジェクト設定
└── src/main/kotlin/com/example/api/
    ├── controller/
    │   ├── UserController.kt           # ユーザー操作API
    │   └── ProfileController.kt        # プロファイル操作API
    └── model/
        ├── User.kt                     # ユーザーエンティティ
        ├── CreateUserRequest.kt        # ユーザー作成リクエスト
        ├── UpdateUserRequest.kt        # ユーザー更新リクエスト
        ├── UserProfile.kt              # ユーザープロファイル
        ├── UpdateProfileRequest.kt     # プロファイル更新リクエスト
        ├── PaginationInfo.kt           # ページネーション情報
        └── ErrorResponse.kt            # エラーレスポンス
```

## 生成されるコードの例

### Controller例

```kotlin
@RestController
@RequestMapping("/api/v1")
@Validated
interface UserController {

    @Operation(summary = "ユーザー一覧取得", description = "ページネーション機能付きでユーザー一覧を取得します")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "ユーザー一覧の取得に成功"),
        ApiResponse(responseCode = "400", description = "リクエストパラメータが無効")
    ])
    @GetMapping("/users")
    fun getUsers(
        @Parameter(description = "ページ番号（0ベース）")
        @RequestParam(required = false) page: Int?,
        @Parameter(description = "1ページあたりのアイテム数")
        @RequestParam(required = false) size: Int?,
        @Parameter(description = "ユーザー検索用フィルター文字列")
        @RequestParam(required = false) filter: String?
    ): ResponseEntity<Any>

    @Operation(summary = "新規ユーザー作成")
    @PostMapping("/users")
    fun createUser(
        @Valid @RequestBody body: CreateUserRequest
    ): ResponseEntity<User>
}
```

### Model例

```kotlin
@Schema(description = "登録済みユーザーを表すユーザーエンティティ")
data class User(
    @Schema(description = "ユーザーの一意識別子")
    @NotNull
    val id: Long,
    
    @Schema(description = "ユーザーのメールアドレス")
    @NotNull
    @Email
    val email: String,
    
    @NotNull
    @Size(min = 1, max = 50)
    val firstName: String,
    
    @NotNull
    @Size(min = 1, max = 50)
    val lastName: String,
    
    @Schema(description = "ユーザー作成タイムスタンプ")
    val createdAt: Instant?,
    
    @Schema(description = "最終更新タイムスタンプ")
    val updatedAt: Instant?
)
```

## パフォーマンス特性

### ベンチマーク結果

| 指標 | 値 | 比較 |
|------|-----|------|
| 実行時間 | ~1.0秒 | 🥉 良好 |
| メモリ使用量 | ~45MB | 🥉 適度 |
| 起動時間 | ~0.3秒 | 🥈 高速 |
| エコシステム | 🥇 最豊富 | npm の豊富なライブラリ |

### 適用場面

**最適:**
- 開発チームでの使用（馴染みやすい構文）
- プロトタイピング（迅速な開発）
- Node.js環境との統合
- カスタマイズが必要なケース

**推奨シナリオ:**
- チーム開発での生産性重視
- 既存Node.js プロジェクトとの統合
- npm エコシステムの活用が必要
- 多言語対応が必要なケース

## テストの実行

### 単体テスト

```bash
# 全テスト実行
npm test

# テストカバレッジ付き実行
npm test -- --coverage

# 特定のテストファイル実行
npm test -- parser.test.ts

# ウォッチモード（ファイル変更時自動実行）
npm test -- --watch
```

### テスト例

```typescript
// src/__tests__/parser.test.ts
import { OpenApiParser } from '../parser';

describe('OpenApiParser', () => {
  test('should parse valid OpenAPI spec', () => {
    const parser = new OpenApiParser();
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {}
    };
    
    expect(() => parser.parse(spec)).not.toThrow();
  });

  test('should throw error for invalid spec', () => {
    const parser = new OpenApiParser();
    const invalidSpec = { invalid: 'spec' };
    
    expect(() => parser.parse(invalidSpec)).toThrow();
  });
});
```

## トラブルシューティング

### よくある問題

#### 1. Node.js バージョンが古い

```bash
# Node.js バージョン確認
node --version

# Node.js 16以上が必要
# nvm を使用してアップグレード
nvm install 16
nvm use 16
```

#### 2. npm install エラー

```bash
# npm キャッシュクリア
npm cache clean --force

# node_modules 削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

#### 3. TypeScript コンパイルエラー

```bash
# TypeScript バージョン確認
npx tsc --version

# 型定義ファイルの更新
npm update @types/node

# 厳密型チェックを一時的に無効化
# tsconfig.json で "strict": false
```

#### 4. メモリ不足エラー

```bash
# Node.js のメモリ制限を増加
node --max-old-space-size=4096 dist/index.js --input large-api.yaml --output ./generated --package com.example
```

### デバッグ方法

#### 1. 詳細ログ出力

```bash
# デバッグレベルログ
DEBUG=* node dist/index.js --input api.yaml --output ./generated --package com.example --verbose
```

#### 2. TypeScript デバッガ使用

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug TypeScript",
      "program": "${workspaceFolder}/src/index.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["--input", "examples/sample-api.yaml", "--output", "./debug-generated", "--package", "com.debug"]
    }
  ]
}
```

## 依存関係の詳細

### 本番環境依存関係

```json
{
  "dependencies": {
    "commander": "^11.1.0",        # CLI フレームワーク
    "yaml": "^2.3.4",              # YAML パーサー
    "fs-extra": "^11.1.1",         # ファイルシステム操作拡張
    "chalk": "^4.1.2",             # コンソール出力装飾
    "i18next": "^23.7.6",          # 国際化フレームワーク
    "i18next-fs-backend": "^2.3.1" # ファイルシステムバックエンド
  }
}
```

### 開発環境依存関係

```json
{
  "devDependencies": {
    "@types/node": "^20.10.0",              # Node.js 型定義
    "@types/fs-extra": "^11.0.4",           # fs-extra 型定義
    "@typescript-eslint/eslint-plugin": "^6.13.0", # TypeScript ESLint プラグイン
    "@typescript-eslint/parser": "^6.13.0", # TypeScript ESLint パーサー
    "eslint": "^8.54.0",                    # JavaScript/TypeScript リンター
    "jest": "^29.7.0",                      # テストフレームワーク
    "rimraf": "^5.0.5",                     # クロスプラットフォーム rm -rf
    "ts-jest": "^29.1.1",                   # Jest TypeScript サポート
    "ts-node": "^10.9.1",                   # TypeScript 直接実行
    "typescript": "^5.3.2"                  # TypeScript コンパイラ
  }
}
```

## CI/CD 統合

### GitHub Actions 例

```yaml
name: TypeScript Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16, 18, 20]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
        cache-dependency-path: typescript/package-lock.json
    
    - name: Install dependencies
      working-directory: ./typescript
      run: npm ci
    
    - name: Run tests
      working-directory: ./typescript
      run: npm test -- --coverage
    
    - name: Build
      working-directory: ./typescript
      run: npm run build
    
    - name: Test code generation
      working-directory: ./typescript
      run: |
        node dist/index.js \
          --input ../examples/sample-api.yaml \
          --output ./ci-generated \
          --package com.ci.test \
          --verbose
```

## 最適化のヒント

### 1. ビルド時間短縮

```bash
# 型チェックを並行実行
npm install --save-dev fork-ts-checker-webpack-plugin

# incremental コンパイル有効化（tsconfig.json）
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  }
}
```

### 2. 実行時パフォーマンス向上

```bash
# Node.js の JIT コンパイル最適化
node --optimize-for-size dist/index.js

# メモリ使用量最適化
node --max-old-space-size=512 dist/index.js
```

### 3. バンドルサイズ最適化

```bash
# webpack などのバンドラーを使用してサイズ最適化
npm install --save-dev webpack webpack-cli
```

## まとめ

TypeScript実装は豊富なnpmエコシステムと開発者親和性により、チーム開発やプロトタイピングに最適です。多言語対応やテスト機能も充実しており、カスタマイズが必要なプロジェクトや既存のNode.js環境との統合において威力を発揮します。馴染みやすい構文により、開発チームの生産性向上に貢献します。