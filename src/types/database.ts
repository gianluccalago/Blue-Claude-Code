/**
 * Tipos do banco Supabase (schema public) — escritos na origem para tipar
 * corretamente o cliente, sem casts `as never`/`as unknown`.
 *
 * Mantenha em sincronia com supabase/migrations/0001_init.sql.
 */

export type PerfilUsuario =
  | "master"
  | "medico"
  | "coordenacao"
  | "cuidador"
  | "enfermagem"
  | "multidisciplinar"
  | "farmacia"
  | "administracao"
  | "familia";

export type FuncaoProfissional = "Cuidadora" | "Técnica de Enfermagem" | "Enfermeira";
export type VinculoProfissional = "CLT" | "PJ";

export type GrauDependencia = "I" | "II" | "III";
export type ViaMedicacao = "oral" | "injetavel" | "insulina" | "sonda";
export type PeriodoMedicacao = "noite" | "manha" | "almoco" | "tarde";
export type StatusAdministracao = "sim" | "parcial" | "nao";
export type TipoEliminacao = "urina" | "evacuacao";
export type TipoOrigemPendencia = "medicacao" | "intercorrencia" | "eliminacao" | "tarefa";
export type AcaoPendencia = "resolvido" | "escalado_medico";
export type AcaoEliminacaoTratamento = "silenciado" | "escalado_medico";

export interface Database {
  public: {
    Tables: {
      residentes: {
        Row: {
          id: string;
          nome: string;
          data_nascimento: string | null;
          grau_dependencia: GrauDependencia | null;
          modulo: number | null;
          andar: number | null;
          quarto: string | null;
          responsavel_legal: string | null;
          contato: string | null;
          alergias: string | null;
          proteses: string | null;
          historia_vida: string | null;
          data_admissao: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          data_nascimento?: string | null;
          grau_dependencia?: GrauDependencia | null;
          modulo?: number | null;
          andar?: number | null;
          quarto?: string | null;
          responsavel_legal?: string | null;
          contato?: string | null;
          alergias?: string | null;
          proteses?: string | null;
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
export type EliminacaoTratamento = Database["public"]["Tables"]["eliminacao_tratamento"]["Row"];
