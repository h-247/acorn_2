# UI component implementation map

## Primitives

`Button`, `Input`, `Select`, `Search`, `Tabs`, `MetadataTag`, `FilterChip`, `StatusBadge`, `Dialog`, `Drawer`, `Table`, `ProgressBar`, `Tooltip`.

## Patterns

- `AppShell`
- `EntityHeader`
- `SearchFilterBar`
- `MasterDetail`
- `StatusHeader`
- `DetailDrawer`
- `ValidationPanel`
- `EmptyState`
- `MetricCard`
- `ProgressTrend`
- `ProvenanceLineage`

## Domain features

### Materials
`MaterialRow`, `MaterialDetailPanel`, `MaterialMetadata`, `MaterialVariantCompare`, `MaterialProvenance`.

### Assessment
`QuestionRow`, `QuestionPreview`, `QuestionSkillMapping`, `AssessmentComposition`, `AssessmentSummary`, `AssignmentDrawer`.

### Evidence / learner state
`LearnerSkillCard`, `EvidenceRow`, `EvidenceDetail`, `SkillProgression`, `EvidenceCoverage`.

### Recommendation / AI
`RecommendationPanel`, `CandidateMaterial`, `TeacherDecisionBar`, `AICandidateReview`, `AIProvenance`.

## Semantic rule

Generic components accept semantic state, not arbitrary product colors. Example:

```tsx
<StatusBadge status="under-review" />
```

not:

```tsx
<Badge color="yellow" />
```
