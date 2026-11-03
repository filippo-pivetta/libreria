import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { RegistraServiceWorker } from "@/components/layout/registra-service-worker";
import { LinguaProvider } from "@/providers/lingua-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { router } from "@/router";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Non disegna niente: installa il service worker (public/sw.js). Fuori
        dal router perché deve valere anche sul login. */}
    <RegistraServiceWorker />
    <LinguaProvider>
      <QueryProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryProvider>
    </LinguaProvider>
  </StrictMode>,
);
