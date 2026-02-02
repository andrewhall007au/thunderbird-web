"""
Custom route models for Thunderbird Global.

Handles user-created routes, waypoints, and the route library (admin-uploaded trails).
Custom routes belong to accounts, waypoints have globally unique SMS codes.
"""
import os
import sqlite3
from datetime import datetime
from dataclasses import dataclass
from typing import Optional, List
from contextlib import contextmanager
from enum import Enum


DB_PATH = os.environ.get("THUNDERBIRD_DB_PATH", "thunderbird.db")


class RouteStatus(str, Enum):
    """Status of a custom route."""
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class WaypointType(str, Enum):
    """Type of waypoint for visual styling."""
    CAMP = "camp"
    PEAK = "peak"
    POI = "poi"


@dataclass
class CustomRoute:
    """
    Custom route created by a user.

    Attributes:
        id: Primary key
        account_id: Foreign key to accounts (route owner)
        name: Route name (e.g., "My Overland Track")
        gpx_data: Parsed GPX as JSON dict (not raw XML)
        status: draft, active, or archived
        is_library_clone: Whether cloned from route library
        source_library_id: ID of source library route (if cloned)
        created_at: Creation timestamp
        updated_at: Last modification timestamp
    """
    id: int
    account_id: int
    name: str
    gpx_data: Optional[dict] = None
    status: RouteStatus = RouteStatus.DRAFT
    is_library_clone: bool = False
    source_library_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class CustomWaypoint:
    """
    Waypoint on a custom route.

    Attributes:
        id: Primary key
        route_id: Foreign key to custom_routes
        type: camp, peak, or poi
        name: Waypoint name (e.g., "Lake Oberon")
        sms_code: Unique 5-char code for SMS commands (e.g., "LAKEO")
        lat: Latitude
        lng: Longitude
        elevation: Elevation in meters
        order_index: Display order in route
        created_at: Creation timestamp
    """
    id: int
    route_id: int
    type: WaypointType
    name: str
    sms_code: str
    lat: float
    lng: float
    elevation: float = 0.0
    order_index: int = 0
    created_at: Optional[datetime] = None


@dataclass
class RouteLibrary:
    """
    Admin-uploaded popular trail for cloning.

    Attributes:
        id: Primary key
        name: Trail name (e.g., "Overland Track")
        description: Trail description
        gpx_data: Parsed GPX as JSON dict
        country: Country code (e.g., "AU")
        region: Region/state (e.g., "Tasmania")
        difficulty_grade: 1-5 difficulty rating
        distance_km: Total distance in kilometers
        typical_days: Typical duration (e.g., "5-7 days")
        is_active: Whether available for cloning
        created_at: Creation timestamp
        updated_at: Last modification timestamp
    """
    id: int
    name: str
    description: Optional[str] = None
    gpx_data: Optional[dict] = None
    country: Optional[str] = None
    region: Optional[str] = None
    difficulty_grade: Optional[int] = None
    distance_km: Optional[float] = None
    typical_days: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CustomRouteStore:
    """SQLite-backed custom route storage."""

    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH
        self._init_db()

    def _init_db(self):
        """Initialize database and create tables if needed."""
        import logging
        logger = logging.getLogger(__name__)

        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_routes'"
            )
            if not cursor.fetchone():
                logger.warning("Custom route tables not found. Creating for backwards compatibility.")
                self._create_tables_legacy(conn)
            conn.commit()

    def _create_tables_legacy(self, conn):
        """Legacy table creation for backwards compatibility and tests."""
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

    @contextmanager
    def _get_connection(self):
        """Get database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _row_to_route(self, row: sqlite3.Row) -> CustomRoute:
        """Convert database row to CustomRoute object."""
        import json
        return CustomRoute(
            id=row["id"],
            account_id=row["account_id"],
            name=row["name"],
            gpx_data=json.loads(row["gpx_data"]) if row["gpx_data"] else None,
            status=RouteStatus(row["status"]) if row["status"] else RouteStatus.DRAFT,
            is_library_clone=bool(row["is_library_clone"]),
            source_library_id=row["source_library_id"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
            updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None
        )

    def get_by_id(self, route_id: int) -> Optional[CustomRoute]:
        """Get route by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM custom_routes WHERE id = ?",
                (route_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_route(row)
            return None

    def get_by_account_id(self, account_id: int) -> List[CustomRoute]:
        """Get all routes for an account."""
        routes = []
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM custom_routes WHERE account_id = ? ORDER BY updated_at DESC",
                (account_id,)
            )
            for row in cursor:
                routes.append(self._row_to_route(row))
        return routes

    def create(
        self,
        account_id: int,
        name: str,
        gpx_data: Optional[dict] = None,
        is_library_clone: bool = False,
        source_library_id: Optional[int] = None
    ) -> CustomRoute:
        """
        Create a new custom route.

        Args:
            account_id: Account creating the route
            name: Route name
            gpx_data: Parsed GPX as dict
            is_library_clone: Whether cloned from library
            source_library_id: Source library route ID

        Returns:
            Created CustomRoute object
        """
        import json
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO custom_routes
                   (account_id, name, gpx_data, status, is_library_clone,
                    source_library_id, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (account_id, name, json.dumps(gpx_data) if gpx_data else None,
                 RouteStatus.DRAFT.value, is_library_clone, source_library_id, now, now)
            )
            conn.commit()

            return CustomRoute(
                id=cursor.lastrowid,
                account_id=account_id,
                name=name,
                gpx_data=gpx_data,
                status=RouteStatus.DRAFT,
                is_library_clone=is_library_clone,
                source_library_id=source_library_id,
                created_at=datetime.fromisoformat(now),
                updated_at=datetime.fromisoformat(now)
            )

    def update(
        self,
        route_id: int,
        name: Optional[str] = None,
        gpx_data: Optional[dict] = None,
        status: Optional[RouteStatus] = None
    ) -> bool:
        """
        Update a custom route.

        Args:
            route_id: Route to update
            name: New name (optional)
            gpx_data: New GPX data (optional)
            status: New status (optional)

        Returns:
            True if updated, False if route not found
        """
        import json
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            # Build dynamic update
            updates = ["updated_at = ?"]
            params = [now]

            if name is not None:
                updates.append("name = ?")
                params.append(name)
            if gpx_data is not None:
                updates.append("gpx_data = ?")
                params.append(json.dumps(gpx_data))
            if status is not None:
                updates.append("status = ?")
                params.append(status.value)

            params.append(route_id)

            cursor = conn.execute(
                f"UPDATE custom_routes SET {', '.join(updates)} WHERE id = ?",
                params
            )
            conn.commit()
            return cursor.rowcount > 0

    def delete(self, route_id: int) -> bool:
        """
        Delete a custom route (cascades to waypoints).

        Args:
            route_id: Route to delete

        Returns:
            True if deleted, False if not found
        """
        with self._get_connection() as conn:
            # Delete waypoints first (manual cascade for SQLite)
            conn.execute(
                "DELETE FROM custom_waypoints WHERE route_id = ?",
                (route_id,)
            )
            cursor = conn.execute(
                "DELETE FROM custom_routes WHERE id = ?",
                (route_id,)
            )
            conn.commit()
            return cursor.rowcount > 0


class CustomWaypointStore:
    """SQLite-backed waypoint storage."""

    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH

    @contextmanager
    def _get_connection(self):
        """Get database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _row_to_waypoint(self, row: sqlite3.Row) -> CustomWaypoint:
        """Convert database row to CustomWaypoint object."""
        return CustomWaypoint(
            id=row["id"],
            route_id=row["route_id"],
            type=WaypointType(row["type"]) if row["type"] else WaypointType.POI,
            name=row["name"],
            sms_code=row["sms_code"],
            lat=row["lat"],
            lng=row["lng"],
            elevation=row["elevation"] or 0.0,
            order_index=row["order_index"] or 0,
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None
        )

    def get_by_route_id(self, route_id: int) -> List[CustomWaypoint]:
        """Get all waypoints for a route, ordered by order_index."""
        waypoints = []
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM custom_waypoints WHERE route_id = ? ORDER BY order_index ASC",
                (route_id,)
            )
            for row in cursor:
                waypoints.append(self._row_to_waypoint(row))
        return waypoints

    def get_by_sms_code(self, sms_code: str) -> Optional[CustomWaypoint]:
        """Get waypoint by SMS code (globally unique)."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM custom_waypoints WHERE sms_code = ?",
                (sms_code.upper(),)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_waypoint(row)
            return None

    def create(
        self,
        route_id: int,
        name: str,
        sms_code: str,
        lat: float,
        lng: float,
        waypoint_type: WaypointType = WaypointType.POI,
        elevation: float = 0.0,
        order_index: int = 0
    ) -> CustomWaypoint:
        """
        Create a new waypoint.

        Args:
            route_id: Route this waypoint belongs to
            name: Waypoint name
            sms_code: Unique 5-char SMS code
            lat: Latitude
            lng: Longitude
            waypoint_type: camp, peak, or poi
            elevation: Elevation in meters
            order_index: Display order

        Returns:
            Created CustomWaypoint object

        Raises:
            sqlite3.IntegrityError: If sms_code already exists
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO custom_waypoints
                   (route_id, type, name, sms_code, lat, lng, elevation, order_index, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (route_id, waypoint_type.value, name, sms_code.upper(),
                 lat, lng, elevation, order_index, now)
            )
            conn.commit()

            return CustomWaypoint(
                id=cursor.lastrowid,
                route_id=route_id,
                type=waypoint_type,
                name=name,
                sms_code=sms_code.upper(),
                lat=lat,
                lng=lng,
                elevation=elevation,
                order_index=order_index,
                created_at=datetime.fromisoformat(now)
            )

    def update(
        self,
        waypoint_id: int,
        name: Optional[str] = None,
        waypoint_type: Optional[WaypointType] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        elevation: Optional[float] = None,
        order_index: Optional[int] = None
    ) -> bool:
        """
        Update a waypoint.

        Note: sms_code cannot be updated (must delete and recreate).

        Returns:
            True if updated, False if waypoint not found
        """
        with self._get_connection() as conn:
            # Build dynamic update
            updates = []
            params = []

            if name is not None:
                updates.append("name = ?")
                params.append(name)
            if waypoint_type is not None:
                updates.append("type = ?")
                params.append(waypoint_type.value)
            if lat is not None:
                updates.append("lat = ?")
                params.append(lat)
            if lng is not None:
                updates.append("lng = ?")
                params.append(lng)
            if elevation is not None:
                updates.append("elevation = ?")
                params.append(elevation)
            if order_index is not None:
                updates.append("order_index = ?")
                params.append(order_index)

            if not updates:
                return True  # Nothing to update

            params.append(waypoint_id)

            cursor = conn.execute(
                f"UPDATE custom_waypoints SET {', '.join(updates)} WHERE id = ?",
                params
            )
            conn.commit()
            return cursor.rowcount > 0

    def delete(self, waypoint_id: int) -> bool:
        """
        Delete a waypoint.

        Returns:
            True if deleted, False if not found
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM custom_waypoints WHERE id = ?",
                (waypoint_id,)
            )
            conn.commit()
            return cursor.rowcount > 0

    def check_sms_code_exists(self, sms_code: str) -> bool:
        """
        Check if an SMS code already exists.

        Used for collision detection during code generation.

        Args:
            sms_code: Code to check

        Returns:
            True if code exists, False if available
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT 1 FROM custom_waypoints WHERE sms_code = ? LIMIT 1",
                (sms_code.upper(),)
            )
            return cursor.fetchone() is not None


class RouteLibraryStore:
    """SQLite-backed route library storage."""

    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH

    @contextmanager
    def _get_connection(self):
        """Get database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _row_to_library(self, row: sqlite3.Row) -> RouteLibrary:
        """Convert database row to RouteLibrary object."""
        import json
        return RouteLibrary(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            gpx_data=json.loads(row["gpx_data"]) if row["gpx_data"] else None,
            country=row["country"],
            region=row["region"],
            difficulty_grade=row["difficulty_grade"],
            distance_km=row["distance_km"],
            typical_days=row["typical_days"],
            is_active=bool(row["is_active"]),
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
            updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None
        )

    def list_active(self) -> List[RouteLibrary]:
        """Get all active library routes."""
        routes = []
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM route_library WHERE is_active = 1 ORDER BY name ASC"
            )
            for row in cursor:
                routes.append(self._row_to_library(row))
        return routes

    def get_by_id(self, library_id: int) -> Optional[RouteLibrary]:
        """Get library route by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM route_library WHERE id = ?",
                (library_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_library(row)
            return None

    def create(
        self,
        name: str,
        description: Optional[str] = None,
        gpx_data: Optional[dict] = None,
        country: Optional[str] = None,
        region: Optional[str] = None,
        difficulty_grade: Optional[int] = None,
        distance_km: Optional[float] = None,
        typical_days: Optional[str] = None
    ) -> RouteLibrary:
        """
        Create a new library route (admin only).

        Returns:
            Created RouteLibrary object
        """
        import json
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO route_library
                   (name, description, gpx_data, country, region, difficulty_grade,
                    distance_km, typical_days, is_active, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (name, description, json.dumps(gpx_data) if gpx_data else None,
                 country, region, difficulty_grade, distance_km, typical_days,
                 True, now, now)
            )
            conn.commit()

            return RouteLibrary(
                id=cursor.lastrowid,
                name=name,
                description=description,
                gpx_data=gpx_data,
                country=country,
                region=region,
                difficulty_grade=difficulty_grade,
                distance_km=distance_km,
                typical_days=typical_days,
                is_active=True,
                created_at=datetime.fromisoformat(now),
                updated_at=datetime.fromisoformat(now)
            )


# Singleton instances
custom_route_store = CustomRouteStore()
custom_waypoint_store = CustomWaypointStore()
route_library_store = RouteLibraryStore()
