# Porchlight Dialer

A working demo of a seller follow-up dialer for a real estate investment team. When a seller replies to a text and is ready to talk, the system follows up with calls and texts while enforcing calling rules, and reports what should have happened against what did.

All leads, phone numbers (555 range) and addresses are fictional. Nothing is really dialed or texted.

## What it does

- **Dials only when an agent is free.** The dialer never rings more sellers than there are free agents, so the agent is connected the moment the seller answers.
- **Follow-up plans.** Each seller gets a scheduled plan of calls and texts. A new reply enrolls the seller automatically ("Simulate seller reply").
- **Calling rules, checked before every call and text:**
  - Do-not-call list (matched on the last 10 digits, any format). Checked first and always wins.
  - Daily call limit per seller.
  - Calling hours per state, in the seller's local time.
  - Text opt-outs.
- **Same-thread texts.** Missed-call and confirmation texts go into the conversation the seller already knows.
- **CRM write-back.** Every outcome is written to a CRM record (shown as the payload that would be sent to a monday.com board).
- **Daily report.** Planned touches vs. done, blocked, skipped and missed, grouped by reason and by seller.

## How the rules work

The rules live in [`rules.js`](rules.js) as pure functions with no DOM access, so the same code runs in the browser and in the tests.

| Function | Job |
| --- | --- |
| `canCall(lead, now, cfg)` | Returns `{ ok }` or `{ ok: false, kind, reason }`. `kind: 'block'` is permanent for the day (DNC, limit). `kind: 'wait'` means try again later (outside hours). |
| `canText(lead, now, cfg)` | Same idea for texts, plus opt-outs. |
| `evaluateQueue(leads, now, cfg)` | Every seller with a call due now, checked against the rules, earliest due first in Pacific time. |
| `planDial(leads, agents, now, cfg)` | Pairs free agents with ready sellers. Never returns more dials than free agents. |

Rule order matters: do-not-call, then daily limit, then calling hours. A do-not-call number is blocked even inside calling hours and under the limit.

Calling windows in the demo are sample settings (Florida ends at 8:00 PM to show a stricter state). Real windows should come from a compliance team.

## Run it

Open `index.html` in a browser. No build step and no dependencies.

## Run the tests

Needs Node 18 or newer.

```bash
npm test
```

15 tests cover calling-hour edges (start inclusive, end exclusive), time zones (including Arizona and past-midnight Eastern), DNC formatting and priority, daily limits, text opt-outs, queue ordering, and the free-agent dialing rule. The same rule checks also run in the app's Tests tab.

## Files

```
index.html          The app (UI, simulation, report)
rules.js            Calling rules and queue logic (pure functions)
tests/rules.test.js Node test suite for rules.js
```

## Built with

Claude Code for most of the typing. Every change was read and tested before it was committed.
