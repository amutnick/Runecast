
import React, { useState, useEffect, useMemo } from 'react';
import { View, Spread, Rune, Reading, ReadingInterpretation, PatternAnalysis, SelectedRune } from './types';
import { ELDER_FUTHARK, SPREADS } from './constants';
import * as storage from './services/storageService';
import * as gemini from './services/geminiService';
import Header from './components/Header';
import RuneDisplay from './components/RuneDisplay';

// Helper function to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  return array.map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
};


const App: React.FC = () => {
    const [view, setView] = useState<View>('home');
    const [readings, setReadings] = useState<Reading[]>([]);
    const [retentionDays, setRetentionDays] = useState<number>(90); // Default to 90 days

    // State for new reading flow
    const [readingMode, setReadingMode] = useState<'physical' | 'virtual' | null>(null);
    const [currentSpread, setCurrentSpread] = useState<Spread | null>(null);
    const [selectedRunes, setSelectedRunes] = useState<SelectedRune[]>([]);
    const [shuffledRunes, setShuffledRunes] = useState<Rune[]>([]);
    const [readingResult, setReadingResult] = useState<Reading | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeRuneForSelection, setActiveRuneForSelection] = useState<Rune | null>(null);
    
    // State for analysis
    const [analysis, setAnalysis] = useState<PatternAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        setReadings(storage.getReadings());
        const savedRetention = localStorage.getItem('runecast_retention');
        if (savedRetention) {
            setRetentionDays(parseInt(savedRetention, 10));
        }
    }, []);

    const handleSelectReadingMode = (mode: 'physical' | 'virtual') => {
        setReadingMode(mode);
    };

    const handleSelectSpread = (spread: Spread) => {
        setCurrentSpread(spread);
        setSelectedRunes([]);
        setReadingResult(null);
        setShuffledRunes(shuffleArray(ELDER_FUTHARK));
    };
    
    const handleSelectRune = (rune: Rune) => {
        if (!currentSpread || selectedRunes.length >= currentSpread.runeCount) return;
        if (selectedRunes.some(r => r.runeName === rune.name)) return;
        
        const isReversible = rune.meaning !== rune.reversedMeaning;

        if (readingMode === 'virtual') {
            const orientation = isReversible && Math.random() < 0.5 ? 'reversed' : 'upright';
            setSelectedRunes(prev => [...prev, { runeName: rune.name, orientation }]);
        } else { // physical mode
            if (isReversible) {
                setActiveRuneForSelection(rune);
            } else {
                // For non-reversible runes, add directly as upright
                setSelectedRunes(prev => [...prev, { runeName: rune.name, orientation: 'upright' }]);
            }
        }
    };

    const handleConfirmRune = (orientation: 'upright' | 'reversed') => {
        if (!activeRuneForSelection) return;
        
        setSelectedRunes(prev => [...prev, { runeName: activeRuneForSelection.name, orientation }]);
        setActiveRuneForSelection(null);
    }

    const handleReadingComplete = async () => {
        if (!currentSpread) return;
        setIsLoading(true);
        try {
            const interpretation: ReadingInterpretation = await gemini.getReadingInterpretation(selectedRunes, currentSpread);
            const newReading: Reading = {
                id: Date.now(),
                date: new Date().toISOString(),
                spread: currentSpread,
                runes: selectedRunes,
                ...interpretation
            };
            setReadingResult(newReading);
        } catch (error) {
            console.error("Failed to get reading interpretation", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (currentSpread && selectedRunes.length === currentSpread.runeCount) {
            handleReadingComplete();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRunes, currentSpread]);

    const saveCurrentReading = () => {
        if (!readingResult) return;
        storage.saveReading(readingResult);
        setReadings(storage.getReadings());
        resetReadingFlow();
    };
    
    const resetReadingFlow = () => {
        setCurrentSpread(null);
        setSelectedRunes([]);
        setReadingResult(null);
        setReadingMode(null);
    };

    const handlePruneReadings = () => {
        storage.pruneReadings(retentionDays);
        setReadings(storage.getReadings());
        alert(`Reading history older than ${retentionDays} days has been cleared.`);
    };

    const handleSetRetention = (days: number) => {
        setRetentionDays(days);
        localStorage.setItem('runecast_retention', days.toString());
    };

    const handleGenerateAnalysis = async () => {
        setIsAnalyzing(true);
        setAnalysis(null);
        const result = await gemini.getPatternAnalysis(readings);
        setAnalysis(result);
        setIsAnalyzing(false);
    };

    const renderHome = () => {
        if (isLoading) {
            return <LoadingView message="The runes are being cast. Awaiting insight..." />;
        }
        if (readingResult) {
            return <ReadingResultView result={readingResult} onSave={saveCurrentReading} onDiscard={resetReadingFlow} />;
        }
        if (currentSpread && readingMode) {
            return (
                <>
                    <SelectRunesView 
                        spread={currentSpread} 
                        selectedRunes={selectedRunes} 
                        onSelectRune={handleSelectRune} 
                        shuffledRunes={shuffledRunes} 
                        onReset={resetReadingFlow} 
                        readingMode={readingMode}
                    />
                    {activeRuneForSelection && (
                        <OrientationSelectionModal 
                            rune={activeRuneForSelection}
                            onConfirm={handleConfirmRune}
                            onCancel={() => setActiveRuneForSelection(null)}
                        />
                    )}
                </>
            );
        }
        if (readingMode) {
            return <SelectSpreadView onSelectSpread={handleSelectSpread} onBack={() => setReadingMode(null)} />;
        }
        return <SelectReadingModeView onSelectMode={handleSelectReadingMode} />;
    };
    
    const renderContent = () => {
        switch (view) {
            case 'home':
                return renderHome();
            case 'history':
                return <HistoryView readings={readings} />;
            case 'analysis':
                return <AnalysisView readings={readings} analysis={analysis} isAnalyzing={isAnalyzing} onGenerate={handleGenerateAnalysis} />;
            case 'about':
                return <AboutView />;
            case 'settings':
                return <SettingsView 
                    retentionDays={retentionDays}
                    onSetRetention={handleSetRetention}
                    onPrune={handlePruneReadings}
                    onExport={storage.exportReadingsAsMarkdown}
                />;
            default:
                return renderHome();
        }
    };
    
    return (
        <div className="min-h-screen bg-slate-900">
            <Header currentView={view} setView={setView} />
            <main className="container mx-auto p-4 md:p-8">
                {renderContent()}
            </main>
        </div>
    );
};


// Sub-components for views to keep App.tsx cleaner

const SelectReadingModeView: React.FC<{onSelectMode: (mode: 'physical' | 'virtual') => void}> = ({ onSelectMode }) => (
    <div className="text-center animate-fade-in">
        <h2 className="text-3xl md:text-4xl text-amber-200 font-display mb-2">Begin a Reading</h2>
        <p className="text-slate-400 mb-8 max-w-2xl mx-auto">Are you using your own physical runes or would you like to draw from our virtual pouch?</p>
        <div className="flex flex-col md:flex-row justify-center gap-6 max-w-2xl mx-auto">
            <button onClick={() => onSelectMode('physical')} className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-lg border-2 border-slate-700 hover:border-amber-400 shadow-lg hover:shadow-amber-900/50 transition-all duration-300 text-left transform hover:-translate-y-1 flex-1">
                <h3 className="text-2xl font-display text-amber-300">Physical Reading</h3>
                <p className="text-slate-400 mt-2">I have my own set of runes. I will select the ones I've drawn.</p>
            </button>
            <button onClick={() => onSelectMode('virtual')} className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-lg border-2 border-slate-700 hover:border-amber-400 shadow-lg hover:shadow-amber-900/50 transition-all duration-300 text-left transform hover:-translate-y-1 flex-1">
                <h3 className="text-2xl font-display text-amber-300">Virtual Reading</h3>
                <p className="text-slate-400 mt-2">Draw runes from a shuffled virtual pouch for a digital reading.</p>
            </button>
        </div>
    </div>
);

const OrientationSelectionModal: React.FC<{
    rune: Rune;
    onConfirm: (orientation: 'upright' | 'reversed') => void;
    onCancel: () => void;
}> = ({ rune, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 max-w-md w-full text-center relative shadow-2xl shadow-amber-900/20">
            <button onClick={onCancel} className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-2xl font-display text-amber-200 mb-4">Choose Orientation for {rune.name}</h3>
            <div className="flex justify-center gap-8 mb-6">
                <div className="flex flex-col items-center">
                    <RuneDisplay rune={rune} orientation="upright" className="w-24"/>
                    <button onClick={() => onConfirm('upright')} className="mt-4 px-6 py-2 bg-amber-500 text-slate-900 font-bold rounded-full hover:bg-amber-400 transition">Upright</button>
                </div>
                <div className="flex flex-col items-center">
                    <RuneDisplay rune={rune} orientation="reversed" className="w-24"/>
                    <button onClick={() => onConfirm('reversed')} className="mt-4 px-6 py-2 bg-slate-600 text-slate-100 font-bold rounded-full hover:bg-slate-500 transition">Reversed</button>
                </div>
            </div>
        </div>
    </div>
);


const SelectSpreadView: React.FC<{
    onSelectSpread: (spread: Spread) => void;
    onBack: () => void;
}> = ({ onSelectSpread, onBack }) => (
    <div className="text-center animate-fade-in">
        <h2 className="text-3xl md:text-4xl text-amber-200 font-display mb-2">Choose a Spread</h2>
        <p className="text-slate-400 mb-6 max-w-2xl mx-auto">Each spread offers a different level of depth for your reading.</p>
        <button onClick={onBack} className="mb-8 text-sm text-amber-400 hover:text-amber-200">&larr; Change reading type</button>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {SPREADS.map(spread => (
                <button key={spread.name} onClick={() => onSelectSpread(spread)} className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-lg border-2 border-slate-700 hover:border-amber-400 shadow-lg hover:shadow-amber-900/50 transition-all duration-300 text-left transform hover:-translate-y-1">
                    <h3 className="text-2xl font-display text-amber-300">{spread.name}</h3>
                    <p className="text-slate-400 mt-2">{spread.description}</p>
                </button>
            ))}
        </div>
    </div>
);

const SelectRunesView: React.FC<{
    spread: Spread; 
    selectedRunes: SelectedRune[]; 
    onSelectRune: (rune: Rune) => void;
    shuffledRunes: Rune[];
    onReset: () => void;
    readingMode: 'physical' | 'virtual';
}> = ({ spread, selectedRunes, onSelectRune, shuffledRunes, onReset, readingMode }) => {
    const selectedRuneNames = useMemo(() => new Set(selectedRunes.map(r => r.runeName)), [selectedRunes]);

    const displayRunes = useMemo(() => {
        if (readingMode === 'physical') {
            return [...ELDER_FUTHARK].sort((a, b) => a.name.localeCompare(b.name));
        }
        return shuffledRunes;
    }, [readingMode, shuffledRunes]);
    
    return (
        <div className="animate-fade-in">
            <div className="text-center mb-8">
                <h2 className="text-3xl text-amber-200 font-display">
                    {readingMode === 'physical' ? 'Record Your Runes' : 'Cast your Runes'}
                </h2>
                <p className="text-slate-400">Select {spread.runeCount - selectedRunes.length} more rune{spread.runeCount - selectedRunes.length !== 1 ? 's' : ''}.</p>
                <button onClick={onReset} className="mt-2 text-sm text-amber-400 hover:text-amber-200">&larr; Start Over</button>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
                {displayRunes.map(rune => {
                    const isSelected = selectedRuneNames.has(rune.name);
                    const selectedRuneData = isSelected ? selectedRunes.find(r => r.runeName === rune.name) : null;
                    const isFaceDown = readingMode === 'virtual' && !isSelected;

                    return (
                        <RuneDisplay 
                            key={rune.name}
                            rune={rune}
                            isFaceDown={isFaceDown}
                            isSelected={isSelected}
                            onClick={() => !isSelected && onSelectRune(rune)}
                            orientation={selectedRuneData?.orientation}
                        />
                    );
                })}
            </div>
        </div>
    );
};

const ReadingResultView: React.FC<{result: Reading; onSave: () => void; onDiscard: () => void; isJournalView?: boolean}> = ({ result, onSave, onDiscard, isJournalView = false }) => (
    <div className="max-w-4xl mx-auto">
        <h2 className="text-center text-3xl text-amber-200 font-display mb-8 animate-fade-in-stagger">{result.spread.name} Reading</h2>

        <div className="space-y-8 mb-8">
            {result.runes.map((selectedRune, index) => {
                const rune = ELDER_FUTHARK.find(r => r.name === selectedRune.runeName);
                if (!rune) return null;

                const interpretation = result.individualRunes?.find(ir => ir.runeName === selectedRune.runeName);
                return (
                    <div 
                        key={selectedRune.runeName} 
                        className="flex flex-col md:flex-row items-center gap-6 animate-fade-in-stagger"
                        style={{animationDelay: `${index * 200}ms`}}
                    >
                        <div className="flex-shrink-0">
                            <RuneDisplay 
                                rune={rune} 
                                orientation={selectedRune.orientation} 
                                isGlowing={true} 
                            />
                        </div>
                        <div className="text-center md:text-left">
                            <h3 className="text-xl font-display text-amber-300">{rune.name} ({selectedRune.orientation})</h3>
                            <p className="text-slate-300 mt-1">{interpretation?.summary}</p>
                        </div>
                    </div>
                );
            })}
        </div>
        
        <div 
            className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-6 rounded-lg border border-slate-700 space-y-6 animate-fade-in-stagger"
            style={{animationDelay: `${result.runes.length * 200}ms`}}
        >
            <div>
                <h3 className="text-xl font-display text-amber-300 mb-2">Holistic Interpretation</h3>
                <p className="text-slate-300 whitespace-pre-wrap">{result.summary}</p>
            </div>
            <div>
                <h3 className="text-xl font-display text-amber-300 mb-2">Reflective Questions</h3>
                <ul className="list-disc list-inside space-y-2 text-slate-300">
                    {result.questions.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
            </div>
        </div>

        {!isJournalView && (
            <div 
                className="flex justify-center gap-4 mt-8 animate-fade-in-stagger"
                style={{animationDelay: `${(result.runes.length + 1) * 200}ms`}}
            >
                <button onClick={onSave} className="px-6 py-2 bg-amber-500 text-slate-900 font-bold rounded-full hover:bg-amber-400 transition">Save to Journal</button>
                <button onClick={onDiscard} className="px-6 py-2 bg-slate-700 text-slate-200 font-bold rounded-full hover:bg-slate-600 transition">Discard</button>
            </div>
        )}
    </div>
);


const LoadingView: React.FC<{message: string}> = ({ message }) => (
    <div className="text-center p-16 flex flex-col items-center justify-center animate-fade-in">
        <div className="w-16 h-16 border-4 border-amber-300 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl text-amber-200 font-display">{message}</p>
    </div>
);

const HistoryView: React.FC<{readings: Reading[]}> = ({ readings }) => {
    const [expandedId, setExpandedId] = useState<number | null>(null);

    if (readings.length === 0) {
        return <div className="text-center text-slate-400">Your journal is empty. Perform a new reading to begin your journey.</div>
    }

    return (
        <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
            <h2 className="text-3xl text-amber-200 font-display text-center mb-6">Reading History</h2>
            {readings.map(reading => (
                <div key={reading.id} className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-amber-900/20">
                    <button onClick={() => setExpandedId(expandedId === reading.id ? null : reading.id)} className="w-full p-4 text-left flex justify-between items-center">
                        <div>
                            <p className="font-bold text-amber-300">{new Date(reading.date).toLocaleString()}</p>
                            <p className="text-slate-400 text-sm">{reading.spread.name} - {reading.runes.map(r => r.runeName).join(', ')}</p>
                        </div>
                        <svg className={`w-6 h-6 text-slate-400 transition-transform ${expandedId === reading.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {expandedId === reading.id && (
                        <div className="bg-slate-900/70 p-4 md:p-6 border-t border-slate-700">
                             <ReadingResultView result={reading} onSave={() => {}} onDiscard={() => {}} isJournalView={true} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const AnalysisView: React.FC<{
    readings: Reading[], 
    analysis: PatternAnalysis | null, 
    isAnalyzing: boolean, 
    onGenerate: () => void
}> = ({ readings, analysis, isAnalyzing, onGenerate }) => {
    const MIN_READINGS_FOR_ANALYSIS = 5;

    if (readings.length < MIN_READINGS_FOR_ANALYSIS) {
        return <div className="text-center text-slate-400">You need at least {MIN_READINGS_FOR_ANALYSIS} readings in your history to generate a pattern analysis. Keep casting to uncover deeper insights.</div>
    }

    return (
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <h2 className="text-3xl text-amber-200 font-display mb-4">Pattern Analysis</h2>
            <p className="text-slate-400 mb-8">Uncover recurring themes and frequently pulled runes from your reading history.</p>
            <button onClick={onGenerate} disabled={isAnalyzing} className="px-8 py-3 bg-amber-500 text-slate-900 font-bold rounded-full hover:bg-amber-400 transition disabled:bg-slate-600 disabled:cursor-not-allowed">
                {isAnalyzing ? 'Analyzing...' : 'Generate Analysis'}
            </button>

            {isAnalyzing && <LoadingView message="Consulting the threads of fate for patterns..." />}
            
            {analysis && (
                <div className="mt-8 text-left bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-6 rounded-lg border border-slate-700 space-y-6 animate-fade-in">
                    <div>
                        <h3 className="text-xl font-display text-amber-300 mb-2">Overall Summary</h3>
                        <p className="text-slate-300 whitespace-pre-wrap">{analysis.overallSummary}</p>
                    </div>
                    <div>
                        <h3 className="text-xl font-display text-amber-300 mb-2">Recurring Themes</h3>
                        <ul className="list-disc list-inside space-y-2 text-slate-300">
                            {analysis.recurringThemes.map((theme, i) => <li key={i}>{theme}</li>)}
                        </ul>
                    </div>
                     <div>
                        <h3 className="text-xl font-display text-amber-300 mb-2">Frequent Runes</h3>
                        <div className="space-y-4">
                            {analysis.frequentRunes.map((item, i) => (
                                <div key={i} className="p-4 bg-slate-900/50 rounded-md border border-slate-700">
                                    <p className="font-bold text-amber-200">{item.runeName} (Pulled {item.count} times)</p>

                                    <p className="text-slate-400 text-sm mt-1">{item.interpretation}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const AboutView: React.FC = () => (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <h2 className="text-3xl md:text-4xl text-amber-200 font-display text-center mb-4">About the Runes</h2>
        <p className="text-slate-400 text-center mb-10 max-w-2xl mx-auto">The Elder Futhark is the oldest form of the runic alphabets. It consists of 24 runes, often arranged in three groups of eight called ættir, plus a blank rune representing the unknown.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ELDER_FUTHARK.map(rune => (
                <div key={rune.name} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex items-start gap-4 transition-colors hover:border-slate-600">
                    <div className="flex-shrink-0">
                        <RuneDisplay rune={rune} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-display text-amber-300">{rune.name}</h3>
                        <p className="font-semibold text-slate-300 text-sm">Keywords: {rune.keywords.join(', ')}</p>
                        <p className="mt-1 text-slate-400 text-sm">
                            <strong className="text-slate-300">Upright:</strong> {rune.meaning}
                        </p>
                        <p className="mt-1 text-slate-400 text-sm">
                             <strong className="text-slate-300">Reversed:</strong> {rune.reversedMeaning}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const SettingsView: React.FC<{
    retentionDays: number, 
    onSetRetention: (days: number) => void,
    onPrune: () => void,
    onExport: () => void
}> = ({ retentionDays, onSetRetention, onPrune, onExport }) => {
    const options = [{label: '30 Days', value: 30}, {label: '90 Days', value: 90}, {label: '1 Year', value: 365}, {label: 'All Time', value: -1}];

    return (
        <div className="max-w-xl mx-auto space-y-8 animate-fade-in">
            <h2 className="text-3xl text-amber-200 font-display text-center mb-6">Settings</h2>
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-6 rounded-lg border border-slate-700">
                <h3 className="text-xl font-display text-amber-300 mb-4">Data Management</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="retention" className="block text-sm font-medium text-slate-300 mb-2">Keep reading history for:</label>
                        <select
                            id="retention"
                            value={retentionDays}
                            onChange={(e) => onSetRetention(Number(e.target.value))}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <button onClick={onPrune} className="w-full px-4 py-2 bg-red-800 text-white font-bold rounded-md hover:bg-red-700 transition">
                        Clear Old Readings Now
                    </button>
                </div>
            </div>
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-6 rounded-lg border border-slate-700">
                <h3 className="text-xl font-display text-amber-300 mb-4">Export History</h3>
                <p className="text-slate-400 mb-4">Download your entire reading history as a Markdown file for your personal records.</p>
                <button onClick={onExport} className="w-full px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded-md hover:bg-amber-400 transition">
                    Export All Readings
                </button>
            </div>
        </div>
    );
};

export default App;
