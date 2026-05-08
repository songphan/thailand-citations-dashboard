import React, { useEffect, useMemo, useState } from 'react';
import {
  Database, Network, AlertCircle, Loader2,
  Calendar, FileText, Building2, BookOpen, Tag,
  BarChart3, Table as TableIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Cell, PieChart, Pie,
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
  });

  useEffect(() => {
    const base = `${import.meta.env.BASE_URL}data/`;
    const files = [
      'meta', 'summary', 'coverage', 'overlap',
      'by_year', 'by_type', 'by_publisher',
      'institutions', 'institution_types',
    ];
    Promise.all(
      files.map((f) =>
        fetch(`${base}${f}.json`).then((r) => {
          if (!r.ok) throw new Error(`Failed to load ${f}.json (${r.status})`);
          return r.json().then((j) => [f, j]);
        }),
      ),
    )
      .then((entries) => {
        const result = Object.fromEntries(entries);
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
const StatBlock = ({ label, value, sublabel, accent = PALETTE.ink }) => (
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
  </div>
);

const TopStats = ({ summary, view, viewLabel }) => {
  if (!summary) return null;
  const s = summary[view];
  if (!s) return null;
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
            accent={PALETTE.navy}
          />
        </div>
        <div style={{ borderRight: `1px solid ${PALETTE.rule}` }}>
          <StatBlock
            label="Total citations"
            value={fmt(s.n_total_edges)}
            sublabel={fmtFull(s.n_total_edges)}
            accent={PALETTE.burgundy}
          />
        </div>
        <div style={{ borderRight: `1px solid ${PALETTE.rule}` }}>
          <StatBlock
            label="Avg citations / paper"
            value={fmtDecimal(s.avg_per_paper)}
            sublabel="across all cited types"
            accent={PALETTE.gold}
          />
        </div>
        <div style={{ borderRight: `1px solid ${PALETTE.rule}` }}>
          <StatBlock
            label="Unique cited works"
            value={fmt(s.n_unique_cited)}
            sublabel={`${((s.n_unique_cited / s.n_total_edges) * 100).toFixed(1)}% of citations`}
            accent={PALETTE.teal}
          />
        </div>
        <div className="col-span-2 md:col-span-3 lg:col-span-1">
          <StatBlock
            label="Books / Chapters"
            value={fmtPct(s.pct_books)}
            sublabel={`${fmtFull(s.n_books_chapters)} citations`}
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

const CoverageBar = ({ value, color }) => (
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
    <span
      className="absolute"
      style={{
        right: 6,
        top: '50%',
        transform: 'translateY(-50%)',
        fontFamily: FONT_MONO,
        fontSize: 10,
        color: value > 30 ? PALETTE.paper : PALETTE.charcoal,
        letterSpacing: '0.05em',
      }}
    >
      {value.toFixed(1)}%
    </span>
  </div>
);

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
        hint="Matched on normalized ISSN against the public title list of each database. This shows the technical coverage potential of each database, not whether a particular library subscribes to it."
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
              <th style={{ ...cellHead, width: '36%' }}>Citation coverage</th>
              <th style={{ ...cellHead, width: 110, textAlign: 'right' }}>Unique</th>
            </tr>
          </thead>
          <tbody>
            {dbs.map((d) => (
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
                <td style={cellBody}>
                  <CoverageBar value={d.edges_pct} color={TYPE_COLORS[d.type]} />
                </td>
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
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="mt-4"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          letterSpacing: '0.12em',
          color: PALETTE.muted,
          textTransform: 'uppercase',
        }}
      >
        Note · EBSCO ASC/ASP/ASU share the same indexing universe but differ in their full-text holdings
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

  // Filter by database type using meta.databases lookup
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
                      color: PALETTE.charcoal,
                      fontWeight: 400,
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
                      fontWeight: 400,
                      color: PALETTE.charcoal,
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
        <span>Row → column · Click any cell for details</span>
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

  const { data, total, peak, fullData } = useMemo(() => {
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
    const data = oldBucket ? [oldBucket, ...recent] : recent;
    const total = data.reduce((s, r) => s + r.edges, 0);
    const peak = data.reduce((m, r) => (r.edges > (m?.edges || 0) ? r : m), null);
    const fullData = [...raw].sort((a, b) => b.year - a.year);
    return { data, total, peak, fullData };
  }, [raw]);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <SectionTitle
          icon={Calendar}
          kicker="Time horizon"
          title="When are the cited works from"
          hint={`Distribution of ${fmtFull(total)} citations by the publication year of the cited work. Pre-1990 collapsed in the chart for readability; the table view shows every year.`}
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
                    <stop offset="0%" stopColor={PALETTE.burgundy} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={PALETTE.burgundy} stopOpacity={0.05} />
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
                  tickFormatter={fmt}
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
                  formatter={(value, name) => [
                    fmtFull(value),
                    name === 'edges' ? 'Citations' : 'Unique',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="edges"
                  stroke={PALETTE.burgundy}
                  strokeWidth={1.5}
                  fill="url(#yearArea)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {peak && (
            <div
              className="mt-2"
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
const TopPublishersPanel = ({ byPublisher, view }) => {
  const [mode, setMode] = useState('chart');
  const [showCount, setShowCount] = useState(15);
  if (!byPublisher || !byPublisher[view]) return null;
  const allData = byPublisher[view] || [];
  const data = useMemo(
    () => allData.slice(0, showCount).map((r) => ({
      publisher: r.publisher,
      edges: r.edges,
    })),
    [allData, showCount],
  );

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <SectionTitle
          icon={BookOpen}
          kicker="Publisher concentration"
          title="Which publishers' journals get cited most"
          hint="Top publishers by citation count. Heavy concentration in a few names tells you where subscription money has the most leverage."
        />
        <ChartTableToggle mode={mode} onChange={setMode} />
      </div>

      {mode === 'chart' ? (
        <>
          <div style={{ width: '100%', height: data.length * 26 + 40 }}>
            <ResponsiveContainer>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 60, bottom: 4, left: 200 }}
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
                  formatter={(v) => [fmtFull(v), 'Citations']}
                />
                <Bar dataKey="edges" fill={PALETTE.teal} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.12em',
                color: PALETTE.muted,
                textTransform: 'uppercase',
              }}
            >
              Showing top {showCount} of {allData.length}
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
          rows={allData}
          columns={[
            { key: 'publisher', label: 'Publisher', align: 'left',
              maxWidth: 360 },
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

const TopInstitutionsPanel = ({ institutions, onSelectInstitution, currentView }) => {
  const [mode, setMode] = useState('chart');
  const [showCount, setShowCount] = useState(20);
  if (!institutions) return null;

  const chartData = useMemo(
    () => institutions.slice(0, showCount).map((r) => ({
      id: (r.id || '').replace('https://openalex.org/', ''),
      name: r.name
        .replace(/^King Mongkut's /, "KMUT-")
        .replace(/^King Mongkut /, "KMUT-"),
      type: r.type || 'other',
      edges: r.n_edges,
      seeds: r.n_seeds,
    })),
    [institutions, showCount],
  );

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <SectionTitle
          icon={Building2}
          kicker="Institutional landscape"
          title="Which Thai institutions cite the most"
          hint="All Thai institutions ranked by their 2025 outgoing citations. Click a bar (in chart mode) or row (in table mode) to filter the dashboard to that institution. Co-affiliations are counted once for each institution."
        />
        <ChartTableToggle mode={mode} onChange={setMode} />
      </div>

      {mode === 'chart' ? (
        <>
          <div style={{ width: '100%', height: chartData.length * 24 + 40 }}>
            <ResponsiveContainer>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 60, bottom: 4, left: 220 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const id = e.activePayload[0].payload.id;
                    if (id && onSelectInstitution) onSelectInstitution(id);
                  }
                }}
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
                  dataKey="name"
                  tick={{ fontSize: 10, fill: PALETTE.charcoal, fontFamily: FONT_BODY }}
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
                  formatter={(v) => [fmtFull(v), 'Citations']}
                />
                <Bar dataKey="edges" cursor="pointer">
                  {chartData.map((d, i) => {
                    const baseColor = INST_TYPE_COLORS[d.type] || PALETTE.muted;
                    const isFiltered = currentView && currentView !== 'all_thailand';
                    const isSelected = currentView === d.id;
                    // When filtered, the selected bar stays full color and gains
                    // a stroke; everything else fades to ~25% opacity.
                    const fill = isFiltered && !isSelected
                      ? baseColor + '40'  // hex alpha 40 = ~25%
                      : baseColor;
                    return (
                      <Cell
                        key={i}
                        fill={fill}
                        stroke={isSelected ? PALETTE.ink : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-3">
              {Object.entries(INST_TYPE_COLORS)
                .filter(([t]) => chartData.some((d) => d.type === t))
                .map(([t, color]) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5"
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      color: PALETTE.muted,
                      textTransform: 'uppercase',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 9,
                        height: 9,
                        background: color,
                      }}
                    />
                    {t}
                  </span>
                ))}
            </div>
            <div className="flex gap-1">
              {[10, 20, 30, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => setShowCount(Math.min(n, institutions.length))}
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
          rows={institutions.map((r) => ({
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
            { key: 'n_seeds', label: 'Citing papers', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
            { key: 'n_edges', label: 'Citations', align: 'right', mono: true,
              format: (v) => fmtFull(v) },
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
      <div className="mx-auto max-w-[1400px] px-6 py-3">
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
const FilterBar = ({ view, onViewChange, institutionViews, viewLabel }) => (
  <div
    className="border-y my-2"
    style={{
      background: PALETTE.paper,
      borderColor: PALETTE.ink,
    }}
  >
    <div className="px-5 py-4 flex flex-wrap items-end gap-5">
      <div className="flex-1" style={{ minWidth: 300 }}>
        <div
          className="mb-1.5 uppercase"
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.18em',
            color: PALETTE.muted,
          }}
        >
          The panels below are filtered by:
        </div>
        <InstitutionSelector
          view={view}
          onChange={onViewChange}
          institutionViews={institutionViews}
        />
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 13,
          color: PALETTE.charcoal,
          lineHeight: 1.4,
          maxWidth: 480,
          paddingBottom: 6,
        }}
      >
        Currently showing:{' '}
        <strong style={{ color: PALETTE.burgundy }}>{viewLabel}</strong>.
        Switch to any other institution to update the panels below. The two
        panels above this bar (overlap and institutional landscape) do not
        change with this filter.
      </div>
    </div>
  </div>
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
  const viewLabel = useMemo(() => {
    if (view === 'all_thailand') return 'All Thailand';
    const found = institutionViews.find((iv) => iv.id === view);
    return found ? found.name : view;
  }, [view, institutionViews]);

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
          <TopInstitutionsPanel
            institutions={data.institutions}
            onSelectInstitution={setView}
            currentView={effectiveView}
          />

          {/* Filter bar: dropdown + active-filter readout */}
          <FilterBar
            view={effectiveView}
            onViewChange={setView}
            institutionViews={institutionViews}
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

          <TopPublishersPanel byPublisher={data.by_publisher} view={effectiveView} />
          <CoverageTable coverage={data.coverage} view={effectiveView} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
