# Pendências de segurança — ROTACIONAR credenciais expostas

> ⚠️ **AÇÃO NECESSÁRIA.** As credenciais abaixo foram expostas durante o
> desenvolvimento (compartilhadas em chat/assistente) e **devem ser rotacionadas**.
> Enquanto não forem, considere-as comprometidas: qualquer pessoa com o valor
> pode usá-las. Por segurança, este arquivo lista apenas o **prefixo** de cada
> uma — nunca registre o valor completo no repositório.

## Checklist de rotação

- [ ] **Chave Econodata API v4** (`ek_live_klX…`) — **PRIORIDADE ALTA**
  - Tem ~3 milhões de tokens de saldo = valor financeiro real.
  - Rotacionar em `https://plat.econodata.com.br/#/integracoes-api`:
    1. **Criar nova chave** (copiar o valor, aparece só uma vez).
    2. Atualizar `ELO_ECONODATA_API_KEY` na Vercel (Settings → Environment
       Variables) e **Redeploy**.
    3. **Revogar** a chave antiga (`ek_live_klX…`) no painel.
  - Validar depois: pelo assistente, *"qual meu saldo na Econodata?"* deve
    responder normalmente.

- [ ] **Chave Logcomex** (`dwgUXr…`) — rotacionar no painel da Logcomex e
  atualizar `ELO_LOGCOMEX_API_KEY` na Vercel. (Hoje o produto `ncm-intel` não
  está contratado, então a chave não funciona — mas rotacione mesmo assim.)

- [ ] **Senha do banco Supabase** (`8uF…`) — trocar em Supabase → Project
  Settings → Database → Reset database password. Atualizar qualquer connection
  string que a use.

- [ ] **Chave Google Cloud TTS** (`AIzaSy…`) — em
  `console.cloud.google.com` → APIs e Serviços → Credenciais:
    - **Restringir** a chave (por API: só Cloud Text-to-Speech; e por
      referenciador/HTTP se aplicável), **ou** gerar uma nova restrita e
      atualizar `GOOGLE_TTS_API_KEY` na Vercel, revogando a antiga.

- [ ] **Senha do usuário de integração Senior X** (usuário `intapi`, tenant
  `elo.log.br`) — a senha foi exposta em chat durante o desenvolvimento e deve
  ser **trocada** na Plataforma Senior X (Tecnologia → Gestão de Usuários).
    - Após trocar, atualizar `SENIOR_PASSWORD` apenas por variável de ambiente
      (Vercel/Supabase) — nunca no repositório.
    - Ideal: usar um usuário de **integração dedicado**, com permissões mínimas
      (só os recursos/endpoints que a aplicação consome), não um usuário humano.

## Boa prática daqui pra frente
- Nunca colar segredos no chat/assistente nem em arquivos versionados.
- Toda chave vive só em **variáveis de ambiente** (Vercel/Supabase), nunca no
  código nem no git. O `.env.local` já está no `.gitignore`.
- Para o SSO, o **client secret do Entra** também expira — ver
  `SSO_MICROSOFT_365.md` (seção de renovação).
