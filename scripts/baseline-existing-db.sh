#!/usr/bin/env bash
set -euo pipefail

# Ejecutar una sola vez contra una base existente. Verifica primero que la
# estructura de la base corresponda a estas migraciones históricas.

readonly applied_migrations=(
  20260919165434_init
  20260919171916_session_security
  20260919180237_add_contracts_and_receipts
  20260919180325_align_legacy_column_names
  20260919180402_complete_legacy_column_mapping
  20260928154118_normalize_core
  20260930120000_add_enrollment_roles
  20260930130000_add_expedients
  20261001100000_add_site_team_supervision
  20261001110000_add_team_members
  20261002120000_add_notifications
  20261002133000_remove_notification_deliveries
  20261002150000_add_workflow_actions
  20261002160000_add_strategy_catalog
)

for migration in "${applied_migrations[@]}"; do
  pnpm exec prisma migrate resolve --applied "$migration"
done

echo 'Baseline registrado. Ejecuta ahora: pnpm prisma:deploy'
