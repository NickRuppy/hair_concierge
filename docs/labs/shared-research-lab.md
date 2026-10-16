# Shared research review lab

The canonical development entry is `/labs/research`. It uses the approved Mask review layout: immediate causal explanation, named INCI ingredients, separate saved lane values/confidence, expandable original evidence, adjacent review actions and explicit completion confirmation.

| Category    | Source and review authority                                              | Important distinction                                                                                                                     |
| ----------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Masks       | Existing Mask research loader and review handler                         | Reference A plus formula-bound saved blind B; different method versions stay marked incomparable                                          |
| Shampoo     | Native pilot, wave-01 and wave-02 datasets and handler                   | Formula, eight properties and projection must be approved before completion; historical v1.4 lanes remain distinct from v1.5 focus values |
| Conditioner | Existing accepted profiles, calibration and review handler               | Historical blind review is not another current agent; confidence was not stored                                                           |
| Leave-in    | Existing gold-set/unseen fixtures and review handler                     | Effective v1.2 includes source-bound heat activation; one actual saved lane; historical versions stay distinct                                      |
| Oil         | Native resolved corpus or current intake packages and oil review journal | [Oil Lab](oil-research-lab.md): manual matching, exact receipt import, local review without catalog publication                           |

A category adapter translates existing saved data and native allowed actions into a serializable display model. It does not rerun research, alter classification standards, create missing confidence, or introduce a shared approval store. Adding a category requires an executable saved-data and review contract; Bondbuilder currently lacks a review API and remains explicitly unavailable.

All new routes/API endpoints require `NODE_ENV=development`. Shared POST reloads the displayed evidence, validates a content fingerprint, resolves the requested action server-side, and delegates to the native handler. Native fingerprint/rework/rollback rules remain authoritative. Refresh failure after a successful write is shown as saved; further actions wait for a successful read. Late responses cannot replace a newer product selection or draft.

The approved HASK short explanations are display-only and pinned to exact reference/blind source hashes. Other stored explanations remain in their original language with originals accessible. Expanding reviewed German summaries to more products is separate editorial work, never silent regeneration of scientific conclusions.

Existing `/labs/mask-research`, `/labs/shampoo-research`, `/labs/conditioner-research`, `/labs/leave-in-research` and `/labs/agent-compare` remain available and unchanged. Specialized calibration/audit views remain accessible through the category legacy link. Future retirement requires its own inventory and authorization.

For verification, use isolated native store overrides for Mask/Conditioner/Leave-in and copied Shampoo artifacts. Shampoo's native HTTP handler has no storage override; do not perform browser save checks against checked-in pilot/wave review files. Shared API integration tests copy artifacts into temporary directories before loading the handlers.
