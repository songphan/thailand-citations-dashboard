import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Database, Play, Loader2, AlertCircle, Download, ArrowLeft,
  BookOpen, ChevronDown, ChevronRight, Sparkles, Zap,
} from 'lucide-react';
import * as duckdb from '@duckdb/duckdb-wasm';

// ============================================================
// DESIGN TOKENS  (mirror Dashboard.jsx)
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
// CONFIGURATION
// ============================================================
// Where to fetch the Parquet bundle from. The default points at a
// Hugging Face dataset; replace with your own dataset path or a
// local URL when self-hosting. The explore page expects one parquet
// file per logical table (matches what export_parquet.py produces).
const PARQUET_BASE = import.meta.env.VITE_PARQUET_BASE
  || 'https://huggingface.co/datasets/Songphan/th-citations-2025/resolve/main';

const PARQUET_TABLES = [
  // Citation graph
  { name: 'seeds',
    desc: 'Thai 2025 publications (citing papers)' },
  { name: 'citation_edges',
    desc: 'One row per citing→cited link. ~1.37M rows.' },
  { name: 'cited_works',
    desc: 'Metadata for each unique cited work (year, type, host journal).' },
  { name: 'cited_issns',
    desc: 'Normalized ISSNs per cited work, for indexing-list joins.' },
  // Institutions
  { name: 'institutions',
    desc: 'Master institution catalog from OpenAlex (id, name, country, type).' },
  { name: 'seed_institutions',
    desc: 'Junction: which Thai 2025 papers are affiliated with which institutions.' },
  // Indexing tables
  { name: 'doaj',                    desc: 'DOAJ open-access journal list.' },
  { name: 'scopus_sources',          desc: 'Scopus source list (March 2026).' },
  { name: 'wos_scie',                desc: 'Web of Science SCIE.' },
  { name: 'wos_ssci',                desc: 'Web of Science SSCI.' },
  { name: 'wos_ahci',                desc: 'Web of Science AHCI.' },
  { name: 'wos_esci',                desc: 'Web of Science ESCI.' },
  { name: 'sciencedirect_standard',  desc: 'Elsevier ScienceDirect Standard product (public list).' },
  { name: 'sciencedirect_cu',        desc: 'CU subscription to ScienceDirect.' },
  { name: 'wiley_journal',           desc: 'Wiley journal title list.' },
  { name: 'ebsco_asc',               desc: 'EBSCO Academic Search Complete (with has_full_text flag).' },
  { name: 'ebsco_asp',               desc: 'EBSCO Academic Search Premier (with has_full_text flag).' },
  { name: 'ebsco_asu',               desc: 'EBSCO Academic Search Ultimate (with has_full_text flag).' },
];

const PRESET_QUERIES = [
  {
    label: 'Top cited journals',
    sql: `-- Top 20 journals receiving the most citations from Thai researchers
SELECT host_source_name AS journal,
       publisher_name AS publisher,
       COUNT(*) AS n_citations
FROM cited_works
JOIN citation_edges ON cited_works.id = citation_edges.cited_id
WHERE host_source_name IS NOT NULL
GROUP BY host_source_name, publisher_name
ORDER BY n_citations DESC
LIMIT 20`,
  },
  {
    label: 'Citations from a specific institution',
    sql: `-- Replace 'Mahidol' with any Thai institution name
SELECT cw.publication_year, COUNT(*) AS n_citations
FROM seed_institutions si
JOIN institutions i ON si.institution_id = i.id
JOIN citation_edges e ON si.seed_id = e.citing_id
JOIN cited_works cw ON e.cited_id = cw.id
WHERE i.name LIKE '%Mahidol%'
  AND cw.publication_year BETWEEN 1990 AND 2025
GROUP BY cw.publication_year
ORDER BY cw.publication_year`,
  },
  {
    label: 'Subscription gap analysis',
    sql: `-- Top journals cited by Thai researchers that are NOT in any
-- of OAR's subscribed databases (as ranked by citation count).
WITH cited_journal_issns AS (
    SELECT cw.host_source_name AS journal,
           cw.publisher_name AS publisher,
           ci.issn,
           regexp_replace(upper(CAST(ci.issn AS VARCHAR)), '[^0-9X]', '', 'g') AS issn_norm
    FROM cited_works cw
    JOIN cited_issns ci ON cw.id = ci.cited_id
),
subscribed_issns AS (
    SELECT regexp_replace(upper(CAST(issn AS VARCHAR)), '[^0-9X]', '', 'g') AS issn_norm
    FROM scopus_sources WHERE issn IS NOT NULL
    UNION
    SELECT regexp_replace(upper(CAST(eissn AS VARCHAR)), '[^0-9X]', '', 'g')
    FROM scopus_sources WHERE eissn IS NOT NULL
    UNION
    SELECT regexp_replace(upper(CAST(ISSN AS VARCHAR)), '[^0-9X]', '', 'g')
    FROM wos_scie WHERE ISSN IS NOT NULL
)
SELECT journal, publisher, COUNT(*) AS n_citations
FROM cited_journal_issns
JOIN citation_edges e ON e.cited_id IN (
    SELECT cited_id FROM cited_issns ci2
    WHERE ci2.issn = cited_journal_issns.issn
)
WHERE issn_norm NOT IN (SELECT issn_norm FROM subscribed_issns)
  AND journal IS NOT NULL
GROUP BY journal, publisher
ORDER BY n_citations DESC
LIMIT 30`,
  },
  {
    label: 'Books and chapters cited',
    sql: `-- Cited books and book-chapters by year
SELECT publication_year, type, COUNT(*) AS n_citations
FROM cited_works cw
JOIN citation_edges e ON cw.id = e.cited_id
WHERE type IN ('book', 'book-chapter')
  AND publication_year BETWEEN 2000 AND 2025
GROUP BY publication_year, type
ORDER BY publication_year DESC, type`,
  },
  {
    label: 'Hospital citation patterns',
    sql: `-- Top journals cited by Thai healthcare-type institutions
SELECT cw.host_source_name AS journal, COUNT(*) AS n_citations
FROM citation_edges e
JOIN seed_institutions si ON e.citing_id = si.seed_id
JOIN institutions i ON si.institution_id = i.id
JOIN cited_works cw ON e.cited_id = cw.id
WHERE i.country = 'TH'
  AND i.type = 'healthcare'
  AND cw.host_source_name IS NOT NULL
GROUP BY cw.host_source_name
ORDER BY n_citations DESC
LIMIT 20`,
  },
];

// ============================================================
// DUCKDB INSTANCE
// ============================================================
async function initDuckDB(onProgress) {
  onProgress?.('Selecting WASM bundle…');
  const JSDELIVR = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR);

  onProgress?.('Spawning worker…');
  // Same pattern as the duckdb-wasm README, with the URL-blob trick
  // so the worker can be cross-origin to the page.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: 'text/javascript',
    }),
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);

  onProgress?.('Instantiating DuckDB…');
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  return db;
}

async function registerParquetViews(db, onProgress, onTable) {
  const conn = await db.connect();
  try {
    for (let i = 0; i < PARQUET_TABLES.length; i++) {
      const t = PARQUET_TABLES[i];
      const url = `${PARQUET_BASE}/${t.name}.parquet`;
      onProgress?.(
        `Registering ${t.name} (${i + 1}/${PARQUET_TABLES.length})…`,
      );
      // Create a view over the remote parquet file. DuckDB-WASM lazy-loads
      // the bytes on first query, so this is fast even for big tables.
      await conn.query(
        `CREATE OR REPLACE VIEW ${t.name} AS
         SELECT * FROM read_parquet('${url}')`,
      );
      onTable?.(t.name);
    }
  } finally {
    await conn.close();
  }
}

async function runQuery(db, sql) {
  const conn = await db.connect();
  try {
    const t0 = performance.now();
    const result = await conn.query(sql);
    const elapsed = performance.now() - t0;

    const cols = result.schema.fields.map((f) => f.name);
    const rows = [];
    for (let i = 0; i < result.numRows; i++) {
      const row = {};
      for (const c of cols) {
        const v = result.getChild(c).get(i);
        // Arrow can return BigInt for INT64; coerce to Number where safe
        row[c] = typeof v === 'bigint' ? Number(v) : v;
      }
      rows.push(row);
    }
    return { cols, rows, elapsed };
  } finally {
    await conn.close();
  }
}

// ============================================================
// COMPONENTS
// ============================================================
const Card = ({ children, className = '', style = {} }) => (
  <section
    className={`border ${className}`}
    style={{ background: PALETTE.paper, borderColor: PALETTE.rule, ...style }}
  >
    {children}
  </section>
);

const KickerLine = ({ children }) => (
  <div
    className="uppercase"
    style={{
      fontFamily: FONT_MONO,
      fontSize: 10,
      letterSpacing: '0.18em',
      color: PALETTE.muted,
    }}
  >
    {children}
  </div>
);

// ----- Schema sidebar -------------------------------------------------------
const SchemaPanel = ({ tablesLoaded, onInsertSnippet }) => {
  const [open, setOpen] = useState(true);
  return (
    <Card className="p-4 h-full overflow-y-auto" style={{ minHeight: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 mb-3"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: '0.18em',
            color: PALETTE.muted,
            textTransform: 'uppercase',
          }}
        >
          Tables · {tablesLoaded.size} / {PARQUET_TABLES.length}
        </span>
      </button>
      {open && (
        <ul className="space-y-1.5">
          {PARQUET_TABLES.map((t) => {
            const ready = tablesLoaded.has(t.name);
            return (
              <li
                key={t.name}
                className="flex flex-col gap-0.5 py-1.5"
                style={{ borderBottom: `1px solid ${PALETTE.rule}` }}
              >
                <button
                  onClick={() => onInsertSnippet(`SELECT * FROM ${t.name} LIMIT 100`)}
                  disabled={!ready}
                  className="flex items-center gap-1.5 text-left"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: ready ? 'pointer' : 'default',
                    fontFamily: FONT_MONO,
                    fontSize: 11.5,
                    color: ready ? PALETTE.ink : PALETTE.muted,
                    fontWeight: 500,
                  }}
                  title={ready ? 'Click to insert SELECT' : 'Not yet loaded'}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: ready ? PALETTE.forest : PALETTE.rule,
                    }}
                  />
                  {t.name}
                </button>
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 11,
                    color: PALETTE.muted,
                    lineHeight: 1.4,
                    paddingLeft: 14,
                  }}
                >
                  {t.desc}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

// ----- Preset query selector ----------------------------------------------
const PresetPicker = ({ onPick }) => (
  <div className="flex flex-wrap gap-2">
    {PRESET_QUERIES.map((p) => (
      <button
        key={p.label}
        onClick={() => onPick(p.sql)}
        className="px-3 py-1.5 transition-colors"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: '0.06em',
          background: 'transparent',
          color: PALETTE.charcoal,
          border: `1px solid ${PALETTE.rule}`,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = PALETTE.cream;
          e.target.style.borderColor = PALETTE.ink;
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'transparent';
          e.target.style.borderColor = PALETTE.rule;
        }}
      >
        {p.label}
      </button>
    ))}
  </div>
);

// ----- SQL editor ---------------------------------------------------------
const SqlEditor = ({ sql, onChange, onRun, busy }) => {
  const ref = useRef(null);
  // Cmd/Ctrl-Enter to run
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onRun();
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [onRun]);

  return (
    <div
      style={{
        border: `1px solid ${PALETTE.ink}`,
        background: PALETTE.paper,
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: `1px solid ${PALETTE.rule}`, background: PALETTE.cream }}
      >
        <KickerLine>SQL Query · Cmd/Ctrl+Enter to run</KickerLine>
        <button
          onClick={onRun}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1 transition-colors"
          style={{
            background: busy ? PALETTE.muted : PALETTE.ink,
            color: PALETTE.paper,
            border: 'none',
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Run
        </button>
      </div>
      <textarea
        ref={ref}
        value={sql}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{
          width: '100%',
          minHeight: 220,
          padding: 12,
          fontFamily: FONT_MONO,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: PALETTE.ink,
          background: PALETTE.paper,
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          tabSize: 2,
        }}
      />
    </div>
  );
};

// ----- Result table -------------------------------------------------------
const ResultTable = ({ result, error, busy, status }) => {
  if (busy) {
    return (
      <Card className="p-6 flex items-center gap-3" style={{ color: PALETTE.muted }}>
        <Loader2 className="animate-spin" size={18} />
        <span>Running query…</span>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="p-5" style={{ borderColor: PALETTE.burgundy }}>
        <div
          className="flex items-center gap-2 mb-2"
          style={{ color: PALETTE.burgundy }}
        >
          <AlertCircle size={16} />
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16 }}>
            Query error
          </span>
        </div>
        <pre
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: PALETTE.charcoal,
            whiteSpace: 'pre-wrap',
            overflowX: 'auto',
          }}
        >
          {error}
        </pre>
      </Card>
    );
  }
  if (!result) {
    return (
      <Card className="p-6" style={{ color: PALETTE.muted, fontSize: 13 }}>
        {status || 'Run a query to see results.'}
      </Card>
    );
  }
  const downloadCsv = () => {
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csv = [result.cols.join(','), ...result.rows.map((r) =>
      result.cols.map((c) => escape(r[c])).join(','),
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_result.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-0">
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: `1px solid ${PALETTE.rule}`, background: PALETTE.cream }}
      >
        <KickerLine>
          {result.rows.length.toLocaleString()} rows · {result.elapsed.toFixed(0)}ms
        </KickerLine>
        <button
          onClick={downloadCsv}
          className="flex items-center gap-1.5 px-2 py-1"
          style={{
            background: 'transparent',
            color: PALETTE.charcoal,
            border: `1px solid ${PALETTE.rule}`,
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          <Download size={11} /> CSV
        </button>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 540 }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: FONT_MONO,
            fontSize: 11.5,
          }}
        >
          <thead>
            <tr
              style={{
                background: PALETTE.paper,
                position: 'sticky',
                top: 0,
                borderBottom: `2px solid ${PALETTE.ink}`,
              }}
            >
              {result.cols.map((c) => (
                <th
                  key={c}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    fontWeight: 600,
                    color: PALETTE.ink,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 1000).map((row, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: `1px solid ${PALETTE.rule}`,
                  background: i % 2 ? PALETTE.cream : PALETTE.paper,
                }}
              >
                {result.cols.map((c) => {
                  const v = row[c];
                  const display =
                    v === null || v === undefined
                      ? ''
                      : typeof v === 'number'
                      ? v.toLocaleString()
                      : String(v);
                  return (
                    <td
                      key={c}
                      style={{
                        padding: '6px 10px',
                        verticalAlign: 'top',
                        color: PALETTE.charcoal,
                        whiteSpace: 'nowrap',
                        maxWidth: 320,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={display}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {result.rows.length > 1000 && (
          <div
            className="px-4 py-2"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              color: PALETTE.muted,
              borderTop: `1px solid ${PALETTE.rule}`,
              background: PALETTE.cream,
            }}
          >
            Showing first 1,000 of {result.rows.length.toLocaleString()} rows.
            Download CSV for the full result.
          </div>
        )}
      </div>
    </Card>
  );
};

// ----- Header -------------------------------------------------------------
const Header = ({ initStatus, parquetBase }) => (
  <header
    className="border-b"
    style={{ borderColor: PALETTE.ink, background: PALETTE.paper }}
  >
    <div className="border-b" style={{ borderColor: PALETTE.rule }}>
      <div className="mx-auto max-w-[1500px] px-6 py-3 flex items-center justify-between">
        <a
          href="https://www.car.chula.ac.th"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-block"
        >
          <img
            src={`${import.meta.env.BASE_URL}oar_logo.png`}
            alt="Office of Academic Resources, Chulalongkorn University"
            style={{ height: 36, width: 'auto', display: 'block' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </a>
        <a
          href="#/"
          className="flex items-center gap-1.5"
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: '0.16em',
            color: PALETTE.charcoal,
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={12} /> Back to Dashboard
        </a>
      </div>
    </div>
    <div className="mx-auto max-w-[1500px] px-6 pt-6 pb-5">
      <div
        className="mb-2 uppercase flex items-center gap-2"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.22em',
          color: PALETTE.muted,
        }}
      >
        <Sparkles size={11} />
        Power-User SQL Console · DuckDB-WASM
      </div>
      <h1
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 38,
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: PALETTE.ink,
        }}
      >
        Explore the citation graph with SQL
      </h1>
      <p
        className="mt-3 max-w-3xl"
        style={{
          fontFamily: FONT_BODY,
          fontSize: 14,
          color: PALETTE.charcoal,
          lineHeight: 1.55,
        }}
      >
        Run arbitrary SQL against the full Thailand 2025 citation dataset,
        directly in your browser. The Parquet files are streamed from
        Hugging Face on demand. Queries execute locally in DuckDB-WASM,
        so the data never leaves your machine. Use this when the curated
        dashboard does not answer your specific question.
      </p>
      <div
        className="mt-3 flex items-center gap-2"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.12em',
          color: PALETTE.muted,
          textTransform: 'uppercase',
        }}
      >
        <Zap size={11} />
        <span>{initStatus}</span>
      </div>
    </div>
  </header>
);

// ============================================================
// MAIN  Explore page
// ============================================================
export default function Explore() {
  useFonts();

  const [db, setDb] = useState(null);
  const [tablesLoaded, setTablesLoaded] = useState(new Set());
  const [initStatus, setInitStatus] = useState('Initializing…');
  const [initError, setInitError] = useState(null);

  const [sql, setSql] = useState(PRESET_QUERIES[0].sql);
  const [result, setResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Boot DuckDB-WASM and register Parquet views
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dbInst = await initDuckDB((s) => !cancelled && setInitStatus(s));
        if (cancelled) return;
        await registerParquetViews(
          dbInst,
          (s) => !cancelled && setInitStatus(s),
          (tname) =>
            !cancelled &&
            setTablesLoaded((prev) => {
              const next = new Set(prev);
              next.add(tname);
              return next;
            }),
        );
        if (cancelled) return;
        setDb(dbInst);
        setInitStatus(
          `Ready · ${PARQUET_TABLES.length} tables registered · Parquet streamed on first query`,
        );
      } catch (err) {
        if (!cancelled) {
          setInitError(err.message);
          setInitStatus('Initialization failed');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onRun = async () => {
    if (!db || busy) return;
    setBusy(true);
    setQueryError(null);
    try {
      const r = await runQuery(db, sql);
      setResult(r);
    } catch (err) {
      setQueryError(String(err?.message || err));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: PALETTE.cream,
        fontFamily: FONT_BODY,
        color: PALETTE.ink,
      }}
    >
      <Header initStatus={initStatus} parquetBase={PARQUET_BASE} />

      <main className="mx-auto max-w-[1500px] px-6 py-6">
        {initError && (
          <Card className="p-5 mb-4" style={{ borderColor: PALETTE.burgundy }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: PALETTE.burgundy }}>
              <AlertCircle size={18} />
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18 }}>Couldn't initialize</span>
            </div>
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: PALETTE.charcoal }}>
              {initError}
            </p>
            <p
              className="mt-2"
              style={{ fontFamily: FONT_BODY, fontSize: 12, color: PALETTE.muted }}
            >
              Common causes: the Parquet base URL is wrong (currently{' '}
              <code>{PARQUET_BASE}</code>), the Hugging Face dataset is private,
              or your browser blocks WebAssembly. Set <code>VITE_PARQUET_BASE</code>{' '}
              in your build environment to point at the right dataset.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Schema sidebar */}
          <div className="lg:col-span-3" style={{ minHeight: 0 }}>
            <SchemaPanel
              tablesLoaded={tablesLoaded}
              onInsertSnippet={(s) => setSql(s)}
            />
          </div>

          {/* Editor + results */}
          <div className="lg:col-span-9 space-y-4">
            <Card className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <KickerLine>Preset queries</KickerLine>
                  <h2
                    className="mt-1"
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontSize: 20,
                      fontWeight: 500,
                      color: PALETTE.ink,
                    }}
                  >
                    Start from an example, or write your own
                  </h2>
                </div>
              </div>
              <PresetPicker onPick={(s) => setSql(s)} />
            </Card>

            <SqlEditor sql={sql} onChange={setSql} onRun={onRun} busy={busy} />

            <ResultTable
              result={result}
              error={queryError}
              busy={busy}
              status={
                db
                  ? 'Press Run (or Cmd/Ctrl+Enter) to execute.'
                  : 'Waiting for DuckDB to initialize…'
              }
            />

            <Card className="p-4">
              <KickerLine>Tips</KickerLine>
              <ul
                className="mt-2 space-y-1.5 list-disc pl-5"
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12.5,
                  color: PALETTE.charcoal,
                  lineHeight: 1.6,
                }}
              >
                <li>
                  Click a table name in the sidebar to insert a{' '}
                  <code>SELECT * FROM …</code> snippet.
                </li>
                <li>
                  Use <code>DESCRIBE table_name</code> to see column names and types.
                </li>
                <li>
                  ISSN matching: use{' '}
                  <code>regexp_replace(upper(CAST(issn AS VARCHAR)), '[^0-9X]', '', 'g')</code>{' '}
                  on both sides of a join. Different databases store ISSNs in
                  different formats.
                </li>
                <li>
                  Heavy joins on <code>citation_edges</code> (1.37M rows) may take
                  several seconds on first run while the Parquet downloads.
                  Subsequent queries hit the local cache.
                </li>
                <li>
                  Results limited to 1,000 rows in the table view. Download CSV
                  for the full result set.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </main>

      <footer
        className="border-t mt-8"
        style={{ borderColor: PALETTE.rule, background: PALETTE.paper }}
      >
        <div className="mx-auto max-w-[1500px] px-6 py-5">
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              color: PALETTE.muted,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Engine · DuckDB-WASM 1.5 · Bundle · Hugging Face Datasets · Privacy
            · Queries run locally, data never leaves your browser
          </div>
        </div>
      </footer>
    </div>
  );
}
