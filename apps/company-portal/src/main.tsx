import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        richColors
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#1a1a2e",
            border: "1px solid rgba(139,92,246,0.25)",
            color: "#e2e8f0",
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
