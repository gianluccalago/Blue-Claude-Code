import { useRef, useState, useEffect, type ChangeEvent } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Map as MapIcon,
  Archive,
  Boxes,
  Filter,
  Sun,
  LogOut,
  Loader2,
  X,
  LayoutDashboard,
  Pill,
  Syringe,
  AlertTriangle,
  MessageSquare,
  CalendarDays,
  ClipboardList,
  ListChecks,
  PackageOpen,
  UserCog,
  Wrench,
  Stethoscope,
  FileText,
  HeartPulse,
  Users2,
  Apple,
  Salad,
  UtensilsCrossed,
  TrendingDown,
  Scale,
  ChefHat,
  Soup,
  Activity,
  Wallet,
  Receipt,
  Tags,
  FileSpreadsheet,
  Coins,
  Banknote,
  PackageMinus,
  PackageSearch,
  PackageCheck,
  ClipboardCheck,
  Sparkles,
  Shirt,
  CalendarClock,
  CalendarRange,
  UserRound,
  Image,
  Camera,
  Home,
  Shield,
  TrendingUp,
  Contact,
  Radio,
  Settings,
  BarChart3,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn, ouNaoInformado } from "@/lib/utils";
import { useAuth } from "@/auth/AuthProvider";
import { useNotificacoes, type Badge as BadgeNotif } from "@/hooks/useNotificacoes";
import { useFotoResidente, useDefinirMinhaFoto } from "@/hooks/useUsuarioFoto";
import { uploadFotoUsuario } from "@/lib/storage";
import type { PerfilDef } from "@/data/profiles";

// Ícone por rota — puramente visual (não altera navegação nem dados).
const ICONE_POR_ROTA: Record<string, LucideIcon> = {
  // Master
  "/app/master": LayoutDashboard,
  "/app/master/hospede": UserRound,
  "/app/master/operacional": Activity,
  "/app/master/clinica": HeartPulse,
  "/app/master/usuarios": Shield,
  "/app/master/residentes": Users2,
  "/app/master/equipe": UserCog,
  "/app/master/profissionais": UserCog,
  "/app/master/chamado-manutencao": Wrench,
  // Médico
  "/app/medico/prescricoes": Pill,
  "/app/medico/escalados": Stethoscope,
  "/app/medico/evolucao": FileText,
  "/app/medico/resgate": PackageOpen,
  "/app/medico/solicitacoes-familia": MessageSquare,
  // Coordenação
  "/app/coordenacao": LayoutDashboard,
  "/app/coordenacao/planos": ClipboardList,
  "/app/coordenacao/modelos": ListChecks,
  "/app/coordenacao/medicacao-enfermagem": Syringe,
  "/app/coordenacao/intercorrencias": AlertTriangle,
  "/app/coordenacao/resgate": PackageOpen,
  "/app/coordenacao/profissionais": UserCog,
  "/app/coordenacao/escalas": CalendarDays,
  "/app/coordenacao/solicitacoes-familia": MessageSquare,
  "/app/coordenacao/chamado-manutencao": Wrench,
  // Enfermeira (Coordenação reduzida) — reusa as telas da Coordenação
  "/app/enfermeira": LayoutDashboard,
  "/app/enfermeira/ficha": Users2,
  "/app/enfermeira/medicacao-enfermagem": Syringe,
  "/app/enfermeira/intercorrencias": AlertTriangle,
  "/app/enfermeira/planos": ClipboardList,
  "/app/enfermeira/resgate": PackageOpen,
  "/app/enfermeira/chamado-manutencao": Wrench,
  // Cuidador
  "/app/cuidador/checklist": ClipboardCheck,
  "/app/cuidador/medicacao": Pill,
  "/app/cuidador/compromissos": CalendarClock,
  "/app/cuidador/intercorrencia": AlertTriangle,
  "/app/cuidador/hospedes": Users2,
  "/app/cuidador/minha-escala": CalendarRange,
  "/app/cuidador/chamado-manutencao": Wrench,
  // Enfermagem (mesmo fluxo da cuidadora + medicação exclusiva de enfermagem)
  "/app/enfermagem": LayoutDashboard,
  "/app/enfermagem/checklist": ClipboardCheck,
  "/app/enfermagem/medicacao": Pill,
  "/app/enfermagem/medicacao-enfermagem": Syringe,
  "/app/enfermagem/compromissos": CalendarClock,
  "/app/enfermagem/intercorrencia": AlertTriangle,
  "/app/enfermagem/hospedes": Users2,
  "/app/enfermagem/minha-escala": CalendarRange,
  "/app/enfermagem/chamado-manutencao": Wrench,
  // Multidisciplinar
  "/app/multidisciplinar/atividades": Activity,
  "/app/multidisciplinar/atendimentos": Stethoscope,
  "/app/administracao/atendimentos-precificar": Stethoscope,
  // Nutricionista
  "/app/nutricionista/dietas": Salad,
  "/app/nutricionista/insumos": Apple,
  "/app/nutricionista/pratos": UtensilsCrossed,
  "/app/nutricionista/cardapios": CalendarDays,
  "/app/nutricionista/desperdicio": TrendingDown,
  "/app/nutricionista/peso": Scale,
  "/app/nutricionista/escala-cozinha": ChefHat,
  "/app/nutricionista/refeicoes-equipe": Soup,
  "/app/administracao/refeicoes-equipe": Soup,
  "/app/master/refeicoes-equipe": Soup,
  "/app/nutricionista/acompanhamento-nutricional": Apple,
  "/app/nutricionista/evolucao-nutricional": FileText,
  // Farmácia
  "/app/farmacia/painel": LayoutDashboard,
  "/app/farmacia/pedidos-mensais": FileText,
  "/app/farmacia/custos-medicamento": Pill,
  "/app/farmacia/estoque": PackageSearch,
  "/app/farmacia/resgate": PackageMinus,
  "/app/farmacia/dispensacao": PackageCheck,
  // Hotelaria
  "/app/hotelaria/visao-dia": LayoutDashboard,
  "/app/hotelaria/inspecao-suites": ClipboardCheck,
  "/app/hotelaria/manutencao": Wrench,
  // Serviços Gerais (manutenção) e Lavanderia (enxoval) — perfis derivados
  "/app/servicos_gerais/manutencao": Wrench,
  "/app/lavanderia/enxoval": Shirt,
  // Administração
  "/app/administracao": LayoutDashboard,
  "/app/administracao/servicos": Wrench,
  "/app/administracao/enxoval": Shirt,
  "/app/administracao/mapa-suites": MapIcon,
  "/app/administracao/hospedes-inativos": Archive,
  "/app/administracao/analise-saidas": TrendingDown,
  "/app/direcao/mapa-suites": MapIcon,
  "/app/direcao/hospedes-inativos": Archive,
  "/app/direcao/analise-saidas": TrendingDown,
  "/app/master/servicos": Wrench,
  "/app/master/enxoval": Shirt,
  "/app/master/mapa-suites": MapIcon,
  "/app/master/hospedes-inativos": Archive,
  "/app/master/analise-saidas": TrendingDown,
  // Pesquisa NPS (aplicação) e Resultados NPS (análise)
  "/app/coordenacao/pesquisa-nps": ClipboardList,
  "/app/multidisciplinar/pesquisa-nps": ClipboardList,
  "/app/nutricionista/pesquisa-nps": ClipboardList,
  "/app/master/resultados-nps": BarChart3,
  "/app/administracao/resultados-nps": BarChart3,
  "/app/administracao/tabela-precos": Tags,
  "/app/master/tabela-precos": Tags,
  "/app/administracao/mensalidades": Wallet,
  "/app/administracao/cobranca": CreditCard,
  "/app/administracao/upselling": Receipt,
  "/app/administracao/demonstrativo": FileSpreadsheet,
  "/app/administracao/remuneracao-equipe": Coins,
  "/app/administracao/custos-pessoal": Banknote,
  "/app/administracao/custos-materiais": Boxes,
  "/app/direcao/custos-materiais": Boxes,
  "/app/administracao/cobranca-temporaria": Receipt,
  "/app/direcao/cobranca-temporaria": Receipt,
  "/app/master/cobranca-temporaria": Receipt,
  "/app/administracao/rh-eventos": Users2,
  "/app/direcao/rh-eventos": Users2,
  "/app/master/rh-eventos": Users2,
  "/app/administracao/profissionais": UserCog,
  "/app/administracao/solicitacoes-familia": MessageSquare,
  // Direção (mesma operação da Administração + CRM)
  "/app/direcao": LayoutDashboard,
  "/app/direcao/tabela-precos": Tags,
  "/app/direcao/mensalidades": Wallet,
  "/app/direcao/upselling": Receipt,
  "/app/direcao/demonstrativo": FileSpreadsheet,
  "/app/direcao/remuneracao-equipe": Coins,
  "/app/direcao/custos-pessoal": Banknote,
  "/app/direcao/profissionais": UserCog,
  "/app/direcao/solicitacoes-familia": MessageSquare,
  // CRM comercial (Direção e Master)
  "/app/direcao/crm": TrendingUp,
  "/app/master/crm": TrendingUp,
  "/app/administracao/funil-vendas": Filter,
  "/app/direcao/funil-vendas": Filter,
  "/app/master/funil-vendas": Filter,
  "/app/cuidador/day-care": Sun,
  "/app/multidisciplinar/day-care": Sun,
  "/app/nutricionista/day-care": Sun,
  "/app/administracao/day-care": Sun,
  "/app/direcao/day-care": Sun,
  "/app/master/day-care": Sun,
  "/app/direcao/crm-tarefas": ListChecks,
  "/app/master/crm-tarefas": ListChecks,
  "/app/direcao/crm-contatos": Contact,
  "/app/master/crm-contatos": Contact,
  "/app/direcao/crm-origens": Radio,
  "/app/master/crm-origens": Radio,
  "/app/direcao/crm-config": Settings,
  "/app/master/crm-config": Settings,
  "/app/direcao/crm-relatorios": BarChart3,
  "/app/master/crm-relatorios": BarChart3,
  // Ficha do hóspede (item "Hóspedes" de cada perfil)
  "/app/medico/ficha": Users2,
  "/app/coordenacao/ficha": Users2,
  "/app/multidisciplinar/ficha": Users2,
  "/app/nutricionista/ficha": Users2,
  "/app/farmacia/ficha": Users2,
  "/app/hotelaria/ficha": Users2,
  "/app/administracao/ficha": Users2,
  "/app/direcao/ficha": Users2,
  // Família
  "/app/familia": Home,
  "/app/familia/fotos": Image,
  "/app/familia/compromissos-familia": CalendarClock,
  "/app/familia/mensalidade-familia": Wallet,
  "/app/familia/solicitacoes": MessageSquare,
  "/app/familia/camera-quarto": Camera,
  "/app/familia/sinais-vitais": HeartPulse,
};

function iconeDaRota(to: string): LucideIcon {
  return ICONE_POR_ROTA[to] ?? Sparkles;
}

// Cores semânticas do badge: vermelho (crítico/atrasado/emergência), âmbar
// (atenção) e neutro/azul (pendência comum). Tokens do tema, sem cor crua.
const TOM_BADGE: Record<BadgeNotif["tom"], string> = {
  destructive: "bg-destructive text-white",
  warning: "bg-warning text-white",
  primary: "bg-brand-gradient text-white shadow-glow-primary",
};

/**
 * Badge de notificação de um item de menu. NÚMERO (count) ou PONTO (dot).
 * Acessível: o badge não é o único indicador (o texto do item segue legível) e
 * tem aria-label descritivo ("3 pendências").
 */
function BadgeSidebar({ badge }: { badge: BadgeNotif }) {
  const rotulo = `${badge.count} ${badge.count === 1 ? "pendência" : "pendências"}`;
  if (badge.dot) {
    return (
      <span
        role="status"
        aria-label={rotulo}
        className={cn("size-2.5 shrink-0 rounded-full", TOM_BADGE[badge.tom])}
      />
    );
  }
  return (
    <span
      role="status"
      aria-label={rotulo}
      className={cn(
        "grid min-w-[20px] shrink-0 place-items-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
        TOM_BADGE[badge.tom],
      )}
    >
      {badge.count > 99 ? "99+" : badge.count}
    </span>
  );
}

/** Iniciais do usuário para o avatar (até 2 letras). */
function iniciais(nome: string | undefined | null): string {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

/**
 * Avatar do usuário no rodapé da sidebar. Mostra a foto do usuário; para a
 * Família, espelha a foto do hóspede vinculado. O próprio usuário (real, não
 * personificado e não-família) pode trocar a foto pelo botão de câmera.
 */
function AvatarUsuario() {
  const { usuario, impersonado, usuarioEfetivo } = useAuth();
  const ehFamilia = usuarioEfetivo?.perfil === "familia";
  const fotoHospede = useFotoResidente(ehFamilia ? usuarioEfetivo?.residente_vinculado : null);
  const definir = useDefinirMinhaFoto();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [override, setOverride] = useState<string | null>(null);

  const podeEditar = !impersonado && !ehFamilia && !!usuario;
  const fotoBase = ehFamilia ? fotoHospede.data ?? null : usuarioEfetivo?.foto_url ?? null;
  const foto = override ?? fotoBase;

  async function onArquivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !usuario) return;
    setEnviando(true);
    try {
      const url = await uploadFotoUsuario(file, usuario.id);
      if (!url) {
        toast.error("Não foi possível enviar a foto. Tente novamente.");
        return;
      }
      await definir.mutateAsync(url);
      setOverride(url);
      toast.success("Foto atualizada.");
    } catch {
      toast.error("Erro ao salvar a foto.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <div className="grid size-10 place-items-center overflow-hidden rounded-full bg-brand-gradient text-sm font-extrabold text-white shadow-glow-primary">
        {foto ? (
          <img src={foto} alt="" className="size-full object-cover" />
        ) : (
          iniciais(usuarioEfetivo?.nome)
        )}
      </div>
      {podeEditar && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border border-sidebar bg-white text-secondary shadow-sm transition-colors hover:bg-white/90 disabled:opacity-60"
            aria-label="Trocar minha foto"
            title="Trocar minha foto"
          >
            {enviando ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onArquivo} />
        </>
      )}
    </div>
  );
}

export function Sidebar({
  perfil,
  menuAberto = false,
  onFechar,
}: {
  perfil: PerfilDef;
  menuAberto?: boolean;
  onFechar?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { usuarioEfetivo, sair } = useAuth();
  const Icon = perfil.icon;

  // Notificações (badges) do perfil. Recalcula ao TROCAR DE TELA (sem realtime):
  // a cada mudança de rota, invalida a chave para refazer as contagens.
  const badges = useNotificacoes(perfil.id);
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
  }, [pathname, queryClient]);

  async function logout() {
    await sair();
    navigate({ to: "/" });
  }

  return (
    <>
      {/* Overlay (mobile) */}
      {menuAberto && (
        <div
          className="fixed inset-0 z-30 animate-fade-in bg-secondary/50 backdrop-blur-[2px] lg:hidden"
          onClick={onFechar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "flex h-full w-72 shrink-0 flex-col bg-navy-gradient text-sidebar-foreground",
          // Safe-area iOS: afasta logo/menu/rodapé da status bar, do notch e do
          // indicador inferior em modo standalone (env()=0 no navegador).
          "safe-top safe-bottom safe-left",
          // Desktop: estática. Mobile: drawer deslizante.
          "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-out lg:static lg:translate-x-0",
          menuAberto ? "translate-x-0 shadow-lifted" : "-translate-x-full",
        )}
      >
        {/* Brilho decorativo no topo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(24rem_12rem_at_30%_-20%,hsl(197_72%_63%/0.35),transparent_70%)]"
        />

        <div className="relative flex items-center justify-between px-5 py-6">
          <Logo className="text-white" />
          {/* Fechar (mobile) */}
          {onFechar && (
            <button
              onClick={onFechar}
              className="grid size-8 place-items-center rounded-md text-sidebar-muted transition-colors duration-200 hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        {/* Etiqueta de área do perfil */}
        <div className="relative mx-4 mb-3 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3.5 py-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold leading-tight">{perfil.nome}</div>
            <div className="truncate text-[11px] text-sidebar-muted">Área de trabalho</div>
          </div>
        </div>

        <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {perfil.menu.map((item) => {
            const ativo = pathname === item.to;
            const badge = badges[item.to];
            const ItemIcon = iconeDaRota(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onFechar}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                  ativo
                    ? "bg-white/12 text-white shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.08)]"
                    : "text-sidebar-muted hover:bg-white/8 hover:text-white",
                )}
              >
                {/* Pílula/glow do item ativo */}
                {ativo && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-sidebar-accent shadow-glow-primary"
                  />
                )}
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-200",
                    ativo
                      ? "bg-brand-gradient text-white"
                      : "bg-white/5 text-sidebar-muted group-hover:bg-white/10 group-hover:text-white",
                  )}
                >
                  <ItemIcon className="size-4" />
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {badge && <BadgeSidebar badge={badge} />}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé: usuário em destaque */}
        <div className="relative border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
            <AvatarUsuario />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{ouNaoInformado(usuarioEfetivo?.nome)}</div>
              <div className="truncate text-[11px] text-sidebar-muted">Sessão ativa</div>
            </div>
            <button
              onClick={logout}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/15 text-sidebar-muted transition-colors duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] tracking-wide text-sidebar-muted/70">
            Blue Senior Living · v0.1
          </p>
        </div>
      </aside>
    </>
  );
}
