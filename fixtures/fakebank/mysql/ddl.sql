-- FakeBank (MySQL) DDL
CREATE SCHEMA IF NOT EXISTS core;
USE core;

CREATE TABLE IF NOT EXISTS customers (
  customer_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  kyc_status ENUM('PENDING','VERIFIED','REJECTED') DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
  account_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  account_type ENUM('SAVINGS','CURRENT','CREDIT') NOT NULL,
  opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  credit_limit DECIMAL(12,2),
  status ENUM('ACTIVE','FROZEN','CLOSED') DEFAULT 'ACTIVE',
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  txn_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  txn_ts TIMESTAMP NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  direction ENUM('DEBIT','CREDIT') NOT NULL,
  mcc VARCHAR(10),
  channel ENUM('UPI','CARD','NETBANKING','CASH'),
  counterparty VARCHAR(255),
  FOREIGN KEY (account_id) REFERENCES accounts(account_id),
  INDEX idx_txn_account_ts (account_id, txn_ts)
);
