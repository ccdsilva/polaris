# Análise de Vínculos 3D

Ferramenta de análise de vínculos tridimensional usando Three.js com suporte a dados time series.

## Instalação

```bash
npm install
```

## Configuração do Banco de Dados

```bash
npm run init-db
npm run generate-data
```

## Executar

```bash
npm start
```

Acesse `http://localhost:3000` no navegador.

## Estrutura

- `frontend/` - Interface 3D com Three.js
- `backend/` - API REST e banco de dados JSON
- `backend/database/` - Implementação do banco de dados JSON
- `backend/data/` - Gerador de dados simulados e arquivo database.json

## Nota

Este protótipo usa armazenamento JSON em vez de SQLite para evitar dependências de compilação nativa. Os dados são salvos em `backend/data/database.json`.

