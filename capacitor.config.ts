import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.moni2go.app",
  appName: "moni2go",
  webDir: "android-web",
  server: {
    // Keep the Android shell on the same deployed app and financial logic.
    url: "https://moni2go.vercel.app",
    cleartext: false,
  },
};

export default config;
