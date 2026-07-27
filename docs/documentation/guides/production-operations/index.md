---
label: Production Operations
order: 100
---

# Production Operations

These guides are for VyDex maintainers authorized to operate the protected Cloudflare Pages production workflow. Both tasks can change the live site and require the intended release and deployment identities to be confirmed before approval.

## Choose The Correct Task

- Use [How To Rehearse The Production Rollback](how-to-rehearse-production-rollback.md) after the deployment or rollback mechanism changes, or when another rehearsal has been explicitly approved. This is a controlled verification task, not routine deployment work.
- Use [How To Restore A Production Deployment](how-to-restore-production-deployment.md) only when production must return to a known-good deployment after an unsuccessful release or failed automatic restoration. This is the emergency recovery path.

Do not begin either task while another deployment, rollback, restoration, or production incident is active. If a rehearsal cannot restore the intended deployment, stop the rehearsal flow and use the restoration guide with the preserved deployment ID and workflow evidence.

## Related Concepts

- [Deployment And Verification](../../concepts/deployment-and-verification/)
- [Cloudflare Pages Deployment](../../concepts/deployment-and-verification/cloudflare-pages-deployment.md)
- [Hosted Release Verification](../../concepts/deployment-and-verification/hosted-release-verification.md)
