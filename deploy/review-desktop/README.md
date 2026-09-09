# Always-on review desktop

Prepared to resolve the Google Play build 28 rejection for missing reusable access.
This is **not deployed or E2E-validated yet**. Do not submit placeholder credentials.

The host runs the published, hash-verified AirCodum 0.2.0 VSIX in VS Code 1.121.0
on Ubuntu 22.04 x64, with a 1280×800 Xvfb/Openbox desktop. A companion extension
starts the normal server and opens a disposable sample file. It copies the normal
pairing token into an owner-only file for the administrator to retrieve. There is
no special mobile build, reviewer detection, authentication bypass, or mock server.

The review user has no sudo access. This must be a separate VM containing no
personal workspaces, cloud identities, provider keys or production credentials.
Only TCP 80/443 are publicly reachable. Caddy obtains and renews TLS certificates
and forwards WebSocket upgrades/Authorization to loopback port 11040. VS Code
and the pairing token persist across service restarts and reboots. The desktop
service restarts on failure. Keep the host and credentials available for ongoing
store reviews; a temporary laptop tunnel does not meet that requirement.

## Cost and deployment

The prepared deployment creates a new Azure resource group, isolated virtual
network, Standard public IPv4/DNS name, 32 GB managed disk and Standard_B2s VM.
VM-only retail pricing checked September 9, 2026 is USD 0.0416/hour in eastus and westus2
(about USD 30.37 per 730-hour month). Disk, IPv4 and network usage are additional;
budget approximately USD 40/month before tax, subject to region/pricing and traffic.
The script defaults to eastus; the subscription currently has available regional and B-series vCPU quota. Availability still needs checking at deployment.
No resource is created merely by preparing or committing these files.

After the owner approves new recurring hosting:

```sh
export REVIEW_AZURE_SUBSCRIPTION='<approved subscription ID>'
export REVIEW_DNS_LABEL='<unique DNS label>'
export REVIEW_STATE_DIR='<private absolute path outside the repository>'
bash deploy/review-desktop/deploy.sh
```

The script refuses an existing resource group rather than modifying other apps.
If provisioning partially fails, inspect and resume the dedicated group manually;
do not delete unrelated resources. Manage the VM through Azure Run Command, since
SSH is not publicly exposed. Private credentials are at
`/home/reviewer/.local/state/aircodum-review/connection.json` on the VM. Save Run
Command responses containing them in a private local file; never commit them.
Do not delete the VS Code profile or rotate its token while access is under review.

## Required checks before resubmission

1. Confirm `cloud-init status --wait`, both services, and certificate validation.
2. From outside the VM, reject an incorrect token; accept the correct token over
   `wss://<DNS name>:443` and receive real capabilities and JPEG frames.
3. Use the production build 28-derived Android APK to connect to that public DNS
   address. Test command mode, actual VNC pointer/input, local draft Send/Enter,
   file/image transfer, background/foreground and reconnect. Validate optional
   provider features separately; no provider key is provisioned by this template.
4. Restart the desktop service, then reboot the VM. Confirm the same token still
   works and normal input/capture recover. Check reuse from a second session.
5. Put the real hostname, port 443, TLS (wss) option and pairing token in Play
   Console **App access / Sign in details**. Explain there is no username/account
   sign-in, and reviewers need no local PC, VPN, registration or one-time code.
   Include plain English steps for all available functionality and disclose the
   optional provider configuration accurately.
6. Update Apple review access notes with the same verified resource. Then save
   and resubmit Google Play changes; an unchanged build 28 can be reused for this
   access-only rejection unless further testing finds an app defect.

References: [Google access requirements](https://support.google.com/googleplay/android-developer/answer/15748846),
[Azure pricing API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices),
[Azure VM CLI](https://learn.microsoft.com/en-us/cli/azure/vm),
[Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).
