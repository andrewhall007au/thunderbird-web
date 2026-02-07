# Quick Paths Reference

**Use this to avoid confusion between old and new projects!**

## Active Project: thunderbird-web

### Local Development
```
/Users/andrewhall/thunderbird-web/
```

### Production Server
```
root@thunderbird.bot:/root/thunderbird-web/
```

**Key Files:**
- Backend config: `/root/thunderbird-web/backend/.env`
- Database: `/root/thunderbird-web/backend/thunderbird.db`
- Monitoring config: `/root/thunderbird-web/backend/monitoring/config.py`

## Old Project: overland-weather (IGNORE!)

### Production (exists but NOT running)
```
/root/overland-weather/  ❌ DO NOT USE
```

This is dead code from the Tasmania-only version. It exists on the server but is not active.

## Quick Check Commands

**Verify you're in the right project:**
```bash
# Should show "thunderbird-web" NOT "overland-weather"
pwd
```

**Check what's actually running:**
```bash
ps aux | grep python | grep thunderbird-web
# Should show processes from /root/thunderbird-web/
```

**Edit production config (RIGHT location):**
```bash
nano /root/thunderbird-web/backend/.env
```

## Last Updated
2026-02-07 - Created to prevent confusion
