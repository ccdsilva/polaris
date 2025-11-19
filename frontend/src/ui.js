export class UIController {
    constructor() {
        this.nodeInfoEl = document.getElementById('node-info');
        this.peopleCountEl = document.getElementById('people-count');
        this.connectionsCountEl = document.getElementById('connections-count');
        this.searchInput = document.getElementById('search-input');
        this.searchResultsEl = document.getElementById('search-results');
        
        this.selectedPerson = null;
        this.searchResults = [];
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
    }

    updateNodeInfo(person) {
        this.selectedPerson = person;
        
        if (!person) {
            this.nodeInfoEl.innerHTML = '<p>Clique em um nó para ver detalhes</p>';
            return;
        }
        
        this.nodeInfoEl.innerHTML = `
            <p><strong>Nome:</strong> ${person.name}</p>
            <p><strong>Email:</strong> ${person.email || 'N/A'}</p>
            <p><strong>ID:</strong> ${person.id}</p>
        `;
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
        
        this.searchResultsEl.innerHTML = results.map(person => `
            <div class="search-result-item" data-id="${person.id}">
                ${person.name} ${person.email ? `(${person.email})` : ''}
            </div>
        `).join('');
        
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
}

