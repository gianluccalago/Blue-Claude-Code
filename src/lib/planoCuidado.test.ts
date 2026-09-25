import { describe, expect, it } from "vitest";
import { resumoAplicacaoModelo } from "./planoCuidado";

describe("resumoAplicacaoModelo", () => {
  it("modelo vazio", () => {
    expect(resumoAplicacaoModelo({ inseridas: 0, existentes: 0 })).toBe("O modelo não tem tarefas.");
  });

  it("reaplicação sem novidade (CLI-06) explica que nada foi duplicado", () => {
    expect(resumoAplicacaoModelo({ inseridas: 0, existentes: 5 })).toBe(
      "Nenhuma tarefa nova: todas já estavam no plano.",
    );
  });

  it("primeira aplicação só conta o que entrou", () => {
    expect(resumoAplicacaoModelo({ inseridas: 1, existentes: 0 })).toBe("1 tarefa adicionada.");
    expect(resumoAplicacaoModelo({ inseridas: 3, existentes: 0 })).toBe("3 tarefas adicionadas.");
  });

  it("aplicação parcial informa os dois lados, com concordância", () => {
    expect(resumoAplicacaoModelo({ inseridas: 2, existentes: 1 })).toBe(
      "2 tarefas adicionadas. 1 já estava no plano.",
    );
    expect(resumoAplicacaoModelo({ inseridas: 1, existentes: 4 })).toBe(
      "1 tarefa adicionada. 4 já estavam no plano.",
    );
  });
});
