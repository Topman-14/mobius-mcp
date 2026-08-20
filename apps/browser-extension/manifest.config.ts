import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Mobius",
  version: "1.1.0",
  description:
    "Let your AI coding agent drive and debug your app in your real, logged-in browser and see what it causes.",
  permissions: ["scripting", "storage", "tabs", "webNavigation", "debugger", "alarms"],
  optional_permissions: ["notifications"],
  host_permissions: ["<all_urls>"],
  icons: {
    16: "icons/icon-16.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  action: {
    default_popup: "popup.html",
    default_icon: {
      16: "icons/icon-16.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  },
  options_page: "options.html",
  web_accessible_resources: [
    {
      resources: ["src/content-script.js", "src/injected.js"],
      matches: ["<all_urls>"],
    },
  ],
});
