import { useState, useCallback } from "react";

// ── Embedded fonts & global overrides ──────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    html,body,#root{height:100%;background:#08080c;font-family:'Plus Jakarta Sans',sans-serif}
    ::-webkit-scrollbar{width:6px;height:6px}
    ::-webkit-scrollbar-track{background:#0f0f14}
    ::-webkit-scrollbar-thumb{background:#2a2a36;border-radius:3px}
    .mono{font-family:'IBM Plex Mono',monospace}
    .animate-in{animation:slideIn 0.18s ease}
    @keyframes slideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    .modal-overlay{animation:fadeIn 0.15s ease}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
    .row-hover:hover{background:rgba(16,185,129,0.04)!important;cursor:pointer}
    .focus-ring:focus{outline:none;box-shadow:0 0 0 2px rgba(16,185,129,0.4)}
  `}</style>
);

// ── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:     "#08080c",
  panel:  "#0f0f15",
  card:   "#141419",
  border: "#1e1e28",
  border2:"#252530",
  t1:     "#f0f0f4",
  t2:     "#9898a8",
  t3:     "#55555f",
  em:     "#10b981",
  emDim:  "#064e3b",
  red:    "#f87171",
  amber:  "#fbbf24",
  blue:   "#60a5fa",
  purple: "#a78bfa",
};

// ── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_ACCOUNTS = [
  { id:1, code:"1000", name:"Cash & Cash Equivalents",     category:"asset",     normal_balance:"debit",  balance:142500 },
  { id:2, code:"1100", name:"Accounts Receivable",         category:"asset",     normal_balance:"debit",  balance:98320  },
  { id:3, code:"1200", name:"Inventory",                   category:"asset",     normal_balance:"debit",  balance:215000 },
  { id:4, code:"1500", name:"Property & Equipment",        category:"asset",     normal_balance:"debit",  balance:380000 },
  { id:5, code:"2000", name:"Accounts Payable",            category:"liability", normal_balance:"credit", balance:67400  },
  { id:6, code:"2100", name:"Accrued Liabilities",         category:"liability", normal_balance:"credit", balance:12800  },
  { id:7, code:"2500", name:"Long-Term Debt",              category:"liability", normal_balance:"credit", balance:250000 },
  { id:8, code:"3000", name:"Common Stock",                category:"equity",    normal_balance:"credit", balance:500000 },
  { id:9, code:"3100", name:"Retained Earnings",           category:"equity",    normal_balance:"credit", balance:5620   },
  { id:10,code:"4000", name:"Sales Revenue",               category:"revenue",   normal_balance:"credit", balance:320000 },
  { id:11,code:"5000", name:"Cost of Goods Sold",          category:"expense",   normal_balance:"debit",  balance:185000 },
  { id:12,code:"5100", name:"Salaries & Wages",            category:"expense",   normal_balance:"debit",  balance:48000  },
  { id:13,code:"5200", name:"Rent Expense",                category:"expense",   normal_balance:"debit",  balance:18000  },
  { id:14,code:"5300", name:"Office Supplies",             category:"expense",   normal_balance:"debit",  balance:2400   },
];

const MOCK_JOURNALS = [
  { id:1, code:"GJ",  name:"General Journal",   type:"general"  },
  { id:2, code:"SJ",  name:"Sales Journal",     type:"sales"    },
  { id:3, code:"PJ",  name:"Purchase Journal",  type:"purchase" },
  { id:4, code:"CJ",  name:"Cash Journal",      type:"cash"     },
  { id:5, code:"BK",  name:"Bank Journal",      type:"bank"     },
];

const MOCK_ENTRIES = [
  { id:1, entry_number:"GJ-2024-0001", entry_date:"2024-02-01", description:"Sold goods to Apex Ltd",          total_debit:15000, status:"posted" },
  { id:2, entry_number:"PJ-2024-0042", entry_date:"2024-02-03", description:"Purchase from TechSupply Co",     total_debit:8400,  status:"posted" },
  { id:3, entry_number:"CJ-2024-0015", entry_date:"2024-02-05", description:"Received payment from client",    total_debit:25000, status:"posted" },
  { id:4, entry_number:"GJ-2024-0002", entry_date:"2024-02-07", description:"Monthly depreciation entry",      total_debit:3200,  status:"posted" },
  { id:5, entry_number:"GJ-2024-0003", entry_date:"2024-02-09", description:"Accrued salary expense",          total_debit:12000, status:"draft"  },
];

const MOCK_CONTACTS = [
  { id:1, name:"Apex Technologies Ltd",  type:"customer", email:"billing@apex.com",    phone:"+1-555-0101", amount_due:24500, currency:"USD" },
  { id:2, name:"TechSupply Co.",         type:"vendor",   email:"orders@techsupply.co",phone:"+1-555-0202", amount_due:8200,  currency:"USD" },
  { id:3, name:"GlobalRetail Inc.",      type:"both",     email:"accounts@global.com", phone:"+1-555-0303", amount_due:0,     currency:"USD" },
  { id:4, name:"Meridian Consulting",    type:"customer", email:"finance@meridian.io", phone:"+1-555-0404", amount_due:9800,  currency:"USD" },
  { id:5, name:"OfficePro Supplies",     type:"vendor",   email:"ap@officepro.net",    phone:"+1-555-0505", amount_due:3200,  currency:"USD" },
];

const MOCK_INVOICES = [
  { id:1, invoice_number:"INV-2024-0088", type:"sale",     contact:"Apex Technologies Ltd",  invoice_date:"2024-02-01", due_date:"2024-03-02", total_amount:24500, amount_due:24500, status:"sent"    },
  { id:2, invoice_number:"INV-2024-0089", type:"sale",     contact:"Meridian Consulting",    invoice_date:"2024-02-04", due_date:"2024-03-05", total_amount:9800,  amount_due:9800,  status:"sent"    },
  { id:3, invoice_number:"BILL-2024-041", type:"purchase", contact:"TechSupply Co.",         invoice_date:"2024-02-03", due_date:"2024-03-03", total_amount:8200,  amount_due:0,     status:"paid"    },
  { id:4, invoice_number:"INV-2024-0087", type:"sale",     contact:"GlobalRetail Inc.",      invoice_date:"2024-01-20", due_date:"2024-02-19", total_amount:31000, amount_due:0,     status:"paid"    },
  { id:5, invoice_number:"BILL-2024-042", type:"purchase", contact:"OfficePro Supplies",     invoice_date:"2024-02-05", due_date:"2024-03-06", total_amount:3200,  amount_due:3200,  status:"draft"   },
];

const MOCK_PRODUCTS = [
  { id:1, sku:"PRD-001", name:"Enterprise Server Node",   category:"Hardware",   qty:42,   avg_cost:1200,  sale_price:1850, value:50400 },
  { id:2, sku:"PRD-002", name:"Network Switch 48-Port",   category:"Hardware",   qty:18,   avg_cost:480,   sale_price:750,  value:8640  },
  { id:3, sku:"PRD-003", name:"SSD 1TB NVMe",             category:"Components", qty:215,  avg_cost:95,    sale_price:149,  value:20425 },
  { id:4, sku:"SVC-001", name:"Cloud Setup Service",      category:"Services",   qty:"—",  avg_cost:0,     sale_price:2500, value:"—"   },
  { id:5, sku:"PRD-004", name:"UPS Battery Backup 1500VA",category:"Hardware",   qty:29,   avg_cost:195,   sale_price:299,  value:5655  },
  { id:6, sku:"PRD-005", name:"Cat6 Cable 100m Roll",     category:"Cabling",    qty:88,   avg_cost:38,    sale_price:65,   value:3344  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => typeof n === "number"
  ? new Intl.NumberFormat("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 }).format(n)
  : n;

const catColor = (c) => ({
  asset:     C.blue,
  liability: C.red,
  equity:    C.purple,
  revenue:   C.em,
  expense:   C.amber,
}[c] || C.t2);

const statusBadge = (s) => {
  const map = {
    posted:    { bg:"rgba(16,185,129,0.12)",  color:C.em,    label:"Posted"   },
    draft:     { bg:"rgba(255,255,255,0.06)", color:C.t2,    label:"Draft"    },
    voided:    { bg:"rgba(248,113,113,0.12)", color:C.red,   label:"Voided"   },
    sent:      { bg:"rgba(96,165,250,0.12)",  color:C.blue,  label:"Sent"     },
    paid:      { bg:"rgba(16,185,129,0.12)",  color:C.em,    label:"Paid"     },
    partial:   { bg:"rgba(251,191,36,0.12)",  color:C.amber, label:"Partial"  },
    overdue:   { bg:"rgba(248,113,113,0.12)", color:C.red,   label:"Overdue"  },
  };
  const d = map[s] || map.draft;
  return (
    <span className="mono" style={{
      background:d.bg, color:d.color,
      borderRadius:4, padding:"2px 8px",
      fontSize:11, fontWeight:600, letterSpacing:"0.05em",
      textTransform:"uppercase"
    }}>{d.label}</span>
  );
};

// ── UI Primitives ─────────────────────────────────────────────────────────────
const Btn = ({ children, variant="primary", onClick, small, style={} }) => {
  const base = {
    border:"none", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif",
    fontWeight:600, borderRadius:6, transition:"all 0.15s", ...style
  };
  const variants = {
    primary:  { background:C.em,       color:"#fff",    padding: small?"5px 12px":"8px 18px", fontSize: small?12:13 },
    ghost:    { background:"transparent",color:C.t2,   padding: small?"5px 12px":"8px 18px", fontSize: small?12:13, border:`1px solid ${C.border2}` },
    danger:   { background:"rgba(248,113,113,0.15)", color:C.red, padding: small?"5px 12px":"8px 18px", fontSize: small?12:13, border:`1px solid rgba(248,113,113,0.3)` },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...variants[variant] }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      {children}
    </button>
  );
};

const Input = ({ label, type="text", value, onChange, placeholder, required, style={}, mono }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
    {label && <label style={{ fontSize:11, fontWeight:600, color:C.t2, letterSpacing:"0.06em", textTransform:"uppercase" }}>{label}{required && <span style={{color:C.em}}> *</span>}</label>}
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
      className="focus-ring"
      style={{
        background:C.card, border:`1px solid ${C.border2}`, borderRadius:6,
        color: mono ? C.em : C.t1, padding:"8px 11px", fontSize:13,
        fontFamily: mono ? "'IBM Plex Mono',monospace" : "'Plus Jakarta Sans',sans-serif",
        outline:"none", width:"100%", ...style
      }}
    />
  </div>
);

const Select = ({ label, value, onChange, options, required }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
    {label && <label style={{ fontSize:11, fontWeight:600, color:C.t2, letterSpacing:"0.06em", textTransform:"uppercase" }}>{label}{required && <span style={{color:C.em}}> *</span>}</label>}
    <select value={value} onChange={onChange} className="focus-ring"
      style={{
        background:C.card, border:`1px solid ${C.border2}`, borderRadius:6,
        color:C.t1, padding:"8px 11px", fontSize:13, outline:"none", width:"100%",
        fontFamily:"'Plus Jakarta Sans',sans-serif", appearance:"none",
        cursor:"pointer"
      }}>
      <option value="">Select…</option>
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  </div>
);

const Panel = ({ children, style={} }) => (
  <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, ...style }}>
    {children}
  </div>
);

const SectionHeader = ({ title, subtitle, action }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
    <div>
      <h2 style={{ color:C.t1, fontSize:20, fontWeight:700, letterSpacing:"-0.02em" }}>{title}</h2>
      {subtitle && <p style={{ color:C.t3, fontSize:13, marginTop:3 }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

const Th = ({ children, align="left", w }) => (
  <th style={{
    color:C.t3, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase",
    padding:"10px 14px", textAlign:align, width:w, whiteSpace:"nowrap",
    borderBottom:`1px solid ${C.border}`
  }}>{children}</th>
);

const Td = ({ children, align="left", mono:m }) => (
  <td style={{
    padding:"11px 14px", textAlign:align,
    color: m ? C.em : C.t1,
    fontFamily: m ? "'IBM Plex Mono',monospace" : "inherit",
    fontSize: m ? 12 : 13,
    borderBottom:`1px solid ${C.border}`,
    whiteSpace:"nowrap"
  }}>{children}</td>
);

// ── Modal ────────────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, wide }) => (
  <div className="modal-overlay" style={{
    position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)",
    display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20
  }}>
    <div className="animate-in" style={{
      background:C.panel, border:`1px solid ${C.border2}`, borderRadius:12,
      width:"100%", maxWidth: wide ? 860 : 540, maxHeight:"90vh",
      overflow:"hidden", display:"flex", flexDirection:"column"
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 22px", borderBottom:`1px solid ${C.border}` }}>
        <h3 style={{ color:C.t1, fontSize:16, fontWeight:700 }}>{title}</h3>
        <button onClick={onClose} style={{ background:"none", border:"none", color:C.t3, cursor:"pointer", fontSize:20, lineHeight:1, padding:4 }}>×</button>
      </div>
      <div style={{ padding:"22px", overflowY:"auto", flex:1 }}>{children}</div>
    </div>
  </div>
);

// ── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color, icon }) => (
  <Panel style={{ padding:"18px 20px", position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", top:14, right:16, fontSize:22, opacity:0.2 }}>{icon}</div>
    <p style={{ color:C.t3, fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>{label}</p>
    <p className="mono" style={{ color: color || C.t1, fontSize:22, fontWeight:600, letterSpacing:"-0.02em" }}>{value}</p>
    {sub && <p style={{ color:C.t3, fontSize:11, marginTop:4 }}>{sub}</p>}
  </Panel>
);

// ═══════════════════════════════════════════════════════════════════════════
//  PAGE: DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
const Dashboard = () => (
  <div className="animate-in">
    <SectionHeader
      title="Financial Overview"
      subtitle="Period: February 2024 · FY2024"
    />
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
      <StatCard label="Total Assets"    value="$835,820" sub="+3.2% vs last month" color={C.blue}   icon="⬡" />
      <StatCard label="Total Revenue"   value="$320,000" sub="YTD gross sales"     color={C.em}     icon="↑" />
      <StatCard label="Total Expenses"  value="$253,400" sub="YTD all categories"  color={C.amber}  icon="↓" />
      <StatCard label="Net Income"      value="$66,600"  sub="Operating profit"    color={C.purple} icon="◈" />
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
      <StatCard label="Accounts Receivable" value="$98,320"  sub="3 open invoices"         color={C.blue}  icon="◷" />
      <StatCard label="Accounts Payable"    value="$67,400"  sub="2 bills outstanding"      color={C.red}   icon="◷" />
    </div>

    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
      {/* Recent Journal Entries */}
      <Panel>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.border}` }}>
          <p style={{ color:C.t1, fontWeight:600, fontSize:14 }}>Recent Journal Entries</p>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            <Th>Reference</Th><Th>Date</Th><Th align="right">Amount</Th><Th>Status</Th>
          </tr></thead>
          <tbody>
            {MOCK_ENTRIES.slice(0,5).map(e => (
              <tr key={e.id} className="row-hover">
                <Td><span className="mono" style={{fontSize:11,color:C.em}}>{e.entry_number}</span></Td>
                <Td><span style={{color:C.t2,fontSize:12}}>{e.entry_date}</span></Td>
                <Td align="right" mono>{fmt(e.total_debit)}</Td>
                <Td>{statusBadge(e.status)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Recent Invoices */}
      <Panel>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.border}` }}>
          <p style={{ color:C.t1, fontWeight:600, fontSize:14 }}>Recent Invoices</p>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            <Th>Invoice</Th><Th>Contact</Th><Th align="right">Due</Th><Th>Status</Th>
          </tr></thead>
          <tbody>
            {MOCK_INVOICES.map(i => (
              <tr key={i.id} className="row-hover">
                <Td><span className="mono" style={{fontSize:11,color:C.em}}>{i.invoice_number}</span></Td>
                <Td><span style={{fontSize:12,color:C.t2}}>{i.contact.split(" ")[0]}</span></Td>
                <Td align="right" mono>{fmt(i.amount_due)}</Td>
                <Td>{statusBadge(i.status)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
//  PAGE: CHART OF ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════
const AccountsPage = () => {
  const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ code:"", name:"", category:"asset", normal_balance:"debit", description:"" });

  const categories = ["all","asset","liability","equity","revenue","expense"];
  const filtered = filter === "all" ? accounts : accounts.filter(a => a.category === filter);

  const handleSubmit = () => {
    if (!form.code || !form.name) return;
    const nb = ["asset","expense"].includes(form.category) ? "debit" : "credit";
    setAccounts(prev => [...prev, { ...form, id: Date.now(), balance:0, normal_balance: nb }]);
    setForm({ code:"", name:"", category:"asset", normal_balance:"debit", description:"" });
    setModal(false);
  };

  const totals = {
    asset:     accounts.filter(a => a.category==="asset").reduce((s,a) => s+a.balance, 0),
    liability: accounts.filter(a => a.category==="liability").reduce((s,a) => s+a.balance, 0),
    equity:    accounts.filter(a => a.category==="equity").reduce((s,a) => s+a.balance, 0),
    revenue:   accounts.filter(a => a.category==="revenue").reduce((s,a) => s+a.balance, 0),
    expense:   accounts.filter(a => a.category==="expense").reduce((s,a) => s+a.balance, 0),
  };

  return (
    <div className="animate-in">
      <SectionHeader
        title="Chart of Accounts"
        subtitle={`${accounts.length} accounts across ${categories.length - 1} categories`}
        action={<Btn onClick={() => setModal(true)}>+ Add Account</Btn>}
      />

      {/* Category totals */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:20 }}>
        {Object.entries(totals).map(([cat, val]) => (
          <div key={cat} onClick={() => setFilter(filter === cat ? "all" : cat)}
            style={{
              background: filter === cat ? `rgba(${cat==="asset"?"96,165,250":cat==="liability"?"248,113,113":cat==="equity"?"167,139,250":cat==="revenue"?"16,185,129":"251,191,36"},0.1)` : C.card,
              border: `1px solid ${filter===cat ? catColor(cat) : C.border}`,
              borderRadius:8, padding:"10px 14px", cursor:"pointer", transition:"all 0.15s"
            }}>
            <p style={{fontSize:10,fontWeight:600,color:catColor(cat),textTransform:"uppercase",letterSpacing:"0.07em"}}>{cat}</p>
            <p className="mono" style={{color:C.t1,fontSize:14,fontWeight:600,marginTop:3}}>${(val/1000).toFixed(0)}K</p>
          </div>
        ))}
      </div>

      <Panel>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            <Th w={90}>Code</Th>
            <Th>Account Name</Th>
            <Th>Category</Th>
            <Th>Normal Balance</Th>
            <Th align="right">Balance</Th>
          </tr></thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="row-hover">
                <Td mono>{a.code}</Td>
                <Td><span style={{fontWeight:500}}>{a.name}</span></Td>
                <Td>
                  <span style={{ color:catColor(a.category), fontSize:12, fontWeight:600,
                    textTransform:"capitalize", background:`${catColor(a.category)}15`,
                    borderRadius:4, padding:"2px 8px" }}>
                    {a.category}
                  </span>
                </Td>
                <Td><span style={{ color:C.t2, fontSize:12, textTransform:"capitalize" }}>{a.normal_balance}</span></Td>
                <Td align="right" mono>{fmt(a.balance)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {modal && (
        <Modal title="New Account" onClose={() => setModal(false)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <Input label="Account Code" value={form.code} onChange={e => setForm({...form,code:e.target.value})} required placeholder="e.g. 1050" mono />
            <Select label="Category" value={form.category}
              onChange={e => setForm({...form,category:e.target.value})}
              options={["asset","liability","equity","revenue","expense"].map(c => ({value:c,label:c.charAt(0).toUpperCase()+c.slice(1)}))} />
          </div>
          <div style={{ marginTop:14 }}>
            <Input label="Account Name" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required placeholder="e.g. Petty Cash" />
          </div>
          <div style={{ marginTop:14 }}>
            <Input label="Description (optional)" value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Brief description" />
          </div>
          <div style={{ marginTop:20, display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={handleSubmit}>Create Account</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  PAGE: JOURNAL ENTRY
// ═══════════════════════════════════════════════════════════════════════════
const JournalEntryPage = () => {
  const [entries, setEntries] = useState(MOCK_ENTRIES);
  const [modal, setModal]   = useState(false);
  const emptyLine = { account_id:"", description:"", debit:"", credit:"" };
  const [form, setForm] = useState({
    journal_id:"1", entry_date: new Date().toISOString().split("T")[0],
    description:"", reference:"", lines:[{...emptyLine},{...emptyLine}]
  });

  const updateLine = (i, field, val) => {
    setForm(prev => {
      const lines = [...prev.lines];
      lines[i] = { ...lines[i], [field]: val };
      return { ...prev, lines };
    });
  };
  const addLine    = () => setForm(prev => ({ ...prev, lines:[...prev.lines, {...emptyLine}] }));
  const removeLine = (i) => setForm(prev => ({ ...prev, lines: prev.lines.filter((_,idx) => idx !== i) }));

  const totalDebit  = form.lines.reduce((s,l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = form.lines.reduce((s,l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced    = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.001;

  const handlePost = (asDraft=false) => {
    if (!asDraft && !balanced) return;
    const newEntry = {
      id: Date.now(), entry_number:`GJ-2024-${String(entries.length+1).padStart(4,"0")}`,
      entry_date: form.entry_date, description: form.description || "(no description)",
      total_debit: totalDebit, status: asDraft ? "draft" : "posted"
    };
    setEntries(prev => [newEntry, ...prev]);
    setModal(false);
    setForm({ journal_id:"1", entry_date: new Date().toISOString().split("T")[0], description:"", reference:"", lines:[{...emptyLine},{...emptyLine}] });
  };

  return (
    <div className="animate-in">
      <SectionHeader
        title="Journal Entries"
        subtitle="Double-entry bookkeeping ledger"
        action={<Btn onClick={() => setModal(true)}>+ New Entry</Btn>}
      />
      <Panel>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            <Th>Entry #</Th>
            <Th>Date</Th>
            <Th>Description</Th>
            <Th align="right">Total Debit</Th>
            <Th>Status</Th>
          </tr></thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="row-hover">
                <Td mono>{e.entry_number}</Td>
                <Td><span style={{color:C.t2,fontSize:12}}>{e.entry_date}</span></Td>
                <Td>{e.description}</Td>
                <Td align="right" mono>{fmt(e.total_debit)}</Td>
                <Td>{statusBadge(e.status)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {modal && (
        <Modal title="New Journal Entry" onClose={() => setModal(false)} wide>
          {/* Header fields */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:20 }}>
            <Select label="Journal" value={form.journal_id}
              onChange={e => setForm({...form,journal_id:e.target.value})}
              options={MOCK_JOURNALS.map(j => ({value:String(j.id), label:`${j.code} — ${j.name}`}))} />
            <Input label="Entry Date" type="date" value={form.entry_date}
              onChange={e => setForm({...form,entry_date:e.target.value})} required />
            <Input label="Reference" value={form.reference}
              onChange={e => setForm({...form,reference:e.target.value})} placeholder="e.g. PO#, Invoice#" />
          </div>
          <div style={{ marginBottom:18 }}>
            <Input label="Description" value={form.description}
              onChange={e => setForm({...form,description:e.target.value})} placeholder="Narration / memo" />
          </div>

          {/* Lines Table */}
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", marginBottom:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"200px 1fr 130px 130px 36px", background:C.bg }}>
              {["Account","Description","Debit","Credit",""].map((h,i) => (
                <div key={i} style={{ padding:"8px 12px", fontSize:11, fontWeight:600, color:C.t3, letterSpacing:"0.06em", textTransform:"uppercase", borderBottom:`1px solid ${C.border}` }}>{h}</div>
              ))}
            </div>
            {form.lines.map((line, idx) => (
              <div key={idx} style={{ display:"grid", gridTemplateColumns:"200px 1fr 130px 130px 36px", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ padding:"6px 8px" }}>
                  <select value={line.account_id} onChange={e => updateLine(idx,"account_id",e.target.value)}
                    style={{ width:"100%", background:C.card, border:"none", color:C.t1, padding:"6px 8px", fontSize:12, fontFamily:"'IBM Plex Mono',monospace", outline:"none", borderRadius:4 }}>
                    <option value="">— Account —</option>
                    {MOCK_ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                  </select>
                </div>
                <div style={{ padding:"6px 8px" }}>
                  <input value={line.description} onChange={e => updateLine(idx,"description",e.target.value)}
                    placeholder="Line description"
                    style={{ width:"100%", background:C.card, border:"none", color:C.t1, padding:"6px 8px", fontSize:12, outline:"none", borderRadius:4, fontFamily:"inherit" }} />
                </div>
                <div style={{ padding:"6px 8px" }}>
                  <input type="number" value={line.debit} onChange={e => updateLine(idx,"debit",e.target.value)}
                    placeholder="0.00"
                    style={{ width:"100%", background:C.card, border:"none", color:C.em, padding:"6px 8px", fontSize:12, fontFamily:"'IBM Plex Mono',monospace", outline:"none", borderRadius:4, textAlign:"right" }} />
                </div>
                <div style={{ padding:"6px 8px" }}>
                  <input type="number" value={line.credit} onChange={e => updateLine(idx,"credit",e.target.value)}
                    placeholder="0.00"
                    style={{ width:"100%", background:C.card, border:"none", color:C.em, padding:"6px 8px", fontSize:12, fontFamily:"'IBM Plex Mono',monospace", outline:"none", borderRadius:4, textAlign:"right" }} />
                </div>
                <div style={{ padding:"6px 4px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {form.lines.length > 2 && (
                    <button onClick={() => removeLine(idx)}
                      style={{ background:"none", border:"none", color:C.t3, cursor:"pointer", fontSize:16, lineHeight:1 }}>×</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <Btn variant="ghost" small onClick={addLine}>+ Add Line</Btn>
            {/* Balance indicator */}
            <div style={{ display:"flex", gap:20, alignItems:"center" }}>
              <div style={{ textAlign:"right" }}>
                <p style={{ fontSize:10, color:C.t3, textTransform:"uppercase", letterSpacing:"0.07em" }}>Total Debit</p>
                <p className="mono" style={{ color:C.em, fontSize:14, fontWeight:600 }}>{fmt(totalDebit)}</p>
              </div>
              <div style={{ width:1, height:30, background:C.border }} />
              <div style={{ textAlign:"right" }}>
                <p style={{ fontSize:10, color:C.t3, textTransform:"uppercase", letterSpacing:"0.07em" }}>Total Credit</p>
                <p className="mono" style={{ color:C.em, fontSize:14, fontWeight:600 }}>{fmt(totalCredit)}</p>
              </div>
              <div style={{ width:1, height:30, background:C.border }} />
              <div style={{ textAlign:"center" }}>
                <p style={{ fontSize:10, color:C.t3, textTransform:"uppercase", letterSpacing:"0.07em" }}>Diff</p>
                <p className="mono" style={{ color: balanced ? C.em : C.red, fontSize:14, fontWeight:700 }}>
                  {balanced ? "✓ 0.00" : fmt(Math.abs(totalDebit - totalCredit))}
                </p>
              </div>
            </div>
          </div>

          {!balanced && totalDebit > 0 && (
            <div style={{ background:"rgba(248,113,113,0.08)", border:`1px solid rgba(248,113,113,0.2)`, borderRadius:6, padding:"8px 12px", marginTop:12 }}>
              <p style={{ color:C.red, fontSize:12 }}>⚠ Entry is unbalanced — debits must equal credits to post.</p>
            </div>
          )}

          <div style={{ marginTop:16, display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn variant="ghost" onClick={() => handlePost(true)}>Save Draft</Btn>
            <Btn onClick={() => handlePost(false)} style={{ opacity: balanced ? 1 : 0.4, cursor: balanced ? "pointer":"not-allowed" }}>Post Entry</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  PAGE: INVOICES
// ═══════════════════════════════════════════════════════════════════════════
const InvoicesPage = () => {
  const [invoices, setInvoices] = useState(MOCK_INVOICES);
  const [tab, setTab] = useState("all");
  const [modal, setModal] = useState(false);
  const emptyLine = { description:"", account_id:"", qty:"1", unit_price:"", tax_code:"" };
  const [form, setForm] = useState({
    type:"sale", contact_id:"", invoice_date: new Date().toISOString().split("T")[0],
    due_date:"", reference:"", currency:"USD", lines:[{...emptyLine}]
  });

  const tabs = ["all","sale","purchase","paid","overdue"];
  const filtered = tab === "all" ? invoices :
    tab === "paid" ? invoices.filter(i => i.status === "paid") :
    tab === "overdue" ? invoices.filter(i => i.status === "overdue") :
    invoices.filter(i => i.type === tab);

  const updateLine = (i, k, v) => {
    setForm(prev => { const lines=[...prev.lines]; lines[i]={...lines[i],[k]:v}; return {...prev,lines}; });
  };
  const addLine = () => setForm(prev => ({...prev, lines:[...prev.lines, {...emptyLine}]}));

  const subtotal = form.lines.reduce((s,l) => s + ((parseFloat(l.qty)||0)*(parseFloat(l.unit_price)||0)), 0);
  const tax      = subtotal * 0.1;
  const total    = subtotal + tax;

  const handleCreate = () => {
    const contact = MOCK_CONTACTS.find(c => String(c.id) === form.contact_id);
    const newInv = {
      id: Date.now(),
      invoice_number: form.type === "sale" ? `INV-2024-${String(invoices.length+1).padStart(4,"0")}` : `BILL-2024-${String(invoices.length+1).padStart(3,"0")}`,
      type: form.type, contact: contact?.name || "Unknown",
      invoice_date: form.invoice_date, due_date: form.due_date || form.invoice_date,
      total_amount: total, amount_due: total, status:"draft"
    };
    setInvoices(prev => [newInv, ...prev]);
    setModal(false);
  };

  return (
    <div className="animate-in">
      <SectionHeader
        title="Invoices & Bills"
        subtitle="Accounts Receivable and Accounts Payable"
        action={<Btn onClick={() => setModal(true)}>+ New Invoice</Btn>}
      />
      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:16 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              background: tab===t ? C.emDim : "transparent",
              border: tab===t ? `1px solid ${C.em}` : `1px solid ${C.border}`,
              color: tab===t ? C.em : C.t2,
              borderRadius:6, padding:"5px 14px", fontSize:12, fontWeight:600,
              cursor:"pointer", textTransform:"capitalize", transition:"all 0.15s"
            }}>
            {t}
          </button>
        ))}
      </div>
      <Panel>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            <Th>Invoice #</Th><Th>Type</Th><Th>Contact</Th><Th>Date</Th><Th>Due</Th><Th align="right">Total</Th><Th align="right">Amount Due</Th><Th>Status</Th>
          </tr></thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id} className="row-hover">
                <Td mono>{i.invoice_number}</Td>
                <Td><span style={{color:i.type==="sale"?C.em:C.amber,fontSize:11,fontWeight:600,textTransform:"uppercase"}}>{i.type}</span></Td>
                <Td>{i.contact}</Td>
                <Td><span style={{color:C.t2,fontSize:12}}>{i.invoice_date}</span></Td>
                <Td><span style={{color:C.t2,fontSize:12}}>{i.due_date}</span></Td>
                <Td align="right" mono>{fmt(i.total_amount)}</Td>
                <Td align="right" mono>{fmt(i.amount_due)}</Td>
                <Td>{statusBadge(i.status)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {modal && (
        <Modal title="New Invoice / Bill" onClose={() => setModal(false)} wide>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:14, marginBottom:16 }}>
            <Select label="Type" value={form.type}
              onChange={e => setForm({...form,type:e.target.value})}
              options={[{value:"sale",label:"Sales Invoice"},{value:"purchase",label:"Purchase Bill"},{value:"credit_note_sale",label:"Credit Note (Sale)"},{value:"credit_note_purchase",label:"Credit Note (Purchase)"}]} />
            <Select label="Contact" value={form.contact_id}
              onChange={e => setForm({...form,contact_id:e.target.value})} required
              options={MOCK_CONTACTS.map(c => ({value:String(c.id),label:c.name}))} />
            <Input label="Invoice Date" type="date" value={form.invoice_date}
              onChange={e => setForm({...form,invoice_date:e.target.value})} required />
            <Input label="Due Date" type="date" value={form.due_date}
              onChange={e => setForm({...form,due_date:e.target.value})} />
          </div>
          <div style={{ marginBottom:16 }}>
            <Input label="Reference" value={form.reference} onChange={e => setForm({...form,reference:e.target.value})} placeholder="PO number, order ref, etc." />
          </div>

          {/* Line items */}
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", marginBottom:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 180px 80px 100px 80px 30px", background:C.bg }}>
              {["Description","Account","Qty","Unit Price","Tax",""].map((h,i) => (
                <div key={i} style={{ padding:"8px 10px", fontSize:10, fontWeight:600, color:C.t3, letterSpacing:"0.06em", textTransform:"uppercase", borderBottom:`1px solid ${C.border}` }}>{h}</div>
              ))}
            </div>
            {form.lines.map((line,idx) => (
              <div key={idx} style={{ display:"grid", gridTemplateColumns:"1fr 180px 80px 100px 80px 30px", borderBottom:`1px solid ${C.border}` }}>
                {[
                  <input value={line.description} onChange={e=>updateLine(idx,"description",e.target.value)} placeholder="Item or service description"
                    style={{ width:"100%", background:"transparent", border:"none", color:C.t1, padding:"7px 10px", fontSize:12, outline:"none", fontFamily:"inherit" }} />,
                  <select value={line.account_id} onChange={e=>updateLine(idx,"account_id",e.target.value)}
                    style={{ width:"100%", background:"transparent", border:"none", color:C.t2, padding:"7px 10px", fontSize:11, outline:"none", fontFamily:"'IBM Plex Mono',monospace" }}>
                    <option value="">Account</option>
                    {MOCK_ACCOUNTS.filter(a => ["revenue","expense","asset"].includes(a.category)).map(a => <option key={a.id} value={a.id}>{a.code}</option>)}
                  </select>,
                  <input type="number" value={line.qty} onChange={e=>updateLine(idx,"qty",e.target.value)}
                    style={{ width:"100%", background:"transparent", border:"none", color:C.t1, padding:"7px 8px", fontSize:12, fontFamily:"'IBM Plex Mono',monospace", outline:"none", textAlign:"right" }} />,
                  <input type="number" value={line.unit_price} onChange={e=>updateLine(idx,"unit_price",e.target.value)} placeholder="0.00"
                    style={{ width:"100%", background:"transparent", border:"none", color:C.em, padding:"7px 8px", fontSize:12, fontFamily:"'IBM Plex Mono',monospace", outline:"none", textAlign:"right" }} />,
                  <select value={line.tax_code} onChange={e=>updateLine(idx,"tax_code",e.target.value)}
                    style={{ width:"100%", background:"transparent", border:"none", color:C.t2, padding:"7px 8px", fontSize:11, outline:"none" }}>
                    <option value="">None</option><option value="GST10">10%</option><option value="GST5">5%</option>
                  </select>,
                  form.lines.length > 1 && <button onClick={()=>setForm(prev=>({...prev,lines:prev.lines.filter((_,i)=>i!==idx)}))}
                    style={{ background:"none", border:"none", color:C.t3, cursor:"pointer", fontSize:16 }}>×</button>
                ].map((el,ci) => <div key={ci} style={{ borderRight:`1px solid ${C.border}` }}>{el}</div>)}
              </div>
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <Btn variant="ghost" small onClick={addLine}>+ Add Line</Btn>
            <div style={{ display:"grid", gap:6, minWidth:200 }}>
              {[["Subtotal", subtotal],["Tax (10%)", tax],["Total", total]].map(([lbl,val]) => (
                <div key={lbl} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:20 }}>
                  <span style={{ fontSize:12, color:C.t2 }}>{lbl}</span>
                  <span className="mono" style={{ fontSize:13, fontWeight:lbl==="Total"?700:500, color:lbl==="Total"?C.t1:C.t2 }}>{fmt(val)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop:18, display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn variant="ghost" onClick={handleCreate}>Save Draft</Btn>
            <Btn onClick={handleCreate}>Create & Send</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  PAGE: CONTACTS
// ═══════════════════════════════════════════════════════════════════════════
const ContactsPage = () => {
  const [contacts, setContacts] = useState(MOCK_CONTACTS);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name:"", type:"customer", email:"", phone:"", country:"US", payment_terms:30 });

  const handleCreate = () => {
    if (!form.name) return;
    setContacts(prev => [...prev, { ...form, id:Date.now(), amount_due:0, currency:"USD" }]);
    setForm({ name:"", type:"customer", email:"", phone:"", country:"US", payment_terms:30 });
    setModal(false);
  };

  const typeColor = (t) => t==="customer" ? C.em : t==="vendor" ? C.amber : C.blue;

  return (
    <div className="animate-in">
      <SectionHeader
        title="Contacts"
        subtitle="Customers, vendors, and business partners"
        action={<Btn onClick={() => setModal(true)}>+ New Contact</Btn>}
      />
      <Panel>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            <Th>Name</Th><Th>Type</Th><Th>Email</Th><Th>Phone</Th><Th align="right">Outstanding</Th>
          </tr></thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id} className="row-hover">
                <Td><span style={{fontWeight:600}}>{c.name}</span></Td>
                <Td><span style={{ color:typeColor(c.type), fontSize:11, fontWeight:700, textTransform:"uppercase", background:`${typeColor(c.type)}15`, borderRadius:4, padding:"2px 8px" }}>{c.type}</span></Td>
                <Td><span style={{color:C.t2,fontSize:12}}>{c.email}</span></Td>
                <Td><span className="mono" style={{color:C.t2,fontSize:11}}>{c.phone}</span></Td>
                <Td align="right" mono>{c.amount_due > 0 ? <span style={{color:C.red}}>{fmt(c.amount_due)}</span> : <span style={{color:C.t3}}>0.00</span>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {modal && (
        <Modal title="New Contact" onClose={() => setModal(false)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <Input label="Full Name / Company" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required placeholder="Acme Corporation" />
            </div>
            <Select label="Type" value={form.type} onChange={e => setForm({...form,type:e.target.value})}
              options={[{value:"customer",label:"Customer"},{value:"vendor",label:"Vendor"},{value:"both",label:"Customer & Vendor"},{value:"employee",label:"Employee"}]} />
            <Input label="Payment Terms (days)" type="number" value={form.payment_terms} onChange={e => setForm({...form,payment_terms:e.target.value})} />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="billing@company.com" />
            <Input label="Phone" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+1-555-0100" />
          </div>
          <div style={{ marginTop:18, display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={handleCreate}>Create Contact</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  PAGE: PRODUCTS / INVENTORY
// ═══════════════════════════════════════════════════════════════════════════
const ProductsPage = () => {
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ sku:"", name:"", category:"Hardware", sale_price:"", avg_cost:"", qty:0, valuation_method:"average_cost" });

  const handleCreate = () => {
    if (!form.sku || !form.name) return;
    setProducts(prev => [...prev, { ...form, id:Date.now(), value: (parseFloat(form.avg_cost)||0)*(parseFloat(form.qty)||0) }]);
    setForm({ sku:"", name:"", category:"Hardware", sale_price:"", avg_cost:"", qty:0, valuation_method:"average_cost" });
    setModal(false);
  };

  const totalValue = products.filter(p => typeof p.value === "number").reduce((s,p) => s + p.value, 0);

  return (
    <div className="animate-in">
      <SectionHeader
        title="Products & Inventory"
        subtitle={`${products.length} products · Total value $${(totalValue/1000).toFixed(0)}K`}
        action={<Btn onClick={() => setModal(true)}>+ New Product</Btn>}
      />
      <Panel>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            <Th w={100}>SKU</Th><Th>Product Name</Th><Th>Category</Th><Th align="right">On Hand</Th><Th align="right">Avg Cost</Th><Th align="right">Sale Price</Th><Th align="right">Value</Th>
          </tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="row-hover">
                <Td mono>{p.sku}</Td>
                <Td><span style={{fontWeight:500}}>{p.name}</span></Td>
                <Td><span style={{ color:C.blue, fontSize:11, fontWeight:600, background:"rgba(96,165,250,0.1)", borderRadius:4, padding:"2px 8px" }}>{p.category}</span></Td>
                <Td align="right" mono>{p.qty}</Td>
                <Td align="right" mono>{typeof p.avg_cost === "number" ? fmt(p.avg_cost) : "—"}</Td>
                <Td align="right" mono>{fmt(p.sale_price)}</Td>
                <Td align="right" mono>{typeof p.value === "number" ? <span style={{color:C.em}}>{fmt(p.value)}</span> : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {modal && (
        <Modal title="New Product" onClose={() => setModal(false)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <Input label="SKU" value={form.sku} onChange={e => setForm({...form,sku:e.target.value})} required placeholder="PRD-007" mono />
            <Select label="Category" value={form.category} onChange={e => setForm({...form,category:e.target.value})}
              options={["Hardware","Components","Services","Cabling","Software","Other"].map(c => ({value:c,label:c}))} />
            <div style={{ gridColumn:"1/-1" }}>
              <Input label="Product Name" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required placeholder="Descriptive product name" />
            </div>
            <Input label="Cost Price" type="number" value={form.avg_cost} onChange={e => setForm({...form,avg_cost:e.target.value})} placeholder="0.00" />
            <Input label="Sale Price" type="number" value={form.sale_price} onChange={e => setForm({...form,sale_price:e.target.value})} placeholder="0.00" />
            <Input label="Opening Qty" type="number" value={form.qty} onChange={e => setForm({...form,qty:e.target.value})} placeholder="0" />
            <Select label="Valuation Method" value={form.valuation_method} onChange={e => setForm({...form,valuation_method:e.target.value})}
              options={[{value:"average_cost",label:"Weighted Average"},{value:"fifo",label:"FIFO"},{value:"standard_cost",label:"Standard Cost"}]} />
          </div>
          <div style={{ marginTop:18, display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={handleCreate}>Create Product</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  PAGE: TRIAL BALANCE
// ═══════════════════════════════════════════════════════════════════════════
const TrialBalancePage = () => {
  const totalDebit  = MOCK_ACCOUNTS.filter(a => a.normal_balance==="debit").reduce((s,a) => s+a.balance, 0);
  const totalCredit = MOCK_ACCOUNTS.filter(a => a.normal_balance==="credit").reduce((s,a) => s+a.balance, 0);
  const diff = totalDebit - totalCredit;

  return (
    <div className="animate-in">
      <SectionHeader
        title="Trial Balance"
        subtitle="As at 29 February 2024 · FY2024"
      />
      <Panel>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            <Th w={90}>Code</Th>
            <Th>Account Name</Th>
            <Th>Category</Th>
            <Th align="right">Debit</Th>
            <Th align="right">Credit</Th>
          </tr></thead>
          <tbody>
            {MOCK_ACCOUNTS.map(a => (
              <tr key={a.id} className="row-hover">
                <Td mono>{a.code}</Td>
                <Td>{a.name}</Td>
                <Td><span style={{ color:catColor(a.category), fontSize:11, fontWeight:600, textTransform:"capitalize" }}>{a.category}</span></Td>
                <Td align="right" mono>{a.normal_balance === "debit"  ? <span style={{color:C.t1}}>{fmt(a.balance)}</span> : <span style={{color:C.t3}}>—</span>}</Td>
                <Td align="right" mono>{a.normal_balance === "credit" ? <span style={{color:C.t1}}>{fmt(a.balance)}</span> : <span style={{color:C.t3}}>—</span>}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ padding:"12px 14px", borderTop:`2px solid ${C.border2}`, fontSize:13, fontWeight:700, color:C.t1 }}>TOTALS</td>
              <td style={{ padding:"12px 14px", textAlign:"right", borderTop:`2px solid ${C.border2}` }}>
                <span className="mono" style={{ color:C.em, fontSize:13, fontWeight:700 }}>{fmt(totalDebit)}</span>
              </td>
              <td style={{ padding:"12px 14px", textAlign:"right", borderTop:`2px solid ${C.border2}` }}>
                <span className="mono" style={{ color:C.em, fontSize:13, fontWeight:700 }}>{fmt(totalCredit)}</span>
              </td>
            </tr>
            <tr>
              <td colSpan={3} style={{ padding:"8px 14px", fontSize:12, color:C.t2 }}>Difference (should be 0)</td>
              <td colSpan={2} style={{ padding:"8px 14px", textAlign:"right" }}>
                <span className="mono" style={{ color: Math.abs(diff) < 0.01 ? C.em : C.red, fontWeight:700, fontSize:13 }}>
                  {Math.abs(diff) < 0.01 ? "✓ Balanced" : fmt(diff)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </Panel>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  SIDEBAR NAV
// ═══════════════════════════════════════════════════════════════════════════
const NAV = [
  { id:"dashboard",    label:"Dashboard",       icon:"⬡" },
  { id:"accounts",     label:"Chart of Accounts",icon:"◈" },
  { id:"journal",      label:"Journal Entries",  icon:"≡" },
  { id:"invoices",     label:"Invoices & Bills",  icon:"▣" },
  { id:"contacts",     label:"Contacts",          icon:"◎" },
  { id:"products",     label:"Products",          icon:"⬤" },
  { id:"trial",        label:"Trial Balance",     icon:"⊞" },
];

const Sidebar = ({ active, setActive }) => (
  <div style={{
    width:220, minHeight:"100vh", background:C.panel,
    borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column",
    position:"fixed", left:0, top:0, bottom:0, zIndex:10
  }}>
    {/* Brand */}
    <div style={{ padding:"22px 20px 18px", borderBottom:`1px solid ${C.border}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:30, height:30, background:`linear-gradient(135deg, ${C.em}, #059669)`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ color:"#fff", fontSize:14, fontWeight:700 }}>⬡</span>
        </div>
        <div>
          <p style={{ color:C.t1, fontSize:13, fontWeight:700, letterSpacing:"-0.02em" }}>LedgerOS</p>
          <p style={{ color:C.t3, fontSize:10 }}>FY2024 · Open</p>
        </div>
      </div>
    </div>

    {/* Nav items */}
    <nav style={{ padding:"10px 8px", flex:1 }}>
      {NAV.map(item => (
        <button key={item.id} onClick={() => setActive(item.id)}
          style={{
            width:"100%", display:"flex", alignItems:"center", gap:10,
            padding:"8px 12px", borderRadius:7, border:"none", cursor:"pointer",
            background: active === item.id ? `rgba(16,185,129,0.12)` : "transparent",
            marginBottom:1, transition:"all 0.12s",
            textAlign:"left"
          }}
          onMouseEnter={e => { if (active !== item.id) e.currentTarget.style.background="rgba(255,255,255,0.04)" }}
          onMouseLeave={e => { if (active !== item.id) e.currentTarget.style.background="transparent" }}>
          <span style={{ fontSize:14, color: active===item.id ? C.em : C.t3 }}>{item.icon}</span>
          <span style={{ fontSize:13, fontWeight: active===item.id ? 600 : 400, color: active===item.id ? C.em : C.t2 }}>
            {item.label}
          </span>
        </button>
      ))}
    </nav>

    {/* Footer */}
    <div style={{ padding:"14px 16px", borderTop:`1px solid ${C.border}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
        <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>AD</span>
        </div>
        <div>
          <p style={{ color:C.t1, fontSize:12, fontWeight:600 }}>Admin User</p>
          <p style={{ color:C.t3, fontSize:10 }}>admin@company.io</p>
        </div>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════════════════════════
const PAGES = {
  dashboard: Dashboard,
  accounts:  AccountsPage,
  journal:   JournalEntryPage,
  invoices:  InvoicesPage,
  contacts:  ContactsPage,
  products:  ProductsPage,
  trial:     TrialBalancePage,
};

export default function App() {
  const [active, setActive] = useState("dashboard");
  const Page = PAGES[active] || Dashboard;

  return (
    <>
      <GlobalStyles />
      <div style={{ display:"flex", minHeight:"100vh", background:C.bg }}>
        <Sidebar active={active} setActive={setActive} />
        <main style={{ marginLeft:220, flex:1, padding:"32px 36px", minHeight:"100vh", maxWidth:"calc(100vw - 220px)" }}>
          <Page />
        </main>
      </div>
    </>
  );
}
