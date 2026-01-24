#!/bin/bash
# Safe cherry-pick to main with file verification
# Cherry-picks a specific commit to main with file verification
#
# Usage: ./scripts/safe-cherry-pick-to-main.sh <commit-hash>
#
# Example:
#   ./scripts/safe-cherry-pick-to-main.sh abc123f
#   ./scripts/safe-cherry-pick-to-main.sh 7cc54046

set -e

if [[ -z "$1" ]]; then
    echo "Usage: $0 <commit-hash>"
    echo ""
    echo "Example:"
    echo "  $0 abc123f"
    echo ""
    echo "Recent dev commits:"
    git log dev --oneline -5
    exit 1
fi

SOURCE_COMMIT="${1}"
TARGET_BRANCH="main"

# Validate the commit exists
if ! git rev-parse "$SOURCE_COMMIT" &>/dev/null; then
    echo "❌ Error: Commit '$SOURCE_COMMIT' not found"
    exit 1
fi

SOURCE_COMMIT=$(git rev-parse "$SOURCE_COMMIT")
SOURCE_SHORT=$(git rev-parse --short "$SOURCE_COMMIT")

echo "=== Safe Cherry-Pick to Main ==="
echo "Commit: $SOURCE_SHORT"
echo "Target: $TARGET_BRANCH"
echo ""
# 1. Get list of all files at the commit
echo "=== Pre-cherry-pick file inventory ==="
SOURCE_FILES=$(git ls-tree -r --name-only "$SOURCE_COMMIT" | sort)
SOURCE_COUNT=$(echo "$SOURCE_FILES" | wc -l)
echo "Commit has $SOURCE_COUNT files"

# 2. Checkout main and update
echo ""
echo "=== Preparing main branch ==="
git checkout "$TARGET_BRANCH"
git pull origin "$TARGET_BRANCH"

# 3. Perform the cherry-pick
echo ""
echo "=== Performing cherry-pick ==="
if ! git cherry-pick "$SOURCE_COMMIT" -X theirs; then
    echo "⚠️  Cherry-pick had conflicts. Attempting to resolve with source branch files..."

    # For each conflicted file, take the source commit version
    CONFLICTED=$(git diff --name-only --diff-filter=U)
    while IFS= read -r file; do
        if [[ -n "$file" ]]; then
            git show "$SOURCE_COMMIT:$file" > "$file" 2>/dev/null || true
            git add "$file"
            echo "  ✓ Resolved: $file"
        fi
    done <<< "$CONFLICTED"

    # Continue the cherry-pick
    git cherry-pick --continue --no-edit || true
fi

# 4. Post-cherry-pick verification
echo ""
echo "=== Post-cherry-pick verification ==="
MISSING_FILES=""
MISSING_COUNT=0

while IFS= read -r file; do
    if [[ -n "$file" && ! -f "$file" ]]; then
        MISSING_FILES="$MISSING_FILES$file"$'\n'
        ((MISSING_COUNT++)) || true
    fi
done <<< "$SOURCE_FILES"

if [[ $MISSING_COUNT -gt 0 ]]; then
    echo "⚠️  WARNING: $MISSING_COUNT files are MISSING after cherry-pick:"
    echo "$MISSING_FILES"
    echo ""
    echo "Restoring missing files from source commit..."

    while IFS= read -r file; do
        if [[ -n "$file" ]]; then
            mkdir -p "$(dirname "$file")"
            git show "$SOURCE_COMMIT:$file" > "$file"
            git add "$file"
            echo "  ✓ Restored: $file"
        fi
    done <<< "$MISSING_FILES"

    # Amend the cherry-pick commit with restored files
    git commit --amend --no-edit
    echo ""
    echo "✅ Missing files restored and commit amended."
else
    echo "✅ All files present - no restoration needed"
fi

# 5. Final verification
echo ""
echo "=== Final verification ==="
STILL_MISSING=0

while IFS= read -r file; do
    if [[ -n "$file" ]] && ! git ls-files --error-unmatch "$file" &>/dev/null; then
        ((STILL_MISSING++)) || true
    fi
done <<< "$SOURCE_FILES"

if [[ $STILL_MISSING -gt 0 ]]; then
    echo "❌ FATAL: Files still missing after restoration"
    echo "To reset: git reset --hard HEAD~1"
    exit 1
fi

echo "✅ All $SOURCE_COUNT files verified present in main"
echo ""
echo "=== Ready to push ==="
echo ""
echo "Push to main:"
echo "  git push origin $TARGET_BRANCH"
echo ""
echo "Return to feature branch:"
echo "  git checkout <your-feature-branch>"
