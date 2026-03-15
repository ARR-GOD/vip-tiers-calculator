import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ArrowUpDown, Loader2, AlertCircle, Users, Building2, ArrowRight } from 'lucide-react';

const FR = {
  title: 'Sélection client',
  subtitle: 'Choisissez un client HubSpot pour pré-remplir le configurateur VIP.',
  csmLabel: 'CSM',
  csmPlaceholder: 'Sélectionner un CSM...',
  searchPlaceholder: 'Rechercher un client...',
  sortAlpha: 'A-Z',
  sortMrr: 'MRR',
  allPlans: 'Tous',
  clientsCount: (shown, total) => `${shown} / ${total} clients`,
  manualLink: 'Configurer manuellement',
  loading: 'Chargement des CSM...',
  loadingClients: 'Chargement des clients...',
  loadingDetails: 'Chargement des données client...',
  noClients: 'Aucun client trouvé',
  noClientsSearch: 'Aucun résultat pour cette recherche',
  errorTitle: 'Erreur de connexion',
  errorHubspot: 'Connexion HubSpot non configurée. Contactez votre admin.',
  errorGeneric: 'Erreur lors du chargement.',
  retry: 'Réessayer',
};

const EN = {
  title: 'Client selection',
  subtitle: 'Pick a HubSpot client to pre-fill the VIP configurator.',
  csmLabel: 'CSM',
  csmPlaceholder: 'Select a CSM...',
  searchPlaceholder: 'Search for a client...',
  sortAlpha: 'A-Z',
  sortMrr: 'MRR',
  allPlans: 'All',
  clientsCount: (shown, total) => `${shown} / ${total} clients`,
  manualLink: 'Configure manually',
  loading: 'Loading CSMs...',
  loadingClients: 'Loading clients...',
  loadingDetails: 'Loading client data...',
  noClients: 'No clients found',
  noClientsSearch: 'No results for this search',
  errorTitle: 'Connection error',
  errorHubspot: 'HubSpot connection not configured. Contact your admin.',
  errorGeneric: 'Error loading data.',
  retry: 'Retry',
};

const PLAN_FILTERS = ['Tous', 'Lite', 'Premium', 'Enterprise'];
const PLAN_FILTERS_EN = ['All', 'Lite', 'Premium', 'Enterprise'];

function formatMrr(value) {
  if (!value || value <= 0) return '';
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k€/m`;
  return `${Math.round(value)}€/m`;
}

export default function StepCSM_Selector({ lang, onClientSelected, onSkipToManual, onHubSpotUnavailable }) {
  const t = lang === 'fr' ? FR : EN;
  const planFilters = lang === 'fr' ? PLAN_FILTERS : PLAN_FILTERS_EN;

  const [owners, setOwners] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('alpha'); // 'alpha' | 'mrr'
  const [planFilter, setPlanFilter] = useState('Tous');
  const [phase, setPhase] = useState('loading'); // 'loading' | 'ready' | 'loading_clients' | 'loading_details' | 'error'
  const [error, setError] = useState('');
  const [loadingClientId, setLoadingClientId] = useState(null);

  // Load owners on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/hubspot-owners');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.code === 'NO_API_KEY' || res.status === 503) {
            onHubSpotUnavailable();
            return;
          }
          throw new Error(data.error || `Error ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setOwners(data);
          setPhase('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setPhase('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [onHubSpotUnavailable]);

  // Load clients when owner changes
  useEffect(() => {
    if (!selectedOwner) {
      setClients([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setPhase('loading_clients');
      setSearch('');
      setPlanFilter('Tous');
      try {
        const res = await fetch(`/api/hubspot-clients?ownerId=${selectedOwner.id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Error ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setClients(data.clients || []);
          setPhase('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setPhase('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedOwner]);

  // Filter + sort clients
  const filteredClients = useMemo(() => {
    let list = [...clients];

    // Plan filter
    const filterKey = planFilter.toLowerCase();
    if (filterKey !== 'tous' && filterKey !== 'all') {
      list = list.filter(c => (c.plan || '').toLowerCase().includes(filterKey));
    }

    // Search filter (client-side)
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.domain || '').toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'mrr') {
      list.sort((a, b) => (b.mrrCsm || 0) - (a.mrrCsm || 0));
    } else {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [clients, search, sortBy, planFilter]);

  // Handle client selection
  const handleSelectClient = async (client) => {
    setLoadingClientId(client.id);
    setPhase('loading_details');
    try {
      const res = await fetch(`/api/hubspot-client-details?companyId=${client.id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const details = await res.json();
      onClientSelected(client, details);
    } catch (err) {
      setError(err.message);
      setPhase('error');
      setLoadingClientId(null);
    }
  };

  // Loading state
  if (phase === 'loading') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Loader2 size={32} className="animate-spin mx-auto text-primary mb-4" />
        <p className="text-[14px] text-[#645648]">{t.loading}</p>
      </div>
    );
  }

  // Error state
  if (phase === 'error') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <AlertCircle size={32} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-[18px] font-bold text-[#52473C] mb-2">{t.errorTitle}</h2>
        <p className="text-[14px] text-[#645648] mb-6">{error || t.errorGeneric}</p>
        <div className="flex justify-center gap-3">
          <button onClick={() => window.location.reload()} className="btn-primary text-[13px] px-4 py-2">
            {t.retry}
          </button>
          <button onClick={onSkipToManual} className="btn-ghost text-[13px] px-4 py-2">
            {t.manualLink} →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={18} className="text-primary" />
          <h1 className="text-[22px] font-bold text-[#52473C]">{t.title}</h1>
        </div>
        <p className="text-[14px] text-[#8A7D6B]">{t.subtitle}</p>
      </div>

      {/* CSM Dropdown */}
      <div className="mb-5">
        <label className="section-subheader">{t.csmLabel}</label>
        <div className="relative">
          <select
            value={selectedOwner?.id || ''}
            onChange={(e) => {
              const owner = owners.find(o => o.id === e.target.value);
              setSelectedOwner(owner || null);
            }}
            className="w-full h-10 px-3 pr-8 rounded-lg border border-[#D9D5CB] bg-[#EEEDE6] text-[14px] text-[#52473C] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">{t.csmPlaceholder}</option>
            {owners.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A7D6B] pointer-events-none" />
        </div>
      </div>

      {/* Client list area */}
      {selectedOwner && (
        <div className="card">
          {phase === 'loading_clients' ? (
            <div className="text-center py-12">
              <Loader2 size={24} className="animate-spin mx-auto text-primary mb-3" />
              <p className="text-[13px] text-[#8A7D6B]">{t.loadingClients}</p>
            </div>
          ) : phase === 'loading_details' ? (
            <div className="text-center py-12">
              <Loader2 size={24} className="animate-spin mx-auto text-primary mb-3" />
              <p className="text-[13px] text-[#8A7D6B]">{t.loadingDetails}</p>
            </div>
          ) : (
            <>
              {/* Search + Sort + Filters */}
              <div className="mb-3 space-y-3">
                {/* Search bar */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A7D6B]" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#D9D5CB] bg-[#EEEDE6] text-[13px] text-[#52473C] placeholder:text-[#8A7D6B] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Sort + Plan filter row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Sort buttons */}
                  <div className="flex items-center gap-1 mr-2">
                    <ArrowUpDown size={12} className="text-[#8A7D6B]" />
                    <button
                      onClick={() => setSortBy('alpha')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                        sortBy === 'alpha' ? 'bg-primary text-white' : 'text-[#8A7D6B] hover:bg-[#E5E1D8]'
                      }`}
                    >
                      {t.sortAlpha}
                    </button>
                    <button
                      onClick={() => setSortBy('mrr')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                        sortBy === 'mrr' ? 'bg-primary text-white' : 'text-[#8A7D6B] hover:bg-[#E5E1D8]'
                      }`}
                    >
                      {t.sortMrr}
                    </button>
                  </div>

                  {/* Plan filter pills */}
                  <div className="flex items-center gap-1">
                    {planFilters.map((plan) => (
                      <button
                        key={plan}
                        onClick={() => setPlanFilter(plan)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                          planFilter === plan
                            ? 'bg-primary/10 text-primary border border-primary/30'
                            : 'text-[#8A7D6B] hover:bg-[#E5E1D8] border border-transparent'
                        }`}
                      >
                        {plan}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Client list */}
              {filteredClients.length === 0 ? (
                <div className="text-center py-8">
                  <Users size={24} className="mx-auto text-[#D9D5CB] mb-2" />
                  <p className="text-[13px] text-[#8A7D6B]">
                    {search ? t.noClientsSearch : t.noClients}
                  </p>
                </div>
              ) : (
                <>
                  <div className="max-h-[480px] overflow-y-auto -mx-1 tier-scroll">
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => handleSelectClient(client)}
                        disabled={loadingClientId === client.id}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#E5E1D8] transition-all text-left group disabled:opacity-60"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-[#52473C] truncate">
                            {client.name}
                          </div>
                          <div className="text-[11px] text-[#8A7D6B] truncate">
                            {[client.domain, client.platform, client.country].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {client.plan && (
                          <span className="pill pill-purple text-[10px] shrink-0">
                            {client.plan}
                          </span>
                        )}
                        {client.mrrCsm > 0 && (
                          <span className="text-[12px] font-medium text-[#645648] shrink-0 tabular-nums">
                            {formatMrr(client.mrrCsm)}
                          </span>
                        )}
                        <ChevronDown size={12} className="text-[#D9D5CB] -rotate-90 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    ))}
                  </div>

                  {/* Counter */}
                  <div className="mt-3 pt-3 border-t border-[#D9D5CB] text-[12px] text-[#8A7D6B] text-center">
                    {t.clientsCount(filteredClients.length, clients.length)}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Manual fallback */}
      <div className="mt-6 text-center">
        <button
          onClick={onSkipToManual}
          className="text-[13px] text-[#645648] hover:text-primary transition-colors inline-flex items-center gap-1"
        >
          {t.manualLink} <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
