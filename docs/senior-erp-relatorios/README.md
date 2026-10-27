# Relatórios Senior Gestão Empresarial | ERP (ref. v5.10.4)

Especificações de relatórios para o **Gerador de Relatórios** da Senior.

Cada arquivo descreve um relatório pronto para montar na ferramenta e salvar como `.GER`:
SQL (SQL Senior), estrutura de seções/bandas e passo a passo.

> Importante: o arquivo `.GER` é o modelo binário proprietário da Senior e só é gerado
> válido ao salvar dentro do próprio Gerador de Relatórios. Estas specs automatizam todo
> o trabalho até o "Salvar como .GER". Campos marcados com ⚠️ devem ser confirmados na base
> da instalação; os marcados com ✅ foram verificados na documentação oficial 5.10.4.

## Relatórios
| Arquivo | Descrição |
|---|---|
| `cadastro-clientes.md` | Todos os cadastros de clientes: código, nome, CNPJ/CPF, cidade, UF, situação |
| `propostas-comerciais-ativas.md` | Propostas/pedidos ativos: número, emissão, CNPJ, cliente, despachante, representante |
