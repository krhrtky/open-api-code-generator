# Context Memories - プロジェクト固有のVibe記録

## 概要

このファイルは、各プロジェクトでのvibe codingの経験と学習を記録し、将来の開発に活かすためのメモリーファイルです。

## 記録フォーマット

### プロジェクト情報
```markdown
## [プロジェクト名] - [開始日]

### 技術スタック
- Language: 
- Framework: 
- Database: 
- Architecture: 

### チーム構成
- 人数: 
- 経験レベル: 
- 開発期間: 
```

### パターン適用記録
```markdown
### 適用したVibeパターン
- [x] Entity Pattern
- [x] Service Pattern 
- [ ] API Pattern
- [x] Test Pattern

### 効果的だったパターン
1. **パターン名**: 具体的な効果
2. **パターン名**: 具体的な効果

### 改善が必要だったパターン
1. **パターン名**: 問題点と改善案
```

### 学習記録
```markdown
### 新しい発見
- 発見内容とその背景

### 失敗からの学び
- 失敗内容と原因分析、改善策

### チームからのフィードバック
- フィードバック内容と対応
```

---

## サンプルプロジェクト記録

## E-commerce API - 2024/01

### 技術スタック
- Language: TypeScript
- Framework: Express.js
- Database: PostgreSQL
- Architecture: DDD + Clean Architecture

### チーム構成
- 人数: 4名
- 経験レベル: シニア2名、ミドル2名
- 開発期間: 3ヶ月

### 適用したVibeパターン
- [x] Entity Pattern
- [x] Service Pattern 
- [x] API Pattern
- [x] Test Pattern

### 効果的だったパターン
1. **Entity Pattern**: 
   - Value Objectsによる型安全性向上
   - ファクトリメソッドによる生成時バリデーション
   - イミュータブル設計によるバグ削減

2. **Service Pattern**:
   - Fluent Interfaceによる可読性向上
   - Result型によるエラーハンドリング統一
   - 依存性注入による テスタビリティ向上

3. **Test Pattern**:
   - Given-When-Then構造による仕様の明確化
   - TestBuilderパターンによるテストデータ作成効率化
   - MockBuilderによる自然なモック記述

### 改善が必要だったパターン
1. **API Pattern**: 
   - 問題: バリデーションスキーマの重複
   - 改善案: 共通バリデーションライブラリの作成

### 新しい発見
- Result型とOption型の組み合わせによる堅牢なエラーハンドリング
- Pipeline パターンによる複雑な処理の分解
- Property-based testingによる仕様の検証

### 失敗からの学び
- 初期段階でのパターン統一不足により後半でリファクタリングが発生
- → 早期にコーディング規約とパターン適用ガイドラインを策定すべき

### チームからのフィードバック
- 「コードが読みやすくなった」（ミドルレベル開発者）
- 「テストが書きやすい」（全員）
- 「新しいパターンの学習コストが初期にあった」（ミドルレベル開発者）

### パフォーマンス指標
- 開発速度: 2週目以降、従来比20%向上
- バグ発生率: 従来比40%削減
- コードレビュー時間: 従来比30%削減

---

## React Dashboard - 2024/02

### 技術スタック
- Language: TypeScript
- Framework: React + Vite
- State Management: Zustand
- Architecture: Component-based + Custom Hooks

### チーム構成
- 人数: 2名
- 経験レベル: シニア1名、ジュニア1名
- 開発期間: 6週間

### 適用したVibeパターン
- [ ] Entity Pattern (フロントエンドでは未使用)
- [x] Service Pattern (API呼び出し層で使用)
- [ ] API Pattern (バックエンド側で対応)
- [x] Test Pattern

### 効果的だったパターン
1. **Custom Hooks Pattern**:
   - データフェッチングロジックの再利用
   - 状態管理の抽象化
   - テストしやすい設計

2. **Builder Pattern for Component Testing**:
   - コンポーネントの props 設定が直感的
   - テストケースの可読性向上

### 新しい発見
- Vibe patterns をフロントエンドに適用する際の最適化
- React の宣言的UIとvibe codingの親和性
- Storybook との組み合わせによる設計パターンの可視化

### フロントエンド固有の工夫
```typescript
// Custom Hook with Vibe Pattern
const useUserData = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => UserService.create(api).findById(userId).execute(),
    select: (result) => result.isOk() ? result.unwrap() : null
  });
};

// Component Builder for Testing  
const UserCardBuilder = {
  create: () => ({
    user: createTestUser(),
    loading: false,
    error: null
  }),
  withLoading: (props) => ({ ...props, loading: true }),
  withError: (props, error) => ({ ...props, error })
};
```

---

## CLI Tool - 2024/03

### 技術スタック
- Language: Node.js (TypeScript)
- Framework: Commander.js
- Architecture: Command Pattern

### 適用したVibeパターン
- [x] Command Pattern (CLI操作)
- [x] Builder Pattern (コマンドオプション)
- [x] Result Pattern (エラーハンドリング)

### 効果的だったパターン
1. **Command Builder Pattern**:
```typescript
const deployCommand = CommandBuilder
  .create('deploy')
  .description('Deploy application')
  .option('-e, --env <environment>', 'Target environment')
  .option('-f, --force', 'Force deployment')
  .handler(async (options) => {
    const result = await DeployService
      .create(dependencies)
      .setEnvironment(options.env)
      .setForceMode(options.force)
      .execute();
      
    return result.match({
      ok: () => console.log('✅ Deployment successful'),
      err: (error) => console.error('❌ Deployment failed:', error.message)
    });
  })
  .build();
```

### CLI固有の発見
- 段階的な処理表示とvibe patternの組み合わせ
- エラーメッセージの一貫性による UX 向上
- コマンドライン引数の型安全な処理

---

## 共通学習項目

### 型安全性の追求
- Result型、Option型の活用によるnullエラー撲滅
- 厳密な型定義による実行時エラー削減
- ジェネリクスを活用した再利用可能なパターン

### パフォーマンス最適化
- 遅延評価(Lazy Evaluation)の効果的な活用
- メモ化による重複計算の回避
- 非同期処理の適切な制御

### チーム開発での知見
- パターン導入時の段階的アプローチの重要性
- ペアプログラミングによるパターン共有
- コードレビューでのパターン統一

### 継続的改善
- パターンの定期的な見直し
- プロジェクト振り返りでの改善点抽出
- 新しいパターンの実験と評価

---

## Next Actions

### 今後試したいパターン
1. **Event Sourcing Pattern**: 状態変更の履歴管理
2. **CQRS Pattern**: 読み取りと書き込みの分離
3. **Saga Pattern**: 分散システムでの整合性管理

### 改善したい領域
1. **非同期処理**: より直感的なパターンの確立
2. **エラーハンドリング**: 詳細なエラー情報の伝達
3. **パフォーマンス**: リアルタイム処理での最適化

### 学習予定
1. 関数型プログラミングの深化
2. ドメイン駆動設計の実践的適用
3. マイクロサービスアーキテクチャでのパターン適用

---

## テンプレート

### 新しいプロジェクト記録用テンプレート
```markdown
## [プロジェクト名] - [開始日]

### 技術スタック
- Language: 
- Framework: 
- Database: 
- Architecture: 

### チーム構成
- 人数: 
- 経験レベル: 
- 開発期間: 

### 適用したVibeパターン
- [ ] Entity Pattern
- [ ] Service Pattern 
- [ ] API Pattern
- [ ] Test Pattern

### 効果的だったパターン
1. **パターン名**: 

### 改善が必要だったパターン
1. **パターン名**: 

### 新しい発見

### 失敗からの学び

### チームからのフィードバック

### パフォーマンス指標
- 開発速度: 
- バグ発生率: 
- コードレビュー時間: 
```