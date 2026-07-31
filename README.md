# Speed Bikers — Gestão de Compras (Next.js)

Aplicação web para análise de curva ABC, saúde de anúncios e reposição de estoque
da Speed Bikers, com **login por email/senha**, **níveis de acesso (admin/usuário)**,
**bloqueio global do app pelo admin** e **duas fontes de dados**: upload de Excel e
sincronização em tempo real com a API do Mercado Livre.

Todo o processamento de análise roda no navegador. As credenciais sensíveis
(secret do Mercado Livre, service role do Supabase) ficam **só no servidor**.

---

## Pré-requisitos

- **Node.js 20 ou superior** — instale em https://nodejs.org (versão LTS).
- Uma conta gratuita no **Supabase** — https://supabase.com
- Uma conta de vendedor no **Mercado Livre** com KYC concluído (para gerar as chaves de API).

---

## Passo 1 — Instalar o projeto

Abra o terminal dentro da pasta do projeto e rode:

```bash
npm install
```

---

## Passo 2 — Criar o banco no Supabase

1. Em https://supabase.com, crie um projeto novo (guarde a senha do banco).
2. No menu lateral, abra **SQL Editor** → **New query**.
3. Cole todo o conteúdo do arquivo `supabase-schema.sql` e clique em **Run**.
   Isso cria as tabelas `profiles`, `app_state` e `ml_tokens`, o gatilho que cria
   o perfil automaticamente e as políticas de segurança.
4. Vá em **Settings → API** e copie:
   - **Project URL**
   - **anon public** key
   - **service_role** key (secreta — nunca exponha no front)

---

## Passo 3 — Criar a aplicação no Mercado Livre

1. Acesse **https://developers.mercadolivre.com.br/devcenter** com sua conta de vendedor.
2. Conclua o **KYC** (verificação de identidade) — hoje é obrigatório para gerar o App ID.
3. Clique em **Criar nova aplicação** e preencha os campos.
4. No campo **URIs de redirect**, informe exatamente:
   ```
   http://localhost:3000/api/ml/callback
   ```
   (quando publicar o app, adicione também a URL de produção equivalente).
5. Nos **escopos**, marque leitura (`read`) — e escrita, se for usar no futuro.
6. Guarde o **App ID** (client id) e o **Client Secret**.

---

## Passo 4 — Configurar as chaves

1. Copie o arquivo de exemplo:
   ```bash
   cp .env.local.example .env.local
   ```
2. Abra `.env.local` e preencha com os valores dos passos 2 e 3:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ML_CLIENT_ID=...
   ML_CLIENT_SECRET=...
   ML_REDIRECT_URI=http://localhost:3000/api/ml/callback
   ```

---

## Passo 5 — Rodar

```bash
npm run dev
```

Abra **http://localhost:3000**.

1. Clique em **Cadastre-se** e crie seu usuário (email + senha).
2. Torne-se **admin**: no Supabase → **SQL Editor**, rode (troque o email):
   ```sql
   update public.profiles set role = 'admin' where email = 'seu@email.com';
   ```
3. Recarregue a página. Agora você verá o botão **Bloquear app**.

---

## Como funciona cada recurso

### Níveis de acesso
- **admin**: vê tudo + botão de bloquear/desbloquear o app para todos.
- **usuário (viewer)**: vê o dashboard, sugestão de compra etc., mas não bloqueia ninguém.
- Todo cadastro novo entra como `viewer`. Você promove a `admin` pelo SQL acima.

### Bloqueio global
Quando o admin clica em **Bloquear app**, o estado é gravado na tabela `app_state`.
Todos os usuários `viewer` passam a ver a tela:
> Entre em contato com o administrador, Pablo Lima — 13 991560814

A checagem é feita no servidor (`/api/lock` recusa quem não é admin), então não dá
para burlar pelo navegador. O admin continua com acesso normal mesmo com o app bloqueado.

### Fontes de dados
No topo do dashboard há um seletor:
- **Upload de Excel**: sobe a planilha de vendas do Mercado Livre e a de estoque do Upseller.
- **Mercado Livre (tempo real)**: puxa as vendas direto da API. Na primeira vez, clique em
  **Conectar conta do Mercado Livre** (fluxo OAuth). Depois, **Sincronizar vendas**.

> O **estoque continua vindo do upload** do Upseller, porque o Upseller ainda não tem API.
> Sem a planilha de estoque, a parte de reposição/ruptura fica indisponível.

### Análises disponíveis
Curva ABC (faturamento ou volume), alertas de queda com diagnóstico título vs. preço,
trocas de título que aumentaram vendas, e a tela **Comprar agora** com quantidade sugerida
ajustada por tendência (produtos em crescimento recebem folga maior, até dobrar).

---

## Estrutura de pastas

```
speedbikers/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # layout raiz
│   │   ├── globals.css           # estilos (Tailwind)
│   │   ├── page.tsx              # home: valida login + bloqueio + role
│   │   ├── login/page.tsx        # login e cadastro
│   │   └── api/
│   │       ├── lock/route.ts     # bloquear/desbloquear (admin)
│   │       └── ml/
│   │           ├── authorize/route.ts  # inicia OAuth do ML
│   │           ├── callback/route.ts   # troca code por tokens
│   │           └── sync/route.ts       # puxa vendas do ML
│   ├── components/
│   │   ├── Dashboard.tsx         # todo o painel (client)
│   │   └── LockScreen.tsx        # tela de app bloqueado
│   ├── lib/
│   │   ├── analysis.js           # núcleo de análise (ABC, tendência, reposição)
│   │   ├── analysis.d.ts         # tipos do módulo acima
│   │   ├── supabase-browser.ts   # cliente Supabase (navegador)
│   │   └── supabase-server.ts    # cliente Supabase (servidor) + admin
│   └── proxy.ts                  # middleware de sessão (Next 16)
├── supabase-schema.sql           # rode isso no Supabase
├── .env.local.example            # modelo das variáveis
└── package.json
```

---

## Publicar (opcional)

Para colocar no ar, a Vercel (mesma empresa do Next.js) é o caminho mais direto:
suba o projeto no GitHub, importe na Vercel, configure as mesmas variáveis de ambiente,
e adicione a URL de produção no **URIs de redirect** do Mercado Livre e como
`ML_REDIRECT_URI`.

---

## Solução de problemas

- **"Invalid login credentials"**: usuário/senha errados, ou o email ainda não foi confirmado
  (desative a confirmação por email em Supabase → Authentication → Providers, se preferir).
- **ML: "sem_conexao_ml"**: você ainda não clicou em **Conectar conta do Mercado Livre**.
- **ML: erro no redirect**: o `ML_REDIRECT_URI` no `.env.local` precisa ser **idêntico**
  ao cadastrado no DevCenter, incluindo `http://` e a porta.
- **Não aparece o botão de bloquear**: seu usuário ainda é `viewer`; rode o `update` do Passo 5.
