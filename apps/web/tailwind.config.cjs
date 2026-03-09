const colors = require("tailwindcss/colors");

const baseColors = ["sky", "rose"];

const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const utilities = ["bg", "stroke", "fill", "text", "ring", "border"];
const variants = ["", "hover:", "dark:", "dark:hover:", "data-[selected]:", "dark:data-[selected]:"];

const tremorColorSafelist = [];

for (const color of baseColors) {
  for (const shade of shades) {
    for (const utility of utilities) {
      for (const variant of variants) {
        tremorColorSafelist.push(`${variant}${utility}-${color}-${shade}`);
      }
    }
  }
}

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Workspace installs are hoisted to the repo root rather than apps/web/node_modules.
    "../../node_modules/@tremor/**/*.{js,ts,jsx,tsx}"
  ],
  safelist: tremorColorSafelist,
  theme: {
    extend: {
      colors: {
        tremor: {
          brand: {
            faint: colors.sky[50],
            muted: colors.sky[200],
            subtle: colors.sky[400],
            DEFAULT: colors.sky[500],
            emphasis: colors.sky[700],
            inverted: colors.white
          },
          background: {
            muted: "#fafaf9",
            subtle: colors.stone[100],
            DEFAULT: colors.white,
            emphasis: colors.stone[700]
          },
          border: {
            DEFAULT: colors.stone[200]
          },
          ring: {
            DEFAULT: colors.stone[200]
          },
          content: {
            subtle: colors.stone[400],
            DEFAULT: colors.stone[500],
            emphasis: colors.stone[700],
            strong: colors.stone[900],
            inverted: colors.white
          }
        },
        "dark-tremor": {
          brand: {
            faint: "#0c4a6e",
            muted: "#075985",
            subtle: colors.sky[600],
            DEFAULT: colors.sky[500],
            emphasis: colors.sky[400],
            inverted: colors.stone[950]
          },
          background: {
            muted: colors.stone[950],
            subtle: colors.stone[900],
            DEFAULT: colors.stone[950],
            emphasis: colors.stone[300]
          },
          border: {
            DEFAULT: colors.stone[800]
          },
          ring: {
            DEFAULT: colors.stone[700]
          },
          content: {
            subtle: colors.stone[500],
            DEFAULT: colors.stone[400],
            emphasis: colors.stone[200],
            strong: colors.stone[50],
            inverted: colors.stone[950]
          }
        }
      },
      boxShadow: {
        "tremor-input": "0 1px 2px 0 rgb(28 25 23 / 0.05)",
        "tremor-card": "0 1px 2px 0 rgb(28 25 23 / 0.04), 0 8px 24px -18px rgb(28 25 23 / 0.16)",
        "dark-tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.35)",
        "dark-tremor-card": "0 1px 2px 0 rgb(0 0 0 / 0.35), 0 8px 24px -18px rgb(0 0 0 / 0.5)"
      },
      borderRadius: {
        "tremor-small": "0.5rem",
        "tremor-default": "0.875rem",
        "tremor-full": "9999px"
      },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.375rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }]
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};
