-- Mark ToolExecution.template and AuditLog.user as optional at the Prisma
-- client level. The underlying columns are still NOT NULL because the
-- application must always provide them; this change only affects how the
-- generated Prisma client treats the relation when the referenced row has
-- been deleted (SetNull at the application level, since no DB-level FK
-- exists for tool_executions.template_id).
--
-- No DDL change is required for this migration.
SELECT 1;
