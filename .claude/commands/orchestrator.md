# 🗂️ オーケストレーター

複雑なゴールを **連続するステップ** に分解し、各ステップ内では **container-use を用いてサブタスクを並列** 実行します。  
**オーケストレーター自身は実行せず、専ら指示と調整に専念** します。

---

## 🚦 プロセス概要

| フェーズ | 目的 | アクション |
|---------|------|-----------|
| **1. 初期分析** | ゴール全体を把握し、依存関係と実行順を特定 | 要件分析・アーキテクチャ設計 |
| **2. ステップ設計** | 2〜5 個のステップへ分割、各ステップに並列サブタスクを配置 | 実行プラン策定 |
| **3. 並列実行** | container-use でサブタスクを並列起動し、完了を待機 | タスクディスパッチ |
| **4. レビュー & 適応** | ステップ完了後に結果を確認し、計画を動的調整 | 品質チェック・プラン修正 |
| **5. DONE 判定** | すべてのゴール達成を確認したら **Pull Request 作成タスク** を発行 | 完了検証 |
| **6. PR 作成** | 統合要約を本文に、変更内容を含むブランチから PR を作成し終了 | 最終統合 |

---

## 🎯 Task Tools 並列実行戦略

### Task Tools 活用の利点
- **ネイティブ並列実行**: Claude Code の組み込み並列処理
- **自動負荷分散**: Task Tools が最適なリソース配分を実行
- **統合監視**: 進捗・エラー・結果の一元管理
- **依存関係解決**: Task Tools が自動的に実行順序を最適化

### 並列実行パターン
```text
# Task Tools による並列実行指示
@task-parallel <task-group-name>
- task-1: <指示1>
- task-2: <指示2>
- task-3: <指示3>
@end-parallel

# 依存関係付き並列実行
@task-sequence
  @task-parallel setup-phase
  - task-setup-1: <環境構築1>
  - task-setup-2: <環境構築2>
  @end-parallel
  
  @task-parallel main-phase  # setup-phase 完了後に実行
  - task-main-1: <メイン処理1>
  - task-main-2: <メイン処理2>
  - task-main-3: <メイン処理3>
  @end-parallel
@end-sequence
```

---

## 📝 Task Tools サブタスク記述フォーマット

**重要:** サブタスクは独立して実行可能な粒度に分解し、container-use 環境で並列実行します。

>>> TASK_TOOLS_EXECUTION [ステップ名]

@task-parallel <ステップ名>-phase
execution_strategy: parallel | sequential | conditional
max_concurrent: <同時実行数>
timeout_minutes: <タイムアウト時間>
failure_strategy: fail_fast | continue_on_error | retry_failed

- task_id: t-<step>-<num>
  description: |
    <Task Tools への明確な指示>
    Goal: <期待する具体的成果物>
    Context: <必要な背景情報>
    Deliverables: <成果物の詳細>
  tools_required: [<必要なツール名>]
  validation: |
    <完了確認方法>

- task_id: t-<step>-<num+1>
  description: |
    <次のタスクの指示>
  dependencies: [t-<step>-<prev_num>]  # 依存関係があれば指定
  
@end-parallel

# 条件付き実行例
@task-conditional
  condition: if_previous_success
  @task-parallel validation-phase
  - task_id: t-validation-1
    description: |
      前フェーズの成果物を検証し、品質チェックを実行
  - task_id: t-validation-2  
    description: |
      統合テストを実行し、動作確認を完了
  @end-parallel
@end-conditional

---

## 🤖 Task Tools 実行結果フォーマット

```text
<<< TASK_RESULT t-<step>-<num>
task_status: completed | failed | blocked | timeout
execution_time: <実行時間（分）>
task_tools_used: [<使用されたツール一覧>]
parallel_efficiency: <並列実行効率（%）>

summary: |
  <100〜200字の要約>
  
deliverables:
  - type: <code|docs|test|config|analysis>
    path: <ファイルパス>
    description: <説明>
    validation_status: <passed|failed|pending>

task_interactions: |
  <他タスクとの相互作用・共有リソース>
  
quality_metrics:
  - code_quality: <A|B|C|D>
  - test_coverage: <%>
  - performance_impact: <low|medium|high>

next_dependencies: |
  <このタスク完了により実行可能になったタスク>
  
issues_escalation: |
  <手動介入が必要な問題>

pr_info:
  branch: <ブランチ名>
  url: <PR URL>
  merge_ready: <true|false>
  review_required: <true|false>
>>>
```

---

## 🔧 Task Tools オーケストレーション制御

### 1. 動的タスク管理
```text
# Task Tools の実行時調整
@task-adjust
- task_id: t-<id>
  action: scale_up | scale_down | redistribute | pause | resume
  reason: <調整理由>
  new_parameters:
    max_concurrent: <新しい並列数>
    priority: <high|medium|low>
@end-adjust

# 実行時間最適化
if avg_execution_time > expected * 1.3:
    @task-split
    - original_task: t-<id>
      split_into: [t-<id>-a, t-<id>-b, t-<id>-c]
      strategy: functional | data_parallel | pipeline
    @end-split
```


## 🔧 Container-Use 環境管理指針

### 2. Task Tools エラーハンドリング
```text
@task-error-handling
strategy: 
  - auto_retry: 3 attempts
  - escalation: manual_review after 3 failures  
  - fallback: simplified_version
  - isolation: quarantine_failed_tasks

recovery_actions:
  task_failed: |
    1. Analyze failure logs via Task Tools
    2. Generate simplified alternative task
    3. Execute via @task-retry with reduced scope
  
  dependency_blocked: |
    1. Identify alternative execution paths
    2. Reorder remaining tasks via @task-reorder
    3. Execute independent tasks in parallel
@end-error-handling
```

### 3. Task Tools 品質ゲート
```text
@task-quality-gate
gate_name: <フェーズ名>
criteria:
  - all_tasks_completed: true
  - code_quality_minimum: B
  - test_coverage_minimum: 80%
  - security_scan: passed
  - performance_regression: false

on_gate_failure:
  @task-parallel quality-fix
  - task_id: fix-quality
    description: |
      Task Tools を使用して品質問題を自動修正
      Focus: リファクタリング、テスト追加、最適化
  - task_id: fix-security
    description: |
      セキュリティ問題の修正とスキャン再実行
  @end-parallel
@end-quality-gate
```

---

## 🧑‍💻 ワーカーの詳細ガイドライン

### コード変更がある場合
1. **ブランチ戦略**
```bash
git checkout -b feat/<step-id>-<task-summary>
# 例: feat/s1-api-endpoints
```

2. **コミット規約**
```bash
git commit -m "<type>(<scope>): <description>"
# 例: feat(api): add user authentication endpoint
```

3. **PR テンプレート**
```markdown
## 🎯 目的
{{goal}}

## 📋 変更概要
{{summary}}

## 🔍 変更詳細
- {{detailed_changes}}

## ✅ テスト
- [ ] 単体テスト追加・更新
- [ ] 統合テスト実行
- [ ] 手動テスト完了

## 🔒 セキュリティ
- [ ] セキュリティスキャン実行
- [ ] 機密情報の除去確認

## 📚 ドキュメント
- [ ] README更新
- [ ] API文書更新
- [ ] コメント追加

## 🔗 関連
- タスクID: {{task_id}}
- 依存PR: {{dependent_prs}}
```

### コード変更がない場合
```text
code_changed: false
deliverables:
  - type: analysis
    content: |
      <分析結果>
  - type: documentation
    path: <ドキュメントパス>
```

---

## 🔄 Task Tools 監視・制御システム

### Task Tools 実行状況監視
```text
TASK_TOOLS_DASHBOARD:
parallel_groups:
  - group: setup-phase
    status: COMPLETED
    tasks: 3/3 ✅
    avg_time: 8min
    efficiency: 95%
    
  - group: main-phase  
    status: IN_PROGRESS
    tasks: 2/4 (running: 2, queued: 0)
    est_completion: 15min
    bottlenecks: [dependency_wait]
    
task_tools_performance:
  - total_parallel_capacity: 8 tasks
  - current_utilization: 75%
  - queue_depth: 2
  - avg_task_completion: 12min
  - success_rate: 92%
```

### 適応的Task Tools制御
```text
@task-orchestration-control
adaptive_scaling:
  - monitor: task_completion_rate
    threshold: < 80% expected
    action: increase_parallelism
    
  - monitor: error_rate  
    threshold: > 10%
    action: reduce_complexity
    
  - monitor: resource_usage
    threshold: > 90%
    action: queue_management

auto_optimization:
  - similar_task_batching: enabled
  - dependency_graph_optimization: enabled
  - resource_aware_scheduling: enabled
  - preemptive_error_prevention: enabled
@end-orchestration-control
```

### 最終統合 Task Tools 実行
```text
COMPLETION_VERIFICATION:
@task-parallel final-integration
- task_id: integration-check
  description: |
    Task Tools で全コンポーネントの統合テストを実行
    すべてのPRの互換性確認と競合解決
    
- task_id: quality-validation  
  description: |
    最終品質チェックをTask Tools経由で実行
    自動テスト、セキュリティスキャン、パフォーマンステスト
    
- task_id: documentation-generation
  description: |
    Task Tools でプロジェクト全体のドキュメント生成
    API文書、README、変更履歴の自動更新
@end-parallel

FINAL_PR_CREATION_VIA_TASK_TOOLS:
@task-sequential final-pr
- task_id: pr-preparation
  description: |
    すべての変更を統合したブランチを作成
    コンフリクト解決とマージ準備
    
- task_id: pr-creation
  description: |
    統合要約を含む最終PRを作成
    タイトル: "feat: <プロジェクト全体要約>"
    本文: 全フェーズの詳細要約とTask Tools実行ログ
@end-sequential
```

---

## ⚡ Task Tools パフォーマンス最適化

### Task Tools 効率最大化戦略
```text
@task-optimization-strategy
resource_management:
  - task_affinity: group_similar_tasks
  - memory_optimization: reuse_tools_context
  - cpu_scheduling: balance_computational_load
  - io_optimization: batch_file_operations

parallel_efficiency:
  - dependency_minimization: reduce_inter_task_coupling
  - granularity_optimization: split_large_tasks_auto
  - load_balancing: distribute_work_evenly
  - early_termination: fast_fail_on_critical_errors

@task-performance-monitoring
metrics:
  - task_throughput: tasks_per_hour
  - parallel_efficiency: actual_vs_theoretical_speedup  
  - resource_utilization: cpu_memory_io_usage
  - bottleneck_identification: critical_path_analysis
@end-performance-monitoring
```

### Task Tools リソース効率化
```text
# 軽量タスクの並列バッチ実行
@task-parallel quick-tasks-batch
execution_mode: high_concurrency
resource_profile: lightweight

- task_id: batch-lint
  description: |
    すべてのソースファイルのlintチェックを並列実行
    
- task_id: batch-format  
  description: |
    コードフォーマットを一括適用
    
- task_id: batch-test-unit
  description: |
    軽量な単体テストを並列実行
@end-parallel

# 重量タスクの順次最適実行  
@task-sequential heavy-tasks
execution_mode: resource_intensive
resource_profile: high_performance

- task_id: integration-test
  description: |
    統合テストスイート全体を実行
    
- task_id: performance-benchmark
  description: |
    パフォーマンステストとベンチマーク実行
@end-sequential
```

## 🎯 Task Tools 実装例

### 実際のオーケストレーション実行
```text
# プロジェクト開始時の指示例
ORCHESTRATOR_COMMAND:
"複雑なWebアプリケーション開発を並列で実行してください"

GENERATED_TASK_TOOLS_SEQUENCE:

@task-parallel phase-1-foundation
- task_id: backend-api
  description: |
    REST API エンドポイントを設計・実装
    認証、CRUD操作、エラーハンドリング含む
    テスト可能な状態まで完成させる
    
- task_id: frontend-components
  description: |
    React コンポーネントライブラリを作成
    UI/UX設計に基づいたレスポンシブ対応
    Storybook でのドキュメント化も含む
    
- task_id: database-schema
  description: |
    データベーススキーマ設計と初期データ投入
    マイグレーション、インデックス最適化
    データ整合性チェック含む
@end-parallel

@task-parallel phase-2-integration  
depends_on: [phase-1-foundation]
- task_id: api-integration
  description: |
    フロントエンドとバックエンドの統合
    API呼び出し、エラーハンドリング、状態管理
    
- task_id: testing-suite
  description: |
    E2Eテスト、統合テスト、パフォーマンステスト
    CI/CDパイプライン設定含む
    
- task_id: deployment-prep
  description: |
    本番環境デプロイ準備
    Docker化、環境変数設定、監視設定
@end-parallel

@task-sequential final-delivery
- task_id: final-validation
  description: |
    全機能の最終検証とバグ修正
    ユーザビリティテスト実施
    
- task_id: documentation
  description: |
    技術文書、ユーザーマニュアル、API仕様書作成
    
- task_id: create-final-pr
  description: |
    統合PR作成、レビュー準備、マージ戦略策定
@end-sequential
```

この Task Tools 活用版は、**Claude Code のネイティブ並列処理能力** を最大限活用し、より確実で効率的な並列オーケストレーションを実現します。
>>>>>>> origin/main
