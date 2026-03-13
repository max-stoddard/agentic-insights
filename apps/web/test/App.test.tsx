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
  supportedTokens?: number;
  waterLitres?: {
    low: number;
    central: number;
    high: number;
  };
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
  const supportedTokens = options?.supportedTokens ?? 900;
  const waterLitres = options?.waterLitres ?? {
    low: 0.5,
    central: 1.2,
    high: 2.1
  };

  return {
    tokenTotals: {
      totalTokens: 1000,
      supportedTokens,
      excludedTokens: 50,
      unestimatedTokens: 50
    },
    waterLitres,
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
        status: "local",
        statusNote: "local usage"
      }
    ],
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
    calibration: {
      referenceEventCostUsd: 0.123,
      computedAt: Date.parse("2026-03-09T12:00:00.000Z"),
      supportedEventCount: 9,
      supportedMedianSource: "local_median_event_cost_usd"
    },
    exclusions: [],
    pricingCatalog: {
      generatedAt: "2026-03-13T12:00:00.000Z",
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
          label: "Ecological Economics DOI: The water footprint of coffee and tea consumption in the Netherlands",
          url: "https://doi.org/10.1016/j.ecolecon.2007.02.022"
        },
        {
          label: "Ecological Indicators DOI: Water footprint of soy milk and soy burger and equivalent animal products",
          url: "https://doi.org/10.1016/j.ecolind.2011.12.009"
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
      energy: [{ label: "CodeCarbon methodology", url: "https://mlco2.github.io/codecarbon/methodology.html" }],
      carbon: [{ label: "GHG Protocol Corporate Standard", url: "https://ghgprotocol.org/corporate-standard" }]
    }
  };
}

function createTimeseriesResponse(bucket: "day" | "week" | "month", waterLitres = createReadyOverviewResponse().waterLitres) {
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
          waterLitres
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
          waterLitres: {
            low: 1,
            central: 2.4,
            high: 4.2
          }
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
        waterLitres: {
          low: 0.2,
          central: 0.6,
          high: 0.9
        }
      },
      {
        startTs: Date.parse("2026-02-01T00:00:00.000Z"),
        key: "2026-02",
        label: "Feb 2026",
        tokens: 0,
        excludedTokens: 0,
        unestimatedTokens: 0,
        waterLitres: {
          low: 0,
          central: 0,
          high: 0
        }
      },
      {
        startTs: Date.parse("2026-03-01T00:00:00.000Z"),
        key: "2026-03",
        label: "Mar 2026",
        tokens: 400,
        excludedTokens: 50,
        unestimatedTokens: 50,
        waterLitres: {
          low: 0.3,
          central: 0.6,
          high: 1.2
        }
      }
    ]
  };
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

    if (url.includes("bucket=day")) {
      return jsonResponse(createTimeseriesResponse("day", overviewResponse.waterLitres));
    }

    if (url.includes("bucket=week")) {
      return jsonResponse(createTimeseriesResponse("week"));
    }

    return jsonResponse(createTimeseriesResponse("month"));
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
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

    expect(screen.getByText(/^Water used$/i)).toBeInTheDocument();
    expect(screen.getByText(/Understand your agent/i)).toBeInTheDocument();
    expect(screen.getByText(/footprint locally\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Local coding agent insights/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Between 500.0 mL and 2.10 L/i)).toBeInTheDocument();
    expect(screen.getByText(/Based on 9 supported usage events/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /How is this calculated\?/i })).toBeInTheDocument();
    expect(screen.queryByText(/What that looks like/i)).not.toBeInTheDocument();

    const waterScaleSection = screen.getByTestId("water-scale-section");
    expect(within(waterScaleSection).getByText(/Water at different scales/i)).toBeInTheDocument();
    expect(within(waterScaleSection).getByText(/order-of-magnitude context rather than a like-for-like total/i)).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-chart")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-guide")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-ai-marker")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-range")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-scroll")).toHaveClass("overflow-x-auto");
    expect(within(waterScaleSection).getByTestId("water-scale-canvas")).toHaveClass("min-w-[56rem]");
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-cup-of-water")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-person-per-day")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-coffee")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-beef-burger")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-jeans")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-manufacturing-a-car")).toBeInTheDocument();
    expect(within(waterScaleSection).getByTestId("water-scale-anchor-golf-course-daily")).toBeInTheDocument();
    expect(within(waterScaleSection).queryByText(/^Sources$/i)).not.toBeInTheDocument();

    expect(screen.getByText(/Usage over time/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Day" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByTestId("water-chart")).toBeInTheDocument();

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
    expect(screen.getByText("Local usage")).toBeInTheDocument();
    expect(screen.getByText("Pricing not available")).toBeInTheDocument();

    expect(screen.getByText(/Prompt insights/i)).toBeInTheDocument();
    expect(screen.getByText(/Energy estimates/i)).toBeInTheDocument();
    expect(screen.getByText(/CO2 estimates/i)).toBeInTheDocument();

    expect(container.querySelectorAll('img[src="/agent.svg"]').length).toBeGreaterThan(0);
    expect(screen.getByText(/Copyright Max Stoddard 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Last indexed 9 Mar 2026/i)).toBeInTheDocument();
  });

  it("renders the hero and localized shells while overview is still loading", async () => {
    const overviewResponse = createReadyOverviewResponse();
    const overviewDeferred = createDeferred<Response>();

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        return overviewDeferred.promise;
      }
      if (url.includes("bucket=day")) {
        return jsonResponse(createTimeseriesResponse("day", overviewResponse.waterLitres));
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    expect(screen.getByText(/Understand your agent/i)).toBeInTheDocument();
    expect(screen.getByTestId("water-usage-card-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("water-scale-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("usage-over-time-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("coverage-summary-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("water-chart")).not.toBeInTheDocument();

    overviewDeferred.resolve(jsonResponse(overviewResponse));

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });
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

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Based on 9 supported usage events/i)).toBeInTheDocument();
    expect(screen.getByTestId("water-scale-section")).toBeInTheDocument();
    expect(screen.getByText("Agent usage by model")).toBeInTheDocument();
    expect(screen.getByTestId("usage-over-time-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("water-chart")).not.toBeInTheDocument();

    timeseriesDeferred.resolve(jsonResponse(createTimeseriesResponse("day", overviewResponse.waterLitres)));

    expect(await screen.findByTestId("water-chart")).toBeInTheDocument();
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
    expect(screen.getByTestId("water-scale-range")).toBeInTheDocument();
    expect(screen.getByText(/Your AI usage/i)).toBeInTheDocument();
  });

  it("switches time bucket via the toggle and fetches new timeseries", async () => {
    mockDashboardResponses();

    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });

    const dayTab = screen.getByRole("tab", { name: "Day" });
    dayTab.focus();
    fireEvent.keyDown(dayTab, { key: "ArrowRight", code: "ArrowRight" });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "true");
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("bucket=week"));
    });

    fireEvent.click(screen.getByRole("tab", { name: "Month" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("bucket=month"));
    });
    await waitFor(() => {
      expect(container.querySelectorAll(".recharts-bar-rectangle").length).toBeGreaterThanOrEqual(3);
    });
  });

  it("shows tooltip details when a bucket bar is hovered", async () => {
    mockDashboardResponses();

    const { container } = render(<App />);

    const chart = await screen.findByTestId("water-chart");

    expect(chart).toBeInTheDocument();

    await waitFor(() => {
      expect(container.querySelector(".recharts-wrapper")).not.toBeNull();
    });

    const chartWrapper = container.querySelector(".recharts-wrapper");
    fireEvent.mouseMove(chartWrapper as Element, {
      clientX: 512,
      clientY: 140
    });

    expect(await screen.findByTestId("water-chart-tooltip")).toBeInTheDocument();
    expect(screen.getByText("9 Mar 2026")).toBeInTheDocument();
    expect(screen.getByText("1,000 tokens")).toBeInTheDocument();
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
    expect(screen.getByText(/Energy estimates are not live yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CodeCarbon methodology/i })).toHaveAttribute(
      "href",
      "https://mlco2.github.io/codecarbon/methodology.html"
    );
    expect(within(methodologyDrawer).getAllByTestId("methodology-source-card").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Carbon" }));
    expect(screen.getByText(/Carbon estimates are also still upcoming/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /GHG Protocol Corporate Standard/i })).toHaveAttribute(
      "href",
      "https://ghgprotocol.org/corporate-standard"
    );

    fireEvent.click(screen.getByRole("button", { name: "Water" }));
    expect(
      within(methodologyDrawer).getByText(/Hovering the chart reveals what each point means, and the source cards below explain where each comparison comes from/i)
    ).toBeInTheDocument();
    expect(within(methodologyDrawer).getAllByTestId("methodology-source-card").length).toBeGreaterThan(0);
    expect(within(methodologyDrawer).getByText("A cup of water")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("A daily intake")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("A cup of coffee")).toBeInTheDocument();
    expect(within(methodologyDrawer).getByText("A beef burger")).toBeInTheDocument();
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
        name: /Ecological Indicators DOI: Water footprint of soy milk and soy burger and equivalent animal products/i
      })
    ).toHaveAttribute("href", "https://doi.org/10.1016/j.ecolind.2011.12.009");
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

    fireEvent.click(screen.getByRole("button", { name: /How is this calculated\?/i }));

    expect(await screen.findByRole("dialog", { name: /How it works/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Water" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Prompts" })).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText(/Hovering the chart reveals what each point means, and the source cards below explain where each comparison comes from/i)
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
    expect(screen.getByLabelText("First place")).toBeInTheDocument();
    expect(screen.getByLabelText("Second place")).toBeInTheDocument();
    expect(screen.getByLabelText("Third place")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show all models/i }));

    expect(screen.getAllByText("openai / gpt-5.4")).toHaveLength(1);
    expect(screen.getByText("anthropic / claude-sonnet-4")).toBeInTheDocument();
    expect(screen.getByText("950 tokens · includes fallback-only usage")).toBeInTheDocument();
    expect(screen.getByText("50 tokens · pricing not available yet")).toBeInTheDocument();
    expect(screen.getByText("ollama / qwen2.5-coder:7b")).toBeInTheDocument();
    expect(screen.getByText("40 tokens · local usage")).toBeInTheDocument();
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
        return new Response(
          JSON.stringify({
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
            coverageDetails: [],
            diagnostics: {
              state: "no_data",
              codexHome: "/home/dev/.codex",
              message: "No Codex usage files were found in this directory yet."
            },
            exclusions: [],
            lastIndexedAt: null,
            calibration: null
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    expect((await screen.findAllByText(/No local usage history detected/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/No readable local usage history was found at the current path yet/i)).toBeInTheDocument();
    expect(screen.getByText("No usage files were found in this directory yet.")).toBeInTheDocument();
    expect(screen.getByText("/home/dev/.codex")).toBeInTheDocument();
    expect(screen.getByText(/Prompt insights/i)).toBeInTheDocument();
  });

  it("shows a neutral read error when the current local path cannot be read", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        return new Response(
          JSON.stringify({
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
            coverageDetails: [],
            diagnostics: {
              state: "read_error",
              codexHome: "/bad/path/.codex",
              message: "Configured Codex home does not exist."
            },
            exclusions: [],
            lastIndexedAt: null,
            calibration: null
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    expect((await screen.findAllByText(/Could not read local usage data/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/The dashboard could not read the current local usage path/i)).toBeInTheDocument();
    expect(screen.getByText("Configured data path does not exist.")).toBeInTheDocument();
  });
});
