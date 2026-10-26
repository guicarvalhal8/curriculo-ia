# Currículo IA

Sistema web simples que gera um currículo focado na vaga. Ele segue as regras do reel do @guimartinsbr sobre currículo que passa no robô (ATS) e no recrutador. As regras estão na skill `curriculo-ats`.

## Como rodar

```bash
npm install
cp .env.example .env.local   # coloque sua GEMINI_API_KEY (gratuita) ou ANTHROPIC_API_KEY
npm run dev
```

Abra http://localhost:3000.

Sem a chave, o sistema roda em **modo demonstração**: ele só monta o currículo com os dados do perfil, sem IA. Serve pra testar a interface.

## Como usar

1. **Meus dados** (`/perfil`): preencha telefone, LinkedIn e GitHub e revise experiências e projetos. Coloque números reais nas atividades (clientes, horas economizadas, %). É daí que a IA tira os resultados.
2. **Gerar** (`/`): escolha uma vaga da lista ou digite o nome exato dela, cole a descrição do anúncio e clique em **Gerar currículo**.
3. Revise o checklist e a lista **Você precisa completar**. Clique no texto do currículo para ajustar.
4. **Baixar PDF** abre a impressão do navegador. Escolha "Salvar como PDF" e desative "Cabeçalhos e rodapés".

Cada currículo gerado fica salvo no navegador, em **Currículos salvos**. Você também pode guardar uma vaga com a descrição usando **Salvar vaga**.

## Estrutura

| Arquivo | O que é |
| --- | --- |
| `data/perfil.json` | Seus dados (editados pela tela Meus dados) |
| `data/vagas.json` | Lista de vagas prontas |
| `src/lib/skill-curriculo-ats.md` | As regras do vídeo, usadas como prompt da IA |
| `src/lib/gerar.ts` | Chamada ao Gemini ou ao Claude, modo demonstração e checklist automático |
| `src/app/api/*` | Rotas `gerar`, `perfil` e `vagas` |
| `src/components/Curriculo.tsx` | A folha A4 de uma coluna (sem foto, tabela ou barrinha) |
| `.claude/skills/curriculo-ats/` | A mesma skill, para o Claude Code usar ao evoluir o projeto |

## Garantias contra currículo "inventado"

- Nome, contato, cargo, empresa e período vêm sempre do perfil, nunca da IA. Se a IA citar uma experiência que não está no perfil, ela é removida e você é avisado. CPF, idade e endereço nem têm campo.
- O checklist aponta verbos que aumentam o seu papel (liderei, gerenciei, especialista...) para você confirmar.
- A IA é instruída a não inventar cargo, habilidade nem número. Quando falta uma métrica, ela põe um marcador como `[N clientes]` e avisa em "Você precisa completar".
- Se a vaga pede algo que você não tem, a IA avisa em vez de colocar no currículo.

## Configuração

Use uma das duas chaves. Se as duas existirem, o Gemini é usado.

- `GEMINI_API_KEY`: chave do Google Gemini, com plano gratuito. Crie em https://aistudio.google.com/apikey.
- `GEMINI_MODEL` (opcional): o padrão é `gemini-2.5-flash`. Se ele estiver sobrecarregado ou sem cota, o sistema tenta `gemini-flash-lite-latest` e depois `gemini-flash-latest`.
- `ANTHROPIC_API_KEY`: chave da API da Anthropic (paga).
- `ANTHROPIC_MODEL` (opcional): o padrão é `claude-sonnet-5-5`.

Os dados ficam salvos em arquivos JSON locais, então o sistema foi pensado pra rodar na sua máquina. Para colocar online (Vercel etc.), troque `src/lib/dados.ts` por um banco de dados.
