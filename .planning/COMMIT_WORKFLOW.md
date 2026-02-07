# Commit Workflow - MANDATORY STEPS

## THE PROBLEM

Repeatedly, code changes have been made but not committed to git, causing:
- Session handoffs claiming fixes were made when they weren't in git
- Production deployments not getting the latest changes
- Confusion about what code is actually running in production

## THE RULE

**EVERY code change MUST be committed and pushed IMMEDIATELY after making it.**

There are NO exceptions. If you write code, you commit it. Period.

## MANDATORY WORKFLOW

### 1. Make Changes
- Edit files
- Test locally if needed

### 2. Commit IMMEDIATELY (not later, NOW)
```bash
git add <files>
git commit -m "descriptive message"
```

### 3. Push IMMEDIATELY (not later, NOW)
```bash
git push origin main
```

### 4. Only THEN move to next task

## Before Creating Session Handoffs

Before writing ANY session handoff document:

```bash
# Check for uncommitted changes
git status

# If there are ANY changes, commit them NOW
git add .
git commit -m "..."
git push origin main

# Only proceed to write session doc after clean status
```

## Before Ending Any Session

```bash
# Always run before ending
git status

# If not clean, commit everything NOW
```

## Git Hook Installed

A pre-push hook is now installed at `.git/hooks/pre-push` that will:
- Warn you if you're pushing with uncommitted changes
- Force you to acknowledge the uncommitted changes
- Give you a chance to cancel and commit first

## For Claude/AI Assistants

When working on this codebase:

1. ✅ After EVERY file edit, commit and push
2. ✅ Before creating session handoffs, verify `git status` is clean
3. ✅ Before ending sessions, verify `git status` is clean
4. ✅ If you document a fix in a session doc, that fix MUST already be committed
5. ❌ NEVER write session docs claiming fixes were made if they're not committed

## Verification Commands

Always run these before claiming work is "done":

```bash
# Show what's uncommitted
git status

# Show the last few commits
git log --oneline -5

# Verify latest commit is pushed
git log origin/main..HEAD  # Should be empty
```

If the last command shows commits, you haven't pushed yet!

## Production Deployment Checklist

Before deploying to production:

- [ ] `git status` is clean (no uncommitted changes)
- [ ] All commits are pushed (`git log origin/main..HEAD` is empty)
- [ ] You can see your commits in `git log --oneline -5`
- [ ] You've verified the changes you want to deploy are in the latest commit

## This Is Not Optional

This is a **MANDATORY** workflow. Following it prevents production issues and wasted debugging time.
