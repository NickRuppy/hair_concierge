# Source manifest — Shampoo INCI v1.3

## Capture record

| Field | Value |
| --- | --- |
| Capture date | 2026-08-10 |
| Source label in supplied text | Shampoo Research Package v1.3 — Explainable Matching |
| Source form | User-provided pasted text attachment |
| Attachment ID 1 | `6b5c0f14-c27a-4d46-9a23-c858fb877ad2` |
| Attachment path 1 | `/Users/nick/.codex/attachments/6b5c0f14-c27a-4d46-9a23-c858fb877ad2/pasted-text.txt` |
| Attachment ID 2 | `a7fcbcc8-0c4f-4851-9005-a6b5746e7a00` |
| Attachment path 2 | `/Users/nick/.codex/attachments/a7fcbcc8-0c4f-4851-9005-a6b5746e7a00/pasted-text.txt` |
| Bytes per attachment | 19,229 |
| Identical-content fact | Yes: byte-identical attachments with the same SHA-256 hash. |
| User-provided Google Drive/Docs URL | `https://docs.google.com/document/d/1KXOKCrk4IWDMwo00U3u8d4SyVLMcg6SK/edit?usp=drive_link&ouid=117531652352386855286&rtpof=true&sd=true` |
| Initial Drive capture limitation | The pasted attachment names a broader Drive package but gives only `:chatgpt-content-reference{index="7"}` as its fallback. The URL above was supplied separately in the conversation; the broader package was grounded through that link. |

## Verified source hashes

SHA-256 was calculated over the original attachment bytes on 2026-08-10:

```text
a4029f776bc86c51b833251c219cf3ef097c9d098fd69ae251b423f88123258b  /Users/nick/.codex/attachments/6b5c0f14-c27a-4d46-9a23-c858fb877ad2/pasted-text.txt
a4029f776bc86c51b833251c219cf3ef097c9d098fd69ae251b423f88123258b  /Users/nick/.codex/attachments/a7fcbcc8-0c4f-4851-9005-a6b5746e7a00/pasted-text.txt
```

## Drive package files grounded after the initial snapshot

The user-provided document belongs to Drive folder `1aJZWKoubylfpio43ccezm6xfGnZoqbf2`. Read-only Drive inspection on 2026-08-10 grounded these exact sources:

| File | Drive ID | Drive bytes | Local disposition |
| --- | --- | ---: | --- |
| `02_Classification_Standard_Agent_Context_v1.3.md` | `1ePeXtOCcf1RdLrczsZirvtyP2_gEFTWS` | 112,336 | Stored verbatim in this directory; local SHA-256 `3c79d321774cd8908dd298a2309779a5cc8a89e570baf265f23c0b60871aedb3` |
| `03_German_Calibration_and_Matching_Workbook_v1.3.xlsx` | `1sFGhgpO0Jl-4aP92LspvzHCMfuBjp7Wy` | 81,435 | Stored verbatim in this directory from the authenticated raw Drive response; local SHA-256 `e516cb30b822890661fe4b0e00878b0986326111266fad2a8ce3c458ec0cbfc1` |
| `04_Lean_Explainable_Matching_Quick_Reference_v1.3.md` | `168I_HYDMYTEKrKjLg1dlusg9qDT2U0IA` | 3,701 | Stored verbatim in this directory; local SHA-256 `3399ed6a06a3ce7d23343e7ec99403355f650c3c8529b88be0888b4a4b5d37d6` |

The folder also contains the DOCX, PDF and ZIP duplicates listed by the supplied overview. They were intentionally not retained.

Reverify with:

```sh
shasum -a 256 \
  /Users/nick/.codex/attachments/6b5c0f14-c27a-4d46-9a23-c858fb877ad2/pasted-text.txt \
  /Users/nick/.codex/attachments/a7fcbcc8-0c4f-4851-9005-a6b5746e7a00/pasted-text.txt \
  docs/research/shampoo-inci/v1.3/03_German_Calibration_and_Matching_Workbook_v1.3.xlsx
```

## Package-content boundary

The pasted attachment itself does not contain the listed source files, but the separately supplied Google Docs URL allowed the parent package folder and exact Drive IDs to be grounded. This directory retains the two authoritative text sources and the verbatim calibration XLSX; duplicate DOCX/PDF/ZIP files remain omitted. The workbook was imported read-only and visually checked across all 17 sheets on 2026-08-10. `curated-research-authority.md` remains an explicitly labelled overview of the pasted material, not a replacement for the authoritative files above.
