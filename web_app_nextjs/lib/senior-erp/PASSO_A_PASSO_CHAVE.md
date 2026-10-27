# Passo a passo — gerar a Chave de Aplicação no Senior X (ELO)

> Objetivo: criar uma aplicação e gerar **Chave de Acesso (access_key) + Secret**
> para o painel comercial consumir a API do ERP. Você precisa ver o menu
> **Tecnologia** (= é admin do tenant). Tempo: ~5 minutos.

---

## PARTE 1 — Criar a aplicação e gerar a chave

1. Abra o Senior X no navegador e faça login:
   **https://platform.senior.com.br** (tenant `elo.log.br`).

2. No menu, vá em:
   **Tecnologia → Administração → Gerenciamento de aplicações**

3. Clique no botão **Nova aplicação**.

4. Preencha:
   - **Nome:** `integracao-painel-elo`
   - **Descrição:** `Integração do painel comercial com o ERP (cadastro de clientes)`
   - Salve.

5. A aplicação aparece na lista. Ao lado dela, clique em **Ações** (ou no ícone
   de opções/⋮) e selecione **Gerenciar chaves**.

6. Clique em **Gerar Chave**. O sistema mostra:
   - **Chave de Acesso** (é o `access_key`)
   - **Secret** (é a senha do token — aparece **só uma vez**, copie agora!)

   > ⚠️ Copie os DOIS valores e guarde com segurança. O Secret normalmente só
   > é exibido no momento da criação; se perder, é só gerar de novo.

---

## PARTE 2 — Dar permissão à aplicação (libera o acesso às APIs)

Sem este passo, a chave autentica mas as chamadas de negócio voltam bloqueadas.

7. Vá em: **Tecnologia → Administração → Autorização → Gestão de Papéis**

8. Selecione um **papel** que tenha acesso às informações do ERP
   (ex.: um papel de administrador ou um papel específico do ERP/Mercado).

9. Abra a aba **Aplicações** dentro do papel.

10. **Ative/adicione** a aplicação `integracao-painel-elo` nesse papel e salve.

> Se existir uma tela de "recursos"/"APIs" da aplicação, garanta que os recursos
> do ERP relacionados a **clientes** estejam habilitados.

---

## PARTE 3 — Me enviar as chaves

11. Me passe (pode colar no chat — não são senha de pessoa, são chaves de app):
    - **Chave de Acesso (access_key)**
    - **Secret**

    Eu configuro como variáveis de ambiente (nunca no código):
    ```
    SENIOR_ACCESS_KEY=<chave de acesso>
    SENIOR_SECRET=<secret>
    SENIOR_TENANT=elo.log.br
    SENIOR_API_BASE_URL=https://platform.senior.com.br/t/elo.log.br
    ```
    E rodo o teste do relatório de clientes na hora.

---

## Observações
- Se em algum passo o nome do menu estiver um pouco diferente, me descreva o que
  você vê na tela que eu te oriento (as telas da Senior mudam com o tempo).
- 🔒 Segurança: assim que a integração estiver validada, convém **gerar uma chave
  dedicada** só para isso (e não reaproveitar credenciais de pessoa). As chaves
  ficam só em variáveis de ambiente (Vercel/Supabase), nunca no repositório.
