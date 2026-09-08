import crypto from "node:crypto";
import fs from "node:fs/promises";

const INCIDENT_LABEL = "pricing-sync-incident";
const BLOCKED_LABEL = "pricing-sync-blocked";
const RECIPIENT = "max-stoddard";
const REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000;

function getArgument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

export function shouldSendIncidentReminder(lastReminderAt, now = new Date()) {
  const parsed = Date.parse(lastReminderAt);
  return !Number.isFinite(parsed) || now.getTime() - parsed >= REMINDER_INTERVAL_MS;
}

function fingerprintFor(phase, report) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        phase,
        reportFingerprint: report?.fingerprint ?? null,
        hardFailures: report?.hardFailures ?? [],
        suspiciousReasons: report?.suspiciousReasons ?? [],
        error: report?.error ?? null
      })
    )
    .digest("hex");
}

function marker(name, value) {
  return `<!-- pricing-sync-${name}:${value} -->`;
}

function readMarker(body, name) {
  return new RegExp(`<!-- pricing-sync-${name}:([^ ]+) -->`).exec(body)?.[1] ?? null;
}

function formatList(values) {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- No structured details were available; inspect the workflow logs.";
}

function buildBody({ phase, report, runUrl, fingerprint, now }) {
  const sourceRevision = report?.sourceRevision ?? "unresolved";
  const reasons = [...(report?.hardFailures ?? []), ...(report?.suspiciousReasons ?? [])];
  return `${marker("fingerprint", fingerprint)}\n${marker("reminded-at", now.toISOString())}\n\n@${RECIPIENT}, automated pricing has stopped before merge or publication.\n\n- Phase: **${phase}**\n- Portkey source revision: \`${sourceRevision}\`\n- Workflow run: ${runUrl}\n\n## Reasons\n\n${formatList(reasons)}\n\n## Human review\n\nInspect the workflow artifact and upstream diff. For a legitimate soft-threshold change, manually run **Pricing catalog sync** with \`source_revision=${sourceRevision}\` and \`approve_suspicious=true\`. Hard validation, test, version, tag, and publication failures cannot be bypassed.\n`;
}

async function api(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "User-Agent": "agentic-insights-pricing-incident",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${options.method ?? "GET"} ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

async function ensureLabel(repository, name, color, description) {
  const response = await fetch(`https://api.github.com/repos/${repository}/labels`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "agentic-insights-pricing-incident",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({ name, color, description })
  });
  if (!response.ok && response.status !== 422) {
    throw new Error(`Unable to create label ${name}: ${response.status} ${await response.text()}`);
  }
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !process.env.GITHUB_TOKEN) {
    throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required for incident reporting.");
  }

  const phase = getArgument("--phase", "unknown");
  const reportPath = getArgument("--report");
  const runUrl = getArgument("--run-url", `https://github.com/${repository}/actions`);
  const report = reportPath ? JSON.parse(await fs.readFile(reportPath, "utf8")) : {};
  const fingerprint = fingerprintFor(phase, report);
  const now = new Date();

  await ensureLabel(repository, INCIDENT_LABEL, "B60205", "Automated pricing needs human attention");
  await ensureLabel(repository, BLOCKED_LABEL, "D93F0B", "Publication is blocked by a pricing safeguard");

  const issues = await api(`/repos/${repository}/issues?state=open&labels=${INCIDENT_LABEL}&per_page=100`);
  const existing = issues.find((issue) => issue.body?.includes(marker("fingerprint", fingerprint)));
  if (existing) {
    const lastReminderAt = readMarker(existing.body ?? "", "reminded-at") ?? existing.created_at;
    if (!shouldSendIncidentReminder(lastReminderAt, now)) {
      process.stdout.write(`Incident #${existing.number} already reported; reminder suppressed.\n`);
      return;
    }

    await api(`/repos/${repository}/issues/${existing.number}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: `@${RECIPIENT}, this pricing incident remains unresolved after seven days. Latest run: ${runUrl}` })
    });
    const updatedBody = (existing.body ?? "").replace(
      marker("reminded-at", lastReminderAt),
      marker("reminded-at", now.toISOString())
    );
    await api(`/repos/${repository}/issues/${existing.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: updatedBody })
    });
    return;
  }

  await api(`/repos/${repository}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `[pricing-sync] Human review required during ${phase}`,
      body: buildBody({ phase, report, runUrl, fingerprint, now }),
      assignees: [RECIPIENT],
      labels: [INCIDENT_LABEL, BLOCKED_LABEL]
    })
  });
}

if (process.argv[1]?.endsWith("report-pricing-incident.mjs")) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
