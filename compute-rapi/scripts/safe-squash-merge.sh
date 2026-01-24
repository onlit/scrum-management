#!/bin/bash
# Safe squash merge script with file verification
# Prevents file loss during squash merges caused by rename detection failures
#
# Usage: ./scripts/safe-squash-merge.sh <feature-branch> [target-branch]
#
# Example:
#   ./scripts/safe-squash-merge.sh feat/api-domain-layer-separation dev
#   ./scripts/safe-squash-merge.sh feat/my-feature  # defaults to dev

set -e

FEATURE_BRANCH="${1:?Usage: $0 <feature-branch> [target-branch]}"
TARGET_BRANCH="${2:-dev}"

echo "=== Safe Squash Merge ==="
echo "Feature: $FEATURE_BRANCH"
echo "Target:  $TARGET_BRANCH"
echo ""

# Ensure we're on the target branch and up to date
echo "=== Preparing target branch ==="
git checkout "$TARGET_BRANCH"
git pull origin "$TARGET_BRANCH"

# 1. Get list of all files in feature branch (excluding deleted files)
echo ""
echo "=== Pre-merge file inventory ==="
FEATURE_FILES=$(git ls-tree -r --name-only "$FEATURE_BRANCH" | sort)
FEATURE_COUNT=$(echo "$FEATURE_FILES" | wc -l)
echo "Feature branch has $FEATURE_COUNT files"

# 2. Perform the squash merge
echo ""
echo "=== Performing squash merge ==="
if ! git merge --squash "$FEATURE_BRANCH" -X theirs; then
    echo "❌ Merge failed. Resolve conflicts and re-run verification manually."
    exit 1
fi

# 3. Stage all changes
git add -A

# 4. Post-merge verification - check ALL feature branch files exist
echo ""
echo "=== Post-merge verification ==="
MISSING_FILES=""
MISSING_COUNT=0

while IFS= read -r file; do
    if [[ -n "$file" && ! -f "$file" ]]; then
        MISSING_FILES="$MISSING_FILES$file"$'\n'
        ((MISSING_COUNT++)) || true
    fi
done <<< "$FEATURE_FILES"

if [[ $MISSING_COUNT -gt 0 ]]; then
    echo "⚠️  WARNING: $MISSING_COUNT files from feature branch are MISSING after merge:"
    echo "$MISSING_FILES"
    echo ""
    echo "Restoring missing files from feature branch..."

    while IFS= read -r file; do
        if [[ -n "$file" ]]; then
            mkdir -p "$(dirname "$file")"
            git show "$FEATURE_BRANCH:$file" > "$file"
            git add "$file"
            echo "  ✓ Restored: $file"
        fi
    done <<< "$MISSING_FILES"

    echo ""
    echo "✅ Missing files have been restored and staged."
else
    echo "✅ All files present - no restoration needed"
fi

# 5. Final verification
echo ""
echo "=== Final verification ==="
MISSING_AFTER_FIX=""
STILL_MISSING=0

while IFS= read -r file; do
    if [[ -n "$file" ]] && ! git ls-files --error-unmatch "$file" &>/dev/null; then
        MISSING_AFTER_FIX="$MISSING_AFTER_FIX$file"$'\n'
        ((STILL_MISSING++)) || true
    fi
done <<< "$FEATURE_FILES"

if [[ $STILL_MISSING -gt 0 ]]; then
    echo "❌ FATAL: Could not restore all files:"
    echo "$MISSING_AFTER_FIX"
    echo ""
    echo "Aborting. To reset: git reset --hard HEAD"
    exit 1
fi

echo "✅ All $FEATURE_COUNT feature branch files verified present"
echo ""
echo "=== Ready to commit ==="
echo ""
echo "Review changes with:"
echo "  git status"
echo "  git diff --cached --stat"
echo ""
echo "Commit with:"
echo "  git commit -m 'feat: squash merge $FEATURE_BRANCH'"
echo ""
echo "Then push and cherry-pick to main:"
echo "  git push origin $TARGET_BRANCH"
echo "  COMMIT=\$(git rev-parse --short HEAD)"
echo "  ./scripts/safe-cherry-pick-to-main.sh \$COMMIT"
