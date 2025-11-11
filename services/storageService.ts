
import { Reading } from '../types';

const STORAGE_KEY = 'runecast_readings';

export const getReadings = (): Reading[] => {
    try {
        const readingsJSON = localStorage.getItem(STORAGE_KEY);
        return readingsJSON ? JSON.parse(readingsJSON) : [];
    } catch (error) {
        console.error("Error retrieving readings from localStorage", error);
        return [];
    }
};

export const saveReading = (newReading: Reading): void => {
    const readings = getReadings();
    readings.unshift(newReading); // Add to the beginning
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
    } catch (error) {
        console.error("Error saving reading to localStorage", error);
    }
};

export const pruneReadings = (daysToKeep: number): void => {
    if (daysToKeep <= 0) return; // 0 or less means keep all
    const readings = getReadings();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const filteredReadings = readings.filter(reading => new Date(reading.date) >= cutoffDate);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredReadings));
    } catch (error) {
        console.error("Error pruning readings in localStorage", error);
    }
};
