# OKR Dashboard

## Sistema de prazos (deadlines)

Este projeto passou a suportar prazos explícitos para OKRs.

- `objectives.due_date` registra o prazo final do objetivo.
- `key_results.due_date` registra o prazo final de cada KR.
- A aplicação trata prazo como obrigatório nos fluxos principais de criação/edição.
- O modelo de `year`/`quarter` continua ativo para organização anual/trimestral.

## Regras de validação

- KR não pode ter prazo posterior ao prazo do Objective pai.
- KRs trimestrais recebem sugestão automática de prazo pelo quarter (Q1/Q2/Q3/Q4), mas o usuário ainda pode ajustar manualmente.
- Atualizações de prazo entram nos fluxos de auditoria já existentes.

## Alertas visuais de prazo

O frontend usa status por proximidade de data:

- `on-track`: prazo confortável.
- `warning`: prazo se aproximando.
- `urgent`: prazo muito próximo.
- `overdue`: prazo vencido.

Esses sinais aparecem em tabelas, cards de pilar, mapa de confiança, foco de KR e dashboard executivo.

## Plano de rollback das mudanças de prazo

> Use este procedimento apenas em janela de manutenção e com backup validado.

### 1) Backup antes de rollback

```sql
create table if not exists backup_objectives_deadline as
select id, due_date from objectives;

create table if not exists backup_key_results_deadline as
select id, objective_id, due_date from key_results;
```

### 2) Remover validações/objetos dependentes

```sql
drop trigger if exists validate_kr_due_date on key_results;
drop trigger if exists validate_objective_due_date on objectives;

drop function if exists validate_kr_due_date();
drop function if exists validate_objective_due_date();
```

### 3) Remover índices/constraints e colunas

```sql
alter table key_results drop constraint if exists key_results_due_date_check;
alter table objectives drop constraint if exists objectives_due_date_check;

drop index if exists idx_key_results_due_date;
drop index if exists idx_objectives_due_date;

alter table key_results drop column if exists due_date;
alter table objectives drop column if exists due_date;
```

### 4) Validação pós-rollback

- Confirmar que páginas de OKR carregam sem referência a `due_date`.
- Validar criação/edição de KR e Objective.
- Revisar logs de aplicação e banco.

## Checklist manual de validação (deadlines)

- Criar Objective com prazo.
- Criar KR anual com prazo.
- Criar KR trimestral e validar sugestão automática por quarter.
- Tentar salvar KR com prazo maior que o Objective (deve falhar).
- Editar prazo de Objective com KRs filhos e validar restrições.
- Conferir badges/indicadores em:
  - lista de pilares de OKR;
  - página do pilar;
  - mapa de confiança;
  - foco do KR;
  - dashboard (cards de atrasados/urgentes).
- Testar idiomas PT e ES para textos de prazo.

## Verificação técnica local

```bash
npm run build
```

> Observação: o lint global do repositório já possui violações pré-existentes fora do escopo desta entrega.
