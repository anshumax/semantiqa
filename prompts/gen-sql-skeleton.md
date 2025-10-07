# Prompt: Generate SELECT Skeleton (Schema-Constrained)
Given schema JSON and a question, propose a single SELECT.
Rules:
- Only use provided tables/columns.
- No DDL/DML; SELECT only.
- Use qualified names and JOINs with ON clauses.
- Include placeholders for filters (e.g., :start_date).
- Keep under 25 lines.
Return only SQL.
