
import { GoogleGenAI, Type } from "@google/genai";
import { Reading, ReadingInterpretation, Rune, Spread, PatternAnalysis, SelectedRune } from '../types.ts';

export const getReadingInterpretation = async (runes: SelectedRune[], spread: Spread, apiKey: string): Promise<ReadingInterpretation> => {
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `You are Runecast, an expert in Norse mythology and the Elder Futhark runes. Your voice is wise and accessible, using plain English while weaving in relevant Norse context (like mentioning gods or concepts associated with the runes) to add authenticity. Avoid overly academic or archaic language.

A user has performed a rune reading.
The chosen spread is: "${spread.name}".
The runes pulled are:
${runes.map((selectedRune, index) => {
    const { runeName, orientation } = selectedRune;
    return `${index + 1}. ${runeName} (${orientation})`;
}).join('\n')}

Based on this information, perform the following tasks:
1. For each rune pulled, provide a brief, contextual summary of its meaning in this specific reading, considering its position and orientation.
2. Provide a holistic, professional-level interpretation of what the runes mean as a whole, synthesizing their individual messages into a single, coherent narrative.
3. Generate 3-5 thoughtful, open-ended reflective questions to help the user connect this reading to their life.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        individualRunes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    runeName: { type: Type.STRING },
                                    orientation: { type: Type.STRING },
                                    summary: { type: Type.STRING, description: "A brief, contextual summary of what this specific rune means in the reading." }
                                },
                                required: ["runeName", "orientation", "summary"]
                            },
                            description: "An array of interpretations for each individual rune pulled."
                        },
                        summary: {
                            type: Type.STRING,
                            description: "A holistic interpretation of the runes as a set, considering their orientations and the spread."
                        },
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING
                            },
                            description: "An array of 3-5 reflective questions based on the reading."
                        }
                    },
                    required: ["individualRunes", "summary", "questions"]
                }
            }
        });

        const jsonStr = response.text.trim();
        const data = JSON.parse(jsonStr);
        return data as ReadingInterpretation;
    } catch (error) {
        console.error("Error getting reading interpretation from Gemini:", error);
        return {
            summary: "An error occurred while interpreting the runes. Please check your API key and network connection. You can reset your API key in the Settings.",
            questions: ["How can you approach this situation with a fresh perspective?"],
            individualRunes: runes.map(r => ({ runeName: r.runeName, orientation: r.orientation, summary: "Could not retrieve interpretation." }))
        };
    }
};

export const getPatternAnalysis = async (readings: Reading[], apiKey: string): Promise<PatternAnalysis> => {
    const ai = new GoogleGenAI({ apiKey });
    
    const readingHistory = readings.map(r => ({
        date: r.date,
        spread: r.spread.name,
        runes: r.runes.map(selectedRune => `${selectedRune.runeName} (${selectedRune.orientation})`)
    }));
    
    const prompt = `You are Runecast, an expert in Norse mythology and the Elder Futhark runes.
You will be given a history of a user's past rune readings. Your task is to analyze this history for patterns and recurring themes, paying attention to the orientation (upright/reversed) of the runes.

Here is the reading history as a JSON object:
${JSON.stringify(readingHistory, null, 2)}

Analyze the data and provide:
1.  **Frequent Runes**: A list of runes that appear most often (you can combine upright and reversed for counting, but mention the orientation's significance). Provide a brief interpretation of what their repeated appearance might signify.
2.  **Recurring Themes**: Identify any overarching themes or messages that emerge from the readings as a whole (e.g., themes of transformation, conflict, new beginnings, repeated reversed runes suggesting blockages).
3.  **Overall Summary**: A concluding summary of the patterns you've observed and what insights they might offer the user.`;

     try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        frequentRunes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    runeName: { type: Type.STRING },
                                    count: { type: Type.INTEGER },
                                    interpretation: { type: Type.STRING }
                                },
                                required: ["runeName", "count", "interpretation"]
                            },
                            description: "An array of frequently appearing runes with their count and interpretation of their recurrence (including orientation significance)."
                        },
                        recurringThemes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING
                            },
                            description: "An array of strings describing recurring themes, considering rune orientations."
                        },
                        overallSummary: {
                            type: Type.STRING,
                            description: "A concluding summary of the observed patterns."
                        }
                    },
                    required: ["frequentRunes", "recurringThemes", "overallSummary"]
                }
            }
        });
        
        const jsonStr = response.text.trim();
        const data = JSON.parse(jsonStr);
        return data as PatternAnalysis;
    } catch (error) {
        console.error("Error getting pattern analysis from Gemini:", error);
        return {
            frequentRunes: [],
            recurringThemes: ["Could not analyze patterns due to an error."],
            overallSummary: "There was an issue connecting to the analysis service. Please check your API key and try again. You can reset your API key in the Settings."
        };
    }
};