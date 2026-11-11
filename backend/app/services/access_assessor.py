from __future__ import annotations

import re
from dataclasses import dataclass

from bs4 import BeautifulSoup

from app.schemas.analysis import AccessAssessment
from app.schemas.enums import AccessStatus, Confidence
from app.services.article_extractor import ArticleExtraction
from app.services.metadata_extractor import PageMetadata

_PAYWALL_PHRASES = (
    "subscribe to continue",
    "subscribe to read",
    "subscribe now to continue",
    "to continue reading",
    "continue reading with a subscription",
    "already a subscriber",
    "subscribers only",
    "subscriber-only",
    "subscriber only",
    "this article is for subscribers",
    "this story is for subscribers",
    "premium content",
    "unlock this article",
    "unlock full access",
    "become a member to read",
    "start your free trial",
    "metered paywall",
)
_PAYWALL_STRUCTURAL = (
    "paywall",
    "subscribe-wall",
    "subscription-wall",
    "regwall",
    "meter-wall",
    "premium-gate",
    "piano",
    "tp-modal",
    "tp-iframe-wrapper",
)
_LOGIN_PHRASES = (
    "sign in to continue",
    "log in to continue",
    "log in to read",
    "login to continue",
    "sign in to read",
    "please sign in",
    "create an account to continue",
    "you must be logged in",
    "members only",
    "this content is available to signed-in",
)
_LOGIN_STRUCTURAL = ("login-wall", "signin-wall", "auth-wall", "login-required", "member-gate")
_CHALLENGE_PHRASES = (
    "verify you are human",
    "verify you are a human",
    "are you a robot",
    "checking your browser",
    "enable javascript and cookies to continue",
    "unusual traffic",
    "request unsuccessful",
    "access denied",
    "ddos protection by",
    "please complete the security check",
    "press and hold",
    "attention required! | cloudflare",
)
_CHALLENGE_STRUCTURAL = (
    "cf-challenge",
    "cf-browser-verification",
    "challenge-platform",
    "captcha",
    "h-captcha",
    "g-recaptcha",
    "ddos-guard",
    "perimeterx",
)
_JS_PHRASES = (
    "you need to enable javascript",
    "enable javascript to run this app",
    "this application requires javascript",
    "please enable javascript",
    "javascript is required",
    "requires javascript to function",
)
_JS_STRUCTURAL = ("__next_data__", 'id="root"', 'id="app"', "ng-app", "data-reactroot")

_MEANINGFUL_PREVIEW_CHARS = 160
_SUBSTANTIAL_WORDS = 80
_SUBSTANTIAL_CHARS = 600


@dataclass
class _Signals:
    visible_text: str
    raw_html: str
    structural: str
    paywall_phrases: list[str]
    paywall_structural: list[str]
    login_phrases: list[str]
    login_structural: list[str]
    challenge_phrases: list[str]
    challenge_structural: list[str]
    js_phrases: list[str]
    js_structural: list[str]


def _collect_signals(html: str) -> _Signals:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        visible = tag.name == "noscript"
        if not visible:
            tag.decompose()
    visible_text = soup.get_text(" ", strip=True).lower()
    structural_parts: list[str] = []
    for tag in soup.find_all(True):
        classes = tag.get("class")
        if classes:
            structural_parts.extend(str(item).lower() for item in classes)
        tag_id = tag.get("id")
        if tag_id:
            structural_parts.append(str(tag_id).lower())
    raw_lower = html.lower()

    def find_phrases(phrases: tuple[str, ...], haystack: str) -> list[str]:
        return [phrase for phrase in phrases if phrase in haystack]

    return _Signals(
        visible_text=visible_text,
        raw_html=raw_lower,
        structural=" ".join(structural_parts),
        paywall_phrases=find_phrases(_PAYWALL_PHRASES, visible_text),
        paywall_structural=find_phrases(_PAYWALL_STRUCTURAL, " ".join(structural_parts)),
        login_phrases=find_phrases(_LOGIN_PHRASES, visible_text),
        login_structural=find_phrases(_LOGIN_STRUCTURAL, " ".join(structural_parts)),
        challenge_phrases=find_phrases(_CHALLENGE_PHRASES, visible_text),
        challenge_structural=find_phrases(_CHALLENGE_STRUCTURAL, raw_lower),
        js_phrases=find_phrases(_JS_PHRASES, visible_text),
        js_structural=find_phrases(_JS_STRUCTURAL, raw_lower),
    )


class AccessAssessor:
    """Classifies what is actually available without defeating any access control.

    The classifier deliberately prefers uncertainty over false certainty: an
    HTTP 403 alone is not labelled as a paywall, and PUBLIC_FULL is returned
    only when a substantial article body was truly extracted.
    """

    def assess(
        self,
        *,
        status_code: int,
        html: str,
        metadata: PageMetadata,
        extraction: ArticleExtraction,
        content_type: str,
        has_password_form: bool = False,
    ) -> AccessAssessment:
        if content_type and not content_type.startswith(("text/html", "application/xhtml")):
            return AccessAssessment(
                status=AccessStatus.UNSUPPORTED,
                confidence=Confidence.HIGH,
                explanation="The publisher returned a content type that Ghost Reader does not read as an article.",
                evidence=[f"Content-Type: {content_type or 'unknown'}"],
            )

        signals = _collect_signals(html)
        text = extraction.text.strip()
        words = extraction.word_count
        chars = len(text)
        paragraph_blocks = sum(1 for block in extraction.blocks if block.type.value == "paragraph")
        substantial = words >= _SUBSTANTIAL_WORDS and chars >= _SUBSTANTIAL_CHARS and paragraph_blocks >= 3
        preview = chars >= _MEANINGFUL_PREVIEW_CHARS or words >= 25

        evidence: list[str] = []
        paywall_evidence: list[str] = []
        login_evidence: list[str] = []
        challenge_evidence: list[str] = []

        if metadata.is_accessible_for_free is False:
            paywall_evidence.append("Structured data declares isAccessibleForFree = false.")
        if metadata.content_tier and metadata.content_tier.lower() in {"locked", "premium", "subscriber"}:
            paywall_evidence.append(f"Publisher metadata declares content_tier = {metadata.content_tier}.")
        for phrase in signals.paywall_phrases[:2]:
            paywall_evidence.append(f"Visible page text contains “{phrase}”.")
        for marker in signals.paywall_structural[:2]:
            paywall_evidence.append(f"Paywall-related page structure detected: {marker}.")
        for phrase in signals.login_phrases[:2]:
            login_evidence.append(f"Visible page text contains “{phrase}”.")
        for marker in signals.login_structural[:2]:
            login_evidence.append(f"Login-related page structure detected: {marker}.")
        if has_password_form:
            login_evidence.append("A password field is present in the page.")
        for phrase in signals.challenge_phrases[:2]:
            challenge_evidence.append(f"Access-challenge text detected: “{phrase}”.")
        for marker in signals.challenge_structural[:2]:
            challenge_evidence.append(f"Challenge or anti-automation marker detected: {marker}.")
        for phrase in signals.js_phrases[:2]:
            evidence.append(f"JavaScript requirement message detected: “{phrase}”.")

        if status_code in {401, 407}:
            return AccessAssessment(
                status=AccessStatus.LOGIN_REQUIRED,
                confidence=Confidence.HIGH,
                explanation=(
                    "The publisher responded with an authentication requirement. Ghost Reader does not collect "
                    "publisher credentials or session cookies, so the protected content cannot be retrieved."
                ),
                evidence=[f"HTTP {status_code} response from the publisher.", *login_evidence],
            )

        if status_code == 429:
            return AccessAssessment(
                status=AccessStatus.ACCESS_CHALLENGE,
                confidence=Confidence.HIGH,
                explanation=(
                    "The publisher is rate-limiting requests (HTTP 429). This is an access restriction, not a "
                    "paywall. Try again later or use the publisher's official website."
                ),
                evidence=[f"HTTP {status_code} response from the publisher.", *challenge_evidence],
            )

        if challenge_evidence:
            return AccessAssessment(
                status=AccessStatus.ACCESS_CHALLENGE,
                confidence=Confidence.HIGH,
                explanation=(
                    "The publisher presented an automated access challenge. Ghost Reader does not solve captchas, "
                    "use stealth techniques or evade anti-bot protections. The article was not extracted."
                ),
                evidence=challenge_evidence,
            )

        if status_code in {403, 451}:
            if substantial and not paywall_evidence and not login_evidence:
                return AccessAssessment(
                    status=AccessStatus.ACCESS_CHALLENGE,
                    confidence=Confidence.MEDIUM,
                    explanation=(
                        f"The publisher returned HTTP {status_code}. A body was present, but HTTP refusals are "
                        "ambiguous and are not treated as a successful article retrieval. This may be regional "
                        "restriction, bot protection or a policy-based refusal — not necessarily a paywall."
                    ),
                    evidence=[f"HTTP {status_code} response from the publisher.", *evidence],
                )
            return AccessAssessment(
                status=AccessStatus.ACCESS_CHALLENGE,
                confidence=Confidence.MEDIUM,
                explanation=(
                    f"The publisher refused the request with HTTP {status_code}. This may be bot protection, a "
                    "regional restriction or a policy decision. An HTTP refusal alone is not proof of a paywall."
                ),
                evidence=[
                    f"HTTP {status_code} response from the publisher.",
                    *paywall_evidence,
                    *login_evidence,
                ],
            )

        if status_code == 404:
            return AccessAssessment(
                status=AccessStatus.FETCH_FAILED,
                confidence=Confidence.HIGH,
                explanation="The publisher returned HTTP 404. The page may have moved or no longer exists.",
                evidence=["HTTP 404 response from the publisher."],
            )
        if status_code >= 500:
            return AccessAssessment(
                status=AccessStatus.FETCH_FAILED,
                confidence=Confidence.HIGH,
                explanation=(
                    f"The publisher returned HTTP {status_code}. This is a technical server-side failure, "
                    "not an indication that the article is restricted or paywalled."
                ),
                evidence=[f"HTTP {status_code} response from the publisher."],
            )

        if substantial:
            evidence.extend(paywall_evidence)
            if paywall_evidence:
                evidence.append(
                    "A substantial article body was still publicly available despite restriction indicators."
                )
            return AccessAssessment(
                status=AccessStatus.PUBLIC_FULL,
                confidence=Confidence.HIGH,
                explanation=(
                    "A substantial, structured article body was publicly available and extracted. "
                    + (
                        "The page also contains paywall indicators, which may affect other visitors or later requests."
                        if paywall_evidence
                        else ""
                    )
                ).strip(),
                evidence=evidence or ["Article body successfully extracted from public HTML."],
            )

        strong_paywall_evidence = (
            metadata.is_accessible_for_free is False
            or bool(signals.paywall_structural)
            or (metadata.content_tier or "").lower() in {"locked", "premium", "subscriber"}
        )
        if login_evidence and not strong_paywall_evidence:
            return AccessAssessment(
                status=AccessStatus.LOGIN_REQUIRED,
                confidence=Confidence.MEDIUM,
                explanation=(
                    "The page appears to require an authenticated session to read the full article. Ghost Reader "
                    "does not collect publisher logins, cookies or session tokens."
                ),
                evidence=login_evidence,
            )

        if paywall_evidence:
            status = AccessStatus.PUBLIC_PARTIAL if preview else AccessStatus.SUBSCRIPTION_REQUIRED
            explanation = (
                "A public preview was extracted, but the publisher indicates that the complete article requires a "
                "subscription. Ghost Reader displays only the content that was publicly delivered."
                if preview
                else "The publisher indicates that reading the complete article requires a subscription. "
                "Ghost Reader cannot retrieve subscriber-only content."
            )
            return AccessAssessment(
                status=status,
                confidence=Confidence.MEDIUM if metadata.is_accessible_for_free is None else Confidence.HIGH,
                explanation=explanation,
                evidence=paywall_evidence,
            )

        if login_evidence:
            return AccessAssessment(
                status=AccessStatus.LOGIN_REQUIRED,
                confidence=Confidence.MEDIUM,
                explanation=(
                    "The page appears to require an authenticated session to read the full article. Ghost Reader "
                    "does not collect publisher logins, cookies or session tokens."
                ),
                evidence=login_evidence,
            )

        if signals.js_phrases or (signals.js_structural and not preview):
            return AccessAssessment(
                status=AccessStatus.JS_REQUIRED,
                confidence=Confidence.MEDIUM,
                explanation=(
                    "The publicly accessible page appears to require JavaScript rendering before the article body "
                    "is available. Ghost Reader only uses an isolated browser fallback when it is enabled and safe."
                ),
                evidence=evidence or ["The page relies on JavaScript to render its main content."],
            )

        if preview:
            return AccessAssessment(
                status=AccessStatus.PUBLIC_PARTIAL,
                confidence=Confidence.LOW,
                explanation=(
                    "Only a limited amount of article text could be identified. It may be a preview, an excerpt or "
                    "an unusually short page. Ghost Reader does not treat this as a complete article."
                ),
                evidence=[
                    "A small amount of article text was extracted, but not enough to confirm completeness."
                ],
            )

        return AccessAssessment(
            status=AccessStatus.UNSUPPORTED,
            confidence=Confidence.MEDIUM,
            explanation=(
                "The page was retrieved, but Ghost Reader could not identify a reliable article body. It may be an "
                "index page, a viewer that renders content dynamically, or a format that is not supported."
            ),
            evidence=["No substantial article body was found in the publicly delivered HTML."],
        )


_PASSWORD_INPUT_RE = re.compile(r"<input[^>]+type=[\"']?password", re.IGNORECASE)


def page_has_password_form(html: str) -> bool:
    return bool(_PASSWORD_INPUT_RE.search(html))
