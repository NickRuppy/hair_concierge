# Targeted debugging techniques

Load only the branch matching the observed failure.

## Component-boundary map

For a multi-component path, record at each boundary:

- the input identity, shape, and important values;
- the output or side effect;
- configuration, credentials, environment, and state propagation;
- the first boundary where expected and observed behavior diverge.

Instrument the narrowest boundaries that distinguish the ranked hypotheses. Run once, locate the failing component, then investigate inside it. Remove temporary instrumentation after verification.

## Condition-based waiting

For asynchronous or flaky behavior, wait for the observable event, state, count, file, or response—not a guessed delay. Poll with a finite timeout and an error naming the unmet condition; read fresh state inside the loop.

An arbitrary wait is justified only when elapsed time is the behavior under test, such as debounce or retry cadence. First wait for the triggering condition, base the duration on a known interval, and document why it proves the timing contract.

## Conditional defense in depth

After tracing invalid data or a dangerous operation to its source, map alternate paths that could bypass the source fix. Add secondary validation only at boundaries with a distinct responsibility, such as external input, domain invariants, or irreversible operations. Test at least one bypass path. Do not duplicate the same policy at every layer or leave permanent forensic logging without an operational need.
