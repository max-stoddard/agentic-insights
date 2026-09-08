import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

const fetchMock = vi.fn<typeof fetch>();

interface DashboardResponseOptions {
  weeklyGrowth?: {
    sessions: { current: number; previous: number; increase: number };
    prompts: { current: number; previous: number; increase: number };
    tokens: { current: number; previous: number; increase: number };
  };
  coverageSummary?: {
    sessions: number;
    prompts: number;
  };
  highestSpendSessions?: Array<Record<string, unknown>>;
  supportedTokens?: number;
  waterLitres?: {
    low: number;
    central: number;
    high: number;
  };
  energyKwh?: number;
  carbonKgCo2?: number;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function createReadyOverviewResponse(options?: DashboardResponseOptions) {
  const weeklyGrowth = options?.weeklyGrowth ?? {
    sessions: { current: 12, previous: 9, increase: 3 },
    prompts: { current: 47, previous: 41, increase: 6 },
    tokens: { current: 900, previous: 650, increase: 250 }
  };
  const coverageSummary = options?.coverageSummary ?? {
    sessions: 12,
    prompts: 47
  };
  const highestSpendSessions = options?.highestSpendSessions ?? [
    {
      sessionId: "session-top-1",
      title: "Investigate slow spend spikes",
      primaryProvider: "openai",
      primaryModel: "gpt-5.4",
      additionalModelCount: 1,
      lastActiveAt: Date.parse("2026-03-09T16:20:00.000Z"),
      promptCount: 18,
      totalTokens: 1450,
      supportedTokens: 1300,
      excludedTokens: 0,
      unestimatedTokens: 150,
      apiCostUsd: 0.0371,
      waterLitres: {
        low: 0.22,
        central: 0.61,
        high: 1.05
      },
      energyKwh: 0.148,
      carbonKgCo2: 0.06586,
      statusNote: "includes fallback-only usage"
    },
    {
      sessionId: "session-top-2",
      title: "Audit Claude cost drift",
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4",
      additionalModelCount: 0,
      lastActiveAt: Date.parse("2026-03-08T13:40:00.000Z"),
      promptCount: 11,
      totalTokens: 820,
      supportedTokens: 820,
      excludedTokens: 0,
      unestimatedTokens: 0,
      apiCostUsd: 0.0214,
      waterLitres: {
        low: 0.12,
        central: 0.31,
        high: 0.54
      },
      energyKwh: 0.074,
      carbonKgCo2: 0.03293,
      statusNote: null
    },
    {
      sessionId: "session-top-3",
      title: "Trace Gemini token spikes",
      primaryProvider: "google",
      primaryModel: "gemini-1.5-pro",
      additionalModelCount: 0,
      lastActiveAt: Date.parse("2026-03-07T09:10:00.000Z"),
      promptCount: 6,
      totalTokens: 610,
      supportedTokens: 540,
      excludedTokens: 70,
      unestimatedTokens: 0,
      apiCostUsd: 0.0112,
      waterLitres: {
        low: 0.07,
        central: 0.18,
        high: 0.32
      },
      energyKwh: 0.043,
      carbonKgCo2: 0.0191,
      statusNote: "includes unpriced usage"
    }
  ];
  const supportedTokens = options?.supportedTokens ?? 900;
  const waterLitres = options?.waterLitres ?? {
    low: 0.5,
    central: 1.2,
    high: 2.1
  };
  const energyKwh = options?.energyKwh ?? 0.168;
  const carbonKgCo2 = options?.carbonKgCo2 ?? 0.168 * 0.445;

  return {
    tokenTotals: {
      totalTokens: 1000,
      supportedTokens,
      excludedTokens: 50,
      unestimatedTokens: 50
    },
    waterLitres,
    energyKwh,
    carbonKgCo2,
    coverage: {
      supportedEvents: 9,
      excludedEvents: 1,
      tokenOnlyEvents: 1
    },
    coverageSummary: {
      sessions: coverageSummary.sessions,
      prompts: coverageSummary.prompts,
      excludedModels: 2
    },
    weeklyGrowth,
    modelUsage: [
      {
        provider: "openai",
        model: "gpt-5.4",
        totalTokens: 950,
        events: 10,
        supportedTokens: 900,
        excludedTokens: 0,
        unestimatedTokens: 50,
        apiCostUsd: 0.0325,
        status: "allowed",
        statusNote: "includes fallback-only usage"
      },
      {
        provider: "anthropic",
        model: "claude-sonnet-4",
        totalTokens: 120,
        events: 3,
        supportedTokens: 120,
        excludedTokens: 0,
        unestimatedTokens: 0,
        apiCostUsd: 0.00456,
        status: "allowed",
        statusNote: null
      },
      {
        provider: "anthropic",
        model: "qwen3.5:9b",
        totalTokens: 50,
        events: 1,
        supportedTokens: 0,
        excludedTokens: 50,
        unestimatedTokens: 0,
        apiCostUsd: 0,
        status: "unknown",
        statusNote: "pricing not available yet"
      },
      {
        provider: "ollama",
        model: "qwen2.5-coder:7b",
        totalTokens: 40,
        events: 1,
        supportedTokens: 0,
        excludedTokens: 40,
        unestimatedTokens: 0,
        apiCostUsd: 0,
        status: "local",
        statusNote: "Ran on local hardware"
      }
    ],
    highestSpendSessions,
    coverageDetails: [
      {
        provider: "openai",
        model: "gpt-5.4",
        source: "VS Code extension",
        tokens: 900,
        events: 9,
        classification: "supported",
        reason: null
      },
      {
        provider: "anthropic",
        model: "claude-sonnet-4",
        source: "Claude Code",
        tokens: 120,
        events: 3,
        classification: "supported",
        reason: null
      },
      {
        provider: "anthropic",
        model: "qwen3.5:9b",
        source: "CLI",
        tokens: 50,
        events: 1,
        classification: "excluded",
        reason: "Unknown model: qwen3.5:9b"
      },
      {
        provider: "ollama",
        model: "qwen2.5-coder:7b",
        source: "CLI",
        tokens: 40,
        events: 1,
        classification: "excluded",
        reason: "Local usage: qwen2.5-coder:7b"
      },
      {
        provider: "openai",
        model: "gpt-5.4",
        source: "CLI",
        tokens: 50,
        events: 1,
        classification: "token_only",
        reason: "Token totals are available, but token splits needed for pricing-weighted estimation are missing."
      }
    ],
    indexing: null,
    diagnostics: {
      state: "ready",
      codexHome: "/tmp/.codex",
      message: null
    },
    exclusions: [
      {
        provider: "anthropic",
        model: "qwen3.5:9b",
        source: "CLI",
        tokens: 50,
        events: 1,
        reason: "Unknown model: qwen3.5:9b"
      },
      {
        provider: "ollama",
        model: "qwen2.5-coder:7b",
        source: "CLI",
        tokens: 40,
        events: 1,
        reason: "Local usage: qwen2.5-coder:7b"
      }
    ],
    lastIndexedAt: Date.parse("2026-03-09T12:00:00.000Z"),
    calibration: {
      referenceEventCostUsd: 0.123,
      computedAt: Date.parse("2026-03-09T12:00:00.000Z"),
      supportedEventCount: 9,
      supportedMedianSource: "local_median_event_cost_usd"
    }
  };
}

function createMethodologyResponse() {
  return {
    pricingTable: [
      {
        provider: "openai",
        model: "gpt-5.2-codex",
        inputUsdPerMillion: 1.75,
        cachedInputUsdPerMillion: 0.175,
        outputUsdPerMillion: 14,
        sourceUrl: "https://raw.githubusercontent.com/Portkey-AI/models/main/pricing/openai.json",
        sourceLabel: "Portkey pricing: openai.json"
      },
      {
        provider: "anthropic",
        model: "claude-sonnet-4",
        inputUsdPerMillion: 3,
        cachedInputUsdPerMillion: 0.3,
        outputUsdPerMillion: 15,
        sourceUrl: "https://raw.githubusercontent.com/Portkey-AI/models/main/pricing/anthropic.json",
        sourceLabel: "Portkey pricing: anthropic.json"
      }
    ],
    benchmarkCoefficients: {
      low: 0.010585,
      central: 0.016904,
      high: 0.029926
    },
    energyBenchmarkKwh: 0.004,
    carbonIntensityKgCo2PerKwh: 0.445,
    carbonBenchmarkKgCo2: 0.00178,
    calibration: {
      referenceEventCostUsd: 0.123,
      computedAt: Date.parse("2026-03-09T12:00:00.000Z"),
      supportedEventCount: 9,
      supportedMedianSource: "local_median_event_cost_usd"
    },
    exclusions: [],
    pricingCatalog: {
      generatedAt: "2026-03-13T12:00:00.000Z",
      sourceRevision: "0123456789abcdef0123456789abcdef01234567",
      sourceRepoUrl: "https://github.com/Portkey-AI/models",
      sourceDirectoryUrl: "https://github.com/Portkey-AI/models/tree/main/pricing",
      licenseUrl: "https://raw.githubusercontent.com/Portkey-AI/models/main/LICENSE",
      providerCount: 39,
      modelCount: 1971
    },
    sourcesByTab: {
      prompts: [
        { label: "Portkey models repo (MIT)", url: "https://github.com/Portkey-AI/models" },
        { label: "Portkey MIT license", url: "https://raw.githubusercontent.com/Portkey-AI/models/main/LICENSE" }
      ],
      water: [
        {
          label: "NIST Metric Kitchen: Cooking Measurement Equivalencies",
          url: "https://www.nist.gov/pml/owm/metric-kitchen-cooking-measurement-equivalencies"
        },
        {
          label: "EFSA Dietary Reference Values for Water",
          url: "https://www.efsa.europa.eu/en/efsajournal/pub/1459"
        },
        {
          label: "CACM DOI: Making AI Less 'Thirsty' (Li, Yang, Islam, Ren)",
          url: "https://doi.org/10.1145/3724499"
        },
        {
          label: "arXiv: Uncovering and Addressing the Secret Water Footprint of AI Models",
          url: "https://arxiv.org/abs/2304.03271"
        },
        {
          label: "Ecological Economics DOI: The water footprint of coffee and tea consumption in the Netherlands",
          url: "https://doi.org/10.1016/j.ecolecon.2007.02.022"
        },
        {
          label: "Sustainability Science DOI: Comparing ecological and water footprint of denim jeans and a tri-blend T-shirt",
          url: "https://doi.org/10.1007/s11625-022-01131-0"
        },
        {
          label: "Environmental Science & Technology DOI: Water Footprint of European Cars: Potential Impacts of Water Consumption along Automobile Life Cycles",
          url: "https://doi.org/10.1021/es2040043"
        },
        {
          label: "GCSAA Golf Course Environmental Profile: Phase II Water Use and Conservation Practices on U.S. Golf Courses",
          url: "https://www.gcsaa.org/docs/default-source/Environment/phase-2-water-use-survey-full-report.pdf?sfvrsn=2b39123e_4"
        }
      ],
      energy: [
        {
          label: "CACM DOI: Making AI Less 'Thirsty' (Li, Yang, Islam, Ren)",
          url: "https://doi.org/10.1145/3724499"
        },
        {
          label: "arXiv: Uncovering and Addressing the Secret Water Footprint of AI Models",
          url: "https://arxiv.org/abs/2304.03271"
        },
        {
          label: "NeurIPS 2020: Language Models are Few-Shot Learners (Brown et al.)",
          url: "https://papers.nips.cc/paper/2020/file/1457c0d6bfcb4967418bfb8ac142f64a-Paper.pdf"
        },
        {
          label: "JMLR 2023: Estimating the Carbon Footprint of BLOOM",
          url: "https://jmlr.org/papers/v24/23-0069.html"
        }
      ],
      carbon: [
        { label: "IEA Electricity 2025: Emissions", url: "https://www.iea.org/reports/electricity-2025/emissions" },
        { label: "GHG Protocol Scope 2 Guidance", url: "https://ghgprotocol.org/scope_2_guidance" },
        {
          label: "GHG Protocol Scope 2 Frequently Asked Questions",
          url: "https://ghgprotocol.org/scope-2-frequently-asked-questions"
        },
        {
          label: "CACM DOI: Making AI Less 'Thirsty' (Li, Yang, Islam, Ren)",
          url: "https://doi.org/10.1145/3724499"
        },
        {
          label: "arXiv: Uncovering and Addressing the Secret Water Footprint of AI Models",
          url: "https://arxiv.org/abs/2304.03271"
        }
      ]
    }
  };
}

function createTimeseriesResponse(bucket: "day" | "week" | "month", overview = createReadyOverviewResponse()) {
  const rawApiCostUsd = overview.modelUsage.reduce((total, item) => total + item.apiCostUsd, 0);

  if (bucket === "day") {
    return {
      bucket: "day",
      points: [
        {
          startTs: Date.parse("2026-03-09T00:00:00.000Z"),
          key: "2026-03-09",
          label: "9 Mar 2026",
          tokens: 1000,
          excludedTokens: 50,
          unestimatedTokens: 50,
          apiCostUsd: rawApiCostUsd,
          waterLitres: overview.waterLitres,
          energyKwh: overview.energyKwh,
          carbonKgCo2: overview.carbonKgCo2
        }
      ]
    };
  }

  if (bucket === "week") {
    return {
      bucket: "week",
      points: [
        {
          startTs: Date.parse("2026-03-09T00:00:00.000Z"),
          key: "2026-W11",
          label: "Week of 9 Mar 2026",
          tokens: 2000,
          excludedTokens: 100,
          unestimatedTokens: 100,
          apiCostUsd: 0.083,
          waterLitres: {
            low: 1,
            central: 2.4,
            high: 4.2
          },
          energyKwh: 0.42,
          carbonKgCo2: 0.42 * 0.445
        }
      ]
    };
  }

  return {
    bucket: "month",
    points: [
      {
        startTs: Date.parse("2026-01-01T00:00:00.000Z"),
        key: "2026-01",
        label: "Jan 2026",
        tokens: 600,
        excludedTokens: 0,
        unestimatedTokens: 0,
        apiCostUsd: 0.023,
        waterLitres: {
          low: 0.2,
          central: 0.6,
          high: 0.9
        },
        energyKwh: 0.09,
        carbonKgCo2: 0.09 * 0.445
      },
      {
        startTs: Date.parse("2026-02-01T00:00:00.000Z"),
        key: "2026-02",
        label: "Feb 2026",
        tokens: 0,
        excludedTokens: 0,
        unestimatedTokens: 0,
        apiCostUsd: 0,
        waterLitres: {
          low: 0,
          central: 0,
          high: 0
        },
        energyKwh: 0,
        carbonKgCo2: 0
      },
      {
        startTs: Date.parse("2026-03-01T00:00:00.000Z"),
        key: "2026-03",
        label: "Mar 2026",
        tokens: 400,
        excludedTokens: 50,
        unestimatedTokens: 50,
        apiCostUsd: 0.014,
        waterLitres: {
          low: 0.3,
          central: 0.6,
          high: 1.2
        },
        energyKwh: 0.12,
        carbonKgCo2: 0.12 * 0.445
      }
    ]
  };
}

function createTimeseriesResponseForUrl(url: string, overview = createReadyOverviewResponse()) {
  if (url.includes("bucket=week")) {
    return createTimeseriesResponse("week");
  }

  if (url.includes("bucket=month")) {
    return createTimeseriesResponse("month");
  }

  return createTimeseriesResponse("day", overview);
}

function mockDashboardResponses(options?: DashboardResponseOptions) {
  const overviewResponse = createReadyOverviewResponse(options);

  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith("/api/overview")) {
      return jsonResponse(overviewResponse);
    }

    if (url.startsWith("/api/methodology")) {
      return jsonResponse(createMethodologyResponse());
    }

    if (url.startsWith("/api/timeseries")) {
      return jsonResponse(createTimeseriesResponseForUrl(url, overviewResponse));
    }

    throw new Error(`Unexpected request: ${url}`);
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  window.location.hash = "";
});

describe("App", () => {
  it("loads the single-page dashboard with hero metric, chart, coverage, and roadmap", async () => {
    mockDashboardResponses();

    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/^Total Agent Water Usage$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Total Agent Energy Usage$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Total Agent Carbon Usage$/i)).toBeInTheDocument();
    expect(screen.getByText("168 Wh")).toBeInTheDocument();
    expect(screen.getByText("75 g CO2")).toBeInTheDocument();
    expect(screen.getByText(/Understand your agent/i)).toBeInTheDocument();
    expect(screen.getByText(/footprint locally\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Local coding agent insights/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Estimated from your local coding agent activity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Between 500.0 mL and 2.10 L/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pricing-weighted estimate anchored to a 4 Wh benchmark request\./i)).not.toBeInTheDocument();
    expect(screen.getByText(/Based on 47 of your prompts/i)).toBeInTheDocument();
    expect(screen.getByText(/Estimated using the latest peer-reviewed research\./i)).toBeInTheDocument();
    expect(screen.getByText(/Your usage data stays on this device\. Nothing is uploaded\./i)).toBeInTheDocument();

    const waterMethodologyButton = screen.getByRole("button", { name: /How is water calculated\?/i });
    const energyMethodologyButton = screen.getByRole("button", { name: /How is energy calculated\?/i });
    const carbonMethodologyButton = screen.getByRole("button", { name: /How is carbon calculated\?/i });

    expect(waterMethodologyButton).toBeInTheDocument();
    expect(energyMethodologyButton).toBeInTheDocument();
    expect(carbonMethodologyButton).toBeInTheDocument();
    expect(waterMethodologyButton).toHaveClass("self-start");
    expect(energyMethodologyButton).toHaveClass("self-start");
    expect(carbonMethodologyButton).toHaveClass("self-start");
    expect(screen.getByTestId("carbon-usage-icon")).toBeInTheDocument();
    expect(screen.queryByText(/What that looks like/i)).not.toBeInTheDocument();

    const waterCard = screen.getByText(/^Total Agent Water Usage$/i).closest("article");
    expect(waterCard?.parentElement).toHaveClass("lg:col-span-2");

    const waterScaleSection = screen.getByTestId("water-scale-section");
    const usageOverTimeSection = screen.getByText(/Usage over time/i).closest("section");
    expect(usageOverTimeSection).not.toBeNull();
    expect(usageOverTimeSection!.compareDocumentPosition(waterScaleSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(waterScaleSection).getByText(/Water at different scales/i)).toBeInTheDocument();
    expect(within(waterScaleSection).getByText(/order-of-magnitude context rather than a like-for-like total/i)).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-chart")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-guide")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-ai-marker")).toBeInTheDocument();
    expect(within(waterScaleSection).queryByTestId("water-scale-range")).not.toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-scroll")).not.toHaveClass("overflow-x-auto");
    expect(within(waterScaleSection).getByTestId("water-scale-canvas")).not.toHaveClass("min-w-[56rem]");
    expect(within(waterScaleSection).getByTestId("water-scale-mobile-legend")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-cup-of-water")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-person-per-day")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-coffee")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-jeans")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-manufacturing-a-car")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-golf-course-daily")).toBeInTheDocument();
    expect(within(waterScaleSection).queryByText(/^Sources$/i)).not.toBeInTheDocument();

    expect(screen.getByText(/Usage over time/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Water" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Energy" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Carbon" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Day" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tablist", { name: "Impact metric" })).toHaveClass("self-start");
    expect(screen.getByRole("tablist", { name: "Usage aggregation" })).toHaveClass("self-start");
    expect(screen.getByRole("tablist", { name: "Usage aggregation" })).not.toHaveClass("w-full");
    expect(await screen.findByTestId("impact-chart")).toBeInTheDocument();

    const breakdownHeading = screen.getByText("Agent usage by model");
    const breakdownSection = breakdownHeading.closest("section");
    expect(breakdownSection).not.toBeNull();
    expect(screen.getByText("sessions")).toBeInTheDocument();
    expect(screen.getByText("prompts")).toBeInTheDocument();
    expect(breakdownSection).toHaveTextContent("tokens");
    expect(screen.getByText("+3 this week")).toBeInTheDocument();
    expect(screen.getByText("+6 this week")).toBeInTheDocument();
    expect(screen.getByText("+250 this week")).toBeInTheDocument();
    expect(screen.getByText("+3 this week").parentElement).toHaveClass("inline-flex");
    expect(screen.getByText("Included in estimate")).toBeInTheDocument();
    expect(screen.getByText("Ran on local hardware")).toBeInTheDocument();
    expect(screen.getByText("Pricing not available")).toBeInTheDocument();
    expect(within(breakdownSection!).queryByText("Local usage")).not.toBeInTheDocument();

    const highestSpendHeading = screen.getByText("Highest spend sessions");
    const highestSpendSection = highestSpendHeading.closest("section");
    expect(highestSpendSection).not.toBeNull();
    expect(highestSpendSection).toHaveTextContent(
      "Rank the sessions that drove the most estimated spend so you can quickly connect costly conversations to their tokens, prompts, models, and estimated footprint."
    );
    expect(screen.getByRole("columnheader", { name: "Prompts" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Spend" })).toBeInTheDocument();
    expect(within(highestSpendSection!).getAllByText("Investigate slow spend spikes").length).toBeGreaterThan(0);
    expect(within(highestSpendSection!).getAllByText("openai / gpt-5.4").length).toBeGreaterThan(0);
    expect(within(highestSpendSection!).getAllByText("+1 more model").length).toBeGreaterThan(0);
    expect(within(highestSpendSection!).getAllByText("$0.0371").length).toBeGreaterThan(0);
    expect(within(highestSpendSection!).getAllByText("610 mL").length).toBeGreaterThan(0);
    expect(within(highestSpendSection!).getAllByText("148 Wh").length).toBeGreaterThan(0);
    expect(within(highestSpendSection!).getAllByText("66 g CO2").length).toBeGreaterThan(0);
    expect(within(highestSpendSection!).getAllByText("includes fallback-only usage").length).toBeGreaterThan(0);
    expect(highestSpendSection!.querySelector(".overflow-x-auto")).toBeNull();
    expect(
      breakdownSection!.compareDocumentPosition(highestSpendSection!)
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    expect(screen.queryByText(/Coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Regional grid factors/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Richer provider coverage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shareable reports/i)).not.toBeInTheDocument();

    expect(container.querySelectorAll('img[src="/agent.svg"]').length).toBeGreaterThan(0);
    expect(screen.getByText(/Copyright Max Stoddard 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Last indexed 9 Mar 2026/i)).toBeInTheDocument();
  });

  it("shows an empty state when no priced sessions are available for the spend ranking", async () => {
    mockDashboardResponses({
      highestSpendSessions: []
    });

    render(<App />);

    expect(await screen.findByText("Highest spend sessions")).toBeInTheDocument();
    expect(
      screen.getByText("No priced sessions have been indexed yet, so there is no spend ranking to show.")
    ).toBeInTheDocument();
  });

  it("renders the hero and localized shells while overview is still loading", async () => {
    const overviewResponse = createReadyOverviewResponse();
    const overviewDeferred = createDeferred<Response>();

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        return overviewDeferred.promise;
      }
      if (url.startsWith("/api/timeseries")) {
        return jsonResponse(createTimeseriesResponseForUrl(url, overviewResponse));
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    expect(screen.getByText(/Understand your agent/i)).toBeInTheDocument();
    expect(screen.getByTestId("indexing-status-card")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Scanning local usage files" })).toBeInTheDocument();
    expect(screen.getByTestId("usage-cards-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("water-usage-card-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("energy-usage-card-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("carbon-usage-card-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("water-usage-value-skeleton")).toHaveClass("skeleton-shimmer");
    expect(screen.getByTestId("water-scale-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("usage-over-time-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("coverage-summary-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("highest-spend-skeleton")).toBeInTheDocument();
    expect(
      screen.getByTestId("usage-over-time-skeleton").compareDocumentPosition(screen.getByTestId("water-scale-skeleton"))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByTestId("impact-chart")).not.toBeInTheDocument();

    overviewDeferred.resolve(jsonResponse(overviewResponse));

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });
  });

  it("shows the indexing status card below the hero, updates phases, and dismisses it after ready", async () => {
    const readyOverview = createReadyOverviewResponse();
    let overviewCalls = 0;

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        overviewCalls += 1;
        if (overviewCalls === 1) {
          return jsonResponse({
            ...readyOverview,
            tokenTotals: {
              totalTokens: 0,
              supportedTokens: 0,
              excludedTokens: 0,
              unestimatedTokens: 0
            },
            waterLitres: {
              low: 0,
              central: 0,
              high: 0
            },
            energyKwh: 0,
            carbonKgCo2: 0,
            coverage: {
              supportedEvents: 0,
              excludedEvents: 0,
              tokenOnlyEvents: 0
            },
            coverageSummary: {
              sessions: 0,
              prompts: 0,
              excludedModels: 0
            },
            weeklyGrowth: {
              sessions: { current: 0, previous: 0, increase: 0 },
              prompts: { current: 0, previous: 0, increase: 0 },
              tokens: { current: 0, previous: 0, increase: 0 }
            },
            modelUsage: [],
            highestSpendSessions: [],
            coverageDetails: [],
            exclusions: [],
            lastIndexedAt: null,
            calibration: null,
            indexing: {
              phase: "discovering",
              startedAt: Date.parse("2026-03-13T12:00:00.000Z"),
              updatedAt: Date.parse("2026-03-13T12:00:01.000Z")
            },
            diagnostics: {
              state: "indexing",
              codexHome: "/tmp/.codex",
              message: null
            }
          });
        }

        if (overviewCalls === 2) {
          return jsonResponse({
            ...readyOverview,
            tokenTotals: {
              totalTokens: 0,
              supportedTokens: 0,
              excludedTokens: 0,
              unestimatedTokens: 0
            },
            waterLitres: {
              low: 0,
              central: 0,
              high: 0
            },
            energyKwh: 0,
            carbonKgCo2: 0,
            coverage: {
              supportedEvents: 0,
              excludedEvents: 0,
              tokenOnlyEvents: 0
            },
            coverageSummary: {
              sessions: 0,
              prompts: 0,
              excludedModels: 0
            },
            weeklyGrowth: {
              sessions: { current: 0, previous: 0, increase: 0 },
              prompts: { current: 0, previous: 0, increase: 0 },
              tokens: { current: 0, previous: 0, increase: 0 }
            },
            modelUsage: [],
            highestSpendSessions: [],
            coverageDetails: [],
            exclusions: [],
            lastIndexedAt: null,
            calibration: null,
            indexing: {
              phase: "parsing",
              startedAt: Date.parse("2026-03-13T12:00:00.000Z"),
              updatedAt: Date.parse("2026-03-13T12:00:02.000Z")
            },
            diagnostics: {
              state: "indexing",
              codexHome: "/tmp/.codex",
              message: null
            }
          });
        }

        return jsonResponse(readyOverview);
      }

      if (url.startsWith("/api/timeseries")) {
        return jsonResponse(createTimeseriesResponseForUrl(url, readyOverview));
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    const heroSection = screen.getByText(/Understand your agent/i).closest("section");
    expect(heroSection).not.toBeNull();
    expect(await screen.findByText("Scanning local usage files")).toBeInTheDocument();
    expect(screen.getByTestId("indexing-status-card")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Scanning local usage files" })).toBeInTheDocument();
    expect(within(heroSection!).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByTestId("water-usage-card-skeleton")).toBeInTheDocument();

    await waitFor(() => {
      expect(overviewCalls).toBe(2);
    }, {
      timeout: 2000
    });
    expect(await screen.findByText("Reading session history")).toBeInTheDocument();
    expect(await screen.findByRole("progressbar", { name: "Reading session history" })).toBeInTheDocument();

    await waitFor(() => {
      expect(overviewCalls).toBe(3);
    }, {
      timeout: 2000
    });
    await waitFor(() => {
      expect(screen.queryByTestId("indexing-status-card")).not.toBeInTheDocument();
    }, {
      timeout: 1000
    });
    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });
  });

  it("keeps existing overview data visible while the API reports active reindexing", async () => {
    const readyOverview = createReadyOverviewResponse();

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        return jsonResponse({
          ...readyOverview,
          indexing: {
            phase: "estimating",
            startedAt: Date.parse("2026-03-13T12:00:00.000Z"),
            updatedAt: Date.parse("2026-03-13T12:00:05.000Z")
          },
          diagnostics: {
            state: "indexing",
            codexHome: "/tmp/.codex",
            message: null
          }
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    expect(await screen.findByText("Estimating water, energy, and carbon")).toBeInTheDocument();
    expect(screen.getByTestId("indexing-status-card")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Estimating water, energy, and carbon" })).toBeInTheDocument();
    expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    expect(screen.getByTestId("water-scale-section")).toBeInTheDocument();
    expect(screen.getByText("Agent usage by model")).toBeInTheDocument();
    expect(screen.queryByTestId("impact-chart")).not.toBeInTheDocument();
  });

  it("keeps overview sections visible while timeseries loads asynchronously", async () => {
    const overviewResponse = createReadyOverviewResponse();
    const timeseriesDeferred = createDeferred<Response>();

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        return jsonResponse(overviewResponse);
      }
      if (url.includes("bucket=day")) {
        return timeseriesDeferred.promise;
      }
      if (url.startsWith("/api/timeseries")) {
        return jsonResponse(createTimeseriesResponseForUrl(url, overviewResponse));
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Based on 47 of your prompts/i)).toBeInTheDocument();
    expect(screen.getByText(/Estimated using the latest peer-reviewed research\./i)).toBeInTheDocument();
    expect(screen.getByTestId("water-scale-section")).toBeInTheDocument();
    expect(screen.getByText("Agent usage by model")).toBeInTheDocument();
    expect(screen.getByTestId("usage-over-time-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("impact-chart")).not.toBeInTheDocument();

    timeseriesDeferred.resolve(jsonResponse(createTimeseriesResponse("day", overviewResponse)));

    expect(await screen.findByTestId("impact-chart")).toBeInTheDocument();
  });

  it("shows a localized chart error when timeseries loading fails", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        return jsonResponse(createReadyOverviewResponse());
      }
      if (url.includes("bucket=day")) {
        return new Response("server error", { status: 500 });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    expect(await screen.findByTestId("usage-over-time-error")).toBeInTheDocument();
    expect(screen.getByText(/Could not load usage over time/i)).toBeInTheDocument();
    expect(screen.getByText(/Request failed: 500/i)).toBeInTheDocument();
    expect(screen.getByText("Agent usage by model")).toBeInTheDocument();
    expect(screen.queryByRole("alert", { name: /Something went wrong/i })).not.toBeInTheDocument();
  });

  it("keeps the water-scale marker and range visible for very large AI usage", async () => {
    mockDashboardResponses({
      waterLitres: {
        low: 4000,
        central: 5000,
        high: 6000
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("5,000 L").length).toBeGreaterThan(0);
    });

    expect(screen.getByTestId("water-scale-ai-marker")).toBeInTheDocument();
    expect(screen.queryByTestId("water-scale-range")).not.toBeInTheDocument();
    expect(screen.getByText(/Your AI usage/i)).toBeInTheDocument();
  });

  it("keeps the split footer copy when only one prompt is counted", async () => {
    mockDashboardResponses({
      coverageSummary: {
        sessions: 12,
        prompts: 1
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("Estimated using the latest peer-reviewed research.")).toBeInTheDocument();
    expect(screen.getByText("Based on 1 of your prompt")).toBeInTheDocument();
  });

  it("formats larger energy prompt counts using the shared three-significant-figure style", async () => {
    mockDashboardResponses({
      coverageSummary: {
        sessions: 12,
        prompts: 2008
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("Estimated using the latest peer-reviewed research.")).toBeInTheDocument();
    expect(screen.getByText("Based on 2.01K of your prompts")).toBeInTheDocument();
  });

  it("prefetches missing week and month buckets after the active day series loads", async () => {
    mockDashboardResponses();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("impact-chart")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("bucket=week"));
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("bucket=month"));
    });
  });

  it("switches time bucket via the toggle without refetching prefetched buckets", async () => {
    mockDashboardResponses();

    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("bucket=week"));
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("bucket=month"));
    });

    const weekRequestsBeforeSwitch = fetchMock.mock.calls.filter(([input]) => String(input).includes("bucket=week")).length;
    const monthRequestsBeforeSwitch = fetchMock.mock.calls.filter(([input]) => String(input).includes("bucket=month")).length;

    const dayTab = screen.getByRole("tab", { name: "Day" });
    dayTab.focus();
    fireEvent.keyDown(dayTab, { key: "ArrowRight", code: "ArrowRight" });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "true");
    });
    expect(screen.queryByTestId("usage-over-time-skeleton")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Month" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Month" })).toHaveAttribute("aria-selected", "true");
      expect(container.querySelectorAll(".recharts-bar-rectangle").length).toBeGreaterThanOrEqual(3);
    });

    const weekRequestsAfterSwitch = fetchMock.mock.calls.filter(([input]) => String(input).includes("bucket=week")).length;
    const monthRequestsAfterSwitch = fetchMock.mock.calls.filter(([input]) => String(input).includes("bucket=month")).length;

    expect(weekRequestsAfterSwitch).toBe(weekRequestsBeforeSwitch);
    expect(monthRequestsAfterSwitch).toBe(monthRequestsBeforeSwitch);
  });

  it("keeps the active chart visible when background prefetch fails and retries on demand", async () => {
    const overviewResponse = createReadyOverviewResponse();
    let monthRequests = 0;

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        return jsonResponse(overviewResponse);
      }
      if (url.includes("bucket=month")) {
        monthRequests += 1;
        if (monthRequests === 1) {
          return new Response("server error", { status: 500 });
        }

        return jsonResponse(createTimeseriesResponse("month"));
      }
      if (url.startsWith("/api/timeseries")) {
        return jsonResponse(createTimeseriesResponseForUrl(url, overviewResponse));
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const { container } = render(<App />);

    expect(await screen.findByTestId("impact-chart")).toBeInTheDocument();

    await waitFor(() => {
      expect(monthRequests).toBe(1);
    });
    expect(screen.queryByTestId("usage-over-time-error")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Month" }));

    await waitFor(() => {
      expect(monthRequests).toBe(2);
      expect(screen.getByRole("tab", { name: "Month" })).toHaveAttribute("aria-selected", "true");
      expect(container.querySelectorAll(".recharts-bar-rectangle").length).toBeGreaterThanOrEqual(3);
    });
  });

  it("shows tooltip details when a bucket bar is hovered", async () => {
    mockDashboardResponses();

    const { container } = render(<App />);

    const chart = await screen.findByTestId("impact-chart");

    expect(chart).toBeInTheDocument();

    await waitFor(() => {
      expect(container.querySelector(".recharts-wrapper")).not.toBeNull();
    });

    const chartWrapper = container.querySelector(".recharts-wrapper");
    fireEvent.mouseMove(chartWrapper as Element, {
      clientX: 512,
      clientY: 140
    });

    expect(await screen.findByTestId("impact-chart-tooltip")).toBeInTheDocument();
    expect(screen.getByText("9 Mar 2026")).toBeInTheDocument();
    expect(screen.getByText("1,000 tokens")).toBeInTheDocument();
  });

  it("switches the usage chart between water, energy, and carbon modes", async () => {
    mockDashboardResponses();

    const { container } = render(<App />);

    expect(await screen.findByTestId("impact-chart")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Energy" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Energy" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("impact-chart")).toHaveClass("border-amber-200/80");
    });

    const chartWrapper = container.querySelector(".recharts-wrapper");
    fireEvent.mouseMove(chartWrapper as Element, {
      clientX: 512,
      clientY: 140
    });

    const tooltip = await screen.findByTestId("impact-chart-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(within(tooltip).getByText("168 Wh")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("tab", { name: "Energy" }), { key: "ArrowRight", code: "ArrowRight" });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Carbon" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("impact-chart")).toHaveClass("border-slate-300/80");
    });

    fireEvent.mouseMove(chartWrapper as Element, {
      clientX: 512,
      clientY: 140
    });

    const carbonTooltip = await screen.findByTestId("impact-chart-tooltip");
    expect(within(carbonTooltip).getByText("75 g CO2")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("tab", { name: "Carbon" }), { key: "ArrowRight", code: "ArrowRight" });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Cost" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("impact-chart")).toHaveClass("border-emerald-200/80");
    });

    fireEvent.mouseMove(chartWrapper as Element, {
      clientX: 512,
      clientY: 140
    });

    const costTooltip = await screen.findByTestId("impact-chart-tooltip");
    expect(within(costTooltip).getByText("$0.0371")).toBeInTheDocument();
  });

  it("opens and closes the privacy badge popup", async () => {
    mockDashboardResponses();

    render(<App />);

    expect(await screen.findByRole("button", { name: /Your data stays local/i })).toBeInTheDocument();
    expect(screen.queryByText("Private on this device")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Your data stays local/i }));

    expect(screen.getByRole("dialog", { name: "Privacy details" })).toBeInTheDocument();
    expect(screen.getByText("Private on this device")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Your usage data stays on this device. Nothing is uploaded to a server for this dashboard, so only you can see it./i
      )
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("Private on this device")).not.toBeInTheDocument();
    });
  });

  it("closes the privacy badge popup when clicking outside", async () => {
    mockDashboardResponses();

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Your data stays local/i }));

    expect(screen.getByText("Private on this device")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText("Private on this device")).not.toBeInTheDocument();
    });
  });

  it("opens the methodology drawer and shows pricing and sources", async () => {
    mockDashboardResponses({
      coverageSummary: {
        sessions: 244,
        prompts: 1905
      },
      supportedTokens: 1_143_889_843
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /How it works/i })[0]!);

    expect(await screen.findByRole("dialog", { name: /How it works/i })).toBeInTheDocument();
    const methodologyDrawer = screen.getByRole("dialog", { name: /How it works/i });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/methodology");
    });

    expect(await screen.findByRole("button", { name: "Prompts" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Prompts" }).parentElement).toHaveClass("inline-flex");
    expect(screen.getByRole("button", { name: "Water" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Energy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carbon" })).toBeInTheDocument();
    expect(methodologyDrawer).toHaveClass("overflow-x-hidden");
    expect(screen.getByText(/Sessions are distinct Codex and Claude Code runs/i)).toBeInTheDocument();
    expect(screen.getAllByText("Included in estimate").length).toBeGreaterThan(0);
    expect(screen.getByText(/Bundled pricing snapshot/i)).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("244")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("1.91K")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("1.14B")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByRole("table").parentElement).toHaveClass("overflow-y-auto", "overflow-x-hidden");
    expect(screen.getByText(/eventCostUsd = input\/1e6/i)).toBeInTheDocument();
    expect(await screen.findByText(/gpt-5.2-codex/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Portkey models repo \(MIT\)/i })).toHaveAttribute(
      "href",
      "https://github.com/Portkey-AI/models"
    );
    expect(within(methodologyDrawer).getAllByTestId("methodology-source-card").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Energy" }));
    expect(screen.getByText(/Energy uses the same pricing-weighted normalization step as water/i)).toBeInTheDocument();
    expect(screen.getByText(/energyKwh = eventCostUsd \/ referenceEventCostUsd \* energyBenchmarkKwh/i)).toBeInTheDocument();
    expect(screen.getAllByText("4.0 Wh").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /CACM DOI: Making AI Less 'Thirsty' \(Li, Yang, Islam, Ren\)/i })).toHaveAttribute(
      "href",
      "https://doi.org/10.1145/3724499"
    );
    expect(screen.getByRole("link", { name: /NeurIPS 2020: Language Models are Few-Shot Learners \(Brown et al\.\)/i })).toHaveAttribute(
      "href",
      "https://papers.nips.cc/paper/2020/file/1457c0d6bfcb4967418bfb8ac142f64a-Paper.pdf"
    );
    expect(screen.getByRole("link", { name: /JMLR 2023: Estimating the Carbon Footprint of BLOOM/i })).toHaveAttribute(
      "href",
      "https://jmlr.org/papers/v24/23-0069.html"
    );
    expect(within(methodologyDrawer).getAllByTestId("methodology-source-card").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Carbon" }));
    expect(screen.getByText(/Carbon builds on the energy estimate rather than starting from scratch/i)).toBeInTheDocument();
    expect(screen.getByText(/carbonKgCo2 = energyKwh \* carbonIntensityKgCo2PerKwh/i)).toBeInTheDocument();
    expect(screen.getByText(/carbonKgCo2 = eventCostUsd \/ referenceEventCostUsd \* carbonBenchmarkKgCo2/i)).toBeInTheDocument();
    expect(screen.getAllByText("445 g CO2/kWh").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1.8 g CO2").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /IEA Electricity 2025: Emissions/i })).toHaveAttribute(
      "href",
      "https://www.iea.org/reports/electricity-2025/emissions"
    );
    expect(screen.getByRole("link", { name: /GHG Protocol Scope 2 Guidance/i })).toHaveAttribute(
      "href",
      "https://ghgprotocol.org/scope_2_guidance"
    );
    expect(screen.getByRole("link", { name: /GHG Protocol Scope 2 Frequently Asked Questions/i })).toHaveAttribute(
      "href",
      "https://ghgprotocol.org/scope-2-frequently-asked-questions"
    );

    fireEvent.click(screen.getByRole("button", { name: "Water" }));
    expect(
      within(methodologyDrawer).getByText(/So this number is best read as context, not as a literal meter reading from your machine/i)
    ).toBeInTheDocument();
    expect(within(methodologyDrawer).getAllByTestId("methodology-source-card").length).toBeGreaterThan(0);
    expect(within(methodologyDrawer).getByText("A cup of water")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("A daily intake")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("A cup of coffee")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("A pair of jeans")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("A car")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("A golf course per day")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("67,500 L")).toBeInTheDocument();
    expect(
      within(methodologyDrawer).getByRole("link", { name: /NIST Metric Kitchen: Cooking Measurement Equivalencies/i })
    ).toHaveAttribute("href", "https://www.nist.gov/pml/owm/metric-kitchen-cooking-measurement-equivalencies");
    expect(
      within(methodologyDrawer).getByRole("link", { name: /EFSA Dietary Reference Values for Water/i })
    ).toHaveAttribute("href", "https://www.efsa.europa.eu/en/efsajournal/pub/1459");
    expect(
      within(methodologyDrawer).getByRole("link", { name: /CACM DOI: Making AI Less 'Thirsty' \(Li, Yang, Islam, Ren\)/i })
    ).toHaveAttribute("href", "https://doi.org/10.1145/3724499");
    expect(
      within(methodologyDrawer).getByRole("link", {
        name: /Ecological Economics DOI: The water footprint of coffee and tea consumption in the Netherlands/i
      })
    ).toHaveAttribute("href", "https://doi.org/10.1016/j.ecolecon.2007.02.022");
    expect(
      within(methodologyDrawer).getByRole("link", {
        name: /Sustainability Science DOI: Comparing ecological and water footprint of denim jeans and a tri-blend T-shirt/i
      })
    ).toHaveAttribute("href", "https://doi.org/10.1007/s11625-022-01131-0");
    expect(
      within(methodologyDrawer).getByRole("link", {
        name: /Environmental Science & Technology DOI: Water Footprint of European Cars: Potential Impacts of Water Consumption along Automobile Life Cycles/i
      })
    ).toHaveAttribute("href", "https://doi.org/10.1021/es2040043");
    expect(
      within(methodologyDrawer).getByRole("link", {
        name: /GCSAA Golf Course Environmental Profile: Phase II Water Use and Conservation Practices on U\.S\. Golf Courses/i
      })
    ).toHaveAttribute(
      "href",
      "https://www.gcsaa.org/docs/default-source/Environment/phase-2-water-use-survey-full-report.pdf?sfvrsn=2b39123e_4"
    );
  });

  it("opens the methodology drawer on the water tab from the water usage card", async () => {
    mockDashboardResponses();

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /How is water calculated\?/i }));

    expect(await screen.findByRole("dialog", { name: /How it works/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Water" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Prompts" })).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText(/So this number is best read as context, not as a literal meter reading from your machine/i)
    ).toBeInTheDocument();
  });

  it("opens the methodology drawer on the energy tab from the energy usage card", async () => {
    mockDashboardResponses();

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /How is energy calculated\?/i }));

    expect(await screen.findByRole("dialog", { name: /How it works/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Energy" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Prompts" })).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText(/Energy uses the same pricing-weighted normalization step as water/i)
    ).toBeInTheDocument();
  });

  it("opens the methodology drawer on the carbon tab from the carbon usage card", async () => {
    mockDashboardResponses();

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /How is carbon calculated\?/i }));

    expect(await screen.findByRole("dialog", { name: /How it works/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Carbon" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Prompts" })).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText(/Carbon builds on the energy estimate rather than starting from scratch/i)
    ).toBeInTheDocument();
  });

  it("shows ranked model usage in the expanded summary", async () => {
    mockDashboardResponses();

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("Agent usage by model")).toBeInTheDocument();
    expect(screen.getByText("See how many sessions and prompts were counted, how many priced tokens were included, and which models are driving the most local agent usage.")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("900")).toBeInTheDocument();
    expect(screen.getByText("950 tokens · $0.0325 raw API cost · includes fallback-only usage")).toBeInTheDocument();
    expect(screen.getByText("120 tokens · $0.00456 raw API cost")).toBeInTheDocument();
    expect(screen.getByLabelText("First place")).toBeInTheDocument();
    expect(screen.getByLabelText("Second place")).toBeInTheDocument();
    expect(screen.getByLabelText("Third place")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show all models/i }));

    const breakdownSection = screen.getByText("Agent usage by model").closest("section");
    expect(breakdownSection).not.toBeNull();
    expect(within(breakdownSection!).getAllByText("openai / gpt-5.4")).toHaveLength(1);
    expect(within(breakdownSection!).getByText("anthropic / claude-sonnet-4")).toBeInTheDocument();
    expect(within(breakdownSection!).getByText("950 tokens · $0.0325 raw API cost · includes fallback-only usage")).toBeInTheDocument();
    expect(within(breakdownSection!).getByText("50 tokens · pricing not available yet")).toBeInTheDocument();
    expect(within(breakdownSection!).getByText("ollama / qwen2.5-coder:7b")).toBeInTheDocument();
    expect(within(breakdownSection!).getByText("40 tokens · Ran on local hardware")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fourth place")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show fewer models/i })).toBeInTheDocument();
  });

  it("hides weekly growth chips when metrics are flat or down", async () => {
    mockDashboardResponses({
      weeklyGrowth: {
        sessions: { current: 12, previous: 12, increase: 0 },
        prompts: { current: 47, previous: 50, increase: 0 },
        tokens: { current: 900, previous: 900, increase: 0 }
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(/this week/i)).not.toBeInTheDocument();
  });

  it("shows neutral onboarding guidance when no local usage history is available", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        return jsonResponse({
          tokenTotals: {
            totalTokens: 0,
            supportedTokens: 0,
            excludedTokens: 0,
            unestimatedTokens: 0
          },
          waterLitres: {
            low: 0,
            central: 0,
            high: 0
          },
          energyKwh: 0,
          carbonKgCo2: 0,
          coverage: {
            supportedEvents: 0,
            excludedEvents: 0,
            tokenOnlyEvents: 0
          },
          coverageSummary: {
            sessions: 0,
            prompts: 0,
            excludedModels: 0
          },
          weeklyGrowth: {
            sessions: { current: 0, previous: 0, increase: 0 },
            prompts: { current: 0, previous: 0, increase: 0 },
            tokens: { current: 0, previous: 0, increase: 0 }
          },
          modelUsage: [],
          highestSpendSessions: [],
          coverageDetails: [],
          diagnostics: {
            state: "no_data",
            codexHome: "/home/dev/.codex",
            message: "No Codex usage files were found in this directory yet."
          },
          exclusions: [],
          lastIndexedAt: null,
          calibration: null,
          indexing: null
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    expect(screen.getByText(/Understand your agent/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/No local usage history detected/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/No readable local usage history was found at the current path yet/i)).toBeInTheDocument();
    expect(screen.getByText("No usage files were found in this directory yet.")).toBeInTheDocument();
    expect(screen.getByText("/home/dev/.codex")).toBeInTheDocument();
    expect(screen.queryByText(/Regional grid factors/i)).not.toBeInTheDocument();
  });

  it("shows a neutral read error when the current local path cannot be read", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        return jsonResponse({
          tokenTotals: {
            totalTokens: 0,
            supportedTokens: 0,
            excludedTokens: 0,
            unestimatedTokens: 0
          },
          waterLitres: {
            low: 0,
            central: 0,
            high: 0
          },
          energyKwh: 0,
          carbonKgCo2: 0,
          coverage: {
            supportedEvents: 0,
            excludedEvents: 0,
            tokenOnlyEvents: 0
          },
          coverageSummary: {
            sessions: 0,
            prompts: 0,
            excludedModels: 0
          },
          weeklyGrowth: {
            sessions: { current: 0, previous: 0, increase: 0 },
            prompts: { current: 0, previous: 0, increase: 0 },
            tokens: { current: 0, previous: 0, increase: 0 }
          },
          modelUsage: [],
          highestSpendSessions: [],
          coverageDetails: [],
          diagnostics: {
            state: "read_error",
            codexHome: "/bad/path/.codex",
            message: "Configured Codex home does not exist."
          },
          exclusions: [],
          lastIndexedAt: null,
          calibration: null,
          indexing: null
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    expect(screen.getByText(/Understand your agent/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/Could not read local usage data/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/The dashboard could not read the current local usage path/i)).toBeInTheDocument();
    expect(screen.getByText("Configured data path does not exist.")).toBeInTheDocument();
  });
});
