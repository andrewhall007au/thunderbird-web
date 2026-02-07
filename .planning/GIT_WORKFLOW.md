# Git Workflow & Branching Strategy

**Last Updated:** 2026-02-07

## Production Branch

**⚠️ PRODUCTION ALWAYS USES `main` BRANCH**

```bash
# Production server should ALWAYS be on main
cd /root/thunderbird-web
git branch  # Should show: * main
```

## Branch Strategy

### `main` Branch
- **Purpose:** Production-ready code
- **Protection:** Deploy to production from this branch ONLY
- **Deployment:** Production server pulls from `main`

### `feature/*` Branches (Local Development)
- **Purpose:** New features or fixes in development
- **Example:** `feature/add-stripe-integration`
- **Workflow:**
  ```bash
  # Create feature branch
  git checkout -b feature/my-feature main

  # Work on feature
  git add .
  git commit -m "feat: add my feature"

  # When ready, merge to main
  git checkout main
  git merge feature/my-feature
  git push origin main

  # Delete feature branch
  git branch -d feature/my-feature
  ```

### Version Tags (NOT Branches!)
- **Purpose:** Mark releases for reference
- **Example:** `v1.0`, `v1.1`, `v2.0`
- **Usage:** Tags only, not branches
- **⚠️ DO NOT checkout version branches in production!**

## Common Operations

### Deploy to Production
```bash
# 1. On local machine - ensure changes are on main
git checkout main
git add .
git commit -m "your changes"
git push origin main

# 2. On production server - pull main
ssh root@thunderbird.bot
cd /root/thunderbird-web
git checkout main  # Verify on main!
git pull origin main
systemctl restart thunderbird-api thunderbird-web thunderbird-monitoring
```

### Check Current Branch
```bash
# Production
ssh root@thunderbird.bot
cd /root/thunderbird-web
git branch  # Should show: * main

# Local
cd /Users/andrewhall/thunderbird-web
git branch  # Should show: * main (or feature branch during development)
```

### Fix: Production on Wrong Branch
```bash
# If production is on v1.1 or another branch
ssh root@thunderbird.bot
cd /root/thunderbird-web
git stash  # Save any uncommitted changes
git checkout main
git pull origin main
systemctl restart thunderbird-api thunderbird-web thunderbird-monitoring
```

## What Went Wrong Before

**Problem:** Production was left on `v1.1` branch from old deployment
**Result:** New changes pushed to `main` didn't appear in production
**Solution:** Always keep production on `main` branch

## Pre-Deployment Checklist

Before deploying:
- [ ] Local changes committed to `main` branch
- [ ] Changes pushed to GitHub (`git push origin main`)
- [ ] Production server on `main` branch (`git branch` shows `* main`)
- [ ] Pull latest on production (`git pull origin main`)
- [ ] Restart affected services
- [ ] Verify deployment (`systemctl status <service>`)

## Quick Reference

| Environment | Branch | Command |
|-------------|--------|---------|
| **Production** | `main` | `git checkout main && git pull origin main` |
| **Local Dev** | `main` or `feature/*` | `git checkout -b feature/name` |
| **Tags** | N/A | `git tag v1.0` (reference only) |

## Rules

1. ✅ **DO:** Develop on `main` or feature branches locally
2. ✅ **DO:** Always deploy from `main` to production
3. ✅ **DO:** Use tags (not branches) for version markers
4. ❌ **DON'T:** Deploy from version branches (v1.1, v1.2)
5. ❌ **DON'T:** Leave production on feature branches
6. ❌ **DON'T:** Commit directly on production server

---

**Remember:** Production = `main` branch, always!
