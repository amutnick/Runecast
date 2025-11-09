import { ReactNode } from 'react';

export interface Rune {
  name: string;
  symbol: ReactNode;
  keywords: string[];
  meaning: string;
  reversedKeywords: string[];
  reversedMeaning: string;
}

export interface SelectedRune {
    runeName: string;
    orientation: 'upright' | 'reversed';
}

export interface Spread {
  name: string;
  description: string;
  runeCount: number;
}

export interface IndividualRuneInterpretation {
    runeName: string;
    orientation: 'upright' | 'reversed';
    summary: string;
}

export interface ReadingInterpretation {
    summary: string;
    questions: string[];
    individualRunes: IndividualRuneInterpretation[];
}

export interface Reading extends ReadingInterpretation {
  id: number;
  date: string;
  spread: Spread;
  runes: SelectedRune[];
}

export type View = 'home' | 'history' | 'analysis' | 'settings' | 'about';

export interface FrequentRune {
    runeName: string;
    count: number;
    interpretation: string;
}

export interface PatternAnalysis {
    frequentRunes: FrequentRune[];
    recurringThemes: string[];
    overallSummary: string;
}