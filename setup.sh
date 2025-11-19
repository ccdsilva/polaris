#!/bin/bash

echo "=== Setup do Projeto de Análise de Vínculos 3D ==="
echo ""

# Instalar dependências
echo "1. Instalando dependências..."
npm install

# Criar diretório de dados se não existir
echo "2. Criando diretório de dados..."
mkdir -p backend/data

# Inicializar banco de dados
echo "3. Inicializando banco de dados..."
npm run init-db

# Gerar dados simulados
echo "4. Gerando dados simulados..."
npm run generate-data

echo ""
echo "=== Setup concluído! ==="
echo ""
echo "Para iniciar o servidor, execute:"
echo "  npm start"
echo ""
echo "Depois acesse: http://localhost:3000"

