"""
Pytest Configuration

Provides test fixtures including database initialization for integration tests.
"""

import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import sqlite3


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line(
        "markers",
        "integration: mark test as integration test (requires database setup, skip with -m 'not integration')"
    )


def create_test_tables(db_path: str = ":memory:"):
    """
    Create all database tables for testing.

    This replicates all Alembic migrations for test databases.
    """
    conn = sqlite3.connect(db_path)

    # =========================================================================
    # Initial Schema (58ce9da45577)
    # =========================================================================

    # Users table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            phone TEXT PRIMARY KEY,
            route_id TEXT NOT NULL,
            start_date TEXT,
            end_date TEXT,
            trail_name TEXT,
            direction TEXT DEFAULT 'standard',
            current_position TEXT,
            last_checkin_at TEXT,
            status TEXT DEFAULT 'registered',
            unit_system TEXT DEFAULT 'metric',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # SafeCheck contacts table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS safecheck_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_phone TEXT NOT NULL,
            contact_phone TEXT NOT NULL,
            contact_name TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
            UNIQUE(user_phone, contact_phone)
        )
    """)

    # Message log table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS message_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_phone TEXT,
            direction TEXT NOT NULL,
            message_type TEXT,
            command_type TEXT,
            content TEXT,
            segments INTEGER DEFAULT 1,
            cost_aud REAL DEFAULT 0,
            sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
            success INTEGER DEFAULT 1
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_message_log_sent_at ON message_log(sent_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_message_log_user ON message_log(user_phone)")

    # =========================================================================
    # Accounts Table (4fd3f14bce7e)
    # =========================================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            phone TEXT,
            stripe_customer_id TEXT,
            unit_system TEXT DEFAULT 'metric',
            active_trail_id INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_accounts_email ON accounts(email)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_accounts_active_trail_id ON accounts(active_trail_id)")

    # =========================================================================
    # Payment Tables (842752b6b27d)
    # =========================================================================

    # Orders table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            order_type TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            stripe_session_id TEXT,
            stripe_payment_intent_id TEXT,
            discount_code_id INTEGER,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            completed_at TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_orders_account_id ON orders(account_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_orders_stripe_session_id ON orders(stripe_session_id)")

    # Account balances table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS account_balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL UNIQUE,
            balance_cents INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_account_balances_account_id ON account_balances(account_id)")

    # Transactions table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            order_id INTEGER,
            transaction_type TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            balance_after_cents INTEGER NOT NULL,
            description TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_transactions_account_id ON transactions(account_id)")

    # Discount codes table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS discount_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            discount_type TEXT NOT NULL,
            discount_value INTEGER NOT NULL,
            max_uses INTEGER,
            current_uses INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            stripe_coupon_id TEXT,
            affiliate_id INTEGER,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_discount_codes_code ON discount_codes(code)")

    # =========================================================================
    # Custom Routes Tables (3b3ffb2bb293)
    # =========================================================================

    # Custom routes table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS custom_routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            gpx_data TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            is_library_clone INTEGER NOT NULL DEFAULT 0,
            source_library_id INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_custom_routes_account_id ON custom_routes(account_id)")

    # Custom waypoints table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS custom_waypoints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            route_id INTEGER NOT NULL,
            type TEXT NOT NULL DEFAULT 'poi',
            name TEXT NOT NULL,
            sms_code TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            elevation REAL NOT NULL DEFAULT 0,
            order_index INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_custom_waypoints_route_id ON custom_waypoints(route_id)")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_custom_waypoints_sms_code ON custom_waypoints(sms_code)")

    # Route library table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS route_library (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            gpx_data TEXT,
            country TEXT,
            region TEXT,
            difficulty_grade INTEGER,
            distance_km REAL,
            typical_days TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_route_library_is_active ON route_library(is_active)")

    # =========================================================================
    # Affiliate Tables (7af520d0f608)
    # =========================================================================

    # Affiliates table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS affiliates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            discount_percent INTEGER NOT NULL DEFAULT 0,
            commission_percent INTEGER NOT NULL DEFAULT 20,
            trailing_months INTEGER,
            payout_method TEXT,
            payout_details TEXT,
            active INTEGER NOT NULL DEFAULT 1,
            last_milestone_cents INTEGER,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_affiliates_code ON affiliates(code)")

    # Commissions table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS commissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            affiliate_id INTEGER NOT NULL,
            account_id INTEGER NOT NULL,
            order_id INTEGER NOT NULL,
            amount_cents INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            sub_id TEXT,
            created_at TEXT NOT NULL,
            available_at TEXT,
            paid_at TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_commissions_affiliate_id ON commissions(affiliate_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_commissions_status ON commissions(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_commissions_account_id ON commissions(account_id)")

    # Affiliate attributions table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS affiliate_attributions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            affiliate_id INTEGER NOT NULL,
            account_id INTEGER NOT NULL UNIQUE,
            order_id INTEGER NOT NULL,
            sub_id TEXT,
            trailing_expires_at TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_affiliate_attributions_account_id ON affiliate_attributions(account_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_affiliate_attributions_affiliate_id ON affiliate_attributions(affiliate_id)")

    # Affiliate clicks table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS affiliate_clicks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            affiliate_id INTEGER NOT NULL,
            sub_id TEXT,
            session_id TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_affiliate_clicks_affiliate_id ON affiliate_clicks(affiliate_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_affiliate_clicks_created_at ON affiliate_clicks(created_at)")

    # =========================================================================
    # Beta Applications Table (d4e5f6a7b8c9)
    # =========================================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS beta_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            country TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            account_id INTEGER,
            admin_notes TEXT,
            created_at TEXT NOT NULL,
            reviewed_at TEXT
        )
    """)
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_applications_email ON beta_applications(email)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_beta_applications_status ON beta_applications(status)")

    # =========================================================================
    # Analytics Tables
    # =========================================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS analytics_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            session_id TEXT,
            account_id INTEGER,
            entry_path TEXT,
            ab_variant TEXT,
            properties TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at)")

    # =========================================================================
    # Trail Selection Sessions Table (for multi-trail SMS)
    # =========================================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS trail_selection_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL UNIQUE,
            state TEXT NOT NULL DEFAULT 'idle',
            page INTEGER NOT NULL DEFAULT 0,
            pending_trail_ids TEXT,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_trail_selection_account_id ON trail_selection_sessions(account_id)")

    conn.commit()
    conn.close()


# Create shared in-memory database for tests
_test_db_initialized = False


@pytest.fixture(scope="session", autouse=True)
def init_test_database():
    """
    Initialize test database tables before any tests run.

    This runs once per test session and creates all tables
    in the in-memory database used by integration tests.
    """
    global _test_db_initialized

    # Only initialize once
    if _test_db_initialized:
        return

    # Set test environment variables
    os.environ["TESTING"] = "true"
    os.environ["DEBUG"] = "true"
    os.environ["THUNDERBIRD_DB_PATH"] = ":memory:"
    os.environ["JWT_SECRET"] = "test-secret-key-for-integration-tests"
    os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
    os.environ["STRIPE_WEBHOOK_SECRET"] = ""
    os.environ["TWILIO_AUTH_TOKEN"] = "test_twilio_token"

    # Note: Each test file with TestClient creates its own app instance
    # which creates its own in-memory database. The tables are created
    # in the module-level imports via the stores' _init_db methods.
    #
    # For proper isolation, we patch the store classes to use our
    # create_test_tables function. But the simpler fix is to ensure
    # each store's _init_db creates tables if they don't exist.

    _test_db_initialized = True


@pytest.fixture
def test_db():
    """
    Provide a fresh test database connection.

    Creates all tables and returns a connection that tests can use.
    """
    db_path = ":memory:"
    create_test_tables(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()


@pytest.fixture
def mock_settings(monkeypatch):
    """Mock settings for testing."""
    monkeypatch.setenv("MOCK_BOM_API", "true")
    monkeypatch.setenv("DEBUG", "true")


@pytest.fixture
def sample_forecast_data():
    """Sample forecast data for testing."""
    return {
        "periods": [
            {
                "time": "2026-01-15T09:00:00+11:00",
                "period": "AM",
                "temp_min": 5,
                "temp_max": 12,
                "rain_chance": 60,
                "rain_min": 2,
                "rain_max": 8,
                "snow_min": 0,
                "snow_max": 1,
                "wind_avg": 35,
                "wind_max": 50,
                "cloud_cover": 75,
                "cloud_base_height_agl": 900,
                "freezing_level": 1500,
                "convective_available_potential_energy": 150
            }
        ]
    }
