# 🤖 自律開発システム

完全自律でプロジェクトを継続的に発展させるシステム。引数に基づいてタスクを実行・監視・管理します。

**使用法**: `/auto <action> [options]`

---

## 📋 利用可能なアクション

### `/auto start [options]`
自律実行システムを開始します。

**引数**:
- `--interval=<minutes>`: サイクル間隔（デフォルト: 30分）
- `--max-wait=<hours>`: CI最大待機時間（デフォルト: 2時間）
- `--dry-run`: 実際の変更なしでシミュレーション実行
- `--verbose`: 詳細ログ出力

**実行例**:
```
/auto start
/auto start --interval=15 --dry-run
/auto start --max-wait=1h --verbose
```

**動作内容**:
1. GitHub API接続確認
2. プロジェクト設定読み込み
3. 初回プロジェクト分析実行
4. 自律実行サイクル開始
5. 定期的なPR監視とISSUE実行

### `/auto status [options]`
現在の実行状況を表示します。

**引数**:
- `--detailed`: 詳細情報表示
- `--logs`: 最近のログ表示
- `--metrics`: パフォーマンスメトリクス表示

**実行例**:
```
/auto status
/auto status --detailed
/auto status --metrics
```

### `/auto cycle [options]`
手動でサイクルを実行します。

**引数**:
- `--issue-id=<number>`: 特定ISSUE強制実行
- `--pr-only`: PR監視のみ実行
- `--create-only`: ISSUE生成のみ実行
- `--dry-run`: シミュレーション実行

**実行例**:
```
/auto cycle
/auto cycle --issue-id=123
/auto cycle --pr-only
/auto cycle --dry-run
```

### `/auto stop [options]`
自律システムを停止します。

**引数**:
- `--force`: 即座停止（実行中タスクも中断）
- `--save-state`: 状態保存して中断再開可能に

**実行例**:
```
/auto stop
/auto stop --force
```

### `/auto config <action> [key] [value]`
設定の表示・変更を行います。

**引数**:
- `show`: 全設定表示
- `get <key>`: 特定設定値取得
- `set <key> <value>`: 設定値変更
- `reset`: デフォルト設定にリセット

**実行例**:
```
/auto config show
/auto config get cycle_interval_minutes
/auto config set max_concurrent_prs 5
/auto config reset
```

### `/auto logs [options]`
ログとメトリクスを確認します。

**引数**:
- `--last=<time>`: 期間指定（例: 24h, 7d）
- `--level=<level>`: ログレベル（debug|info|warn|error）
- `--filter=<type>`: フィルター（error, ci_failure等）
- `--export=<format>`: エクスポート形式（json, csv）

**実行例**:
```
/auto logs --last=24h
/auto logs --filter=error
/auto logs --export=json
```

---

## 🎯 実行内容詳細

引数 `$ARGUMENTS` に基づいて以下を実行:

### 引数解析とバリデーション
1. アクション (`start`、`status`、`cycle`、`stop`、`config`、`logs`) の特定
2. オプション引数の解析とバリデーション
3. 不正な引数の場合はヘルプ表示

### アクション別実行フロー

**START実行時**:
1. 前提条件チェック（GitHub API、権限、CI/CD設定）
2. 設定ファイル読み込み・初期化
3. プロジェクト分析実行
4. 自律実行サイクル開始
5. 監視スレッド起動

**CYCLE実行時**:
1. 現在のPR状況確認・CI/CDステータスチェック
2. 完了PR処理（マージ、クリーンアップ）
3. 次ISSUE検索・実行可能性スコア計算
4. ISSUE実行 OR 自動生成
5. オーケストレーター実行
6. PR作成・監視登録

**STATUS実行時**:
1. 実行状態ファイル読み込み
2. 監視中PR状況取得
3. パフォーマンスメトリクス計算
4. 整形して表示

**CONFIG実行時**:
1. 設定ファイル操作（表示・変更・リセット）
2. 設定値バリデーション
3. 実行中システムへの設定反映

### エラーハンドリング
- 不正な引数: ヘルプ表示して終了
- API接続エラー: 再試行後にエラー報告
- 実行権限不足: 権限要求ガイド表示
- 設定ファイル破損: バックアップからの復元提案

---

## 📊 自律実行サイクル詳細

### Phase 1: PR監視・完了処理
```text
1. GitHub API経由で監視中PR一覧取得
2. 各PRのCI/CDステータス確認
3. 完了条件チェック（全CI成功、レビュー承認、競合なし）
4. 条件満たしたPRの自動マージ実行
5. 関連ISSUEクローズ、ブランチクリーンアップ
```

### Phase 2: 次ISSUE検索・選択
```text
1. GitHub Issues API でオープンISSUE取得
2. 実行可能性スコア計算（明確度、複雑度、影響度）
3. 優先度マトリクス適用（ラベル、作成日、アサイン状況）
4. 最適ISSUE選択、なければPhase 3へ
```

### Phase 3: ISSUE自動生成（必要時）
```text
1. プロジェクト分析実行（コード品質、パフォーマンス、セキュリティ）
2. 改善点特定・ISSUE候補生成
3. 影響度と工数のバランス評価
4. 最適な新ISSUE作成・ラベル付与
```

### Phase 4: オーケストレーター実行
```text
1. 選択されたISSUEの要件分析
2. タスクを独立可能な粒度に分解
3. container-use環境で並列実行
4. 各タスクの進捗監視・品質チェック
5. 統合・テスト・PR作成
```

### Phase 5: 結果記録・次回準備
```text
1. 実行結果とメトリクス記録
2. 学習データ更新（成功パターン、失敗要因）
3. 次回サイクル時刻設定
4. 状態ファイル保存
```

---

## ⚙️ 設定項目詳細

### 実行制御設定
```yaml
execution:
  cycle_interval_minutes: 30        # サイクル実行間隔
  max_wait_for_ci_hours: 2         # CI最大待機時間
  max_concurrent_prs: 3            # 同時実行可能PR数
  auto_retry_failed_tasks: true    # 失敗タスク自動再試行
  auto_merge_enabled: false        # 自動マージ有効化
```

### ISSUE管理設定
```yaml
issue_management:
  auto_creation_enabled: true      # ISSUE自動生成有効
  creation_interval_cycles: 5      # 生成間隔（サイクル数）
  max_generated_per_day: 5         # 1日最大生成数
  
  search_labels:                   # 検索対象ラベル
    - "ready-for-development"
    - "approved"
    - "good-first-issue"
    
  exclude_labels:                  # 除外ラベル
    - "blocked"
    - "waiting-for-review"
    - "needs-requirements"
```

### 品質ゲート設定
```yaml
quality_gates:
  min_code_coverage: 80            # 最小コードカバレッジ
  max_complexity_score: 10         # 最大複雑度スコア
  require_security_scan: true      # セキュリティスキャン必須
  require_performance_check: false # パフォーマンスチェック必須
```

---

## 🚨 エラー対応ガイド

### よくあるエラーと解決法

**Error: GitHub API認証失敗**
```
解決策:
1. GitHub Personal Access Tokenの確認
2. 権限スコープの確認（repo, issues, pull_requests）
3. トークンの有効期限確認
```

**Error: CI/CD設定不備**
```
解決策:
1. .github/workflows/ 下のCI設定確認
2. 必須チェック項目の設定確認
3. ブランチ保護ルールの確認
```

**Error: 実行可能ISSUE不足**
```
自動対応:
1. プロジェクト分析による自動ISSUE生成
2. 既存ISSUEの再評価・優先度調整
3. 低優先度ISSUEの条件緩和検討
```

**Error: container-use環境エラー**
```
解決策:
1. Docker環境の確認・再起動
2. リソース使用量確認・調整
3. 環境設定ファイルの確認
```

### デバッグ手順
```bash
# 詳細ログ確認
/auto logs --level=debug --last=1h

# 設定確認
/auto config show

# ドライラン実行
/auto cycle --dry-run

# 強制停止・クリーンアップ
/auto stop --force
```

---

## 📈 パフォーマンス最適化

### システム効率化
- **並列実行**: container-use環境での独立タスク並列処理
- **キャッシュ活用**: API応答、分析結果のローカルキャッシュ
- **インクリメンタル分析**: 変更差分のみの分析実行
- **予測実行**: 次回タスクの事前準備

### リソース管理
- **API制限**: GitHub API Rate Limitの効率的管理
- **メモリ使用量**: 大規模プロジェクトでのメモリ最適化
- **実行時間制御**: 長時間実行タスクのタイムアウト管理
- **負荷分散**: 複数サイクルでの作業負荷分散

---

この最適化されたコマンドにより、Claude Codeの推奨パターンに従った効率的で使いやすい自律開発システムが実現されます。