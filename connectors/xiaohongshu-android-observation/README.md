# Xiaohongshu Android observation candidate

This hidden candidate tests whether a manually authenticated Xiaohongshu Android app can expose useful public-search evidence through structured UI state instead of screenshot-first automation. It does not enter the public OKF route and does not make Xiaohongshu public search a verified capability.

The first vertical slice is deliberately narrow: launch the fixed Xiaohongshu package, locate the search control from the current semantic tree, enter one bounded query, and return a bounded projection of visible result text. It does not yet open notes, paginate, read comments, estimate trends, interact with content, or write to the platform.

## Routes

- `portal-http` talks only to a loopback-forwarded Mobilerun Portal HTTP service. Portal stays an independent AGPL-3.0-or-later device application; this repository contains an independently implemented adapter to its documented public protocol and copies no Portal source.
- `appium-w3c` talks only to a loopback Appium W3C session. It reads XML page source and uses W3C element/action endpoints. WebView context switching is intentionally not automatic: a production third-party WebView often does not expose a debuggable context, and changing context without a probe-specific assertion would hide coverage drift.

Both routes normalize their upstream tree into the same private node representation. The candidate result contains only bounded visible text and coverage facts; coordinates, resource IDs, selectors, tokens, session IDs, raw XML/JSON and route identity stay hidden.

## Safety boundary

- Use a dedicated emulator or owned probe device, never a daily-use phone.
- Login is manual and visible. The Connector never receives a password, cookie, SMS code or QR payload.
- Runtime origins must be exact loopback HTTP origins. A remote Portal/Appium server is rejected.
- Portal reverse connection, cloud tasks, APK installation, file, clipboard, notification and streaming endpoints are outside this Connector.
- The Connector performs no likes, follows, comments, messages, publication or account changes.
- Screenshot and vision are not used by this slice.

The live probe remains blocked until an Android device is attached, the user approves the dedicated device/profile, and the existing probe identity is explicitly extended to the candidate capability. Passing unit tests proves only local protocol conformance.
