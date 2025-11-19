import JSONDatabase from './json_db.js';

function initDatabase() {
    const db = new JSONDatabase();
    
    try {
        // Limpar dados existentes
        db.clearAll();
        
        console.log('Database initialized successfully!');
        console.log('Using JSON-based storage (no compilation required)');
        
        // Verificar se há dados
        const peopleCount = db.getAllPeople().length;
        console.log(`Current people count: ${peopleCount}`);

    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    } finally {
        db.close();
    }
}

initDatabase();
