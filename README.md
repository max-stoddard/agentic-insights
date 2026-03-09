# AI Water Usage

Local TypeScript dashboard that reads Codex usage artifacts from your machine and estimates water usage from token activity.

## Run locally

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

You can override the Codex home directory with `CODEX_HOME=/path/to/.codex`.

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

The UI does not show USD, but the app uses official OpenAI model pricing as a stable weighting proxy for relative inference intensity.

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

Source URLs:

- `https://developers.openai.com/api/docs/models/gpt-5.1-codex-mini`
- `https://developers.openai.com/api/docs/models/gpt-5.1-codex-max`
- `https://developers.openai.com/api/docs/models/gpt-5.2-codex`
- `https://developers.openai.com/api/docs/models/gpt-5.3-codex`
- `https://developers.openai.com/api/docs/models/gpt-5.4`
- `https://openai.com/api/pricing/`

### 3. The app calibrates against your own local usage history

Absolute litres per token are not observable from Codex logs.

So the app creates a local reference event cost on first run:

```text
referenceEventCostUsd = median(eventCostUsd)
```

This median is computed across all supported positive-usage events found in your local history and persisted to:

- `.cache/calibration.json`

This makes the dashboard stable across refreshes while still being anchored to the token mix in your own logs.

### 4. The app converts the weighted proxy into water

The app uses three fixed benchmark coefficients:

- Low: `0.010619 L`
- Central: `0.016904 L`
- High: `0.029915 L`

For each supported event:

```text
lowLitres = eventCostUsd / referenceEventCostUsd * 0.010619
centralLitres = eventCostUsd / referenceEventCostUsd * 0.016904
highLitres = eventCostUsd / referenceEventCostUsd * 0.029915
```

These coefficients are a product-level assumption layer. They are intended to represent a conservative, central, and high benchmark for one reference query-sized event once pricing-weighted usage has been normalized by your local median event.

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
- The low/central/high benchmark coefficients are fixed assumptions chosen for this app

The CACM coverage of Shaolei Ren's water-footprint work is the main public benchmark context for the broader question of AI water consumption:

- `https://cacm.acm.org/news/making-ai-less-thirsty/`

Sam Altman has also publicly described materially lower per-query water usage in public commentary. This dashboard does not use that lower claim as its primary coefficient set because it is not a model-specific pricing-weighted method and does not line up with the fixed benchmark assumptions used here.

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
```
