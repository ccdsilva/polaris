const API_BASE = 'http://localhost:3000/api';

export class ApiClient {
    static async getPeople() {
        const response = await fetch(`${API_BASE}/people`);
        if (!response.ok) throw new Error('Failed to fetch people');
        return await response.json();
    }

    static async getPersonById(id) {
        const response = await fetch(`${API_BASE}/people/${id}`);
        if (!response.ok) throw new Error('Failed to fetch person');
        return await response.json();
    }

    static async searchPeople(query) {
        const response = await fetch(`${API_BASE}/people/search/${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Failed to search people');
        return await response.json();
    }

    static async getRelationships(startTime, endTime) {
        let url = `${API_BASE}/relationships?end=${encodeURIComponent(endTime)}`;
        if (startTime) {
            url += `&start=${encodeURIComponent(startTime)}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch relationships');
        return await response.json();
    }

    static async getStats(startTime, endTime) {
        let url = `${API_BASE}/stats?end=${encodeURIComponent(endTime)}`;
        if (startTime) {
            url += `&start=${encodeURIComponent(startTime)}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch stats');
        return await response.json();
    }

    static async getTimeRange() {
        const response = await fetch(`${API_BASE}/time-range`);
        if (!response.ok) throw new Error('Failed to fetch time range');
        return await response.json();
    }

    static async getEvents(startTime, endTime) {
        const response = await fetch(
            `${API_BASE}/events?start=${encodeURIComponent(startTime)}&end=${encodeURIComponent(endTime)}`
        );
        if (!response.ok) throw new Error('Failed to fetch events');
        return await response.json();
    }

    static async compareUserLinks(userIds, endTime = null) {
        const userIdsParam = Array.isArray(userIds) ? userIds.join(',') : userIds;
        let url = `${API_BASE}/compare-links?userIds=${encodeURIComponent(userIdsParam)}`;
        if (endTime) {
            url += `&end=${encodeURIComponent(endTime)}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to compare user links');
        return await response.json();
    }
}

