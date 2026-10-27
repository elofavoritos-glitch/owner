# Agente de Word — Comercial ELO

Gera **propostas comerciais em Word (.docx)** personalizadas, sem depender de
bibliotecas externas nem de internet (funciona 100% offline no sandbox).

## Arquivos

| Arquivo | O que faz |
|---------|-----------|
| `docx_writer.py` | Motor que escreve arquivos `.docx` reais em Python puro (títulos, parágrafos, tabelas, cores da marca). |
| `gerar_proposta.py` | Agente de proposta comercial: recebe os dados do cliente e monta o documento. |
| `proposta_elo_exemplo.docx` | Exemplo já gerado com a identificação da ELO para você conferir. |

## Como gerar uma proposta

1. Os dados institucionais confirmados da ELO já estão configurados em
   `gerar_proposta.py`: nome, Itajaí/SC e `https://eloarmazenagem.com.br`.
   E-mail, telefone, logotipo e cor oficial permanecem pendentes de confirmação.
2. Monte os dados do cliente/serviços e rode:

```bash
cd word_agent
python3 gerar_proposta.py        # gera proposta_elo_exemplo.docx
```

Ou, no dia a dia, basta me pedir aqui no chat:
> "Monta uma proposta pro cliente X com estes serviços e valores..."
> e eu preencho os dados e gero o `.docx` pra você.

## O que o documento inclui

- Cabeçalho com marca, slogan e contato
- Dados do cliente (empresa, CNPJ, contato, validade)
- Apresentação personalizada (tom boutique)
- Escopo de serviços
- Tabela de investimento com subtotais e total
- Condições comerciais
- Assinatura do vendedor

## Próximos passos possíveis

- Skill de **Excel implementada** em `../excel_agent/` para cotações, funil e indicadores comerciais.
- Skills de **PowerPoint**, **Outlook Microsoft 365** e **PDF** implementadas nos diretórios vizinhos.
- Templates adicionais em Word: carta de apresentação, contrato de prestação de
  serviços, follow-up.
- Logo da empresa no cabeçalho (basta me enviar o arquivo de imagem).
