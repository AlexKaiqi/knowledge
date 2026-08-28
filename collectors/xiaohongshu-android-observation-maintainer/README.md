# Xiaohongshu Android observation Maintainer

This proposal-only Collector watches the two audited mobile-observation upstreams, their fixed protocol/license evidence, local Android device readiness, the explicit probe-identity boundary and verification freshness.

It never installs an APK, Android system image, Appium driver or third-party project; enables Accessibility; starts a cloud/reverse connection; logs in; changes an identity; runs the live probe; switches routes; or admits public knowledge. Repository-head, protocol, license or local-device changes produce review proposals only.

The Android device inspection returns aggregate state only. ADB serials, model identifiers, account details, runtime tokens and Appium session IDs are neither returned nor written.
