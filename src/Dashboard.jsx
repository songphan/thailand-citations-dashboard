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

const SectionTitle = ({ icon: Icon, kicker, title, hint }) => (
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

const CoverageTable = ({ coverage, view }) => {
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
    const filtered = typeFilter === 'all'
      ? data.databases
      : data.databases.filter((d) => d.type === typeFilter);
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
const OverlapHeatmap = ({ overlap, meta }) => {
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
  const { labels, matrix, dbKeys } = useMemo(() => {
    const typeByKey = {};
    if (meta && meta.databases) {
      for (const d of meta.databases) typeByKey[d.key] = d.type;
    }
    let indices = o.databases.map((_, i) => i);
    if (typeFilter !== 'all') {
      indices = o.databases
        .map((k, i) => (typeByKey[k] === typeFilter ? i : -1))
        .filter((i) => i !== -1);
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
        hint={
          'Each cell shows what percentage of one database\'s coverage (the row) is also covered by another database (the column). ' +
          'Numbers are based on the public title lists of each database, not on any specific institution\'s subscriptions. ' +
          'Click a cell to see the underlying counts. This panel reflects all-Thailand citations and does not change with the institution filter below.'
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
const SankeyNode = ({ x, y, width, height, index, payload, containerWidth }) => {
  const isLeft = x < containerWidth / 2;
  const color = payload.side === 'seed' ? PALETTE.navy : PALETTE.burgundy;
  return (
    <Layer key={`sankey-node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={payload.name === 'Other publishers' ? 0.4 : 0.85}
      />
      <text
        x={isLeft ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={isLeft ? 'end' : 'start'}
        dominantBaseline="middle"
        style={{
          fontFamily: FONT_BODY,
          fontSize: 11,
          fill: payload.name === 'Other publishers'
            ? PALETTE.muted
            : PALETTE.charcoal,
          fontStyle: payload.name === 'Other publishers' ? 'italic' : 'normal',
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
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          fill: PALETTE.muted,
          letterSpacing: '0.04em',
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
    linkWidth, index } = props;
  // Cubic bezier path between the source and target points.
  const path = `
    M${sourceX},${sourceY}
    C${sourceControlX},${sourceY}
     ${targetControlX},${targetY}
     ${targetX},${targetY}
  `;
  return (
    <Layer key={`sankey-link-${index}`}>
      <defs>
        <linearGradient id={`grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={PALETTE.navy} stopOpacity={0.55} />
          <stop offset="100%" stopColor={PALETTE.burgundy} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={`url(#grad-${index})`}
        strokeWidth={linkWidth}
        strokeOpacity={0.7}
      />
    </Layer>
  );
};

const PublisherSankey = ({ publisherSankey }) => {
  // We hold the same hooks every render even when data is null, so the
  // null guard sits below all hook calls.
  const data = publisherSankey;
  const hasData = data && Array.isArray(data.nodes) && data.nodes.length > 0
    && Array.isArray(data.links) && data.links.length > 0;

  // Recharts mutates the data it's given, so we deep-clone via JSON
  // round-trip. Cheap (a few hundred objects) and avoids subtle bugs
  // where the second render sees a mutated first-render structure.
  const sankeyData = useMemo(() => {
    if (!hasData) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    };
  }, [data, hasData]);

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

  if (!hasData) return null;

  const m = data.meta || {};

  return (
    <Card className="p-5">
      <SectionTitle
        icon={GitBranch}
        kicker="Publisher flow"
        title="Citations from Thai publications to cited publishers"
        hint={
          `Each strand is a flow from one seed publisher (left, navy) to one cited publisher (right, burgundy); thickness is proportional to the number of citation edges between them. Top ${m.n_seed_publishers_shown - 1} publishers on each side are shown by name; the rest are aggregated into "Other publishers" buckets. Hover any strand for the exact count. Coverage: ${m.coverage_pct}% of all citations have publisher metadata on both sides.`
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
        <span>{fmtFull(m.total_edges_with_both_publishers || 0)} citations shown</span>
      </div>

      <div style={{ width: '100%', height: 600 }}>
        <ResponsiveContainer>
          <Sankey
            data={sankeyData}
            node={<SankeyNode containerWidth={1200} />}
            link={<SankeyLink />}
            nodePadding={14}
            nodeWidth={10}
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
const InstitutionOverlapHeatmap = ({ institutionOverlap }) => {
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedCell, setSelectedCell] = useState(null);

  // We compute everything against the data even when it might be missing,
  // so React always sees the same hook order across renders. The null
  // guard lives at the bottom of the function (just before JSX).
  const o = institutionOverlap;
  const insts = (o && o.institutions) || [];

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

  // Reset cell selection when the type filter changes (the previously
  // selected indices may not exist in the new matrix)
  useEffect(() => {
    setSelectedCell(null);
  }, [typeFilter]);

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
        title="How much do Thai institutions cite the same literature"
        hint="For each ordered pair (row → column), the cell shows what share of the row institution's distinct cited works are also cited by the column institution. Citations from papers the two institutions co-authored are excluded — without that exclusion, co-authorship alone would inflate every cell. Use the type filter to compare institutions within a category. Click any cell for the underlying counts."
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
          Filter by type
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
          hint={
            isFiltered
              ? `Each year as a percentage of total citations, so this institution and All Thailand are directly comparable. The Thailand area sits behind in muted gold; the selected institution sits on top in burgundy.`
              : `Distribution of ${fmtFull(total)} citations by the publication year of the cited work. Pre-1990 collapsed in the chart; the table view shows every year.`
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

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <SectionTitle
          icon={FileText}
          kicker="Material types"
          title="What kinds of works are being cited"
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
                  tick={{ fontSize: 10.5, fill: PALETTE.charcoal, fontFamily: FONT_BODY }}
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
const InstitutionTypesPanel = ({ institutionTypes }) => {
  const [mode, setMode] = useState('chart');
  if (!institutionTypes) return null;
  const data = useMemo(
    () => institutionTypes
      .map((r) => ({
        type: r.type,
        n_edges: r.n_edges,
        n_seeds: r.n_seeds,
        n_institutions: r.n_institutions,
      }))
      .sort((a, b) => b.n_edges - a.n_edges),
    [institutionTypes],
  );
  const totalEdges = useMemo(
    () => data.reduce((s, r) => s + r.n_edges, 0),
    [data],
  );

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <SectionTitle
          icon={Tag}
          kicker="Sector mix"
          title="Citations by institution type"
          hint="OpenAlex institutional classification. Citations counted across all author affiliations."
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
        Thailand Citations and Databases Dashboard
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
        and overlaps for consortium-level decisions. The first two panels
        below show the consortium-wide picture; use the institution filter
        further down to drill into a specific Thai institution.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <a
          href="#/explore"
          className="inline-flex items-center gap-1.5 px-3 py-2 transition-colors"
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: 'transparent',
            color: PALETTE.burgundy,
            border: `1px solid ${PALETTE.burgundy}`,
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = PALETTE.burgundy;
            e.currentTarget.style.color = PALETTE.paper;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = PALETTE.burgundy;
          }}
        >
          Explore in SQL →
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
          {/* Panoramic panels: do NOT depend on the institution filter */}
          <OverlapHeatmap overlap={data.overlap} meta={data.meta} />
          <PublisherSankey publisherSankey={data.publisher_sankey} />
          <TopInstitutionsPanel
            institutions={data.institutions}
            onSelectInstitution={setView}
            currentView={effectiveView}
            typeViews={typeViews}
          />
          <InstitutionOverlapHeatmap
            institutionOverlap={data.institution_overlap}
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
            <InstitutionTypesPanel institutionTypes={data.institution_types} />
          </div>

          <TopPublishersPanel
            byPublisher={data.by_publisher}
            summary={data.summary}
            view={effectiveView}
          />
          <CoverageTable coverage={data.coverage} view={effectiveView} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
