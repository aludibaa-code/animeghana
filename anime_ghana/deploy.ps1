# Deploy script for Anime Ghana -> GitHub + Pages
# Pre-filled for GitHub user: abduljabbar-code
# Usage: run this in PowerShell (as your user) from anywhere; it will cd into the project folder and run.

$Owner = "abduljabbar-code"
$Repo = "anime_ghana"
$Visibility = "public"
$Description = "Anime Ghana static site"
$ProjectPath = "C:\Users\GH\Desktop\anime_ghana"

Write-Output "Starting deploy script for $Owner/$Repo"

# Ensure gh is installed
if(-not (Get-Command gh -ErrorAction SilentlyContinue)){
    Write-Output "GitHub CLI (gh) not found. Please install it from https://cli.github.com/ and run 'gh auth login' before running this script. Exiting."
    exit 1
}

# Change to project directory
Set-Location -Path $ProjectPath

# Create .gitignore and README if missing
if(-not (Test-Path .gitignore)){
    @"
.DS_Store
node_modules/
*.log
"@ | Out-File -FilePath .gitignore -Encoding UTF8
    Write-Output "Created .gitignore"
}
if(-not (Test-Path README.md)){
    "# $Repo`n`nA static demo site for Anime Ghana." | Out-File -FilePath README.md -Encoding UTF8
    Write-Output "Created README.md"
}

# Initialize git if needed
if(-not (Test-Path .git)){
    git init
    git config user.name "Your Name"
    git config user.email "you@example.com"
    Write-Output "Initialized git repository"
}

# Add and commit
git add .
try{
    git commit -m "Initial site commit" --allow-empty | Out-Null
    Write-Output "Committed files"
}catch{
    Write-Output "Nothing to commit or commit failed: $_"
}

# Create repo on GitHub and push
$fullname = "$Owner/$Repo"
Write-Output "Creating GitHub repo $fullname (public)..."
try{
    gh repo create $fullname --$Visibility --description "$Description" --source=. --remote=origin --push --confirm 2>&1 | Write-Output
}catch{
    Write-Output "gh repo create returned: $_"
}

# Ensure branch main and push
git branch -M main 2>&1 | Write-Output
Write-Output "Pushing to origin/main..."
git push -u origin main 2>&1 | Write-Output

# Enable GitHub Pages via gh API
Write-Output "Enabling GitHub Pages (branch: main, path: /)..."
$body = '{"source":{"branch":"main","path":"/"}}'
$body | gh api --method PUT /repos/$Owner/$Repo/pages --input - 2>&1 | Write-Output

Write-Output "Deploy script finished. Check: https://github.com/$fullname/settings/pages for the publish URL (may take a minute)."
