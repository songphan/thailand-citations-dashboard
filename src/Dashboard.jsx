import React, { useEffect, useMemo, useState } from 'react';
import {
  Database, Network, AlertCircle, Loader2,
  Calendar, FileText, Building2, BookOpen, Tag,
  BarChart3, Table as TableIcon, GitBranch,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Cell, PieChart, Pie,
  Sankey, Layer, Rectangle,
} from 'recharts';

// ============================================================
// DESIGN TOKENS  (matches the Thailand research dashboard)
// ============================================================
const PALETTE = {
  cream: '#f6f1e7',
  paper: '#fbf8f1',
  ink: '#1a1612',
  charcoal: '#3a342c',
  muted: '#6b6155',
  rule: '#d9cfbe',
  navy: '#1f3a5f',
  burgundy: '#7a2e3e',
  gold: '#b88a3e',
  teal: '#2c5f5d',
  forest: '#4a6b3a',
  rust: '#a55a2c',
  sage: '#7a9079',
  plum: '#5d3a5a',
  ochre: '#c9963f',
};

const FONT_DISPLAY = "'Fraunces', 'Iowan Old Style', Georgia, serif";
const FONT_BODY = "'IBM Plex Sans', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";

// Databases that are hidden in coverage and overlap panels because
// they're substantively redundant with another database in the list.
// ScienceDirect (CU) and ScienceDirect Standard share most of their
// title list; the diff is mostly which titles CU has full-text access
// to versus discoverability-only. Keeping both makes the overlap
// heatmap noisy without adding insight, so we hide the CU view in
// the dashboard. The data is still computed and stays in the JSON
// for the SQL playground or other tools that want it.
const HIDDEN_DATABASE_KEYS = new Set([
  'sciencedirect_cu',
]);

// Publishers whose journals are predominantly or entirely open access,
// meaning Thai institutions don't need a subscription to read them.
// The list is intentionally conservative — only publishers where the
// vast majority of their output is gold OA. Hybrid publishers
// (Elsevier, Springer Nature, Wiley) are NOT included even though
// they have OA journals, because most of their content still sits
// behind paywalls. Match is by lowercased substring of the publisher
// name from OpenAlex.
const OA_ONLY_PUBLISHER_PATTERNS = [
  'mdpi',
  'frontiers',
  'public library of science',
  'plos',
  'hindawi',
  'biomed central',
  'bmc',
  'copernicus',
  'elife',
  'f1000',
  'peerj',
  'beilstein-institut',
  'ubiquity press',
  'open access',
];
const isOAOnlyPublisher = (publisherName) => {
  if (!publisherName) return false;
  const lower = publisherName.toLowerCase();
  return OA_ONLY_PUBLISHER_PATTERNS.some((p) => lower.includes(p));
};

const useFonts = () => {
  useEffect(() => {
    if (document.querySelector('link[data-oar-fonts]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap';
    link.setAttribute('data-oar-fonts', '');
    document.head.appendChild(link);
  }, []);
};

// ============================================================
// FORMATTERS
// ============================================================
const fmt = (n) => {
  if (n === null || n === undefined) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return n.toLocaleString();
};
const fmtFull = (n) => (n ?? 0).toLocaleString();
const fmtPct = (n) => (n ?? 0).toFixed(1) + '%';
const fmtDecimal = (n) => (n ?? 0).toFixed(1);

// ============================================================
// DATA HOOK
// ============================================================
function useDataFiles() {
  const [state, setState] = useState({
    status: 'loading',
    error: null,
    meta: null,
    summary: null,
    coverage: null,
    overlap: null,
    by_year: null,
    by_type: null,
    by_publisher: null,
    institutions: null,
    institution_types: null,
    institution_overlap: null,
    publisher_sankey: null,
  });

  useEffect(() => {
    const base = `${import.meta.env.BASE_URL}data/`;
    // Required files: dashboard cannot render without these
    const requiredFiles = [
      'meta', 'summary', 'coverage', 'overlap',
      'by_year', 'by_type', 'by_publisher',
      'institutions', 'institution_types',
    ];
    // Optional files: load if present, ignore 404 silently
    const optionalFiles = ['institution_overlap', 'publisher_sankey'];

    const loadRequired = Promise.all(
      requiredFiles.map((f) =>
        fetch(`${base}${f}.json`).then((r) => {
          if (!r.ok) throw new Error(`Failed to load ${f}.json (${r.status})`);
          return r.json().then((j) => [f, j]);
        }),
      ),
    );

    const loadOptional = Promise.all(
      optionalFiles.map((f) =>
        fetch(`${base}${f}.json`)
          .then((r) => (r.ok ? r.json().then((j) => [f, j]) : [f, null]))
          .catch(() => [f, null]),
      ),
    );

    Promise.all([loadRequired, loadOptional])
      .then(([req, opt]) => {
        const result = Object.fromEntries([...req, ...opt]);
        setState({ status: 'ready', error: null, ...result });
      })
      .catch((err) => {
        setState((s) => ({ ...s, status: 'error', error: err.message }));
      });
  }, []);

  return state;
}

// ============================================================
// LAYOUT PRIMITIVES
// ============================================================
const Card = ({ children, className = '', style = {} }) => (
  <section
    className={`border ${className}`}
    style={{
      background: PALETTE.paper,
      borderColor: PALETTE.rule,
      ...style,
    }}
  >
    {children}
  </section>
);

const SectionTitle = ({ icon: Icon, kicker, title, hint, totalN, totalLabel }) => (
  <header className="mb-3">
    <div
      className="mb-2 flex items-center gap-2 uppercase"
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        letterSpacing: '0.18em',
        color: PALETTE.muted,
      }}
    >
      {Icon && <Icon size={11} strokeWidth={1.6} />}
      <span>{kicker}</span>
    </div>
    <h2
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 26,
        fontWeight: 500,
        lineHeight: 1.15,
        letterSpacing: '-0.01em',
        color: PALETTE.ink,
      }}
    >
      {title}
    </h2>
    {/* Consistent location for the relevant denominator across every
        panel — sits between the title and the hint. The 'n' notation
        mirrors how a methods section reports sample size. */}
    {totalN != null && (
      <div
        className="mt-1"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: PALETTE.charcoal,
          letterSpacing: '0.02em',
        }}
      >
        n = <strong style={{ color: PALETTE.ink }}>{fmtFull(totalN)}</strong>
        {totalLabel ? ` ${totalLabel}` : ''}
      </div>
    )}
    {hint && (
      <p
        className="mt-1.5"
        style={{
          fontFamily: FONT_BODY,
          fontSize: 13,
          color: PALETTE.muted,
          lineHeight: 1.45,
        }}
      >
        {hint}
      </p>
    )}
  </header>
);

// ============================================================
// CHART/TABLE TOGGLE  (used on most chart panels)
// ============================================================
const ChartTableToggle = ({ mode, onChange }) => {
  const opts = [
    { key: 'chart', icon: BarChart3, label: 'Chart' },
    { key: 'table', icon: TableIcon, label: 'Table' },
  ];
  return (
    <div className="inline-flex" style={{ border: `1px solid ${PALETTE.rule}` }}>
      {opts.map((o, i) => {
        const active = mode === o.key;
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className="flex items-center gap-1.5 px-2.5 py-1 transition-colors"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: active ? PALETTE.ink : 'transparent',
              color: active ? PALETTE.paper : PALETTE.muted,
              border: 'none',
              borderLeft: i > 0 ? `1px solid ${PALETTE.rule}` : 'none',
              cursor: active ? 'default' : 'pointer',
            }}
            aria-pressed={active}
          >
            <Icon size={11} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

// ============================================================
// DATA TABLE  (used inside chart panels when toggled to table view)
// ============================================================
const DataTable = ({ rows, columns, maxHeight = 480 }) => (
  <div style={{ overflowX: 'auto', maxHeight, border: `1px solid ${PALETTE.rule}` }}>
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: FONT_BODY,
        fontSize: 12.5,
      }}
    >
      <thead>
        <tr
          style={{
            background: PALETTE.cream,
            position: 'sticky',
            top: 0,
            zIndex: 1,
            borderBottom: `2px solid ${PALETTE.ink}`,
          }}
        >
          {columns.map((c) => (
            <th
              key={c.key}
              style={{
                textAlign: c.align || 'left',
                padding: '8px 10px',
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.1em',
                color: PALETTE.charcoal,
                textTransform: 'uppercase',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={i}
            style={{
              borderBottom: `1px solid ${PALETTE.rule}`,
              background: i % 2 ? PALETTE.cream : PALETTE.paper,
            }}
          >
            {columns.map((c) => {
              const v = r[c.key];
              const display = c.format ? c.format(v, r) : (v ?? '');
              return (
                <td
                  key={c.key}
                  style={{
                    textAlign: c.align || 'left',
                    padding: '6px 10px',
                    color: PALETTE.charcoal,
                    fontFamily: c.mono ? FONT_MONO : FONT_BODY,
                    fontSize: c.mono ? 11.5 : 12.5,
                    whiteSpace: c.wrap ? 'normal' : 'nowrap',
                    maxWidth: c.maxWidth || undefined,
                    overflow: c.maxWidth ? 'hidden' : undefined,
                    textOverflow: c.maxWidth ? 'ellipsis' : undefined,
                  }}
                  title={typeof display === 'string' ? display : undefined}
                >
                  {display}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ============================================================
// INSTITUTION SELECTOR  (replaces the old All-Thailand vs CU toggle)
// ============================================================
const InstitutionSelector = ({ view, onChange, institutionViews }) => (
  <div className="flex flex-col gap-1.5">
    <label
      htmlFor="inst-select"
      className="uppercase"
      style={{
        fontFamily: FONT_MONO,
        fontSize: 9,
        letterSpacing: '0.16em',
        color: PALETTE.muted,
      }}
    >
      Citing institution
    </label>
    <select
      id="inst-select"
      value={view}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontFamily: FONT_MONO,
        fontSize: 12,
        letterSpacing: '0.04em',
        padding: '8px 28px 8px 12px',
        background: PALETTE.paper,
        color: PALETTE.ink,
        border: `1px solid ${PALETTE.ink}`,
        borderRadius: 0,
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%231a1612' d='M0 0l5 6 5-6z'/></svg>\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        minWidth: 280,
      }}
    >
      <option value="all_thailand">All Thailand</option>
      {institutionViews && institutionViews.length > 0 && (
        <optgroup label="Top citing institutions">
          {institutionViews.map((iv) => (
            <option key={iv.id} value={iv.id}>
              {iv.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  </div>
);

// ============================================================
// TOP STATS STRIP
// ============================================================
const StatBlock = ({ label, value, sublabel, benchmark, accent = PALETTE.ink }) => (
  <div className="flex flex-col gap-1 px-5 py-4">
    <div
      className="uppercase"
      style={{
        fontFamily: FONT_MONO,
        fontSize: 9,
        letterSpacing: '0.18em',
        color: PALETTE.muted,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 30,
        fontWeight: 500,
        lineHeight: 1,
        color: accent,
        letterSpacing: '-0.02em',
      }}
    >
      {value}
    </div>
    {sublabel && (
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 11,
          color: PALETTE.muted,
        }}
      >
        {sublabel}
      </div>
    )}
    {benchmark && (
      <div
        className="mt-1"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          color: PALETTE.charcoal,
          paddingTop: 4,
          borderTop: `1px dashed ${PALETTE.rule}`,
          letterSpacing: '0.02em',
        }}
      >
        {benchmark}
      </div>
    )}
  </div>
);

const TopStats = ({ summary, view, viewLabel }) => {
  if (!summary) return null;
  const s = summary[view];
  const t = summary.all_thailand;
  if (!s) return null;
  const isFiltered = view !== 'all_thailand';

  // Benchmarks comparing the selected institution against all_thailand.
  // Only shown when the view is not all_thailand itself.
  const shareOf = (mine, total) =>
    `${((mine / total) * 100).toFixed(1)}% of TH (${fmt(total)})`;
  const vsAvg = (thAvg) => `TH avg: ${fmtDecimal(thAvg)}`;
  const vsPct = (thPct) => `TH: ${fmtPct(thPct)}`;

  return (
    <Card className="p-0">
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
        style={{ borderColor: PALETTE.rule }}
      >
        <div style={{ borderRight: `1px solid ${PALETTE.rule}` }}>
          <StatBlock
            label="Citing publications"
            value={fmt(s.n_seeds)}
            sublabel={`${fmtFull(s.n_seeds)} papers`}
            benchmark={isFiltered ? shareOf(s.n_seeds, t.n_seeds) : null}
            accent={PALETTE.navy}
          />
        </div>
        <div style={{ borderRight: `1px solid ${PALETTE.rule}` }}>
          <StatBlock
            label="Total citations"
            value={fmt(s.n_total_edges)}
            sublabel={fmtFull(s.n_total_edges)}
            benchmark={isFiltered ? shareOf(s.n_total_edges, t.n_total_edges) : null}
            accent={PALETTE.burgundy}
          />
        </div>
        <div style={{ borderRight: `1px solid ${PALETTE.rule}` }}>
          <StatBlock
            label="Avg citations / paper"
            value={fmtDecimal(s.avg_per_paper)}
            sublabel="across all cited types"
            benchmark={isFiltered ? vsAvg(t.avg_per_paper) : null}
            accent={PALETTE.gold}
          />
        </div>
        <div style={{ borderRight: `1px solid ${PALETTE.rule}` }}>
          <StatBlock
            label="Unique cited works"
            value={fmt(s.n_unique_cited)}
            sublabel={`${((s.n_unique_cited / s.n_total_edges) * 100).toFixed(1)}% of citations`}
            benchmark={isFiltered ? shareOf(s.n_unique_cited, t.n_unique_cited) : null}
            accent={PALETTE.teal}
          />
        </div>
        <div className="col-span-2 md:col-span-3 lg:col-span-1">
          <StatBlock
            label="Books / Chapters"
            value={fmtPct(s.pct_books)}
            sublabel={`${fmtFull(s.n_books_chapters)} citations`}
            benchmark={isFiltered ? vsPct(t.pct_books) : null}
            accent={PALETTE.forest}
          />
        </div>
      </div>
    </Card>
  );
};

// ============================================================
// COVERAGE TABLE  (with type filter, no subscription column)
// ============================================================
const TYPE_COLORS = {
  open_access: PALETTE.forest,
  abstract_index: PALETTE.navy,
  full_text: PALETTE.burgundy,
};
const TYPE_LABELS = {
  open_access: 'Open access',
  abstract_index: 'Index',
  full_text: 'Full text',
};

const CoverageBar = ({ value, color, thBenchmark }) => {
  // Decide where to place the percentage label so it's always visible:
  // - if the bar is wide enough (>= 80%), put the label INSIDE the bar
  //   at its right edge, in cream text on the colored fill
  // - otherwise, put it just OUTSIDE the bar end, in dark text on the
  //   cream container background
  const showInside = value >= 80;
  return (
    <div
      className="relative"
      style={{
        width: '100%',
        height: 18,
        background: PALETTE.cream,
      }}
    >
      <div
        style={{
          width: `${Math.min(value, 100)}%`,
          height: '100%',
          background: color,
          transition: 'width 400ms ease',
        }}
      />
      {/* Thailand baseline marker: vertical line + small "TH" label.
          The label makes the marker self-documenting; native title
          attribute provides an exact hover readout. */}
      {thBenchmark != null && (
        <>
          <div
            title={`All Thailand baseline: ${thBenchmark.toFixed(1)}%`}
            style={{
              position: 'absolute',
              left: `${Math.min(thBenchmark, 100)}%`,
              top: -4,
              bottom: -4,
              width: 2,
              background: PALETTE.gold,
              transform: 'translateX(-1px)',
              cursor: 'help',
              zIndex: 2,
            }}
          />
          <div
            title={`All Thailand baseline: ${thBenchmark.toFixed(1)}%`}
            style={{
              position: 'absolute',
              // Position label above the bar; nudge left so the "TH"
              // sits centered above the line.
              left: `${Math.min(thBenchmark, 100)}%`,
              top: -14,
              transform: 'translateX(-50%)',
              fontFamily: FONT_MONO,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: PALETTE.gold,
              cursor: 'help',
              whiteSpace: 'nowrap',
              zIndex: 2,
            }}
          >
            TH
          </div>
        </>
      )}
      <span
        className="absolute"
        style={{
          ...(showInside
            ? { right: 6, color: PALETTE.paper }
            : {
                left: `calc(${Math.min(value, 100)}% + 5px)`,
                color: PALETTE.charcoal,
              }),
          top: '50%',
          transform: 'translateY(-50%)',
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          // Slight halo so the percentage stays readable if it lands
          // visually close to the gold marker
          textShadow: showInside
            ? 'none'
            : '0 0 2px rgba(251,248,241,0.9)',
          zIndex: 1,
        }}
      >
        {value.toFixed(1)}%
      </span>
    </div>
  );
};

const FilterPill = ({ label, active, onClick, color }) => (
  <button
    onClick={onClick}
    className="px-3 py-1.5 transition-colors"
    style={{
      fontFamily: FONT_MONO,
      fontSize: 10,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      background: active ? (color || PALETTE.ink) : 'transparent',
      color: active ? PALETTE.paper : PALETTE.charcoal,
      border: `1px solid ${active ? (color || PALETTE.ink) : PALETTE.rule}`,
      cursor: active ? 'default' : 'pointer',
    }}
  >
    {label}
  </button>
);

const CoverageTable = ({ coverage, summary, view }) => {
  const [typeFilter, setTypeFilter] = useState('all');
  if (!coverage || !coverage[view]) return null;
  const data = coverage[view];
  const isFiltered = view !== 'all_thailand';

  // Build a lookup for Thailand baseline percentages so each row can show a marker
  const thBaseline = useMemo(() => {
    if (!isFiltered) return null;
    const t = coverage.all_thailand;
    if (!t) return null;
    const map = {};
    for (const d of t.databases) map[d.key] = d.edges_pct;
    return map;
  }, [coverage, isFiltered]);

  const dbs = useMemo(() => {
    const visible = data.databases.filter((d) => !HIDDEN_DATABASE_KEYS.has(d.key));
    const filtered = typeFilter === 'all'
      ? visible
      : visible.filter((d) => d.type === typeFilter);
    return [...filtered].sort((a, b) => {
      // Open access sorts first within its type group; otherwise by edges_pct
      if (a.type === 'open_access' && b.type !== 'open_access') return -1;
      if (b.type === 'open_access' && a.type !== 'open_access') return 1;
      return b.edges_pct - a.edges_pct;
    });
  }, [data, typeFilter]);

  return (
    <Card className="p-5">
      <SectionTitle
        icon={Database}
        kicker="Database coverage"
        title="What fraction of citations is reachable through each database"
        totalN={summary && summary[view] ? summary[view].n_total_edges : null}
        totalLabel="citations"
        hint={
          isFiltered
            ? 'Matched on normalized ISSN against the public title list of each database. The gold marker on each bar shows the All Thailand baseline for that database, so you can see whether this institution leans on a database more or less than Thailand as a whole.'
            : 'Matched on normalized ISSN against the public title list of each database. This shows the technical coverage potential of each database, not whether a particular library subscribes to it.'
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.16em',
            color: PALETTE.muted,
            textTransform: 'uppercase',
            marginRight: 6,
          }}
        >
          Filter
        </span>
        <FilterPill label="All" active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} />
        <FilterPill
          label="Open access"
          active={typeFilter === 'open_access'}
          color={TYPE_COLORS.open_access}
          onClick={() => setTypeFilter('open_access')}
        />
        <FilterPill
          label="Index"
          active={typeFilter === 'abstract_index'}
          color={TYPE_COLORS.abstract_index}
          onClick={() => setTypeFilter('abstract_index')}
        />
        <FilterPill
          label="Full text"
          active={typeFilter === 'full_text'}
          color={TYPE_COLORS.full_text}
          onClick={() => setTypeFilter('full_text')}
        />
      </div>
      <div className="overflow-x-auto" style={{ fontFamily: FONT_BODY, fontSize: 13 }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.12em',
                color: PALETTE.muted,
                textTransform: 'uppercase',
              }}
            >
              <th style={cellHead}>Database</th>
              <th style={{ ...cellHead, width: 90 }}>Type</th>
              <th style={{ ...cellHead, width: 110, textAlign: 'right' }}>Citations</th>
              <th style={{ ...cellHead, width: isFiltered ? '34%' : '36%' }}>
                Citation coverage
              </th>
              {isFiltered && (
                <th
                  style={{ ...cellHead, width: 90, textAlign: 'right' }}
                  title="Difference between this institution's coverage and the All Thailand baseline. Positive values mean this institution leans more on this database than Thailand as a whole."
                >
                  Diff vs TH
                </th>
              )}
              <th style={{ ...cellHead, width: 110, textAlign: 'right' }}>Unique</th>
            </tr>
          </thead>
          <tbody>
            {dbs.map((d) => {
              const thPct = thBaseline ? thBaseline[d.key] : null;
              const diff = thPct != null ? d.edges_pct - thPct : null;
              return (
                <tr key={d.key} style={{ borderTop: `1px solid ${PALETTE.rule}` }}>
                  <td style={cellBody}>
                    <span style={{ color: PALETTE.ink, fontWeight: 500 }}>{d.label}</span>
                  </td>
                  <td style={cellBody}>
                    <span
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: TYPE_COLORS[d.type],
                        padding: '2px 6px',
                        border: `1px solid ${TYPE_COLORS[d.type]}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {TYPE_LABELS[d.type]}
                    </span>
                  </td>
                  <td style={{ ...cellBody, textAlign: 'right', fontFamily: FONT_MONO }}>
                    {fmtFull(d.edges)}
                  </td>
                  <td style={{ ...cellBody, paddingTop: isFiltered ? 18 : 10 }}>
                    <CoverageBar
                      value={d.edges_pct}
                      color={TYPE_COLORS[d.type]}
                      thBenchmark={thPct}
                    />
                  </td>
                  {isFiltered && (
                    <td
                      style={{
                        ...cellBody,
                        textAlign: 'right',
                        fontFamily: FONT_MONO,
                        fontSize: 11,
                      }}
                      title={
                        diff != null
                          ? `This institution: ${d.edges_pct.toFixed(1)}%  ·  All Thailand: ${(thPct ?? 0).toFixed(1)}%`
                          : 'No All Thailand baseline available for this database'
                      }
                    >
                      {diff != null ? (
                        <span
                          style={{
                            color:
                              Math.abs(diff) < 0.5
                                ? PALETTE.muted
                                : diff > 0
                                ? PALETTE.forest
                                : PALETTE.rust,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            justifyContent: 'flex-end',
                          }}
                        >
                          <span style={{ fontSize: 10 }}>
                            {Math.abs(diff) < 0.5 ? '≈' : diff > 0 ? '↑' : '↓'}
                          </span>
                          <span>{Math.abs(diff).toFixed(1)}%</span>
                        </span>
                      ) : (
                        <span style={{ color: PALETTE.muted }}>—</span>
                      )}
                    </td>
                  )}
                  <td
                    style={{
                      ...cellBody,
                      textAlign: 'right',
                      fontFamily: FONT_MONO,
                      color: PALETTE.muted,
                    }}
                  >
                    {fmtFull(d.unique)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        className="mt-4 flex items-center gap-4 flex-wrap"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          letterSpacing: '0.12em',
          color: PALETTE.muted,
          textTransform: 'uppercase',
        }}
      >
        {isFiltered && (
          <span
            className="inline-flex items-center gap-2"
            style={{ textTransform: 'none' }}
          >
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 8,
                fontWeight: 700,
                color: PALETTE.gold,
                letterSpacing: '0.06em',
              }}
            >
              TH
            </span>
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: 12,
                background: PALETTE.gold,
              }}
            />
            <span style={{ textTransform: 'uppercase' }}>
              The "TH" marker on each bar is the All Thailand baseline. Hover for the exact percentage.
            </span>
          </span>
        )}
        <span>
          Note · EBSCO ASC/ASP/ASU share the same indexing universe but differ in their full-text holdings
        </span>
      </div>
    </Card>
  );
};

const cellHead = {
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: `1px solid ${PALETTE.rule}`,
  fontWeight: 400,
};
const cellBody = {
  padding: '10px 8px',
  verticalAlign: 'middle',
};

// ============================================================
// OVERLAP HEATMAP  (full width, percentage-based, public data)
// ============================================================
const OverlapHeatmap = ({ overlap, meta, summary }) => {
  // This panel always uses the all_thailand data, regardless of the
  // institution filter. Database overlap is a structural property of
  // the databases themselves and shouldn't change when the user filters
  // by citing institution. Placing this above the filter visually
  // reinforces that.
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedCell, setSelectedCell] = useState(null);

  if (!overlap || !overlap.all_thailand) return null;
  const o = overlap.all_thailand;

  // Filter by database type using meta.databases lookup. When showing
  // all types, group databases by type (open access → index → full text)
  // so visually similar databases sit next to each other in the matrix.
  // Also filter out HIDDEN_DATABASE_KEYS (e.g., ScienceDirect (CU))
  // because they're substantively redundant with another database in
  // the list, which makes the overlap heatmap noisier without adding
  // insight.
  const { labels, matrix, dbKeys } = useMemo(() => {
    const typeByKey = {};
    if (meta && meta.databases) {
      for (const d of meta.databases) typeByKey[d.key] = d.type;
    }
    // First, drop hidden databases entirely from consideration.
    let indices = o.databases
      .map((k, i) => (HIDDEN_DATABASE_KEYS.has(k) ? -1 : i))
      .filter((i) => i !== -1);
    if (typeFilter !== 'all') {
      indices = indices.filter((i) => typeByKey[o.databases[i]] === typeFilter);
    } else {
      // Sort by type group, then by label within each group
      const TYPE_ORDER = { open_access: 0, abstract_index: 1, full_text: 2 };
      indices = [...indices].sort((a, b) => {
        const ta = TYPE_ORDER[typeByKey[o.databases[a]]] ?? 99;
        const tb = TYPE_ORDER[typeByKey[o.databases[b]]] ?? 99;
        if (ta !== tb) return ta - tb;
        return o.labels[a].localeCompare(o.labels[b]);
      });
    }
    return {
      labels: indices.map((i) => o.labels[i]),
      matrix: indices.map((i) => indices.map((j) => o.matrix[i][j])),
      dbKeys: indices.map((i) => o.databases[i]),
    };
  }, [o, meta, typeFilter]);

  const pctMatrix = useMemo(() => {
    return matrix.map((row, i) => {
      const denom = matrix[i][i] || 1;
      return row.map((v) => (v / denom) * 100);
    });
  }, [matrix]);

  // Map each visible database to its type's color, for label coloring
  const labelColors = useMemo(() => {
    const typeByKey = {};
    if (meta && meta.databases) {
      for (const d of meta.databases) typeByKey[d.key] = d.type;
    }
    return dbKeys.map((k) => TYPE_COLORS[typeByKey[k]] || PALETTE.charcoal);
  }, [dbKeys, meta]);

  // Reset selection when filter changes (it might no longer be valid)
  useEffect(() => {
    setSelectedCell(null);
  }, [typeFilter]);

  const colorFor = (pct, isDiag, isSelected) => {
    if (isSelected) return PALETTE.ink;
    if (pct === 0) return PALETTE.cream;
    const ratio = Math.min(pct / 100, 1);
    const hue = isDiag ? PALETTE.gold : PALETTE.burgundy;
    const a = Math.round((0.1 + ratio * 0.9) * 255);
    return `${hue}${a.toString(16).padStart(2, '0')}`;
  };

  const detail = selectedCell
    ? {
        rowLabel: labels[selectedCell.i],
        colLabel: labels[selectedCell.j],
        pct: pctMatrix[selectedCell.i][selectedCell.j],
        raw: matrix[selectedCell.i][selectedCell.j],
        rowTotal: matrix[selectedCell.i][selectedCell.i],
      }
    : null;

  return (
    <Card className="p-5">
      <SectionTitle
        icon={Network}
        kicker="Database overlap · All Thailand"
        title="How much do databases redundantly cover the same citations"
        totalN={summary && summary.all_thailand ? summary.all_thailand.n_total_edges : null}
        totalLabel="citations"
        hint={
          'Each cell shows what percentage of one database\'s coverage (the row) is also covered by another database (the column). ' +
          'Numbers are based on the public title lists of each database, not on any specific institution\'s subscriptions. ' +
          'Click a cell to see the underlying counts. This panel reflects all-Thailand citations and does not change with the institution filter.'
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.16em',
            color: PALETTE.muted,
            textTransform: 'uppercase',
            marginRight: 6,
          }}
        >
          Filter
        </span>
        <FilterPill label="All" active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} />
        <FilterPill
          label="Open access"
          active={typeFilter === 'open_access'}
          color={TYPE_COLORS.open_access}
          onClick={() => setTypeFilter('open_access')}
        />
        <FilterPill
          label="Index"
          active={typeFilter === 'abstract_index'}
          color={TYPE_COLORS.abstract_index}
          onClick={() => setTypeFilter('abstract_index')}
        />
        <FilterPill
          label="Full text"
          active={typeFilter === 'full_text'}
          color={TYPE_COLORS.full_text}
          onClick={() => setTypeFilter('full_text')}
        />
      </div>

      {labels.length < 2 ? (
        <div
          className="p-6 text-center"
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: PALETTE.muted,
            background: PALETTE.cream,
            border: `1px dashed ${PALETTE.rule}`,
          }}
        >
          Only one database matches this filter, so there's no overlap to show.
          Try a different filter or select All.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            style={{
              borderCollapse: 'collapse',
              fontFamily: FONT_MONO,
              fontSize: 10,
              margin: '0 auto',
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: 4 }}></th>
                {labels.map((label, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '4px 2px',
                      height: 140,
                      verticalAlign: 'bottom',
                      textAlign: 'left',
                      color: labelColors[i],
                      fontWeight: 500,
                      minWidth: 36,
                    }}
                  >
                    <div
                      style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((rowLabel, i) => (
                <tr key={i}>
                  <th
                    style={{
                      padding: '4px 8px',
                      textAlign: 'right',
                      fontWeight: 500,
                      color: labelColors[i],
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rowLabel}
                  </th>
                  {labels.map((_, j) => {
                    const pct = pctMatrix[i][j];
                    const isDiag = i === j;
                    const isSelected = selectedCell &&
                      selectedCell.i === i && selectedCell.j === j;
                    return (
                      <td
                        key={j}
                        onClick={() => {
                          if (isSelected) setSelectedCell(null);
                          else setSelectedCell({ i, j });
                        }}
                        style={{
                          width: 36,
                          height: 30,
                          textAlign: 'center',
                          background: colorFor(pct, isDiag, isSelected),
                          color:
                            isSelected
                              ? PALETTE.paper
                              : pct > 50
                                ? PALETTE.paper
                                : PALETTE.charcoal,
                          border: isSelected
                            ? `2px solid ${PALETTE.ink}`
                            : `1px solid ${PALETTE.paper}`,
                          cursor: 'pointer',
                          fontSize: 9.5,
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        {pct >= 1 ? Math.round(pct) : pct > 0 ? '<1' : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel for the clicked cell */}
      {detail && (
        <div
          className="mt-4 p-4"
          style={{
            background: PALETTE.cream,
            border: `1px solid ${PALETTE.ink}`,
          }}
        >
          <div
            className="uppercase mb-2"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              letterSpacing: '0.18em',
              color: PALETTE.muted,
            }}
          >
            Selected cell
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 18,
              fontWeight: 500,
              color: PALETTE.ink,
              lineHeight: 1.3,
            }}
          >
            <span style={{ color: PALETTE.burgundy }}>{detail.rowLabel}</span>
            <span style={{ color: PALETTE.muted, fontSize: 14 }}> → </span>
            <span style={{ color: PALETTE.navy }}>{detail.colLabel}</span>
          </div>
          <div
            className="mt-3 flex flex-wrap gap-x-6 gap-y-2"
            style={{ fontFamily: FONT_BODY, fontSize: 13, color: PALETTE.charcoal }}
          >
            <div>
              <span style={{ color: PALETTE.muted }}>Overlap: </span>
              <strong style={{ fontFamily: FONT_MONO }}>
                {detail.pct.toFixed(2)}%
              </strong>
            </div>
            <div>
              <span style={{ color: PALETTE.muted }}>Shared works: </span>
              <strong style={{ fontFamily: FONT_MONO }}>{fmtFull(detail.raw)}</strong>
            </div>
            <div>
              <span style={{ color: PALETTE.muted }}>Out of: </span>
              <strong style={{ fontFamily: FONT_MONO }}>
                {fmtFull(detail.rowTotal)}
              </strong>
              <span style={{ color: PALETTE.muted }}> in {detail.rowLabel}</span>
            </div>
          </div>
          <button
            onClick={() => setSelectedCell(null)}
            className="mt-3"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: 'transparent',
              color: PALETTE.muted,
              border: `1px solid ${PALETTE.rule}`,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            Clear selection
          </button>
        </div>
      )}

      <div
        className="mt-4 flex items-center gap-4 flex-wrap"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          letterSpacing: '0.12em',
          color: PALETTE.muted,
          textTransform: 'uppercase',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              background: PALETTE.gold,
            }}
          />
          Diagonal (100% self-coverage)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              background: PALETTE.burgundy,
            }}
          />
          Pairwise overlap
        </span>
        {/* Database label color key */}
        <span
          className="inline-flex items-center gap-1.5"
          style={{ color: TYPE_COLORS.open_access }}
        >
          ▮ Open access
        </span>
        <span
          className="inline-flex items-center gap-1.5"
          style={{ color: TYPE_COLORS.abstract_index }}
        >
          ▮ Index
        </span>
        <span
          className="inline-flex items-center gap-1.5"
          style={{ color: TYPE_COLORS.full_text }}
        >
          ▮ Full text
        </span>
        <span>Row → column · Click any cell for details</span>
      </div>
    </Card>
  );
};

// ============================================================
// PUBLISHER SANKEY  (alluvial flow diagram)
// ============================================================
// Shows citation flows from seed publishers (publishers of Thai 2025
// papers) on the left to cited publishers on the right. Each strand's
// thickness is proportional to the number of citation edges between
// that pair of publishers. Top 12 publishers on each side are kept by
// name; the rest are rolled into "Other publishers". Tiny links are
// dropped at compute time so the diagram stays readable.
//
// This is a panoramic view (always all_thailand). The data file is
// `publisher_sankey.json`. The whole panel renders nothing if the
// file is missing or empty so it's safe to deploy the JSX before
// regenerating data.

// Custom node renderer: a small rectangle plus a label outside the
// chart area so long publisher names don't overlap the bars.
const SankeyNode = ({
  x, y, width, height, index, payload, containerWidth,
  onNodeClick, selectedNodeIndex,
}) => {
  const isLeft = x < containerWidth / 2;
  const baseColor = payload.side === 'seed' ? PALETTE.navy : PALETTE.burgundy;
  const isSelected = selectedNodeIndex === index;
  const isOther = payload.name === 'Other publishers';
  // Selected node gets full saturation + stroke; non-selected fade
  // slightly when SOMETHING is selected (so the chosen node pops).
  const anySelected = selectedNodeIndex != null;
  const fillOpacity = isSelected ? 1 : (anySelected ? 0.35 : (isOther ? 0.4 : 0.85));
  const labelColor = isSelected
    ? PALETTE.ink
    : isOther
    ? PALETTE.muted
    : PALETTE.charcoal;
  const handleClick = () => {
    if (onNodeClick) onNodeClick(index);
  };
  return (
    <Layer key={`sankey-node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={baseColor}
        fillOpacity={fillOpacity}
        stroke={isSelected ? PALETTE.ink : 'none'}
        strokeWidth={isSelected ? 2 : 0}
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
      />
      <text
        x={isLeft ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={isLeft ? 'end' : 'start'}
        dominantBaseline="middle"
        onClick={handleClick}
        style={{
          fontFamily: FONT_BODY,
          fontSize: 11,
          fill: labelColor,
          fontStyle: isOther ? 'italic' : 'normal',
          fontWeight: isSelected ? 600 : 400,
          cursor: 'pointer',
          // The label gets a subtle dotted underline to hint that it's
          // clickable. Selected labels switch to a solid underline.
          textDecoration: isSelected ? 'underline' : 'underline dotted',
          textDecorationColor: isSelected ? PALETTE.ink : PALETTE.rule,
          textUnderlineOffset: 3,
        }}
      >
        {payload.name}
      </text>
      {/* Total count under each label, in monospace */}
      <text
        x={isLeft ? x - 6 : x + width + 6}
        y={y + height / 2 + 14}
        textAnchor={isLeft ? 'end' : 'start'}
        dominantBaseline="middle"
        onClick={handleClick}
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          fill: PALETTE.muted,
          letterSpacing: '0.04em',
          cursor: 'pointer',
        }}
      >
        {fmtFull(payload.value || 0)}
      </text>
    </Layer>
  );
};

// Custom link renderer: gradient strand from navy to burgundy, opacity
// scaled to draw the eye toward thicker flows.
const SankeyLink = (props) => {
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX,
    linkWidth, index, payload, selectedNodeName, selectedNodeSide } = props;
  // Cubic bezier path between the source and target points.
  const path = `
    M${sourceX},${sourceY}
    C${sourceControlX},${sourceY}
     ${targetControlX},${targetY}
     ${targetX},${targetY}
  `;
  // Match by name+side, not by index. Recharts strips the integer
  // source/target indices from the link payload and replaces them
  // with the source/target NODE OBJECTS, which don't carry an
  // .index property — so any code that read payload.source.index
  // got undefined and isConnected was always false. Each link's
  // source is always a 'seed' node and target always 'cited', so
  // we just check the appropriate side based on the selection.
  const anySelected = selectedNodeName != null;
  const isConnected = anySelected && (
    (selectedNodeSide === 'seed' && payload?.source?.name === selectedNodeName) ||
    (selectedNodeSide === 'cited' && payload?.target?.name === selectedNodeName)
  );
  // When nothing is selected: every band at moderate opacity.
  // When something IS selected: connected bands pop to full opacity
  // and the gradient saturates; unconnected ones fade almost to
  // nothing so the selected publisher's flows are unmistakable.
  const opacity = !anySelected ? 0.7 : (isConnected ? 1.0 : 0.04);
  return (
    <Layer key={`sankey-link-${index}`}>
      <defs>
        <linearGradient id={`grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop
            offset="0%"
            stopColor={PALETTE.navy}
            stopOpacity={isConnected && anySelected ? 0.85 : 0.55}
          />
          <stop
            offset="100%"
            stopColor={PALETTE.burgundy}
            stopOpacity={isConnected && anySelected ? 0.85 : 0.55}
          />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={`url(#grad-${index})`}
        strokeWidth={linkWidth}
        strokeOpacity={opacity}
        style={{ transition: 'stroke-opacity 200ms' }}
      />
    </Layer>
  );
};

const PublisherSankey = ({ publisherSankey, view, viewLabel, isFiltered }) => {
  // Resolve the per-view sankey from the data file. Two shapes are
  // supported for backward compatibility:
  //   1. New (view-keyed): { all_thailand: {nodes,links,meta}, I158708052: {...}, type:education: {...} }
  //   2. Legacy (flat object with nodes/links/meta directly)
  // The legacy fallback lets old data files keep working while the user
  // regenerates with the new pipeline.
  const data = useMemo(() => {
    if (!publisherSankey) return null;
    // Heuristic: if it has a top-level `nodes` array, it's the legacy
    // flat shape. Otherwise it's view-keyed.
    if (Array.isArray(publisherSankey.nodes)) return publisherSankey;
    return publisherSankey[view] || publisherSankey.all_thailand || null;
  }, [publisherSankey, view]);

  // Hooks always run; null guard is below them.
  const hasData = data && Array.isArray(data.nodes) && data.nodes.length > 0
    && Array.isArray(data.links) && data.links.length > 0;

  const [selectedNode, setSelectedNode] = useState(null);
  // Reset selection when the view changes, so a stale selectedNode
  // index from a different view's nodes array doesn't point at the
  // wrong publisher.
  useEffect(() => {
    setSelectedNode(null);
  }, [view]);

  // Recharts mutates the data it's given, so we deep-clone via JSON
  // round-trip. Cheap (a few hundred objects) and avoids subtle bugs
  // where the second render sees a mutated first-render structure.
  //
  // We also sort links by VALUE ASCENDING so smallest go to the bottom
  // of the SVG layer stack and largest go on top. The pipeline emits
  // links sorted by value descending — fine for tooltips and the data
  // dump but the wrong order for SVG painters because earlier elements
  // get painted under later ones. Reversing here means the dominant
  // bands (Elsevier→Elsevier, etc.) sit on top of the criss-crossing
  // smaller ones rather than being obscured by them.
  const sankeyData = useMemo(() => {
    if (!hasData) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links
        .map((l) => ({ ...l }))
        .sort((a, b) => a.value - b.value),
    };
  }, [data, hasData]);

  // For the selected node, build a sorted breakdown of its connected
  // counterparts on the other side. Memoized so it only re-runs when
  // the selection or the underlying data changes.
  const detail = useMemo(() => {
    if (!hasData || selectedNode == null) return null;
    const nodes = data.nodes;
    const links = data.links;
    const node = nodes[selectedNode];
    if (!node) return null;
    const isSeedSide = node.side === 'seed';

    // Collect all flows that touch the selected node, on the OTHER side.
    const rows = [];
    for (const l of links) {
      const sIdx = typeof l.source === 'object' ? l.source.index : l.source;
      const tIdx = typeof l.target === 'object' ? l.target.index : l.target;
      if (isSeedSide && sIdx === selectedNode) {
        rows.push({ otherIdx: tIdx, value: l.value });
      } else if (!isSeedSide && tIdx === selectedNode) {
        rows.push({ otherIdx: sIdx, value: l.value });
      }
    }
    const total = rows.reduce((s, r) => s + r.value, 0);
    const enriched = rows.map((r) => {
      const other = nodes[r.otherIdx];
      return {
        otherIdx: r.otherIdx,
        otherName: other?.name ?? '(unknown)',
        otherIsOther: other?.name === 'Other publishers',
        value: r.value,
        pct_of_node: total ? (r.value / total) * 100 : 0,
      };
    });
    enriched.sort((a, b) => b.value - a.value);
    return {
      anchor: node,
      anchorIsSeedSide: isSeedSide,
      total,
      rows: enriched,
    };
  }, [data, hasData, selectedNode]);

  if (!data) return null;

  // If the pipeline emitted a warning (no publisher column on seeds),
  // show an explanatory placeholder rather than a broken chart.
  if (data.meta && data.meta.warning) {
    return (
      <Card className="p-5">
        <SectionTitle
          icon={GitBranch}
          kicker="Publisher flow"
          title="Citations from Thai publications to cited publishers"
          hint="A Sankey diagram showing how citations flow from publishers of Thai 2025 papers to publishers of cited works."
        />
        <div
          className="p-6 text-center"
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: PALETTE.muted,
            background: PALETTE.cream,
            border: `1px dashed ${PALETTE.rule}`,
            marginTop: 16,
          }}
        >
          {data.meta.warning}
        </div>
      </Card>
    );
  }

  // The view-keyed pipeline returns an empty stub for views with no
  // matching edges (rare but possible for very narrow institution
  // scopes). Show a friendly note instead of a blank panel.
  if (data.meta && data.meta.empty) {
    return (
      <Card className="p-5">
        <SectionTitle
          icon={GitBranch}
          kicker="Publisher flow"
          title="Citations from Thai publications to cited publishers"
          hint="No publisher metadata is available for the publications in the current filter."
        />
      </Card>
    );
  }

  if (!hasData) return null;

  const m = data.meta || {};

  return (
    <Card className="p-5">
      <SectionTitle
        icon={GitBranch}
        kicker="Publisher flow"
        title={
          isFiltered && viewLabel
            ? `Citations from ${viewLabel} to cited publishers`
            : 'Citations from Thai publications to cited publishers'
        }
        totalN={m.total_edges_with_both_publishers}
        totalLabel={`citations with publisher metadata on both sides (${m.coverage_pct}% of this view's citations)`}
        hint={
          (isFiltered
            ? `For the publications in the current filter, each strand is a flow from one seed publisher (left, navy) to one cited publisher (right, burgundy); thickness is proportional to the number of citation edges. The top ${Math.max(0, (m.n_seed_publishers_shown || 1) - 1)} publishers on each side ARE COMPUTED PER VIEW so they reflect this institution's or sector's actual top journals — not the country-wide list. Everything outside the top is rolled into "Other publishers". Click any publisher label to see its detailed flow breakdown.`
            : `Each strand is a flow from one seed publisher (left, navy) to one cited publisher (right, burgundy); thickness is proportional to the number of citation edges between them. Top ${Math.max(0, (m.n_seed_publishers_shown || 1) - 1)} publishers on each side are shown by name; the rest are aggregated into "Other publishers" buckets. Click any publisher label to see its detailed flow breakdown. Hover a strand for exact counts.`)
        }
      />

      <div
        className="mb-4 flex flex-wrap items-center gap-3"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          letterSpacing: '0.12em',
          color: PALETTE.muted,
          textTransform: 'uppercase',
        }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span style={{
            display: 'inline-block', width: 14, height: 9,
            background: PALETTE.navy,
          }} />
          Seed publishers (Thai 2025 papers)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{
            display: 'inline-block', width: 14, height: 9,
            background: PALETTE.burgundy,
          }} />
          Cited publishers
        </span>
        {selectedNode != null && (
          <button
            onClick={() => setSelectedNode(null)}
            className="px-2 py-0.5"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: PALETTE.muted,
              background: 'transparent',
              border: `1px solid ${PALETTE.rule}`,
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Clear selection
          </button>
        )}
      </div>

      <div style={{ width: '100%', height: 600 }}>
        <ResponsiveContainer>
          <Sankey
            data={sankeyData}
            node={(
              <SankeyNode
                containerWidth={1200}
                onNodeClick={(idx) =>
                  setSelectedNode((prev) => (prev === idx ? null : idx))
                }
                selectedNodeIndex={selectedNode}
              />
            )}
            link={(
              <SankeyLink
                selectedNodeName={
                  selectedNode != null
                    ? sankeyData.nodes[selectedNode]?.name ?? null
                    : null
                }
                selectedNodeSide={
                  selectedNode != null
                    ? sankeyData.nodes[selectedNode]?.side ?? null
                    : null
                }
              />
            )}
            nodePadding={14}
            nodeWidth={10}
            // sort={false} prevents Recharts from reordering nodes within
            // each column to minimize link crossings. Without it, the
            // default sort would put nodes in whatever order minimizes
            // visual clutter, which scrambles the proportion ordering
            // we want. With it, nodes stay in input array order — which
            // the pipeline emits as proportion descending, "Other" last.
            // Layout iterations still run and place link endpoints
            // correctly within each node's vertical slot.
            sort={false}
            margin={{ top: 16, right: 220, bottom: 16, left: 220 }}
          >
            <Tooltip
              contentStyle={{
                background: PALETTE.paper,
                border: `1px solid ${PALETTE.ink}`,
                fontFamily: FONT_BODY,
                fontSize: 12,
                borderRadius: 0,
              }}
              labelStyle={{ color: PALETTE.ink, fontWeight: 600 }}
              formatter={(value, name, props) => {
                // The default formatter shows {source: idx, target: idx, value};
                // we prefer human names with the citation count.
                const p = props.payload || {};
                if (p.source !== undefined && p.target !== undefined) {
                  const srcName = sankeyData.nodes[p.source.index ?? p.source]?.name
                    ?? sankeyData.nodes[p.source]?.name ?? '?';
                  const dstName = sankeyData.nodes[p.target.index ?? p.target]?.name
                    ?? sankeyData.nodes[p.target]?.name ?? '?';
                  return [
                    `${fmtFull(value)} citations`,
                    `${srcName} → ${dstName}`,
                  ];
                }
                return [fmtFull(value), p.name || name];
              }}
            />
          </Sankey>
        </ResponsiveContainer>
      </div>

      {/* Detail breakdown table for the clicked publisher */}
      {detail && (
        <div
          className="mt-4 p-4"
          style={{
            background: PALETTE.cream,
            borderLeft: `3px solid ${detail.anchorIsSeedSide ? PALETTE.navy : PALETTE.burgundy}`,
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: PALETTE.charcoal,
          }}
        >
          <div
            className="mb-1 uppercase"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              letterSpacing: '0.16em',
              color: PALETTE.muted,
            }}
          >
            {detail.anchorIsSeedSide
              ? 'Seed publisher · outgoing citations'
              : 'Cited publisher · incoming citations'}
          </div>
          <div className="mb-3" style={{ lineHeight: 1.5 }}>
            <strong style={{
              color: detail.anchorIsSeedSide ? PALETTE.navy : PALETTE.burgundy,
              fontSize: 15,
            }}>
              {detail.anchor.name}
            </strong>{' '}
            {detail.anchorIsSeedSide
              ? 'Thai 2025 papers contribute'
              : 'is on the receiving end of'}{' '}
            <strong style={{ color: PALETTE.ink, fontFamily: FONT_MONO }}>
              {fmtFull(detail.total)}
            </strong>{' '}
            citations.{' '}
            {detail.anchorIsSeedSide
              ? 'The breakdown below shows where those citations land.'
              : 'The breakdown below shows where those citations come from.'}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    color: PALETTE.muted,
                    textTransform: 'uppercase',
                  }}
                >
                  <th style={cellHead}>
                    {detail.anchorIsSeedSide ? 'Cited publisher' : 'Seed publisher'}
                  </th>
                  <th style={{ ...cellHead, width: 120, textAlign: 'right' }}>
                    Citations
                  </th>
                  <th style={{ ...cellHead, width: 90, textAlign: 'right' }}>
                    Share
                  </th>
                  <th style={{ ...cellHead, width: '50%' }}>Bar</th>
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((r) => (
                  <tr
                    key={r.otherIdx}
                    style={{ borderTop: `1px solid ${PALETTE.rule}` }}
                  >
                    <td style={cellBody}>
                      <span style={{
                        color: r.otherIsOther ? PALETTE.muted : PALETTE.ink,
                        fontStyle: r.otherIsOther ? 'italic' : 'normal',
                        fontWeight: r.otherIsOther ? 400 : 500,
                      }}>
                        {r.otherName}
                      </span>
                    </td>
                    <td style={{
                      ...cellBody,
                      textAlign: 'right',
                      fontFamily: FONT_MONO,
                    }}>
                      {fmtFull(r.value)}
                    </td>
                    <td style={{
                      ...cellBody,
                      textAlign: 'right',
                      fontFamily: FONT_MONO,
                      fontWeight: 600,
                      color: PALETTE.ink,
                    }}>
                      {r.pct_of_node.toFixed(1)}%
                    </td>
                    <td style={cellBody}>
                      <CoverageBar
                        value={r.pct_of_node}
                        color={detail.anchorIsSeedSide ? PALETTE.burgundy : PALETTE.navy}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="mt-3"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              letterSpacing: '0.1em',
              color: PALETTE.muted,
              textTransform: 'uppercase',
            }}
          >
            Share is computed against {detail.anchor.name}'s {fmtFull(detail.total)} {detail.anchorIsSeedSide ? 'outgoing' : 'incoming'} citations.
          </div>
        </div>
      )}

      {m.n_links_dropped > 0 && (
        <div
          className="mt-3"
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.12em',
            color: PALETTE.muted,
            textTransform: 'uppercase',
          }}
        >
          Note · {m.n_links_dropped} small flows below the visibility threshold
          ({fmtFull(m.edges_dropped)} edges, {((m.edges_dropped / (m.total_edges_with_both_publishers || 1)) * 100).toFixed(2)}% of total) were omitted to keep the diagram readable.
        </div>
      )}
    </Card>
  );
};

// ============================================================
// INSTITUTION CITATION OVERLAP HEATMAP
// ============================================================
// Pairwise heatmap showing what fraction of one Thai institution's
// cited works are also cited by another, EXCLUDING citations from
// papers the two co-authored together. Co-authored papers would
// inflate every cell artificially: those edges contribute the same
// cited works to both institutions by definition. Removing them
// tests whether two institutions independently arrive at citing
// similar literature.
//
// The matrix is asymmetric: cell (i, j) shows the share of i's
// distinct cited works (after removing seeds co-authored with j)
// that j also cites. So row i sums to <= 100%; cell (j, i) shows
// the same overlap from j's perspective and is generally a different
// percentage because the denominators differ.
//
// We reuse INST_TYPE_COLORS for the type filter pills and the row /
// column header labels, matching the institutional-landscape colors.
const InstitutionOverlapHeatmap = ({ institutionOverlap, currentView }) => {
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedCell, setSelectedCell] = useState(null);

  // We compute everything against the data even when it might be missing,
  // so React always sees the same hook order across renders. The null
  // guard lives at the bottom of the function (just before JSX).
  const o = institutionOverlap;
  const insts = (o && o.institutions) || [];

  // Three rendering modes, decided from the global filter:
  //   matrix-all:   no global filter or all_thailand → full N×N heatmap
  //   matrix-typed: global is type:X → heatmap restricted to type X
  //   list:         global is an individual institution → coverage-style list
  //                 of that institution's overlaps with each other
  const mode = useMemo(() => {
    if (!currentView || currentView === 'all_thailand') return 'matrix-all';
    if (currentView.startsWith('type:')) return 'matrix-typed';
    return 'list';
  }, [currentView]);

  // When the global view is type:X, force the local typeFilter to match
  // so the matrix and pills stay in sync. The user can still freely set
  // typeFilter in matrix-all mode and in list mode (where it filters
  // the comparison institutions).
  useEffect(() => {
    if (currentView && currentView.startsWith('type:')) {
      setTypeFilter(currentView.slice(5));
    } else if (!currentView || currentView === 'all_thailand') {
      // Reset back to 'all' when the user clears the filter
      setTypeFilter('all');
    }
    // Individual-institution case: don't touch typeFilter — the user
    // may have set it to narrow the comparison list.
  }, [currentView]);

  // Apply institution-type filter to rows AND columns. We keep
  // matrix entries by index, so filtered indices are projected
  // through the original matrix.
  const { labels, matrixOv, matrixA, types, ids, indices } = useMemo(() => {
    let idx = insts.map((_, i) => i);
    if (typeFilter !== 'all') {
      idx = idx.filter((i) => (insts[i].type || 'other') === typeFilter);
    }
    if (!o) {
      return { labels: [], matrixOv: [], matrixA: [], types: [], ids: [], indices: [] };
    }
    return {
      labels: idx.map((i) => insts[i].name
        .replace(/^King Mongkut's /, "KMUT-")
        .replace(/^King Mongkut /, "KMUT-")),
      matrixOv: idx.map((i) => idx.map((j) => o.matrix_overlap[i][j])),
      matrixA: idx.map((i) => idx.map((j) => o.matrix_a_count[i][j])),
      types: idx.map((i) => insts[i].type || 'other'),
      ids: idx.map((i) => insts[i].id),
      indices: idx,
    };
  }, [insts, o, typeFilter]);

  // Available types (only those that appear in the matrix)
  const availableTypes = useMemo(() => {
    const seen = new Set();
    for (const r of insts) seen.add(r.type || 'other');
    return INST_TYPE_FILTER_ORDER.filter((t) => seen.has(t));
  }, [insts]);

  const pctMatrix = useMemo(() => {
    return matrixOv.map((row, i) =>
      row.map((v, j) => {
        const denom = matrixA[i][j] || 1;
        return (v / denom) * 100;
      }),
    );
  }, [matrixOv, matrixA]);

  // For 'list' mode: find which row in the (unfiltered) matrix
  // corresponds to the globally-selected institution. -1 if it's not
  // in the top-N matrix at all.
  const selectedListIdx = useMemo(() => {
    if (mode !== 'list') return -1;
    return insts.findIndex((inst) => inst.id === currentView);
  }, [insts, currentView, mode]);

  // Build the coverage-list rows: for each OTHER institution, compute
  // the overlap count and percentage from the selected institution's
  // perspective. Apply local typeFilter and sort by percentage desc.
  const listRows = useMemo(() => {
    if (mode !== 'list' || selectedListIdx === -1 || !o) return [];
    const i = selectedListIdx;
    const rows = insts.map((inst, j) => {
      if (j === i) return null;  // skip self
      const ov = o.matrix_overlap[i][j];
      const denom = o.matrix_a_count[i][j] || 1;
      return {
        id: inst.id,
        name: inst.name,
        type: inst.type || 'other',
        overlap: ov,
        a_count: denom,
        pct: (ov / denom) * 100,
      };
    }).filter(Boolean);
    const filtered = typeFilter === 'all'
      ? rows
      : rows.filter((r) => r.type === typeFilter);
    return filtered.sort((a, b) => b.pct - a.pct);
  }, [insts, o, mode, selectedListIdx, typeFilter]);

  // The "self" row (the selected institution itself) — used as a
  // reference at the top of the list to anchor the user.
  const selectedSelf = useMemo(() => {
    if (mode !== 'list' || selectedListIdx === -1 || !o) return null;
    const inst = insts[selectedListIdx];
    return {
      id: inst.id,
      name: inst.name,
      type: inst.type || 'other',
      self_count: o.matrix_overlap[selectedListIdx][selectedListIdx],
    };
  }, [insts, o, mode, selectedListIdx]);

  // Reset cell selection when the type filter or mode changes
  useEffect(() => {
    setSelectedCell(null);
  }, [typeFilter, mode]);

  // Null check goes AFTER all hooks so hook order stays stable across
  // renders (React requires the same hooks be called in the same order
  // every render).
  if (!institutionOverlap) return null;

  // Cell color: same scheme as database overlap. Diagonal in gold.
  const colorFor = (pct, isDiag, isSelected) => {
    if (isSelected) return PALETTE.ink;
    if (isDiag) return PALETTE.gold;
    if (pct === 0) return PALETTE.cream;
    // Quintile bins of burgundy
    if (pct < 5) return PALETTE.burgundy + '20';
    if (pct < 15) return PALETTE.burgundy + '50';
    if (pct < 30) return PALETTE.burgundy + '80';
    if (pct < 50) return PALETTE.burgundy + 'b0';
    return PALETTE.burgundy;
  };

  return (
    <Card className="p-5">
      <SectionTitle
        icon={Building2}
        kicker="Institutional citation overlap"
        title={
          mode === 'list' && selectedSelf
            ? `Who shares citations with ${selectedSelf.name}`
            : 'How much do Thai institutions cite the same literature'
        }
        totalN={
          mode === 'list' && selectedSelf
            ? selectedSelf.self_count
            : labels.length > 0
            ? labels.length
            : null
        }
        totalLabel={
          mode === 'list' && selectedSelf
            ? `distinct cited works by ${selectedSelf.name}`
            : 'institutions in the matrix'
        }
        hint={
          mode === 'list' && selectedSelf
            ? `For each top institution, the bar shows what share of ${selectedSelf.name}'s distinct cited works that institution also cites. Citations from papers the two institutions co-authored are excluded so the overlap reflects independent citation choices. Sorted by overlap percentage, descending.`
            : mode === 'matrix-typed'
            ? "Restricted to institutions of the type selected in the institutional landscape above. For each ordered pair (row → column), the cell shows what share of the row institution's distinct cited works are also cited by the column institution. Co-authored papers are excluded. Click any cell for details."
            : "For each ordered pair (row → column), the cell shows what share of the row institution's distinct cited works are also cited by the column institution. Citations from papers the two institutions co-authored are excluded — without that exclusion, co-authorship alone would inflate every cell. Use the type filter to compare institutions within a category. Click any cell for the underlying counts."
        }
      />

      {/* In matrix-typed mode the type is forced by the global filter,
          so showing local pills would be misleading. In list mode and
          matrix-all mode the user freely controls them. */}
      {mode !== 'matrix-typed' && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              letterSpacing: '0.16em',
              color: PALETTE.muted,
              textTransform: 'uppercase',
              marginRight: 6,
            }}
          >
            {mode === 'list' ? 'Limit comparisons to' : 'Filter by type'}
          </span>
          <FilterPill
            label="All"
            active={typeFilter === 'all'}
            onClick={() => setTypeFilter('all')}
          />
          {availableTypes.map((t) => (
            <FilterPill
              key={t}
              label={t.charAt(0).toUpperCase() + t.slice(1)}
              active={typeFilter === t}
              color={INST_TYPE_COLORS[t]}
              onClick={() => setTypeFilter(t)}
            />
          ))}
        </div>
      )}

      {/* Matrix view: matrix-all and matrix-typed modes */}
      {mode !== 'list' && (<>
        {labels.length < 2 ? (
        <div
          className="p-6 text-center"
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: PALETTE.muted,
            background: PALETTE.cream,
            border: `1px dashed ${PALETTE.rule}`,
          }}
        >
          Only one institution matches this type filter, so there's no overlap to show.
          Try a different type or select All.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            style={{
              borderCollapse: 'collapse',
              fontFamily: FONT_MONO,
              fontSize: 10,
              margin: '0 auto',
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: 4 }}></th>
                {labels.map((label, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '4px 2px',
                      height: 180,
                      verticalAlign: 'bottom',
                      textAlign: 'left',
                      color: INST_TYPE_COLORS[types[i]] || PALETTE.charcoal,
                      fontWeight: 500,
                      minWidth: 28,
                    }}
                  >
                    <div
                      style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.04em',
                        maxHeight: 170,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={label}
                    >
                      {label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((rowLabel, i) => (
                <tr key={i}>
                  <th
                    style={{
                      padding: '4px 8px',
                      textAlign: 'right',
                      fontWeight: 500,
                      color: INST_TYPE_COLORS[types[i]] || PALETTE.charcoal,
                      whiteSpace: 'nowrap',
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={rowLabel}
                  >
                    {rowLabel}
                  </th>
                  {labels.map((_, j) => {
                    const pct = pctMatrix[i][j];
                    const isDiag = i === j;
                    const isSelected =
                      selectedCell && selectedCell.i === i && selectedCell.j === j;
                    return (
                      <td
                        key={j}
                        onClick={() => setSelectedCell({ i, j })}
                        style={{
                          width: 28,
                          height: 28,
                          background: colorFor(pct, isDiag, isSelected),
                          border: `1px solid ${PALETTE.paper}`,
                          textAlign: 'center',
                          color:
                            isSelected
                              ? PALETTE.paper
                              : isDiag
                              ? PALETTE.ink
                              : pct >= 30
                              ? PALETTE.paper
                              : PALETTE.charcoal,
                          fontFamily: FONT_MONO,
                          fontSize: 9,
                          cursor: 'pointer',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {isDiag ? '—' : pct >= 0.5 ? pct.toFixed(0) : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel for the currently selected cell */}
      {selectedCell && (
        <div
          className="mt-4 p-4"
          style={{
            background: PALETTE.cream,
            borderLeft: `3px solid ${PALETTE.burgundy}`,
            fontFamily: FONT_BODY,
            fontSize: 13,
            lineHeight: 1.5,
            color: PALETTE.charcoal,
          }}
        >
          {(() => {
            const { i, j } = selectedCell;
            const isDiag = i === j;
            const a_name = labels[i];
            const b_name = labels[j];
            const a_type = types[i];
            const b_type = types[j];
            const a_count = matrixA[i][j];
            const b_count = matrixA[j][i];
            const ov = matrixOv[i][j];
            const pct_ij = pctMatrix[i][j];
            const pct_ji = pctMatrix[j][i];
            if (isDiag) {
              return (
                <>
                  <div
                    className="mb-1 uppercase"
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 9,
                      letterSpacing: '0.16em',
                      color: PALETTE.muted,
                    }}
                  >
                    Selected diagonal cell
                  </div>
                  <div>
                    <strong style={{ color: INST_TYPE_COLORS[a_type] || PALETTE.ink }}>
                      {a_name}
                    </strong>{' '}
                    cites{' '}
                    <strong style={{ color: PALETTE.ink, fontFamily: FONT_MONO }}>
                      {fmtFull(a_count)}
                    </strong>{' '}
                    distinct works in 2025. The diagonal is always 100% by definition.
                  </div>
                </>
              );
            }
            return (
              <>
                <div
                  className="mb-1 uppercase"
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9,
                    letterSpacing: '0.16em',
                    color: PALETTE.muted,
                  }}
                >
                  Selected pair · row → column
                </div>
                <div className="mb-1">
                  <strong style={{ color: INST_TYPE_COLORS[a_type] || PALETTE.ink }}>
                    {a_name}
                  </strong>{' '}
                  cites{' '}
                  <strong style={{ color: PALETTE.ink, fontFamily: FONT_MONO }}>
                    {fmtFull(a_count)}
                  </strong>{' '}
                  distinct works (excluding seeds co-authored with{' '}
                  <strong>{b_name}</strong>).{' '}
                  <strong style={{ color: PALETTE.burgundy, fontFamily: FONT_MONO }}>
                    {fmtFull(ov)} ({pct_ij.toFixed(1)}%)
                  </strong>{' '}
                  of those are also cited by{' '}
                  <strong style={{ color: INST_TYPE_COLORS[b_type] || PALETTE.ink }}>
                    {b_name}
                  </strong>
                  .
                </div>
                <div style={{ color: PALETTE.muted, fontSize: 12 }}>
                  From the other direction:{' '}
                  <strong style={{ color: PALETTE.ink, fontFamily: FONT_MONO }}>
                    {fmtFull(b_count)}
                  </strong>{' '}
                  distinct works for {b_name},{' '}
                  <strong style={{ color: PALETTE.burgundy, fontFamily: FONT_MONO }}>
                    {pct_ji.toFixed(1)}%
                  </strong>{' '}
                  also cited by {a_name}.
                </div>
              </>
            );
          })()}
        </div>
      )}
      {/* end matrix mode */}
      </>)}

      {/* List view: individual-institution mode (coverage-style) */}
      {mode === 'list' && (
        selectedListIdx === -1 ? (
          <div
            className="p-6 text-center"
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: PALETTE.muted,
              background: PALETTE.cream,
              border: `1px dashed ${PALETTE.rule}`,
            }}
          >
            The selected institution is not among the top {insts.length} institutions
            in the overlap dataset, so we don't have pairwise data for it. Pick one
            of the institutions visible in the institutional landscape chart above.
          </div>
        ) : (
          <>
            {selectedSelf && (
              <div
                className="mb-4 px-4 py-3"
                style={{
                  background: PALETTE.cream,
                  borderLeft: `3px solid ${INST_TYPE_COLORS[selectedSelf.type] || PALETTE.ink}`,
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: PALETTE.charcoal,
                }}
              >
                <div
                  className="mb-0.5 uppercase"
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9,
                    letterSpacing: '0.16em',
                    color: PALETTE.muted,
                  }}
                >
                  Anchor institution
                </div>
                <div>
                  <strong style={{ color: INST_TYPE_COLORS[selectedSelf.type] || PALETTE.ink }}>
                    {selectedSelf.name}
                  </strong>{' '}
                  cites{' '}
                  <strong style={{ color: PALETTE.ink, fontFamily: FONT_MONO }}>
                    {fmtFull(selectedSelf.self_count)}
                  </strong>{' '}
                  distinct works in 2025. Each row below shows what share of those
                  works the named institution also cites (after excluding co-authored seeds).
                </div>
              </div>
            )}
            {listRows.length === 0 ? (
              <div
                className="p-6 text-center"
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: PALETTE.muted,
                  background: PALETTE.cream,
                  border: `1px dashed ${PALETTE.rule}`,
                }}
              >
                No comparison institutions match the selected type. Try a different
                type or select All.
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ fontFamily: FONT_BODY, fontSize: 13 }}>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 10,
                        letterSpacing: '0.12em',
                        color: PALETTE.muted,
                        textTransform: 'uppercase',
                      }}
                    >
                      <th style={cellHead}>Institution</th>
                      <th style={{ ...cellHead, width: 110 }}>Type</th>
                      <th style={{ ...cellHead, width: 110, textAlign: 'right' }}>
                        Shared works
                      </th>
                      <th style={{ ...cellHead, width: '46%' }}>Overlap with anchor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listRows.map((r) => (
                      <tr
                        key={r.id}
                        style={{ borderTop: `1px solid ${PALETTE.rule}` }}
                      >
                        <td style={cellBody}>
                          <span
                            style={{
                              color: INST_TYPE_COLORS[r.type] || PALETTE.ink,
                              fontWeight: 500,
                            }}
                          >
                            {r.name}
                          </span>
                        </td>
                        <td style={cellBody}>
                          <span
                            style={{
                              fontFamily: FONT_MONO,
                              fontSize: 9,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              color: INST_TYPE_COLORS[r.type] || PALETTE.charcoal,
                              padding: '2px 6px',
                              border: `1px solid ${INST_TYPE_COLORS[r.type] || PALETTE.rule}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {r.type}
                          </span>
                        </td>
                        <td
                          style={{
                            ...cellBody,
                            textAlign: 'right',
                            fontFamily: FONT_MONO,
                          }}
                        >
                          {fmtFull(r.overlap)}
                        </td>
                        <td style={cellBody}>
                          <CoverageBar
                            value={r.pct}
                            color={INST_TYPE_COLORS[r.type] || PALETTE.burgundy}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}

      <div
        className="mt-4 flex items-center gap-4 flex-wrap"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          letterSpacing: '0.12em',
          color: PALETTE.muted,
          textTransform: 'uppercase',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              background: PALETTE.gold,
            }}
          />
          Diagonal (self)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              background: PALETTE.burgundy,
            }}
          />
          Pairwise overlap (% from row's perspective)
        </span>
        <span>Co-authored seeds excluded · Click any cell for details</span>
      </div>
    </Card>
  );
};

// ============================================================
// CITATIONS BY YEAR
// ============================================================
const ByYearPanel = ({ byYear, view }) => {
  const [mode, setMode] = useState('chart');
  if (!byYear || !byYear[view]) return null;
  const raw = byYear[view] || [];
  const thailand = byYear.all_thailand || [];
  const isFiltered = view !== 'all_thailand';

  const { data, total, peak, fullData } = useMemo(() => {
    // Bucket pre-1990 for the institution view
    const recent = raw.filter((r) => r.year >= 1990).sort((a, b) => a.year - b.year);
    const old = raw.filter((r) => r.year < 1990);
    const oldBucket = old.length
      ? {
          year: '<1990',
          edges: old.reduce((s, r) => s + r.edges, 0),
          unique: old.reduce((s, r) => s + r.unique, 0),
          isBucket: true,
        }
      : null;
    const baseData = oldBucket ? [oldBucket, ...recent] : recent;
    const total = baseData.reduce((s, r) => s + r.edges, 0);

    // Bucket Thailand the same way and compute the comparison percentages
    const thRecent = thailand.filter((r) => r.year >= 1990);
    const thOld = thailand.filter((r) => r.year < 1990);
    const thOldBucketEdges = thOld.reduce((s, r) => s + r.edges, 0);
    const thMap = new Map();
    if (thOld.length) thMap.set('<1990', thOldBucketEdges);
    for (const r of thRecent) thMap.set(r.year, r.edges);
    const thTotal = thailand.reduce((s, r) => s + r.edges, 0);

    // Each row gets both an institution percentage and a Thailand percentage,
    // so the area chart can render the institution on top of a translucent
    // Thailand underlay. Both sum to ~100% across the visible window.
    const data = baseData.map((r) => ({
      year: r.year,
      edges: r.edges,
      unique: r.unique,
      pct: total ? (r.edges / total) * 100 : 0,
      th_edges: thMap.get(r.year) || 0,
      th_pct: thTotal ? ((thMap.get(r.year) || 0) / thTotal) * 100 : 0,
    }));

    const peak = data.reduce((m, r) => (r.edges > (m?.edges || 0) ? r : m), null);
    const fullData = [...raw].sort((a, b) => b.year - a.year);
    return { data, total, peak, fullData };
  }, [raw, thailand]);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <SectionTitle
          icon={Calendar}
          kicker="Time horizon"
          title="When are the cited works from"
          totalN={total}
          totalLabel="citations"
          hint={
            isFiltered
              ? `Each year as a percentage of total citations, so this institution and All Thailand are directly comparable. The Thailand area sits behind in muted gold; the selected institution sits on top in burgundy.`
              : `Distribution by the publication year of the cited work. Pre-1990 collapsed in the chart; the table view shows every year.`
          }
        />
        <ChartTableToggle mode={mode} onChange={setMode} />
      </div>

      {mode === 'chart' ? (
        <>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <AreaChart
                data={data}
                margin={{ top: 12, right: 16, bottom: 8, left: 8 }}
              >
                <defs>
                  <linearGradient id="yearArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETTE.burgundy} stopOpacity={0.75} />
                    <stop offset="100%" stopColor={PALETTE.burgundy} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="yearAreaTh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETTE.gold} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={PALETTE.gold} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={PALETTE.rule} vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: PALETTE.muted, fontFamily: FONT_MONO }}
                  stroke={PALETTE.rule}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tickFormatter={(v) => isFiltered ? `${v.toFixed(0)}%` : fmt(v)}
                  tick={{ fontSize: 10, fill: PALETTE.muted, fontFamily: FONT_MONO }}
                  stroke={PALETTE.rule}
                />
                <Tooltip
                  contentStyle={{
                    background: PALETTE.paper,
                    border: `1px solid ${PALETTE.ink}`,
                    fontFamily: FONT_BODY,
                    fontSize: 12,
                    borderRadius: 0,
                  }}
                  labelStyle={{ color: PALETTE.ink, fontWeight: 600 }}
                  formatter={(value, name) => {
                    if (isFiltered) {
                      if (name === 'pct') return [`${value.toFixed(2)}%`, 'This institution'];
                      if (name === 'th_pct') return [`${value.toFixed(2)}%`, 'All Thailand'];
                    }
                    if (name === 'edges') return [fmtFull(value), 'Citations'];
                    return [fmtFull(value), name];
                  }}
                />
                {/* Thailand underlay (only when filtered) */}
                {isFiltered && (
                  <Area
                    type="monotone"
                    dataKey="th_pct"
                    stroke={PALETTE.gold}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    fill="url(#yearAreaTh)"
                  />
                )}
                {/* Institution overlay (in percentage mode) or raw counts (in all_thailand) */}
                <Area
                  type="monotone"
                  dataKey={isFiltered ? 'pct' : 'edges'}
                  stroke={PALETTE.burgundy}
                  strokeWidth={1.5}
                  fill="url(#yearArea)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
            {peak && (
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  color: PALETTE.muted,
                  textTransform: 'uppercase',
                }}
              >
                Peak year · {peak.year} · {fmtFull(peak.edges)} citations
              </div>
            )}
            {isFiltered && (
              <div
                className="flex items-center gap-4 flex-wrap"
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  color: PALETTE.muted,
                  textTransform: 'uppercase',
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span style={{
                    display: 'inline-block', width: 14, height: 9,
                    background: PALETTE.burgundy,
                  }} />
                  This institution
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span style={{
                    display: 'inline-block', width: 14, height: 9,
                    background: PALETTE.gold,
                    opacity: 0.5,
                  }} />
                  All Thailand
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <DataTable
          rows={fullData}
          columns={[
            { key: 'year', label: 'Year', align: 'left', mono: true },
            { key: 'edges', label: 'Citations', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
            { key: 'unique', label: 'Unique works', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
          ]}
        />
      )}
    </Card>
  );
};

// ============================================================
// CITATIONS BY TYPE
// ============================================================
const ByTypePanel = ({ byType, view }) => {
  const [mode, setMode] = useState('chart');
  if (!byType || !byType[view]) return null;
  const items = byType[view] || [];

  const chartData = useMemo(
    () => items
      .filter((r) => r.edges >= 100)
      .map((r) => ({ type: r.type, edges: r.edges, unique: r.unique })),
    [items],
  );
  const total = useMemo(() => chartData.reduce((s, r) => s + r.edges, 0), [chartData]);
  // Total across ALL types (for the n= header), not just the chart-visible
  // ones — the chart filters out tiny types but the n should reflect the
  // full denominator.
  const totalAll = useMemo(() => items.reduce((s, r) => s + r.edges, 0), [items]);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <SectionTitle
          icon={FileText}
          kicker="Material types"
          title="What kinds of works are being cited"
          totalN={totalAll}
          totalLabel="citations"
          hint="OpenAlex work-type classification. The chart filters out types with fewer than 100 citations; the table view shows everything."
        />
        <ChartTableToggle mode={mode} onChange={setMode} />
      </div>

      {mode === 'chart' ? (
        <>
          <div style={{ width: '100%', height: Math.max(220, chartData.length * 30) }}>
            <ResponsiveContainer>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 50, bottom: 4, left: 110 }}
              >
                <CartesianGrid stroke={PALETTE.rule} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={fmt}
                  tick={{ fontSize: 10, fill: PALETTE.muted, fontFamily: FONT_MONO }}
                  stroke={PALETTE.rule}
                />
                <YAxis
                  type="category"
                  dataKey="type"
                  tick={{ fontSize: 11, fill: PALETTE.charcoal, fontFamily: FONT_BODY }}
                  stroke={PALETTE.rule}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    background: PALETTE.paper,
                    border: `1px solid ${PALETTE.ink}`,
                    fontFamily: FONT_BODY,
                    fontSize: 12,
                    borderRadius: 0,
                  }}
                  labelStyle={{ color: PALETTE.ink, fontWeight: 600 }}
                  formatter={(value) => [fmtFull(value), 'Citations']}
                />
                <Bar dataKey="edges">
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={i === 0 ? PALETTE.burgundy : PALETTE.navy} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div
            className="mt-3"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: '0.12em',
              color: PALETTE.muted,
              textTransform: 'uppercase',
            }}
          >
            Total · {fmtFull(total)} citations across {chartData.length} types
          </div>
        </>
      ) : (
        <DataTable
          rows={items}
          columns={[
            { key: 'type', label: 'Type', align: 'left' },
            { key: 'edges', label: 'Citations', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
            { key: 'unique', label: 'Unique works', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
          ]}
        />
      )}
    </Card>
  );
};

// ============================================================
// TOP PUBLISHERS
// ============================================================
// Custom Y-axis tick for the publisher concentration chart that
// renders the publisher name plus a small "OA" badge for publishers
// that are predominantly open access (no subscription needed). The
// badge is placed inline at the start of the label so it reads as a
// quick visual marker without competing with the bars themselves.
const PublisherYTick = ({ x, y, payload }) => {
  const name = payload?.value ?? '';
  const isOA = isOAOnlyPublisher(name);
  // The Recharts default tick anchors text at the end (right edge),
  // since labels sit on the left side of the chart. We render the
  // text with the same anchor and dy as default; the badge sits to
  // the left of the text so it doesn't overlap the bars.
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dy={4}
        textAnchor="end"
        style={{
          fontFamily: FONT_BODY,
          fontSize: 10.5,
          fill: PALETTE.charcoal,
        }}
      >
        {name}
      </text>
      {isOA && (
        <g transform={`translate(${-name.length * 5.6 - 30}, -8)`}>
          <rect
            width={20}
            height={12}
            fill={PALETTE.gold}
            fillOpacity={0.18}
            stroke={PALETTE.gold}
            strokeWidth={0.6}
          />
          <text
            x={10}
            y={9}
            textAnchor="middle"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 8,
              fill: PALETTE.ink,
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            OA
          </text>
        </g>
      )}
    </g>
  );
};

const TopPublishersPanel = ({ byPublisher, summary, view }) => {
  const [mode, setMode] = useState('chart');
  const [showCount, setShowCount] = useState(15);
  if (!byPublisher || !byPublisher[view]) return null;
  const allData = byPublisher[view] || [];
  const isFiltered = view !== 'all_thailand';

  // Build a Thailand-publisher lookup so we can compute the benchmark per row
  const thLookup = useMemo(() => {
    if (!isFiltered) return null;
    const t = byPublisher.all_thailand || [];
    const map = {};
    for (const r of t) map[r.publisher] = r.edges;
    return map;
  }, [byPublisher, isFiltered]);

  const totalView = summary && summary[view] ? summary[view].n_total_edges : 0;
  const totalTH =
    summary && summary.all_thailand ? summary.all_thailand.n_total_edges : 0;

  const data = useMemo(
    () => allData.slice(0, showCount).map((r) => {
      const th_edges = thLookup ? thLookup[r.publisher] || 0 : 0;
      return {
        publisher: r.publisher,
        edges: r.edges,
        pct: totalView ? (r.edges / totalView) * 100 : 0,
        th_edges,
        th_pct: totalTH ? (th_edges / totalTH) * 100 : 0,
      };
    }),
    [allData, showCount, thLookup, totalView, totalTH],
  );

  // Per-row height: bigger when we draw two grouped bars
  const rowHeight = isFiltered ? 36 : 26;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <SectionTitle
          icon={BookOpen}
          kicker="Publisher concentration"
          title="Which publishers' journals get cited most"
          totalN={totalView}
          totalLabel="citations"
          hint={
            isFiltered
              ? "Each publisher's share of this institution's citations (burgundy, primary) compared with its share of all-Thailand citations (muted gold, reference). Helps you see whether this institution leans more or less than the country average on a given publisher."
              : "Top publishers by citation count. Heavy concentration in a few names tells you where subscription money has the most leverage."
          }
        />
        <ChartTableToggle mode={mode} onChange={setMode} />
      </div>

      {mode === 'chart' ? (
        <>
          <div style={{ width: '100%', height: data.length * rowHeight + 50 }}>
            <ResponsiveContainer>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 60, bottom: 20, left: 200 }}
                barGap={2}
              >
                <CartesianGrid stroke={PALETTE.rule} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={isFiltered ? (v) => `${v.toFixed(0)}%` : fmt}
                  tick={{ fontSize: 10, fill: PALETTE.muted, fontFamily: FONT_MONO }}
                  stroke={PALETTE.rule}
                />
                <YAxis
                  type="category"
                  dataKey="publisher"
                  tick={<PublisherYTick />}
                  stroke={PALETTE.rule}
                  width={200}
                />
                <Tooltip
                  contentStyle={{
                    background: PALETTE.paper,
                    border: `1px solid ${PALETTE.ink}`,
                    fontFamily: FONT_BODY,
                    fontSize: 12,
                    borderRadius: 0,
                  }}
                  labelStyle={{ color: PALETTE.ink, fontWeight: 600 }}
                  formatter={(v, name) => {
                    if (name === 'pct') return [`${v.toFixed(2)}%`, 'This institution'];
                    if (name === 'th_pct') return [`${v.toFixed(2)}%`, 'All Thailand'];
                    if (name === 'edges') return [fmtFull(v), 'Citations'];
                    return [v, name];
                  }}
                />
                {isFiltered ? (
                  <>
                    {/* Thailand reference bar drawn first so it sits behind
                        in z-order at the same x-axis position; muted
                        opacity keeps it visible without competing. */}
                    <Bar
                      dataKey="th_pct"
                      fill={PALETTE.gold}
                      fillOpacity={0.45}
                      name="th_pct"
                    />
                    <Bar dataKey="pct" fill={PALETTE.burgundy} name="pct" />
                  </>
                ) : (
                  <Bar dataKey="edges" fill={PALETTE.teal} name="edges" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div
              className="flex items-center gap-4 flex-wrap"
              style={{
                fontFamily: FONT_MONO,
                fontSize: 9,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {isFiltered ? (
                <>
                  <span className="inline-flex items-center gap-1.5" style={{ color: PALETTE.burgundy }}>
                    <span style={{
                      display: 'inline-block', width: 14, height: 9,
                      background: PALETTE.burgundy,
                    }} />
                    This institution (% of citations)
                  </span>
                  <span className="inline-flex items-center gap-1.5" style={{ color: PALETTE.gold }}>
                    <span style={{
                      display: 'inline-block', width: 14, height: 9,
                      background: PALETTE.gold,
                      opacity: 0.45,
                    }} />
                    All Thailand reference (muted)
                  </span>
                </>
              ) : (
                <span style={{ color: PALETTE.muted }}>
                  Showing top {showCount} of {allData.length}
                </span>
              )}
              {/* OA badge legend, always visible since the badge appears in
                  both filtered and unfiltered modes. */}
              <span
                className="inline-flex items-center gap-1.5"
                style={{ color: PALETTE.muted }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 12,
                    background: PALETTE.gold,
                    backgroundColor: 'rgba(190, 152, 57, 0.18)',
                    border: `0.6px solid ${PALETTE.gold}`,
                    fontFamily: FONT_MONO,
                    fontSize: 7.5,
                    fontWeight: 600,
                    color: PALETTE.ink,
                    letterSpacing: '0.05em',
                  }}
                >
                  OA
                </span>
                Open access publisher (no subscription required)
              </span>
            </div>
            <div className="flex gap-1">
              {[10, 15, 25, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => setShowCount(Math.min(n, allData.length))}
                  className="px-2 py-1 transition-colors"
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    background: showCount === n ? PALETTE.ink : 'transparent',
                    color: showCount === n ? PALETTE.paper : PALETTE.muted,
                    border: `1px solid ${showCount === n ? PALETTE.ink : PALETTE.rule}`,
                    cursor: showCount === n ? 'default' : 'pointer',
                    minWidth: 36,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <DataTable
          rows={isFiltered
            ? allData.map((r) => ({
                ...r,
                pct: totalView ? (r.edges / totalView) * 100 : 0,
                th_edges: thLookup ? thLookup[r.publisher] || 0 : 0,
                th_pct: totalTH && thLookup
                  ? ((thLookup[r.publisher] || 0) / totalTH) * 100
                  : 0,
              }))
            : allData}
          columns={isFiltered ? [
            { key: 'publisher', label: 'Publisher', align: 'left', maxWidth: 320 },
            { key: '_access', label: 'Access', align: 'left', mono: true,
              format: (_, r) => isOAOnlyPublisher(r.publisher) ? 'Open access' : '—' },
            { key: 'edges', label: 'Citations', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
            { key: 'pct', label: 'Share', align: 'right', mono: true,
              format: (v) => `${v.toFixed(2)}%` },
            { key: 'th_pct', label: 'TH share', align: 'right', mono: true,
              format: (v) => `${v.toFixed(2)}%` },
            { key: '_diff', label: 'Diff (pp)', align: 'right', mono: true,
              format: (_, r) => {
                const d = r.pct - r.th_pct;
                const sign = d > 0 ? '+' : '';
                return `${sign}${d.toFixed(2)}`;
              } },
          ] : [
            { key: 'publisher', label: 'Publisher', align: 'left', maxWidth: 360 },
            { key: '_access', label: 'Access', align: 'left', mono: true,
              format: (_, r) => isOAOnlyPublisher(r.publisher) ? 'Open access' : '—' },
            { key: 'edges', label: 'Citations', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
            { key: 'unique', label: 'Unique works', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
          ]}
        />
      )}
    </Card>
  );
};

// ============================================================
// TOP CITING THAI INSTITUTIONS
// ============================================================
const INST_TYPE_COLORS = {
  education: PALETTE.navy,
  healthcare: PALETTE.burgundy,
  government: PALETTE.gold,
  facility: PALETTE.teal,
  nonprofit: PALETTE.forest,
  funder: PALETTE.rust,
  company: PALETTE.plum,
  other: PALETTE.muted,
  archive: PALETTE.sage,
};

const INST_TYPE_FILTER_ORDER = [
  'education', 'healthcare', 'government', 'facility',
  'nonprofit', 'funder', 'company', 'archive', 'other',
];

const TopInstitutionsPanel = ({ institutions, onSelectInstitution, currentView, typeViews }) => {
  const [mode, setMode] = useState('chart');
  const [showCount, setShowCount] = useState(20);
  // Initialize typeFilter from currentView if it's a type:* view
  const [typeFilter, setTypeFilter] = useState(() => {
    if (currentView && currentView.startsWith('type:')) return currentView.slice(5);
    return 'all';
  });

  // Keep typeFilter in sync if currentView changes externally (e.g., reset).
  // We don't override typeFilter when an individual institution is selected,
  // so the user's chart-narrowing intention is preserved.
  useEffect(() => {
    if (!currentView || currentView === 'all_thailand') {
      setTypeFilter('all');
    } else if (currentView.startsWith('type:')) {
      setTypeFilter(currentView.slice(5));
    }
  }, [currentView]);

  if (!institutions) return null;

  const availableTypes = useMemo(() => {
    const seen = new Set();
    for (const r of institutions) seen.add(r.type || 'other');
    return INST_TYPE_FILTER_ORDER.filter((t) => seen.has(t));
  }, [institutions]);

  // Lookup of which types have aggregate views available (from meta)
  const typeViewSet = useMemo(() => {
    const set = new Set();
    if (typeViews) for (const tv of typeViews) set.add(tv.type);
    return set;
  }, [typeViews]);

  const filtered = useMemo(() => {
    return typeFilter === 'all'
      ? institutions
      : institutions.filter((r) => (r.type || 'other') === typeFilter);
  }, [institutions, typeFilter]);

  const chartData = useMemo(
    () => filtered.slice(0, showCount).map((r) => ({
      id: (r.id || '').replace('https://openalex.org/', ''),
      name: r.name
        .replace(/^King Mongkut's /, "KMUT-")
        .replace(/^King Mongkut /, "KMUT-"),
      type: r.type || 'other',
      edges: r.n_edges,
      seeds: r.n_seeds,
    })),
    [filtered, showCount],
  );

  // Lookup so the custom Y-axis tick can find each institution's type
  // and color the label accordingly.
  const tickInfoByName = useMemo(() => {
    const m = {};
    for (const d of chartData) m[d.name] = d;
    return m;
  }, [chartData]);

  // Custom tick component: colors each institution name by its type.
  // Recharts passes x, y, payload (the tick value) into the renderer.
  const ColoredYTick = ({ x, y, payload }) => {
    const info = tickInfoByName[payload.value];
    const isFiltered = currentView && currentView !== 'all_thailand';
    const isSelected = info && currentView === info.id;
    const baseColor = info
      ? INST_TYPE_COLORS[info.type] || PALETTE.charcoal
      : PALETTE.charcoal;
    // Fade non-selected labels to match the bar shading behavior
    const color = isFiltered && !isSelected ? baseColor + '90' : baseColor;
    return (
      <text
        x={x}
        y={y}
        dy={3}
        textAnchor="end"
        fill={color}
        fontSize={10}
        fontFamily={FONT_BODY}
        fontWeight={isSelected ? 600 : 400}
      >
        {payload.value}
      </text>
    );
  };

  const handleClick = (e) => {
    if (e && e.activePayload && e.activePayload[0]) {
      const id = e.activePayload[0].payload.id;
      if (id && onSelectInstitution) onSelectInstitution(id);
    }
  };

  // When user clicks a type filter pill, narrow the chart AND
  // (if the type has an aggregate view available) filter the rest
  // of the dashboard to the type aggregate.
  const handleTypeClick = (t) => {
    setTypeFilter(t);
    if (!onSelectInstitution) return;
    if (t === 'all') {
      onSelectInstitution('all_thailand');
    } else if (typeViewSet.has(t)) {
      onSelectInstitution(`type:${t}`);
    }
    // If the type doesn't have an aggregate view (rare), we still
    // narrow the chart but leave the global filter alone.
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <SectionTitle
          icon={Building2}
          kicker="Institutional landscape"
          title="Which Thai institutions produce the most cited research"
          totalN={institutions.length}
          totalLabel="Thai institutions producing 2025 research"
          hint="Each institution's 2025 publications (navy, primary, top axis) and the citations those publications make (muted burgundy, bottom axis), shown on independent scales. Institution names are colored by type. Click a type pill to filter to the type-aggregate; click a single bar or row to filter to that institution."
        />
        <ChartTableToggle mode={mode} onChange={setMode} />
      </div>

      {/* Type filter row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.16em',
            color: PALETTE.muted,
            textTransform: 'uppercase',
            marginRight: 6,
          }}
        >
          Filter by type
        </span>
        <FilterPill
          label="All"
          active={typeFilter === 'all'}
          onClick={() => handleTypeClick('all')}
        />
        {availableTypes.map((t) => (
          <FilterPill
            key={t}
            label={t.charAt(0).toUpperCase() + t.slice(1)}
            active={typeFilter === t}
            color={INST_TYPE_COLORS[t]}
            onClick={() => handleTypeClick(t)}
          />
        ))}
      </div>

      {mode === 'chart' ? (
        chartData.length === 0 ? (
          <div
            className="p-6 text-center"
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: PALETTE.muted,
              background: PALETTE.cream,
              border: `1px dashed ${PALETTE.rule}`,
            }}
          >
            No institutions match this type filter. Try a different type.
          </div>
        ) : (
        <>
          <div style={{ width: '100%', height: chartData.length * 32 + 80 }}>
            <ResponsiveContainer>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 30, right: 60, bottom: 30, left: 220 }}
                onClick={handleClick}
                barGap={2}
              >
                <CartesianGrid stroke={PALETTE.rule} horizontal={false} />
                <XAxis
                  type="number"
                  xAxisId="seeds"
                  orientation="top"
                  tickFormatter={fmt}
                  tick={{ fontSize: 10, fill: PALETTE.navy, fontFamily: FONT_MONO }}
                  stroke={PALETTE.rule}
                />
                <XAxis
                  type="number"
                  xAxisId="edges"
                  orientation="bottom"
                  tickFormatter={fmt}
                  tick={{ fontSize: 10, fill: PALETTE.burgundy, fontFamily: FONT_MONO }}
                  stroke={PALETTE.rule}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={ColoredYTick}
                  stroke={PALETTE.rule}
                  width={220}
                />
                <Tooltip
                  contentStyle={{
                    background: PALETTE.paper,
                    border: `1px solid ${PALETTE.ink}`,
                    fontFamily: FONT_BODY,
                    fontSize: 12,
                    borderRadius: 0,
                  }}
                  labelStyle={{ color: PALETTE.ink, fontWeight: 600 }}
                  formatter={(v, name) => [
                    fmtFull(v),
                    name === 'seeds' ? 'Publications' : 'Citations',
                  ]}
                />
                <Bar dataKey="seeds" xAxisId="seeds" cursor="pointer" name="seeds">
                  {chartData.map((d, i) => {
                    const isFiltered = currentView && currentView !== 'all_thailand';
                    const isSelected = currentView === d.id;
                    const fill = isFiltered && !isSelected
                      ? PALETTE.navy + '40'
                      : PALETTE.navy;
                    return (
                      <Cell
                        key={`s-${i}`}
                        fill={fill}
                        stroke={isSelected ? PALETTE.ink : 'none'}
                        strokeWidth={isSelected ? 1.5 : 0}
                      />
                    );
                  })}
                </Bar>
                {/* Citation bar uses lower opacity so the publication
                    (navy) bar is visually dominant. The chart's primary
                    metric is research production; citations are
                    supporting context. */}
                <Bar
                  dataKey="edges"
                  xAxisId="edges"
                  cursor="pointer"
                  name="edges"
                  fillOpacity={0.5}
                >
                  {chartData.map((d, i) => {
                    const isFiltered = currentView && currentView !== 'all_thailand';
                    const isSelected = currentView === d.id;
                    const fill = isFiltered && !isSelected
                      ? PALETTE.burgundy + '40'
                      : PALETTE.burgundy;
                    return (
                      <Cell
                        key={`e-${i}`}
                        fill={fill}
                        stroke={isSelected ? PALETTE.ink : 'none'}
                        strokeWidth={isSelected ? 1.5 : 0}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div
              className="flex items-center gap-4 flex-wrap"
              style={{
                fontFamily: FONT_MONO,
                fontSize: 9,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              <span className="inline-flex items-center gap-1.5" style={{ color: PALETTE.navy }}>
                <span
                  style={{
                    display: 'inline-block', width: 14, height: 9,
                    background: PALETTE.navy,
                  }}
                />
                Publications (top axis)
              </span>
              <span className="inline-flex items-center gap-1.5" style={{ color: PALETTE.burgundy }}>
                <span
                  style={{
                    display: 'inline-block', width: 14, height: 9,
                    background: PALETTE.burgundy,
                  }}
                />
                Citations (bottom axis)
              </span>
            </div>
            <div className="flex gap-1">
              {[10, 20, 30, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => setShowCount(Math.min(n, filtered.length || institutions.length))}
                  className="px-2 py-1 transition-colors"
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    background: showCount === n ? PALETTE.ink : 'transparent',
                    color: showCount === n ? PALETTE.paper : PALETTE.muted,
                    border: `1px solid ${showCount === n ? PALETTE.ink : PALETTE.rule}`,
                    cursor: showCount === n ? 'default' : 'pointer',
                    minWidth: 36,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </>
        )
      ) : (
        <DataTable
          rows={filtered.map((r) => ({
            ...r,
            short_id: (r.id || '').replace('https://openalex.org/', ''),
          }))}
          columns={[
            { key: 'name', label: 'Institution', align: 'left',
              maxWidth: 380,
              format: (name, r) => (
                <button
                  onClick={() =>
                    onSelectInstitution && onSelectInstitution(r.short_id)
                  }
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: PALETTE.burgundy,
                    cursor: 'pointer',
                    padding: 0,
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    textDecoration: 'underline',
                    textDecorationColor: PALETTE.rule,
                    textUnderlineOffset: 2,
                  }}
                >
                  {name}
                </button>
              ),
            },
            { key: 'type', label: 'Type', align: 'left' },
            { key: 'n_seeds', label: 'Publications', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
            { key: 'n_edges', label: 'Citations', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
            { key: '_avg', label: 'Per paper', align: 'right', mono: true,
              format: (_, r) =>
                r.n_seeds ? (r.n_edges / r.n_seeds).toFixed(1) : '—' },
          ]}
        />
      )}
    </Card>
  );
};

// ============================================================
// INSTITUTION TYPE BREAKDOWN  (clarified parentheses)
// ============================================================
const InstitutionTypesPanel = ({ institutionTypes, view }) => {
  const [mode, setMode] = useState('chart');
  const [showSamples, setShowSamples] = useState(false);
  // Two data shapes are supported:
  //   1. New (view-keyed):  { all_thailand: [...], I158708052: [...], type:education: [...] }
  //   2. Legacy (flat array): [...]   (pre-v2.4 data, treated as all_thailand)
  // The legacy fallback lets old data files keep working while the user
  // regenerates with the new pipeline.
  const items = useMemo(() => {
    if (!institutionTypes) return null;
    if (Array.isArray(institutionTypes)) return institutionTypes;
    return institutionTypes[view] || institutionTypes.all_thailand || null;
  }, [institutionTypes, view]);

  const data = useMemo(
    () => (items || [])
      .map((r) => ({
        type: r.type,
        n_edges: r.n_edges,
        n_seeds: r.n_seeds,
        n_institutions: r.n_institutions,
        sample_institutions: r.sample_institutions || [],
      }))
      .sort((a, b) => b.n_edges - a.n_edges),
    [items],
  );
  const totalEdges = useMemo(
    () => data.reduce((s, r) => s + r.n_edges, 0),
    [data],
  );
  const hasSamples = useMemo(
    () => data.some((r) => r.sample_institutions && r.sample_institutions.length > 0),
    [data],
  );

  // Null check goes after all hooks
  if (!items) return null;

  const isFiltered = view && view !== 'all_thailand';

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <SectionTitle
          icon={Tag}
          kicker="Sector composition"
          title="Citing publications by institutional sector"
          totalN={totalEdges}
          totalLabel="citations (fractionally weighted by sector composition)"
          hint={
            isFiltered
              ? "Each citing publication is split fractionally across the institutional types of its co-authors, then weighted by the citations that publication makes. A paper with two education co-authors and one healthcare co-author contributes 2/3 to education and 1/3 to healthcare. So this panel reflects the institutional composition of the publications behind the citations in this view, not how many institutions of each type exist. Click 'Show institutions' to ground-truth the classification."
              : "Each Thai 2025 publication is split fractionally across the institutional types of its co-authors, then weighted by the citations it makes. A paper with two education co-authors and one healthcare co-author contributes 2/3 to education and 1/3 to healthcare. The result is the institutional composition of citing publications, not a count of distinct institutions. Click 'Show institutions' to ground-truth the classification."
          }
        />
        <ChartTableToggle mode={mode} onChange={setMode} />
      </div>

      {mode === 'chart' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="n_edges"
                  nameKey="type"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={INST_TYPE_COLORS[d.type] || PALETTE.muted} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: PALETTE.paper,
                    border: `1px solid ${PALETTE.ink}`,
                    fontFamily: FONT_BODY,
                    fontSize: 12,
                    borderRadius: 0,
                  }}
                  formatter={(v) => fmtFull(v) + ' citations'}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 self-center">
            {data.map((r) => {
              const p = (r.n_edges / totalEdges) * 100;
              return (
                <div
                  key={r.type}
                  className="flex items-center justify-between gap-3"
                  style={{ fontFamily: FONT_BODY, fontSize: 12 }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        background: INST_TYPE_COLORS[r.type] || PALETTE.muted,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: PALETTE.ink, textTransform: 'capitalize' }}>
                      {r.type}
                    </span>
                    <span
                      style={{ color: PALETTE.muted, fontSize: 10 }}
                      title={`${r.n_institutions} institutions of this type`}
                    >
                      ({r.n_institutions} institutions)
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      color: PALETTE.charcoal,
                      minWidth: 90,
                      textAlign: 'right',
                    }}
                  >
                    {fmt(r.n_edges)}
                    <span style={{ color: PALETTE.muted, marginLeft: 6 }}>
                      {p.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <DataTable
          rows={data}
          columns={[
            { key: 'type', label: 'Type', align: 'left' },
            { key: 'n_institutions', label: 'Institutions', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
            { key: 'n_seeds', label: 'Citing papers', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
            { key: 'n_edges', label: 'Citations', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
            { key: '_pct', label: 'Share', align: 'right', mono: true,
              format: (_, r) => ((r.n_edges / totalEdges) * 100).toFixed(1) + '%' },
          ]}
        />
      )}

      {/* Sample institutions per type — collapsed by default. The list
          serves two purposes: ground-truthing the OpenAlex classification
          (does 'education' really mean universities?), and giving concrete
          examples so the abstract type labels feel less abstract. */}
      {hasSamples && (
        <div
          className="mt-4 pt-3"
          style={{ borderTop: `1px solid ${PALETTE.rule}` }}
        >
          <button
            onClick={() => setShowSamples(!showSamples)}
            className="px-2.5 py-1 transition-colors"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: 'transparent',
              color: PALETTE.muted,
              border: `1px solid ${PALETTE.rule}`,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = PALETTE.ink;
              e.currentTarget.style.color = PALETTE.ink;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = PALETTE.rule;
              e.currentTarget.style.color = PALETTE.muted;
            }}
          >
            {showSamples ? '− Hide' : '+ Show'} institutions in each sector
          </button>
          {showSamples && (
            <div className="mt-3 space-y-3">
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  color: PALETTE.muted,
                  lineHeight: 1.5,
                  marginBottom: 8,
                }}
              >
                Top 10 institutions of each type contributing to this view,
                ranked by citation count. Use this to verify the OpenAlex
                classification matches your expectation.
              </div>
              {data.map((r) => (
                <div
                  key={r.type}
                  style={{
                    paddingLeft: 12,
                    borderLeft: `3px solid ${INST_TYPE_COLORS[r.type] || PALETTE.rule}`,
                  }}
                >
                  <div
                    className="mb-1 flex items-center gap-2 flex-wrap"
                    style={{ fontFamily: FONT_BODY }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: INST_TYPE_COLORS[r.type] || PALETTE.ink,
                        textTransform: 'capitalize',
                      }}
                    >
                      {r.type}
                    </span>
                    <span
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 10,
                        letterSpacing: '0.06em',
                        color: PALETTE.muted,
                      }}
                    >
                      {fmtFull(r.n_institutions)} institution{r.n_institutions === 1 ? '' : 's'}
                      {r.sample_institutions.length < r.n_institutions
                        ? ` · showing top ${r.sample_institutions.length}`
                        : ''}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_BODY,
                      fontSize: 12,
                      color: PALETTE.charcoal,
                      lineHeight: 1.7,
                    }}
                  >
                    {r.sample_institutions.length === 0
                      ? <span style={{ color: PALETTE.muted, fontStyle: 'italic' }}>
                          (no institutions of this type in scope)
                        </span>
                      : r.sample_institutions.map((s, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span style={{ color: PALETTE.rule, margin: '0 6px' }}>·</span>}
                            <span title={`${fmtFull(s.edges)} citations`}>
                              {s.name}
                            </span>
                          </React.Fragment>
                        ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

// ============================================================
// HEADER, FOOTER
// ============================================================
const Header = ({ generatedAt }) => (
  <header
    className="border-b"
    style={{ borderColor: PALETTE.ink, background: PALETTE.paper }}
  >
    <div className="border-b" style={{ borderColor: PALETTE.rule }}>
      <div className="mx-auto max-w-[1400px] px-6 py-3 flex items-center justify-between gap-4">
        <a
          href="https://www.car.chula.ac.th"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-block"
          title="Office of Academic Resources, Chulalongkorn University"
        >
          <img
            src={`${import.meta.env.BASE_URL}oar_logo.png`}
            alt="Office of Academic Resources, Chulalongkorn University"
            style={{ height: 44, width: 'auto', display: 'block' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </a>
        <a
          href="https://thailand-research-dashboard.vercel.app/"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 px-3 py-2 transition-colors"
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            background: PALETTE.cream,
            color: PALETTE.charcoal,
            border: `1px solid ${PALETTE.rule}`,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = PALETTE.ink;
            e.currentTarget.style.color = PALETTE.paper;
            e.currentTarget.style.borderColor = PALETTE.ink;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = PALETTE.cream;
            e.currentTarget.style.color = PALETTE.charcoal;
            e.currentTarget.style.borderColor = PALETTE.rule;
          }}
          title="Open the Thailand Research Dashboard in a new tab"
        >
          <span className="hidden sm:inline">Thailand Research Dashboard</span>
          <span className="inline sm:hidden">Research Dashboard</span>
          <span style={{ fontSize: 12 }}>↗</span>
        </a>
      </div>
    </div>

    <div className="mx-auto max-w-[1400px] px-6 pt-8 pb-6">
      <div
        className="mb-3 uppercase"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.22em',
          color: PALETTE.muted,
        }}
      >
        Citations Coverage Brief · OpenAlex × Public Database Title Lists
      </div>

      <h1
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 44,
          fontWeight: 500,
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          color: PALETTE.ink,
          maxWidth: 900,
        }}
      >
        Thailand 2025 Citations and Database Coverage Snapshot
      </h1>

      <p
        className="mt-4 max-w-3xl"
        style={{
          fontFamily: FONT_BODY,
          fontSize: 15,
          color: PALETTE.charcoal,
          lineHeight: 1.55,
        }}
      >
        Where Thai researchers' 2025 citations land across major academic
        databases. Use this to understand citation patterns, database coverage,
        and overlaps for consortium-level decisions. Start with the
        institutional landscape below to filter the dashboard to a specific
        institution or sector. A reference view of database catalog overlap
        sits at the bottom of the page for the times you need it.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <a
          href="#country-context"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors"
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            background: 'transparent',
            color: PALETTE.muted,
            border: `1px solid ${PALETTE.rule}`,
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = PALETTE.ink;
            e.currentTarget.style.color = PALETTE.ink;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = PALETTE.rule;
            e.currentTarget.style.color = PALETTE.muted;
          }}
          title="Jump to the database catalog overlap reference"
        >
          ↓ Database catalogs
        </a>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: '0.12em',
            color: PALETTE.muted,
            textTransform: 'uppercase',
          }}
        >
          {generatedAt && `Data generated · ${generatedAt.slice(0, 10)}`}
        </div>
      </div>
    </div>
  </header>
);

// ============================================================
// FILTER BAR  (its own section between panoramic and filtered panels)
// ============================================================
const FilterBar = ({ view, onViewChange, viewLabel }) => {
  const isFiltered = view !== 'all_thailand';
  return (
    <div
      style={{
        background: PALETTE.paper,
        borderTop: `2px solid ${PALETTE.ink}`,
        borderBottom: `2px solid ${PALETTE.ink}`,
        position: 'sticky',
        top: 0,
        zIndex: 20,
        marginTop: 8,
        marginBottom: 8,
        // Subtle shadow gives the impression of depth when sticky;
        // looks fine when not stuck too.
        boxShadow: '0 2px 6px rgba(26,22,18,0.05)',
      }}
    >
      <div className="px-5 py-2.5 flex flex-wrap items-center gap-3">
        <div
          className="uppercase"
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.18em',
            color: PALETTE.muted,
            whiteSpace: 'nowrap',
          }}
        >
          Filtered to
        </div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 18,
            fontWeight: 500,
            color: isFiltered ? PALETTE.burgundy : PALETTE.ink,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}
        >
          {viewLabel}
        </div>
        {isFiltered && (
          <button
            onClick={() => onViewChange('all_thailand')}
            className="px-2.5 py-1 transition-colors"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: 'transparent',
              color: PALETTE.muted,
              border: `1px solid ${PALETTE.rule}`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = PALETTE.ink;
              e.currentTarget.style.color = PALETTE.ink;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = PALETTE.rule;
              e.currentTarget.style.color = PALETTE.muted;
            }}
          >
            Reset
          </button>
        )}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="px-2.5 py-1 transition-colors"
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: 'transparent',
            color: PALETTE.muted,
            border: `1px solid ${PALETTE.rule}`,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = PALETTE.ink;
            e.currentTarget.style.color = PALETTE.ink;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = PALETTE.rule;
            e.currentTarget.style.color = PALETTE.muted;
          }}
        >
          ↑ Top
        </button>
        <div
          className="flex-1 text-right hidden md:block"
          style={{
            fontFamily: FONT_BODY,
            fontSize: 11,
            color: PALETTE.muted,
            lineHeight: 1.4,
            minWidth: 180,
          }}
        >
          {isFiltered
            ? 'Scroll up to choose a different institution.'
            : 'Click an institution in the landscape chart to filter.'}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// COUNTRY-LEVEL CONTEXT SECTION
// ============================================================
// A clearly-marked section break for the panels that describe
// Thailand's overall publishing landscape (database overlap and
// publisher Sankey). The hr + kicker + framing paragraph signal
// "you're now leaving the institution-specific analysis and entering
// reference material that doesn't change with the filter." The
// section has id="country-context" so the header anchor link can
// jump readers here directly.
// The bottom-of-page reference section. It originally held both the
// Database overlap and the Publisher flow Sankey under a "Country
// context" heading, but Publisher flow has moved into the filtered
// panels above. The section now contains only the Database overlap,
// which describes a property of the databases themselves (their
// title catalogs), not anything Thailand-specific — so the title
// has been updated to reflect that.
const CountryContextSection = ({ children }) => (
  <section
    id="country-context"
    style={{
      // Tall top margin makes the break feel intentional rather than
      // like the next adjacent panel.
      marginTop: 56,
      paddingTop: 32,
      borderTop: `2px solid ${PALETTE.ink}`,
    }}
  >
    <div className="mb-8">
      <div
        className="mb-2 flex items-center gap-2 uppercase"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.18em',
          color: PALETTE.muted,
        }}
      >
        <span>Section II · Database catalogs</span>
      </div>
      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 32,
          fontWeight: 500,
          lineHeight: 1.1,
          color: PALETTE.ink,
          letterSpacing: '-0.01em',
          marginBottom: 8,
        }}
      >
        How major databases overlap with each other
      </h2>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 14,
          color: PALETTE.charcoal,
          lineHeight: 1.55,
          maxWidth: 760,
        }}
      >
        This view describes a property of the database catalogs themselves
        rather than anything specific to Thailand. It compares the public
        title lists of major academic databases to show how much
        redundancy exists between them, which is useful for thinking
        about subscription decisions and consortium-level coverage.
      </p>
    </div>
    <div className="space-y-6">
      {children}
    </div>
  </section>
);

const Footer = () => (
  <footer
    className="border-t mt-12"
    style={{ borderColor: PALETTE.rule, background: PALETTE.paper }}
  >
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div
        className="flex flex-col gap-2 border-b pb-4 md:flex-row md:items-center md:justify-between"
        style={{ borderColor: PALETTE.rule }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: PALETTE.charcoal,
            lineHeight: 1.55,
            maxWidth: 760,
          }}
        >
          Built by the{' '}
          <a
            href="https://www.car.chula.ac.th"
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: PALETTE.burgundy, textDecoration: 'underline' }}
          >
            Office of Academic Resources, Chulalongkorn University
          </a>
          . Data pipeline, dashboard scaffolding, and visual design developed
          in collaboration with{' '}
          <a
            href="https://www.anthropic.com/claude"
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: PALETTE.burgundy, textDecoration: 'underline' }}
          >
            Claude
          </a>
          , Anthropic's AI assistant.
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            color: PALETTE.muted,
            letterSpacing: '0.16em',
          }}
          className="uppercase"
        >
          {new Date().getFullYear()} · CC0 / MIT
        </div>
      </div>
      <div
        className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          color: PALETTE.muted,
          letterSpacing: '0.12em',
        }}
      >
        <div className="uppercase">
          Citation graph · OpenAlex (CC0) · Database title lists from public
          KBART exports and vendor downloads
        </div>
        <div className="uppercase">Static export · refreshed monthly</div>
      </div>
    </div>
  </footer>
);

// ============================================================
// MAIN
// ============================================================
export default function Dashboard() {
  useFonts();
  const [view, setView] = useState('all_thailand');
  const data = useDataFiles();

  const institutionViews = data.meta?.institution_views || [];
  const typeViews = data.meta?.type_views || [];
  const viewLabel = useMemo(() => {
    if (view === 'all_thailand') return 'All Thailand';
    // Type-aggregate view (e.g. 'type:education')
    if (view.startsWith('type:')) {
      const t = view.slice(5);
      const cap = t.charAt(0).toUpperCase() + t.slice(1);
      return `All ${cap} institutions`;
    }
    // Lookup in the top-N (institution_views in meta.json)
    const fromMeta = institutionViews.find((iv) => iv.id === view);
    if (fromMeta) return fromMeta.name;
    // Fallback: lookup in the full institutions panel data (50 entries)
    if (data.institutions) {
      const fromList = data.institutions.find(
        (r) => (r.id || '').replace('https://openalex.org/', '') === view,
      );
      if (fromList) return fromList.name;
    }
    return view;
  }, [view, institutionViews, data.institutions]);

  if (data.status === 'loading') {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: PALETTE.cream, fontFamily: FONT_BODY }}
      >
        <div className="flex items-center gap-3" style={{ color: PALETTE.muted }}>
          <Loader2 className="animate-spin" size={20} />
          <span>Loading dashboard data…</span>
        </div>
      </div>
    );
  }

  if (data.status === 'error') {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: PALETTE.cream, fontFamily: FONT_BODY }}
      >
        <Card className="p-6 max-w-lg">
          <div
            className="flex items-center gap-2 mb-3"
            style={{ color: PALETTE.burgundy }}
          >
            <AlertCircle size={20} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20 }}>
              Could not load data
            </span>
          </div>
          <p style={{ color: PALETTE.charcoal, fontSize: 14 }}>{data.error}</p>
          <p className="mt-3" style={{ color: PALETTE.muted, fontSize: 13 }}>
            Make sure the JSON files are in <code>public/data/</code> at the
            project root. Run <code>python export_dashboard_v2.py</code> on the
            data side to regenerate them.
          </p>
        </Card>
      </div>
    );
  }

  // Validate that the current view exists in the data; if not, fall back
  const viewExists = data.summary && data.summary[view];
  const effectiveView = viewExists ? view : 'all_thailand';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: PALETTE.cream,
        fontFamily: FONT_BODY,
        color: PALETTE.ink,
      }}
    >
      <Header generatedAt={data.meta?.generated_at} />
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="space-y-6">
          {/* Institutional landscape: panoramic, but it's the entry point
              for the rest of the dashboard (clicking an institution or
              type pill drives the global filter). It belongs above the
              filter bar even though it's not itself filter-dependent. */}
          <TopInstitutionsPanel
            institutions={data.institutions}
            onSelectInstitution={setView}
            currentView={effectiveView}
            typeViews={typeViews}
          />

          {/* Filter bar: readout + reset button */}
          <FilterBar
            view={effectiveView}
            onViewChange={setView}
            viewLabel={viewLabel}
          />

          {!viewExists && view !== 'all_thailand' && (
            <Card
              className="p-4"
              style={{ borderColor: PALETTE.gold, background: PALETTE.cream }}
            >
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: PALETTE.charcoal,
                }}
              >
                Showing All Thailand because per-institution data has not been
                exported yet. Re-run <code>python export_dashboard_v2.py</code>
                to generate institution-specific views.
              </div>
            </Card>
          )}

          {/* Filter-dependent panels */}
          <TopStats
            summary={data.summary}
            view={effectiveView}
            viewLabel={viewLabel}
          />
          <ByYearPanel byYear={data.by_year} view={effectiveView} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ByTypePanel byType={data.by_type} view={effectiveView} />
            <InstitutionTypesPanel
              institutionTypes={data.institution_types}
              view={effectiveView}
            />
          </div>

          <InstitutionOverlapHeatmap
            institutionOverlap={data.institution_overlap}
            currentView={effectiveView}
          />

          <TopPublishersPanel
            byPublisher={data.by_publisher}
            summary={data.summary}
            view={effectiveView}
          />
          {/* Publisher flow Sankey: now reactive to the global filter,
              so it sits with the other filtered panels right after
              publisher concentration (its conceptual neighbor). */}
          <PublisherSankey
            publisherSankey={data.publisher_sankey}
            view={effectiveView}
            viewLabel={viewLabel}
            isFiltered={effectiveView !== 'all_thailand'}
          />
          <CoverageTable
            coverage={data.coverage}
            summary={data.summary}
            view={effectiveView}
          />

          {/* Database catalog reference. The database overlap panel
              describes a property of the database catalogs themselves
              (which titles each one indexes), not anything Thai-specific.
              It lives at the bottom as reference material. */}
          <CountryContextSection>
            <OverlapHeatmap
              overlap={data.overlap}
              meta={data.meta}
              summary={data.summary}
            />
          </CountryContextSection>
        </div>
      </main>
      <Footer />
    </div>
  );
}
