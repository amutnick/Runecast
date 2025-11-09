import React from 'react';
import { View } from '../types';

interface HeaderProps {
  currentView: View;
  setView: (view: View) => void;
}

const NavIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-300" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v1.065a8.001 8.001 0 11-4 0V2a1 1 0 01.7-1.046 4.002 4.002 0 102.6 0zM12 10a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd" />
    </svg>
)

const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
  const navItems: { view: View; label: string }[] = [
    { view: 'home', label: 'New Reading' },
    { view: 'history', label: 'History' },
    { view: 'analysis', label: 'Analysis' },
    { view: 'about', label: 'About Runes' },
    { view: 'settings', label: 'Settings' },
  ];

  return (
    <header className="bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50 p-4 border-b border-slate-700">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
            <NavIcon />
            <h1 className="text-2xl md:text-3xl font-bold text-amber-200 font-display tracking-wider">Runecast</h1>
        </div>
        <nav className="hidden md:flex items-center space-x-2 bg-slate-800/50 p-1 rounded-full">
          {navItems.map(({ view, label }) => (
            <button
              key={view}
              onClick={() => setView(view)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 ${
                currentView === view
                  ? 'bg-amber-400 text-slate-900'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="md:hidden">
            <select
                value={currentView}
                onChange={(e) => setView(e.target.value as View)}
                className="bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
                {navItems.map(({ view, label }) => (
                    <option key={view} value={view}>{label}</option>
                ))}
            </select>
        </div>
      </div>
    </header>
  );
};

export default Header;