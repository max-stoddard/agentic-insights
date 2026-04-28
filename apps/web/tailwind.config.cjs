module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        footprint: {
          water: "#0EA5E9",
          energy: "#F59E0B",
          token: "#4F46E5",
          carbon: "#475569",
          cost: "#16A34A"
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F1F5F9",
          page: "#F8FAFC"
        },
        accent: {
          DEFAULT: "#0EA5E9",
          hover: "#0284C7",
          subtle: "#F0F9FF",
          muted: "#E0F2FE",
          light: "#38BDF8"
        },
        ink: {
          DEFAULT: "#0F172A",
          secondary: "#64748B",
          tertiary: "#94A3B8"
        }
      }
    }
  },
  plugins: []
};
