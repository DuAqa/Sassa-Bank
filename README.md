# 💖 Sassa Bank

O banco da Sabrina: saber quanto tem, registrar o que entra e sai, ver quanto já está comprometido com parcelas e guardar dinheiro para as metas.

- **Interface:** HTML + CSS + JavaScript puro (módulos ES), sem dependências.
- **Dados:** Google Sheets na **sua** conta, acessada só através de um Google Apps Script também seu.
- **App instalável (PWA):** funciona offline, abre pela tela inicial do celular e sincroniza quando a internet volta.

---

## 1. O que tem na pasta

```
sassa-bank/
├── index.html              ← casca do app
├── manifest.json           ← nome, ícones e cores para instalar (PWA)
├── service-worker.js       ← cache offline dos arquivos da interface
├── css/app.css             ← identidade visual
├── icons/                  ← logo (SVG + PNGs para Android/iOS)
├── js/
│   ├── app.js              ← inicialização, rotas e eventos
│   ├── config.js           ← categorias iniciais, formas de pagamento
│   ├── state.js            ← ESTADO: dados carregados + status de sync
│   ├── finance.js          ← regras: saldo, comprometido, livre, insights
│   ├── utils.js            ← dinheiro, datas, textos
│   ├── data/               ← DATA SERVICE (nada de UI aqui)
│   │   ├── dataService.js  ← carregar / salvar / atualizar / excluir / sincronizar
│   │   ├── localStore.js   ← localStorage (fallback offline + fila de envio)
│   │   ├── remoteApi.js    ← cliente HTTP do Apps Script (trocável)
│   │   ├── auth.js         ← login Google (V2.2, opcional)
│   │   └── demo.js         ← dados de demonstração
│   └── ui/                 ← UI (nada de rede aqui)
│       ├── components.js   ← sheet, toast, confirmação, campo de valor
│       ├── charts.js       ← gráficos SVG
│       ├── flows.js        ← registrar, metas, parcelas, categorias
│       └── views/          ← Início, Extrato, Análise, Metas, Ajustes
└── apps-script/
    ├── Code.gs             ← API de persistência (backend)
    └── appsscript.json     ← manifesto do Apps Script
```

### Como as camadas conversam

```
UI (views, flows) ──lê──▶ Store (state.js) ◀──escreve── DataService
                    └──chama──▶ DataService ──▶ localStore (sempre, na hora)
                                             └─▶ remoteApi ──▶ Apps Script ──▶ Google Sheets
```

A UI nunca fala com o Google. Para trocar de backend no futuro (Firebase, Supabase, API própria), basta criar outro módulo com as mesmas funções de `remoteApi.js` (`ping`, `pull`, `push`).

### A conta principal

```
Livre para gastar = Saldo atual − Comprometido (parcelas/despesas futuras) − Guardado em metas
```

- **Saldo atual:** entradas − saídas com data até hoje.
- **Comprometido:** despesas com data futura. Uma compra de R$ 600 em 12x vira 12 lançamentos de R$ 50 (um por mês); os meses que ainda não chegaram contam aqui.
- **Guardado em metas:** dinheiro que continua com ela, mas já tem destino. Guardar numa meta não é gasto; só tira do "livre".

---

## 2. Testar agora (sem configurar nada)

O app abre com **dados de demonstração** (com uma faixa amarela avisando). Para testar no computador:

```bash
cd sassa-bank
python3 -m http.server 8080
# abra http://localhost:8080
```

> Precisa ser servido por HTTP. Abrir o `index.html` com duplo clique (`file://`) não funciona por causa dos módulos JavaScript.

Para começar a usar de verdade: **Ajustes → Dados → Começar de verdade**.

---

## 3. Criar a planilha e o backend (≈10 min, na SUA conta Google)

1. Acesse [sheets.new](https://sheets.new) com **a sua conta** e dê o nome **Sassa Bank — Dados**.
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo de `Código.gs` e cole todo o `apps-script/Code.gs`.
4. Clique em ⚙️ **Configurações do projeto** → marque **"Mostrar arquivo de manifesto appsscript.json"**. Volte ao editor, abra o `appsscript.json` e substitua pelo conteúdo de `apps-script/appsscript.json`.
5. No topo, selecione a função **`setup`** → **Executar**. Autorize quando o Google pedir (é a sua conta autorizando o seu próprio script). As abas `Transacoes`, `Metas`, `Categorias` e `Log` serão criadas.
6. Selecione **`gerarChave`** → **Executar**. Abra o **Registro de execução** e copie a chave 🔑 que aparece. Guarde, você vai usar no passo 5.
7. **Implantar → Nova implantação** → tipo **App da Web**:
   - Descrição: `Sassa Bank API v1`
   - **Executar como:** Eu (sua conta)
   - **Quem pode acessar:** Qualquer pessoa
   - Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).

> **Por que "Qualquer pessoa"?** O app chama o script a partir do navegador, e o Google não envia o login da Sabrina nessas chamadas entre sites diferentes. Por isso quem controla o acesso é o próprio script: ele exige a chave (e, na V2.2, o login Google). Sem a chave, a URL não lê nem grava nada. A planilha continua **privada**: só a sua conta tem acesso a ela, e a Sabrina não precisa ser adicionada.

### Estrutura da planilha (criada automaticamente pelo `setup`)

**Transacoes**

| Coluna | Exemplo | Observação |
|---|---|---|
| ID | `tx_lq3k…` | gerado pelo app |
| Data | `2026-11-12` | texto AAAA-MM-DD |
| Tipo | `despesa` | `receita` ou `despesa` |
| Categoria | `refeicao` | ID da aba Categorias |
| Descricao | `McDonald's` | opcional |
| Valor | `35,00` | valor desta linha (da parcela, se parcelado) |
| ParcelaAtual | `3` | vazio se à vista |
| TotalParcelas | `12` | vazio se à vista |
| IDCompra | `cp_…` | liga as parcelas de uma mesma compra |
| ValorTotalCompra | `600,00` | só em parceladas |
| FormaPagamento | `credito` | `pix`, `dinheiro`, `debito`, `credito` ou vazio |
| DataCriacao / DataAtualizacao | ISO | usadas para resolver conflitos |

**Metas**: ID · Nome · Emoji · ValorObjetivo · ValorAcumulado · DataObjetivo · Status (`ativa`/`concluida`/`arquivada`) · DataCriacao · DataAtualizacao

**Categorias**: ID · Tipo · Nome · Emoji · Cor · Ativa · Ordem

**Log**: DataHora · Usuario · Acao · Entidade · ID (auditoria de tudo que o app grava)

As abas ficam com proteção "com aviso" para evitar edições acidentais. Você pode editar, mas o ideal é sempre usar o app.

---

## 4. Publicar o app (URL com HTTPS)

Qualquer hospedagem de site estático serve. A mais simples:

### Opção A: GitHub Pages (grátis)
1. Crie um repositório (pode ser privado no plano pago, ou público, já que **não há dados nem chaves no código**).
2. Envie todo o conteúdo da pasta `sassa-bank/` (sem a pasta `apps-script` se preferir).
3. **Settings → Pages → Deploy from a branch → `main` / root**.
4. Em ~1 min o app estará em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

### Opção B: Netlify ou Cloudflare Pages (arrastar e soltar)
Entre em [app.netlify.com/drop](https://app.netlify.com/drop) e arraste a pasta `sassa-bank`. Pronto: URL `https://….netlify.app`.

### Publicando atualizações
Ao alterar qualquer arquivo, aumente `CACHE_VERSION` em `service-worker.js` (ex.: `sassa-v1.0.1`). O app avisa "Nova versão" e atualiza na próxima abertura.

---

## 5. Conectar o app à planilha

No celular da Sabrina (ou no seu), abra o app → **Ajustes → Conectar à planilha**:

1. **URL do Apps Script:** a URL `/exec` do passo 3.7.
2. **Chave de acesso:** a chave do passo 3.6.
3. **Testar conexão** → deve aparecer 🟢 com o nome da planilha.
4. **Salvar.** Se o app estava com dados de demonstração, eles são descartados (nunca vão para a planilha) e a sincronização começa.

Status no topo do app:

| | Significado |
|---|---|
| 🟢 Sincronizado | tudo salvo na planilha |
| 🟡 Sincronização pendente | há anotações esperando envio (tenta sozinho a cada minuto e quando a internet volta) |
| 🔴 Offline | sem internet. Pode usar normalmente, nada se perde |
| ⚪ Só neste aparelho | planilha ainda não conectada |

---

## 6. Instalar no celular

**Android (Chrome):** abra a URL → aparece o botão **📲 Instalar** no topo (ou menu ⋮ → *Instalar app*).
**iPhone/iPad (Safari):** abra a URL → botão **Compartilhar** → **Adicionar à Tela de Início**.

O ícone **Sassa Bank** aparece na tela inicial e o app abre em tela cheia, sem barra do navegador.

---

## 7. Segurança: o que está protegido e o que não está

| Situação | V2 / V2.1 (chave) | V2.2 (login Google) |
|---|---|---|
| Alguém descobre a URL do script | ❌ bloqueado (sem chave) | ❌ bloqueado |
| Sabrina precisa de acesso à planilha | Não | Não |
| Backend valida tipos, valores, datas, tamanhos | ✅ | ✅ |
| Proteção contra fórmulas injetadas na planilha | ✅ | ✅ |
| Limite de requisições por minuto + log de auditoria | ✅ | ✅ |
| Alguém com acesso ao aparelho desbloqueado | ⚠️ vê a chave em Ajustes | ⚠️ precisa também da conta Google |
| O backend sabe **quem** está chamando | ❌ não | ✅ sim (e-mail verificado) |

**Em resumo:** a versão com chave é uma proteção razoável para um app familiar, mas **não é autenticação de usuário**: quem tiver a chave tem acesso. Se a chave vazar, rode `gerarChave()` de novo (a antiga para de funcionar) e atualize em Ajustes. Para autenticação real, ative a V2.2:

### Ativar o login Google (V2.2)
1. Em [console.cloud.google.com](https://console.cloud.google.com) → crie um projeto → **APIs e serviços → Tela de consentimento OAuth** (tipo Externo, modo teste, adicione os e-mails dela e seu como usuários de teste).
2. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**. Em *Origens JavaScript autorizadas*, coloque a URL do app (ex.: `https://seu-usuario.github.io`). Copie o **Client ID**.
3. No Apps Script, edite `CLIENT_ID` e `EMAILS` dentro de `ativarLoginGoogle()` e execute. (O Google vai pedir uma autorização nova, para o script consultar o validador de tokens.)
4. No app → **Ajustes → Conectar à planilha → Google Client ID** → Salvar → aparece **Entrar com Google**.

A partir daí, cada sincronização leva um token assinado pelo Google; o script confere assinatura, validade, destinatário e se o e-mail está na lista `ALLOWED_EMAILS`.

---

## 8. Funcionamento offline

- Os arquivos do app ficam em cache (service worker), então ele abre mesmo sem internet.
- Os dados ficam no aparelho (localStorage). Cada alteração entra numa **fila de envio**.
- Quando a internet volta, a fila é enviada e o app baixa a versão oficial da planilha. Alterações ainda na fila têm prioridade, então nada se perde.
- O envio é **idempotente** (reenviar a mesma alteração não duplica) e, se duas versões do mesmo registro chegarem, vence a mais recente (`DataAtualizacao`).
- **Backup:** Ajustes → Dados → *Baixar backup* gera um `.json` que pode ser restaurado.

---

## 9. Problemas comuns

| Sintoma | Solução |
|---|---|
| "Chave de acesso inválida" | Copie a chave de novo do log do `gerarChave()` (sem espaços). |
| "Planilha não preparada" | Rode `setup()` no Apps Script. |
| "Resposta inválida do servidor" | A URL precisa terminar em `/exec` (não `/dev`) e a implantação precisa estar com acesso "Qualquer pessoa". |
| Mudei o `Code.gs` e nada mudou | **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão → Implantar.** (A URL continua a mesma.) |
| App não atualiza após publicar | Aumente `CACHE_VERSION` no `service-worker.js` e feche/abra o app. |
| Botão "Instalar" não aparece | Precisa estar em HTTPS; no iPhone use Compartilhar → Tela de Início. |

---

## 10. Próximos passos sugeridos

V1 ✅ app local · V1.1 ✅ UX · V2 ✅ Sheets + Apps Script · V2.1 ✅ sync + PWA · V2.2 ✅ preparado (login Google opcional).

Ideias para depois: conquistas e gamificação, orçamento mensal e limites por categoria, resumo semanal, painel do responsável (só leitura), exportação para CSV, IndexedDB no lugar do localStorage quando o histórico ficar grande.
