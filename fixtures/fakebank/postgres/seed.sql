-- FakeBank (Postgres) seed
INSERT INTO core.customers (full_name, email, phone, kyc_status, created_at) VALUES
('Aditi Rao','aditi@example.com','9990012345','VERIFIED', NOW()-INTERVAL '100 days'),
('Rahul Mehta','rahul@example.com','9990012346','VERIFIED', NOW()-INTERVAL '60 days'),
('Neha Singh','neha@example.com','9990012347','PENDING', NOW()-INTERVAL '10 days');

INSERT INTO core.accounts (customer_id, account_type, opened_at, credit_limit, status) VALUES
(1,'SAVINGS', NOW()-INTERVAL '95 days', NULL,'ACTIVE'),
(1,'CREDIT', NOW()-INTERVAL '90 days', 200000,'ACTIVE'),
(2,'CURRENT', NOW()-INTERVAL '58 days', NULL,'ACTIVE');

INSERT INTO core.transactions (account_id, txn_ts, amount, currency, direction, mcc, channel, counterparty) VALUES
(1, NOW()-INTERVAL '30 days', 5000,'INR','DEBIT','5411','UPI','BigBazaar'),
(1, NOW()-INTERVAL '29 days', 15000,'INR','CREDIT',NULL,'NETBANKING','Salary'),
(2, NOW()-INTERVAL '15 days', 12000,'INR','DEBIT','5812','CARD','Cafe Coffee'),
(2, NOW()-INTERVAL '5 days', 8000,'INR','DEBIT','5814','CARD','Restaurant'),
(3, NOW()-INTERVAL '2 days', 25000,'INR','DEBIT','7399','NETBANKING','VendorX');
