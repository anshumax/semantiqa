# Error Taxonomy (v1)

| Code                | When it occurs                                       | Fields                         | UI Handling                            |
|--------------------|--------------------------------------------------------|--------------------------------|----------------------------------------|
| VALIDATION_ERROR   | IPC payload/schema invalid                             | details.path, details.reason   | Show field error; suggest valid input. |
| POLICY_VIOLATION   | DDL/DML, blocked joins, PII rule violation             | details.rule, details.example  | Red banner; show policy snippet.       |
| TIMEOUT            | Query/LLM exceeds configured timeout                    | details.timeout_ms             | Suggest filter or smaller scope.       |
| DIALECT_UNSUPPORTED| Feature not supported for source/dialect               | details.dialect, details.feature| Grey banner; link docs.               |
| AUTH_REQUIRED      | Missing/expired credentials                            | —                              | Prompt reconnect; never store in file. |
| NOT_FOUND          | Entity or model id not present                         | details.resource               | Soft toast; offer refresh.             |
