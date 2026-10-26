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

## Integração com o vagas-bot

A tela inicial lista as vagas que o [vagas-bot](https://github.com/guicarvalhal8/vagas-bot) enviou (lidas do `vagas.db` dele). Um clique gera o currículo da vaga. **Atualizar** faz `git pull` no vagas-bot para trazer as vagas coletadas pelas Actions.

- Vagas sem descrição no banco: a descrição é buscada no anúncio (GitHub, Gupy e LinkedIn; o Indeed bloqueia).
- **Candidatar com este currículo** manda a folha da tela para o `candidatar.py` do vagas-bot (`ponte_web.py`, em 127.0.0.1:47614). Ele gera o PDF e se candidata com ele por e-mail ou formulário; o que não souber responder, pergunta no Telegram.
- Marcadores como `[X]` bloqueiam o envio: troque por números reais antes.

Configuração (opcional, no `.env.local`):

- `VAGAS_BOT_DIR`: pasta do vagas-bot. O padrão é `../vagas-bot/vagas-bot`.
- `PONTE_VAGAS_BOT`: endereço da ponte. O padrão é `http://127.0.0.1:47614`.

## Candidatura automática

Com `AUTO_CANDIDATAR=1` no `.env.local`, a cada 30 minutos (`AUTO_INTERVALO_MIN`) o sistema atualiza o vagas-bot, gera o currículo de cada vaga nova e manda o `candidatar.py` se candidatar. O painel **Candidatura automática** da tela mostra o andamento e abre o currículo enviado.

- Só entram vagas que o vagas-bot viu depois de ligar o automático. LinkedIn e Gupy ficam de fora (precisam de você).
- No automático não há número inventado nem marcador: o resultado fica descrito em palavras. Se a IA exagerar o seu papel ("liderei", "gerenciei"), ela gera de novo uma vez; se insistir, a vaga fica como **Revisar** e não é enviada.
- O estado fica em `data/auto.json` (fora do Git).
- Para deixar ligado, rode `iniciar_curriculo_ia.vbs` (sobe em produção, sem janela). Para ligar junto com o PC, copie-o para a pasta Inicializar do Windows (Win+R, `shell:startup`). O `candidatar.py` do vagas-bot também precisa estar rodando.

## Estrutura

| Arquivo | O que é |
| --- | --- |
| `data/perfil.json` | Seus dados (editados pela tela Meus dados) |
| `data/vagas.json` | Lista de vagas prontas |
| `src/lib/skill-curriculo-ats.md` | As regras do vídeo, usadas como prompt da IA |
| `src/lib/gerar.ts` | Chamada ao Gemini ou ao Claude, modo demonstração e checklist automático |
| `src/app/api/*` | Rotas `gerar`, `perfil`, `vagas`, `vagas-bot` e `candidatar` |
| `src/lib/vagasBot.ts` | Leitura do `vagas.db` do vagas-bot |
| `src/lib/descricaoVaga.ts` | Busca da descrição no anúncio |
| `src/lib/auto.ts` | Candidatura automática (relógio em `src/instrumentation.ts`) |
| `src/lib/ponte.ts` | Conversa com o `candidatar.py` do vagas-bot |
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
