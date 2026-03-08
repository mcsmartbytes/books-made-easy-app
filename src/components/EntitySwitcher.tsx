'use client';

import { useState, useRef, useEffect } from 'react';
import { useEntity } from '@/contexts/EntityContext';

export default function EntitySwitcher() {
  const { currentEntity, entities, isConsolidated, setCurrentEntity, loading } = useEntity();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="px-3 py-2">
        <div className="animate-pulse h-8 bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (entities.length === 0) {
    return null;
  }

  const displayName = isConsolidated
    ? 'All Entities'
    : currentEntity?.name || 'Select Entity';

  return (
    <div ref={dropdownRef} className="relative px-3 py-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="text-white truncate">{displayName}</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-3 right-3 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
          <button
            onClick={() => {
              setCurrentEntity(null);
              setIsOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
              isConsolidated ? 'text-primary-600 font-medium' : 'text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              All Entities (Consolidated)
            </div>
          </button>

          <div className="border-t border-gray-700"></div>

          {entities.map((entity) => (
            <button
              key={entity.id}
              onClick={() => {
                setCurrentEntity(entity.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                currentEntity?.id === entity.id ? 'text-primary-600 font-medium' : 'text-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{entity.name}</span>
              </div>
              <div className="text-xs text-gray-500 truncate capitalize">{entity.entity_type}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
