import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GonadalReport from "./report/GonadalReport.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GonadalReport />
  </StrictMode>
);
