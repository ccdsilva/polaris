import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import DatabaseQueries from './database/queries.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Instância do banco de dados
const db = new DatabaseQueries();

// Endpoint: Listar todas as pessoas
app.get('/api/people', (req, res) => {
    try {
        const people = db.getAllPeople();
        res.json(people);
    } catch (error) {
        console.error('Error fetching people:', error);
        res.status(500).json({ error: 'Failed to fetch people' });
    }
});

// Endpoint: Buscar pessoa por ID
app.get('/api/people/:id', (req, res) => {
    try {
        const person = db.getPersonById(parseInt(req.params.id));
        if (!person) {
            return res.status(404).json({ error: 'Person not found' });
        }
        res.json(person);
    } catch (error) {
        console.error('Error fetching person:', error);
        res.status(500).json({ error: 'Failed to fetch person' });
    }
});

// Endpoint: Buscar pessoas por nome
app.get('/api/people/search/:query', (req, res) => {
    try {
        const people = db.searchPeople(req.params.query);
        res.json(people);
    } catch (error) {
        console.error('Error searching people:', error);
        res.status(500).json({ error: 'Failed to search people' });
    }
});

// Endpoint: Buscar relacionamentos em um período de tempo
app.get('/api/relationships', (req, res) => {
    try {
        const { start, end } = req.query;
        
        if (!end) {
            return res.status(400).json({ error: 'end parameter is required' });
        }

        let relationships;
        if (start) {
            relationships = db.getRelationshipsInTimeRange(start, end);
        } else {
            // Se não há start, buscar todos até end
            relationships = db.getRelationshipsUpToTime(end);
        }

        res.json(relationships);
    } catch (error) {
        console.error('Error fetching relationships:', error);
        res.status(500).json({ error: 'Failed to fetch relationships' });
    }
});

// Endpoint: Estatísticas de relacionamentos
app.get('/api/stats', (req, res) => {
    try {
        const { start, end } = req.query;
        
        if (!end) {
            return res.status(400).json({ error: 'end parameter is required' });
        }

        const stats = db.getRelationshipStats(start || '1970-01-01', end);
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Endpoint: Range de tempo disponível
app.get('/api/time-range', (req, res) => {
    try {
        const timeRange = db.getTimeRange();
        res.json(timeRange);
    } catch (error) {
        console.error('Error fetching time range:', error);
        res.status(500).json({ error: 'Failed to fetch time range' });
    }
});

// Endpoint: Eventos em um período
app.get('/api/events', (req, res) => {
    try {
        const { start, end } = req.query;
        
        if (!start || !end) {
            return res.status(400).json({ error: 'start and end parameters are required' });
        }

        const events = db.getEventsInTimeRange(start, end);
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Rota padrão - servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Frontend served from: ${frontendPath}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    db.close();
    process.exit(0);
});
