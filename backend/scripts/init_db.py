#!/usr/bin/env python3
"""
Database Migration Script
Creates all tables for Thunderbird.

Usage:
    python scripts/init_db.py [--drop]
"""

import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from config.settings import settings
from app.models.database import Base, create_tables, drop_tables


def init_database(drop_existing: bool = False):
    """Initialize the database."""
    print(f"Connecting to: {settings.DATABASE_URL}")
    
    engine = create_engine(settings.DATABASE_URL)
    
    if drop_existing:
        print("Dropping existing tables...")
        drop_tables(engine)
    
    print("Creating tables...")
    create_tables(engine)
    
    # Verify tables
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public'"
        ))
        tables = [row[0] for row in result]
        print(f"Created tables: {tables}")
    
    print("Database initialized successfully!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Initialize Thunderbird database")
    parser.add_argument("--drop", action="store_true", help="Drop existing tables first")
    args = parser.parse_args()
    
    init_database(drop_existing=args.drop)
