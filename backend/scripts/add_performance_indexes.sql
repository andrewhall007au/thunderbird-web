-- Performance Indexes for Production Database
-- Addresses slow query issues identified by monitoring
-- Run with: sqlite3 production.db < scripts/add_performance_indexes.sql

-- Index for orders by created_at (used in 7-day queries)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Index for orders by account_id (used in joins)
CREATE INDEX IF NOT EXISTS idx_orders_account_id ON orders(account_id);

-- Index for routes by account_id (user's routes)
CREATE INDEX IF NOT EXISTS idx_routes_account_id ON routes(account_id);

-- Index for routes by status (active routes)
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);

-- Index for waypoints by route_id (fetch waypoints for route)
CREATE INDEX IF NOT EXISTS idx_waypoints_route_id ON waypoints(route_id);

-- Index for transactions by account_id and created_at
CREATE INDEX IF NOT EXISTS idx_transactions_account_created ON transactions(account_id, created_at);

-- Index for beta_applications by status
CREATE INDEX IF NOT EXISTS idx_beta_applications_status ON beta_applications(status);

-- Index for affiliate_clicks by affiliate_code and created_at
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_code_created ON affiliate_clicks(affiliate_code, created_at);

-- Index for affiliate_conversions by affiliate_code
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_code ON affiliate_conversions(affiliate_code);

-- Composite index for common query pattern: active user routes
CREATE INDEX IF NOT EXISTS idx_routes_account_status ON routes(account_id, status);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(event_type, created_at);

-- Verify indexes were created
SELECT
    name as index_name,
    tbl_name as table_name
FROM sqlite_master
WHERE type = 'index'
  AND name LIKE 'idx_%'
ORDER BY tbl_name, name;
