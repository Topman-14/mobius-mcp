import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Popup } from "./modules/popup/index.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
