import React from 'react';
import { Rune } from '../types';

interface RuneDisplayProps {
  rune?: Rune | null;
  isFaceDown?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
  orientation?: 'upright' | 'reversed';
  isGlowing?: boolean;
}

const RuneDisplay: React.FC<RuneDisplayProps> = ({ rune, isFaceDown = false, onClick, isSelected = false, className = '', orientation = 'upright', isGlowing = false }) => {
  const baseClasses = "aspect-[3/5] w-20 h-auto flex items-center justify-center rounded-lg border-2 transition-all duration-300 transform cursor-pointer";
  const stateClasses = isFaceDown
    ? "bg-slate-700 border-slate-600 hover:bg-slate-600 hover:border-amber-400"
    : "bg-slate-800 border-slate-600 shadow-lg shadow-amber-900/50";
  
  const selectedClasses = isSelected ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900" : "";
  const glowingClasses = isGlowing ? "glow" : "";
  
  return (
    <div
      onClick={onClick}
      className={`${baseClasses} ${stateClasses} ${selectedClasses} ${glowingClasses} ${className}`}
      style={{ perspective: '1000px' }}
    >
      <div className={`relative w-full h-full transition-transform duration-500 ${!isFaceDown ? '[transform:rotateY(180deg)]' : ''}`} style={{ transformStyle: 'preserve-3d'}}>
         {/* Back of the card (face down view) */}
        <div className="absolute w-full h-full bg-slate-700 rounded-md flex items-center justify-center [backface-visibility:hidden]">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
           </svg>
        </div>

        {/* Front of the card (face up view) */}
        <div className="absolute w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-md flex flex-col items-center justify-center text-amber-300 p-2 [transform:rotateY(180deg)] [backface-visibility:hidden]">
          {rune && (
            <>
              <div className={`text-4xl h-12 w-12 flex items-center justify-center transition-transform duration-300 ${orientation === 'reversed' ? 'rotate-180' : ''}`}>{rune.symbol}</div>
              <p className="text-sm font-bold mt-2 text-center">{rune.name}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RuneDisplay;