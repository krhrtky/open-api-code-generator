# Quick Patterns - Vibe Coding Templates

このディレクトリには、vibe coding を実践するためのコードテンプレートが含まれています。

## テンプレート一覧

### 1. Entity Pattern (`entity.ts`)
ドメインエンティティの実装パターン

**特徴:**
- イミュータブルな設計
- ファクトリメソッドによる作成
- ビジネスロジックの純粋関数化
- バリデーション組み込み

**使用例:**
```typescript
const user = User.create(id, email, name)
  .activate()
  .updateProfile(newProfile);
```

### 2. Service Pattern (`service.ts`)
サービス層の実装パターン

**特徴:**
- Fluent Interface による連鎖的な操作
- Result型による型安全なエラーハンドリング
- 依存性注入対応
- クエリビルダー内蔵

**使用例:**
```typescript
const result = await UserService.create(deps)
  .findById(id)
  .filter(user => user.isActive)
  .execute();
```

### 3. Test Pattern (`test.ts`)
テストコードの実装パターン

**特徴:**
- Given-When-Then構造
- テストビルダーパターン
- モックの自然な記述
- プロパティベーステスト対応

**使用例:**
```typescript
await new TestScenario()
  .given('valid user data', setupValidUser)
  .when('creating user', createUser)
  .then('user is saved', verifyUserSaved)
  .run();
```

### 4. API Pattern (`api.ts`)
RESTful APIの実装パターン

**特徴:**
- 型安全なリクエスト/レスポンス
- バリデーション組み込み
- 認証・認可対応
- OpenAPI仕様自動生成

**使用例:**
```typescript
const router = UserApi.routes(dependencies);
app.use('/api', router);
```

## 使用方法

### 1. テンプレートのコピー
```bash
cp .claude/quick-patterns/entity.ts src/domain/MyEntity.ts
```

### 2. プレースホルダーの置換
以下のプレースホルダーを実際の値に置換：

- `${EntityName}` → 実際のエンティティ名 (例: `User`)
- `${ServiceName}` → 実際のサービス名 (例: `User`)
- `${FeatureName}` → 実際の機能名 (例: `UserManagement`)
- `PropertyType` → 実際のプロパティ型
- その他の型定義

### 3. IDE設定（推奨）

#### VS Code Snippets
`.vscode/snippets.code-snippets` に以下を追加：

```json
{
  "Vibe Entity": {
    "prefix": "vibe-entity",
    "body": "// コピーしたentity.tsの内容",
    "description": "Create a vibe-style entity"
  }
}
```

#### WebStorm Live Templates
Settings → Editor → Live Templates で新しいテンプレートを作成

## カスタマイズ

### 1. プロジェクト固有のパターン追加
```bash
# 新しいパターンを追加
touch .claude/quick-patterns/custom-pattern.ts
```

### 2. テンプレート変数の設定
`.claude/vibe-config.json` の `templates` セクションで設定

### 3. 自動置換スクリプト
```bash
#!/bin/bash
# template-generator.sh
ENTITY_NAME=$1
TEMPLATE_FILE=$2

sed "s/\${EntityName}/$ENTITY_NAME/g" $TEMPLATE_FILE
```

## 統合例

### プロジェクト作成時の自動セットアップ
```typescript
// create-feature.ts
import { generateFromTemplate } from './template-generator';

async function createFeature(featureName: string) {
  const files = [
    'entity.ts',
    'service.ts', 
    'api.ts',
    'test.ts'
  ];

  for (const file of files) {
    await generateFromTemplate(file, {
      EntityName: featureName,
      ServiceName: featureName,
      FeatureName: featureName
    });
  }
}
```

### CI/CDでの活用
```yaml
# .github/workflows/code-quality.yml
- name: Check Vibe Patterns
  run: |
    # パターンに従っているかチェック
    npm run vibe-lint
```

## ベストプラクティス

### 1. パターンの選択指針
- **Entity**: ドメインオブジェクトの場合
- **Service**: ビジネスロジックの場合
- **API**: HTTP エンドポイントの場合
- **Test**: テストコードの場合

### 2. 命名規則
- ファイル名: `kebab-case`
- クラス名: `PascalCase`
- メソッド名: `camelCase`
- 定数: `SCREAMING_SNAKE_CASE`

### 3. 段階的適用
1. まず1つのパターンから始める
2. チーム内でレビュー
3. 段階的に他のパターンを導入

### 4. ドキュメント保守
- パターン変更時はREADMEも更新
- 使用例を常に最新に保つ
- チーム内でのナレッジ共有

## トラブルシューティング

### よくある問題

1. **型エラー**
   - プレースホルダーの置換漏れを確認
   - 依存関係のimport確認

2. **テストが通らない**
   - モックの設定確認
   - 非同期処理の待機確認

3. **パフォーマンス問題**
   - 不要な処理の削除
   - 遅延評価の活用

### サポート
- プロジェクト固有の課題: チーム内で相談
- パターン自体の改善: `.claude/context-memories.md` に記録