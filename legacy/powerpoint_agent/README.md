# Especialista PowerPoint — ELO

Gera apresentações `.pptx` 16:9 em Python puro, sem internet ou dependências externas.

```bash
cd /projects/sandbox/powerpoint_agent
python3 gerar_apresentacao.py
```

A apresentação padrão contém seis slides: capa, necessidade, solução, premissas, investimento e próximos passos. O motor suporta títulos, subtítulos, listas, cores da ELO e rodapé. `validate_pptx` verifica ZIP, XMLs, relacionamentos básicos e quantidade de slides.

A validação é estrutural; faça revisão visual no Microsoft PowerPoint antes de apresentar ao cliente. Campos não informados usam `[PREENCHER ...]`.
