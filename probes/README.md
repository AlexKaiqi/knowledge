# Probes

```text
probes/
├── definitions/   repeatable ProbeDefinition
├── identities/    opaque metadata and credential refs only
└── pools/         selection, quota, cooldown and isolation policy
```

真实身份清单和秘密保存在仓库外的 credential/runtime store。通过且脱敏的验证结论发布到 `knowledge/verifications/`。
