export class UIController {
    constructor() {
        this.nodeInfoEl = document.getElementById('node-info');
        this.peopleCountEl = document.getElementById('people-count');
        this.connectionsCountEl = document.getElementById('connections-count');
        this.searchInput = document.getElementById('search-input');
        this.searchResultsEl = document.getElementById('search-results');
        
        // Comparação
        this.aiQueryInput = document.getElementById('ai-query-input');
        this.aiQueryButton = document.getElementById('ai-query-btn');
        this.aiResponseEl = document.getElementById('ai-response');
        this.selectedUsersListEl = document.getElementById('selected-users-list');
        this.compareBtn = document.getElementById('compare-btn');
        this.clearComparisonBtn = document.getElementById('clear-comparison-btn');
        this.comparisonResultsEl = document.getElementById('comparison-results');
        
        this.selectedPerson = null;
        this.searchResults = [];
        this.selectedUsersForComparison = [];
        this.currentTime = null;
        this.defaultAIMessage = 'Utilize o chatbot para obter insights complementares sobre os vínculos selecionados.';
        
        if (this.aiResponseEl) {
            this.aiResponseEl.innerHTML = this.defaultAIMessage;
        }
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Event listeners para comparação
        if (this.aiQueryInput) {
            this.aiQueryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.askChatbot();
                }
            });
        }

        if (this.aiQueryButton) {
            this.aiQueryButton.addEventListener('click', () => {
                this.askChatbot();
            });
        }

        this.compareBtn.addEventListener('click', () => {
            this.performComparison();
        });

        this.clearComparisonBtn.addEventListener('click', () => {
            this.clearComparison();
        });

        // Permitir adicionar usuário à comparação ao clicar nos resultados da busca
        document.addEventListener('personSelected', (e) => {
            this.addUserToComparison(e.detail);
        });
    }

    updateNodeInfo(person) {
        this.selectedPerson = person;
        
        if (!person) {
            this.nodeInfoEl.innerHTML = '<p>Clique em um nó para ver detalhes</p>';
            return;
        }
        
        // Informações de segurança pública
        const faccao = person.faccao ? `<span style="color: #ff4444; font-weight: bold;">${person.faccao}</span>` : '<span style="color: #4a9eff;">Civil</span>';
        const riskLevel = person.risk_level || 'baixo';
        const riskColor = {
            'baixo': '#51cf66',
            'medio': '#ffd93d',
            'alto': '#ff6b00',
            'critico': '#ff0000'
        }[riskLevel] || '#95a5a6';
        
        // Formatar data de nascimento
        let birthDateInfo = '';
        if (person.birth_date) {
            const birthDate = new Date(person.birth_date);
            const age = Math.floor((new Date() - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
            birthDateInfo = `<p><strong>Data de Nascimento:</strong> ${birthDate.toLocaleDateString('pt-BR')} (${age} anos)</p>`;
        }
        
        let html = `
            <p><strong>Nome:</strong> ${person.name}</p>
            ${person.cpf ? `<p><strong>CPF:</strong> ${person.cpf}</p>` : ''}
            ${person.rg ? `<p><strong>RG:</strong> ${person.rg}</p>` : ''}
            ${birthDateInfo}
            <p><strong>Email:</strong> ${person.email || 'N/A'}</p>
            ${person.phone ? `<p><strong>Telefone:</strong> ${person.phone}</p>` : ''}
            ${person.address ? `<p><strong>Endereço:</strong> ${person.address}</p>` : ''}
            <p><strong>ID:</strong> ${person.id}</p>
            <hr style="border-color: #3a3a4a; margin: 10px 0;">
            <p><strong>Facção:</strong> ${faccao}</p>
            ${person.hierarchy ? `<p><strong>Hierarquia:</strong> <span style="color: #ffaa00;">${person.hierarchy}</span></p>` : ''}
            <p><strong>Nível de Risco:</strong> <span style="color: ${riskColor}; font-weight: bold;">${riskLevel.toUpperCase()}</span></p>
            ${person.territory ? `<p><strong>Território:</strong> ${person.territory}</p>` : ''}
            ${person.expected_connections ? `<p><strong>Conexões Esperadas:</strong> ${person.expected_connections}</p>` : ''}
        `;
        
        this.nodeInfoEl.innerHTML = html;
    }

    updateStats(peopleCount, connectionsCount) {
        this.peopleCountEl.textContent = peopleCount;
        this.connectionsCountEl.textContent = connectionsCount;
    }

    async handleSearch(query) {
        if (query.length < 2) {
            this.searchResultsEl.innerHTML = '';
            return;
        }
        
        try {
            // Importar ApiClient dinamicamente
            const apiModule = await import('./api.js');
            const results = await apiModule.ApiClient.searchPeople(query);
            this.searchResults = results;
            this.displaySearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
            this.searchResultsEl.innerHTML = '<p style="color: #ff4444;">Erro na busca</p>';
        }
    }

    displaySearchResults(results) {
        if (results.length === 0) {
            this.searchResultsEl.innerHTML = '<p>Nenhum resultado encontrado</p>';
            return;
        }
        
        this.searchResultsEl.innerHTML = results.map(person => {
            const isSelected = this.selectedUsersForComparison.some(u => u.id === person.id);
            return `
            <div class="search-result-item" data-id="${person.id}">
                ${person.name} ${person.email ? `(${person.email})` : ''}
                ${isSelected ? '<span class="selected-badge">✓ Selecionado</span>' : ''}
            </div>
        `;
        }).join('');
        
        // Adicionar event listeners aos resultados
        this.searchResultsEl.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const personId = parseInt(item.dataset.id);
                const person = results.find(p => p.id === personId);
                if (person) {
                    this.onPersonSelected(person);
                }
            });
        });
    }

    onPersonSelected(person) {
        this.updateNodeInfo(person);
        this.searchInput.value = person.name;
        this.searchResultsEl.innerHTML = '';
        
        // Disparar evento customizado
        const event = new CustomEvent('personSelected', { detail: person });
        document.dispatchEvent(event);
    }

    clearSearch() {
        this.searchInput.value = '';
        this.searchResultsEl.innerHTML = '';
    }

    // Métodos de comparação
    addUserToComparison(person) {
        // Verificar se já está selecionado
        if (this.selectedUsersForComparison.some(u => u.id === person.id)) {
            return;
        }

        this.selectedUsersForComparison.push(person);
        this.updateSelectedUsersList();
        this.updateCompareButton();
    }

    removeUserFromComparison(userId) {
        this.selectedUsersForComparison = this.selectedUsersForComparison.filter(u => u.id !== userId);
        this.updateSelectedUsersList();
        this.updateCompareButton();
    }

    updateSelectedUsersList() {
        if (this.selectedUsersForComparison.length === 0) {
            this.selectedUsersListEl.innerHTML = '<p class="empty-message">Nenhum usuário selecionado</p>';
            return;
        }

        this.selectedUsersListEl.innerHTML = this.selectedUsersForComparison.map(user => `
            <div class="selected-user-item">
                <span>${user.name}</span>
                <button class="remove-user-btn" data-id="${user.id}">×</button>
            </div>
        `).join('');

        // Adicionar event listeners aos botões de remover
        this.selectedUsersListEl.querySelectorAll('.remove-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = parseInt(e.target.dataset.id);
                this.removeUserFromComparison(userId);
            });
        });
    }

    updateCompareButton() {
        this.compareBtn.disabled = this.selectedUsersForComparison.length < 2;
    }

    async askChatbot() {
        if (!this.aiQueryInput || !this.aiResponseEl || !this.aiQueryButton) {
            return;
        }

        const question = this.aiQueryInput.value.trim();

        if (question.length === 0) {
            this.aiResponseEl.classList.add('empty-message');
            this.aiResponseEl.innerHTML = 'Digite uma pergunta para o chatbot.';
            return;
        }

        if (this.selectedUsersForComparison.length === 0) {
            this.aiResponseEl.classList.add('empty-message');
            this.aiResponseEl.innerHTML = 'Selecione pelo menos dois usuários antes de consultar o chatbot.';
            return;
        }

        const originalLabel = this.aiQueryButton.textContent;
        this.aiQueryButton.disabled = true;
        this.aiQueryButton.textContent = 'Consultando...';

        // Simular pequena latência enquanto a IA não está integrada
        await new Promise(resolve => setTimeout(resolve, 400));

        const names = this.selectedUsersForComparison.map(u => u.name).join(', ');
        const timeLabel = this.currentTime
            ? this.currentTime.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
            : 'momento selecionado';

        const safeQuestion = this.escapeHtml(question);
        const safeNames = this.escapeHtml(names);

        const response = `
            <div class="ai-response-bubble">
                <p class="ai-question"><strong>Você:</strong> ${safeQuestion}</p>
                <p><strong>Chatbot:</strong> Quando a integração de IA estiver ativa, esta pergunta será analisada considerando os vínculos entre <em>${safeNames}</em> no período <em>${timeLabel}</em>. O assistente combinará dados contextuais e sinais externos para sugerir hipóteses e próximos passos complementares.</p>
                <p class="ai-insight">Enquanto isso, utilize os resultados da comparação para identificar conexões comuns, lacunas e eventos críticos antes de consultar a IA.</p>
                <p class="ai-disclaimer">*Protótipo: esta área será conectada a um serviço de IA em uma entrega futura.*</p>
            </div>
        `;

        this.aiResponseEl.classList.remove('empty-message');
        this.aiResponseEl.innerHTML = response;

        this.aiQueryButton.disabled = false;
        this.aiQueryButton.textContent = originalLabel;
    }

    async performComparison() {
        if (this.selectedUsersForComparison.length < 2) {
            return;
        }

        this.compareBtn.disabled = true;
        this.compareBtn.textContent = 'Comparando...';

        try {
            const apiModule = await import('./api.js');
            const userIds = this.selectedUsersForComparison.map(u => u.id);
            const endTime = this.currentTime ? this.currentTime.toISOString() : null;
            
            const comparison = await apiModule.ApiClient.compareUserLinks(userIds, endTime);
            this.displayComparisonResults(comparison);
        } catch (error) {
            console.error('Comparison error:', error);
            this.comparisonResultsEl.innerHTML = '<p style="color: #ff4444;">Erro ao comparar vínculos</p>';
        } finally {
            this.compareBtn.disabled = false;
            this.compareBtn.textContent = 'Comparar';
        }
    }

    displayComparisonResults(comparison) {
        const { users, common_connections, unique_connections, stats } = comparison;

        let html = '<div class="comparison-summary">';
        html += '<h4>Resumo da Comparação</h4>';
        html += `<p><strong>Conexões Comuns:</strong> ${stats.total_common}</p>`;
        html += `<p><strong>Total de Conexões Únicas:</strong> ${stats.total_unique}</p>`;
        html += '</div>';

        // Estatísticas por usuário
        html += '<div class="comparison-stats">';
        html += '<h4>Estatísticas por Usuário</h4>';
        users.forEach(user => {
            const userStats = stats.per_user[user.id];
            html += `
                <div class="user-stats-item">
                    <strong>${user.name}</strong>
                    <ul>
                        <li>Total de conexões: ${userStats.total_connections}</li>
                        <li>Conexões únicas: ${userStats.unique_connections}</li>
                        <li>Conexões comuns: ${userStats.common_connections}</li>
                    </ul>
                </div>
            `;
        });
        html += '</div>';

        // Conexões comuns
        if (common_connections.length > 0) {
            html += '<div class="common-connections">';
            html += '<h4>Conexões Comuns</h4>';
            html += '<ul class="connections-list">';
            common_connections.forEach(conn => {
                html += `<li>${conn.person_name}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        } else {
            html += '<div class="common-connections">';
            html += '<h4>Conexões Comuns</h4>';
            html += '<p class="empty-message">Nenhuma conexão comum encontrada</p>';
            html += '</div>';
        }

        // Conexões únicas por usuário
        html += '<div class="unique-connections">';
        html += '<h4>Conexões Únicas</h4>';
        users.forEach(user => {
            const unique = unique_connections[user.id] || [];
            if (unique.length > 0) {
                html += `<div class="user-unique-connections">`;
                html += `<strong>${user.name}:</strong>`;
                html += '<ul class="connections-list">';
                unique.forEach(conn => {
                    html += `<li>${conn.person_name}</li>`;
                });
                html += '</ul>';
                html += '</div>';
            } else {
                html += `<div class="user-unique-connections">`;
                html += `<strong>${user.name}:</strong> <span class="empty-message">Nenhuma conexão única</span>`;
                html += '</div>';
            }
        });
        html += '</div>';

        this.comparisonResultsEl.innerHTML = html;
    }

    clearComparison() {
        this.selectedUsersForComparison = [];
        this.updateSelectedUsersList();
        this.updateCompareButton();
        this.comparisonResultsEl.innerHTML = '';

        if (this.aiResponseEl) {
            this.aiResponseEl.classList.add('empty-message');
            this.aiResponseEl.innerHTML = this.defaultAIMessage;
        }
    }

    setCurrentTime(time) {
        this.currentTime = time;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

