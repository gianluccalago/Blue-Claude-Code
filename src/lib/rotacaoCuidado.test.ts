import { describe, expect, it } from "vitest";
import { planejarRotacao, redistribuirAusentes, indiceSemana, segundaDaSemana, diasDaSemana, repartirProporcional, itensDoPlano } from "@/lib/rotacaoCuidado";

const H = (id: string, quarto: string | null) => ({ id, nome: `Hóspede ${id}`, quarto });
const C = (id: string) => ({ id, nome: `Cuidadora ${id}` });
// Módulo 5, 2 andares: 7 hóspedes no 1º, 5 no 2º.
const hospedes = [
  ...["5101A", "5102A", "5103A", "5104A", "5105A", "5106A", "5107A"].map((q, i) => H(`a${i}`, q)),
  ...["5201A", "5202A", "5203A", "5204A", "5205A"].map((q, i) => H(`b${i}`, q)),
];

describe("rotação semanal de cuidadoras", () => {
  it("cada cuidadora fica num único andar e todos os hóspedes têm cuidadora", () => {
    const plano = planejarRotacao(hospedes, [C("c1"), C("c2"), C("c3"), C("c4")], 0);
    expect(plano).toHaveLength(4);
    for (const g of plano) {
      const andares = new Set(g.hospedes.map((h) => h.quarto!.slice(0, 2)));
      expect(andares.size).toBe(1);
    }
    expect(plano.flatMap((g) => g.hospedes).map((h) => h.id).sort()).toEqual(hospedes.map((h) => h.id).sort());
    // proporcional: 7 hóspedes → 2 cuidadoras (4+3); 5 → 2 (3+2)
    expect(plano.filter((g) => g.andar === 1).map((g) => g.hospedes.length).sort()).toEqual([3, 4]);
    expect(plano.filter((g) => g.andar === 2).map((g) => g.hospedes.length).sort()).toEqual([2, 3]);
  });
  it("gira toda semana: em 4 semanas cada cuidadora passou por todos os 4 grupos", () => {
    const vistos = new Map<string, Set<string>>();
    for (let s = 0; s < 4; s++) {
      for (const g of planejarRotacao(hospedes, [C("c1"), C("c2"), C("c3"), C("c4")], s)) {
        const chave = g.hospedes.map((h) => h.id).join(",");
        if (!vistos.has(g.cuidadora.id)) vistos.set(g.cuidadora.id, new Set());
        vistos.get(g.cuidadora.id)!.add(chave);
      }
    }
    for (const grupos of vistos.values()) expect(grupos.size).toBe(4);
  });
  it("é determinístico e a mesma semana dá o mesmo plano", () => {
    const a = planejarRotacao(hospedes, [C("c2"), C("c1"), C("c3")], 7);
    const b = planejarRotacao(hospedes, [C("c1"), C("c3"), C("c2")], 7);
    expect(a).toEqual(b);
  });
  it("com menos cuidadoras que andares, o andar sem cuidadora vai para o mesmo módulo", () => {
    const plano = planejarRotacao(hospedes, [C("c1")], 0);
    expect(plano).toHaveLength(1);
    expect(plano[0].hospedes).toHaveLength(12);
  });
  it("hóspede sem quarto padrão entra no menor grupo", () => {
    const plano = planejarRotacao([...hospedes, H("x", null), H("y", "Quarto 3")], [C("c1"), C("c2")], 0);
    expect(plano.flatMap((g) => g.hospedes)).toHaveLength(14);
    expect(plano.map((g) => g.hospedes.length).sort()).toEqual([7, 7]);
  });
  it("ausente no dia: os hóspedes dela vão para a colega do mesmo andar", () => {
    const plano = planejarRotacao(hospedes, [C("c1"), C("c2"), C("c3"), C("c4")], 0);
    const ausente = plano[0];
    const dia = redistribuirAusentes(plano, new Set(plano.slice(1).map((g) => g.cuidadora.id)));
    expect(dia).toHaveLength(3);
    const recebeu = dia.find((g) => g.andar === ausente.andar && g.hospedes.some((h) => ausente.hospedes.includes(h)));
    expect(recebeu).toBeDefined();
    expect(dia.flatMap((g) => g.hospedes)).toHaveLength(12);
  });
  it("sem cuidadora → plano vazio; itens do plano listam residente→cuidadora", () => {
    expect(planejarRotacao(hospedes, [], 0)).toEqual([]);
    expect(itensDoPlano(planejarRotacao(hospedes, [C("c1")], 0))).toHaveLength(12);
  });
  it("semana: segunda, índice e dias", () => {
    expect(segundaDaSemana("2026-09-29")).toBe("2026-09-28");
    expect(segundaDaSemana("2026-09-28")).toBe("2026-09-28");
    expect(segundaDaSemana("2026-10-04")).toBe("2026-09-28");
    expect(indiceSemana("2026-10-05") - indiceSemana("2026-09-29")).toBe(1);
    expect(diasDaSemana("2026-09-29")).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  });
  it("repartição proporcional com mínimo de um", () => {
    expect(repartirProporcional(4, [7, 5], true)).toEqual([2, 2]);
    expect(repartirProporcional(3, [7, 5], true)).toEqual([2, 1]);
    expect(repartirProporcional(2, [9, 1], true)).toEqual([1, 1]);
    expect(repartirProporcional(7, [1, 1], false)).toEqual([4, 3]);
  });
});

import { planoDoDia, hidratarPlano, serializarPlano } from "@/lib/rotacaoCuidado";

describe("substituições e faltas com o plano congelado", () => {
  const semana = planejarRotacao(hospedes, [C("c1"), C("c2"), C("c3"), C("c4")], 3);
  it("Fulana faltou, Ciclana cobre: Ciclana herda exatamente o grupo da Fulana; as outras não mudam", () => {
    const fulana = semana[1];
    const presentes = [...semana.filter((g) => g !== fulana).map((g) => g.cuidadora), C("ciclana")];
    const dia = planoDoDia(semana, presentes);
    const ciclana = dia.find((g) => g.cuidadora.id === "ciclana")!;
    expect(ciclana.papel).toBe("substituta");
    expect(ciclana.substituiu).toBe(fulana.cuidadora.nome);
    expect(ciclana.hospedes.map((h) => h.id)).toEqual(fulana.hospedes.map((h) => h.id));
    for (const g of semana) if (g !== fulana) {
      expect(dia.find((d) => d.cuidadora.id === g.cuidadora.id)!.hospedes.map((h) => h.id)).toEqual(g.hospedes.map((h) => h.id));
    }
  });
  it("falta sem substituta: o grupo vai para a colega do mesmo andar", () => {
    const ausente = semana[0];
    const dia = planoDoDia(semana, semana.slice(1).map((g) => g.cuidadora));
    expect(dia).toHaveLength(3);
    const colega = dia.find((d) => d.andar === ausente.andar)!;
    expect(ausente.hospedes.every((h) => colega.hospedes.includes(h))).toBe(true);
  });
  it("substituta a mais entra sem grupo (a Coordenação decide)", () => {
    const dia = planoDoDia(semana, [...semana.map((g) => g.cuidadora), C("extra")]);
    expect(dia.find((d) => d.cuidadora.id === "extra")!.hospedes).toHaveLength(0);
  });
  it("plano gravado é reidratado com hóspede novo e sem quem saiu", () => {
    const gravado = serializarPlano(semana);
    const novo = { id: "novo", nome: "Novo", quarto: "5106B" };
    const atuais = [...hospedes.filter((h) => h.id !== "a0"), novo];
    const nomes = new Map(semana.map((g) => [g.cuidadora.id, g.cuidadora.nome]));
    const h = hidratarPlano(gravado, atuais, nomes);
    expect(h.flatMap((g) => g.hospedes).map((x) => x.id)).not.toContain("a0");
    const grupoDoNovo = h.find((g) => g.hospedes.includes(novo))!;
    expect(grupoDoNovo.andar).toBe(1);
  });
});

describe("planoDoDia sem plano da semana", () => {
  it("não inventa grupos vazios quando o plano ainda não existe", () => {
    expect(planoDoDia([], [C("c1"), C("c2")])).toEqual([]);
  });
});
