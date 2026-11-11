from __future__ import annotations

import hashlib
import hmac
import time
from dataclasses import dataclass

from bs4 import BeautifulSoup

from app.core.config import Settings
from app.schemas.security_lab import ScenarioInfo, ScenarioRunResult
from app.services.access_assessor import AccessAssessor, page_has_password_form
from app.services.article_extractor import ArticleExtractor
from app.services.metadata_extractor import MetadataExtractor

_DEMO_ARTICLE = """
<!doctype html>
<html lang="en">
<head>
  <title>City Library Extends Weekend Hours</title>
  <meta property="og:title" content="City Library Extends Weekend Hours">
  <meta property="og:description" content="A public-interest article used in the Ghost Reader security lab.">
  <meta property="og:site_name" content="Ghost Reader Lab Gazette">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": "City Library Extends Weekend Hours",
    "author": {"@type": "Person", "name": "Lab Reporter"},
    "datePublished": "2026-01-12T09:00:00Z",
    "publisher": {"@type": "Organization", "name": "Ghost Reader Lab Gazette"}
  }
  </script>
</head>
<body>
<nav>Home | World | Business | Sport</nav>
<article>
  <h1>City Library Extends Weekend Hours</h1>
  <p>The city library will remain open until eight in the evening on Saturdays and Sundays from next month.</p>
  <p>Officials said the change follows a public consultation in which residents asked for more weekend access.</p>
  <p>The extension applies to the central branch and two neighbourhood libraries, with quiet study areas available.</p>
  <p>Library membership remains free, and the digital archive will also be available during the extended hours.</p>
  <p>Staff will be recruited over the coming weeks to cover the additional shifts.</p>
</article>
<footer>© Ghost Reader Lab Gazette</footer>
</body>
</html>
"""

_CLIENT_SIDE_ONLY = """
<!doctype html>
<html lang="en"><head><title>Client-side-only demo</title></head>
<body>
<div class="article">
  <h1>Visible headline</h1>
  <p>This paragraph is shown to every visitor.</p>
  <div class="protected-content">
    <p>Synthetic protected sentence one. This text is hidden only with a CSS display rule.</p>
    <p>Synthetic protected sentence two. It is still delivered in the public HTML response.</p>
    <p>Synthetic protected sentence three. A browser script could reveal it without the server checking access.</p>
  </div>
  <script>
    document.querySelectorAll('.protected-content').forEach(function (node) {
      node.style.display = 'none';
    });
  </script>
</div>
</body></html>
"""

_METADATA_ONLY = """
<!doctype html>
<html lang="en">
<head>
  <title>Premium Investigation</title>
  <meta property="og:title" content="Premium Investigation">
  <meta property="og:description" content="A short public summary of an investigation that requires a subscription.">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": "Premium Investigation",
    "description": "A short public summary of an investigation that requires a subscription.",
    "isAccessibleForFree": false,
    "publisher": {"@type": "Organization", "name": "Lab Gazette"},
    "articleBody": "Synthetic subscriber-only body that must not be rendered as public article content."
  }
  </script>
</head>
<body>
<article>
  <h1>Premium Investigation</h1>
  <p>A short public summary of an investigation that requires a subscription.</p>
  <div class="paywall"><p>Subscribe to continue reading.</p></div>
</article>
</body></html>
"""

_LOGIN_ONLY = """
<!doctype html>
<html lang="en">
<head><title>Members page</title></head>
<body>
<article>
  <h1>Members page</h1>
  <p>Sign in to continue reading this synthetic demonstration page.</p>
  <form><input type="email" name="email"><input type="password" name="password"></form>
</article>
</body></html>
"""

_VALID_DEMO_TOKEN = "lab-valid-session-token"
_DOCUMENT_BODY = "Synthetic private document body for the secure delivery scenario."


@dataclass
class _ScenarioDefinition:
    info: ScenarioInfo
    runner_key: str


class SecurityLab:
    def __init__(
        self,
        settings: Settings,
        metadata_extractor: MetadataExtractor,
        article_extractor: ArticleExtractor,
        assessor: AccessAssessor,
    ) -> None:
        self.settings = settings
        self.metadata_extractor = metadata_extractor
        self.article_extractor = article_extractor
        self.assessor = assessor

    def scenarios(self) -> list[ScenarioInfo]:
        return [definition.info for definition in self._definitions()]

    def _definitions(self) -> list[_ScenarioDefinition]:
        return [
            _ScenarioDefinition(
                info=ScenarioInfo(
                    id="public-content",
                    title="Public content and honest extraction",
                    category="Public access",
                    summary=(
                        "A synthetic article is publicly accessible. Ghost Reader extracts only the article body, "
                        "metadata and public images."
                    ),
                    expected_result=(
                        "The synthetic article should be classified PUBLIC_FULL with structured content and "
                        "navigation removed."
                    ),
                    security_implications=[
                        "Publicly available content can be read without authentication.",
                        "Extraction should not invent missing fields or include site navigation as article text.",
                    ],
                    mitigation=[
                        "Publishers should mark teammate-only content with server-side authorisation.",
                        "Content consumers should preserve attribution and respect publisher terms.",
                    ],
                ),
                runner_key="public",
            ),
            _ScenarioDefinition(
                info=ScenarioInfo(
                    id="client-side-restriction",
                    title="Client-side-only restriction is not access control",
                    category="Access control",
                    summary=(
                        "A synthetic page hides text with CSS and JavaScript, but the same text is delivered in the "
                        "HTML response. This demonstrates why hiding content in the browser is not protection."
                    ),
                    expected_result=(
                        "The hidden synthetic text should still be present in the HTML source, proving that "
                        "client-side hiding does not enforce authorisation."
                    ),
                    security_implications=[
                        "Anyone who can view source or disable JavaScript can see content delivered to the browser.",
                        "CSS classes, disabled buttons and client-side route guards are not security boundaries.",
                    ],
                    mitigation=[
                        "Authorise every request on the server before returning protected content.",
                        "Deliver only the fields the current user is authorised to receive.",
                    ],
                ),
                runner_key="client_side",
            ),
            _ScenarioDefinition(
                info=ScenarioInfo(
                    id="server-side-protection",
                    title="Server-side authorisation",
                    category="Access control",
                    summary=(
                        "A local simulation compares an unauthenticated request with a request carrying a valid "
                        "demonstration session. Protected content is returned only after server-side validation."
                    ),
                    expected_result=(
                        "An unauthorised request should receive HTTP 401 with no document body. A valid demo session "
                        "should receive HTTP 200 with the synthetic protected body."
                    ),
                    security_implications=[
                        "Server-side checks are the actual access-control boundary.",
                        "Session validation must happen on every protected request, not only at the login screen.",
                    ],
                    mitigation=[
                        "Use a trusted server-side session or token validation library.",
                        "Default to deny when a session is missing, expired or invalid.",
                    ],
                ),
                runner_key="server_side",
            ),
            _ScenarioDefinition(
                info=ScenarioInfo(
                    id="metadata-exposure",
                    title="Metadata can be public while the article body is restricted",
                    category="Information exposure",
                    summary=(
                        "A synthetic paywalled page exposes a headline and summary in Open Graph and JSON-LD "
                        "metadata while the article body is restricted."
                    ),
                    expected_result=(
                        "Ghost Reader should expose only the public title, description and restriction evidence. "
                        "It must not render the synthetic subscriber-only body from articleBody metadata."
                    ),
                    security_implications=[
                        "Metadata is often public and can reveal topics, authors and publication times.",
                        "Including full body text in client-visible metadata can leak restricted content.",
                    ],
                    mitigation=[
                        "Keep subscriber-only text out of public metadata and client payloads.",
                        "Review JSON-LD and Open Graph fields as part of content security reviews.",
                    ],
                ),
                runner_key="metadata",
            ),
            _ScenarioDefinition(
                info=ScenarioInfo(
                    id="secure-document-delivery",
                    title="Secure temporary document delivery",
                    category="Document security",
                    summary=(
                        "A local simulation shows an HMAC-signed, expiring document capability URL. An expired link "
                        "is rejected, while a fresh link is accepted."
                    ),
                    expected_result=(
                        "The expired signature should be rejected with HTTP 403 and the valid signature should be "
                        "accepted with HTTP 200."
                    ),
                    security_implications=[
                        "Opaque expiring links reduce the exposure window for private documents.",
                        "Signatures must be validated server-side and bound to the document and expiry time.",
                    ],
                    mitigation=[
                        "Use short expiries, server-side authorisation and signed URLs for document delivery.",
                        "Never rely on unguessable filenames alone as an access-control mechanism.",
                    ],
                ),
                runner_key="document_delivery",
            ),
        ]

    def run(self, scenario_id: str) -> ScenarioRunResult:
        started = time.perf_counter()
        definitions = {definition.info.id: definition for definition in self._definitions()}
        definition = definitions.get(scenario_id)
        if definition is None:
            raise KeyError(scenario_id)
        handlers = {
            "public": self._run_public,
            "client_side": self._run_client_side,
            "server_side": self._run_server_side,
            "metadata": self._run_metadata,
            "document_delivery": self._run_document_delivery,
        }
        result = handlers[definition.runner_key](definition.info)
        result.duration_ms = int((time.perf_counter() - started) * 1000)
        return result

    def _analyse_html(self, html: str) -> str:
        metadata = self.metadata_extractor.extract(html, base_url="https://lab.ghostreader.invalid/")
        extraction = self.article_extractor.extract(
            html, base_url="https://lab.ghostreader.invalid/", title=metadata.title
        )
        assessment = self.assessor.assess(
            status_code=200,
            html=html,
            metadata=metadata,
            extraction=extraction,
            content_type="text/html",
            has_password_form=page_has_password_form(html),
        )
        return assessment.status.value

    def _run_public(self, info: ScenarioInfo) -> ScenarioRunResult:
        metadata = self.metadata_extractor.extract(_DEMO_ARTICLE, base_url="https://lab.ghostreader.invalid/")
        extraction = self.article_extractor.extract(
            _DEMO_ARTICLE, base_url="https://lab.ghostreader.invalid/", title=metadata.title
        )
        assessment = self.assessor.assess(
            status_code=200,
            html=_DEMO_ARTICLE,
            metadata=metadata,
            extraction=extraction,
            content_type="text/html",
        )
        navigation_present = any("Home | World" in (block.text or "") for block in extraction.blocks)
        return ScenarioRunResult(
            scenario_id=info.id,
            title=info.title,
            expected=info.expected_result,
            observed=(
                f"Status {assessment.status.value}; {extraction.word_count} words extracted; "
                f"publisher metadata present: {'yes' if metadata.publisher else 'no'}; "
                f"navigation included as article text: {'yes' if navigation_present else 'no'}."
            ),
            evidence=[
                f"Access assessment: {assessment.explanation}",
                f"Extractor used: {extraction.extractor}",
                f"Structured blocks produced: {len(extraction.blocks)}",
            ],
            explanation=(
                "The synthetic article is delivered publicly, so extraction succeeds. The navigation block was "
                "excluded, and the result reports only content grounded in the synthetic source."
            ),
            security_implications=info.security_implications,
            mitigation=info.mitigation,
            simulated_status=200,
        )

    def _run_client_side(self, info: ScenarioInfo) -> ScenarioRunResult:
        soup = BeautifulSoup(_CLIENT_SIDE_ONLY, "lxml")
        hidden = soup.select_one(".protected-content")
        hidden_text = hidden.get_text(" ", strip=True) if hidden else ""
        extraction = self.article_extractor.extract(
            _CLIENT_SIDE_ONLY, base_url="https://lab.ghostreader.invalid/"
        )
        return ScenarioRunResult(
            scenario_id=info.id,
            title=info.title,
            expected=info.expected_result,
            observed=(
                f"{len(hidden_text.split())} words are present in the public HTML inside .protected-content, even "
                f"though a client script sets display:none. The extraction pipeline found "
                f"{extraction.word_count} words in total."
            ),
            evidence=[
                f"Synthetic hidden text remains in the response: “{hidden_text[:140]}…”",
                "No authentication or authorisation check exists in this synthetic page.",
                "The hiding mechanism is a CSS rule applied by a client-side script.",
            ],
            explanation=(
                "Client-side hiding changes presentation, not access. The server sent the protected sentences to "
                "every client, so any client that ignores or removes the script can read them."
            ),
            security_implications=info.security_implications,
            mitigation=info.mitigation,
            simulated_status=200,
        )

    def _authorize(self, token: str | None) -> int:
        if not token:
            return 401
        if not hmac.compare_digest(token, _VALID_DEMO_TOKEN):
            return 401
        return 200

    def _run_server_side(self, info: ScenarioInfo) -> ScenarioRunResult:
        unauthorised = self._authorize(None)
        valid = self._authorize(_VALID_DEMO_TOKEN)
        invalid = self._authorize("not-a-real-token")
        return ScenarioRunResult(
            scenario_id=info.id,
            title=info.title,
            expected=info.expected_result,
            observed=(
                f"Without a session: HTTP {unauthorised} and no body. With an invalid session: HTTP {invalid}. "
                f"With the demonstration session: HTTP {valid} and the synthetic document body was returned."
            ),
            evidence=[
                "The authorisation decision is made on the local server before content is assembled.",
                "The unauthorised responses contain no protected body.",
                "The demonstration token is a local fixture and is not a real credential.",
            ],
            explanation=(
                "This simulation demonstrates the correct control: protected content is only assembled after the "
                "server validates the session. A login form alone is not sufficient."
            ),
            security_implications=info.security_implications,
            mitigation=info.mitigation,
            simulated_status=unauthorised,
        )

    def _run_metadata(self, info: ScenarioInfo) -> ScenarioRunResult:
        metadata = self.metadata_extractor.extract(
            _METADATA_ONLY, base_url="https://lab.ghostreader.invalid/"
        )
        extraction = self.article_extractor.extract(
            _METADATA_ONLY, base_url="https://lab.ghostreader.invalid/", title=metadata.title
        )
        assessment = self.assessor.assess(
            status_code=200,
            html=_METADATA_ONLY,
            metadata=metadata,
            extraction=extraction,
            content_type="text/html",
            has_password_form=page_has_password_form(_METADATA_ONLY),
        )
        body_leaked = "Synthetic subscriber-only body" in extraction.text
        return ScenarioRunResult(
            scenario_id=info.id,
            title=info.title,
            expected=info.expected_result,
            observed=(
                f"Status {assessment.status.value}; title “{metadata.title}” and public description were detected; "
                f"articleBody metadata present: {'yes' if metadata.has_article_body_ld else 'no'}; "
                f"subscriber-only body rendered as content: {'yes' if body_leaked else 'no'}."
            ),
            evidence=[
                f"Access assessment: {assessment.explanation}",
                "Ghost Reader uses articleBody metadata only as evidence of expected length; it is never rendered.",
                "Only the public title, description and restriction explanation are available to the reader screen.",
            ],
            explanation=(
                "Public metadata can legitimately reveal the existence and summary of a restricted article. Ghost "
                "Reader stops at that public boundary and does not display the synthetic subscriber-only body."
            ),
            security_implications=info.security_implications,
            mitigation=info.mitigation,
            simulated_status=200,
        )

    def _document_signature(self, document_id: str, expires: int) -> str:
        message = f"{document_id}\n{expires}".encode()
        return hmac.new(self.settings.secret_key.encode(), message, hashlib.sha256).hexdigest()

    def _document_access(self, document_id: str, expires: int, signature: str) -> int:
        if expires < int(time.time()):
            return 403
        expected = self._document_signature(document_id, expires)
        if not hmac.compare_digest(expected, signature):
            return 403
        return 200

    def _run_document_delivery(self, info: ScenarioInfo) -> ScenarioRunResult:
        document_id = "lab-document-001"
        expired = int(time.time()) - 60
        fresh = int(time.time()) + 300
        expired_status = self._document_access(
            document_id, expired, self._document_signature(document_id, expired)
        )
        valid_status = self._document_access(document_id, fresh, self._document_signature(document_id, fresh))
        tampered_status = self._document_access(document_id, fresh, "0" * 64)
        return ScenarioRunResult(
            scenario_id=info.id,
            title=info.title,
            expected=info.expected_result,
            observed=(
                f"Expired signed link: HTTP {expired_status}. Tampered signature: HTTP {tampered_status}. "
                f"Fresh signed link: HTTP {valid_status}; {len(_DOCUMENT_BODY.split())} words of synthetic content "
                "would be returned by the authorised path."
            ),
            evidence=[
                "The capability is bound to a document identifier and an expiry timestamp.",
                "The server recomputes the HMAC signature and uses a constant-time comparison.",
                "No real document or credential is involved.",
            ],
            explanation=(
                "Expiring signed links are a useful defence-in-depth measure for temporary document delivery. They "
                "supplement, but do not replace, normal server-side authorisation."
            ),
            security_implications=info.security_implications,
            mitigation=info.mitigation,
            simulated_status=expired_status,
        )
