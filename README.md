# Vistoria Veicular (PWA)

Aplicativo de checklist de vistoria veicular com 29 itens, fotografias por item e relatório em PDF com a foto ao lado de cada item.
React + Vite + TypeScript, dados no IndexedDB (no próprio aparelho), instalável como PWA, pronto para a Netlify.

## Rodar no computador

```bash
npm install
npm run dev        # abre em http://localhost:5173 (também acessível pela rede local)
npm test           # 18 testes automatizados
npm run build      # gera a pasta dist/
npm run preview    # testa a versão de produção
```
Precisa do Node 18 ou superior.

> A câmera e o PWA exigem HTTPS. No `localhost` funcionam; para testar no celular use a URL publicada na Netlify.

## Publicar na Netlify

**Opção A - GitHub (recomendada, atualiza sozinha a cada push)**
1. Crie um repositório e envie esta pasta (sem `node_modules` e `dist`; o `.gitignore` já cuida disso).
2. Na Netlify: *Add new site > Import an existing project* e escolha o repositório.
3. Os valores já vêm do `netlify.toml`: comando `npm run build`, pasta `dist`. Clique em *Deploy*.

**Opção B - Upload manual**
1. Rode `npm run build`.
2. Na Netlify: *Add new site > Deploy manually* e arraste a pasta `dist`.

## Instalar no celular
- **Android (Chrome):** menu ⋮ > *Instalar app* / *Adicionar à tela inicial*.
- **iPhone (Safari):** Compartilhar > *Adicionar à Tela de Início*.

## Logomarca no PDF
Coloque o arquivo `logo.png` dentro de `public/` e publique de novo. Sem o arquivo, o relatório sai sem logomarca (nada é inventado).

## Importante sobre os dados
- Os dados ficam **no aparelho e no navegador** onde foram criados. A Netlify hospeda só o aplicativo e **não sincroniza** entre celulares.
- Use *Ajustes > Exportar backup* com frequência (o arquivo inclui as fotos). Para trocar de celular: exporte no antigo e importe no novo.
- Limpar os dados do navegador apaga as vistorias. O app pede ao navegador a "proteção de armazenamento", mas o backup continua sendo a garantia.
- Para vários usuários compartilharem as mesmas vistorias será necessário um banco remoto (por exemplo Supabase) com login e armazenamento de fotos. A camada `src/database/db.ts` concentra todo o acesso aos dados para facilitar essa troca. Nunca coloque chaves administrativas no código do front-end.

## Estrutura

```
src/
  components/   botões de resposta, fotos, visualizador, confirmação, aviso, layout
  pages/        Home, Vehicles, NewInspection, InspectionPage, Review, Report, History, ViewInspection, Settings
  services/     photos (orientação/redução), pdf (relatório), share (baixar/compartilhar), backup, startInspection
  database/     db.ts (IndexedDB: veículos, vistorias, fotos, relatórios)
  hooks/        rota, status de salvamento, URLs das fotos
  data/         checklist.ts (os 29 itens e as fotos mínimas)
  types/        tipos TypeScript
  utils/        datas/nomes, progresso e regras de pendência, mensagens de erro
  __tests__/    testes automatizados
public/         manifest, service worker (sw.js), ícones
```

## Como alterar o checklist
Edite `src/data/checklist.ts`: `minPhotos` define as fotos obrigatórias. Por padrão **NA não dispensa fotos**; para dispensar em um item, adicione `naExemptsPhotos: true`.

## Atualizar uma versão já instalada
Altere `CACHE_VERSION` em `public/sw.js` antes de publicar, para o celular baixar os arquivos novos.

## Regras implementadas
- Várias vistorias pendentes ao mesmo tempo; cada uma com id próprio, e fotos sempre ligadas à vistoria + item.
- Salvamento a cada toque; "Salvo" só aparece depois que o IndexedDB confirma a gravação. Erros e falta de espaço geram mensagem clara.
- Concluir só é permitido sem pendências (a regra é verificada na tela e novamente no banco). A mensagem lista os itens e quantas fotos faltam.
- Vistoria concluída pode ser reaberta (com confirmação). Isso gera uma nova revisão e o PDF original continua guardado.
- Fotos: orientação corrigida, redução para 1280 px e JPEG 82%, guardadas como arquivo (Blob) no IndexedDB.
- PDF: foto real incorporada ao arquivo, ao lado do item, proporção preservada, 2 fotos por linha (1 foto fica maior), linha nunca cortada entre páginas, cabeçalho da tabela repetido, rodapé com código, data, página e campo de assinatura. Cada foto é numerada (ex.: 11.2 = item 11, foto 2).
