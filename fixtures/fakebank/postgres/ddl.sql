-- FakeBank (Postgres) DDL
CREATE SCHEMA IF NOT EXISTS core;
CREATE TABLE IF NOT EXISTS core.customers (
  customer_id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  kyc_status TEXT CHECK (kyc_status IN ('PENDING','VERIFIED','REJECTED')) DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.accounts (
  account_id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES core.customers(customer_id),
  account_type TEXT CHECK (account_type IN ('SAVINGS','CURRENT','CREDIT')) NOT NULL,
  opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
  credit_limit NUMERIC(12,2),
  status TEXT CHECK (status IN ('ACTIVE','FROZEN','CLOSED')) DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS core.transactions (
  txn_id BIGSERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES core.accounts(account_id),
  txn_ts TIMESTAMP NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  direction TEXT CHECK (direction IN ('DEBIT','CREDIT')) NOT NULL,
  mcc TEXT, -- merchant category code
  channel TEXT CHECK (channel IN ('UPI','CARD','NETBANKING','CASH')),
  counterparty TEXT
);

CREATE INDEX IF NOT EXISTS idx_txn_account_ts ON core.transactions(account_id, txn_ts DESC);
