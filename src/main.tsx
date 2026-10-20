import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app";

import "./styles.css";

const root = document.querySelector("#root");

if (!root) {
  throw new Error("index.html has no #root element to render the app into.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
