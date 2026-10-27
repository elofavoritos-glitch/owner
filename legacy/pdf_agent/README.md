# Especialista PDF — ELO

Gera propostas comerciais `.pdf` nativas em Python puro, sem internet ou dependências externas.

```bash
cd /projects/sandbox/pdf_agent
python3 gerar_proposta_pdf.py
```

O PDF inclui cliente, apresentação, escopo, tabela de investimento, condições e próximos passos. O motor suporta paginação automática e caracteres do português. `validate_pdf` verifica assinatura, catálogo, xref, finalização e páginas.

Um PDF com campos `[PREENCHER ...]` é rascunho e não deve ser enviado como versão final.
