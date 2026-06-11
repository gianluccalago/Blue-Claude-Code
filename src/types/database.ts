/**
 * Tipos do banco Supabase (schema public) — escritos na origem para tipar
 * corretamente o cliente, sem casts `as never`/`as unknown`.
 *
 * Mantenha em sincronia com supabase/migrations/0001_init.sql.
 */

export type PerfilUsuario =
  | "master"
  | "medico"
  | "hotelaria"
  | "coordenacao"
  | "cuidador"
  | "enfermagem"
  | "multidisciplinar"
  | "nutricionista"
  | "farmacia"
  | "administracao"
  | "familia";

export type FuncaoProfissional = "Cuidadora" | "Técnica de Enfermagem" | "Enfermeira";
export type VinculoProfissional = "CLT" | "PJ";
export type CategoriaTurno = "cuidadoras" | "enfermeiras";
export type TagTurno = "diurno" | "noturno";

export type GrauDependencia = "I" | "II" | "III";
/** Ocupação da suíte. */
export type OcupacaoSuite = "individual" | "dupla";
export type ViaMedicacao = "oral" | "injetavel" | "insulina" | "sonda";
// 6 períodos de medicação, cada um com horário padrão (ver PERIODOS nas telas).
// "jejum" (06:00) e "noite" (20:00) são separados (antes eram "noite/jejum").
export type PeriodoMedicacao =
  | "jejum"
  | "manha"
  | "almoco"
  | "apos_almoco"
  | "tarde"
  | "noite";
export type StatusAdministracao = "sim" | "parcial" | "nao";
export type TipoEliminacao = "urina" | "evacuacao";
export type TipoOrigemPendencia = "medicacao" | "intercorrencia" | "eliminacao" | "tarefa";
export type AcaoPendencia = "resolvido" | "escalado_medico";
export type AcaoEliminacaoTratamento = "silenciado" | "escalado_medico";
export type TipoInspecao = "diaria" | "preventiva";
export type StatusItemInspecao = "conforme" | "nao_conforme";
export type UrgenciaChamado = "baixa" | "media" | "alta" | "emergencia";
export type StatusChamado = "aberto" | "em_andamento" | "resolvido";
export type PerfilSolicitanteChamado = "hotelaria" | "cuidador" | "coordenacao" | "master";
export type TipoSuite = "Suíte Modular" | "Suíte" | "Long Stay" | "Apartamento";
export type Ocupacao = "individual" | "dupla";
export type StatusPagamentoMensalidade = "pendente" | "pago";
export type TipoRemuneracao = "mensal_fixo" | "por_plantao";
export type StatusPagamentoPessoal = "pendente" | "pago";
export type DestinoSolicitacao = "coordenacao" | "medico" | "administracao";
export type StatusSolicitacaoFamilia = "aberta" | "respondida";
export type CategoriaUpselling =
  | "Medicamentos"
  | "Manicure/cabeleireiro"
  | "Fisioterapia avulsa"
  | "Acompanhamento externo"
  | "Equipamentos"
  | "Passeios"
  | "Deslocamentos"
  | "Lavanderia extra"
  | "Compras pessoais"
  | "Outros";

export interface ItemDispensacaoJson {
  medicamento: string;
  quantidade: number;
  unidade: string;
}

export interface Database {
  public: {
    Tables: {
      residentes: {
        Row: {
          id: string;
          nome: string;
          data_nascimento: string | null;
          // Grau ATUAL (vem do IVCF).
          grau_dependencia: GrauDependencia | null;
          // Grau CONTRATUAL (definido no contrato) — divergência = renegociação.
          grau_contratual: GrauDependencia | null;
          modulo: number | null;
          andar: number | null;
          quarto: string | null;
          cpf: string | null;
          tipo_suite: TipoSuite | null;
          ocupacao: Ocupacao | null;
          responsavel_legal: string | null;
          contato: string | null;
          contato_emergencia_nome: string | null;
          contato_emergencia_telefone: string | null;
          plano_saude_operadora: string | null;
          plano_saude_numero: string | null;
          hospital_referencia: string | null;
          alergias: string | null;
          proteses: string | null;
          mensalidade_valor: number | null;
          mensalidade_ajuste_obs: string | null;
          historia_vida: string | null;
          data_admissao: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          data_nascimento?: string | null;
          grau_dependencia?: GrauDependencia | null;
          grau_contratual?: GrauDependencia | null;
          modulo?: number | null;
          andar?: number | null;
          quarto?: string | null;
          cpf?: string | null;
          tipo_suite?: TipoSuite | null;
          ocupacao?: Ocupacao | null;
          responsavel_legal?: string | null;
          contato?: string | null;
          contato_emergencia_nome?: string | null;
          contato_emergencia_telefone?: string | null;
          plano_saude_operadora?: string | null;
          plano_saude_numero?: string | null;
          hospital_referencia?: string | null;
          alergias?: string | null;
          proteses?: string | null;
          mensalidade_valor?: number | null;
          mensalidade_ajuste_obs?: string | null;
          historia_vida?: string | null;
          data_admissao?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["residentes"]["Insert"]>;
        Relationships: [];
      };
      usuarios: {
        Row: {
          id: string;
          nome: string;
          email: string | null;
          perfil: PerfilUsuario;
          ativo: boolean;
          funcao: string | null;
          vinculo: string | null;
          registro_profissional: string | null;
          isento_ponto_app: boolean;
          // Residente que o usuário-família acompanha (null nos demais perfis).
          // Trava de visibilidade do Portal da Família sob autenticação.
          residente_vinculado: string | null;
          // Remuneração (base dos custos de pessoal da Administração).
          tipo_remuneracao: TipoRemuneracao | null;
          valor_mensal: number | null;
          valor_plantao_diurno: number | null;
          valor_plantao_noturno: number | null;
          // Horário fixo dos mensalistas (quem não é escalado). Ex "Seg–Sex 8h–17h".
          horario_trabalho: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          email?: string | null;
          perfil: PerfilUsuario;
          ativo?: boolean;
          funcao?: string | null;
          vinculo?: string | null;
          registro_profissional?: string | null;
          isento_ponto_app?: boolean;
          residente_vinculado?: string | null;
          tipo_remuneracao?: TipoRemuneracao | null;
          valor_mensal?: number | null;
          valor_plantao_diurno?: number | null;
          valor_plantao_noturno?: number | null;
          horario_trabalho?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["usuarios"]["Insert"]>;
        Relationships: [];
      };
      cuidador_residente: {
        Row: {
          id: string;
          cuidador_id: string;
          residente_id: string;
        };
        Insert: {
          id?: string;
          cuidador_id: string;
          residente_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["cuidador_residente"]["Insert"]>;
        Relationships: [];
      };
      plano_cuidado_item: {
        Row: {
          id: string;
          residente_id: string;
          tarefa: string;
          horario: string | null;
          responsavel: string | null;
          tolerancia_minutos: number;
          ativa: boolean;
        };
        Insert: {
          id?: string;
          residente_id: string;
          tarefa: string;
          horario?: string | null;
          responsavel?: string | null;
          tolerancia_minutos?: number;
          ativa?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["plano_cuidado_item"]["Insert"]>;
        Relationships: [];
      };
      tarefa_registro: {
        Row: {
          id: string;
          residente_id: string;
          tarefa: string;
          data: string;
          horario: string | null;
          status: string;
          feito_por: string | null;
          feito_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          tarefa: string;
          data?: string;
          horario?: string | null;
          status?: string;
          feito_por?: string | null;
          feito_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tarefa_registro"]["Insert"]>;
        Relationships: [];
      };
      prescricao: {
        Row: {
          id: string;
          residente_id: string;
          medicamento: string;
          dose: string | null;
          via: ViaMedicacao;
          periodo: PeriodoMedicacao;
          horario: string | null;
          ativa: boolean;
          quantidade: string | null;
          posologia: string | null;
          grupo_prescricao: string | null;
        };
        Insert: {
          id?: string;
          residente_id: string;
          medicamento: string;
          dose?: string | null;
          via: ViaMedicacao;
          periodo: PeriodoMedicacao;
          horario?: string | null;
          ativa?: boolean;
          quantidade?: string | null;
          posologia?: string | null;
          grupo_prescricao?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["prescricao"]["Insert"]>;
        Relationships: [];
      };
      administracao: {
        Row: {
          id: string;
          residente_id: string;
          periodo: string;
          status: StatusAdministracao;
          itens_faltantes: string | null;
          administrado_por: string | null;
          administrado_em: string;
          prescricao_id: string | null;
          // Integração futura com o módulo Farmácia: indica se a baixa de
          // estoque já foi dada. Ainda não há lógica/tela usando este campo.
          baixa_farmacia: boolean;
        };
        Insert: {
          id?: string;
          residente_id: string;
          periodo: string;
          status: StatusAdministracao;
          itens_faltantes?: string | null;
          administrado_por?: string | null;
          administrado_em?: string;
          prescricao_id?: string | null;
          baixa_farmacia?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["administracao"]["Insert"]>;
        Relationships: [];
      };
      intercorrencia: {
        Row: {
          id: string;
          residente_id: string;
          tipo: string;
          observacao: string | null;
          registrado_por: string | null;
          registrado_em: string;
          foto_url: string | null;
        };
        Insert: {
          id?: string;
          residente_id: string;
          tipo: string;
          observacao?: string | null;
          registrado_por?: string | null;
          registrado_em?: string;
          foto_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["intercorrencia"]["Insert"]>;
        Relationships: [];
      };
      compromisso_externo: {
        Row: {
          id: string;
          residente_id: string;
          titulo: string;
          data: string | null;
          horario: string | null;
          horario_transporte: string | null;
          // Detalhes/instruções do compromisso (ex: "Levar exame X").
          // Alimentado por Família/Administrativo quando esses perfis existirem.
          detalhes: string | null;
          ciente_por: string | null;
          ciente_em: string | null;
        };
        Insert: {
          id?: string;
          residente_id: string;
          titulo: string;
          data?: string | null;
          horario?: string | null;
          horario_transporte?: string | null;
          detalhes?: string | null;
          ciente_por?: string | null;
          ciente_em?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["compromisso_externo"]["Insert"]>;
        Relationships: [];
      };
      eliminacao: {
        Row: {
          id: string;
          residente_id: string;
          tipo: TipoEliminacao;
          registrado_por: string | null;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          tipo: TipoEliminacao;
          registrado_por?: string | null;
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["eliminacao"]["Insert"]>;
        Relationships: [];
      };
      modelo_rotina: {
        Row: {
          id: string;
          nome: string;
          ativo: boolean;
        };
        Insert: {
          id?: string;
          nome: string;
          ativo?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["modelo_rotina"]["Insert"]>;
        Relationships: [];
      };
      modelo_rotina_item: {
        Row: {
          id: string;
          modelo_id: string;
          tarefa: string;
          horario: string | null;
          responsavel: string | null;
          tolerancia_minutos: number;
        };
        Insert: {
          id?: string;
          modelo_id: string;
          tarefa: string;
          horario?: string | null;
          responsavel?: string | null;
          tolerancia_minutos?: number;
        };
        Update: Partial<Database["public"]["Tables"]["modelo_rotina_item"]["Insert"]>;
        Relationships: [];
      };
      pendencia_tratamento: {
        Row: {
          id: string;
          tipo_origem: TipoOrigemPendencia;
          referencia_id: string;
          acao: AcaoPendencia;
          tratado_por: string | null;
          tratado_em: string;
          observacao: string | null;
        };
        Insert: {
          id?: string;
          tipo_origem: TipoOrigemPendencia;
          referencia_id: string;
          acao: AcaoPendencia;
          tratado_por?: string | null;
          tratado_em?: string;
          observacao?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pendencia_tratamento"]["Insert"]>;
        Relationships: [];
      };
      eliminacao_tratamento: {
        Row: {
          id: string;
          residente_id: string;
          tipo_alerta: TipoEliminacao;
          acao: AcaoEliminacaoTratamento;
          observacao: string | null;
          tratado_por: string | null;
          tratado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          tipo_alerta: TipoEliminacao;
          acao: AcaoEliminacaoTratamento;
          observacao?: string | null;
          tratado_por?: string | null;
          tratado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["eliminacao_tratamento"]["Insert"]>;
        Relationships: [];
      };
      resolucao_medica: {
        Row: {
          id: string;
          tipo_origem: "intercorrencia" | "eliminacao";
          referencia_id: string;
          observacao: string | null;
          resolvido_por: string;
          resolvido_em: string;
        };
        Insert: {
          id?: string;
          tipo_origem: "intercorrencia" | "eliminacao";
          referencia_id: string;
          observacao?: string | null;
          resolvido_por?: string;
          resolvido_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["resolucao_medica"]["Insert"]>;
        Relationships: [];
      };
      estoque_resgate: {
        Row: {
          id: string;
          medicamento: string;
          quantidade_atual: number;
          unidade: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          medicamento: string;
          quantidade_atual?: number;
          unidade?: string;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["estoque_resgate"]["Insert"]>;
        Relationships: [];
      };
      baixa_resgate: {
        Row: {
          id: string;
          estoque_resgate_id: string;
          residente_id: string;
          quantidade: number;
          motivo: string;
          administrado_por: string;
          perfil_responsavel: "farmacia" | "coordenacao" | "medico";
          registrado_em: string;
        };
        Insert: {
          id?: string;
          estoque_resgate_id: string;
          residente_id: string;
          quantidade: number;
          motivo: string;
          administrado_por: string;
          perfil_responsavel: "farmacia" | "coordenacao" | "medico";
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["baixa_resgate"]["Insert"]>;
        Relationships: [];
      };
      estoque_hospede: {
        Row: {
          id: string;
          residente_id: string;
          medicamento: string;
          mes_referencia: string;
          quantidade_provisionada: number;
          quantidade_atual: number;
          unidade: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          medicamento: string;
          mes_referencia: string;
          quantidade_provisionada: number;
          quantidade_atual: number;
          unidade?: string;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["estoque_hospede"]["Insert"]>;
        Relationships: [];
      };
      evolucao: {
        Row: {
          id: string;
          residente_id: string;
          texto: string;
          registrado_por: string;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          texto: string;
          registrado_por?: string;
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["evolucao"]["Insert"]>;
        Relationships: [];
      };
      avaliacao_ivcf: {
        Row: {
          id: string;
          residente_id: string;
          respostas: Record<string, unknown>;
          pontuacao_total: number;
          classificacao: "Grau I" | "Grau II" | "Grau III";
          dominios_alterados: string[];
          itens_indisponiveis: string[];
          registrado_por: string;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          respostas: Record<string, unknown>;
          pontuacao_total: number;
          classificacao: "Grau I" | "Grau II" | "Grau III";
          dominios_alterados?: string[];
          itens_indisponiveis?: string[];
          registrado_por?: string;
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["avaliacao_ivcf"]["Insert"]>;
        Relationships: [];
      };
      inspecao_suite: {
        Row: {
          id: string;
          residente_id: string | null;
          quarto: string | null;
          tipo: TipoInspecao;
          data: string;
          inspecionado_por: string;
          inspecionado_em: string;
          tem_nao_conformidade: boolean;
        };
        Insert: {
          id?: string;
          residente_id?: string | null;
          quarto?: string | null;
          tipo: TipoInspecao;
          data?: string;
          inspecionado_por?: string;
          inspecionado_em?: string;
          tem_nao_conformidade?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["inspecao_suite"]["Insert"]>;
        Relationships: [];
      };
      inspecao_item: {
        Row: {
          id: string;
          inspecao_id: string;
          item: string;
          status: StatusItemInspecao;
          observacao: string | null;
        };
        Insert: {
          id?: string;
          inspecao_id: string;
          item: string;
          status: StatusItemInspecao;
          observacao?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["inspecao_item"]["Insert"]>;
        Relationships: [];
      };
      chamado_manutencao: {
        Row: {
          id: string;
          local: string;
          residente_id: string | null;
          problema: string;
          urgencia: UrgenciaChamado;
          status: StatusChamado;
          aberto_por: string;
          perfil_solicitante: PerfilSolicitanteChamado;
          responsavel: string | null;
          prazo: string | null;
          foto_url: string | null;
          inspecao_item_id: string | null;
          criado_em: string;
          resolvido_em: string | null;
        };
        Insert: {
          id?: string;
          local: string;
          residente_id?: string | null;
          problema: string;
          urgencia?: UrgenciaChamado;
          status?: StatusChamado;
          aberto_por: string;
          perfil_solicitante: PerfilSolicitanteChamado;
          responsavel?: string | null;
          prazo?: string | null;
          foto_url?: string | null;
          inspecao_item_id?: string | null;
          criado_em?: string;
          resolvido_em?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["chamado_manutencao"]["Insert"]>;
        Relationships: [];
      };
      dispensacao: {
        Row: {
          id: string;
          residente_id: string;
          periodo: string;
          data: string;
          itens: ItemDispensacaoJson[];
          dispensado_por: string;
          dispensado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          periodo: string;
          data?: string;
          itens: ItemDispensacaoJson[];
          dispensado_por?: string;
          dispensado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dispensacao"]["Insert"]>;
        Relationships: [];
      };
      turnos: {
        Row: {
          id: string;
          profissional_id: string | null;
          categoria: CategoriaTurno;
          data: string;
          inicio: string;
          fim: string;
          tag: TagTurno;
          observacao_interna: string | null;
          check_in: string | null;
          check_out: string | null;
          check_in_lat: number | null;
          check_in_lng: number | null;
          check_out_lat: number | null;
          check_out_lng: number | null;
          check_in_manual: boolean;
          check_out_manual: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          profissional_id?: string | null;
          categoria: CategoriaTurno;
          data: string;
          inicio: string;
          fim: string;
          tag: TagTurno;
          observacao_interna?: string | null;
          check_in?: string | null;
          check_out?: string | null;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          check_in_manual?: boolean;
          check_out_manual?: boolean;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["turnos"]["Insert"]>;
        Relationships: [];
      };
      rouparia_transito: {
        Row: {
          id: string;
          categoria: string;
          saldo_atual: number;
          limite: number;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          categoria: string;
          saldo_atual?: number;
          limite?: number;
          atualizado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rouparia_transito"]["Insert"]>;
        Relationships: [];
      };
      atividade: {
        Row: {
          id: string;
          titulo: string;
          descricao: string | null;
          data: string | null;
          horario: string;
          recorrente: boolean;
          dias_semana: string[] | null;
          criada_por: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          titulo: string;
          descricao?: string | null;
          data?: string | null;
          horario: string;
          recorrente?: boolean;
          dias_semana?: string[] | null;
          criada_por: string;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["atividade"]["Insert"]>;
        Relationships: [];
      };
      atividade_execucao: {
        Row: {
          id: string;
          atividade_id: string;
          data: string;
          descricao_geral: string | null;
          foto_url: string | null;
          realizada_por: string;
          realizada_em: string;
        };
        Insert: {
          id?: string;
          atividade_id: string;
          data: string;
          descricao_geral?: string | null;
          foto_url?: string | null;
          realizada_por: string;
          realizada_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["atividade_execucao"]["Insert"]>;
        Relationships: [];
      };
      atividade_participacao: {
        Row: {
          id: string;
          atividade_id: string;
          data: string;
          residente_id: string;
          presente: boolean;
          registrado_por: string;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          atividade_id: string;
          data: string;
          residente_id: string;
          presente?: boolean;
          registrado_por: string;
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["atividade_participacao"]["Insert"]>;
        Relationships: [];
      };
      tabela_preco: {
        Row: {
          id: string;
          tipo_suite: TipoSuite;
          grau: GrauDependencia;
          valor: number;
        };
        Insert: {
          id?: string;
          tipo_suite: TipoSuite;
          grau: GrauDependencia;
          valor: number;
        };
        Update: Partial<Database["public"]["Tables"]["tabela_preco"]["Insert"]>;
        Relationships: [];
      };
      pagamento_mensalidade: {
        Row: {
          id: string;
          residente_id: string;
          mes_referencia: string;
          valor: number;
          status: StatusPagamentoMensalidade;
          pago_em: string | null;
          registrado_por: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          mes_referencia: string;
          valor: number;
          status?: StatusPagamentoMensalidade;
          pago_em?: string | null;
          registrado_por: string;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pagamento_mensalidade"]["Insert"]>;
        Relationships: [];
      };
      dieta: {
        Row: {
          id: string;
          residente_id: string;
          consistencia: string;
          restricoes: string[] | null;
          observacoes: string | null;
          ativa: boolean;
          definida_por: string;
          definida_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          consistencia: string;
          restricoes?: string[] | null;
          observacoes?: string | null;
          ativa?: boolean;
          definida_por?: string;
          definida_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dieta"]["Insert"]>;
        Relationships: [];
      };
      evolucao_nutricional: {
        Row: {
          id: string;
          residente_id: string;
          texto: string;
          registrado_por: string;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          texto: string;
          registrado_por?: string;
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["evolucao_nutricional"]["Insert"]>;
        Relationships: [];
      };
      upselling: {
        Row: {
          id: string;
          residente_id: string;
          categoria: CategoriaUpselling;
          descricao: string | null;
          valor: number;
          data: string;
          mes_referencia: string;
          comprovante_url: string | null;
          lancado_por: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          categoria: CategoriaUpselling;
          descricao?: string | null;
          valor: number;
          data?: string;
          mes_referencia: string;
          comprovante_url?: string | null;
          lancado_por?: string;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["upselling"]["Insert"]>;
        Relationships: [];
      };
      pagamento_pessoal: {
        Row: {
          id: string;
          profissional_id: string;
          mes_referencia: string;
          tipo_remuneracao: TipoRemuneracao;
          plantoes_previstos: number | null;
          plantoes_realizados: number | null;
          valor_calculado: number;
          valor_final: number;
          status: StatusPagamentoPessoal;
          observacao: string | null;
          registrado_por: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          profissional_id: string;
          mes_referencia: string;
          tipo_remuneracao: TipoRemuneracao;
          plantoes_previstos?: number | null;
          plantoes_realizados?: number | null;
          valor_calculado: number;
          valor_final: number;
          status?: StatusPagamentoPessoal;
          observacao?: string | null;
          registrado_por: string;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pagamento_pessoal"]["Insert"]>;
        Relationships: [];
      };
      solicitacao_familia: {
        Row: {
          id: string;
          residente_id: string;
          destino: DestinoSolicitacao;
          assunto: string;
          mensagem: string;
          status: StatusSolicitacaoFamilia;
          resposta: string | null;
          enviada_por: string;
          respondida_por: string | null;
          redirecionada_de: string | null;
          criada_em: string;
          respondida_em: string | null;
        };
        Insert: {
          id?: string;
          residente_id: string;
          destino: DestinoSolicitacao;
          assunto: string;
          mensagem: string;
          status?: StatusSolicitacaoFamilia;
          resposta?: string | null;
          enviada_por?: string;
          respondida_por?: string | null;
          redirecionada_de?: string | null;
          criada_em?: string;
          respondida_em?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["solicitacao_familia"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/* Atalhos de tipo para uso nas telas */
export type Residente = Database["public"]["Tables"]["residentes"]["Row"];
export type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
export type PlanoCuidadoItem = Database["public"]["Tables"]["plano_cuidado_item"]["Row"];
export type TarefaRegistro = Database["public"]["Tables"]["tarefa_registro"]["Row"];
export type Prescricao = Database["public"]["Tables"]["prescricao"]["Row"];
export type Administracao = Database["public"]["Tables"]["administracao"]["Row"];
export type Intercorrencia = Database["public"]["Tables"]["intercorrencia"]["Row"];
export type CompromissoExterno = Database["public"]["Tables"]["compromisso_externo"]["Row"];
export type Eliminacao = Database["public"]["Tables"]["eliminacao"]["Row"];
export type ModeloRotina = Database["public"]["Tables"]["modelo_rotina"]["Row"];
export type ModeloRotinaItem = Database["public"]["Tables"]["modelo_rotina_item"]["Row"];
export type PendenciaTratamento = Database["public"]["Tables"]["pendencia_tratamento"]["Row"];
export type ResolucaoMedica = Database["public"]["Tables"]["resolucao_medica"]["Row"];
export type EliminacaoTratamento = Database["public"]["Tables"]["eliminacao_tratamento"]["Row"];
export type Turno = Database["public"]["Tables"]["turnos"]["Row"];
export type Evolucao = Database["public"]["Tables"]["evolucao"]["Row"];
export type AvaliacaoIVCF = Database["public"]["Tables"]["avaliacao_ivcf"]["Row"];
export type EstoqueHospede = Database["public"]["Tables"]["estoque_hospede"]["Row"];
export type EstoqueResgate = Database["public"]["Tables"]["estoque_resgate"]["Row"];
export type BaixaResgate = Database["public"]["Tables"]["baixa_resgate"]["Row"];
export type Dispensacao = Database["public"]["Tables"]["dispensacao"]["Row"];
export type InspecaoSuite = Database["public"]["Tables"]["inspecao_suite"]["Row"];
export type InspecaoItem = Database["public"]["Tables"]["inspecao_item"]["Row"];
export type ChamadoManutencao = Database["public"]["Tables"]["chamado_manutencao"]["Row"];
export type RoupariaTransito = Database["public"]["Tables"]["rouparia_transito"]["Row"];
export type Atividade = Database["public"]["Tables"]["atividade"]["Row"];
export type AtividadeExecucao = Database["public"]["Tables"]["atividade_execucao"]["Row"];
export type AtividadeParticipacao = Database["public"]["Tables"]["atividade_participacao"]["Row"];
export type Dieta = Database["public"]["Tables"]["dieta"]["Row"];
export type EvolucaoNutricional = Database["public"]["Tables"]["evolucao_nutricional"]["Row"];
export type TabelaPreco = Database["public"]["Tables"]["tabela_preco"]["Row"];
export type PagamentoMensalidade = Database["public"]["Tables"]["pagamento_mensalidade"]["Row"];
export type Upselling = Database["public"]["Tables"]["upselling"]["Row"];
export type PagamentoPessoal = Database["public"]["Tables"]["pagamento_pessoal"]["Row"];
export type SolicitacaoFamilia = Database["public"]["Tables"]["solicitacao_familia"]["Row"];
