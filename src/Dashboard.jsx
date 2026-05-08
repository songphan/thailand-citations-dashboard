import React, { useEffect, useMemo, useState } from 'react';
import { Database, Layers, Network, AlertCircle, Loader2 } from 'lucide-react';

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
  });

  useEffect(() => {
    const base = `${import.meta.env.BASE_URL}data/`;
    const files = ['meta', 'summary', 'coverage', 'overlap'];
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
          <OverlapHeatmap overlap={data.overlap} view={view} />

          {/* Placeholder section for the remaining panels coming in Turn 2 */}
          <Card className="p-5" style={{ borderStyle: 'dashed' }}>
            <SectionTitle
              icon={Layers}
              kicker="Coming next"
              title="More panels in Turn 2"
              hint="Citations by year · Citations by type · Top publishers · Top citing institutions · Institution types · ScienceDirect CU vs Standard comparison"
            />
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 13,
                color: PALETTE.muted,
                lineHeight: 1.55,
              }}
            >
              The three panels above are the foundation. Once you've reviewed
              the design and approved the direction, the remaining six panels
              will fill the rest of the page.
            </p>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
