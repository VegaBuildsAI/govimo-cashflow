import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        sidebar: "#0D0D0D",
        panel: "#1A1A1A",
        border: "#262626",
        brand: {
          DEFAULT: "#5447E4",
          tint: "#2C1F58",
        },
        muted: "#797979",
      },
      fontFamily: {
        heading: ['"DM Sans"', "sans-serif"],
        body: ["Outfit", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
