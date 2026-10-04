# Cellar calendar sync

A Google Apps Script that keeps the "places left" count on the Cellar site in step with the Google Calendar invites. It is not part of the website: the site build ignores `tools/`, and the script runs in Google Apps Script.

## How it fits together

1. A guest accepts, declines or is added to a tasting invite in the Cellar calendar.
2. The script (`Code.gs`) recounts the places taken for every upcoming tasting:
   - an event belongs to a tasting when it falls on the tasting's date (Geneva time) and its description contains the Cellar tastings link, `silviodirubbo.github.io/cellar/tastings` (any page under it works, for example `https://silviodirubbo.github.io/cellar/tastings/sancerre-pouilly-fume/`). The event title does not matter then;
   - for an event whose description lacks the link, the title is the fallback: at least half of the tasting title's significant words must appear in the event title, so "Cellar: Sancerre & Pouilly-Fumé" matches "Sancerre & Pouilly-Fumé", and "Sancerre night" does not;
   - any other event on a tasting date (a birthday, a dinner) is skipped and logged. If two events match the same tasting, the first one counts and a warning is logged;
   - places taken = guests whose status is not "no" (yes, maybe and awaiting all count), leaving out only the organiser account. The host counts like any other guest. The count never goes below 0.
3. For each count that changed, it calls GitHub's `repository_dispatch` API (event type `availability-update`).
4. The GitHub Action `.github/workflows/update-availability.yml` writes the count to `_data/availability.yml` and commits to `main`. GitHub Pages redeploys a minute or two later.

The script runs on every calendar change and once an hour as a safety net. It only calls GitHub when a count has changed, and resends each count at most once a day. Repeats are harmless: the Action makes no commit when nothing changed.

**Every tasting invite needs the Cellar tastings link in its description.** The title fallback only exists for older invites; with the link, a tasting is never missed because of its event title, and a private event on the same date is never counted by mistake.

Example: an invite with 7 guests (4 yes, 3 awaiting), one of whom is the organiser account, gives 6 places taken, so the Tastings page shows "Fully booked" and the sign-up form shows "0 places available out of 6".

## Setup (Silvio only)

These steps need your Google and GitHub accounts, so only you can do them. They take about 10 minutes.

### 1. Create the GitHub token

1. Open <https://github.com/settings/personal-access-tokens/new> (Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token).
2. Token name: `cellar-calendar-sync`. Expiration: the longest you are comfortable with (for example 1 year). Put the expiry date in your calendar with a reminder two weeks before (see "Renewing the GitHub token" below).
3. Resource owner: `silviodirubbo`. Repository access: **Only select repositories**, then pick `cellar`.
4. Permissions > Repository permissions > **Contents: Read and write**. Leave everything else as it is (Metadata: Read-only is added automatically).
5. Click **Generate token** and copy it (it starts with `github_pat_`). GitHub shows it only once.

### 2. Create the Apps Script project

1. Sign in to Google as **cellar.geneve@gmail.com**, the account that owns the Cellar calendar and sends the invites.
2. Open <https://script.google.com> and click **New project**. Rename it `Cellar calendar sync`.
3. Replace the contents of `Code.gs` with the contents of `tools/calendar-sync/Code.gs` from this repo. Save.
4. Open **Project Settings** (the gear icon). Tick **Show "appsscript.json" manifest file in editor**, go back to the editor, and replace `appsscript.json` with the file of the same name in this folder. Save. This sets the time zone to Europe/Zurich.

### 3. Find the calendar ID

1. Open Google Calendar as cellar.geneve@gmail.com.
2. In the left sidebar, hover the Cellar calendar, click the three dots, then **Settings and sharing**.
3. Scroll to **Integrate calendar** and copy the **Calendar ID**. For the account's main calendar it is simply `cellar.geneve@gmail.com`.

### 4. Add the Script Properties

In the Apps Script project, **Project Settings > Script Properties > Add script property**. Add:

| Property | Value |
| --- | --- |
| `GITHUB_TOKEN` | the token from step 1 |
| `CALENDAR_ID` | the calendar ID from step 3 |
| `ORGANISER_EMAIL` | `cellar.geneve@gmail.com` |

Click **Save script properties**. The token stays in the script project and never goes into the repo.

### 5. Test without sending anything

1. In the editor, pick `dryRun` in the function menu at the top and click **Run**.
2. Google asks for permission the first time: **Review permissions**, choose cellar.geneve@gmail.com, then **Advanced > Go to Cellar calendar sync (unsafe) > Allow**. The warning appears because the script is your own and not published; it asks to read the calendar, connect to GitHub and manage its own triggers.
3. Open **Execution log**. You should see one line per upcoming tasting that has an invite, for example `[dry run] would send sancerre-pouilly-fume: 3 taken`. Each matched invite logs a line ending in `by link` or `by title (fallback, no link)`. For a fallback line, add the tasting link to that invite's description. Lines starting with `Skipped` mean an event fell on a tasting's date but had neither the link nor a matching title: if it is a tasting invite, add the link to its description. A `Warning:` line means two invites match the same tasting and only the first one counts: merge them into one invite.

### 6. Turn it on

1. Pick `setup` in the function menu and click **Run**. It installs the two triggers (calendar change and hourly) and runs a first real sync.
2. Check the result:
   - **Triggers** (the clock icon) lists `onCalendarChange` (From calendar) and `syncAll` (Time-driven, every hour);
   - the Execution log shows `sent` lines;
   - <https://github.com/silviodirubbo/cellar/actions/workflows/update-availability.yml> shows one green run per tasting sent;
   - after a couple of minutes the Tastings page shows "N places available" on each card ("1 place available" for one), and the sign-up form shows "N places available out of 6".

## Day to day

- When you create a tasting invite, paste the tasting's page link (for example `https://silviodirubbo.github.io/cellar/tastings/muscadet/`) into its description. Then invite guests as usual: their replies update the site within a few minutes.
- To change a tasting's capacity, set `capacity:` on that tasting in `_data/tastings.yml` (the default is 6). The site uses it straight away; the next sync records it in `_data/availability.yml`.
- To remove a tasting's count from the site, run the **Update availability** workflow from the Actions tab with `taken` set to `clear`. A later calendar change for that tasting brings it back.
- To push all counts again (for example after a GitHub outage), run `forceResend` in the Apps Script editor.
- If GitHub refuses an update (HTTP 401 means the token has expired or been revoked), the run still tries every tasting, then fails with "GitHub refused the update for ...", and Apps Script emails you about the failed run. Create a new token (step 1), replace `GITHUB_TOKEN` (step 4), then run `forceResend`.
- To get that email straight away rather than in a daily digest: **Triggers** (the clock icon), open each trigger, set **Failure notification settings** to **Notify me immediately**.

## Renewing the GitHub token

The fine-grained token has an expiry date. Renew it **before** it expires, so no update is lost:

1. Put the expiry date in your calendar when you create the token, with a reminder about two weeks earlier.
2. At the reminder: on <https://github.com/settings/personal-access-tokens>, open `cellar-calendar-sync` and click **Regenerate token** (or create a new one as in step 1 of the setup, with the same repository and Contents: Read and write).
3. Paste the new value into `GITHUB_TOKEN` in **Project Settings > Script Properties**, and save.
4. Run `dryRun`, then `forceResend`, and check for a green run under Actions > **Update availability**.

## Testing the GitHub side by hand

With a token in `$TOKEN`:

```sh
curl -X POST https://api.github.com/repos/silviodirubbo/cellar/dispatches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"event_type":"availability-update","client_payload":{"slug":"sancerre-pouilly-fume","taken":3}}'
```

GitHub answers `204 No Content`, and a run appears under Actions a few seconds later. Run it again with `"taken":"clear"` to remove the entry.
