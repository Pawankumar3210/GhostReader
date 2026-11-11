from __future__ import annotations

import asyncio
import ipaddress
import socket
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

from app.core.errors import BlockedTarget, InvalidURL

Resolver = Callable[[str, int], Awaitable[list[str]]]

_ALLOWED_SCHEMES = {"http", "https"}
_BLOCKED_SUFFIXES = (
    ".localhost",
    ".local",
    ".internal",
    ".intranet",
    ".lan",
    ".home.arpa",
    ".corp",
    ".test",
    ".example",
    ".invalid",
)
_BLOCKED_HOSTS = {
    "localhost",
    "metadata.google.internal",
    "metadata",
    "instance-data",
}

_BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("::/128"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("ff00::/8"),
    ipaddress.ip_network("2001:db8::/32"),
]

_MAX_URL_LENGTH = 4096


@dataclass(frozen=True)
class ParsedURL:
    scheme: str
    host: str
    port: int
    path: str
    query: str
    normalized_url: str


@dataclass(frozen=True)
class ValidatedURL:
    original_url: str
    url: str
    scheme: str
    host: str
    port: int
    path: str
    query: str
    ip_addresses: tuple[str, ...]

    @property
    def origin(self) -> str:
        host = f"[{self.host}]" if ":" in self.host else self.host
        default = 443 if self.scheme == "https" else 80
        port = "" if self.port == default else f":{self.port}"
        return f"{self.scheme}://{host}{port}"


def _is_blocked_ip(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value.split("%")[0])
    except ValueError:
        return True

    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return _is_blocked_ip(str(ip.ipv4_mapped))
        if ip.sixtofour is not None or ip.teredo is not None:
            return True

    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return True

    return any(ip in network for network in _BLOCKED_NETWORKS if network.version == ip.version)


def _normalize_host(host: str) -> str:
    host = host.strip().lower().rstrip(".")
    if not host:
        raise InvalidURL("The URL does not include a hostname.")
    if host.startswith("[") and host.endswith("]"):
        host = host[1:-1]
    if "%" in host:
        raise InvalidURL("IPv6 zone identifiers are not permitted.")
    try:
        host.encode("ascii")
    except UnicodeEncodeError:
        try:
            host = host.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise InvalidURL("The URL hostname is not valid.") from exc
    return host


class URLValidator:
    """Validates URL syntax, DNS results and network destinations.

    Every redirect hop must be validated with the same rules. The fetcher does
    this explicitly instead of relying on automatic redirect following.
    """

    def __init__(
        self,
        *,
        allowed_ports: set[int] | None = None,
        resolver: Resolver | None = None,
        resolution_timeout: float = 8.0,
    ) -> None:
        self.allowed_ports = allowed_ports or {80, 443}
        self._resolver = resolver
        self.resolution_timeout = resolution_timeout

    def parse(self, raw_url: str) -> ParsedURL:
        if not isinstance(raw_url, str):
            raise InvalidURL()
        raw_url = raw_url.strip()
        if not raw_url:
            raise InvalidURL("Enter a URL to analyse.")
        if len(raw_url) > _MAX_URL_LENGTH:
            raise InvalidURL("The URL is too long.")
        if any(ch.isspace() for ch in raw_url):
            raise InvalidURL("The URL contains whitespace. Remove it and try again.")
        if "\\" in raw_url:
            raise InvalidURL("Backslashes are not permitted in URLs.")

        try:
            parsed = urlsplit(raw_url)
        except ValueError as exc:
            raise InvalidURL("The URL could not be parsed.") from exc

        scheme = (parsed.scheme or "").lower()
        if not scheme:
            raise InvalidURL("Include http:// or https:// in the URL.")
        if scheme not in _ALLOWED_SCHEMES:
            raise InvalidURL(
                "Only http and https URLs are supported.",
                code="UNSUPPORTED_SCHEME",
            )
        if not parsed.netloc:
            raise InvalidURL("The URL does not include a hostname.")
        if "@" in parsed.netloc or parsed.username or parsed.password:
            raise InvalidURL(
                "URLs containing credentials are not accepted.",
                code="CREDENTIALS_NOT_ALLOWED",
            )

        try:
            port = parsed.port
        except ValueError as exc:
            raise InvalidURL("The URL contains an invalid port.") from exc

        if port is None:
            port = 443 if scheme == "https" else 80
        if port not in self.allowed_ports:
            raise InvalidURL(
                f"Port {port} is not permitted. Only {sorted(self.allowed_ports)} are allowed.",
                code="PORT_NOT_ALLOWED",
            )

        try:
            host = _normalize_host(parsed.hostname or "")
        except ValueError as exc:
            raise InvalidURL("The URL hostname is not valid.") from exc

        if host in _BLOCKED_HOSTS or any(host.endswith(suffix) for suffix in _BLOCKED_SUFFIXES):
            raise BlockedTarget("The destination host is reserved for internal networks.")
        if "_" in host:
            raise InvalidURL("The URL hostname is not a valid public DNS name.")
        if "." not in host:
            try:
                ipaddress.ip_address(host)
            except ValueError as exc:
                raise BlockedTarget(
                    "Single-label hostnames are not permitted because they usually resolve to internal services."
                ) from exc

        path = parsed.path or "/"
        query = parsed.query
        netloc = host
        if ":" in host:
            netloc = f"[{host}]"
        default_port = 443 if scheme == "https" else 80
        if port != default_port:
            netloc = f"{netloc}:{port}"
        normalized = urlunsplit((scheme, netloc, path, query, ""))

        return ParsedURL(
            scheme=scheme,
            host=host,
            port=port,
            path=path,
            query=query,
            normalized_url=normalized,
        )

    async def _default_resolver(self, host: str, port: int) -> list[str]:
        loop = asyncio.get_running_loop()
        infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        addresses: list[str] = []
        for info in infos:
            sockaddr = info[4]
            if sockaddr and sockaddr[0] not in addresses:
                addresses.append(sockaddr[0])
        return addresses

    async def resolve(self, parsed: ParsedURL, original_url: str | None = None) -> ValidatedURL:
        resolver = self._resolver or self._default_resolver
        try:
            addresses = await asyncio.wait_for(
                resolver(parsed.host, parsed.port), timeout=self.resolution_timeout
            )
        except TimeoutError as exc:
            raise InvalidURL(
                "The hostname could not be resolved in time.",
                code="DNS_FAILURE",
                status_code=502,
            ) from exc
        except (socket.gaierror, OSError) as exc:
            raise InvalidURL(
                "The hostname could not be resolved. Check the URL and try again.",
                code="DNS_FAILURE",
                status_code=502,
            ) from exc

        if not addresses:
            raise InvalidURL(
                "The hostname did not resolve to any address.",
                code="DNS_FAILURE",
                status_code=502,
            )
        if len(addresses) > 16:
            raise BlockedTarget("The hostname resolved to an excessive number of addresses.")

        for address in addresses:
            if _is_blocked_ip(address):
                raise BlockedTarget(
                    "The destination resolves to a private, reserved or internal address, "
                    "which is blocked by Ghost Reader's network-safety policy.",
                )

        return ValidatedURL(
            original_url=original_url or parsed.normalized_url,
            url=parsed.normalized_url,
            scheme=parsed.scheme,
            host=parsed.host,
            port=parsed.port,
            path=parsed.path,
            query=parsed.query,
            ip_addresses=tuple(addresses),
        )

    async def validate(self, raw_url: str) -> ValidatedURL:
        parsed = self.parse(raw_url)
        return await self.resolve(parsed, original_url=raw_url)


def is_blocked_address(address: str) -> bool:
    """Exposed for tests and diagnostic tooling."""
    return _is_blocked_ip(address)
