import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data/database.json');

class JSONDatabase {
    constructor() {
        this.data = {
            people: [],
            relationships: [],
            events: []
        };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(dbPath)) {
                const content = fs.readFileSync(dbPath, 'utf8');
                this.data = JSON.parse(content);
            }
        } catch (error) {
            console.error('Error loading database:', error);
            this.data = { people: [], relationships: [], events: [] };
        }
    }

    save() {
        try {
            const dbDir = path.dirname(dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving database:', error);
            throw error;
        }
    }

    // People methods
    getAllPeople() {
        return this.data.people;
    }

    getPersonById(id) {
        return this.data.people.find(p => p.id === id);
    }

    searchPeople(query) {
        const searchQuery = query.toLowerCase();
        return this.data.people
            .filter(p => 
                p.name.toLowerCase().includes(searchQuery) ||
                (p.email && p.email.toLowerCase().includes(searchQuery))
            )
            .slice(0, 20);
    }

    // Relationships methods
    getRelationshipsInTimeRange(startTime, endTime) {
        return this.data.relationships
            .filter(r => {
                const start = new Date(r.start_time);
                const end = r.end_time ? new Date(r.end_time) : new Date('9999-12-31');
                const queryStart = new Date(startTime);
                const queryEnd = new Date(endTime);
                
                return start <= queryEnd && end >= queryStart && start <= queryEnd;
            })
            .map(r => {
                const p1 = this.getPersonById(r.person1_id);
                const p2 = this.getPersonById(r.person2_id);
                return {
                    ...r,
                    person1_name: p1?.name || 'Unknown',
                    person2_name: p2?.name || 'Unknown'
                };
            });
    }

    getRelationshipsUpToTime(endTime) {
        const queryEnd = new Date(endTime);
        return this.data.relationships
            .filter(r => {
                const start = new Date(r.start_time);
                const end = r.end_time ? new Date(r.end_time) : new Date('9999-12-31');
                return start <= queryEnd && end >= queryEnd;
            })
            .map(r => {
                const p1 = this.getPersonById(r.person1_id);
                const p2 = this.getPersonById(r.person2_id);
                return {
                    ...r,
                    person1_name: p1?.name || 'Unknown',
                    person2_name: p2?.name || 'Unknown'
                };
            });
    }

    getRelationshipStats(startTime, endTime) {
        const start = startTime ? new Date(startTime) : new Date('1970-01-01');
        const end = new Date(endTime);
        
        const relationships = this.data.relationships.filter(r => {
            const rStart = new Date(r.start_time);
            const rEnd = r.end_time ? new Date(r.end_time) : new Date('9999-12-31');
            return rStart <= end && rEnd >= start;
        });

        const uniquePeople = new Set();
        relationships.forEach(r => {
            uniquePeople.add(r.person1_id);
            uniquePeople.add(r.person2_id);
        });

        return {
            total_relationships: relationships.length,
            unique_people: uniquePeople.size
        };
    }

    getTimeRange() {
        if (this.data.relationships.length === 0) {
            return { min_time: null, max_time: null };
        }

        const times = this.data.relationships.flatMap(r => {
            const start = new Date(r.start_time);
            const end = r.end_time ? new Date(r.end_time) : start;
            return [start, end];
        });

        const minTime = new Date(Math.min(...times.map(t => t.getTime())));
        const maxTime = new Date(Math.max(...times.map(t => t.getTime())));

        return {
            min_time: minTime.toISOString(),
            max_time: maxTime.toISOString()
        };
    }

    getEventsInTimeRange(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        return this.data.events
            .filter(e => {
                const eventTime = new Date(e.event_time);
                return eventTime >= start && eventTime <= end;
            })
            .map(e => {
                const person = this.getPersonById(e.person_id);
                return {
                    ...e,
                    person_name: person?.name || 'Unknown'
                };
            });
    }

    // Admin methods for data generation
    clearAll() {
        this.data = { people: [], relationships: [], events: [] };
        this.save();
    }

    addPerson(person) {
        const id = this.data.people.length > 0 
            ? Math.max(...this.data.people.map(p => p.id)) + 1 
            : 1;
        const newPerson = { ...person, id };
        this.data.people.push(newPerson);
        return newPerson;
    }

    addRelationship(relationship) {
        const id = this.data.relationships.length > 0
            ? Math.max(...this.data.relationships.map(r => r.id)) + 1
            : 1;
        const newRel = { ...relationship, id };
        this.data.relationships.push(newRel);
        return newRel;
    }

    addEvent(event) {
        const id = this.data.events.length > 0
            ? Math.max(...this.data.events.map(e => e.id)) + 1
            : 1;
        const newEvent = { ...event, id };
        this.data.events.push(newEvent);
        return newEvent;
    }

    close() {
        this.save();
    }
}

export default JSONDatabase;

