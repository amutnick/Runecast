
import React, { useState, useEffect, useMemo, ReactNode } from 'react';
import { View, Spread, Rune, Reading, ReadingInterpretation, PatternAnalysis, SelectedRune } from './types.ts';
import { ELDER_FUTHARK, SPREADS } from './constants.tsx';
import * as storage from './services/storageService.ts';
import * as gemini from './services/geminiService.ts';
import Header from './components/Header.tsx';
import RuneDisplay from './components/RuneDisplay.tsx';
import MysticalParticles from './components/MysticalParticles.tsx';

// Helper function to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  return array.map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
};

const App: React.FC = () => {
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [isKeyChecked, setIsKeyChecked] = useState(false);
    
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
    const [isCompletingReading, setIsCompletingReading] = useState(false);
    const [activeRuneForSelection, setActiveRuneForSelection] = useState<Rune | null>(null);
    const [needsFocus, setNeedsFocus] = useState(false); // State for the new focus view
    const [showFocusMessage, setShowFocusMessage] = useState(true);
    
    // State for analysis
    const [analysis, setAnalysis] = useState<PatternAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // State for printing
    const [printingReadingId, setPrintingReadingId] = useState<number | null>(null);


    useEffect(() => {
        const key = process.env.API_KEY || localStorage.getItem('runecast_gemini_api_key');
        if (key) {
            setApiKey(key);
        }
        setIsKeyChecked(true);

        setReadings(storage.getReadings());
        const savedRetention = localStorage.getItem('runecast_retention');
        if (savedRetention) {
            setRetentionDays(parseInt(savedRetention, 10));
        }
        const savedShowFocus = localStorage.getItem('runecast_showFocusMessage');
        if (savedShowFocus !== null) {
            setShowFocusMessage(JSON.parse(savedShowFocus));
        }
    }, []);
    
    useEffect(() => {
        const handleAfterPrint = () => {
            setPrintingReadingId(null);
        };
        window.addEventListener('afterprint', handleAfterPrint);
        return () => window.removeEventListener('afterprint', handleAfterPrint);
    }, []);

    const handleApiKeySubmit = (key: string) => {
        if (key && key.trim().length > 0) {
            localStorage.setItem('runecast_gemini_api_key', key.trim());
            setApiKey(key.trim());
        }
    };

    const handleResetApiKey = () => {
        localStorage.removeItem('runecast_gemini_api_key');
        setApiKey(null);
    };

    const handleSelectReadingMode = (mode: 'physical' | 'virtual') => {
        setReadingMode(mode);
    };

    const handleSelectSpread = (spread: Spread) => {
        setCurrentSpread(spread);
        setSelectedRunes([]);
        setReadingResult(null);
        setShuffledRunes(shuffleArray(ELDER_FUTHARK));
        if (showFocusMessage) {
            setNeedsFocus(true);
        }
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
        if (!currentSpread || !apiKey) return;
        setIsLoading(true);
        try {
            const interpretation: ReadingInterpretation = await gemini.getReadingInterpretation(selectedRunes, currentSpread, apiKey);
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
        const readingIsReadyToComplete = currentSpread && selectedRunes.length === currentSpread.runeCount && !isLoading && !readingResult;

        if (readingIsReadyToComplete) {
            if (readingMode === 'virtual' && !isCompletingReading) {
                 setIsCompletingReading(true);
                 setTimeout(() => {
                    handleReadingComplete();
                }, 2000); // Animation duration
            } else if (readingMode === 'physical') {
                handleReadingComplete();
            }
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
        setNeedsFocus(false);
        setIsCompletingReading(false);
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
    
    const handleSetShowFocusMessage = (show: boolean) => {
        setShowFocusMessage(show);
        localStorage.setItem('runecast_showFocusMessage', JSON.stringify(show));
    }

    const handleGenerateAnalysis = async () => {
        if (!apiKey) return;
        setIsAnalyzing(true);
        setAnalysis(null);
        const result = await gemini.getPatternAnalysis(readings, apiKey);
        setAnalysis(result);
        setIsAnalyzing(false);
    };
    
    const handleExportReading = (readingId: number) => {
        setPrintingReadingId(readingId);
        setTimeout(() => {
            window.print();
        }, 100);
    };
    
    const handleDownloadApp = async () => {
        try {
            const filesToFetch = [
                './App.tsx',
                './types.ts',
                './constants.tsx',
                './services/storageService.ts',
                './services/geminiService.ts',
                './components/Header.tsx',
                './components/RuneDisplay.tsx',
                './components/MysticalParticles.tsx',
                './index.tsx',
                './index.html',
            ];

            const filePromises = filesToFetch.map(url => fetch(url).then(res => {
                if (!res.ok) throw new Error(`Failed to fetch ${url}`);
                return res.text();
            }));
            
            const [
                appTsxContent,
                typesTsContent,
                constantsTsxContent,
                storageServiceTsContent,
                geminiServiceTsContent,
                headerTsxContent,
                runeDisplayTsxContent,
                mysticalParticlesTsxContent,
                indexTsxContent,
                indexHtmlContent,
            ] = await Promise.all(filePromises);

            const subComponentMarker = '// Sub-components for views';
            const markerIndex = appTsxContent.indexOf(subComponentMarker);
            let mainAppContent = appTsxContent;
            let subComponentsContent = '';
            if (markerIndex !== -1) {
                mainAppContent = appTsxContent.substring(0, markerIndex);
                subComponentsContent = appTsxContent.substring(markerIndex);
            }

            const clean = (content: string) => {
                return content
                    .replace(/^import .* from '.*?';\r?\n/gm, '')
                    .replace(/^export default \w+;/m, '')
                    .replace(/^export /gm, '');
            };

            let cleanedMainApp = clean(mainAppContent);
            
            const downloadFunctionRegex = /const handleDownloadApp = async \(\) => \{[\s\S]*?\};/;
            cleanedMainApp = cleanedMainApp.replace(
                downloadFunctionRegex,
                `const handleDownloadApp = () => { alert("This feature is not available in the downloaded version of the app."); };`
            );
            
            cleanedMainApp = cleanedMainApp.replace(
                `const key = process.env.API_KEY || localStorage.getItem('runecast_gemini_api_key');`,
                `const key = localStorage.getItem('runecast_gemini_api_key');`
            );


            const allScripts = [
                clean(typesTsContent),
                clean(constantsTsxContent),
                clean(storageServiceTsContent),
                clean(geminiServiceTsContent),
                clean(mysticalParticlesTsxContent),
                clean(runeDisplayTsxContent),
                clean(headerTsxContent),
                clean(subComponentsContent),
                cleanedMainApp,
                clean(indexTsxContent),
            ].join('\n\n// --- BUNDLED FILE BOUNDARY --- \n\n');

            const finalHtml = indexHtmlContent.replace(
                '<script type="text/babel" data-type="module" src="./index.tsx"></script>',
                `<script type="text/babel" data-type="module">\n//<![CDATA[\n(function() {\n${allScripts}\n})();\n//]]>\n</script>`
            );
            
            const blob = new Blob([finalHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'RuneCast.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Failed to build the application file:", error);
            alert("Sorry, there was an error creating the downloadable application file.");
        }
    };

    const renderHome = () => {
        if (isLoading) {
            return <LoadingView message="The runes are being cast. Awaiting insight..." />;
        }
        if (readingResult) {
            return <ReadingResultView result={readingResult} onSave={saveCurrentReading} onDiscard={resetReadingFlow} onExport={handleExportReading} />;
        }
        if (needsFocus) {
             return <FocusView onContinue={() => setNeedsFocus(false)} onSetShowAgain={handleSetShowFocusMessage} />;
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
                        isCompleting={isCompletingReading}
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
                return <HistoryView readings={readings} printingReadingId={printingReadingId} onExport={handleExportReading} />;
            case 'analysis':
                return <AnalysisView readings={readings} analysis={analysis} isAnalyzing={isAnalyzing} onGenerate={handleGenerateAnalysis} />;
            case 'about':
                return <AboutView />;
            case 'settings':
                return <SettingsView 
                    retentionDays={retentionDays}
                    onSetRetention={handleSetRetention}
                    onPrune={handlePruneReadings}
                    onDownloadApp={handleDownloadApp}
                    showFocusMessage={showFocusMessage}
                    onSetShowFocusMessage={handleSetShowFocusMessage}
                    onResetApiKey={handleResetApiKey}
                />;
            default:
                return renderHome();
        }
    };
    
    if (!isKeyChecked) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <MysticalParticles />
                <LoadingView message="Initializing..." />
            </div>
        );
    }
    
    if (!apiKey) {
        return <ApiKeySetupView onKeySubmit={handleApiKeySubmit} />;
    }

    return (
        <div className="min-h-screen bg-slate-900">
            <MysticalParticles />
            <Header currentView={view} setView={setView} />
            <main className="container mx-auto p-4 md:p-8">
                {renderContent()}
            </main>
        </div>
    );
};

const ApiKeySetupView: React.FC<{onKeySubmit: (key: string) => void}> = ({ onKeySubmit }) => {
    const [inputKey, setInputKey] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onKeySubmit(inputKey);
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <MysticalParticles />
            <div className="max-w-2xl mx-auto text-center animate-fade-in">
                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-8 rounded-lg border border-slate-700 shadow-lg shadow-amber-900/20">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-300" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v1.065a8.001 8.001 0 11-4 0V2a1 1 0 01.7-1.046 4.002 4.002 0 102.6 0zM12 10a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd" />
                        </svg>
                        <h1 className="text-4xl font-bold text-amber-200 font-display tracking-wider">Runecast</h1>
                    </div>
                    <h2 className="text-3xl font-display text-amber-200 mb-4 shimmer-text">API Key Required</h2>
                    <p className="text-slate-300 text-lg leading-relaxed mb-6">
                        To connect to the arcane energies of the Gemini API, please enter your API key below. Your key will be saved securely in your browser's local storage.
                    </p>
                    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 justify-center mb-6">
                        <input
                            type="password"
                            value={inputKey}
                            onChange={(e) => setInputKey(e.target.value)}
                            placeholder="Enter your Gemini API Key"
                            className="flex-grow bg-slate-900 border border-slate-600 rounded-full px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-slate-500"
                            aria-label="Gemini API Key"
                        />
                        <button
                            type="submit"
                            className="px-6 py-3 bg-amber-500 text-slate-900 font-bold rounded-full hover:bg-amber-400 transition-transform transform hover:scale-105 disabled:bg-slate-600"
                            disabled={!inputKey}
                        >
                            Save & Continue
                        </button>
                    </form>
                    <a 
                        href="https://ai.google.dev/gemini-api/docs/api-key" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-amber-400 hover:text-amber-200"
                    >
                        Don't have a key? Get one here.
                    </a>
                </div>
            </div>
        </div>
    );
};


// Sub-components for views

const LoadingView: React.FC<{message: string}> = ({ message }) => (
    <div className="text-center p-8 animate-fade-in">
        <div className="inline-block relative h-16 w-16 mb-4">
            {ELDER_FUTHARK.slice(0, 8).map((rune, i) => (
                <div key={rune.name} className="absolute text-amber-400 text-lg" style={{ transform: `rotate(${i * 45}deg) translateY(2.5rem)`, animation: `symbolPulse 2s ease-in-out ${i*0.25}s infinite` }}>
                    {rune.symbol}
                </div>
            ))}
        </div>
        <p className="text-xl text-slate-300 shimmer-text">{message}</p>
    </div>
);

const FocusView: React.FC<{
    onContinue: () => void;
    onSetShowAgain: (show: boolean) => void;
}> = ({ onContinue, onSetShowAgain }) => (
    <div className="max-w-2xl mx-auto text-center animate-fade-in">
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-8 rounded-lg border border-slate-700 shadow-lg shadow-amber-900/20">
            <h2 className="text-3xl font-display text-amber-200 mb-6 shimmer-text">A Moment of Focus</h2>
            <p className="text-slate-300 text-lg leading-relaxed mb-8">
                 “Warriors, the servants of civilization. Hundreds of years have passed. The voices that once whispered to others now whisper to us. And to hear them? All that is required is for you to honor your own nature and know the stillness within. To that end when consulting the Runes, a single question, a simple prayer, will always suffice: <strong className="text-amber-300 block mt-2">Show me what I need to know for my life now.</strong>”
            </p>
            
            <button 
                onClick={onContinue} 
                className="px-8 py-3 bg-amber-500 text-slate-900 font-bold rounded-full hover:bg-amber-400 transition-transform transform hover:scale-105 mb-6"
            >
                Continue to Casting
            </button>

            <div className="flex items-center justify-center">
                <input 
                    type="checkbox" 
                    id="showAgain" 
                    defaultChecked={true}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-amber-500 focus:ring-amber-400"
                    onChange={(e) => onSetShowAgain(e.target.checked)}
                    aria-label="Show this again next time"
                />
                <label htmlFor="showAgain" className="ml-2 text-sm text-slate-400 cursor-pointer">
                    Show this again next time
                </label>
            </div>
        </div>
    </div>
);

const SelectReadingModeView: React.FC<{onSelectMode: (mode: 'physical' | 'virtual') => void}> = ({ onSelectMode }) => (
    <div className="text-center animate-fade-in">
        <h2 className="text-3xl md:text-4xl text-amber-200 font-display mb-2 shimmer-text">Begin a Reading</h2>
        <p className="text-slate-400 mb-8 max-w-2xl mx-auto">Are you using your own physical runes or would you like to draw from our virtual pouch?</p>
        <div className="flex flex-col md:flex-row justify-center gap-6 max-w-2xl mx-auto">
            <button onClick={() => onSelectMode('physical')} className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-lg border-2 border-slate-700 hover:border-amber-400 shadow-lg hover:shadow-amber-900/50 transition-all duration-300 text-left transform hover:-translate-y-1">
                <h3 className="text-2xl font-display text-amber-300">Physical Reading</h3>
                <p className="text-slate-400 mt-2">I have my own set of runes. I will select the ones I've drawn.</p>
            </button>
            <button onClick={() => onSelectMode('virtual')} className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-lg border-2 border-slate-700 hover:border-amber-400 shadow-lg hover:shadow-amber-900/50 transition-all duration-300 text-left transform hover:-translate-y-1">
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
            <h3 className="text-2xl font-display text-amber-200 mb-4 shimmer-text">Choose Orientation for {rune.name}</h3>
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
        <h2 className="text-3xl md:text-4xl text-amber-200 font-display mb-2 shimmer-text">Choose a Spread</h2>
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
    isCompleting: boolean;
}> = ({ spread, selectedRunes, onSelectRune, shuffledRunes, onReset, readingMode, isCompleting }) => {
    const selectedRuneNames = useMemo(() => new Set(selectedRunes.map(r => r.runeName)), [selectedRunes]);

    const displayRunes = useMemo(() => {
        if (readingMode === 'physical') {
            return [...ELDER_FUTHARK].sort((a, b) => a.name.localeCompare(b.name));
        }
        return shuffledRunes;
    }, [readingMode, shuffledRunes]);
    
    return (
        <div className={`animate-fade-in ${isCompleting ? 'pointer-events-none' : ''}`}>
            <div className="text-center mb-8">
                <h2 className="text-3xl text-amber-200 font-display shimmer-text">
                    {isCompleting ? 'The runes are cast...' : readingMode === 'physical' ? 'Record Your Runes' : 'Cast your Runes'}
                </h2>
                <p className={`text-slate-400 transition-opacity duration-500 ${isCompleting ? 'opacity-0' : 'opacity-100'}`}>
                    {spread.runeCount > selectedRunes.length ? `Select ${spread.runeCount - selectedRunes.length} more rune${spread.runeCount - selectedRunes.length !== 1 ? 's' : ''}.` : 'All runes selected.'}
                </p>
                <button onClick={onReset} className={`mt-2 text-sm text-amber-400 hover:text-amber-200 transition-opacity duration-500 ${isCompleting ? 'opacity-0' : 'opacity-100'}`}>&larr; Start Over</button>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
                {displayRunes.map((rune, index) => {
                    const isSelected = selectedRuneNames.has(rune.name);
                    const selectedRuneData = isSelected ? selectedRunes.find(r => r.runeName === rune.name) : null;
                    const isFaceDown = readingMode === 'virtual' && !isSelected;
                    const selectionOrder = isSelected ? selectedRunes.findIndex(sr => sr.runeName === rune.name) : -1;

                    return (
                        <div 
                            key={rune.name}
                            className={`
                                ${!isCompleting ? 'animate-fade-in-stagger' : ''}
                                ${isCompleting && isSelected ? 'animate-rune-gather' : ''}
                                ${isCompleting && !isSelected ? 'animate-rune-fade-out' : ''}
                            `}
                            style={{
                                animationDelay: !isCompleting ? `${index * 30}ms` : (isCompleting && isSelected ? `${selectionOrder * 100}ms` : `${Math.random() * 300}ms`),
                                animationFillMode: 'forwards'
                            }}
                        >
                            <RuneDisplay 
                                rune={rune}
                                isFaceDown={isFaceDown}
                                isSelected={isSelected}
                                onClick={() => !isSelected && onSelectRune(rune)}
                                orientation={selectedRuneData?.orientation}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ReadingResultView: React.FC<{result: Reading; onSave?: () => void; onDiscard?: () => void; isJournalView?: boolean, onExport?: (id: number) => void}> = ({ result, onSave, onDiscard, isJournalView = false, onExport }) => (
    <div className="max-w-4xl mx-auto">
        <h2 className="text-center text-3xl text-amber-200 font-display mb-8 animate-fade-in-stagger shimmer-text">{result.spread.name} Reading</h2>

        <div className="space-y-8 mb-8">
            {result.runes.map((selectedRune, index) => {
                const rune = ELDER_FUTHARK.find(r => r.name === selectedRune.runeName);
                if (!rune) return null;

                const interpretation = result.individualRunes?.find(ir => ir.runeName === selectedRune.runeName);
                return (
                    <div 
                        key={selectedRune.runeName + index}
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
        
        <div className="bg-slate-900/70 p-6 rounded-lg border border-slate-700 mb-8 animate-fade-in-stagger" style={{animationDelay: `${result.runes.length * 200}ms`}}>
            <h3 className="text-2xl font-display text-amber-200 mb-4 shimmer-text">Overall Interpretation</h3>
            <p className="text-slate-200 whitespace-pre-wrap">{result.summary}</p>
        </div>

        <div className="bg-slate-900/70 p-6 rounded-lg border border-slate-700 mb-8 animate-fade-in-stagger" style={{animationDelay: `${(result.runes.length + 1) * 200}ms`}}>
            <h3 className="text-2xl font-display text-amber-200 mb-4 shimmer-text">Reflective Questions</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
                {result.questions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
        </div>
        
        {!isJournalView && onSave && onDiscard && (
            <div className="flex justify-center gap-4 animate-fade-in-stagger" style={{animationDelay: `${(result.runes.length + 2) * 200}ms`}}>
                <button onClick={onSave} className="px-6 py-2 bg-amber-500 text-slate-900 font-bold rounded-full hover:bg-amber-400 transition-colors">Save to Journal</button>
                <button onClick={onDiscard} className="px-6 py-2 bg-slate-700 text-slate-200 font-bold rounded-full hover:bg-slate-600 transition-colors">Discard</button>
            </div>
        )}
    </div>
);

const HistoryView: React.FC<{readings: Reading[], printingReadingId: number | null, onExport: (id: number) => void}> = ({ readings, printingReadingId, onExport }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
      setExpandedId(prev => (prev === id ? null : id));
  };

  if (readings.length === 0) {
    return <div className="text-center text-slate-400 animate-fade-in">You have no saved readings.</div>;
  }
  
  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-center text-3xl text-amber-200 font-display mb-8 shimmer-text">Reading History</h2>
      {readings.map(reading => {
        const isExpanded = expandedId === reading.id;
        return (
            <div key={reading.id} className={`reading-history-item bg-slate-800/50 rounded-lg border border-slate-700 transition-all duration-300 ${isExpanded ? 'shadow-lg shadow-amber-900/20' : ''} ${printingReadingId === reading.id ? 'print-this-reading' : ''}`}>
                <div className="p-4 md:p-6 cursor-pointer" onClick={() => toggleExpand(reading.id)}>
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-display text-amber-300">{reading.spread.name}</h3>
                            <p className="text-sm text-slate-400">{new Date(reading.date).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={(e) => { e.stopPropagation(); onExport(reading.id); }} className="no-print p-2 rounded-full hover:bg-slate-700 transition-colors" aria-label="Print or export reading">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2H5zm0 2h10v12H5V4zm2 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                            </button>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-4 md:px-6 pb-6 border-t border-slate-700/50 pt-4">
                        <ReadingResultView result={reading} isJournalView={true} />
                    </div>
                </div>
            </div>
        );
      })}
    </div>
  );
};

const AnalysisView: React.FC<{readings: Reading[], analysis: PatternAnalysis | null, isAnalyzing: boolean, onGenerate: () => void}> = ({ readings, analysis, isAnalyzing, onGenerate }) => (
    <div className="max-w-4xl mx-auto text-center animate-fade-in">
        <h2 className="text-3xl text-amber-200 font-display mb-4 shimmer-text">Pattern Analysis</h2>
        {readings.length < 5 && <p className="text-slate-400 mb-6">You need at least 5 saved readings to generate a meaningful analysis.</p>}
        <button 
            onClick={onGenerate} 
            disabled={isAnalyzing || readings.length < 5}
            className="px-6 py-3 bg-amber-500 text-slate-900 font-bold rounded-full hover:bg-amber-400 transition-transform transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none"
        >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Reading History'}
        </button>

        {isAnalyzing && <div className="mt-8"><LoadingView message="Analyzing patterns across the threads of fate..." /></div>}
        
        {analysis && (
            <div className="mt-8 text-left space-y-6 animate-fade-in">
                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-2xl font-display text-amber-300 mb-3">Frequent Runes</h3>
                    <ul className="space-y-3">
                        {analysis.frequentRunes.map(fr => <li key={fr.runeName}><strong className="text-amber-200">{fr.runeName} (x{fr.count}):</strong> <span className="text-slate-300">{fr.interpretation}</span></li>)}
                    </ul>
                </div>
                 <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-2xl font-display text-amber-300 mb-3">Recurring Themes</h3>
                    <ul className="list-disc list-inside space-y-2 text-slate-300">
                        {analysis.recurringThemes.map((theme, i) => <li key={i}>{theme}</li>)}
                    </ul>
                </div>
                 <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-2xl font-display text-amber-300 mb-3">Overall Summary</h3>
                    <p className="text-slate-300 whitespace-pre-wrap">{analysis.overallSummary}</p>
                </div>
            </div>
        )}
    </div>
);

const AboutView: React.FC = () => (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6 text-slate-300 leading-relaxed">
        <h2 className="text-3xl text-amber-200 font-display text-center mb-6 shimmer-text">About the Runes</h2>
        <p>The Elder Futhark is the oldest form of the runic alphabets. It was a system of writing used by Germanic peoples for Northwest Germanic dialects in the Migration Period. The inscriptions are found on artifacts including jewelry, amulets, tools, weapons, and runestones.</p>
        <p>Beyond their use as a writing system, each rune has a name and a symbolic meaning, representing cosmological principles and powers. To "cast" or "read" the runes is to tap into this ancient wisdom, seeking guidance and insight into the forces at play in one's life.</p>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-8">
            {ELDER_FUTHARK.filter(r => r.name !== 'Blank Rune').map(rune => (
                <div key={rune.name} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-center">
                    <div className="text-3xl text-amber-300 h-10 w-10 mx-auto flex items-center justify-center">{rune.symbol}</div>
                    <p className="text-sm font-bold mt-1">{rune.name}</p>
                    <p className="text-xs text-slate-400">{rune.keywords[0]}</p>
                </div>
            ))}
        </div>
    </div>
);

const SettingsView: React.FC<{
    retentionDays: number;
    onSetRetention: (days: number) => void;
    onPrune: () => void;
    onDownloadApp: () => void;
    showFocusMessage: boolean;
    onSetShowFocusMessage: (show: boolean) => void;
    onResetApiKey: () => void;
}> = ({ retentionDays, onSetRetention, onPrune, onDownloadApp, showFocusMessage, onSetShowFocusMessage, onResetApiKey }) => (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-8">
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <h2 className="text-2xl font-display text-amber-200 mb-4 shimmer-text">API Configuration</h2>
            <p className="text-slate-400 mb-4">If you are experiencing connection issues, you can reset and re-enter your Gemini API key.</p>
            <button
                onClick={onResetApiKey}
                className="px-4 py-2 bg-slate-600 text-slate-200 font-semibold rounded-md hover:bg-slate-500 transition-colors"
            >
                Reset API Key
            </button>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <h2 className="text-2xl font-display text-amber-200 mb-4 shimmer-text">Data Retention</h2>
            <p className="text-slate-400 mb-4">Choose how long to keep your reading history. Readings older than the selected period will be deleted when you prune.</p>
            <div className="flex items-center gap-4">
                <select 
                    value={retentionDays} 
                    onChange={(e) => onSetRetention(parseInt(e.target.value, 10))}
                    className="bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="365">1 Year</option>
                    <option value="0">Forever</option>
                </select>
                <button 
                    onClick={onPrune}
                    className="px-4 py-2 bg-red-800/70 text-red-200 font-semibold rounded-md hover:bg-red-700 transition-colors"
                >
                    Prune Old Readings
                </button>
            </div>
        </div>
        
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <h2 className="text-2xl font-display text-amber-200 mb-4 shimmer-text">Preferences</h2>
            <div className="flex items-center">
                <input
                    type="checkbox"
                    id="showFocus"
                    checked={showFocusMessage}
                    onChange={(e) => onSetShowFocusMessage(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="showFocus" className="ml-3 text-slate-300">
                    Show the "Moment of Focus" screen before new readings.
                </label>
            </div>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <h2 className="text-2xl font-display text-amber-200 mb-4 shimmer-text">Publish App</h2>
            <p className="text-slate-400 mb-4">Download a single, self-contained HTML file of this application. You can share this file with anyone, and they can run it in their browser without any installation.</p>
            <button
                onClick={onDownloadApp}
                className="px-6 py-3 bg-amber-500 text-slate-900 font-bold rounded-full hover:bg-amber-400 transition-transform transform hover:scale-105"
            >
                Download App HTML
            </button>
        </div>
    </div>
);

export default App;
