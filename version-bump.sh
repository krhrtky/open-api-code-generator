#!/bin/bash

# Version Bump Script for OpenAPI Code Generator
# このスクリプトはTypeScriptとRust実装の両方のバージョンを管理します

set -e

# カラー出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ヘルプ表示
show_help() {
    echo -e "${BLUE}OpenAPI Code Generator - Version Bump Script${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS] BUMP_TYPE"
    echo ""
    echo "BUMP_TYPE:"
    echo "  patch    Increment patch version (1.0.0 -> 1.0.1)"
    echo "  minor    Increment minor version (1.0.0 -> 1.1.0)"
    echo "  major    Increment major version (1.0.0 -> 2.0.0)"
    echo ""
    echo "OPTIONS:"
    echo "  -t, --typescript-only    TypeScript実装のみバージョンアップ"
    echo "  -r, --rust-only         Rust実装のみバージョンアップ"
    echo "  -p, --prepare-release   リリース準備（タグ作成、コミット）"
    echo "  -d, --dry-run           実際の変更を行わずに結果を表示"
    echo "  -h, --help              このヘルプを表示"
    echo ""
    echo "Examples:"
    echo "  $0 patch                # 両実装のパッチバージョンアップ"
    echo "  $0 minor -t             # TypeScriptのみマイナーバージョンアップ"
    echo "  $0 major -p             # メジャーバージョンアップとリリース準備"
    echo "  $0 patch -d             # ドライラン（変更確認のみ）"
}

# 現在のバージョンを取得
get_current_version() {
    local implementation=$1
    if [[ "$implementation" == "typescript" ]]; then
        cd implementation/typescript
        current_version=$(node -p "require('./package.json').version")
        cd ../..
    elif [[ "$implementation" == "rust" ]]; then
        cd implementation/rust
        current_version=$(grep "^version = " Cargo.toml | sed 's/version = "\(.*\)"/\1/')
        cd ../..
    fi
    echo "$current_version"
}

# 新しいバージョンを計算
calculate_new_version() {
    local current_version=$1
    local bump_type=$2
    
    IFS='.' read -ra VERSION_PARTS <<< "$current_version"
    major=${VERSION_PARTS[0]}
    minor=${VERSION_PARTS[1]}
    patch=${VERSION_PARTS[2]}
    
    case $bump_type in
        "patch")
            patch=$((patch + 1))
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        *)
            echo -e "${RED}Error: Invalid bump type '$bump_type'${NC}" >&2
            exit 1
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

# TypeScriptのバージョン更新
update_typescript_version() {
    local new_version=$1
    local dry_run=$2
    
    echo -e "${BLUE}Updating TypeScript implementation...${NC}"
    
    cd implementation/typescript
    
    if [[ "$dry_run" == "true" ]]; then
        echo "  Would update package.json version to: $new_version"
    else
        npm version "$new_version" --no-git-tag-version
        echo -e "${GREEN}  ✓ Updated package.json to version $new_version${NC}"
    fi
    
    cd ../..
}

# Rustのバージョン更新
update_rust_version() {
    local new_version=$1
    local dry_run=$2
    
    echo -e "${BLUE}Updating Rust implementation...${NC}"
    
    cd implementation/rust
    
    if [[ "$dry_run" == "true" ]]; then
        echo "  Would update Cargo.toml version to: $new_version"
    else
        # macOSとLinux両対応のsed
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/^version = \".*\"/version = \"$new_version\"/" Cargo.toml
        else
            sed -i "s/^version = \".*\"/version = \"$new_version\"/" Cargo.toml
        fi
        echo -e "${GREEN}  ✓ Updated Cargo.toml to version $new_version${NC}"
    fi
    
    cd ../..
}

# CHANGELOGの更新
update_changelog() {
    local new_version=$1
    local dry_run=$2
    
    echo -e "${BLUE}Updating CHANGELOG.md...${NC}"
    
    if [[ "$dry_run" == "true" ]]; then
        echo "  Would add entry for version $new_version to CHANGELOG.md"
        return
    fi
    
    # CHANGELOG.mdが存在しない場合は作成
    if [[ ! -f "CHANGELOG.md" ]]; then
        cat > CHANGELOG.md << EOF
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [$new_version] - $(date +%Y-%m-%d)

### Added
- Version bump to $new_version

### Changed

### Deprecated

### Removed

### Fixed

### Security

EOF
        echo -e "${GREEN}  ✓ Created CHANGELOG.md with version $new_version${NC}"
    else
        # 既存のCHANGELOGに新しいエントリを追加
        temp_file=$(mktemp)
        
        # ヘッダーを保持して新しいエントリを挿入
        head -n 7 CHANGELOG.md > "$temp_file"
        cat >> "$temp_file" << EOF

## [$new_version] - $(date +%Y-%m-%d)

### Added
- Version bump to $new_version

### Changed

### Deprecated

### Removed

### Fixed

### Security

EOF
        tail -n +8 CHANGELOG.md >> "$temp_file"
        mv "$temp_file" CHANGELOG.md
        
        echo -e "${GREEN}  ✓ Updated CHANGELOG.md with version $new_version${NC}"
    fi
}

# リリース準備（Git操作）
prepare_release() {
    local new_version=$1
    local typescript_only=$2
    local rust_only=$3
    local dry_run=$4
    
    echo -e "${BLUE}Preparing release...${NC}"
    
    if [[ "$dry_run" == "true" ]]; then
        echo "  Would create Git commit with changes"
        if [[ "$typescript_only" == "true" ]]; then
            echo "  Would create tag: typescript-v$new_version"
        elif [[ "$rust_only" == "true" ]]; then
            echo "  Would create tag: rust-v$new_version"
        else
            echo "  Would create tags: typescript-v$new_version, rust-v$new_version"
        fi
        return
    fi
    
    # Git設定確認
    if ! git config user.name > /dev/null || ! git config user.email > /dev/null; then
        echo -e "${YELLOW}Warning: Git user configuration not found. Setting defaults...${NC}"
        git config user.name "Version Bump Script"
        git config user.email "noreply@example.com"
    fi
    
    # 変更をステージング
    git add -A
    
    # コミット作成
    if [[ "$typescript_only" == "true" ]]; then
        commit_message="chore(typescript): bump version to $new_version"
    elif [[ "$rust_only" == "true" ]]; then
        commit_message="chore(rust): bump version to $new_version"
    else
        commit_message="chore: bump version to $new_version"
    fi
    
    git commit -m "$commit_message" || {
        echo -e "${YELLOW}Warning: No changes to commit${NC}"
    }
    
    # タグ作成
    if [[ "$typescript_only" == "true" ]]; then
        git tag "typescript-v$new_version" -m "TypeScript implementation version $new_version"
        echo -e "${GREEN}  ✓ Created tag: typescript-v$new_version${NC}"
    elif [[ "$rust_only" == "true" ]]; then
        git tag "rust-v$new_version" -m "Rust implementation version $new_version"
        echo -e "${GREEN}  ✓ Created tag: rust-v$new_version${NC}"
    else
        git tag "typescript-v$new_version" -m "TypeScript implementation version $new_version"
        git tag "rust-v$new_version" -m "Rust implementation version $new_version"
        echo -e "${GREEN}  ✓ Created tags: typescript-v$new_version, rust-v$new_version${NC}"
    fi
    
    echo -e "${GREEN}  ✓ Release prepared successfully${NC}"
    echo -e "${YELLOW}  Note: Use 'git push origin main --tags' to push changes and tags${NC}"
}

# バージョン同期チェック
check_version_sync() {
    typescript_version=$(get_current_version typescript)
    rust_version=$(get_current_version rust)
    
    if [[ "$typescript_version" != "$rust_version" ]]; then
        echo -e "${YELLOW}Warning: Version mismatch detected${NC}"
        echo "  TypeScript: $typescript_version"
        echo "  Rust: $rust_version"
        echo ""
        echo -e "${YELLOW}Consider using specific options (-t or -r) to update only one implementation${NC}"
        echo ""
    fi
}

# メイン処理
main() {
    # パラメータ初期化
    typescript_only=false
    rust_only=false
    prepare_release_flag=false
    dry_run=false
    bump_type=""
    
    # パラメータ解析
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--typescript-only)
                typescript_only=true
                shift
                ;;
            -r|--rust-only)
                rust_only=true
                shift
                ;;
            -p|--prepare-release)
                prepare_release_flag=true
                shift
                ;;
            -d|--dry-run)
                dry_run=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            patch|minor|major)
                bump_type=$1
                shift
                ;;
            *)
                echo -e "${RED}Error: Unknown option '$1'${NC}" >&2
                echo "Use '$0 --help' for usage information."
                exit 1
                ;;
        esac
    done
    
    # バンプタイプが指定されていない場合
    if [[ -z "$bump_type" ]]; then
        echo -e "${RED}Error: Bump type is required${NC}" >&2
        echo "Use '$0 --help' for usage information."
        exit 1
    fi
    
    # 競合オプションチェック
    if [[ "$typescript_only" == "true" && "$rust_only" == "true" ]]; then
        echo -e "${RED}Error: Cannot specify both --typescript-only and --rust-only${NC}" >&2
        exit 1
    fi
    
    # プロジェクトルートディレクトリにいることを確認
    if [[ ! -f "README.md" ]] || [[ ! -d "implementation" ]]; then
        echo -e "${RED}Error: This script must be run from the project root directory${NC}" >&2
        exit 1
    fi
    
    echo -e "${BLUE}OpenAPI Code Generator - Version Bump${NC}"
    echo "========================================"
    echo ""
    
    # ドライランの場合の表示
    if [[ "$dry_run" == "true" ]]; then
        echo -e "${YELLOW}DRY RUN MODE - No actual changes will be made${NC}"
        echo ""
    fi
    
    # バージョン同期チェック
    check_version_sync
    
    # 現在のバージョンを表示
    if [[ "$typescript_only" != "true" ]]; then
        rust_current=$(get_current_version rust)
        rust_new=$(calculate_new_version "$rust_current" "$bump_type")
        echo "Rust implementation: $rust_current -> $rust_new"
    fi
    
    if [[ "$rust_only" != "true" ]]; then
        typescript_current=$(get_current_version typescript)
        typescript_new=$(calculate_new_version "$typescript_current" "$bump_type")
        echo "TypeScript implementation: $typescript_current -> $typescript_new"
    fi
    
    echo ""
    
    # 確認プロンプト（ドライランでない場合）
    if [[ "$dry_run" != "true" ]]; then
        echo -e "${YELLOW}Do you want to proceed with the version bump? (y/N)${NC}"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo "Version bump cancelled."
            exit 0
        fi
        echo ""
    fi
    
    # バージョン更新実行
    if [[ "$rust_only" != "true" ]]; then
        update_typescript_version "$typescript_new" "$dry_run"
    fi
    
    if [[ "$typescript_only" != "true" ]]; then
        update_rust_version "$rust_new" "$dry_run"
    fi
    
    # CHANGELOGの更新
    if [[ "$typescript_only" == "true" ]]; then
        update_changelog "$typescript_new" "$dry_run"
    elif [[ "$rust_only" == "true" ]]; then
        update_changelog "$rust_new" "$dry_run"
    else
        # 両方更新する場合は、一つのバージョンでCHANGELOGを更新
        update_changelog "$typescript_new" "$dry_run"
    fi
    
    # リリース準備
    if [[ "$prepare_release_flag" == "true" ]]; then
        if [[ "$typescript_only" == "true" ]]; then
            prepare_release "$typescript_new" true false "$dry_run"
        elif [[ "$rust_only" == "true" ]]; then
            prepare_release "$rust_new" false true "$dry_run"
        else
            prepare_release "$typescript_new" false false "$dry_run"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}Version bump completed successfully!${NC}"
    
    # 次のステップの提案
    if [[ "$dry_run" != "true" ]]; then
        echo ""
        echo -e "${BLUE}Next steps:${NC}"
        if [[ "$prepare_release_flag" != "true" ]]; then
            echo "1. Review the changes:"
            echo "   git diff"
            echo "2. Commit the changes:"
            echo "   git add -A && git commit -m 'chore: bump version to $new_version'"
            echo "3. Create and push tags:"
            if [[ "$typescript_only" == "true" ]]; then
                echo "   git tag typescript-v$typescript_new && git push origin main --tags"
            elif [[ "$rust_only" == "true" ]]; then
                echo "   git tag rust-v$rust_new && git push origin main --tags"
            else
                echo "   git tag typescript-v$typescript_new rust-v$rust_new && git push origin main --tags"
            fi
        else
            echo "1. Push changes and tags:"
            echo "   git push origin main --tags"
        fi
        echo "2. Publish packages:"
        if [[ "$rust_only" != "true" ]]; then
            echo "   cd implementation/typescript && npm run publish:github"
        fi
        if [[ "$typescript_only" != "true" ]]; then
            echo "   cd implementation/rust && cargo publish"
        fi
    fi
}

# スクリプト実行
main "$@"