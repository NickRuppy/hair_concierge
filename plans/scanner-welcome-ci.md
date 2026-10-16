# Scanner welcome acknowledgement above camera fallback

## Decision and scope

When `/scan?welcome=scan` opens on a device without an available camera, the scanner
correctly opens its search fallback. Its `BottomSheet` backdrop is z-50 and previously
intercepted the one-time `Verstanden` acknowledgement, which is a sibling of the scanner
flow. The acknowledgement must remain reachable while the fallback stays open.

The repair portals the acknowledgement directly under body above the fallback backdrop
and uses the modal manager's existing `data-modal-layer-exempt` contract. The hint stays
nonblocking: both a working camera and the fallback sheet remain usable before dismissal.
CSS stacking alone cannot restore pointer access because the manager makes ordinary body
children inert. A trial that registered the hint as a new modal was rejected during main
review: it would turn an optional greeting into a mandatory step. Camera fallback state,
analytics and session storage stay unchanged. A flow spacer preserves the original
header clearance; empty parts of the portaled hint pass through pointer events. The
working-camera check also exercises the header bookmark before dismissal, with the
Lab welcome layout matching the production header geometry.

## Verification

- CI run 38898758447, job 116965636660 reproduces the blocked click with the open
  bottom-sheet backdrop as the intercepting element.
- `/labs/scan?welcome=scan` mounts the same acknowledgement beside the real flow. A
  forced camera denial previously produced the same backdrop interception locally; its
  focused Chromium regression passes after the repair.
- The existing live Scanner journey remains the production-path coverage. The local
  focused attempt is blocked before `/scan` by an unrelated funnel-session assertion;
  rerun that exact journey in CI after the patch.
