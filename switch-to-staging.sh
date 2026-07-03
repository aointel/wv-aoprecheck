#!/bin/bash

echo ""
echo "================================================"
echo "🔄 Switching to Staging Branch"
echo "================================================"
echo ""

# Check if staging branch exists locally
if git rev-parse --verify staging >/dev/null 2>&1; then
    echo "✅ Staging branch exists locally"
    git checkout staging
    git pull origin staging
    echo ""
    echo "✅ Now on staging branch and up to date!"
else
    echo "⚠️  Staging branch doesn't exist locally"
    echo ""
    echo "Creating staging branch..."
    git checkout -b staging
    
    # Try to pull if it exists remotely
    if git pull origin staging 2>/dev/null; then
        echo "✅ Pulled existing staging branch from remote"
    else
        echo "📤 Pushing new staging branch to remote"
        git push -u origin staging
    fi
    echo ""
    echo "✅ Created and switched to staging branch!"
fi

echo ""
echo "================================================"
echo "📋 YOU ARE NOW ON STAGING BRANCH"
echo "================================================"
echo ""
echo "All your changes will go to staging server"
echo ""
echo "To push changes:"
echo "  git add ."
echo "  git commit -m \"your message\""
echo "  git push"
echo ""
echo "To deploy to production later:"
echo "  git checkout master"
echo "  git merge staging"
echo "  git push"
echo ""

