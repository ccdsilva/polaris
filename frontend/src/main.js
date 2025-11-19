import { GraphRenderer } from './graph3d.js';
import { TimelineController } from './timeline.js';
import { UIController } from './ui.js';
import { ApiClient } from './api.js';

class App {
    constructor() {
        this.graphRenderer = null;
        this.timeline = null;
        this.ui = null;
        this.people = [];
        this.relationships = [];
        this.currentTime = null;
    }

    async init() {
        console.log('Initializing application...');

        // Inicializar UI
        this.ui = new UIController();

        // Inicializar gráfico 3D
        const container = document.getElementById('canvas-container');
        this.graphRenderer = new GraphRenderer(container);

        // Configurar callbacks do gráfico
        this.graphRenderer.onNodeClick = (person) => {
            this.ui.updateNodeInfo(person);
        };

        this.graphRenderer.onNodeHover = (person) => {
            // Opcional: mostrar info no hover
        };

        // Inicializar timeline
        this.timeline = new TimelineController(
            (time) => this.onTimeChange(time),
            (isPlaying) => this.onPlayPause(isPlaying)
        );

        // Event listener para seleção de pessoa na busca
        document.addEventListener('personSelected', (e) => {
            const person = e.detail;
            this.graphRenderer.highlightNode(person.id, true);
            
            // Focar câmera no nó automaticamente
            setTimeout(() => {
                this.graphRenderer.focusOnPerson(person.id);
            }, 300);
            
            // Remover highlight após alguns segundos
            setTimeout(() => {
                this.graphRenderer.highlightNode(person.id, false);
            }, 3000);
        });

        // Carregar dados iniciais
        await this.loadInitialData();
    }

    async loadInitialData() {
        try {
            console.log('Loading initial data...');

            // Carregar range de tempo
            const timeRange = await ApiClient.getTimeRange();
            if (timeRange.min_time && timeRange.max_time) {
                this.timeline.setTimeRange(timeRange.min_time, timeRange.max_time);
                this.currentTime = new Date(timeRange.min_time);
            }

            // Carregar todas as pessoas
            this.people = await ApiClient.getPeople();
            console.log(`Loaded ${this.people.length} people`);

            // Carregar relacionamentos até o tempo inicial
            if (this.currentTime) {
                this.ui.setCurrentTime(this.currentTime);
                await this.loadRelationshipsForTime(this.currentTime);
            }

            // Atualizar UI
            this.updateUI();
        } catch (error) {
            console.error('Error loading initial data:', error);
            alert('Erro ao carregar dados. Certifique-se de que o servidor está rodando.');
        }
    }

    async loadRelationshipsForTime(time) {
        try {
            const timeStr = time.toISOString();
            this.relationships = await ApiClient.getRelationships(null, timeStr);
            console.log(`Loaded ${this.relationships.length} relationships up to ${timeStr}`);

            // Atualizar gráfico
            this.graphRenderer.setData(this.people, this.relationships);

            // Atualizar estatísticas
            const stats = await ApiClient.getStats(null, timeStr);
            this.ui.updateStats(
                stats.unique_people || this.people.length,
                stats.total_relationships || this.relationships.length
            );
        } catch (error) {
            console.error('Error loading relationships:', error);
        }
    }

    async onTimeChange(time) {
        this.currentTime = time;
        this.ui.setCurrentTime(time);
        await this.loadRelationshipsForTime(time);
    }

    onPlayPause(isPlaying) {
        // Opcional: lógica adicional quando play/pause é acionado
        console.log(`Animation ${isPlaying ? 'playing' : 'paused'}`);
    }

    updateUI() {
        this.ui.updateStats(this.people.length, this.relationships.length);
    }
}

// Inicializar aplicação quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new App();
        app.init();
    });
} else {
    const app = new App();
    app.init();
}

