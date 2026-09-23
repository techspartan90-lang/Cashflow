import React, { useState } from 'react';
import {
  Globe,
  MapPin,
  Search,
  ExternalLink,
  Sparkles,
  Loader2,
  Navigation,
  Building2,
  AlertCircle,
  FileText,
  BadgePercent,
  CheckCircle2,
} from 'lucide-react';
import { requestSearchGrounding, requestMapsGrounding } from '../../services/api-service';

interface GroundingIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  financialContext: any;
}

type TabType = 'search' | 'maps';

export const GroundingIntelligenceModal: React.FC<GroundingIntelligenceModalProps> = ({
  isOpen,
  onClose,
  financialContext,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('search');

  // Search Grounding State
  const [searchPrompt, setSearchPrompt] = useState<string>(
    'Current RBI repo rate and commercial bank working capital loan interest rates for SMEs in India'
  );
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<{
    text?: string;
    sources?: Array<{ title: string; uri: string }>;
    searchQueries?: string[];
    error?: string;
  } | null>(null);

  // Maps Grounding State
  const [mapsPrompt, setMapsPrompt] = useState<string>(
    'Commercial bank branches and MSME working capital loan centers near me'
  );
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [locationDetecting, setLocationDetecting] = useState<boolean>(false);
  const [mapsLoading, setMapsLoading] = useState<boolean>(false);
  const [mapsResult, setMapsResult] = useState<{
    text?: string;
    places?: Array<{ title: string; uri: string; address?: string; snippet?: string }>;
    error?: string;
  } | null>(null);

  // Detect user geolocation for Maps grounding
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setLocationDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocationDetecting(false);
      },
      (err) => {
        console.warn('Geolocation access failed/denied', err);
        setLocationDetecting(false);
      }
    );
  };

  const handleRunSearchGrounding = async (customPrompt?: string) => {
    const q = customPrompt || searchPrompt;
    if (!q.trim() || searchLoading) return;

    setSearchLoading(true);
    setSearchResult(null);

    const result = await requestSearchGrounding(q, financialContext);
    setSearchResult(result);
    setSearchLoading(false);
  };

  const handleRunMapsGrounding = async (customPrompt?: string) => {
    const q = customPrompt || mapsPrompt;
    if (!q.trim() || mapsLoading) return;

    setMapsLoading(true);
    setMapsResult(null);

    const result = await requestMapsGrounding(q, userLocation || undefined);
    setMapsResult(result);
    setMapsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[88vh] shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base">Gemini Grounding Intelligence</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  gemini-3.5-flash
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live Google Search and Google Maps grounding for real-time market data & local banking places
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/50">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'border-cyan-500 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Search Grounding (Google Search)</span>
          </button>

          <button
            onClick={() => setActiveTab('maps')}
            className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'maps'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Maps Grounding (Google Maps Places)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-900/40">
          {activeTab === 'search' ? (
            /* SEARCH GROUNDING TAB */
            <div className="space-y-4">
              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {[
                  'Current RBI repo rate and SME working capital loan interest rates',
                  'Upcoming GST filing and advance tax payment deadlines for Q3/Q4',
                  'Average DSO and debtor payment terms for wholesale FMCG suppliers',
                  'Government CGTMSE collateral-free loan limits and eligibility',
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSearchPrompt(preset);
                      handleRunSearchGrounding(preset);
                    }}
                    className="text-xs bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                  >
                    🔍 {preset}
                  </button>
                ))}
              </div>

              {/* Input & Search Trigger */}
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchPrompt}
                    onChange={(e) => setSearchPrompt(e.target.value)}
                    placeholder="Search query grounded in Google Search..."
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  onClick={() => handleRunSearchGrounding()}
                  disabled={searchLoading || !searchPrompt.trim()}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-md shadow-cyan-600/30 flex items-center space-x-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {searchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{searchLoading ? 'Grounding...' : 'Run Search Grounding'}</span>
                </button>
              </div>

              {/* Search Grounding Results */}
              {searchResult && (
                <div className="space-y-4 animate-fadeIn">
                  {searchResult.error ? (
                    <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{searchResult.error}</span>
                    </div>
                  ) : (
                    <>
                      {/* Analysis Text */}
                      <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-5 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {searchResult.text}
                      </div>

                      {/* Verified Sources & Grounding Links */}
                      {searchResult.sources && searchResult.sources.length > 0 && (
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified Web Grounding Sources (Google Search)</span>
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {searchResult.sources.map((src, i) => (
                              <a
                                key={i}
                                href={src.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all flex items-center justify-between text-xs text-slate-300 group"
                              >
                                <span className="truncate pr-2 font-medium group-hover:text-cyan-300">
                                  {src.title}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Web Search Queries Generated by Gemini */}
                      {searchResult.searchQueries && searchResult.searchQueries.length > 0 && (
                        <div className="text-[11px] text-slate-400 flex flex-wrap gap-2 items-center">
                          <span className="font-semibold text-slate-500">Google Search Queries:</span>
                          {searchResult.searchQueries.map((q, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                            >
                              "{q}"
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* MAPS GROUNDING TAB */
            <div className="space-y-4">
              {/* Geolocation bar */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-slate-300">
                  <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Location:{' '}
                    {userLocation ? (
                      <strong className="text-emerald-400">
                        {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                      </strong>
                    ) : (
                      <span className="text-slate-400">Not set (using query location)</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={handleDetectLocation}
                  disabled={locationDetecting}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{locationDetecting ? 'Detecting...' : 'Use My Current Location'}</span>
                </button>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {[
                  'State Bank of India commercial and SME loan branches nearby',
                  'HDFC Bank business banking and working capital finance centers',
                  'Invoice discounting and TReDS factoring agencies nearby',
                  'Tax consultants, GST Seva Kendra, and CA offices near me',
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setMapsPrompt(preset);
                      handleRunMapsGrounding(preset);
                    }}
                    className="text-xs bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                  >
                    📍 {preset}
                  </button>
                ))}
              </div>

              {/* Input & Search Trigger */}
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={mapsPrompt}
                    onChange={(e) => setMapsPrompt(e.target.value)}
                    placeholder="Search query grounded in Google Maps..."
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={() => handleRunMapsGrounding()}
                  disabled={mapsLoading || !mapsPrompt.trim()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-600/30 flex items-center space-x-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {mapsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  <span>{mapsLoading ? 'Finding Places...' : 'Run Maps Grounding'}</span>
                </button>
              </div>

              {/* Maps Grounding Results */}
              {mapsResult && (
                <div className="space-y-4 animate-fadeIn">
                  {mapsResult.error ? (
                    <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{mapsResult.error}</span>
                    </div>
                  ) : (
                    <>
                      {/* Analysis Text */}
                      <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-5 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {mapsResult.text}
                      </div>

                      {/* Verified Place Cards with Google Maps Links */}
                      {mapsResult.places && mapsResult.places.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-2">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>Verified Places & Branches on Google Maps</span>
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {mapsResult.places.map((place, idx) => (
                              <div
                                key={idx}
                                className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-colors"
                              >
                                <div>
                                  <div className="flex items-start justify-between">
                                    <h5 className="font-semibold text-sm text-white">{place.title}</h5>
                                    {place.uri && (
                                      <a
                                        href={place.uri}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-emerald-400 hover:text-emerald-300 p-1 rounded hover:bg-slate-800 transition-colors"
                                        title="Open in Google Maps"
                                      >
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    )}
                                  </div>
                                  {place.snippet && (
                                    <p className="text-xs text-slate-400 mt-2 line-clamp-3 italic">
                                      "{place.snippet}"
                                    </p>
                                  )}
                                </div>

                                {place.uri && (
                                  <a
                                    href={place.uri}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center space-x-1.5 text-xs text-emerald-400 hover:underline font-medium"
                                  >
                                    <span>View Directions & Details on Google Maps</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
