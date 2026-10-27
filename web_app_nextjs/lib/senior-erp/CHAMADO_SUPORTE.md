# Chamado para o Suporte Senior — liberar integração via API (tenant elo.log.br)

> Copie o texto abaixo ao abrir o chamado no suporte Senior (ou envie ao
> distribuidor/canal que atende a ELO). Ele já traz o diagnóstico técnico pronto.

---

**Assunto:** Liberar consumo das APIs da Plataforma Senior X para integração (tenant elo.log.br)

**Produto:** Senior X Platform / Gestão Empresarial | ERP (referência 5.10.4)

**Tenant:** elo.log.br

**Descrição:**

Estamos desenvolvendo uma integração server-to-server com a Plataforma Senior X
para consumir dados do Gestão Empresarial | ERP (começando pelo cadastro de
clientes). Já validamos a autenticação, mas as chamadas às APIs de negócio estão
sendo bloqueadas. Precisamos de ajuda com os itens abaixo.

**O que já funciona:**
- Autenticação OK via `POST https://api.senior.com.br/platform/authentication/actions/login`
  com usuário `intapi@elo.log.br` — retorna token (HTTP 200).

**O problema:**
- Qualquer chamada às APIs de negócio em `https://platform.senior.com.br/t/elo.log.br/...`
  retorna **HTTP 403** com a mensagem:
  `"Request blocked by the administrator - route blocked"`.
- O bloqueio ocorre inclusive em endpoints básicos (ex.: usuário logado), o que
  indica que o problema é de **autorização de aplicação/rota**, não de um
  endpoint específico.

**Solicitações:**
1. **Criar/registrar uma Aplicação** no portal XPlatform API para o tenant
   `elo.log.br` e nos informar o **`client_id`** correspondente (podemos criar
   nós mesmos se nos derem acesso ao portal — hoje não conseguimos efetuar login
   no portal de desenvolvedor).
2. **Liberar as APIs necessárias** nessa aplicação (seção "APIs disponíveis"),
   em especial as do ERP para **cadastro de clientes**
   (web service `com.senior.g5.co.cad.clientes`, porta `Exportar`).
3. Confirmar se o **usuário de integração `intapi`** tem permissão para consumir
   essas APIs e, se necessário, atribuir o papel/permissão adequado.
4. Confirmar se o **tenant usa autenticação federada (SAML/ADFS)**. Em caso
   positivo, orientar a geração de uma **Chave de Aplicação** (access key +
   secret) para a integração server-to-server.
5. Confirmar se a **proprietária (licença)** do ERP contém pelo menos um dos
   módulos exigidos pela porta `Exportar` do serviço de clientes:
   **IPSI, IMCR ou VMAIS**
   (ref.: documentação de pré-requisitos de proprietária dos web services).

**Objetivo final:** conseguir chamar, de forma autenticada e autorizada, a API/WS
que exporta o cadastro de clientes do ERP, para gerar um relatório de clientes
em um sistema interno.

**Ambiente de origem da integração:** aplicação web (servidor), chamadas HTTPS.

---

## O que JÁ testamos (para agilizar o atendimento)

Já fizemos toda a configuração possível pelo lado do admin do tenant, e o
bloqueio persiste. Detalhes técnicos:

1. **Autenticação por usuário/senha FUNCIONA**:
   `POST https://api.senior.com.br/platform/authentication/actions/login`
   com `intapi@elo.log.br` retorna token (HTTP 200).

2. **Criamos uma Chave de Aplicação** (menu Tecnologia > Administração >
   Gerenciamento de Aplicações, app "apielo"/"api da elo"), com access key e
   secret. Ao tentar `loginWithKey`
   (`/platform/authentication/anonymous/actions/loginWithKey` com
   `accessKey`/`secret`/`tenantName`), o gateway responde **HTTP 401
   "Client Id in the request, identified by ANY client_id, is invalid"**.

3. **Vinculamos um papel à aplicação** (Autorização > Gestão de Papéis), mas o
   comportamento não mudou.

4. **Qualquer chamada a APIs de negócio** em
   `https://platform.senior.com.br/t/elo.log.br/...` (mesmo com token válido de
   usuário/senha) retorna **HTTP 403 "Request blocked by the administrator -
   route blocked"**, inclusive em endpoints básicos (ex.: usuário logado).

**Pedido objetivo ao suporte:**
- Informar/registrar o **`client_id`** válido para o tenant `elo.log.br` a ser
  usado no header das chamadas (ou habilitar o consumo via chave de aplicação
  sem client_id).
- **Liberar o consumo das APIs públicas/privadas** do ERP para o tenant (remover
  o "route blocked"), em especial o cadastro de clientes
  (`com.senior.g5.co.cad.clientes`, porta `Exportar`).
- Confirmar a **proprietária** necessária (IPSI/IMCR/VMAIS) para a porta `Exportar`.

---
