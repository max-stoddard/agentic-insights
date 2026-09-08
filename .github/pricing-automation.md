# Pricing release automation

The `Pricing catalog sync` workflow checks Portkey every day at 06:17 UTC and can also be run manually. Changes to OpenAI, Anthropic, Google, OpenRouter, and Dashscope pricing can prepare an automated patch release; changes to other providers remain bundled only when a monitored provider triggers a release.

## One-time repository setup

1. In **Settings → Actions → General → Workflow permissions**, grant read/write access and enable **Allow GitHub Actions to create and approve pull requests**.
2. Ensure branch rules allow the `Pricing release validation` jobs to merge the automation PR without a human approval after all required checks pass.
3. Enable GitHub email notifications for issue assignments and mentions on `@max-stoddard`.
4. Keep npm trusted publishing configured for `.github/workflows/release.yml`; `NPM_TOKEN` remains an optional fallback.

Normal no-change and successful runs do not mention or assign anyone. Suspicious changes and failures create a deduplicated `pricing-sync-incident` issue. The first incident is emailed through GitHub notifications, with another reminder after each unresolved seven-day interval.

## Reviewing a blocked catalog change

The incident links the workflow artifact, normalized price diff, and exact Portkey source revision. If a change is legitimate and only soft safeguards failed:

1. Open **Actions → Pricing catalog sync → Run workflow**.
2. Enter the incident's exact SHA in `source_revision`.
3. Enable `approve_suspicious`.
4. Leave `check_only` disabled to prepare and publish the release.

Exact-SHA approval cannot bypass download, schema, provider, new or changed duplicate-identity, numeric, test, version, tag, or publication failures. Use `check_only` to inspect a revision without opening a PR or incident.

If publication fails after a tag is created, resolve the reported cause and manually run **Release** with that existing tag. The daily sync will not prepare another version while the current package version is missing from npm.
