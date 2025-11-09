import { Reading } from '../types';
import { ELDER_FUTHARK } from '../constants';

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

export const exportReadingsAsMarkdown = (): void => {
    const readings = getReadings();
    if (readings.length === 0) {
        alert("No readings to export.");
        return;
    }

    let markdownContent = `# Runecast Reading History\n\nExported on: ${new Date().toLocaleDateString()}\n\n`;

    readings.forEach(reading => {
        markdownContent += `---\n\n`;
        markdownContent += `## Reading on: ${new Date(reading.date).toLocaleString()}\n\n`;
        markdownContent += `- **Spread:** ${reading.spread.name}\n`;
        markdownContent += `- **Runes:** ${reading.runes.map(r => `${r.runeName} (${r.orientation})`).join(', ')}\n\n`;
        markdownContent += `### Meanings\n`;
        reading.runes.forEach(r => {
            const rune = ELDER_FUTHARK.find(fRune => fRune.name === r.runeName);
            if (rune) {
                const meaning = r.orientation === 'upright' ? rune.meaning : rune.reversedMeaning;
                markdownContent += `- **${r.runeName} (${r.orientation}):** ${meaning}\n`;
            }
        });
        markdownContent += `\n`;
        markdownContent += `### Summary\n${reading.summary}\n\n`;
        markdownContent += `### Reflective Questions\n`;
        reading.questions.forEach(q => {
            markdownContent += `- ${q}\n`;
        });
        markdownContent += `\n`;
    });

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `runecast_history_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};