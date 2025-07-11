#!/bin/bash

# Replace YOUR_USERNAME with your GitHub username
GITHUB_USERNAME="YOUR_USERNAME"

# Add the remote origin
git remote add origin https://github.com/$GITHUB_USERNAME/eva-assistant.git

# Push to GitHub
git push -u origin main

echo "Repository pushed to GitHub successfully!"
echo "Next steps:"
echo "1. Go to your repository settings on GitHub"
echo "2. Set up branch protection rules if needed"
echo "3. Add collaborators if required"
echo "4. Configure secrets for GitHub Actions"