# Group report (DMS-114)

This folder holds the source of the group report for SE3070 Assignment 02. The report critiques the Group_026 design and presents our improvements for UC01–UC04.
It is written in Markdown, one file per chapter. Changes go through PRs like code. The final PDF is exported with pandoc (see [Building the PDF](#building-the-pdf)).

## Files and owners

| File | Content | Owner | Ticket |
|---|---|---|---|
| `00-front-page.md` | Group ID, campus, registration numbers, repo URL | Sayuni | DMS-118.1 |
| `01-introduction.md` | Case study, use cases covered, critique method | Anupa | DMS-114 |
| `02-system-critique.md` | Overall use case and class diagram critique | Anupa (input from all) | DMS-114 |
| `03-uc01-issue-hazard-warning.md` | UC01 chapter | Anupa | DMS-114.2 |
| `04-uc02-submit-verify-hazard-report.md` | UC02 chapter | Bineth | DMS-114.2 |
| `05-uc03-coordinate-shelter-resources.md` | UC03 chapter | Lahiru | DMS-114.2 |
| `06-uc04-post-event-analysis-report.md` | UC04 chapter | Sayuni | DMS-114.2 |
| `07-cross-uc-consistency.md` | Shared models, hazard-type alignment, UC04 inputs | Anupa | DMS-114.3 |
| `08-implemented-application.md` | Screenshots and flow descriptions | Sayuni | DMS-115 |
| `09-conclusion.md` | Short conclusion | Anupa | DMS-114 |
| `appendix-a-traceability.md` | Traceability matrices | Sayuni | DMS-116 |
| `appendix-b-deviation-log.md` | Design-deviation log | Sayuni | DMS-116.3 |
| `appendix-c-ai-prompts.md` | Every AI prompt, in order, with tool and date | Sayuni | DMS-118.3 |
| `figures/` | Every image the report uses | everyone | |

Edit only your own files. If you need a change in someone else's chapter, ask them or comment on their PR.

## Filling in a UC chapter

Each UC chapter (3–6) already contains the template. Most of it comes straight from your improved-UC PDF in `docs/Other/`:

| Chapter section | Take it from your UC PDF |
|---|---|
| N.3.1 Use case diagram | §2 |
| N.3.2 Use case scenario | §1 |
| N.3.3 Class diagram | §3 |
| N.3.4 Sequence diagrams | §4 |
| N.3.5 Wireframes | §5 |
| N.4 Change → justification | §6, plus the new **Fixes** column |

The new work is the critique in N.2:

1. **Strengths:** be specific, and cite the original ("Group_026, Fig. x / p. y").
2. **Functional weaknesses** (90% of the critique mark): requirement coverage, logical soundness and UML correctness. Give each weakness an ID `W<chapter>.<n>`, the evidence and a severity.
3. **Interaction-design weaknesses** (10%): usability, logical flow and HCI. Name the heuristic each one breaks. Cover at least three points.
4. **Link every change to the critique.** Every row of N.4 cites at least one W-ID, and every High weakness has a row. A change that fixes no weakness is either missing its weakness or should be dropped. The Specification rejects changes made "for the sake of changing".

## Style guide

| Item | Rule |
|---|---|
| Headings | Numbered by hand, as in the templates: `# 3 …`, `## 3.1 …`, `### 3.1.1 …`. Three levels at most. |
| Figures | `![Figure <chapter>.<n> — <caption>](figures/<file>.png)`. The caption goes below the figure. Number figures per chapter, and refer to each one in the text ("see Figure 3.2"). |
| Tables | Put the line `Table <chapter>.<n> — <caption>` **above** the table. |
| Diagrams | Export PNG at 2× or larger. Text must still be readable at page width. Use the same diagram tool and style for a given diagram type across all UCs. |
| Flow IDs | Write them exactly as in the UC PDFs: main step numbers, A1…An, E1…En. Outside your own chapter, prefix the UC: "UC01 A1". |
| Names | Write class, enum and status names in `monospace`, spelled exactly as in the class diagram (`HazardAlert`, `AlertStatus.ACTIVE`). |
| Citing the original | "Group_026, Fig. x / p. y". |
| Voice | Third person, present tense: "The improved design creates the draft when composing starts." |
| Length | Keep it reasonable (FAQ). Aim for about 8–12 pages per UC chapter, figures included. |
| Image file names | Design figures: `ucXX_<artefact>_<n>.png` (artefact = `usecase`, `class`, `sequence`, `wireframe`). Screenshots: `ucXX_<flow>_<state>.png` (DMS-115). System-wide figures: `sys_<name>_<n>.png`. |

## Building the PDF

You need [pandoc](https://pandoc.org/) and a PDF engine. On macOS: `brew install pandoc basictex`.

From the repo root:

```
cd docs/report
pandoc 0*.md appendix-*.md -o ../../report.pdf --toc --resource-path=. -V geometry:margin=2.5cm -V fontsize=11pt
```

Don't commit `report.pdf`. It goes into the submission, not the repo.
