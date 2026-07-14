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
  | "familia"
  | "obra_prestador";

export type FuncaoProfissional = "Cuidadora" | "Técnica de Enfermagem" | "Enfermeira";
export type VinculoProfissional = "CLT" | "PJ";
export type CategoriaTurno = "cuidadoras" | "enfermeiras";
export type TagTurno = "diurno" | "noturno";

export type GrauDependencia = "I" | "II" | "III";
/** Ocupação da suíte. */
export type OcupacaoSuite = "simples" | "duplo" | "triplo";
export type ViaMedicacao = "oral" | "injetavel" | "insulina" | "sonda";
/** Módulo Obra: ciclo de vida sequencial de uma fase da obra. */
export type ObraFaseStatus = "nao_iniciada" | "em_andamento" | "trp_emitido" | "trd_emitido";
/** Módulo Obra: fluxo canônico de uma medição (BM) da MO. */
export type ObraMedicaoStatus = "Pendente" | "Em análise" | "Aprovado" | "Reprovado" | "Pago";
/** Documentos mensais obrigatórios da construtora (gate de pagamento). */
export type ObraDocMensalTipo = "inss" | "fgts" | "iss" | "folha";
/** Tipos de assento do livro de controlados (Port. 344/98). */
export type TipoAssentoControlado =
  | "entrada"
  | "dispensacao"
  | "administracao"
  | "perda"
  | "vencimento"
  | "estorno";
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
export type StatusItemInspecao = "conforme" | "nao_conforme" | "nao_se_aplica";
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

/** Categoria do enxoval da casa (patrimônio). */
export type EnxovalCategoria =
  | "roupa_cama"
  | "toalha_banho"
  | "toalha_rosto"
  | "cobertor_manta"
  | "fronha"
  | "outro";
/** Tipo de movimento do enxoval. */
export type EnxovalMovimentoTipo = "entrada" | "baixa_perda" | "ajuste";
/** Categoria de custo de material (despesas da Administração). */
export type CategoriaMaterial = "limpeza" | "manutencao";
export type TipoSuite = "Suíte" | "Suíte Premium" | "Long Stay" | "Apartamento";
/** Ocupação do quarto = preço por nº de leitos (simples/duplo/triplo). */
export type Ocupacao = "simples" | "duplo" | "triplo";
/** Sexo do hóspede. */
export type Sexo = "masculino" | "feminino";
/** Ciclo de vida do hóspede: ativo (presente) ou inativo (saiu). */
export type StatusHospede = "ativo" | "inativo";
/** Modalidade de estadia do hóspede. */
export type ModalidadeEstadia = "longa_permanencia" | "curta_permanencia" | "day_care";
/** Modalidade temporária (cobrança flexível). */
export type ModalidadeTemporaria = "curta_permanencia" | "day_care";
/** Status de uma cobrança temporária. */
export type StatusCobrancaTemporaria = "pendente" | "pago";
/** Tipo de ausência de pessoal (RH). */
export type TipoAusencia =
  | "atestado"
  | "falta_sem_atestado"
  | "ferias"
  | "licenca_maternidade"
  | "licenca_inss"
  | "evento"
  | "outro";
/** Motivo de desligamento (RH). */
export type MotivoDesligamento =
  | "pedido_demissao_voluntario"
  | "sem_justa_causa"
  | "com_justa_causa"
  | "fim_experiencia"
  | "fim_contrato"
  | "outro";
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

/** Categoria do insumo (Nutricionista). */
export type CategoriaInsumo = "supermercado" | "hortifruti" | "carnes" | "panificacao";
/** Unidade de medida do insumo. */
export type UnidadeInsumo = "kg" | "g" | "L" | "ml" | "unidade" | "duzia" | "pacote";
/** Categoria do prato (ficha técnica). */
export type CategoriaPrato =
  | "prato_principal"
  | "guarnicao"
  | "salada"
  | "sobremesa"
  | "cafe_lanche"
  | "outro";

/** Tipo de restrição do cardápio (linha de servir do buffet). */
export type TipoRestricaoCardapio =
  | "livre"
  | "diabetico"
  | "celiaco"
  | "hipossodica"
  | "pastosa"
  | "outro";

/** Refeição do dia. */
export type RefeicaoCardapio =
  | "cafe_manha"
  | "lanche_manha"
  | "almoco"
  | "lanche_tarde"
  | "jantar"
  | "ceia";

/** Refeição no registro de desperdício (refeições + "geral do dia"). */
export type RefeicaoDesperdicio = RefeicaoCardapio | "geral_dia";

// Escala da cozinha (BLOCO N5) — independente da escala assistencial e do ponto.
/** Função na cozinha. */
export type FuncaoCozinha = "cozinheiro" | "auxiliar";
/** Grupo de rodízio: paridade do dia em que a pessoa trabalha. */
export type GrupoCozinha = "par" | "impar";
/** Turnos fixos da cozinha. */
export type TurnoCozinha = "06:30-18:30" | "09:30-21:30" | "08:00-20:00";
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
          altura_m: number | null;
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
          // Ciclo de vida do hóspede.
          sexo: Sexo | null;
          status_hospede: StatusHospede;
          data_saida: string | null;
          motivo_saida: string | null;
          numero_hospede: string | null;
          // Modalidade de estadia (longa/curta permanência, day care).
          modalidade: ModalidadeEstadia;
          data_inicio_estadia: string | null;
          data_fim_prevista: string | null;
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
          altura_m?: number | null;
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
          sexo?: Sexo | null;
          status_hospede?: StatusHospede;
          data_saida?: string | null;
          motivo_saida?: string | null;
          numero_hospede?: string | null;
          modalidade?: ModalidadeEstadia;
          data_inicio_estadia?: string | null;
          data_fim_prevista?: string | null;
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
          // Registro de pessoal SEM ACESSO ao sistema (só equipe + custo, sem login).
          sem_acesso: boolean;
          contato: string | null;
          // Admissão do profissional (tempo de casa / turnover — módulo de RH).
          data_admissao: string | null;
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
          sem_acesso?: boolean;
          contato?: string | null;
          data_admissao?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["usuarios"]["Insert"]>;
        Relationships: [];
      };
      rh_ausencia: {
        Row: {
          id: string;
          profissional_id: string;
          tipo: TipoAusencia;
          data_inicio: string;
          data_fim: string;
          dias: number;
          gerou_cobertura: boolean;
          observacao: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          profissional_id: string;
          tipo: TipoAusencia;
          data_inicio: string;
          data_fim: string;
          dias?: number;
          gerou_cobertura?: boolean;
          observacao?: string | null;
          registrado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rh_ausencia"]["Insert"]>;
        Relationships: [];
      };
      rh_afastamento: {
        Row: {
          id: string;
          profissional_id: string;
          data_inicio: string;
          data_fim: string | null;
          dias_perdidos: number;
          // Sensível (saúde): só o GRUPO do CID, nunca o diagnóstico.
          cid_grupo: string | null;
          observacao: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          profissional_id: string;
          data_inicio: string;
          data_fim?: string | null;
          dias_perdidos?: number;
          cid_grupo?: string | null;
          observacao?: string | null;
          registrado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rh_afastamento"]["Insert"]>;
        Relationships: [];
      };
      rh_desligamento: {
        Row: {
          id: string;
          profissional_id: string;
          data_desligamento: string;
          motivo: MotivoDesligamento;
          cargo: string | null;
          tempo_casa_meses: number | null;
          observacao: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          profissional_id: string;
          data_desligamento: string;
          motivo: MotivoDesligamento;
          cargo?: string | null;
          tempo_casa_meses?: number | null;
          observacao?: string | null;
          registrado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rh_desligamento"]["Insert"]>;
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
          // Sujeito a controle especial (Portaria 344/98) — marcado ao prescrever.
          controlado: boolean;
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
          controlado?: boolean;
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
          // Foto opcional do problema (não-conformidade). Repassada ao chamado.
          foto_url: string | null;
        };
        Insert: {
          id?: string;
          inspecao_id: string;
          item: string;
          status: StatusItemInspecao;
          observacao?: string | null;
          foto_url?: string | null;
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
          // Foto do PROBLEMA vinda da inspeção (distinta da foto_url de encerramento).
          foto_problema_url: string | null;
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
          foto_problema_url?: string | null;
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
      enxoval: {
        Row: {
          id: string;
          categoria: EnxovalCategoria;
          descricao: string;
          quantidade_total: number;
          quantidade_disponivel: number;
          estoque_minimo: number;
          observacao: string | null;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          categoria: EnxovalCategoria;
          descricao: string;
          quantidade_total?: number;
          quantidade_disponivel?: number;
          estoque_minimo?: number;
          observacao?: string | null;
          atualizado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["enxoval"]["Insert"]>;
        Relationships: [];
      };
      enxoval_movimento: {
        Row: {
          id: string;
          enxoval_id: string;
          tipo: EnxovalMovimentoTipo;
          quantidade: number;
          motivo: string | null;
          registrado_por: string | null;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          enxoval_id: string;
          tipo: EnxovalMovimentoTipo;
          quantidade: number;
          motivo?: string | null;
          registrado_por?: string | null;
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["enxoval_movimento"]["Insert"]>;
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
          // Vigência: data a partir da qual este valor passa a valer (YYYY-MM-DD).
          // O preço vigente de uma combinação numa data é a vigência de MAIOR
          // vigente_a_partir_de ≤ data. Múltiplas vigências por combinação =
          // histórico de preços (mudar preço cria nova vigência, não sobrescreve).
          vigente_a_partir_de: string;
        };
        Insert: {
          id?: string;
          tipo_suite: TipoSuite;
          grau: GrauDependencia;
          ocupacao?: Ocupacao;
          valor: number;
          vigente_a_partir_de?: string;
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
      fornecedor: {
        Row: {
          id: string;
          nome: string;
          categoria_principal: string;
          contato: string | null;
          ativo: boolean;
        };
        Insert: {
          id?: string;
          nome: string;
          categoria_principal: string;
          contato?: string | null;
          ativo?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["fornecedor"]["Insert"]>;
        Relationships: [];
      };
      insumo: {
        Row: {
          id: string;
          nome: string;
          categoria: CategoriaInsumo;
          unidade: UnidadeInsumo;
          custo_unitario: number;
          fornecedor_id: string | null;
          observacao: string | null;
          ativo: boolean;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          categoria: CategoriaInsumo;
          unidade: UnidadeInsumo;
          custo_unitario?: number;
          fornecedor_id?: string | null;
          observacao?: string | null;
          ativo?: boolean;
          atualizado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["insumo"]["Insert"]>;
        Relationships: [];
      };
      insumo_preco_historico: {
        Row: {
          id: string;
          insumo_id: string;
          custo_unitario: number;
          vigente_desde: string;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          insumo_id: string;
          custo_unitario: number;
          vigente_desde: string;
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["insumo_preco_historico"]["Insert"]>;
        Relationships: [];
      };
      prato: {
        Row: {
          id: string;
          nome: string;
          categoria: CategoriaPrato;
          rendimento_porcoes: number;
          modo_preparo: string | null;
          observacao: string | null;
          ativo: boolean;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          categoria: CategoriaPrato;
          rendimento_porcoes?: number;
          modo_preparo?: string | null;
          observacao?: string | null;
          ativo?: boolean;
          atualizado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prato"]["Insert"]>;
        Relationships: [];
      };
      prato_insumo: {
        Row: {
          id: string;
          prato_id: string;
          insumo_id: string;
          quantidade: number;
        };
        Insert: {
          id?: string;
          prato_id: string;
          insumo_id: string;
          quantidade: number;
        };
        Update: Partial<Database["public"]["Tables"]["prato_insumo"]["Insert"]>;
        Relationships: [];
      };
      registro_peso: {
        Row: {
          id: string;
          residente_id: string;
          peso_kg: number;
          altura_m: number | null;
          imc: number | null;
          data: string;
          registrado_por: string | null;
          observacao: string | null;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          peso_kg: number;
          altura_m?: number | null;
          imc?: number | null;
          data?: string;
          registrado_por?: string | null;
          observacao?: string | null;
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["registro_peso"]["Insert"]>;
        Relationships: [];
      };
      baixa_viagem: {
        Row: {
          id: string;
          residente_id: string;
          dias: number;
          mes_referencia: string;
          itens: ItemDispensacaoJson[];
          data: string;
          observacao: string | null;
          registrado_por: string | null;
          registrado_em: string;
          estornado: boolean;
          estornado_por: string | null;
          estornado_em: string | null;
        };
        Insert: {
          id?: string;
          residente_id: string;
          dias: number;
          mes_referencia: string;
          itens: ItemDispensacaoJson[];
          data?: string;
          observacao?: string | null;
          registrado_por?: string | null;
          registrado_em?: string;
          estornado?: boolean;
          estornado_por?: string | null;
          estornado_em?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["baixa_viagem"]["Insert"]>;
        Relationships: [];
      };
      cozinha_funcionario: {
        Row: {
          id: string;
          nome: string;
          funcao: FuncaoCozinha;
          grupo: GrupoCozinha;
          turno_padrao: TurnoCozinha;
          ativo: boolean;
          observacao: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          funcao: FuncaoCozinha;
          grupo: GrupoCozinha;
          turno_padrao: TurnoCozinha;
          ativo?: boolean;
          observacao?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cozinha_funcionario"]["Insert"]>;
        Relationships: [];
      };
      cozinha_escala: {
        Row: {
          id: string;
          funcionario_id: string;
          data: string;
          inicio: string;
          fim: string;
          presente: boolean | null;
          observacao: string | null;
        };
        Insert: {
          id?: string;
          funcionario_id: string;
          data: string;
          inicio: string;
          fim: string;
          presente?: boolean | null;
          observacao?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cozinha_escala"]["Insert"]>;
        Relationships: [];
      };
      config_refeicao_equipe: {
        Row: {
          id: string;
          refeicoes_equipe_por_dia: number;
          custo_medio_refeicao_fallback: number;
          vigente_desde: string;
          atualizado_por: string | null;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          refeicoes_equipe_por_dia: number;
          custo_medio_refeicao_fallback: number;
          vigente_desde?: string;
          atualizado_por?: string | null;
          atualizado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["config_refeicao_equipe"]["Insert"]>;
        Relationships: [];
      };
      desperdicio: {
        Row: {
          id: string;
          data: string;
          refeicao: RefeicaoDesperdicio;
          peso_kg: number;
          custo_estimado: number;
          metodo_estimativa: string | null;
          registrado_por: string | null;
          observacao: string | null;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          data?: string;
          refeicao: RefeicaoDesperdicio;
          peso_kg: number;
          custo_estimado?: number;
          metodo_estimativa?: string | null;
          registrado_por?: string | null;
          observacao?: string | null;
          registrado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["desperdicio"]["Insert"]>;
        Relationships: [];
      };
      cardapio: {
        Row: {
          id: string;
          data: string;
          tipo_restricao: TipoRestricaoCardapio;
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          data: string;
          tipo_restricao: TipoRestricaoCardapio;
          observacao?: string | null;
          criado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cardapio"]["Insert"]>;
        Relationships: [];
      };
      cardapio_item: {
        Row: {
          id: string;
          cardapio_id: string;
          refeicao: RefeicaoCardapio;
          prato_id: string;
        };
        Insert: {
          id?: string;
          cardapio_id: string;
          refeicao: RefeicaoCardapio;
          prato_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["cardapio_item"]["Insert"]>;
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
          // Recorrente (fixo mensal) vs avulso — só os fixos entram no Mapa das Suítes.
          recorrente: boolean;
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
          recorrente?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["upselling"]["Insert"]>;
        Relationships: [];
      };
      custo_material: {
        Row: {
          id: string;
          categoria: CategoriaMaterial;
          descricao: string;
          valor: number;
          fornecedor: string | null;
          data: string;
          mes_referencia: string;
          comprovante_url: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          categoria: CategoriaMaterial;
          descricao: string;
          valor: number;
          fornecedor?: string | null;
          data?: string;
          mes_referencia: string;
          comprovante_url?: string | null;
          registrado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["custo_material"]["Insert"]>;
        Relationships: [];
      };
      tabela_diaria: {
        Row: {
          id: string;
          modalidade: ModalidadeTemporaria;
          grau: GrauDependencia;
          tipo_valor: "diaria" | "day_care_periodo";
          valor_referencia: number;
          observacao: string | null;
          atualizado_em: string;
          atualizado_por: string | null;
        };
        Insert: {
          id?: string;
          modalidade: ModalidadeTemporaria;
          grau: GrauDependencia;
          tipo_valor: "diaria" | "day_care_periodo";
          valor_referencia?: number;
          observacao?: string | null;
          atualizado_em?: string;
          atualizado_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tabela_diaria"]["Insert"]>;
        Relationships: [];
      };
      cobranca_temporaria: {
        Row: {
          id: string;
          residente_id: string;
          modalidade: ModalidadeTemporaria;
          descricao: string;
          valor: number;
          periodo_referencia: string;
          data: string;
          status: StatusCobrancaTemporaria;
          pago_em: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          modalidade: ModalidadeTemporaria;
          descricao: string;
          valor: number;
          periodo_referencia: string;
          data?: string;
          status?: StatusCobrancaTemporaria;
          pago_em?: string | null;
          registrado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cobranca_temporaria"]["Insert"]>;
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
      visita_disponibilidade: {
        Row: {
          id: string;
          data: string;
          hora: string;
          capacidade: number;
          bloqueada: boolean;
          motivo_bloqueio: string | null;
        };
        Insert: {
          id?: string;
          data: string;
          hora: string;
          capacidade?: number;
          bloqueada?: boolean;
          motivo_bloqueio?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["visita_disponibilidade"]["Insert"]>;
        Relationships: [];
      };
      visita_agendamento: {
        Row: {
          id: string;
          nome_completo: string;
          whatsapp: string;
          email: string | null;
          data: string;
          hora: string;
          origem: "site" | "app";
          status: "pendente" | "em_contato" | "confirmada" | "remarcada" | "cancelada";
          observacao: string | null;
          oportunidade_id: string | null;
          criado_em: string;
          confirmado_em: string | null;
          atualizado_por: string | null;
        };
        Insert: {
          id?: string;
          nome_completo: string;
          whatsapp: string;
          email?: string | null;
          data: string;
          hora: string;
          origem?: "site" | "app";
          status?: "pendente" | "em_contato" | "confirmada" | "remarcada" | "cancelada";
          observacao?: string | null;
          oportunidade_id?: string | null;
          criado_em?: string;
          confirmado_em?: string | null;
          atualizado_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["visita_agendamento"]["Insert"]>;
        Relationships: [];
      };
      designacao_cuidado: {
        Row: {
          id: string;
          residente_id: string;
          cuidador_id: string;
          data: string;
          turno: string;
          criado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          cuidador_id: string;
          data: string;
          turno: string;
          criado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["designacao_cuidado"]["Insert"]>;
        Relationships: [];
      };
      recado_familia: {
        Row: {
          id: string;
          residente_id: string;
          mensagem: string;
          autor: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          mensagem: string;
          autor?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recado_familia"]["Insert"]>;
        Relationships: [];
      };
      evento_sentinela: {
        Row: {
          id: string;
          residente_id: string;
          intercorrencia_id: string | null;
          tipo: "queda_com_lesao" | "tentativa_suicidio" | "doenca_notificacao_compulsoria";
          descricao_doenca: string | null;
          data_ocorrencia: string;
          descricao: string | null;
          registrado_por: string | null;
          perfil_registrador: string | null;
          gravidade: string | null;
          notificado: boolean;
          notificado_em: string | null;
          notificado_por: string | null;
          orgao_notificado: string | null;
          protocolo_notificacao: string | null;
          observacao_notificacao: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          intercorrencia_id?: string | null;
          tipo: "queda_com_lesao" | "tentativa_suicidio" | "doenca_notificacao_compulsoria";
          descricao_doenca?: string | null;
          data_ocorrencia?: string;
          descricao?: string | null;
          registrado_por?: string | null;
          perfil_registrador?: string | null;
          gravidade?: string | null;
          notificado?: boolean;
          notificado_em?: string | null;
          notificado_por?: string | null;
          orgao_notificado?: string | null;
          protocolo_notificacao?: string | null;
          observacao_notificacao?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["evento_sentinela"]["Insert"]>;
        Relationships: [];
      };
      agravo_epidemiologico: {
        Row: {
          id: string;
          residente_id: string;
          tipo: "obito" | "diarreia_aguda" | "escabiose" | "desidratacao" | "ulcera_decubito" | "desnutricao";
          data_ocorrencia: string;
          tipo_registro: "incidencia" | "prevalencia";
          descricao: string | null;
          registrado_por: string | null;
          perfil_registrador: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          tipo: "obito" | "diarreia_aguda" | "escabiose" | "desidratacao" | "ulcera_decubito" | "desnutricao";
          data_ocorrencia: string;
          tipo_registro: "incidencia" | "prevalencia";
          descricao?: string | null;
          registrado_por?: string | null;
          perfil_registrador?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agravo_epidemiologico"]["Insert"]>;
        Relationships: [];
      };
      carteira_vacinal: {
        Row: {
          id: string;
          residente_id: string;
          arquivo_url: string;
          data_upload: string;
          atualizada_em: string | null;
          observacao: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          arquivo_url: string;
          data_upload?: string;
          atualizada_em?: string | null;
          observacao?: string | null;
          registrado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["carteira_vacinal"]["Insert"]>;
        Relationships: [];
      };
      obra_config: {
        Row: { chave: string; valor: string; descricao: string | null; atualizado_em: string };
        Insert: { chave: string; valor: string; descricao?: string | null };
        Update: Partial<{ valor: string; descricao: string | null }>;
        Relationships: [];
      };
      obra_fases: {
        Row: {
          id: string;
          numero: number;
          nome: string;
          modulos: string;
          area_m2: number;
          reajustavel: boolean;
          ipca_pct: number | null;
          status: ObraFaseStatus;
          data_inicio: string | null;
          data_fim_prevista: string | null;
          data_trp: string | null;
          data_trd: string | null;
          criado_em: string;
        };
        Insert: never;
        Update: Partial<{
          ipca_pct: number | null;
          status: ObraFaseStatus;
          data_inicio: string | null;
          data_fim_prevista: string | null;
          data_trp: string | null;
          data_trd: string | null;
        }>;
        Relationships: [];
      };
      obra_documentos_mensais: {
        Row: {
          id: string;
          mes: string;
          tipo: ObraDocMensalTipo;
          arquivo_url: string;
          observacao: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          mes: string;
          tipo: ObraDocMensalTipo;
          arquivo_url: string;
          observacao?: string | null;
          registrado_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["obra_documentos_mensais"]["Insert"]>;
        Relationships: [];
      };
      obra_medicoes: {
        Row: {
          id: string;
          fase_id: string;
          mes: string;
          percentual_medido: number;
          preco_m2_aplicado: number;
          valor_bruto: number;
          retencao_pct: number;
          retencao_valor: number;
          inss_pct: number;
          inss_valor: number;
          iss_pct: number;
          iss_valor: number;
          outras_valor: number;
          valor_liquido: number;
          status: ObraMedicaoStatus;
          motivo: string | null;
          nf_numero: string | null;
          nf_url: string | null;
          data_aprovacao: string | null;
          data_pagamento: string | null;
          aprovado_por: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          fase_id: string;
          mes: string;
          percentual_medido: number;
          preco_m2_aplicado: number;
          valor_bruto: number;
          retencao_pct: number;
          retencao_valor: number;
          inss_pct?: number;
          inss_valor?: number;
          iss_pct?: number;
          iss_valor?: number;
          outras_valor?: number;
          valor_liquido: number;
          status?: ObraMedicaoStatus;
          motivo?: string | null;
          nf_numero?: string | null;
          nf_url?: string | null;
          registrado_por?: string | null;
        };
        Update: Partial<{
          status: ObraMedicaoStatus;
          motivo: string | null;
          nf_numero: string | null;
          nf_url: string | null;
          data_aprovacao: string | null;
          aprovado_por: string | null;
        }>;
        Relationships: [];
      };
      obra_medicao_etapas: {
        Row: { id: string; medicao_id: string; etapa_id: string };
        Insert: { id?: string; medicao_id: string; etapa_id: string };
        Update: never;
        Relationships: [];
      };
      obra_retencoes_ledger: {
        Row: {
          id: string;
          fase_id: string;
          medicao_id: string | null;
          tipo: "retido" | "liberado_trp" | "liberado_trd";
          valor: number;
          observacao: string | null;
          registrado_por: string | null;
          evento_em: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      obra_recebimento_pendencias: {
        Row: {
          id: string;
          fase_id: string;
          descricao: string;
          sanada: boolean;
          sanada_em: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          fase_id: string;
          descricao: string;
          sanada?: boolean;
          registrado_por?: string | null;
        };
        Update: Partial<{ descricao: string; sanada: boolean; sanada_em: string | null }>;
        Relationships: [];
      };
      obra_etapas: {
        Row: {
          id: string;
          fase_id: string;
          ordem: number;
          nome: string;
          descricao: string | null;
          peso_pct: number;
          depende_de: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          fase_id: string;
          ordem: number;
          nome: string;
          descricao?: string | null;
          peso_pct: number;
          depende_de?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["obra_etapas"]["Insert"]>;
        Relationships: [];
      };
      obra_checklist_execucao: {
        Row: {
          id: string;
          etapa_id: string;
          concluido: boolean;
          foto_url: string;
          observacao: string | null;
          registrado_por: string;
          perfil_registrador: string;
          registrado_em: string;
        };
        Insert: {
          id?: string;
          etapa_id: string;
          concluido: boolean;
          foto_url: string;
          observacao?: string | null;
          registrado_por: string;
          perfil_registrador: string;
        };
        Update: never;
        Relationships: [];
      };
      obra_disciplinas: {
        Row: {
          id: string;
          ordem: number;
          nome: string;
          valor: number;
          prazo_dias: number | null;
          revisoes_max: number;
          revisoes_usadas: number;
          status: string;
          motivo: string | null;
          observacao: string | null;
          criado_em: string;
        };
        Insert: never;
        Update: Partial<{
          status: string;
          motivo: string | null;
          revisoes_usadas: number;
          observacao: string | null;
        }>;
        Relationships: [];
      };
      obra_aliquotas: {
        Row: { chave: string; rotulo: string; percentual: number; ativa: boolean; observacao: string | null };
        Insert: never;
        Update: Partial<{ percentual: number; ativa: boolean; observacao: string | null }>;
        Relationships: [];
      };
      obra_tolerancias_perdas: {
        Row: { categoria: string; percentual: number };
        Insert: never;
        Update: Partial<{ percentual: number }>;
        Relationships: [];
      };
      obra_audit_log: {
        Row: {
          id: string;
          tabela: string;
          registro_id: string | null;
          acao: string;
          antes: unknown;
          depois: unknown;
          usuario: string | null;
          perfil: string | null;
          em: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      documento_institucional: {
        Row: {
          id: string;
          tipo: string | null;
          nome: string;
          identificador: string | null;
          orgao_emissor: string | null;
          data_emissao: string | null;
          data_validade: string | null;
          arquivo_url: string;
          observacao: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          tipo?: string | null;
          nome: string;
          identificador?: string | null;
          orgao_emissor?: string | null;
          data_emissao?: string | null;
          data_validade?: string | null;
          arquivo_url: string;
          observacao?: string | null;
          registrado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documento_institucional"]["Insert"]>;
        Relationships: [];
      };
      // Livro de controlados (Port. 344/98): APPEND-ONLY — sem Insert/Update
      // direto (todo lançamento via RPC registrar_assento_controlado).
      livro_controlados: {
        Row: {
          id: string;
          numero: number;
          residente_id: string | null;
          medicamento: string;
          tipo_assento: TipoAssentoControlado;
          quantidade: number;
          unidade: string;
          justificativa: string | null;
          referencia_numero: number | null;
          registrado_por: string;
          perfil_registrador: string;
          registrado_em: string;
          hash_anterior: string | null;
          hash: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      vacina_registro: {
        Row: {
          id: string;
          residente_id: string;
          vacina: string;
          data_aplicacao: string | null;
          dose: string | null;
          observacao: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          vacina: string;
          data_aplicacao?: string | null;
          dose?: string | null;
          observacao?: string | null;
          registrado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vacina_registro"]["Insert"]>;
        Relationships: [];
      };
      patologia_residente: {
        Row: {
          id: string;
          residente_id: string;
          descricao: string;
          cid_codigo: string | null;
          ativa: boolean;
          data_registro: string;
          registrado_por: string | null;
          observacao: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          descricao: string;
          cid_codigo?: string | null;
          ativa?: boolean;
          data_registro?: string;
          registrado_por?: string | null;
          observacao?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["patologia_residente"]["Insert"]>;
        Relationships: [];
      };
      plano_atencao_saude: {
        Row: {
          id: string;
          versao: string;
          elaborado_em: string;
          proxima_revisao: string | null;
          avaliacao_anual_em: string | null;
          documento_url: string | null;
          observacao: string | null;
          registrado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          versao: string;
          elaborado_em?: string;
          proxima_revisao?: string | null;
          avaliacao_anual_em?: string | null;
          documento_url?: string | null;
          observacao?: string | null;
          registrado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plano_atencao_saude"]["Insert"]>;
        Relationships: [];
      };
      relatorio_sanitario_extraido: {
        Row: {
          id: string;
          periodo_tipo: string;
          periodo_inicio: string;
          periodo_fim: string;
          valores_originais: Record<string, unknown>;
          valores_extraidos: Record<string, unknown>;
          houve_edicao: boolean;
          extraido_por: string | null;
          extraido_em: string;
          hash: string | null;
        };
        Insert: {
          id?: string;
          periodo_tipo: string;
          periodo_inicio: string;
          periodo_fim: string;
          valores_originais: Record<string, unknown>;
          valores_extraidos: Record<string, unknown>;
          houve_edicao?: boolean;
          extraido_por?: string | null;
          extraido_em?: string;
          hash?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["relatorio_sanitario_extraido"]["Insert"]>;
        Relationships: [];
      };
      evolucao_admissao: {
        Row: {
          id: string;
          residente_id: string;
          dados: Record<string, unknown>;
          medico_id: string | null;
          medico_nome: string | null;
          medico_crm: string | null;
          data_admissao_avaliacao: string | null;
          assinada: boolean;
          prescricoes_geradas: boolean;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          dados: Record<string, unknown>;
          medico_id?: string | null;
          medico_nome?: string | null;
          medico_crm?: string | null;
          data_admissao_avaliacao?: string | null;
          assinada?: boolean;
          prescricoes_geradas?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["evolucao_admissao"]["Insert"]>;
        Relationships: [];
      };
      teste_cognitivo: {
        Row: {
          id: string;
          residente_id: string;
          tipo: "MEEM" | "MoCA";
          respostas: Record<string, number>;
          pontuacao_total: number;
          escolaridade_anos: number | null;
          interpretacao: string | null;
          foto_url: string | null;
          aplicado_por: string | null;
          aplicado_em: string;
        };
        Insert: {
          id?: string;
          residente_id: string;
          tipo: "MEEM" | "MoCA";
          respostas: Record<string, number>;
          pontuacao_total: number;
          escolaridade_anos?: number | null;
          interpretacao?: string | null;
          foto_url?: string | null;
          aplicado_por?: string | null;
          aplicado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teste_cognitivo"]["Insert"]>;
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
      // Atualiza somente o nome de exibição do PRÓPRIO usuário (não altera perfil).
      set_meu_nome: {
        Args: { p_nome: string };
        Returns: undefined;
      };
      // Slots de visita com vaga real (desconta ocupações). Pública (site usa via anon).
      visitas_slots_livres: {
        Args: { p_de: string; p_ate: string };
        Returns: { data: string; hora: string; vagas: number }[];
      };
      // Dispensação atômica + idempotente (registro + baixa de estoque numa transação).
      dispensar_medicamentos: {
        Args: {
          p_residente_id: string;
          p_periodo: string;
          p_data: string;
          p_itens: ItemDispensacaoJson[];
          p_dispensado_por: string;
        };
        Returns: string;
      };
      // Estorno atômico de uma dispensação (devolve o saldo + remove o registro).
      estornar_dispensacao: {
        Args: { p_id: string };
        Returns: undefined;
      };
      // Livro de controlados (Port. 344/98): lançamento append-only com hash
      // encadeado server-side. Retorna o nº do assento.
      registrar_assento_controlado: {
        Args: {
          p_residente_id: string | null;
          p_medicamento: string;
          p_tipo: TipoAssentoControlado;
          p_quantidade: number;
          p_unidade: string;
          p_justificativa: string | null;
          p_referencia: number | null;
          p_registrado_por: string;
        };
        Returns: number;
      };
      // Reprocessa a cadeia de hash do livro e acusa adulteração.
      verificar_livro_controlados: {
        Args: Record<string, never>;
        Returns: { integro: boolean; primeiro_numero_violado: number | null; total_assentos: number }[];
      };
      // Obra: pagar medição (gate dos 4 documentos + NF; posta retenção no ledger).
      obra_pagar_medicao: {
        Args: { p_medicao_id: string };
        Returns: undefined;
      };
      // Obra: emitir TRP (libera 50% da retenção da fase). Retorna o valor liberado.
      obra_emitir_trp: {
        Args: { p_fase_id: string };
        Returns: number;
      };
      // Obra: emitir TRD (90 dias + pendências sanadas; libera o saldo restante).
      obra_emitir_trd: {
        Args: { p_fase_id: string };
        Returns: number;
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
export type VisitaDisponibilidade = Database["public"]["Tables"]["visita_disponibilidade"]["Row"];
export type VisitaAgendamento = Database["public"]["Tables"]["visita_agendamento"]["Row"];
export type VisitaOrigem = VisitaAgendamento["origem"];
export type VisitaStatus = VisitaAgendamento["status"];
export type DesignacaoCuidado = Database["public"]["Tables"]["designacao_cuidado"]["Row"];
export type RecadoFamilia = Database["public"]["Tables"]["recado_familia"]["Row"];
export type EventoSentinela = Database["public"]["Tables"]["evento_sentinela"]["Row"];
export type TipoEventoSentinela = EventoSentinela["tipo"];
export type AgravoEpidemiologico = Database["public"]["Tables"]["agravo_epidemiologico"]["Row"];
export type TipoAgravo = AgravoEpidemiologico["tipo"];
export type CarteiraVacinal = Database["public"]["Tables"]["carteira_vacinal"]["Row"];
export type DocumentoInstitucional = Database["public"]["Tables"]["documento_institucional"]["Row"];
export type AssentoControlado = Database["public"]["Tables"]["livro_controlados"]["Row"];
export type ObraFase = Database["public"]["Tables"]["obra_fases"]["Row"];
export type ObraEtapa = Database["public"]["Tables"]["obra_etapas"]["Row"];
export type ObraChecklistExecucao = Database["public"]["Tables"]["obra_checklist_execucao"]["Row"];
export type ObraDisciplina = Database["public"]["Tables"]["obra_disciplinas"]["Row"];
export type ObraMedicao = Database["public"]["Tables"]["obra_medicoes"]["Row"];
export type ObraAliquota = Database["public"]["Tables"]["obra_aliquotas"]["Row"];
export type ObraDocumentoMensal = Database["public"]["Tables"]["obra_documentos_mensais"]["Row"];
export type ObraRetencaoLedger = Database["public"]["Tables"]["obra_retencoes_ledger"]["Row"];
export type ObraPendencia = Database["public"]["Tables"]["obra_recebimento_pendencias"]["Row"];
export type VacinaRegistro = Database["public"]["Tables"]["vacina_registro"]["Row"];
export type PatologiaResidente = Database["public"]["Tables"]["patologia_residente"]["Row"];
export type PlanoAtencaoSaude = Database["public"]["Tables"]["plano_atencao_saude"]["Row"];
export type RelatorioSanitarioExtraido = Database["public"]["Tables"]["relatorio_sanitario_extraido"]["Row"];
export type EvolucaoAdmissao = Database["public"]["Tables"]["evolucao_admissao"]["Row"];
export type TesteCognitivo = Database["public"]["Tables"]["teste_cognitivo"]["Row"];
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
export type Fornecedor = Database["public"]["Tables"]["fornecedor"]["Row"];
export type Insumo = Database["public"]["Tables"]["insumo"]["Row"];
export type InsumoPrecoHistorico = Database["public"]["Tables"]["insumo_preco_historico"]["Row"];
export type Prato = Database["public"]["Tables"]["prato"]["Row"];
export type PratoInsumo = Database["public"]["Tables"]["prato_insumo"]["Row"];
export type Cardapio = Database["public"]["Tables"]["cardapio"]["Row"];
export type CardapioItem = Database["public"]["Tables"]["cardapio_item"]["Row"];
export type Desperdicio = Database["public"]["Tables"]["desperdicio"]["Row"];
export type RegistroPeso = Database["public"]["Tables"]["registro_peso"]["Row"];
export type BaixaViagem = Database["public"]["Tables"]["baixa_viagem"]["Row"];
export type CozinhaFuncionario = Database["public"]["Tables"]["cozinha_funcionario"]["Row"];
export type CozinhaEscala = Database["public"]["Tables"]["cozinha_escala"]["Row"];
export type ConfigRefeicaoEquipe = Database["public"]["Tables"]["config_refeicao_equipe"]["Row"];
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
export type Enxoval = Database["public"]["Tables"]["enxoval"]["Row"];
export type EnxovalMovimento = Database["public"]["Tables"]["enxoval_movimento"]["Row"];
export type Atividade = Database["public"]["Tables"]["atividade"]["Row"];
export type AtividadeExecucao = Database["public"]["Tables"]["atividade_execucao"]["Row"];
export type AtividadeParticipacao = Database["public"]["Tables"]["atividade_participacao"]["Row"];
export type Dieta = Database["public"]["Tables"]["dieta"]["Row"];
export type EvolucaoNutricional = Database["public"]["Tables"]["evolucao_nutricional"]["Row"];
export type TabelaPreco = Database["public"]["Tables"]["tabela_preco"]["Row"];
export type PagamentoMensalidade = Database["public"]["Tables"]["pagamento_mensalidade"]["Row"];
export type Upselling = Database["public"]["Tables"]["upselling"]["Row"];
export type CustoMaterial = Database["public"]["Tables"]["custo_material"]["Row"];
export type TabelaDiaria = Database["public"]["Tables"]["tabela_diaria"]["Row"];
export type CobrancaTemporaria = Database["public"]["Tables"]["cobranca_temporaria"]["Row"];
export type RhAusencia = Database["public"]["Tables"]["rh_ausencia"]["Row"];
export type RhAfastamento = Database["public"]["Tables"]["rh_afastamento"]["Row"];
export type RhDesligamento = Database["public"]["Tables"]["rh_desligamento"]["Row"];
export type PagamentoPessoal = Database["public"]["Tables"]["pagamento_pessoal"]["Row"];
export type SolicitacaoFamilia = Database["public"]["Tables"]["solicitacao_familia"]["Row"];
