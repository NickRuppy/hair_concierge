"""Replay entry point for the v1.6.2 test-round check: resolves every input relative to this file,
so it checks the pinned copies next to it (data/research/shampoo-inci/v1.6.2/test-round/) and not the
planning corpus. check-preregistration.py is kept unchanged as the historical script that produced
preregistration-check.txt."""
import os,runpy
here=os.path.dirname(os.path.abspath(__file__))
src=open(os.path.join(here,"check-preregistration.py")).read().replace('T="plans/shampoo-v162/test"; K=f"{T}/kit"',f'T={here!r}; K=f"{{T}}/kit"')
assert here in src
exec(compile(src,"check-preregistration.py (replay)","exec"))
