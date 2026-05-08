import React, { useEffect, useMemo, useState } from 'react';
import {
  Database, Layers, Network, AlertCircle, Loader2,
  Calendar, FileText, Building2, BookOpen, Tag, GitCompare,
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

// Inject Google Fonts once at first mount
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
  <header className="mb-4">
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
        fontSize: 28,
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
        className="mt-1"
        style={{
          fontFamily: FONT_BODY,
          fontSize: 13,
          color: PALETTE.muted,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </p>
    )}
  </header>
);

// ============================================================
// VIEW TOGGLE  (All Thailand vs Chulalongkorn)
// ============================================================
const ViewToggle = ({ view, onChange }) => {
  const opts = [
    { key: 'all_thailand', label: 'All Thailand' },
    { key: 'chulalongkorn', label: 'Chulalongkorn' },
  ];
  return (
    <div
      className="inline-flex border"
      style={{ borderColor: PALETTE.ink, background: PALETTE.paper }}
    >
      {opts.map((o, i) => {
        const active = view === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className="px-4 py-2 transition-colors"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: active ? PALETTE.ink : 'transparent',
              color: active ? PALETTE.paper : PALETTE.ink,
              borderLeft: i > 0 ? `1px solid ${PALETTE.ink}` : 'none',
              cursor: active ? 'default' : 'pointer',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

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
        fontSize: 32,
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

const TopStats = ({ summary, coverage, view }) => {
  if (!summary || !coverage) return null;
  const s = summary[view];
  return (
    <Card className="p-0">
      <div
        className="grid grid-cols-2 md:grid-cols-4"
        style={{ borderColor: PALETTE.rule }}
      >
        <div style={{ borderRight: `1px solid ${PALETTE.rule}` }}>
          <StatBlock
            label="Citing publications"
            value={fmt(s.n_seeds)}
            sublabel={`${fmtFull(s.n_seeds)} ${view === 'chulalongkorn' ? 'CU papers' : 'Thai papers'}`}
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
            label="Unique cited works"
            value={fmt(s.n_unique_cited)}
            sublabel={`${((s.n_unique_cited / s.n_total_edges) * 100).toFixed(1)}% of citations`}
            accent={PALETTE.teal}
          />
        </div>
        <div>
          <StatBlock
            label="Books / Chapters"
            value={fmtPct(s.pct_books)}
            sublabel={`${fmtFull(s.n_books_chapters)} citations`}
            accent={PALETTE.gold}
          />
        </div>
      </div>
    </Card>
  );
};

// ============================================================
// COVERAGE TABLE
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
      borderRadius: 0,
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

const CoverageTable = ({ coverage, view }) => {
  if (!coverage) return null;
  const data = coverage[view];
  // Sort by edges_pct desc; keep DOAJ at the top regardless because
  // it represents a distinct (open access) regime.
  const dbs = useMemo(() => {
    const sorted = [...data.databases].sort((a, b) => {
      if (a.type === 'open_access' && b.type !== 'open_access') return -1;
      if (b.type === 'open_access' && a.type !== 'open_access') return 1;
      return b.edges_pct - a.edges_pct;
    });
    return sorted;
  }, [data]);
  const any = data.any_subscribed;
  return (
    <Card className="p-5">
      <SectionTitle
        icon={Database}
        kicker="Database coverage"
        title="What fraction of citations is reachable through each database"
        hint={`Matched on normalized ISSN against ${view === 'chulalongkorn' ? "Chulalongkorn researchers'" : "all Thai researchers'"} 2025 outgoing citations. Index = bibliographic record only. Full text = subscribed reading access.`}
      />
      <div
        className="overflow-x-auto"
        style={{ fontFamily: FONT_BODY, fontSize: 13 }}
      >
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
              <th style={{ ...cellHead, width: 80 }}>Type</th>
              <th style={{ ...cellHead, width: 100, textAlign: 'right' }}>
                Citations
              </th>
              <th style={{ ...cellHead, width: '32%' }}>Citation coverage</th>
              <th style={{ ...cellHead, width: 90, textAlign: 'right' }}>
                Unique
              </th>
              <th style={{ ...cellHead, width: 70, textAlign: 'right' }}>
                Sub.
              </th>
            </tr>
          </thead>
          <tbody>
            {dbs.map((d) => (
              <tr
                key={d.key}
                style={{ borderTop: `1px solid ${PALETTE.rule}` }}
              >
                <td style={cellBody}>
                  <span style={{ color: PALETTE.ink, fontWeight: 500 }}>
                    {d.label}
                  </span>
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
                <td
                  style={{
                    ...cellBody,
                    textAlign: 'right',
                    fontFamily: FONT_MONO,
                  }}
                >
                  {fmtFull(d.edges)}
                </td>
                <td style={cellBody}>
                  <CoverageBar
                    value={d.edges_pct}
                    color={TYPE_COLORS[d.type]}
                  />
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
                <td style={{ ...cellBody, textAlign: 'right' }}>
                  {d.subscribed ? (
                    <span
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 10,
                        color: PALETTE.forest,
                      }}
                    >
                      ●
                    </span>
                  ) : (
                    <span
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 10,
                        color: PALETTE.muted,
                      }}
                      title="Not currently subscribed"
                    >
                      ○
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {any && (
              <tr
                style={{
                  borderTop: `2px solid ${PALETTE.ink}`,
                  background: PALETTE.cream,
                }}
              >
                <td
                  style={{
                    ...cellBody,
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Any currently subscribed
                </td>
                <td style={cellBody}></td>
                <td
                  style={{
                    ...cellBody,
                    textAlign: 'right',
                    fontFamily: FONT_MONO,
                    fontWeight: 600,
                  }}
                >
                  {fmtFull(any.edges)}
                </td>
                <td style={cellBody}>
                  <CoverageBar value={any.edges_pct} color={PALETTE.ink} />
                </td>
                <td
                  style={{
                    ...cellBody,
                    textAlign: 'right',
                    fontFamily: FONT_MONO,
                    fontWeight: 600,
                    color: PALETTE.charcoal,
                  }}
                >
                  {fmtFull(any.unique)}
                </td>
                <td style={cellBody}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div
        className="mt-4 flex flex-wrap gap-4"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          letterSpacing: '0.12em',
          color: PALETTE.muted,
          textTransform: 'uppercase',
        }}
      >
        <span>● Subscribed at OAR</span>
        <span>○ Not subscribed</span>
        <span>EBSCO ASC/ASP/ASU share index, differ in full text</span>
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
// OVERLAP HEATMAP
// ============================================================
const OverlapHeatmap = ({ overlap, view }) => {
  if (!overlap) return null;
  const o = overlap[view];
  const labels = o.labels;
  const matrix = o.matrix;
  // Diagonal is the unique-coverage of each database. Use the max
  // off-diagonal value as the color scale max so the diagonal
  // doesn't dominate.
  const maxOff = useMemo(() => {
    let m = 0;
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix.length; j++) {
        if (i !== j && matrix[i][j] > m) m = matrix[i][j];
      }
    }
    return m;
  }, [matrix]);
  const colorFor = (val, isDiag) => {
    if (val === 0) return PALETTE.cream;
    const ratio = Math.min(val / maxOff, 1);
    // Map ratio to burgundy intensity. Diagonal uses a different (gold) hue
    // so it visually separates from the off-diagonal overlap cells.
    const hue = isDiag ? PALETTE.gold : PALETTE.burgundy;
    return `${hue}${alpha(ratio)}`;
  };
  function alpha(r) {
    const a = Math.round(0.15 + r * 0.85 * 255);
    const max = Math.min(255, a);
    return max.toString(16).padStart(2, '0');
  }
  return (
    <Card className="p-5">
      <SectionTitle
        icon={Network}
        kicker="Database overlap"
        title="How much do databases redundantly cover the same citations"
        hint="Each cell shows the count of unique cited works covered by both databases. Diagonal shows the database's standalone coverage."
      />
      <div className="overflow-x-auto">
        <table
          style={{
            borderCollapse: 'collapse',
            fontFamily: FONT_MONO,
            fontSize: 9.5,
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
                    height: 130,
                    verticalAlign: 'bottom',
                    textAlign: 'left',
                    color: PALETTE.charcoal,
                    fontWeight: 400,
                    minWidth: 26,
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
                  const val = matrix[i][j];
                  const isDiag = i === j;
                  return (
                    <td
                      key={j}
                      title={`${labels[i]} ∩ ${labels[j]}: ${fmtFull(val)}`}
                      style={{
                        width: 26,
                        height: 26,
                        textAlign: 'center',
                        background: colorFor(val, isDiag),
                        color:
                          val > maxOff * 0.5 ? PALETTE.paper : PALETTE.charcoal,
                        border: `1px solid ${PALETTE.paper}`,
                        cursor: 'help',
                        fontSize: 8,
                      }}
                    >
                      {val >= 1000
                        ? Math.round(val / 1000) + 'k'
                        : val > 0
                        ? val
                        : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              background: PALETTE.gold,
            }}
          />
          Standalone (diagonal)
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
        <span>Hover for exact counts</span>
      </div>
    </Card>
  );
};

// ============================================================
// CITATIONS BY YEAR  (area chart, with pre-1990 bucketed)
// ============================================================
const ByYearPanel = ({ byYear, view }) => {
  if (!byYear) return null;
  const raw = byYear[view] || [];
  // Bucket pre-1990 to keep the recent-decades trend visible.
  const data = useMemo(() => {
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
    return oldBucket ? [oldBucket, ...recent] : recent;
  }, [raw]);

  const total = useMemo(
    () => data.reduce((s, r) => s + r.edges, 0),
    [data],
  );

  // Find the year with peak citations for annotation
  const peak = useMemo(
    () => data.reduce((m, r) => (r.edges > (m?.edges || 0) ? r : m), null),
    [data],
  );

  return (
    <Card className="p-5">
      <SectionTitle
        icon={Calendar}
        kicker="Time horizon"
        title="When are the cited works from"
        hint={`Distribution of ${fmtFull(total)} citations by the publication year of the cited work. Pre-1990 collapsed into a single bucket.`}
      />
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
              formatter={(value, name) => [fmtFull(value), name === 'edges' ? 'Citations' : 'Unique']}
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
    </Card>
  );
};

// ============================================================
// CITATIONS BY TYPE  (horizontal bar with subscription overlay)
// ============================================================
const ByTypePanel = ({ byType, view }) => {
  if (!byType) return null;
  const data = useMemo(() => {
    const items = byType[view] || [];
    return items
      .filter((r) => r.edges >= 100)
      .map((r) => ({
        type: r.type,
        edges: r.edges,
        unique: r.unique,
      }));
  }, [byType, view]);
  const total = useMemo(() => data.reduce((s, r) => s + r.edges, 0), [data]);

  return (
    <Card className="p-5">
      <SectionTitle
        icon={FileText}
        kicker="Material types"
        title="What kinds of works are being cited"
        hint="OpenAlex work-type classification. Articles dominate, but reviews, books, and chapters represent specific subscription needs. Types with fewer than 100 citations are omitted."
      />
      <div style={{ width: '100%', height: Math.max(220, data.length * 30) }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
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
            <Bar dataKey="edges" fill={PALETTE.navy}>
              {data.map((d, i) => (
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
        Total · {fmtFull(total)} citations across {data.length} types
      </div>
    </Card>
  );
};

// ============================================================
// TOP PUBLISHERS
// ============================================================
const TopPublishersPanel = ({ byPublisher, view }) => {
  if (!byPublisher) return null;
  const [showCount, setShowCount] = useState(15);
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
      <SectionTitle
        icon={BookOpen}
        kicker="Publisher concentration"
        title="Which publishers' journals get cited most"
        hint="Top publishers by citation count. Heavy concentration in a few names tells you where subscription money has the most impact."
      />
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
          {[10, 15, 25, 50, 100].map((n) => (
            <button
              key={n}
              onClick={() => setShowCount(n)}
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

const TopInstitutionsPanel = ({ institutions, view }) => {
  if (!institutions) return null;
  // Note: this is a flat list (not view-keyed) because under the
  // Chulalongkorn view, "top citing institutions" would be just CU.
  // We always show the all-Thailand institutional landscape.
  const [showCount, setShowCount] = useState(20);
  const data = useMemo(
    () => institutions.slice(0, showCount).map((r) => ({
      name: r.name.replace(/^King Mongkut's /, "KMUT-").replace(/^King Mongkut /, "KMUT-"),
      type: r.type || 'other',
      edges: r.n_edges,
      seeds: r.n_seeds,
    })),
    [institutions, showCount],
  );

  return (
    <Card className="p-5">
      <SectionTitle
        icon={Building2}
        kicker="Institutional landscape"
        title="Which Thai institutions cite the most"
        hint={
          view === 'chulalongkorn'
            ? "All Thai institutions ranked by their 2025 outgoing citations. Shown in both views since the institutional landscape is constant."
            : "All Thai institutions with 2025 publications, ranked by total outgoing citations. A paper with co-authors at multiple institutions counts once for each."
        }
      />
      <div style={{ width: '100%', height: data.length * 24 + 40 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 60, bottom: 4, left: 220 }}
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
              formatter={(v, name, p) => {
                if (name === 'edges') return [fmtFull(v), 'Citations'];
                return [v, name];
              }}
            />
            <Bar dataKey="edges">
              {data.map((d, i) => (
                <Cell key={i} fill={INST_TYPE_COLORS[d.type] || PALETTE.muted} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-3">
          {Object.entries(INST_TYPE_COLORS)
            .filter(([t]) => data.some((d) => d.type === t))
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
              onClick={() => setShowCount(n)}
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
    </Card>
  );
};

// ============================================================
// INSTITUTION TYPE BREAKDOWN  (small donut)
// ============================================================
const InstitutionTypesPanel = ({ institutionTypes }) => {
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
      <SectionTitle
        icon={Tag}
        kicker="Sector mix"
        title="Citations by institution type"
        hint="OpenAlex institutional classification. Citations counted across all author affiliations."
      />
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
                  <Cell
                    key={i}
                    fill={INST_TYPE_COLORS[d.type] || PALETTE.muted}
                  />
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
                  <span style={{ color: PALETTE.muted, fontSize: 10 }}>
                    ({r.n_institutions})
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
    </Card>
  );
};

// ============================================================
// SCIENCEDIRECT  CU vs STANDARD COMPARISON
// ============================================================
const ScienceDirectComparison = ({ coverage, view }) => {
  if (!coverage) return null;
  const data = coverage[view];
  const cu = data.databases.find((d) => d.key === 'sciencedirect_cu');
  const std = data.databases.find((d) => d.key === 'sciencedirect_std');
  if (!cu || !std) return null;

  const gain_edges = std.edges - cu.edges;
  const gain_unique = std.unique - cu.unique;
  const gain_pct = std.edges_pct - cu.edges_pct;

  return (
    <Card className="p-5">
      <SectionTitle
        icon={GitCompare}
        kicker="Subscription scenario"
        title="ScienceDirect: current CU subscription vs full Standard list"
        hint="What would upgrading from the CU-subscribed ScienceDirect titles to Elsevier's full Standard product gain in coverage."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="p-4"
          style={{
            background: PALETTE.cream,
            border: `1px solid ${PALETTE.rule}`,
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
            Current CU Subscription
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 28,
              fontWeight: 500,
              color: PALETTE.burgundy,
              lineHeight: 1,
            }}
          >
            {fmtPct(cu.edges_pct)}
          </div>
          <div
            className="mt-1"
            style={{ fontFamily: FONT_BODY, fontSize: 11, color: PALETTE.muted }}
          >
            {fmtFull(cu.edges)} citations covered
          </div>
        </div>
        <div
          className="p-4"
          style={{
            background: PALETTE.cream,
            border: `1px solid ${PALETTE.rule}`,
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
            Full Standard Product
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 28,
              fontWeight: 500,
              color: PALETTE.navy,
              lineHeight: 1,
            }}
          >
            {fmtPct(std.edges_pct)}
          </div>
          <div
            className="mt-1"
            style={{ fontFamily: FONT_BODY, fontSize: 11, color: PALETTE.muted }}
          >
            {fmtFull(std.edges)} citations covered
          </div>
        </div>
        <div
          className="p-4"
          style={{
            background: PALETTE.paper,
            border: `2px solid ${PALETTE.ink}`,
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
            Marginal Gain
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 28,
              fontWeight: 600,
              color: PALETTE.ink,
              lineHeight: 1,
            }}
          >
            +{gain_pct.toFixed(2)} pts
          </div>
          <div
            className="mt-1"
            style={{ fontFamily: FONT_BODY, fontSize: 11, color: PALETTE.charcoal }}
          >
            +{fmtFull(gain_edges)} citations · +{fmtFull(gain_unique)} unique works
          </div>
        </div>
      </div>
      <p
        className="mt-4"
        style={{
          fontFamily: FONT_BODY,
          fontSize: 12,
          color: PALETTE.muted,
          lineHeight: 1.5,
          maxWidth: 720,
        }}
      >
        Interpretation: Elsevier's full Standard list is broader than what
        OAR currently subscribes to via the Chula package, but the marginal
        gain in citation coverage is modest. Whether the upgrade is worthwhile
        depends on the cost differential and whether the additional titles
        align with disciplines that are underserved by current subscriptions.
      </p>
    </Card>
  );
};

// ============================================================
// HEADER, FOOTER
// ============================================================
const Header = ({ view, onViewChange, generatedAt }) => (
  <header
    className="border-b"
    style={{ borderColor: PALETTE.ink, background: PALETTE.paper }}
  >
    {/* OAR logo strip */}
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
            onError={(e) => {
              // Hide broken-image icon if logo isn't yet supplied
              e.target.style.display = 'none';
            }}
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
        Citations Coverage Brief · OpenAlex × OAR Indexing Lists
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
        Where Thai researchers' 2025 citations actually land across the
        databases OAR subscribes to. Use this to see which subscriptions
        carry the most weight, where coverage overlaps, and where the
        gaps are.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <ViewToggle view={view} onChange={onViewChange} />
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
            style={{
              color: PALETTE.burgundy,
              textDecoration: 'underline',
            }}
          >
            Office of Academic Resources, Chulalongkorn University
          </a>
          . Data pipeline, dashboard scaffolding, and visual design were
          developed in collaboration with{' '}
          <a
            href="https://www.anthropic.com/claude"
            target="_blank"
            rel="noreferrer noopener"
            style={{
              color: PALETTE.burgundy,
              textDecoration: 'underline',
            }}
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
          Citation graph · OpenAlex (CC0) · Indexing lists from publisher KBART
          and database title-list exports
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
          <p style={{ color: PALETTE.charcoal, fontSize: 14 }}>
            {data.error}
          </p>
          <p
            className="mt-3"
            style={{ color: PALETTE.muted, fontSize: 13 }}
          >
            Make sure the JSON files are in <code>public/data/</code> at the
            project root. Run <code>python pipeline.py export</code> on the
            data side to regenerate them.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: PALETTE.cream,
        fontFamily: FONT_BODY,
        color: PALETTE.ink,
      }}
    >
      <Header
        view={view}
        onViewChange={setView}
        generatedAt={data.meta?.generated_at}
      />
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="space-y-6">
          <TopStats summary={data.summary} coverage={data.coverage} view={view} />
          <CoverageTable coverage={data.coverage} view={view} />

          <ScienceDirectComparison coverage={data.coverage} view={view} />

          <OverlapHeatmap overlap={data.overlap} view={view} />

          <ByYearPanel byYear={data.by_year} view={view} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ByTypePanel byType={data.by_type} view={view} />
            <InstitutionTypesPanel institutionTypes={data.institution_types} />
          </div>

          <TopPublishersPanel byPublisher={data.by_publisher} view={view} />

          <TopInstitutionsPanel institutions={data.institutions} view={view} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
