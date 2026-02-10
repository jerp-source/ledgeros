-- ============================================================
--  DOUBLE-ENTRY ACCOUNTING + INVENTORY SCHEMA
--  PostgreSQL 14+
--
--  Sections:
--    1.  Foundation       (currencies, exchange rates, companies, fiscal periods)
--    2.  Chart of Accounts
--    3.  Journals & Journal Entries  ← core of double-entry
--    4.  Analytical Dimensions       (cost centres, projects)
--    5.  Contacts                    (customers & vendors)
--    6.  Invoices & Payments         (AR / AP)
--    7.  Banking                     (bank accounts, transactions, reconciliation)
--    8.  Inventory                   (products, warehouses, stock moves, cost layers)
--    9.  Purchasing                  (purchase orders)
--   10.  Sales                       (sales orders)
--   11.  Reporting Views
--   12.  Triggers & Functions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE account_category   AS ENUM ('asset','liability','equity','revenue','expense');
CREATE TYPE normal_balance      AS ENUM ('debit','credit');
CREATE TYPE entry_status        AS ENUM ('draft','posted','voided');
CREATE TYPE contact_type        AS ENUM ('customer','vendor','both','employee','other');
CREATE TYPE invoice_type        AS ENUM ('sale','purchase','credit_note_sale','credit_note_purchase');
CREATE TYPE invoice_status      AS ENUM ('draft','sent','partial','paid','voided','overdue');
CREATE TYPE payment_method      AS ENUM ('cash','bank_transfer','check','credit_card','other');
CREATE TYPE payment_direction   AS ENUM ('inbound','outbound');
CREATE TYPE stock_move_type     AS ENUM (
    'purchase_receipt','sale_delivery','transfer',
    'adjustment','return','opening','scrap',
    'production_in','production_out'
);
CREATE TYPE valuation_method    AS ENUM ('fifo','average_cost','standard_cost');
CREATE TYPE po_status           AS ENUM ('draft','confirmed','received','invoiced','cancelled');
CREATE TYPE so_status           AS ENUM ('draft','confirmed','shipped','invoiced','cancelled');
CREATE TYPE period_status       AS ENUM ('open','closed','locked');
CREATE TYPE tax_type            AS ENUM ('sales','purchase','both');

-- ============================================================
-- 1. FOUNDATION
-- ============================================================

CREATE TABLE currencies (
    id              SERIAL          PRIMARY KEY,
    code            CHAR(3)         NOT NULL UNIQUE,     -- ISO 4217
    name            VARCHAR(100)    NOT NULL,
    symbol          VARCHAR(10),
    decimal_places  SMALLINT        NOT NULL DEFAULT 2,
    is_base         BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Enforce exactly one base currency
CREATE UNIQUE INDEX currencies_one_base_idx
    ON currencies (is_base) WHERE is_base = TRUE;

COMMENT ON TABLE  currencies IS 'ISO 4217 currency definitions';
COMMENT ON COLUMN currencies.is_base IS 'Exactly one row must have is_base = TRUE';


CREATE TABLE exchange_rates (
    id              SERIAL          PRIMARY KEY,
    from_currency   CHAR(3)         NOT NULL REFERENCES currencies(code),
    to_currency     CHAR(3)         NOT NULL REFERENCES currencies(code),
    rate            NUMERIC(20,8)   NOT NULL CHECK (rate > 0),
    effective_date  DATE            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (from_currency, to_currency, effective_date)
);


CREATE TABLE companies (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(200)    NOT NULL,
    tax_id          VARCHAR(50),
    base_currency   CHAR(3)         NOT NULL REFERENCES currencies(code),
    address_line1   VARCHAR(200),
    address_line2   VARCHAR(200),
    city            VARCHAR(100),
    state           VARCHAR(100),
    postal_code     VARCHAR(20),
    country         CHAR(2),
    phone           VARCHAR(50),
    email           VARCHAR(200),
    website         VARCHAR(200),
    logo_url        VARCHAR(500),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


CREATE TABLE fiscal_years (
    id              SERIAL          PRIMARY KEY,
    company_id      INT             NOT NULL REFERENCES companies(id),
    name            VARCHAR(100)    NOT NULL,
    start_date      DATE            NOT NULL,
    end_date        DATE            NOT NULL,
    is_current      BOOLEAN         NOT NULL DEFAULT FALSE,
    is_closed       BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT fy_date_order CHECK (end_date > start_date),
    UNIQUE (company_id, name)
);

CREATE UNIQUE INDEX fiscal_years_one_current_idx
    ON fiscal_years (company_id, is_current) WHERE is_current = TRUE;


CREATE TABLE accounting_periods (
    id              SERIAL          PRIMARY KEY,
    fiscal_year_id  INT             NOT NULL REFERENCES fiscal_years(id),
    name            VARCHAR(100)    NOT NULL,
    start_date      DATE            NOT NULL,
    end_date        DATE            NOT NULL,
    period_number   SMALLINT        NOT NULL,
    status          period_status   NOT NULL DEFAULT 'open',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT period_date_order CHECK (end_date > start_date),
    UNIQUE (fiscal_year_id, period_number)
);

COMMENT ON COLUMN accounting_periods.status IS
    'open → can post | closed → no new posts | locked → immutable';

-- ============================================================
-- 2. CHART OF ACCOUNTS
-- ============================================================

CREATE TABLE account_groups (
    id              SERIAL          PRIMARY KEY,
    company_id      INT             NOT NULL REFERENCES companies(id),
    code            VARCHAR(20)     NOT NULL,
    name            VARCHAR(200)    NOT NULL,
    category        account_category NOT NULL,
    parent_id       INT             REFERENCES account_groups(id),
    level           SMALLINT        NOT NULL DEFAULT 1,
    sort_order      INT             NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code)
);

COMMENT ON TABLE account_groups IS
    'Optional hierarchical grouping above accounts (e.g. Current Assets → Cash)';


CREATE TABLE accounts (
    id                  SERIAL          PRIMARY KEY,
    company_id          INT             NOT NULL REFERENCES companies(id),
    code                VARCHAR(20)     NOT NULL,
    name                VARCHAR(200)    NOT NULL,
    description         TEXT,
    category            account_category NOT NULL,
    normal_balance      normal_balance  NOT NULL,
    -- normal_balance rule: asset/expense → debit | liability/equity/revenue → credit
    group_id            INT             REFERENCES account_groups(id),
    currency            CHAR(3)         REFERENCES currencies(code),  -- NULL = base currency
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    is_reconcilable     BOOLEAN         NOT NULL DEFAULT FALSE,  -- bank / AR / AP
    is_control          BOOLEAN         NOT NULL DEFAULT FALSE,  -- AR / AP control
    opening_balance     NUMERIC(20,4)   NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code)
);

CREATE INDEX accounts_company_category_idx ON accounts (company_id, category);
CREATE INDEX accounts_group_idx            ON accounts (group_id);

COMMENT ON COLUMN accounts.is_control IS
    'TRUE = AR/AP control account; direct manual posting is blocked at app level';


CREATE TABLE tax_codes (
    id              SERIAL          PRIMARY KEY,
    company_id      INT             NOT NULL REFERENCES companies(id),
    code            VARCHAR(20)     NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    rate            NUMERIC(8,4)    NOT NULL CHECK (rate >= 0),
    tax_type        tax_type        NOT NULL,
    account_id      INT             NOT NULL REFERENCES accounts(id),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    UNIQUE (company_id, code)
);

COMMENT ON COLUMN tax_codes.account_id IS
    'GL account where the tax amount is credited/debited when posting';

-- ============================================================
-- 3. JOURNALS & JOURNAL ENTRIES  (Core of Double-Entry)
-- ============================================================

CREATE TABLE journals (
    id              SERIAL          PRIMARY KEY,
    company_id      INT             NOT NULL REFERENCES companies(id),
    code            VARCHAR(20)     NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    type            VARCHAR(20)     NOT NULL, -- 'general','sales','purchase','cash','bank'
    default_account INT             REFERENCES accounts(id),
    sequence_prefix VARCHAR(10),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    UNIQUE (company_id, code)
);


CREATE TABLE journal_entries (
    id                  BIGSERIAL       PRIMARY KEY,
    company_id          INT             NOT NULL REFERENCES companies(id),
    journal_id          INT             NOT NULL REFERENCES journals(id),
    period_id           INT             NOT NULL REFERENCES accounting_periods(id),
    entry_number        VARCHAR(50)     NOT NULL,
    entry_date          DATE            NOT NULL,
    reference           VARCHAR(200),
    description         TEXT,
    currency            CHAR(3)         NOT NULL REFERENCES currencies(code),
    exchange_rate       NUMERIC(20,8)   NOT NULL DEFAULT 1,
    status              entry_status    NOT NULL DEFAULT 'draft',
    is_reversal         BOOLEAN         NOT NULL DEFAULT FALSE,
    reversed_by         BIGINT          REFERENCES journal_entries(id),
    -- Polymorphic link to source document
    source_type         VARCHAR(50),   -- 'invoice','payment','stock_move','manual', …
    source_id           BIGINT,
    posted_at           TIMESTAMPTZ,
    posted_by           INT,
    created_by          INT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, entry_number)
);

CREATE INDEX je_company_date_idx   ON journal_entries (company_id, entry_date);
CREATE INDEX je_period_idx         ON journal_entries (period_id);
CREATE INDEX je_source_idx         ON journal_entries (source_type, source_id);
CREATE INDEX je_status_idx         ON journal_entries (status);

COMMENT ON TABLE  journal_entries  IS 'Transaction header; every financial event has exactly one row here';
COMMENT ON COLUMN journal_entries.exchange_rate IS
    'Rate to convert transaction currency → company base currency';


CREATE TABLE journal_entry_lines (
    id                  BIGSERIAL       PRIMARY KEY,
    journal_entry_id    BIGINT          NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number         SMALLINT        NOT NULL,
    account_id          INT             NOT NULL REFERENCES accounts(id),
    description         TEXT,
    -- Transaction-currency amounts
    debit_amount        NUMERIC(20,4)   NOT NULL DEFAULT 0 CHECK (debit_amount  >= 0),
    credit_amount       NUMERIC(20,4)   NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
    -- Base-currency amounts (derived at post time)
    debit_base          NUMERIC(20,4)   NOT NULL DEFAULT 0,
    credit_base         NUMERIC(20,4)   NOT NULL DEFAULT 0,
    tax_code_id         INT             REFERENCES tax_codes(id),
    tax_amount          NUMERIC(20,4)   DEFAULT 0,
    -- Reconciliation
    is_reconciled       BOOLEAN         NOT NULL DEFAULT FALSE,
    reconciled_at       TIMESTAMPTZ,
    reconciliation_id   INT,
    -- Tracking dimensions (FKs added after those tables)
    contact_id          INT,
    cost_center_id      INT,
    project_id          INT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT jel_one_side_only CHECK (NOT (debit_amount > 0 AND credit_amount > 0)),
    UNIQUE (journal_entry_id, line_number)
);

CREATE INDEX jel_account_idx        ON journal_entry_lines (account_id);
CREATE INDEX jel_journal_entry_idx  ON journal_entry_lines (journal_entry_id);
CREATE INDEX jel_contact_idx        ON journal_entry_lines (contact_id);

COMMENT ON CONSTRAINT jel_one_side_only ON journal_entry_lines IS
    'A line is either a debit OR a credit, never both';
COMMENT ON TABLE journal_entry_lines IS
    'THE ledger: SUM(debit_amount) = SUM(credit_amount) per journal_entry enforced by trigger';

-- ============================================================
-- 4. ANALYTICAL DIMENSIONS
-- ============================================================

CREATE TABLE cost_centers (
    id              SERIAL          PRIMARY KEY,
    company_id      INT             NOT NULL REFERENCES companies(id),
    code            VARCHAR(20)     NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    parent_id       INT             REFERENCES cost_centers(id),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    UNIQUE (company_id, code)
);

CREATE TABLE projects (
    id              SERIAL          PRIMARY KEY,
    company_id      INT             NOT NULL REFERENCES companies(id),
    code            VARCHAR(20)     NOT NULL,
    name            VARCHAR(200)    NOT NULL,
    start_date      DATE,
    end_date        DATE,
    budget          NUMERIC(20,4),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    UNIQUE (company_id, code)
);

ALTER TABLE journal_entry_lines
    ADD CONSTRAINT jel_cost_center_fk FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
    ADD CONSTRAINT jel_project_fk     FOREIGN KEY (project_id)      REFERENCES projects(id);

-- ============================================================
-- 5. CONTACTS  (Customers & Vendors)
-- ============================================================

CREATE TABLE contacts (
    id              SERIAL          PRIMARY KEY,
    company_id      INT             NOT NULL REFERENCES companies(id),
    reference       VARCHAR(50),
    name            VARCHAR(200)    NOT NULL,
    type            contact_type    NOT NULL,
    tax_id          VARCHAR(50),
    email           VARCHAR(200),
    phone           VARCHAR(50),
    website         VARCHAR(200),
    address_line1   VARCHAR(200),
    address_line2   VARCHAR(200),
    city            VARCHAR(100),
    state           VARCHAR(100),
    postal_code     VARCHAR(20),
    country         CHAR(2),
    currency        CHAR(3)         REFERENCES currencies(code),
    payment_terms   SMALLINT        DEFAULT 30,       -- net days
    credit_limit    NUMERIC(20,4),
    ar_account_id   INT             REFERENCES accounts(id),
    ap_account_id   INT             REFERENCES accounts(id),
    tax_code_id     INT             REFERENCES tax_codes(id),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX contacts_company_type_idx ON contacts (company_id, type);
CREATE INDEX contacts_name_idx         ON contacts USING gin (to_tsvector('english', name));

ALTER TABLE journal_entry_lines
    ADD CONSTRAINT jel_contact_fk FOREIGN KEY (contact_id) REFERENCES contacts(id);

COMMENT ON COLUMN contacts.ar_account_id IS 'Override default AR account for this customer';
COMMENT ON COLUMN contacts.ap_account_id IS 'Override default AP account for this vendor';

-- ============================================================
-- 6. INVOICES & PAYMENTS  (AR / AP)
-- ============================================================

CREATE TABLE invoices (
    id                  BIGSERIAL       PRIMARY KEY,
    company_id          INT             NOT NULL REFERENCES companies(id),
    invoice_number      VARCHAR(50)     NOT NULL,
    type                invoice_type    NOT NULL,
    status              invoice_status  NOT NULL DEFAULT 'draft',
    contact_id          INT             NOT NULL REFERENCES contacts(id),
    invoice_date        DATE            NOT NULL,
    due_date            DATE,
    reference           VARCHAR(200),
    currency            CHAR(3)         NOT NULL REFERENCES currencies(code),
    exchange_rate       NUMERIC(20,8)   NOT NULL DEFAULT 1,
    subtotal            NUMERIC(20,4)   NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(20,4)   NOT NULL DEFAULT 0,
    total_amount        NUMERIC(20,4)   NOT NULL DEFAULT 0,
    amount_paid         NUMERIC(20,4)   NOT NULL DEFAULT 0,
    amount_due          NUMERIC(20,4)   GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    notes               TEXT,
    journal_entry_id    BIGINT          REFERENCES journal_entries(id),
    created_by          INT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, invoice_number)
);

CREATE INDEX invoices_company_type_idx ON invoices (company_id, type);
CREATE INDEX invoices_contact_idx      ON invoices (contact_id);
CREATE INDEX invoices_status_idx       ON invoices (status);
CREATE INDEX invoices_due_date_idx     ON invoices (due_date)
    WHERE status NOT IN ('paid','voided');


CREATE TABLE invoice_lines (
    id              BIGSERIAL       PRIMARY KEY,
    invoice_id      BIGINT          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_number     SMALLINT        NOT NULL,
    description     TEXT            NOT NULL,
    account_id      INT             NOT NULL REFERENCES accounts(id),
    quantity        NUMERIC(20,6)   NOT NULL DEFAULT 1,
    unit_price      NUMERIC(20,4)   NOT NULL,
    discount_pct    NUMERIC(6,4)    NOT NULL DEFAULT 0,
    line_amount     NUMERIC(20,4)   NOT NULL,   -- qty × price × (1 − discount_pct/100)
    tax_code_id     INT             REFERENCES tax_codes(id),
    tax_amount      NUMERIC(20,4)   NOT NULL DEFAULT 0,
    product_id      INT,                         -- FK added after products table
    cost_center_id  INT             REFERENCES cost_centers(id),
    project_id      INT             REFERENCES projects(id),
    UNIQUE (invoice_id, line_number)
);


CREATE TABLE payments (
    id                  BIGSERIAL       PRIMARY KEY,
    company_id          INT             NOT NULL REFERENCES companies(id),
    payment_number      VARCHAR(50)     NOT NULL,
    direction           payment_direction NOT NULL,
    contact_id          INT             REFERENCES contacts(id),
    payment_date        DATE            NOT NULL,
    method              payment_method  NOT NULL DEFAULT 'bank_transfer',
    currency            CHAR(3)         NOT NULL REFERENCES currencies(code),
    exchange_rate       NUMERIC(20,8)   NOT NULL DEFAULT 1,
    amount              NUMERIC(20,4)   NOT NULL CHECK (amount > 0),
    bank_account_id     INT,                     -- FK added after bank_accounts
    reference           VARCHAR(200),
    notes               TEXT,
    journal_entry_id    BIGINT          REFERENCES journal_entries(id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, payment_number)
);


CREATE TABLE payment_allocations (
    id                  BIGSERIAL       PRIMARY KEY,
    payment_id          BIGINT          NOT NULL REFERENCES payments(id),
    invoice_id          BIGINT          NOT NULL REFERENCES invoices(id),
    allocated_amount    NUMERIC(20,4)   NOT NULL CHECK (allocated_amount > 0),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (payment_id, invoice_id)
);

COMMENT ON TABLE payment_allocations IS
    'Maps each payment to one or more invoices; sum must not exceed payment.amount';

-- ============================================================
-- 7. BANKING
-- ============================================================

CREATE TABLE bank_accounts (
    id                  SERIAL          PRIMARY KEY,
    company_id          INT             NOT NULL REFERENCES companies(id),
    gl_account_id       INT             NOT NULL REFERENCES accounts(id),
    name                VARCHAR(200)    NOT NULL,
    bank_name           VARCHAR(200),
    account_number      VARCHAR(100),
    routing_number      VARCHAR(50),
    swift_code          VARCHAR(20),
    iban                VARCHAR(50),
    currency            CHAR(3)         NOT NULL REFERENCES currencies(code),
    opening_balance     NUMERIC(20,4)   NOT NULL DEFAULT 0,
    current_balance     NUMERIC(20,4)   NOT NULL DEFAULT 0,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN bank_accounts.gl_account_id IS
    'The General Ledger account this bank account maps to';

ALTER TABLE payments
    ADD CONSTRAINT payments_bank_account_fk
        FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);


CREATE TABLE bank_transactions (
    id                  BIGSERIAL       PRIMARY KEY,
    bank_account_id     INT             NOT NULL REFERENCES bank_accounts(id),
    transaction_date    DATE            NOT NULL,
    description         TEXT,
    reference           VARCHAR(200),
    amount              NUMERIC(20,4)   NOT NULL,   -- positive = deposit, negative = withdrawal
    running_balance     NUMERIC(20,4),
    is_reconciled       BOOLEAN         NOT NULL DEFAULT FALSE,
    reconciliation_id   INT,
    payment_id          BIGINT          REFERENCES payments(id),
    journal_entry_id    BIGINT          REFERENCES journal_entries(id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX bank_txn_account_date_idx ON bank_transactions (bank_account_id, transaction_date);


CREATE TABLE bank_reconciliations (
    id                  SERIAL          PRIMARY KEY,
    bank_account_id     INT             NOT NULL REFERENCES bank_accounts(id),
    period_end_date     DATE            NOT NULL,
    statement_balance   NUMERIC(20,4)   NOT NULL,
    book_balance        NUMERIC(20,4)   NOT NULL,
    difference          NUMERIC(20,4)   GENERATED ALWAYS AS (statement_balance - book_balance) STORED,
    is_completed        BOOLEAN         NOT NULL DEFAULT FALSE,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE bank_transactions
    ADD CONSTRAINT bank_txn_reconciliation_fk
        FOREIGN KEY (reconciliation_id) REFERENCES bank_reconciliations(id);

-- ============================================================
-- 8. INVENTORY
-- ============================================================

CREATE TABLE units_of_measure (
    id              SERIAL          PRIMARY KEY,
    company_id      INT             NOT NULL REFERENCES companies(id),
    code            VARCHAR(20)     NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    category        VARCHAR(50),    -- 'weight','volume','length','quantity'
    UNIQUE (company_id, code)
);


CREATE TABLE product_categories (
    id                          SERIAL          PRIMARY KEY,
    company_id                  INT             NOT NULL REFERENCES companies(id),
    code                        VARCHAR(20)     NOT NULL,
    name                        VARCHAR(200)    NOT NULL,
    parent_id                   INT             REFERENCES product_categories(id),
    -- Default GL accounts for products in this category
    inventory_account_id        INT             REFERENCES accounts(id),
    cogs_account_id             INT             REFERENCES accounts(id),
    revenue_account_id          INT             REFERENCES accounts(id),
    purchase_price_variance_id  INT             REFERENCES accounts(id),
    UNIQUE (company_id, code)
);


CREATE TABLE products (
    id                      SERIAL          PRIMARY KEY,
    company_id              INT             NOT NULL REFERENCES companies(id),
    sku                     VARCHAR(100)    NOT NULL,
    name                    VARCHAR(200)    NOT NULL,
    description             TEXT,
    category_id             INT             REFERENCES product_categories(id),
    uom_id                  INT             NOT NULL REFERENCES units_of_measure(id),
    purchase_uom_id         INT             REFERENCES units_of_measure(id),
    uom_conversion          NUMERIC(20,6)   NOT NULL DEFAULT 1,
    -- purchase_qty × uom_conversion = stock qty
    valuation_method        valuation_method NOT NULL DEFAULT 'average_cost',
    standard_cost           NUMERIC(20,4)   NOT NULL DEFAULT 0,
    last_purchase_price     NUMERIC(20,4)   NOT NULL DEFAULT 0,
    average_cost            NUMERIC(20,4)   NOT NULL DEFAULT 0,
    sale_price              NUMERIC(20,4)   NOT NULL DEFAULT 0,
    reorder_point           NUMERIC(20,4)   NOT NULL DEFAULT 0,
    reorder_qty             NUMERIC(20,4)   NOT NULL DEFAULT 0,
    min_stock               NUMERIC(20,4)   NOT NULL DEFAULT 0,
    max_stock               NUMERIC(20,4),
    is_tracked              BOOLEAN         NOT NULL DEFAULT TRUE,   -- FALSE = service item
    is_purchasable          BOOLEAN         NOT NULL DEFAULT TRUE,
    is_sellable             BOOLEAN         NOT NULL DEFAULT TRUE,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Account overrides (fall back to category → system defaults)
    inventory_account_id    INT             REFERENCES accounts(id),
    cogs_account_id         INT             REFERENCES accounts(id),
    revenue_account_id      INT             REFERENCES accounts(id),
    tax_code_purchase_id    INT             REFERENCES tax_codes(id),
    tax_code_sale_id        INT             REFERENCES tax_codes(id),
    weight                  NUMERIC(10,4),
    weight_uom              VARCHAR(10),
    barcode                 VARCHAR(100),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, sku)
);

CREATE INDEX products_category_idx ON products (category_id);

ALTER TABLE invoice_lines
    ADD CONSTRAINT invoice_lines_product_fk FOREIGN KEY (product_id) REFERENCES products(id);


CREATE TABLE warehouses (
    id              SERIAL          PRIMARY KEY,
    company_id      INT             NOT NULL REFERENCES companies(id),
    code            VARCHAR(20)     NOT NULL,
    name            VARCHAR(200)    NOT NULL,
    address_line1   VARCHAR(200),
    city            VARCHAR(100),
    country         CHAR(2),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    UNIQUE (company_id, code)
);


CREATE TABLE warehouse_locations (
    id              SERIAL          PRIMARY KEY,
    warehouse_id    INT             NOT NULL REFERENCES warehouses(id),
    code            VARCHAR(50)     NOT NULL,
    name            VARCHAR(200)    NOT NULL,
    parent_id       INT             REFERENCES warehouse_locations(id),
    location_type   VARCHAR(20)     NOT NULL DEFAULT 'storage',
    -- 'storage','input','output','quality','virtual'
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    UNIQUE (warehouse_id, code)
);

COMMENT ON COLUMN warehouse_locations.location_type IS
    'storage=bin/shelf | input=receiving | output=dispatch | quality=QC | virtual=non-physical';


-- Current on-hand quantities (denormalised for fast reads)
CREATE TABLE stock_quantities (
    id              BIGSERIAL       PRIMARY KEY,
    product_id      INT             NOT NULL REFERENCES products(id),
    location_id     INT             NOT NULL REFERENCES warehouse_locations(id),
    quantity        NUMERIC(20,6)   NOT NULL DEFAULT 0,
    reserved_qty    NUMERIC(20,6)   NOT NULL DEFAULT 0,
    available_qty   NUMERIC(20,6)   GENERATED ALWAYS AS (quantity - reserved_qty) STORED,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, location_id)
);

CREATE INDEX stock_qty_product_idx ON stock_quantities (product_id);

COMMENT ON TABLE stock_quantities IS
    'Denormalised summary; always updated by triggers on stock_moves';


-- Every physical inventory movement
CREATE TABLE stock_moves (
    id                      BIGSERIAL       PRIMARY KEY,
    company_id              INT             NOT NULL REFERENCES companies(id),
    move_number             VARCHAR(50)     NOT NULL,
    move_type               stock_move_type NOT NULL,
    move_date               DATE            NOT NULL,
    product_id              INT             NOT NULL REFERENCES products(id),
    uom_id                  INT             NOT NULL REFERENCES units_of_measure(id),
    from_location_id        INT             REFERENCES warehouse_locations(id),
    to_location_id          INT             REFERENCES warehouse_locations(id),
    quantity                NUMERIC(20,6)   NOT NULL CHECK (quantity > 0),
    unit_cost               NUMERIC(20,4)   NOT NULL DEFAULT 0,
    total_cost              NUMERIC(20,4)   GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    reference               VARCHAR(200),
    description             TEXT,
    -- Links to source documents (FKs added below)
    purchase_order_id       BIGINT,
    purchase_order_line_id  BIGINT,
    sales_order_id          BIGINT,
    sales_order_line_id     BIGINT,
    invoice_id              BIGINT          REFERENCES invoices(id),
    journal_entry_id        BIGINT          REFERENCES journal_entries(id),
    is_posted               BOOLEAN         NOT NULL DEFAULT FALSE,
    posted_at               TIMESTAMPTZ,
    created_by              INT,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, move_number),
    CONSTRAINT sm_must_have_location CHECK (
        from_location_id IS NOT NULL OR to_location_id IS NOT NULL
    )
);

CREATE INDEX stock_moves_product_idx ON stock_moves (product_id);
CREATE INDEX stock_moves_date_idx    ON stock_moves (move_date);
CREATE INDEX stock_moves_type_idx    ON stock_moves (move_type);


-- FIFO/Layered cost tracking (used for FIFO and average-cost computations)
CREATE TABLE inventory_cost_layers (
    id              BIGSERIAL       PRIMARY KEY,
    product_id      INT             NOT NULL REFERENCES products(id),
    location_id     INT             NOT NULL REFERENCES warehouse_locations(id),
    stock_move_id   BIGINT          NOT NULL REFERENCES stock_moves(id),
    received_date   DATE            NOT NULL,
    original_qty    NUMERIC(20,6)   NOT NULL CHECK (original_qty  > 0),
    remaining_qty   NUMERIC(20,6)   NOT NULL CHECK (remaining_qty >= 0),
    unit_cost       NUMERIC(20,4)   NOT NULL CHECK (unit_cost     >= 0),
    total_cost      NUMERIC(20,4)   GENERATED ALWAYS AS (remaining_qty * unit_cost) STORED,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX cost_layers_product_loc_idx ON inventory_cost_layers (product_id, location_id, remaining_qty)
    WHERE remaining_qty > 0;

COMMENT ON TABLE inventory_cost_layers IS
    'One row per receipt batch; consumed FIFO when goods are shipped out';

-- ============================================================
-- 9. PURCHASE ORDERS
-- ============================================================

CREATE TABLE purchase_orders (
    id                  BIGSERIAL       PRIMARY KEY,
    company_id          INT             NOT NULL REFERENCES companies(id),
    po_number           VARCHAR(50)     NOT NULL,
    status              po_status       NOT NULL DEFAULT 'draft',
    vendor_id           INT             NOT NULL REFERENCES contacts(id),
    order_date          DATE            NOT NULL,
    expected_date       DATE,
    currency            CHAR(3)         NOT NULL REFERENCES currencies(code),
    exchange_rate       NUMERIC(20,8)   NOT NULL DEFAULT 1,
    warehouse_id        INT             REFERENCES warehouses(id),
    subtotal            NUMERIC(20,4)   NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(20,4)   NOT NULL DEFAULT 0,
    total_amount        NUMERIC(20,4)   NOT NULL DEFAULT 0,
    amount_billed       NUMERIC(20,4)   NOT NULL DEFAULT 0,
    amount_received_pct NUMERIC(6,2)    GENERATED ALWAYS AS (
                            CASE WHEN total_amount = 0 THEN 0
                            ELSE ROUND((amount_billed / total_amount) * 100, 2) END
                        ) STORED,
    notes               TEXT,
    reference           VARCHAR(200),
    created_by          INT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, po_number)
);

CREATE INDEX po_vendor_idx  ON purchase_orders (vendor_id);
CREATE INDEX po_status_idx  ON purchase_orders (status);


CREATE TABLE purchase_order_lines (
    id              BIGSERIAL       PRIMARY KEY,
    po_id           BIGINT          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    line_number     SMALLINT        NOT NULL,
    product_id      INT             REFERENCES products(id),
    description     TEXT            NOT NULL,
    quantity        NUMERIC(20,6)   NOT NULL CHECK (quantity > 0),
    qty_received    NUMERIC(20,6)   NOT NULL DEFAULT 0,
    qty_billed      NUMERIC(20,6)   NOT NULL DEFAULT 0,
    uom_id          INT             REFERENCES units_of_measure(id),
    unit_price      NUMERIC(20,4)   NOT NULL,
    discount_pct    NUMERIC(6,4)    NOT NULL DEFAULT 0,
    line_amount     NUMERIC(20,4)   NOT NULL,
    tax_code_id     INT             REFERENCES tax_codes(id),
    tax_amount      NUMERIC(20,4)   NOT NULL DEFAULT 0,
    account_id      INT             REFERENCES accounts(id),
    UNIQUE (po_id, line_number)
);

ALTER TABLE stock_moves
    ADD CONSTRAINT sm_po_fk  FOREIGN KEY (purchase_order_id)      REFERENCES purchase_orders(id),
    ADD CONSTRAINT sm_pol_fk FOREIGN KEY (purchase_order_line_id) REFERENCES purchase_order_lines(id);

-- ============================================================
-- 10. SALES ORDERS
-- ============================================================

CREATE TABLE sales_orders (
    id                  BIGSERIAL       PRIMARY KEY,
    company_id          INT             NOT NULL REFERENCES companies(id),
    so_number           VARCHAR(50)     NOT NULL,
    status              so_status       NOT NULL DEFAULT 'draft',
    customer_id         INT             NOT NULL REFERENCES contacts(id),
    order_date          DATE            NOT NULL,
    expected_date       DATE,
    currency            CHAR(3)         NOT NULL REFERENCES currencies(code),
    exchange_rate       NUMERIC(20,8)   NOT NULL DEFAULT 1,
    warehouse_id        INT             REFERENCES warehouses(id),
    subtotal            NUMERIC(20,4)   NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(20,4)   NOT NULL DEFAULT 0,
    total_amount        NUMERIC(20,4)   NOT NULL DEFAULT 0,
    amount_invoiced     NUMERIC(20,4)   NOT NULL DEFAULT 0,
    notes               TEXT,
    reference           VARCHAR(200),
    created_by          INT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, so_number)
);

CREATE INDEX so_customer_idx ON sales_orders (customer_id);
CREATE INDEX so_status_idx   ON sales_orders (status);


CREATE TABLE sales_order_lines (
    id              BIGSERIAL       PRIMARY KEY,
    so_id           BIGINT          NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    line_number     SMALLINT        NOT NULL,
    product_id      INT             REFERENCES products(id),
    description     TEXT            NOT NULL,
    quantity        NUMERIC(20,6)   NOT NULL CHECK (quantity > 0),
    qty_delivered   NUMERIC(20,6)   NOT NULL DEFAULT 0,
    qty_invoiced    NUMERIC(20,6)   NOT NULL DEFAULT 0,
    uom_id          INT             REFERENCES units_of_measure(id),
    unit_price      NUMERIC(20,4)   NOT NULL,
    discount_pct    NUMERIC(6,4)    NOT NULL DEFAULT 0,
    line_amount     NUMERIC(20,4)   NOT NULL,
    tax_code_id     INT             REFERENCES tax_codes(id),
    tax_amount      NUMERIC(20,4)   NOT NULL DEFAULT 0,
    account_id      INT             REFERENCES accounts(id),
    UNIQUE (so_id, line_number)
);

ALTER TABLE stock_moves
    ADD CONSTRAINT sm_so_fk  FOREIGN KEY (sales_order_id)      REFERENCES sales_orders(id),
    ADD CONSTRAINT sm_sol_fk FOREIGN KEY (sales_order_line_id) REFERENCES sales_order_lines(id);

-- ============================================================
-- 11. REPORTING VIEWS
-- ============================================================

-- General Ledger
CREATE VIEW v_general_ledger AS
SELECT
    je.company_id,
    ap.name                             AS period_name,
    je.entry_date,
    je.entry_number,
    j.name                              AS journal_name,
    a.code                              AS account_code,
    a.name                              AS account_name,
    a.category                          AS account_category,
    jel.description                     AS line_description,
    jel.debit_amount,
    jel.credit_amount,
    jel.debit_base,
    jel.credit_base,
    c.name                              AS contact_name,
    cc.name                             AS cost_center,
    p.name                              AS project,
    je.status
FROM journal_entries je
JOIN journals j                     ON j.id  = je.journal_id
JOIN accounting_periods ap          ON ap.id = je.period_id
JOIN journal_entry_lines jel        ON jel.journal_entry_id = je.id
JOIN accounts a                     ON a.id  = jel.account_id
LEFT JOIN contacts c                ON c.id  = jel.contact_id
LEFT JOIN cost_centers cc           ON cc.id = jel.cost_center_id
LEFT JOIN projects p                ON p.id  = jel.project_id
WHERE je.status = 'posted';


-- Trial Balance
CREATE VIEW v_trial_balance AS
SELECT
    a.company_id,
    a.code                              AS account_code,
    a.name                              AS account_name,
    a.category,
    a.normal_balance,
    COALESCE(SUM(jel.debit_base),  0)   AS total_debit,
    COALESCE(SUM(jel.credit_base), 0)   AS total_credit,
    CASE a.normal_balance
        WHEN 'debit'  THEN COALESCE(SUM(jel.debit_base), 0)  - COALESCE(SUM(jel.credit_base), 0)
        WHEN 'credit' THEN COALESCE(SUM(jel.credit_base), 0) - COALESCE(SUM(jel.debit_base),  0)
    END                                 AS balance
FROM accounts a
LEFT JOIN journal_entry_lines jel   ON jel.account_id = a.id
LEFT JOIN journal_entries je        ON je.id = jel.journal_entry_id AND je.status = 'posted'
GROUP BY a.id, a.company_id, a.code, a.name, a.category, a.normal_balance;


-- Accounts Receivable Aging
CREATE VIEW v_ar_aging AS
SELECT
    i.company_id,
    c.id                                AS customer_id,
    c.name                              AS customer_name,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.total_amount,
    i.amount_paid,
    i.amount_due,
    CURRENT_DATE - i.due_date           AS days_overdue,
    CASE
        WHEN CURRENT_DATE <= i.due_date                         THEN 'current'
        WHEN CURRENT_DATE - i.due_date BETWEEN  1 AND  30      THEN '1–30 days'
        WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND  60      THEN '31–60 days'
        WHEN CURRENT_DATE - i.due_date BETWEEN 61 AND  90      THEN '61–90 days'
        ELSE 'over 90 days'
    END                                 AS aging_bucket
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.type = 'sale'
  AND i.status NOT IN ('paid','voided','draft');


-- Accounts Payable Aging
CREATE VIEW v_ap_aging AS
SELECT
    i.company_id,
    c.id                                AS vendor_id,
    c.name                              AS vendor_name,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.total_amount,
    i.amount_paid,
    i.amount_due,
    CURRENT_DATE - i.due_date           AS days_overdue,
    CASE
        WHEN CURRENT_DATE <= i.due_date                         THEN 'current'
        WHEN CURRENT_DATE - i.due_date BETWEEN  1 AND  30      THEN '1–30 days'
        WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND  60      THEN '31–60 days'
        WHEN CURRENT_DATE - i.due_date BETWEEN 61 AND  90      THEN '61–90 days'
        ELSE 'over 90 days'
    END                                 AS aging_bucket
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.type = 'purchase'
  AND i.status NOT IN ('paid','voided','draft');


-- Inventory Valuation
CREATE VIEW v_inventory_valuation AS
SELECT
    sq.product_id,
    p.sku,
    p.name                              AS product_name,
    pc.name                             AS category_name,
    w.name                              AS warehouse_name,
    wl.name                             AS location_name,
    sq.quantity                         AS qty_on_hand,
    sq.reserved_qty,
    sq.available_qty,
    p.average_cost,
    sq.quantity * p.average_cost        AS inventory_value
FROM stock_quantities sq
JOIN products p                         ON p.id  = sq.product_id
JOIN warehouse_locations wl             ON wl.id = sq.location_id
JOIN warehouses w                       ON w.id  = wl.warehouse_id
LEFT JOIN product_categories pc         ON pc.id = p.category_id
WHERE sq.quantity != 0;


-- Unbalanced entries (data-quality check)
CREATE VIEW v_unbalanced_entries AS
SELECT
    je.id,
    je.company_id,
    je.entry_number,
    je.entry_date,
    SUM(jel.debit_amount)                               AS total_debit,
    SUM(jel.credit_amount)                              AS total_credit,
    SUM(jel.debit_amount) - SUM(jel.credit_amount)      AS difference
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
GROUP BY je.id, je.company_id, je.entry_number, je.entry_date
HAVING SUM(jel.debit_amount) <> SUM(jel.credit_amount);

-- ============================================================
-- 12. TRIGGERS & FUNCTIONS
-- ============================================================

-- ── 12a. Generic updated_at maintenance ─────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_je_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_po_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_so_updated_at
    BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ── 12b. Prevent posting to closed / locked periods ─────────
CREATE OR REPLACE FUNCTION fn_check_period_open()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_status period_status;
BEGIN
    SELECT status INTO v_status
    FROM accounting_periods WHERE id = NEW.period_id;

    IF v_status IN ('closed','locked') THEN
        RAISE EXCEPTION
            'Cannot post to accounting period % (status: %)',
            NEW.period_id, v_status;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_je_check_period
    BEFORE INSERT OR UPDATE ON journal_entries
    FOR EACH ROW
    WHEN (NEW.status = 'posted')
    EXECUTE FUNCTION fn_check_period_open();


-- ── 12c. Validate debit = credit before posting ─────────────
CREATE OR REPLACE FUNCTION fn_validate_je_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_debit  NUMERIC;
    v_credit NUMERIC;
BEGIN
    IF NEW.status = 'posted' AND (OLD IS NULL OR OLD.status <> 'posted') THEN
        SELECT
            COALESCE(SUM(debit_amount),  0),
            COALESCE(SUM(credit_amount), 0)
        INTO v_debit, v_credit
        FROM journal_entry_lines
        WHERE journal_entry_id = NEW.id;

        IF v_debit = 0 THEN
            RAISE EXCEPTION 'Journal entry % has no lines', NEW.entry_number;
        END IF;

        IF v_debit <> v_credit THEN
            RAISE EXCEPTION
                'Journal entry % is unbalanced: debits=% credits=%',
                NEW.entry_number, v_debit, v_credit;
        END IF;

        NEW.posted_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_je_validate_balance
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION fn_validate_je_balance();


-- ── 12d. Update stock_quantities on stock_move post ─────────
CREATE OR REPLACE FUNCTION fn_update_stock_quantities()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Decrement source location
    IF NEW.from_location_id IS NOT NULL THEN
        INSERT INTO stock_quantities (product_id, location_id, quantity, updated_at)
        VALUES (NEW.product_id, NEW.from_location_id, -NEW.quantity, NOW())
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
            quantity   = stock_quantities.quantity - NEW.quantity,
            updated_at = NOW();
    END IF;

    -- Increment destination location
    IF NEW.to_location_id IS NOT NULL THEN
        INSERT INTO stock_quantities (product_id, location_id, quantity, updated_at)
        VALUES (NEW.product_id, NEW.to_location_id, NEW.quantity, NOW())
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
            quantity   = stock_quantities.quantity + NEW.quantity,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_move_update_qty
    AFTER INSERT ON stock_moves
    FOR EACH ROW
    WHEN (NEW.is_posted = TRUE)
    EXECUTE FUNCTION fn_update_stock_quantities();


-- ── 12e. Update product average cost on purchase receipt ────
CREATE OR REPLACE FUNCTION fn_update_average_cost()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_current_qty  NUMERIC;
    v_current_cost NUMERIC;
    v_new_avg      NUMERIC;
BEGIN
    IF NEW.move_type = 'purchase_receipt' AND NEW.is_posted = TRUE AND NEW.unit_cost > 0 THEN
        SELECT COALESCE(SUM(quantity), 0)
        INTO v_current_qty
        FROM stock_quantities
        WHERE product_id = NEW.product_id;

        SELECT average_cost
        INTO v_current_cost
        FROM products WHERE id = NEW.product_id;

        -- Weighted average formula
        IF (v_current_qty + NEW.quantity) > 0 THEN
            v_new_avg := (v_current_qty * v_current_cost + NEW.quantity * NEW.unit_cost)
                         / (v_current_qty + NEW.quantity);
        ELSE
            v_new_avg := NEW.unit_cost;
        END IF;

        UPDATE products
        SET average_cost        = ROUND(v_new_avg, 4),
            last_purchase_price = NEW.unit_cost,
            updated_at          = NOW()
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_move_avg_cost
    AFTER INSERT ON stock_moves
    FOR EACH ROW EXECUTE FUNCTION fn_update_average_cost();

-- ============================================================
-- END OF SCHEMA
-- ============================================================
