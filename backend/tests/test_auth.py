"""
Authentication System Tests

Tests for:
- Account registration (FOUN-03)
- Login and JWT tokens (FOUN-04)
- Phone number linking (FOUN-05)

Run with: pytest tests/test_auth.py -v
"""
import pytest
import os
import sqlite3
from datetime import datetime, timedelta, timezone

# Set JWT_SECRET for tests
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only-32chars"

from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.models.account import Account, AccountStore


class TestPasswordHashing:
    """Tests for Argon2 password hashing."""

    def test_hash_password_returns_string(self):
        """Hash should return a string."""
        hashed = hash_password("mypassword")
        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_hash_password_different_each_time(self):
        """Each hash should be unique (salted)."""
        hash1 = hash_password("mypassword")
        hash2 = hash_password("mypassword")
        assert hash1 != hash2  # Different salts

    def test_verify_password_correct(self):
        """Correct password should verify."""
        hashed = hash_password("mypassword")
        assert verify_password("mypassword", hashed) is True

    def test_verify_password_incorrect(self):
        """Incorrect password should not verify."""
        hashed = hash_password("mypassword")
        assert verify_password("wrongpassword", hashed) is False

    def test_verify_password_empty(self):
        """Empty password should not verify."""
        hashed = hash_password("mypassword")
        assert verify_password("", hashed) is False


class TestJWT:
    """Tests for JWT token creation."""

    def test_create_token_returns_string(self):
        """Token should be a non-empty string."""
        token = create_access_token({"sub": "test@example.com"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_token_with_custom_expiry(self):
        """Token should accept custom expiry."""
        token = create_access_token(
            {"sub": "test@example.com"},
            expires_delta=timedelta(hours=1)
        )
        assert isinstance(token, str)

    def test_token_contains_payload(self):
        """Token should decode back to payload."""
        import jwt
        token = create_access_token({"sub": "test@example.com", "custom": "data"})

        # Decode without verification for testing
        decoded = jwt.decode(token, options={"verify_signature": False})
        assert decoded["sub"] == "test@example.com"
        assert decoded["custom"] == "data"
        assert "exp" in decoded


class TestAccountStore:
    """Tests for AccountStore database operations."""

    @pytest.fixture
    def test_db(self, tmp_path):
        """Create a fresh test database."""
        db_path = tmp_path / "test.db"

        # Create accounts table
        conn = sqlite3.connect(str(db_path))
        conn.execute("""
            CREATE TABLE accounts (
                id INTEGER PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                phone TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()

        return str(db_path)

    @pytest.fixture
    def store(self, test_db):
        """Get AccountStore with test database."""
        return AccountStore(db_path=test_db)

    def test_create_account(self, store):
        """Should create account and return it."""
        account = store.create(
            email="test@example.com",
            password_hash="hashed_password"
        )

        assert account.id is not None
        assert account.email == "test@example.com"
        assert account.password_hash == "hashed_password"
        assert account.phone is None
        assert account.created_at is not None

    def test_create_account_lowercase_email(self, store):
        """Email should be stored lowercase."""
        account = store.create(
            email="Test@EXAMPLE.com",
            password_hash="hashed"
        )
        assert account.email == "test@example.com"

    def test_create_duplicate_email_fails(self, store):
        """Duplicate email should raise error."""
        store.create(email="test@example.com", password_hash="hash1")

        with pytest.raises(sqlite3.IntegrityError):
            store.create(email="test@example.com", password_hash="hash2")

    def test_get_by_email(self, store):
        """Should retrieve account by email."""
        store.create(email="test@example.com", password_hash="hashed")

        found = store.get_by_email("test@example.com")
        assert found is not None
        assert found.email == "test@example.com"

    def test_get_by_email_case_insensitive(self, store):
        """Email lookup should be case-insensitive."""
        store.create(email="test@example.com", password_hash="hashed")

        found = store.get_by_email("TEST@EXAMPLE.COM")
        assert found is not None

    def test_get_by_email_not_found(self, store):
        """Non-existent email should return None."""
        found = store.get_by_email("notfound@example.com")
        assert found is None

    def test_get_by_id(self, store):
        """Should retrieve account by ID."""
        created = store.create(email="test@example.com", password_hash="hashed")

        found = store.get_by_id(created.id)
        assert found is not None
        assert found.email == "test@example.com"

    def test_link_phone(self, store):
        """Should link phone number to account."""
        account = store.create(email="test@example.com", password_hash="hashed")
        assert account.phone is None

        success = store.link_phone(account.id, "+61412345678")
        assert success is True

        updated = store.get_by_id(account.id)
        assert updated.phone == "+61412345678"

    def test_link_phone_updates_timestamp(self, store):
        """Linking phone should update updated_at."""
        account = store.create(email="test@example.com", password_hash="hashed")
        original_updated = account.updated_at

        # Small delay to ensure timestamp differs
        import time
        time.sleep(0.01)

        store.link_phone(account.id, "+61412345678")
        updated = store.get_by_id(account.id)

        assert updated.updated_at >= original_updated

    def test_get_by_phone(self, store):
        """Should retrieve account by phone number."""
        account = store.create(email="test@example.com", password_hash="hashed")
        store.link_phone(account.id, "+61412345678")

        found = store.get_by_phone("+61412345678")
        assert found is not None
        assert found.email == "test@example.com"

    def test_get_by_phone_not_found(self, store):
        """Non-existent phone should return None."""
        found = store.get_by_phone("+61400000000")
        assert found is None


class TestEndToEndAuth:
    """Integration tests for complete auth flows."""

    @pytest.fixture
    def test_db(self, tmp_path):
        """Create a fresh test database."""
        db_path = tmp_path / "test.db"

        conn = sqlite3.connect(str(db_path))
        conn.execute("""
            CREATE TABLE accounts (
                id INTEGER PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                phone TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()

        return str(db_path)

    def test_register_and_login_flow(self, test_db):
        """Complete registration and login flow."""
        store = AccountStore(db_path=test_db)

        # Register
        password = "securepassword123"
        hashed = hash_password(password)
        account = store.create(email="user@example.com", password_hash=hashed)

        assert account.id is not None

        # Login (verify credentials)
        found = store.get_by_email("user@example.com")
        assert found is not None
        assert verify_password(password, found.password_hash)

        # Create token
        token = create_access_token({"sub": found.email})
        assert len(token) > 0

    def test_link_phone_flow(self, test_db):
        """Complete phone linking flow."""
        store = AccountStore(db_path=test_db)

        # Create account
        account = store.create(
            email="user@example.com",
            password_hash=hash_password("password")
        )
        assert account.phone is None

        # Link phone
        store.link_phone(account.id, "+61412345678")

        # Verify
        updated = store.get_by_id(account.id)
        assert updated.phone == "+61412345678"

        # Can now lookup by phone
        by_phone = store.get_by_phone("+61412345678")
        assert by_phone.email == "user@example.com"
