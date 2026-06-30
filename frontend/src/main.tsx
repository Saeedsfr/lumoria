import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import App from "./App";
import "./index.css";

const MANIFEST_URL =
  import.meta.env.VITE_APP_URL
    ? `${import.meta.env.VITE_APP_URL}/tonconnect-manifest.json`
    : `${window.location.origin}/tonconnect-manifest.json`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <App />
    </TonConnectUIProvider>
  </StrictMode>
);
