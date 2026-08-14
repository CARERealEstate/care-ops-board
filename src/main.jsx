import React from "react";
import { createRoot } from "react-dom/client";
import CareOpsBoard from "./CareOpsBoard.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CareOpsBoard />
  </React.StrictMode>
);

// Register the service worker so the board opens offline once installed.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is a bonus, never a blocker */
    });
  });
}
