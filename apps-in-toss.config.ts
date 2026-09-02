import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "aoreport",
  brand: {
    primaryColor: "#203f35",
  },
  permissions: [{ name: "photos", access: "write" }],
  webBundleDir: "dist",
});
