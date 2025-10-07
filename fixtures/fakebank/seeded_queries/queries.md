# FakeBank Seeded Queries (with expected columns)

## Q1: Total debit volume last 30 days by channel (PG)
**SQL (Postgres):**
```sql
SELECT channel, SUM(amount) AS total_debit
FROM core.transactions
WHERE direction='DEBIT' AND txn_ts >= NOW() - INTERVAL '30 days'
GROUP BY channel
ORDER BY total_debit DESC;
```
**Expected columns:** channel, total_debit

## Q2: Credit card utilization by customer (PG)
```sql
SELECT c.customer_id, c.full_name,
       COALESCE(SUM(CASE WHEN a.account_type='CREDIT' AND t.direction='DEBIT' THEN t.amount END),0) / NULLIF(a.credit_limit,0) AS utilization
FROM core.customers c
JOIN core.accounts a ON a.customer_id=c.customer_id AND a.account_type='CREDIT'
LEFT JOIN core.transactions t ON t.account_id=a.account_id
GROUP BY c.customer_id, c.full_name, a.credit_limit;
```
**Expected columns:** customer_id, full_name, utilization

## Q3: Active accounts by type (MySQL)
```sql
SELECT account_type, COUNT(*) AS cnt
FROM core.accounts
WHERE status='ACTIVE'
GROUP BY account_type;
```
**Expected columns:** account_type, cnt

## Q4: Top counterparties by debit amount (MySQL)
```sql
SELECT counterparty, SUM(amount) AS amt
FROM core.transactions
WHERE direction='DEBIT'
GROUP BY counterparty
ORDER BY amt DESC
LIMIT 10;
```
**Expected columns:** counterparty, amt

## Q5: Mongo — transactions per account (pipeline)
```json
[
  {"$match": {"direction": "DEBIT"}},
  {"$group": {"_id": "$account_id", "debit_count": {"$sum": 1}, "debit_amt": {"$sum": "$amount"}}},
  {"$sort": {"debit_amt": -1}},
  {"$limit": 10}
]
```
**Expected fields:** _id (account_id), debit_count, debit_amt

## Q6: DuckDB on CSV — monthly debit volume
```sql
SELECT strftime('%Y-%m-01', txn_ts) AS month, SUM(amount) AS total_debit
FROM read_csv_auto('transactions.csv')
WHERE direction='DEBIT'
GROUP BY 1 ORDER BY 1 DESC;
```
**Expected columns:** month, total_debit

## Q7: Where used: credit_limit
Explain all tables/columns referencing `credit_limit` and their joins (graph-level validation).
