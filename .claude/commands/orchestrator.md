# 🗂️ オーケストレーター

複雑なゴールを **連続するステップ** に分解し、各ステップ内では **サブタスクを並列** 実行してください。  
完了と判断したら、最終要約を本文に含めた **Pull Request 作成** を必ず指示します。

---

## 🚦 プロセス概要

| フェーズ | 目的 |
|---------|------|
| **1. 初期分析** | ゴール全体を把握し、依存関係と実行順を特定 |
| **2. ステップ設計** | 2〜4 個のステップへ分割し、各ステップに 2〜4 個の独立可能な並列サブタスクを配置 |
| **3. ステップ実行** | ステップ内のサブタスクを container-use 環境で並列実行し、完了を待つ |
| **4. レビュー & 適応** | ステップ完了後に結果を確認し、計画を調整 |
| **5. DONE 判定** | すべてのゴール達成を確認したら **Pull Request 作成タスク** を発行 |
| **6. PR 作成** | 要約を本文に、変更内容を含むブランチから PR を作成し終了 |

---

## 📝 サブタスク記述フォーマット

**重要:** サブタスクは独立して実行可能な粒度に分解し、container-use 環境で並列実行します。

```text
>>> TASKS
- id: t-1
  title: "<簡潔なタスク名>"
  goal: "<期待アウトプット>"
  context: |
    <必要な背景・入力>
  independent: true  # 他のタスクに依存しない独立実行可能
  environment: |
    # container-use 環境設定
    source: /path/to/project
    name: task-t-1-environment
  done_when: |
    - <完了条件>
    - container-use 環境で実装・テスト完了
    - リモートブランチにプッシュ済み
<<<

## ワーカー報告フォーマット

```
<<< RESULT t-1
status: success | blocked | failed
environment_id: task-t-1-environment
summary: |
  <100〜200 字>
artifacts:
  - <生成物のパスや URL>
  - <container-use 環境での成果物>
git_info: |
  - branch: feature/task-t-1
  - commits: <主要コミット一覧>
  - remote_pushed: true/false
notes: |
  <懸念・追加情報>
  <container-use 環境での特記事項>
>>>
```


## 🔚 DONE 判定時の追加タスク

# 例: 最終ステップの後

# DONE 確認
全ゴールを満たしたため、Pull Request を作成してプロジェクトに統合します。

>>> TASKS
- id: pr-1
  title: "Pull Request を作成"
  goal: "main ブランチへマージ用 PR を作成する"
  independent: true
  environment: |
    # 統合用 container-use 環境
    source: /path/to/project
    name: pr-creation-environment
  context: |
    # 各 container-use 環境からの変更を統合
    # 全サブタスクの成果物を取り込み
    
    # PR 本文ひな形
    ## 概要
    {{total_summary}}  <!-- ← ここにオーケストレーターがまとめた最終要約を埋め込む -->

    ## 変更点
    - 主要なコミット一覧は `git log --oneline origin/main..HEAD` を参照
    - テスト／Lint 結果は CI のステータスチェックにて確認
    - 各 container-use 環境での実装成果を統合

    ## 確認事項
    - [ ] CI が GREEN
    - [ ] レビュワーが 1 名以上承認
    - [ ] 全 container-use 環境からの変更が正しく統合されている
  done_when: |
    - container-use 環境で全変更を統合
    - GitHub に PR が作成され、URL が artifacts に含まれる
    - CI が成功し、レビュワーをアサイン済み
    - 全サブタスクの成果物が PR に反映されている
<<<

## 🔧 Container-Use 環境管理指針

### サブタスク実行時の環境設定
1. **独立環境作成**: 各サブタスクは独立した container-use 環境で実行
2. **並列実行**: 依存関係のないタスクは同時に複数環境で実行
3. **ブランチ分離**: 各環境で独立したブランチを作成
4. **成果物管理**: 各環境の成果物をリモートリポジトリにプッシュ

### 統合時の環境設定
1. **統合環境**: 最終的な PR 作成用に専用環境を作成
2. **変更統合**: 全サブタスクからの変更を統合環境にマージ
3. **検証実行**: 統合後の全体テスト・Lint を実行
4. **PR 作成**: 統合された変更で Pull Request を作成
