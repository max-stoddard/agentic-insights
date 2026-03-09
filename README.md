# AI Water Usage

Local TypeScript dashboard that reads Codex usage artifacts from your machine and estimates water usage from token activity.

## Launch in one command

Requires Node `18+`.

```bash
npx ai-water-usage@latest
```

That command starts a local server, opens the dashboard in your browser, and reads Codex usage from your own machine.

If you want a reusable command instead:

```bash
npm install -g ai-water-usage
ai-water-usage
```

Supported launcher flags:

```bash
ai-water-usage --port 3001 --host 127.0.0.1
ai-water-usage --codex-home /path/to/.codex
ai-water-usage --no-open
```

## Run locally from the repo

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`

## What the app reads

By default the backend reads:

- `~/.codex/sessions`
- `~/.codex/archived_sessions`
- `~/.codex/log/codex-tui.log`

You can override the Codex home directory with `CODEX_HOME=/path/to/.codex` or `ai-water-usage --codex-home /path/to/.codex`.

## What the dashboard shows

- Total token usage
- Total estimated water usage with low, central, and high bounds
- Water usage aggregated by day, week, or month
- Coverage information for supported, excluded, and unestimated usage

## Methodology

### 1. Token extraction is exact from local logs

For each session file the backend reads only the fields needed for this dashboard:

- `session_meta`
- `turn_context`
- `event_msg` where `payload.type === "token_count"`

The parser treats `total_token_usage.total_tokens` as a cumulative session total and converts it into per-event deltas.

If `last_token_usage` is present, those split token counts are used directly.

If `last_token_usage` is missing but `total_token_usage.{input,output,cached_input}` is present, the backend derives split counts from differences between consecutive cumulative totals.

If a session has no usable `total_token_usage` rows at all, the backend can still recover token totals from `codex-tui.log`, but those events are marked `token_only` because split token counts are unavailable.

### 2. Tokens are converted into a cost-equivalent proxy

The UI does not show USD, but the app uses official OpenAI model pricing as a stable weighting proxy for relative inference intensity [3-8].

For each supported event:

```text
eventCostUsd =
  inputTokens / 1,000,000 * inputPrice
  + cachedInputTokens / 1,000,000 * cachedInputPrice
  + outputTokens / 1,000,000 * outputPrice
```

Supported pricing table used in this app:

| Model | Input / 1M | Cached input / 1M | Output / 1M |
| --- | ---: | ---: | ---: |
| `gpt-5.1-codex-mini` | `$0.25` | `$0.025` | `$2.00` |
| `gpt-5.1-codex-max` | `$1.25` | `$0.125` | `$10.00` |
| `gpt-5.2-codex` | `$1.75` | `$0.175` | `$14.00` |
| `gpt-5.3-codex` | `$1.75` | `$0.175` | `$14.00` |
| `gpt-5.4` | `$2.50` | `$0.25` | `$15.00` |

### 3. The app calibrates against your own local usage history

Absolute litres per token are not observable from Codex logs.

So the app creates a local reference event cost on first run:

```text
referenceEventCostUsd = median(eventCostUsd)
```

This median is computed across all supported positive-usage events found in your local history and persisted to:

- Linux: `~/.cache/ai-water-usage/calibration.json`
- macOS: `~/Library/Caches/ai-water-usage/calibration.json`
- Windows: `%LOCALAPPDATA%\ai-water-usage\calibration.json`

You can override the cache location with `AI_WATER_USAGE_CACHE_DIR=/path/to/cache`.

This makes the dashboard stable across refreshes while still being anchored to the token mix in your own logs.

### 4. The app converts the weighted proxy into water

The app uses three benchmark coefficients taken from Li, Yang, Islam, and Ren's "Making AI Less 'Thirsty'" benchmark discussion [1,2].

These values come from the paper's "total water for each request" benchmarks for a GPT-3 medium-sized request with `10` input tokens and `50` output tokens:

- Low: `0.010585 L` from Georgia
- Central: `0.016904 L` from the U.S. average
- High: `0.029926 L` from Arizona

For each supported event:

```text
lowLitres = eventCostUsd / referenceEventCostUsd * 0.010585
centralLitres = eventCostUsd / referenceEventCostUsd * 0.016904
highLitres = eventCostUsd / referenceEventCostUsd * 0.029926
```

In this app, those literature values act as low, central, and high benchmark anchors after pricing-weighted usage has been normalized by your local median event.

They are not a physical measurement from your machine.

### 5. What is excluded from water totals

The app intentionally does not guess when it lacks enough information.

Excluded from water totals:

- Unsupported providers and models, such as local `ollama` sessions
- `token_only` fallback events recovered from TUI totals without split token counts

These still appear in token totals and coverage summaries so the dashboard stays honest about what is and is not estimated.

### 6. Why this is an estimate, not a meter reading

The dashboard is exact about tokens, but only estimated about water.

The main uncertainty comes from three places:

- OpenAI price ratios are being used as a compute-intensity proxy, not as billed spend shown to the user
- The local median calibration step is a normalization choice, not a physical measurement
- The low/central/high benchmark coefficients are literature benchmarks taken from a GPT-3 request scenario and then reused as anchors for Codex events after local normalization [1,2]

## API

- `GET /api/overview`
- `GET /api/timeseries?bucket=day|week|month&tz=Europe/London`
- `GET /api/methodology`

`tz` should be an IANA timezone such as `Europe/London` or `America/Los_Angeles`. The frontend sends the browser timezone so day/week/month aggregation follows the user's local calendar boundaries.

## Quality checks

```bash
npm run lint
npm run test
npm run build
npm run test:pack
```

## References

[1] Li P, Yang J, Islam MA, Ren S. Making AI Less "Thirsty". Commun ACM. 2025;68(7):54-61. doi:10.1145/3724499

[2] Li P, Yang J, Islam MA, Ren S. Making AI Less "Thirsty": Uncovering and Addressing the Secret Water Footprint of AI Models [Internet]. arXiv:2304.03271; 2023 [cited 2026 Mar 9]. Available from: https://arxiv.org/abs/2304.03271

[3] OpenAI. Pricing [Internet]. 2026 [cited 2026 Mar 9]. Available from: https://openai.com/api/pricing/

[4] OpenAI. GPT-5.1-Codex Mini model [Internet]. 2026 [cited 2026 Mar 9]. Available from: https://developers.openai.com/api/docs/models/gpt-5.1-codex-mini

[5] OpenAI. GPT-5.1-Codex Max model [Internet]. 2026 [cited 2026 Mar 9]. Available from: https://developers.openai.com/api/docs/models/gpt-5.1-codex-max

[6] OpenAI. GPT-5.2-Codex model [Internet]. 2026 [cited 2026 Mar 9]. Available from: https://developers.openai.com/api/docs/models/gpt-5.2-codex

[7] OpenAI. GPT-5.3-Codex model [Internet]. 2026 [cited 2026 Mar 9]. Available from: https://developers.openai.com/api/docs/models/gpt-5.3-codex

[8] OpenAI. GPT-5.4 model [Internet]. 2026 [cited 2026 Mar 9]. Available from: https://developers.openai.com/api/docs/models/gpt-5.4
