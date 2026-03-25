# Affirmation reminder status

Date checked: 2026-03-25 UTC

## Current state

A **no-AI script path is prepared in the workspace and now formats the reminder in the required hard-line structure**.

Prepared files:
- Sender script: `/home/marco/.openclaw/workspace/scripts/send-affirmations.sh`
- Editable affirmation source: `/home/marco/.openclaw/workspace/config/affirmations.txt`
- User systemd service: `/home/marco/.openclaw/workspace/systemd/user/affirmations-reminder.service`
- User systemd timer: `/home/marco/.openclaw/workspace/systemd/user/affirmations-reminder.timer`
- Install notes: `/home/marco/.openclaw/workspace/systemd/user/README.md`

## Current reminder content shape

The script-based reminder now starts with exactly:

```text
Marco Fernstaedt principal of dominion edge holdings
```

Then it lists the remaining affirmations as a clean numbered list with no extra header fluff.

## Cleanest implementation path from current host access

`crontab` / `cron` are not installed on this host.

However, `systemctl --user` is available and user linger is enabled, so the cleanest non-AI scheduler here is a **user-level systemd timer**, not OpenClaw cron.

The timer is configured for Marco's requested fixed MST delivery times:
- 5:00 AM MST = 12:00 UTC
- 9:00 PM MST = 04:00 UTC

## Exact remaining step to replace the AI reminder

I did **not** install or enable the timer automatically from this task.

The remaining cutover is:
1. Copy the prepared unit files into `~/.config/systemd/user/`
2. Run `systemctl --user daemon-reload`
3. Run `systemctl --user enable --now affirmations-reminder.timer`
4. Test once with `systemctl --user start affirmations-reminder.service`
5. After confirming delivery, disable/remove the old AI/OpenClaw affirmation cron jobs:
   - `42ed0736-343b-4ed3-b390-8e434acc44e7`
   - `f9058daf-fa1a-4d94-8754-251d733261c2`

Once step 5 is done, the AI-based reminder is fully off and the script/timer path is the only active reminder path.
