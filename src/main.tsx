import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { router } from "./router";
import { AuthProvider } from "./auth/AuthProvider";
import { mensagemAmigavel } from "./lib/erros";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
  // Rede de segurança: mutation que falha SEM onError próprio avisa o usuário
  // (antes, dezenas de chamadas .mutate() falhavam em silêncio — registrar
  // medicação, marcar tarefa, resolver alerta…). Quem trata localmente segue
  // tratando; o id fixo evita empilhar toasts.
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      console.error("[mutation]", error);
      if (mutation.options.onError) return;
      toast.error(mensagemAmigavel(error), { id: "erro-mutacao", duration: 6000 });
    },
  }),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" duration={3000} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
