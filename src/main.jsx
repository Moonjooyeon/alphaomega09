import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GonadalReport from "../gonadal-report.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GonadalReport />
  </StrictMode>
);
