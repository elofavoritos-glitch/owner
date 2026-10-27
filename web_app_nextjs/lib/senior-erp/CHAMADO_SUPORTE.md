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
