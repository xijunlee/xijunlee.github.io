#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

dry_run=false
if [[ "${1:-}" == "--dry-run" ]]; then
  dry_run=true
  shift
fi

commit_message="${1:-Update academic website $(date '+%Y-%m-%d %H:%M')}"

for command_name in git python3 node; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "错误：未找到 $command_name。请先按 README.md 安装所需工具。" >&2
    exit 1
  fi
done

echo "[1/4] 构建并检查网站"
python3 build.py
node --check src/app.js

if [[ "$dry_run" == true ]]; then
  echo "[完成] 预演通过：未提交，也未推送。"
  git status --short
  exit 0
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "错误：尚未配置 GitHub 远程仓库 origin。请按 README.md 的“首次发布”完成一次性设置。" >&2
  exit 1
fi

branch="$(git branch --show-current)"
if [[ "$branch" != "main" ]]; then
  echo "错误：当前分支为 $branch；自动发布工作流只从 main 分支发布。" >&2
  exit 1
fi

echo "[2/4] 整理本次修改"
git add --all

echo "[3/4] 创建提交"
if git diff --cached --quiet; then
  echo "没有新的文件修改，继续推送当前 main 分支。"
else
  git commit -m "$commit_message"
fi

echo "[4/4] 推送到 GitHub"
git push -u origin main

echo "发布任务已提交。请在 GitHub 仓库的 Actions 页面查看进度；通常几分钟内生效。"
