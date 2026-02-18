# Data Model: Postman CMS to HTML Sync Automation

## Entity: CollectionSnapshot

- Description: Normalized representation of Postman collection API content at a specific revision.
- Fields:
- `sourceCommit` (string): git commit SHA used to build snapshot.
- `folders` (array<CategoryNode>): top-level and nested folder metadata.
- `endpoints` (array<EndpointNode>): normalized endpoint list.
- `generatedAt` (string, ISO8601).

## Entity: CategoryNode

- Description: Logical API grouping from collection folders.
- Fields:
- `id` (string): deterministic slug/path-based identifier.
- `name` (string).
- `parentId` (string|null).
- `order` (integer).

## Entity: EndpointNode

- Description: Canonical endpoint representation.
- Fields:
- `id` (string): `METHOD PATH` normalized identity.
- `name` (string): request display name.
- `method` (string).
- `path` (string).
- `queryParams` (array<ParamNode>).
- `bodySchemaKeys` (array<string>): top-level body keys when parseable.
- `description` (string).
- `examples` (array<ExampleNode>).
- `categoryId` (string).

## Entity: ParamNode

- Description: Request parameter metadata.
- Fields:
- `name` (string).
- `location` (enum: query, body, form, header).
- `required` (boolean|null).
- `sample` (string|null).

## Entity: ExampleNode

- Description: Saved request/response example summary.
- Fields:
- `title` (string).
- `statusCode` (integer|null).
- `requestSnippet` (string|null).
- `responseSnippet` (string|null).

## Entity: ChangeReport

- Description: Structured diff between baseline and current snapshots.
- Fields:
- `baseline` (SnapshotMeta).
- `current` (SnapshotMeta).
- `summary` (ChangeSummary).
- `categories` (CategoryDiff).
- `endpoints` (EndpointDiff).
- `htmlBlocksChanged` (array<string>).
- `releaseNoteEntry` (ReleaseNoteMeta|null).

## Entity: SnapshotMeta

- Fields:
- `commit` (string).
- `fileHash` (string).
- `collectionPath` (string).

## Entity: ChangeSummary

- Fields:
- `categoriesAdded` (integer).
- `categoriesRemoved` (integer).
- `categoriesChanged` (integer).
- `endpointsAdded` (integer).
- `endpointsRemoved` (integer).
- `endpointsChanged` (integer).

## Entity: ReleaseNoteMeta

- Fields:
- `version` (string).
- `date` (string).
- `title` (string).
- `status` (enum: changed, no-change).
