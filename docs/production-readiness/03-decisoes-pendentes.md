# 03 · Decisões pendentes (negócio, clínica e permissões)

Nenhum destes pontos foi decidido pelo desenvolvimento. Onde a regra estava indefinida, o acesso foi mantido negado ou o comportamento atual foi mantido e documentado.

## Clínicas (validar com a responsável técnica e a enfermagem)

1. **Posologia e horários padrão** (CLI-05). "8/8h" hoje sugere 08h, 12h e 20h; "6/6h" sugere 08h, 12h, 16h e 20h. Definir os horários padrão da casa por posologia (ex.: 06-14-22 e 06-12-18-24) ou exigir horário por linha. Até lá a sugestão automática pode induzir erro.
2. **"Sim, todas" por período** (BD-05/CLI-11). O registro de administração é um evento por período e residente, sem lista dos medicamentos administrados. Se a prescrição mudar no mesmo dia, o registro anterior continua "sim". Decidir se o registro deve guardar a lista de medicamentos (snapshot) e se registrar duas vezes no mesmo período deve ser bloqueado ou tratado como correção (como a tela diz hoje).
3. **Data do plantão noturno** (CLI-02, CLI-03). Tarefas e pendências depois da meia-noite pertencem ao dia anterior (data do plantão) ou ao dia corrente? A resposta define o checklist, o painel da Coordenação e os relatórios.
4. **Tarefas de enfermagem no checklist da cuidadora** (CLI-10). A cuidadora pode marcar curativo, sondagem e similares como feitos? Hoje pode. Se não, o checklist deve filtrar por `responsavel`.
5. **IVCF-20 como grau de dependência da RDC 502.** Os cortes 7/15 medem vulnerabilidade, não dependência em AVD; esse grau alimenta a proporção mínima de cuidadores. Manter com documentação do mapeamento ou adotar uma avaliação de grau própria (Katz).
6. **Receita de controlados.** Medicamentos marcados como controlados saem na receita simples (sem via de controle especial). Definir o modelo a adotar e se o "código de verificação" precisa ser verificável (hoje não fica salvo).
7. **Escalonamento ao médico.** Hoje "escalado" grava um status e entra na fila; não há notificação. Definir se é preciso um canal (SMS, WhatsApp, e-mail) e o prazo de resposta.

## Negócio e financeiro

8. **Pró-rata na entrada e na saída** (FIN-01). Mensalidade cheia no mês de entrada e de saída, ou proporcional aos dias? O roster do mês já inclui quem saiu; o valor continua cheio.
9. **Definição de inadimplência** (FIN-02). Vencido = status "em aberto" após a data de vencimento efetiva (padrão dia 10 quando não há registro)? Cobranças "canceladas" ficam fora do faturamento?
10. **Ocupação** (FIN-03). Taxa por leitos (soma das ocupações) ou por suítes ocupadas?
11. **Construtora editando cronograma** (OBR-02). Manter a edição de prazos e avanço pela TRÍADE (pedido dela) e calcular a multa contra a linha de base congelada? Avanço 100% lançado por ela deve virar "Concluído" sem aceite?
12. **Medição faturada pelo bruto ou pelo líquido** (OBR-03), com as retenções (INSS/ISS e os 5%) tratadas à parte.

## Permissões (mantidas restritivas até definição)

13. **Quem prescreve.** Escrita de prescrição restrita a médico e Master desde a 0133. Coordenação e Enfermagem podiam criar, editar e suspender pela URL. Se a Coordenação precisa suspender em algum fluxo real, reabrir só isso.
14. **Leitura de prontuário por perfis não clínicos.** Hotelaria, lavanderia e serviços gerais continuam lendo tabelas clínicas (eram "equipe" antes). Restringir à equipe clínica é uma linha na 0133 (`app_equipe_clinica()` no SELECT), mas pode esconder algo que alguma tela deles usa hoje. Precisa de teste em homologação.
15. **Modo Camaleão.** Com a autoria no servidor, o Master que "vê como" a cuidadora e registra algo fica registrado com o nome do Master. Alternativa: bloquear escritas no Camaleão (só leitura).
16. **Colunas de autoria como nome (texto)**, não como id de usuário. Homônimos e renomeações confundem a trilha. Migrar para `*_por_id uuid` é mudança de schema em 77 tabelas; decidir se vale antes do piloto.
17. **Exclusão física de hóspede.** Recusada quando há histórico (0134). Definir se algum caso (cadastro errado sem nenhum registro) pode ser apagado, e por quem.
18. **Contas de demonstração em produção.** Decisão de 25/09: manter por enquanto. Enquanto existirem com senha conhecida, o projeto não deve receber dados reais.
