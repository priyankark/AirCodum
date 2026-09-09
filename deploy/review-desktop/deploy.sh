#!/bin/bash
# Creates a new billable VM. Run only after the account owner approves hosting.
set -euo pipefail
umask 077
: "${REVIEW_AZURE_SUBSCRIPTION:?Set the approved Azure subscription ID}"
: "${REVIEW_DNS_LABEL:?Set a unique lowercase DNS label}"
: "${REVIEW_STATE_DIR:?Set a private local directory outside the repository}"
review_location="${REVIEW_AZURE_LOCATION:-eastus}"
review_group="${REVIEW_RESOURCE_GROUP:-aircodum-review-rg}"
review_vm=aircodum-review
review_source="$(cd "$(dirname "$0")" && pwd)"
az_review() { az "$@" --subscription "$REVIEW_AZURE_SUBSCRIPTION" --only-show-errors; }
if [[ "$(az_review group exists --name "$review_group" -o tsv)" != false ]]; then
  echo 'Refusing to modify an existing resource group. Inspect it and resume manually.' >&2
  exit 1
fi
mkdir -p "$REVIEW_STATE_DIR"
chmod 0700 "$REVIEW_STATE_DIR"
if [[ ! -f "$REVIEW_STATE_DIR/admin.pub" ]]; then
  ssh-keygen -q -t rsa -b 3072 -N '' -f "$REVIEW_STATE_DIR/admin"
fi
python3 "$review_source/prepare.py" \
  --hostname "$REVIEW_DNS_LABEL.$review_location.cloudapp.azure.com" \
  --output "$REVIEW_STATE_DIR/cloud-init.json"
az_review group create --name "$review_group" --location "$review_location" \
  --tags purpose=aircodum-store-review -o none
az_review network nsg create -g "$review_group" -n aircodum-review-nsg -o none
az_review network nsg rule create -g "$review_group" --nsg-name aircodum-review-nsg \
  -n public-tls --priority 100 --access Allow --protocol Tcp --direction Inbound \
  --source-address-prefixes Internet --destination-port-ranges 80 443 -o none
az_review vm create -g "$review_group" -n "$review_vm" --location "$review_location" \
  --image Ubuntu2204 --size Standard_B2s --admin-username reviewadmin \
  --ssh-key-values "$REVIEW_STATE_DIR/admin.pub" --authentication-type ssh \
  --nsg aircodum-review-nsg --nsg-rule NONE --public-ip-sku Standard \
  --public-ip-address-dns-name "$REVIEW_DNS_LABEL" \
  --storage-sku Standard_LRS --os-disk-size-gb 32 \
  --custom-data "$REVIEW_STATE_DIR/cloud-init.json" \
  --tags purpose=aircodum-store-review -o json > "$REVIEW_STATE_DIR/deployment.json"
echo 'VM provisioned; cloud-init and HTTPS readiness still need verification.'
echo 'No public SSH, RDP, X11 or raw WebSocket port was opened.'
echo 'Inspect cloud-init through Azure Run Command, then retrieve the private pairing file.'
