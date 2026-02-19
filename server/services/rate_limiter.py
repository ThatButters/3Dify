import ipaddress
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.audit_log import AuditLog
from models.ban import IPBan

# In-memory cache: ip -> (count, timestamp)
_cache: dict[str, tuple[int, float]] = {}


async def is_banned(session: AsyncSession, ip: str) -> bool:
    """Check if IP is banned (exact match or CIDR)."""
    result = await session.execute(select(IPBan))
    bans = result.scalars().all()
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    for ban in bans:
        try:
            network = ipaddress.ip_network(ban.ip_or_cidr, strict=False)
            if addr in network:
                return True
        except ValueError:
            # Exact match fallback
            if ban.ip_or_cidr == ip:
                return True
    return False


async def check_rate_limit(session: AsyncSession, ip: str) -> tuple[bool, int]:
    """Check if IP is within rate limit.

    Returns (allowed, remaining_count).
    """
    now = time.monotonic()
    cached = _cache.get(ip)
    if cached:
        count, ts = cached
        if now - ts < settings.rate_limit_cache_ttl_s:
            remaining = max(0, settings.rate_limit_per_day - count)
            return count < settings.rate_limit_per_day, remaining

    # Count uploads in last 24h
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    result = await session.execute(
        select(func.count())
        .select_from(AuditLog)
        .where(
            AuditLog.action == "upload",
            AuditLog.client_ip == ip,
            AuditLog.created_at >= cutoff,
        )
    )
    count = result.scalar_one()
    _cache[ip] = (count, now)
    remaining = max(0, settings.rate_limit_per_day - count)
    return count < settings.rate_limit_per_day, remaining


def invalidate_cache(ip: str) -> None:
    _cache.pop(ip, None)
