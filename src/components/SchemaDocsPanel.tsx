// src/components/SchemaDocsPanel.tsx
import { Accordion, Badge, Code, Group, Stack, Table, Text, Title } from "@mantine/core";

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <div>
        <Title order={4}>{title}</Title>
        {description && <Text size="sm" c="dimmed" mt={2}>{description}</Text>}
      </div>
      {children}
    </Stack>
  );
}

function FieldTable({ rows }: { rows: { field: string; type: string; required?: boolean; description: string }[] }) {
  return (
    <Table withTableBorder withColumnBorders fz="xs">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Field</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Description</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((r) => (
          <Table.Tr key={r.field}>
            <Table.Td>
              <Group gap={4} wrap="nowrap">
                <Code>{r.field}</Code>
                {r.required && <Badge size="xs" color="red" variant="light">required</Badge>}
              </Group>
            </Table.Td>
            <Table.Td><Code c="teal">{r.type}</Code></Table.Td>
            <Table.Td c="dimmed">{r.description}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function JsonExample({ code }: { code: string }) {
  return (
    <Code block style={{ fontSize: 12, maxHeight: 380, overflow: "auto" }}>
      {code.trim()}
    </Code>
  );
}

// ---------------------------------------------------------------------------
// Schema sections
// ---------------------------------------------------------------------------

const BLOCK_EXAMPLE = `
{
  "kind": "create-user",
  "label": "Create User",
  "auth": "jwt",
  "inputs": [
    { "name": "email",    "label": "Email",    "type": "string",   "required": true },
    { "name": "password", "label": "Password", "type": "password", "required": true },
    { "name": "role",     "label": "Role",     "type": "enum",     "enumValues": ["admin", "user"] }
  ],
  "outputs": [
    { "jsonPath": "$.data.id",    "contextKey": "userId" },
    { "jsonPath": "$.data.token", "contextKey": "authToken" }
  ],
  "request": {
    "method": "POST",
    "urlTemplate": "/api/users",
    "headers": {
      "Authorization": "Bearer {{authToken}}",
      "Content-Type": "application/json"
    },
    "query": {},
    "bodyTemplate": {
      "email": "{{email}}",
      "password": "{{password}}",
      "role": "{{role}}"
    }
  }
}
`;

const BUNDLE_EXAMPLE = `
{
  "id": "proj-abc123",
  "name": "My API",
  "description": "Optional project description",
  "createdAt": "2026-05-13T00:00:00Z",
  "versions": [
    {
      "version": "1.2.0",
      "releasedAt": "2026-05-13T00:00:00Z",
      "releaseNotes": "Added user management endpoints",
      "changes": [
        { "type": "added",   "target": "create-user", "summary": "New endpoint", "breaking": false },
        { "type": "removed", "target": "legacy-auth", "summary": "Removed",      "breaking": true }
      ],
      "blocks":       [ /* BlockDefData objects */ ],
      "scenarios":    [ /* Scenario objects */ ],
      "environments": [ /* Environment objects */ ],
      "docs": {
        "overview": "# Overview\\nMarkdown content here..."
      }
    }
  ]
}
`;

const ENV_EXAMPLE = `
{
  "id": "env-staging",
  "name": "Staging",
  "baseUrl": "https://staging.api.example.com",
  "auth": { "kind": "bearer", "token": "" },
  "headers": { "X-App-Version": "2" },
  "createdAt": "2026-05-13T00:00:00Z"
}
`;

const SCENARIO_EXAMPLE = `
{
  "id": "scen-abc",
  "name": "Register and login flow",
  "createdAt": "2026-05-13T00:00:00Z",
  "reusable": false,
  "blocks": [
    {
      "id": "block-1",
      "kind": "create-user",
      "overrides": {
        "email": "test@example.com",
        "role": "admin"
      }
    },
    {
      "id": "block-2",
      "kind": "login",
      "overrides": {}
    }
  ]
}
`;

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function SchemaDocsPanel() {
  return (
    <Stack gap="xl" maw={860}>
      <div>
        <Title order={3}>JSON Template Reference</Title>
        <Text size="sm" c="dimmed" mt={4}>
          All formats validated with Zod at import time. Fields marked <Badge size="xs" color="red" variant="light">required</Badge> must be present.
        </Text>
      </div>

      <Accordion variant="separated" multiple defaultValue={["block", "bundle"]}>

        {/* ── API Block ── */}
        <Accordion.Item value="block">
          <Accordion.Control>
            <Group gap="xs">
              <Text fw={600}>API Block</Text>
              <Badge size="xs" color="violet" variant="light">BlockDefData</Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Section title="Top-level fields">
                <FieldTable rows={[
                  { field: "kind",    type: "string",                        required: true,  description: "Unique identifier used to reference this block in scenarios" },
                  { field: "label",   type: "string",                        required: true,  description: "Human-readable display name shown in the UI" },
                  { field: "auth",    type: '"none" | "jwt" | "cookie-or-jwt"', required: true, description: "Auth mode; the runtime injects credentials automatically" },
                  { field: "inputs",  type: "FieldSpec[]",                   required: true,  description: "Fields shown to the user when configuring this block" },
                  { field: "outputs", type: "OutputSpec[]",                  required: true,  description: "JSON paths extracted from the response and saved to context" },
                  { field: "request", type: "RequestDef",                    required: true,  description: "HTTP request definition with template support" },
                ]} />
              </Section>

              <Section title="FieldSpec (inputs[])">
                <FieldTable rows={[
                  { field: "name",           type: "string",                                        required: true,  description: "Internal key; used in {{name}} tokens" },
                  { field: "label",          type: "string",                                        required: true,  description: "Label shown next to the input" },
                  { field: "type",           type: '"string" | "password" | "number" | "enum" | "json"', required: true, description: "Input control type" },
                  { field: "required",       type: "boolean",                                       required: false, description: "Whether the field must be filled before running" },
                  { field: "fromContextKey", type: "string",                                        required: false, description: "Auto-populates from this context key if present" },
                  { field: "enumValues",     type: "string[]",                                      required: false, description: 'Options for type "enum"' },
                  { field: "placeholder",    type: "string",                                        required: false, description: "Placeholder text shown in the input" },
                ]} />
              </Section>

              <Section title="OutputSpec (outputs[])">
                <FieldTable rows={[
                  { field: "jsonPath",    type: "string", required: true, description: 'JSONPath into the response, e.g. "$.data.id"' },
                  { field: "contextKey",  type: "string", required: true, description: "Key under which the extracted value is saved in the run context" },
                ]} />
              </Section>

              <Section title="RequestDef (request)">
                <FieldTable rows={[
                  { field: "method",       type: '"GET" | "POST" | "PUT" | "DELETE"', required: true,  description: "HTTP method" },
                  { field: "urlTemplate",  type: "string",                            required: true,  description: 'Path appended to baseUrl, supports {{tokens}}, e.g. "/users/{{userId}}"' },
                  { field: "headers",      type: "Record<string, string>",            required: false, description: "Static or templated request headers" },
                  { field: "query",        type: "Record<string, string>",            required: false, description: "Query parameters; undefined/empty values are omitted" },
                  { field: "bodyTemplate", type: "any JSON value",                   required: false, description: 'Request body with {{token}} support. Only sent for POST/PUT.' },
                ]} />
                <Text size="xs" c="dimmed">
                  <strong>Token rules:</strong> a whole-string token <Code>{"{{name}}"}</Code> substitutes the original value type (number stays number). An inline token inside a string <Code>{"/users/{{id}}/posts"}</Code> is string-interpolated.
                </Text>
              </Section>

              <Section title="Example">
                <JsonExample code={BLOCK_EXAMPLE} />
              </Section>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        {/* ── Project Bundle ── */}
        <Accordion.Item value="bundle">
          <Accordion.Control>
            <Group gap="xs">
              <Text fw={600}>Project Bundle</Text>
              <Badge size="xs" color="teal" variant="light">ProjectBundle</Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                The single JSON file a team imports. Contains all versions of blocks, scenarios, environments, and release notes.
              </Text>

              <Section title="ProjectBundle fields">
                <FieldTable rows={[
                  { field: "id",          type: "string",          required: true,  description: "Stable unique ID for the project" },
                  { field: "name",        type: "string",          required: true,  description: "Display name" },
                  { field: "description", type: "string",          required: false, description: "Optional short description" },
                  { field: "createdAt",   type: "ISO 8601 string", required: true,  description: "Creation timestamp" },
                  { field: "versions",    type: "Version[]",       required: true,  description: "Ordered list of versions, latest last" },
                ]} />
              </Section>

              <Section title="Version fields">
                <FieldTable rows={[
                  { field: "version",      type: "string",          required: true,  description: 'SemVer string, e.g. "1.2.0"' },
                  { field: "releasedAt",   type: "ISO 8601 string", required: true,  description: "Release date" },
                  { field: "releaseNotes", type: "string",          required: true,  description: "Markdown release notes shown in What's New" },
                  { field: "changes",      type: "ChangeEntry[]",   required: true,  description: "Structured changelog entries" },
                  { field: "blocks",       type: "BlockDefData[]",  required: true,  description: "All API block definitions for this version" },
                  { field: "scenarios",    type: "Scenario[]",      required: true,  description: "Pre-built scenario flows bundled with this version" },
                  { field: "environments", type: "Environment[]",   required: true,  description: "Default environment configs" },
                  { field: "docs",         type: "Record<string, string>", required: true, description: "Keyed markdown documents, e.g. { overview: '# ...' }" },
                ]} />
              </Section>

              <Section title="ChangeEntry fields">
                <FieldTable rows={[
                  { field: "type",     type: '"added" | "modified" | "deprecated" | "removed" | "fixed" | "note"', required: true,  description: "Category of change" },
                  { field: "target",   type: "string",  required: false, description: 'Block kind or feature name this change applies to' },
                  { field: "summary",  type: "string",  required: true,  description: "One-line description shown in the changelog" },
                  { field: "breaking", type: "boolean", required: false, description: "Whether this is a breaking change" },
                  { field: "removeBy", type: "string",  required: false, description: "Target version for removal of deprecated items" },
                ]} />
              </Section>

              <Section title="Example">
                <JsonExample code={BUNDLE_EXAMPLE} />
              </Section>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        {/* ── Environment ── */}
        <Accordion.Item value="environment">
          <Accordion.Control>
            <Group gap="xs">
              <Text fw={600}>Environment</Text>
              <Badge size="xs" color="blue" variant="light">Environment</Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Section title="Fields">
                <FieldTable rows={[
                  { field: "id",        type: "string",          required: true,  description: "Unique ID" },
                  { field: "name",      type: "string",          required: true,  description: "Display name, e.g. Staging, Production" },
                  { field: "baseUrl",   type: "URL string",      required: true,  description: "Base URL prepended to every urlTemplate" },
                  { field: "auth",      type: "AuthConfig",      required: true,  description: "Auth strategy applied to all requests" },
                  { field: "headers",   type: "Record<string, string>", required: true, description: "Headers added to every request in this environment" },
                  { field: "createdAt", type: "ISO 8601 string", required: true,  description: "Creation timestamp" },
                ]} />
              </Section>

              <Section title="AuthConfig variants">
                <FieldTable rows={[
                  { field: '{ kind: "bearer", token }',                          type: "—", description: "Adds Authorization: Bearer <token>" },
                  { field: '{ kind: "cookie", token? }',                         type: "—", description: "Cookie-based auth; token optional" },
                  { field: '{ kind: "apiKey", in, name, value }',                type: "—", description: 'Injects key into "header" or "query"' },
                  { field: '{ kind: "basic", username, password }',              type: "—", description: "HTTP Basic auth" },
                  { field: '{ kind: "none" }',                                   type: "—", description: "No auth injected" },
                ]} />
              </Section>

              <Section title="Example">
                <JsonExample code={ENV_EXAMPLE} />
              </Section>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        {/* ── Scenario ── */}
        <Accordion.Item value="scenario">
          <Accordion.Control>
            <Group gap="xs">
              <Text fw={600}>Scenario</Text>
              <Badge size="xs" color="amber" variant="light">Scenario</Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Section title="Fields">
                <FieldTable rows={[
                  { field: "id",        type: "string",          required: true,  description: "Unique ID" },
                  { field: "name",      type: "string",          required: true,  description: "Display name" },
                  { field: "createdAt", type: "ISO 8601 string", required: true,  description: "Creation timestamp" },
                  { field: "reusable",  type: "boolean",         required: false, description: "If true, this scenario can be referenced inside other flows as a sub-scenario block" },
                  { field: "blocks",    type: "BlockInstance[]", required: true,  description: "Ordered list of block usages" },
                  { field: "graphData", type: "GraphData",       required: false, description: "Graph layout data; present when the scenario has been opened in graph mode" },
                ]} />
              </Section>

              <Section title="BlockInstance fields">
                <FieldTable rows={[
                  { field: "id",        type: "string",                   required: true, description: "Unique ID within the scenario" },
                  { field: "kind",      type: "string",                   required: true, description: "References a block kind from the registry" },
                  { field: "overrides", type: "Record<string, unknown>",  required: true, description: "User-provided input values that override defaults at run time" },
                ]} />
              </Section>

              <Section title="Example">
                <JsonExample code={SCENARIO_EXAMPLE} />
              </Section>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

      </Accordion>
    </Stack>
  );
}
