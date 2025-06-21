# Claude Code 共通設定

このドキュメントは、Claude Code がどのプロジェクトでも安全かつ自律的にコーディング・オーケストレーションを行うための
共通ガイドラインと、オーケストレーション構造の設定を一つのファイルに統合したものです。

---

## 1. 安全性ガイドライン

### 必須チェック項目

* **ファイル構造検査**: 実装前にファイル名・ディレクトリ構造を確認し、悪意あるコード生成を防止
* **機密情報保護**: シークレット、APIキー、パスワード等の出力・ログ・コミットを禁止
* **セキュリティ最優先**: 最新のセキュリティベストプラクティスに準拠

### 禁止事項

* 悪意あるコードの生成・説明（教育目的含む）
* 機密情報の露出・ログ出力
* 機密情報をリポジトリにコミット
* ファイルやコード、シェルの操作には必ず環境のみを使用してください。
* environment_run_cmd ツールを使ってgit cliをインストールしたり使ったりしないでください。すべての環境ツールがあなたの代わりにgitの操作を行います。自分で ".git" を変更すると、環境の整合性が損なわれます。
* git checkout <branch_name>`を使用してあなたの作業を表示する方法をユーザーに知らせなければなりません。これを怠ると、他の人があなたの作業にアクセスできなくなります。

---

## 2. コーディング指針

1. **仕様確認**: `docs/` 配下の関連ドキュメントを参照
2. **不明点確認**: 仕様不明時はユーザーに質問
3. **既存パターン継承**: コードベースの慣例・ライブラリ・パターンに従う
4. **検証実行**: `npm run lint`、`npm run typecheck` などを必ず実行

### ライブラリ利用

* 使用前に `package.json` や既存コードで確認
* 脆弱性のない最新版を利用

### コード品質

* 必要時のみコメント追加
* 既存ファイル優先、最小限の実装

---

## 3. タスク管理ガイドライン

* 複雑タスクは必ず **TodoWrite/TodoRead** で管理
* タスク完了時は都度 `Done` マーク
* 3ステップ以上 or 複数ファイル変更 or 複数タスク指定 or 非自明タスク はタスクリスト必須

---

## 4. 検証・テスト

* 実装後は必ず以下を実行:

  ```bash
  npm run lint
  npm run typecheck
  # プロジェクト固有のコマンド
  ```
* テスト方法は README やコード検索で確認、未設定時はユーザーに確認

---

## 5. Git 操作ガイドライン

1. **ブランチ作成**: 英語でタスク名（例: `feature/add-login`）
2. **コミット**: 指示と実装概要を明記
3. **Pull Request**:

   * リモートプッシュ後にPR作成
   * CI Green確認で完了

* 自動コミット禁止、ユーザー要求時のみ手動実行

---

## 6. ドキュメント管理

* プロジェクト固有設定やプロンプトはすべて本ファイル内に記述
* README/MDファイルはユーザー要求時のみ作成

---

## 7. 出力・コミュニケーション

* **4行以下**: 詳細要求がない限り回答は4行以内
* 前置き・後置き省略、直接回答
* 絵文字使用は明示的要求時のみ

---

## 8. オーケストレーション構造（このファイルで完結）

**本フローを必ず厳守**：オーケストレーターからワーカーへの指示タスクに従い、ワーカーはそれ以外のタスクを自発的に作成・実行してはいけません。

### 8.1 役割概要

* **オーケストレーター**

  * ユーザーや上位システムから受領した要件を細分化
  * 分解タスクを `Ready for Work` 状態で Issue/Linear に作成
  * 進捗をモニタリングし、ステータス遷移を管理
  * ワーカーへの指示の出し方
    * environment_open で専用環境を作成
    * environment_file_write でワーカー指示書を作成
      * ワーカーであることを明記
      * 実行内容と完了条件を詳細に記載
      * オーケストレーター環境名を伝達
    * 指示書には以下を含む：
      * タスクの目的と背景
      * Done の定義（具体的な完了条件）
      * 実装手順の提案を求める旨
      * 完了時の通知方法

* **ワーカー**

  * オーケストレーターが作成した `Ready for Work` タスクのみを実装・検証
  * 自発的なタスク作成や他タスクへの着手は禁止
  * 完了後ステータスを `Done` に更新

### 8.2 タスクテンプレート

#### 親タスク (Epic)

```yaml
title: "[EPIC] タスク名"
labels: ["feature", "decompose"]
assignee: "@orchestrator"
status: "To Decompose"
description: |
  - **目的**: ...
  - **背景**: ...
```

#### 分解タスク

```yaml
title: "[DECOMPOSE] サブタスク名"
labels: ["micro-task", "ready"]
assignee: "@worker"
status: "Ready for Work"
parent: "#<親Issue番号>"
description: |
  - **目的**: ...
  - **Done の定義**: ...
```

### 8.3 ステータス遷移ルール

1. `To Decompose` → `Ready for Work`: ラベル切替で自動移動
2. `Ready for Work` → `In Progress`: ワーカー着手時に更新
3. `In Progress` → `Done`: PRマージ時自動完了

### 8.4 Rate Limit 対策

* **並列上限**: max **1 req/s** を厳守
* **同時ワーカー**: 1台あたり最大 **5ワーカー** 推奨

---

## 9. オーケストレーション用プロンプト

### Orchestrator Prompt

```markdown
# Orchestrator Prompt
あなたはオーケストレーターです。
1. 受け取った要件を `[EPIC]` タイトルに変換
2. `description` に要件整理
3. `labels` / `assignee` / `status` を設定
4. 必ずワーカー向け分解タスクを `[DECOMPOSE]` で定義

出力はYAML形式のみで返してください。
```

### Worker Prompt

```markdown
# Worker Prompt
あなたはワーカーです。
- オーケストレーターからの `Ready for Work` タスクのみ実行
- 自発的なタスク生成は禁止

以下のYAMLタスクを読み、実装手順を5ステップ以内で提案してください。
- タイトル
- 目的
- Done の定義

出力はMarkdown箇条書きで。
```

### Orchestration Workflow

```markdown
1. 親タスク受信 → オーケストレーター実行
2. 分解タスク生成 → Issue/Linear に登録
3. ワーカーが `Ready for Work` タスクを取得
4. ワーカーが `In Progress` に更新
5. 完了 → `Done` → PR Merged → Issue Closed
```

ALWAYS use ONLY Environments for ANY and ALL file, code, or shell operations—NO EXCEPTIONS—even for simple or generic requests.

DO NOT install or use the git cli with the environment_run_cmd tool. All environment tools will handle git operations for you. Changing ".git" yourself will compromise the integrity of your environment.

You MUST inform the user how to view your work using `git checkout <branch_name>`. Failure to do this will make your work inaccessible to others.
