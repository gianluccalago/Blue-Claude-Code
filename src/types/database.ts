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
  | "servicos_gerais"
  | "lavanderia"
  | "coordenacao"
  | "cuidador"
  | "enfermagem"
  | "enfermeira"
  | "multidisciplinar"
  | "nutricionista"
  | "farmacia"
  | "administracao"
  | "direcao"
  | "familia";

export type FuncaoProfissional = "Cuidadora" | "Técnica de Enfermagem" | "Enfermeira";
export type VinculoProfissional = "CLT" | "PJ";
export type CategoriaTurno = "cuidadoras" | "enfermeiras";
export type TagTurno = "diurno" | "noturno";

export type GrauDependencia = "I" | "II" | "III";
/** Ocupação da suíte. */
export type OcupacaoSuite = "simples" | "duplo" | "triplo";
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
export type PerfilSolicitanteChamado =
  | "hotelaria"
  | "servicos_gerais"
  | "cuidador"
  | "coordenacao"
  | "master";

/** Destino do chamado de manutenção: quem o trata/gere. */
export type DestinoChamado = "hotelaria" | "servicos_gerais";
export type TipoSuite = "Suíte" | "Suíte Premium" | "Long Stay" | "Apartamento";
/** Ocupação do quarto = preço por nº de leitos (simples/duplo/triplo). */
export type Ocupacao = "simples" | "duplo" | "triplo";
// Status de cobrança da mensalidade — controle MANUAL (a Administração move o
// status na mão). "vencida" normalmente é calculada (em_aberto/enviada com
// vencimento passado), mas também pode ser gravada. Migra do antigo
// pago→paga / pendente→em_aberto (ver 0044).
export type StatusPagamentoMensalidade =
  | "em_aberto"
  | "enviada"
  | "paga"
  | "vencida"
  | "cancelada";

/** Forma de pagamento registrada manualmente (sem integração). */
export type FormaPagamento = "pix" | "boleto" | "cartao" | "dinheiro" | "transferencia";
export type TipoRemuneracao = "mensal_fixo" | "por_plantao";
export type StatusPagamentoPessoal = "pendente" | "pago";
export type DestinoSolicitacao = "coordenacao" | "medico" | "administracao";

/** Desfecho do atendimento da ambulância (SAMU/privada) numa intercorrência. */
export type DesfechoAmbulancia = "removido_hospital" | "medicado_local";

/** Quem respondeu a pesquisa de NPS. */
export type RespondenteNps = "familiar" | "idoso";

/** Tipo de atendimento individual da Equipe Multidisciplinar. */
export type TipoAtendimentoIndividual = "fisioterapia" | "terapia_ocupacional" | "educacao_fisica";
/** Avaliação de cobrança do atendimento individual (decidida pela Administração). */
export type StatusCobrancaAtendimento = "pendente_avaliacao" | "cobrado" | "nao_cobrar";
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
  | "Terapia avulsa"
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
          foto_url: string | null;
          celular_proprio: string | null;
          // Responsável FINANCEIRO (quem paga — em geral o filho, não o idoso).
          resp_fin_nome: string | null;
          resp_fin_cpf: string | null;
          resp_fin_email: string | null;
          resp_fin_telefone: string | null;
          resp_fin_relacao: string | null;
          // RESERVADO: id do cliente na plataforma de cobrança (ex.: Asaas). NULL por ora.
          asaas_customer_id: string | null;
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
          foto_url?: string | null;
          celular_proprio?: string | null;
          resp_fin_nome?: string | null;
          resp_fin_cpf?: string | null;
          resp_fin_email?: string | null;
          resp_fin_telefone?: string | null;
          resp_fin_relacao?: string | null;
          asaas_customer_id?: string | null;
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
          foto_url: string | null;
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
          foto_url?: string | null;
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
          // Alergeno que casou com o medicamento e foi CONFIRMADO pelo médico
          // ao prescrever (trilha do alerta de alergia; null = sem conflito).
          alerta_alergia: string | null;
          // Médico autor da prescrição (usuarios.id, perfil medico/master).
          // A receita PDF assina SEMPRE com este médico — nunca quem exporta.
          prescrito_por: string | null;
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
          alerta_alergia?: string | null;
          prescrito_por?: string | null;
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
          // Motivo quando status="nao" (Recusou/Indisposto/Ausente/Outro).
          motivo: string | null;
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
          motivo?: string | null;
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
          // Chamado de ambulância (SAMU/privada) atrelado à intercorrência.
          ambulancia_acionada: boolean;
          ambulancia_medico: string | null;
          ambulancia_tempo_resposta_min: number | null;
          ambulancia_desfecho: DesfechoAmbulancia | null;
          ambulancia_hospital_destino: string | null;
        };
        Insert: {
          id?: string;
          residente_id: string;
          tipo: string;
          observacao?: string | null;
          registrado_por?: string | null;
          registrado_em?: string;
          foto_url?: string | null;
          ambulancia_acionada?: boolean;
          ambulancia_medico?: string | null;
          ambulancia_tempo_resposta_min?: number | null;
          ambulancia_desfecho?: DesfechoAmbulancia | null;
          ambulancia_hospital_destino?: string | null;
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
          // 5.5: desfecho do compromisso ("como foi"), visível à família.
          como_foi: string | null;
          como_foi_por: string | null;
          como_foi_em: string | null;
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
          como_foi?: string | null;
          como_foi_por?: string | null;
          como_foi_em?: string | null;
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
          perfil_responsavel: "farmacia" | "coordenacao" | "medico" | "enfermeira";
          registrado_em: string;
        };
        Insert: {
          id?: string;
          estoque_resgate_id: string;
          residente_id: string;
          quantidade: number;
          motivo: string;
          administrado_por: string;
          perfil_responsavel: "farmacia" | "coordenacao" | "medico" | "enfermeira";
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
          // Quem trata o chamado: Hotelaria ou Serviços Gerais.
          destino: DestinoChamado;
          responsavel: string | null;
          prazo: string | null;
          foto_url: string | null;
          inspecao_item_id: string | null;
          // Sinalização da gestão (Administração/Master): "priorizado/cobrado".
          cobrado_gestao: boolean;
          cobrado_em: string | null;
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
          destino?: DestinoChamado;
          responsavel?: string | null;
          prazo?: string | null;
          foto_url?: string | null;
          inspecao_item_id?: string | null;
          cobrado_gestao?: boolean;
          cobrado_em?: string | null;
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
          ocupacao: Ocupacao;
          valor: number;
        };
        Insert: {
          id?: string;
          tipo_suite: TipoSuite;
          grau: GrauDependencia;
          ocupacao?: Ocupacao;
          valor: number;
        };
        Update: Partial<Database["public"]["Tables"]["tabela_preco"]["Insert"]>;
        Relationships: [];
      };
      configuracao: {
        Row: {
          chave: string;
          valor: string | null;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: {
          chave: string;
          valor?: string | null;
          atualizado_em?: string;
          atualizado_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["configuracao"]["Insert"]>;
        Relationships: [];
      };
      procedimento_enfermagem: {
        Row: {
          id: string;
          residente_id: string;
          procedimento: string;
          observacao: string | null;
          registrado_por: string | null;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          procedimento: string;
          observacao?: string | null;
          registrado_por?: string | null;
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["procedimento_enfermagem"]["Insert"]>;
        Relationships: [];
      };
      nps_pesquisa: {
        Row: {
          id: string;
          residente_id: string;
          respondente: RespondenteNps;
          aplicada_por: string | null;
          perfil_aplicador: string | null;
          data: string;
          observacao_geral: string | null;
        };
        Insert: {
          id?: string;
          residente_id: string;
          respondente: RespondenteNps;
          aplicada_por?: string | null;
          perfil_aplicador?: string | null;
          data?: string;
          observacao_geral?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["nps_pesquisa"]["Insert"]>;
        Relationships: [];
      };
      nps_resposta: {
        Row: {
          id: string;
          pesquisa_id: string;
          dimensao: string;
          nota: number;
          comentario: string | null;
        };
        Insert: {
          id?: string;
          pesquisa_id: string;
          dimensao: string;
          nota: number;
          comentario?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["nps_resposta"]["Insert"]>;
        Relationships: [];
      };
      atendimento_individual: {
        Row: {
          id: string;
          residente_id: string;
          tipo: TipoAtendimentoIndividual;
          data: string;
          evolucao: string | null;
          realizado_por: string | null;
          perfil_realizador: string | null;
          status_cobranca: StatusCobrancaAtendimento;
          upselling_id: string | null;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          tipo: TipoAtendimentoIndividual;
          data?: string;
          evolucao?: string | null;
          realizado_por?: string | null;
          perfil_realizador?: string | null;
          status_cobranca?: StatusCobrancaAtendimento;
          upselling_id?: string | null;
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["atendimento_individual"]["Insert"]>;
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
          // Cobrança (controle manual; reservado p/ futura integração).
          data_vencimento: string | null;
          forma_pagamento: FormaPagamento | null;
          valor_pago: number | null;
          data_pagamento: string | null;
          // RESERVADO: id da cobrança na plataforma externa (ex.: Asaas). NULL por ora.
          id_cobranca_externa: string | null;
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
          data_vencimento?: string | null;
          forma_pagamento?: FormaPagamento | null;
          valor_pago?: number | null;
          data_pagamento?: string | null;
          id_cobranca_externa?: string | null;
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
      log_alteracao: {
        Row: {
          id: string;
          tabela_origem: string;
          registro_id: string;
          campo: string;
          valor_anterior: string | null;
          valor_novo: string | null;
          motivo: string | null;
          alterado_por: string;
          alterado_em: string;
        };
        Insert: {
          id?: string;
          tabela_origem: string;
          registro_id: string;
          campo: string;
          valor_anterior?: string | null;
          valor_novo?: string | null;
          motivo?: string | null;
          alterado_por: string;
          alterado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["log_alteracao"]["Insert"]>;
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
          // 5.3: quando o setor de destino abriu o item ("Em análise por X").
          em_analise_em: string | null;
          em_analise_por: string | null;
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
          em_analise_em?: string | null;
          em_analise_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["solicitacao_familia"]["Insert"]>;
        Relationships: [];
      };
      // ── CRM comercial (funil de admissão) ──────────────────────────────
      crm_etapa: {
        Row: { id: string; nome: string; ordem: number; ativo: boolean };
        Insert: { id?: string; nome: string; ordem?: number; ativo?: boolean };
        Update: Partial<Database["public"]["Tables"]["crm_etapa"]["Insert"]>;
        Relationships: [];
      };
      crm_motivo_perda: {
        Row: { id: string; nome: string; ativo: boolean };
        Insert: { id?: string; nome: string; ativo?: boolean };
        Update: Partial<Database["public"]["Tables"]["crm_motivo_perda"]["Insert"]>;
        Relationships: [];
      };
      crm_origem: {
        Row: { id: string; nome: string; tipo: string | null; ativo: boolean };
        Insert: { id?: string; nome: string; tipo?: string | null; ativo?: boolean };
        Update: Partial<Database["public"]["Tables"]["crm_origem"]["Insert"]>;
        Relationships: [];
      };
      crm_contato: {
        Row: {
          id: string;
          nome: string;
          telefones: string[];
          emails: string[];
          relacao: string | null;
          nome_idoso: string | null;
          idade_idoso: number | null;
          grau_estimado: GrauDependencia | null;
          base_legal_lgpd: "consentimento" | "legitimo_interesse" | "nao_definida";
          observacoes: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          telefones?: string[];
          emails?: string[];
          relacao?: string | null;
          nome_idoso?: string | null;
          idade_idoso?: number | null;
          grau_estimado?: GrauDependencia | null;
          base_legal_lgpd?: "consentimento" | "legitimo_interesse" | "nao_definida";
          observacoes?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["crm_contato"]["Insert"]>;
        Relationships: [];
      };
      crm_oportunidade: {
        Row: {
          id: string;
          nome: string;
          contato_id: string;
          origem_id: string | null;
          qualificacao: number;
          valor_mensalidade_estimado: number | null;
          tipo_suite_interesse: string | null;
          previsao_fechamento: string | null;
          etapa: string;
          status: "nova" | "em_andamento" | "ganha" | "perdida" | "pausada";
          motivo_perda: string | null;
          responsavel: string | null;
          residente_id: string | null;
          criado_em: string;
          fechado_em: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          contato_id: string;
          origem_id?: string | null;
          qualificacao?: number;
          valor_mensalidade_estimado?: number | null;
          tipo_suite_interesse?: string | null;
          previsao_fechamento?: string | null;
          etapa?: string;
          status?: "nova" | "em_andamento" | "ganha" | "perdida" | "pausada";
          motivo_perda?: string | null;
          responsavel?: string | null;
          residente_id?: string | null;
          criado_em?: string;
          fechado_em?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["crm_oportunidade"]["Insert"]>;
        Relationships: [];
      };
      crm_tarefa: {
        Row: {
          id: string;
          oportunidade_id: string;
          tipo: string;
          assunto: string;
          descricao: string | null;
          responsavel: string | null;
          data: string | null;
          hora: string | null;
          concluida: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          oportunidade_id: string;
          tipo?: string;
          assunto: string;
          descricao?: string | null;
          responsavel?: string | null;
          data?: string | null;
          hora?: string | null;
          concluida?: boolean;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["crm_tarefa"]["Insert"]>;
        Relationships: [];
      };
      crm_evento: {
        Row: {
          id: string;
          oportunidade_id: string;
          tipo: string;
          descricao: string | null;
          autor: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          oportunidade_id: string;
          tipo: string;
          descricao?: string | null;
          autor?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["crm_evento"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // Atualiza somente a foto do PRÓPRIO usuário (segurança: não altera perfil).
      set_minha_foto: {
        Args: { p_url: string | null };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/* Atalhos de tipo para uso nas telas */
export type Residente = Database["public"]["Tables"]["residentes"]["Row"];
export type CrmEtapa = Database["public"]["Tables"]["crm_etapa"]["Row"];
export type CrmMotivoPerda = Database["public"]["Tables"]["crm_motivo_perda"]["Row"];
export type CrmOrigem = Database["public"]["Tables"]["crm_origem"]["Row"];
export type CrmContato = Database["public"]["Tables"]["crm_contato"]["Row"];
export type CrmOportunidade = Database["public"]["Tables"]["crm_oportunidade"]["Row"];
export type CrmTarefa = Database["public"]["Tables"]["crm_tarefa"]["Row"];
export type CrmEvento = Database["public"]["Tables"]["crm_evento"]["Row"];
export type CrmStatus = CrmOportunidade["status"];
export type LogAlteracao = Database["public"]["Tables"]["log_alteracao"]["Row"];
export type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
export type PlanoCuidadoItem = Database["public"]["Tables"]["plano_cuidado_item"]["Row"];
export type TarefaRegistro = Database["public"]["Tables"]["tarefa_registro"]["Row"];
export type Prescricao = Database["public"]["Tables"]["prescricao"]["Row"];
export type Administracao = Database["public"]["Tables"]["administracao"]["Row"];
export type ProcedimentoEnfermagem = Database["public"]["Tables"]["procedimento_enfermagem"]["Row"];
export type NpsPesquisa = Database["public"]["Tables"]["nps_pesquisa"]["Row"];
export type NpsResposta = Database["public"]["Tables"]["nps_resposta"]["Row"];
export type AtendimentoIndividual = Database["public"]["Tables"]["atendimento_individual"]["Row"];
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
