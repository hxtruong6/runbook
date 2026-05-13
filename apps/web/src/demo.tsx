import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./index.css";

import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import {
  MantineProvider,
  AppShell,
  Group,
  Stack,
  Paper,
  Title,
  Text,
  Button,
  TextInput,
  Textarea,
  Select,
  Badge,
  Divider,
  SimpleGrid,
  ActionIcon,
  Avatar,
  Card,
  Switch,
  Tabs,
  ThemeIcon,
  Box,
  Container,
  Progress,
  Skeleton,
  Alert,
  Table,
  Tooltip,
  rem,
  useMantineTheme,
  useMantineColorScheme,
  ColorSchemeScript,
} from "@mantine/core";
import { Notifications, notifications } from "@mantine/notifications";
import {
  IconSettings,
  IconBell,
  IconCheck,
  IconAlertTriangle,
  IconSun,
  IconMoon,
  IconHome,
  IconUsers,
  IconChartBar,
  IconCurrencyDollar,
  IconInbox,
  IconRefresh,
  IconPlus,
  IconTrash,
  IconEdit,
  IconChevronRight,
  IconDeviceMobile,
  IconDeviceDesktop,
} from "@tabler/icons-react";
import { theme, chartPalette, motion } from "./theme";

/* ============================================================
 * Reusable bits
 * ============================================================ */

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <Stack gap="md">
    <Stack gap={4}>
      <Title order={3}>{title}</Title>
      {description && (
        <Text c="dimmed" size="sm">
          {description}
        </Text>
      )}
    </Stack>
    {children}
  </Stack>
);

const Swatch = ({
  color,
  label,
  sub,
}: {
  color: string;
  label: string;
  sub?: string;
}) => (
  <Stack gap={6} align="center">
    <Box
      style={{
        width: rem(64),
        height: rem(64),
        borderRadius: rem(14),
        background: color,
        boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.06)",
      }}
    />
    <Stack gap={0} align="center">
      <Text size="xs" fw={600}>
        {label}
      </Text>
      {sub && (
        <Text size="xs" c="dimmed">
          {sub}
        </Text>
      )}
    </Stack>
  </Stack>
);

const Ring = ({
  value,
  color,
  size = 52,
  label,
}: {
  value: number;
  color: string;
  size?: number;
  label?: string;
}) => {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <Box
      pos="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} percent`}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(127,127,127,0.18)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label && (
        <Box
          pos="absolute"
          inset={0}
          style={{ display: "grid", placeItems: "center" }}
        >
          <Text size="xs" fw={600}>
            {label}
          </Text>
        </Box>
      )}
    </Box>
  );
};

/* ============================================================
 * Theme toggle
 * ============================================================ */
function ThemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";
  return (
    <Tooltip label={dark ? "Switch to light" : "Switch to dark"}>
      <ActionIcon
        onClick={() => setColorScheme(dark ? "light" : "dark")}
        aria-label="Toggle color scheme"
      >
        {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

/* ============================================================
 * State demos: Loading / Empty / Error
 * ============================================================ */
function StateDemos() {
  const [state, setState] = useState<"loading" | "empty" | "error" | "data">(
    "loading"
  );

  return (
    <Stack gap="md">
      <Group>
        {(["loading", "empty", "error", "data"] as const).map((s) => (
          <Button
            key={s}
            size="xs"
            variant={state === s ? "filled" : "default"}
            onClick={() => setState(s)}
          >
            {s}
          </Button>
        ))}
      </Group>
      <Card mih={220}>
        {state === "loading" && (
          <Stack gap="sm">
            <Skeleton h={20} w="40%" />
            <Skeleton h={14} />
            <Skeleton h={14} w="80%" />
            <Skeleton h={14} w="60%" />
          </Stack>
        )}
        {state === "empty" && (
          <Stack align="center" gap="xs" py="xl">
            <ThemeIcon size={56} radius="xl" variant="light" color="gray">
              <IconInbox size={28} />
            </ThemeIcon>
            <Title order={4}>Nothing here yet</Title>
            <Text size="sm" c="dimmed" ta="center" maw={320}>
              When activity arrives, it will show up here. Try creating your
              first record.
            </Text>
            <Button leftSection={<IconPlus size={16} />} mt="xs">
              Create record
            </Button>
          </Stack>
        )}
        {state === "error" && (
          <Alert
            icon={<IconAlertTriangle size={18} />}
            color="red"
            title="Couldn't load data"
            variant="light"
          >
            <Text size="sm" mb="sm">
              The server returned a 503. This is usually temporary.
            </Text>
            <Button
              size="xs"
              color="red"
              variant="light"
              leftSection={<IconRefresh size={14} />}
            >
              Retry
            </Button>
          </Alert>
        )}
        {state === "data" && (
          <Stack gap="xs">
            <Text fw={600}>3 items loaded</Text>
            <Text size="sm" c="dimmed">
              Real content would render here.
            </Text>
          </Stack>
        )}
      </Card>
    </Stack>
  );
}

/* ============================================================
 * Demo page
 * ============================================================ */
function Demo() {
  const t = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";

  const surface = dark ? t.colors.dark[7] : t.colors.warmGray[1];
  const headerBg = dark ? t.colors.dark[8] : t.white;
  const borderColor = dark
    ? t.other.borderColorDark
    : t.other.borderColor;

  const [loading, setLoading] = useState(false);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <AppShell
        header={{ height: 64 }}
        padding="lg"
        styles={{
          main: { background: surface },
          header: { background: headerBg, borderBottom: `1px solid ${borderColor}` },
        }}
      >
        <AppShell.Header>
          <Group h="100%" px="lg" justify="space-between">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" color="violet">
                <Text fw={700} c="white" size="sm">
                  32
                </Text>
              </ThemeIcon>
              <Stack gap={0}>
                <Text fw={600} size="sm">
                  Paper UI System
                </Text>
                <Text size="xs" c="dimmed">
                  Violet · Teal · Amber · Warm neutral
                </Text>
              </Stack>
            </Group>
            <Group gap="xs">
              <Badge color="violet">v1.0</Badge>
              <ThemeToggle />
              <ActionIcon aria-label="Settings">
                <IconSettings size={18} />
              </ActionIcon>
              <Avatar radius="xl" color="violet">
                U
              </Avatar>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Main id="main">
          <Container size="lg">
            <Stack gap="xl">
              {/* Hero */}
              <Paper
                radius="xl"
                p="xl"
                shadow="md"
                withBorder={false}
                style={{
                  background: dark
                    ? `linear-gradient(135deg, ${t.colors.violet[9]} 0%, ${t.colors.dark[7]} 60%)`
                    : `linear-gradient(135deg, ${t.colors.violet[0]} 0%, ${t.white} 60%)`,
                }}
              >
                <Stack gap="sm">
                  <Badge color="violet" w="fit-content">
                    Design system v1
                  </Badge>
                  <Title order={1}>One system, every surface.</Title>
                  <Text c="dimmed" maw={580}>
                    Light + dark, accessible by default, with documented states,
                    motion, spacing, and chart colors. Defined once in{" "}
                    <code>theme.ts</code> — everything else just renders.
                  </Text>
                  <Group mt="sm">
                    <Button
                      onClick={() =>
                        notifications.show({
                          title: "Saved",
                          message: "Tokens applied across the app.",
                          color: "violet",
                        })
                      }
                    >
                      Primary
                    </Button>
                    <Button variant="light">Secondary</Button>
                    <Button variant="default">Tertiary</Button>
                    <Button variant="subtle">Cancel</Button>
                  </Group>
                </Stack>
              </Paper>

              {/* Color */}
              <Section
                title="Color"
                description="One primary, one secondary, one accent. Semantic colors only for status."
              >
                <Paper>
                  <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="lg">
                    <Swatch
                      color={t.colors.violet[7]}
                      label="Primary"
                      sub="violet 7"
                    />
                    <Swatch
                      color={t.colors.teal[7]}
                      label="Secondary"
                      sub="teal 7"
                    />
                    <Swatch
                      color={t.colors.amber[7]}
                      label="Accent"
                      sub="amber 7"
                    />
                    <Swatch color="#2F9E44" label="Success" sub="green 8" />
                    <Swatch color="#E03131" label="Danger" sub="red 8" />
                    <Swatch color="#1C7ED6" label="Info" sub="blue 7" />
                  </SimpleGrid>
                </Paper>
              </Section>

              {/* Categorical chart palette */}
              <Section
                title="Chart palette"
                description="Eight categorical colors, ordered for accessibility (high-contrast neighbors)."
              >
                <Paper>
                  <Group gap="md" wrap="wrap">
                    {chartPalette.map((c, i) => (
                      <Stack key={c} gap={4} align="center">
                        <Box
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 10,
                            background: c,
                          }}
                        />
                        <Text size="xs" c="dimmed">
                          chart {i + 1}
                        </Text>
                      </Stack>
                    ))}
                  </Group>
                </Paper>
              </Section>

              {/* Buttons + states */}
              <Section
                title="Buttons & states"
                description="Strict 4-level hierarchy. Each level has hover, focus-visible, disabled, and loading."
              >
                <Paper>
                  <Stack gap="lg">
                    <Group>
                      <Button>Filled</Button>
                      <Button variant="light">Light</Button>
                      <Button variant="default">Default</Button>
                      <Button variant="subtle">Subtle</Button>
                      <Button variant="outline">Outline</Button>
                    </Group>
                    <Group>
                      <Button size="xs">xs</Button>
                      <Button size="sm">sm</Button>
                      <Button size="md">md</Button>
                      <Button size="lg">lg</Button>
                    </Group>
                    <Group>
                      <Button color="teal">Secondary</Button>
                      <Button color="amber">Accent</Button>
                      <Button color="red" variant="light">
                        Destructive
                      </Button>
                      <Button disabled>Disabled</Button>
                      <Button
                        loading={loading}
                        onClick={() => {
                          setLoading(true);
                          setTimeout(() => setLoading(false), 1200);
                        }}
                      >
                        {loading ? "Saving" : "Trigger loading"}
                      </Button>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Tab through the buttons — focus rings come from{" "}
                      <code>:focus-visible</code> and respect keyboard-only
                      users.
                    </Text>
                  </Stack>
                </Paper>
              </Section>

              {/* Icons */}
              <Section
                title="Icons"
                description="Tabler Icons — consistent 1.5px stroke. Scale: 14 / 16 / 18 / 20 / 24."
              >
                <Paper>
                  <Group gap="xl" wrap="wrap">
                    {[
                      { Icon: IconHome, label: "home" },
                      { Icon: IconUsers, label: "users" },
                      { Icon: IconChartBar, label: "chart" },
                      { Icon: IconCurrencyDollar, label: "money" },
                      { Icon: IconBell, label: "bell" },
                      { Icon: IconCheck, label: "check" },
                      { Icon: IconEdit, label: "edit" },
                      { Icon: IconTrash, label: "trash" },
                    ].map(({ Icon, label }) => (
                      <Stack key={label} gap={4} align="center">
                        <ThemeIcon
                          variant="light"
                          color="violet"
                          size="lg"
                          radius="md"
                        >
                          <Icon size={18} />
                        </ThemeIcon>
                        <Text size="xs" c="dimmed">
                          {label}
                        </Text>
                      </Stack>
                    ))}
                  </Group>
                </Paper>
              </Section>

              {/* Spacing scale */}
              <Section
                title="Spacing"
                description="4px base grid. xs 8 · sm 12 · md 16 · lg 24 · xl 32. Use these tokens, never magic numbers."
              >
                <Paper>
                  <Stack gap="md">
                    {(["xs", "sm", "md", "lg", "xl"] as const).map((s) => (
                      <Group key={s} gap="sm" align="center">
                        <Text
                          size="xs"
                          fw={600}
                          w={32}
                          c="dimmed"
                          tt="uppercase"
                        >
                          {s}
                        </Text>
                        <Box
                          h={16}
                          style={{
                            width: { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 }[
                              s
                            ],
                            background: t.colors.violet[5],
                            borderRadius: 4,
                          }}
                        />
                        <Text size="xs" c="dimmed">
                          {{ xs: 8, sm: 12, md: 16, lg: 24, xl: 32 }[s]}px
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              </Section>

              {/* Radius */}
              <Section
                title="Radius"
                description="sm 6 · md 10 · lg 14 · xl 20. Inputs and buttons share md so they rhyme."
              >
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                  {(["sm", "md", "lg", "xl"] as const).map((r) => (
                    <Paper key={r} radius={r}>
                      <Stack gap={4}>
                        <Text fw={600}>radius="{r}"</Text>
                        <Text size="xs" c="dimmed">
                          {{ sm: 6, md: 10, lg: 14, xl: 20 }[r]}px
                        </Text>
                      </Stack>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Section>

              {/* Elevation */}
              <Section
                title="Elevation"
                description="Hierarchy via shadow depth, never via heavier borders."
              >
                <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="md">
                  {(["xs", "sm", "md", "lg", "xl"] as const).map((s) => (
                    <Paper key={s} shadow={s} withBorder={false}>
                      <Text fw={600} size="sm">
                        shadow="{s}"
                      </Text>
                      <Text size="xs" c="dimmed">
                        Soft, two-layer.
                      </Text>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Section>

              {/* Motion */}
              <Section
                title="Motion"
                description="Three durations. Two easings. Reduced-motion respected globally."
              >
                <Paper>
                  <Stack gap="md">
                    <Group gap="xl">
                      {(["fast", "base", "slow"] as const).map((d) => (
                        <Stack key={d} gap={4}>
                          <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                            {d}
                          </Text>
                          <Text fw={600}>{motion.duration[d]}ms</Text>
                        </Stack>
                      ))}
                    </Group>
                    <Divider />
                    <Group gap="xl">
                      {(
                        ["standard", "emphasized"] as const
                      ).map((e) => (
                        <Stack key={e} gap={4}>
                          <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                            {e}
                          </Text>
                          <Text size="xs" ff="monospace">
                            {motion.easing[e]}
                          </Text>
                        </Stack>
                      ))}
                    </Group>
                  </Stack>
                </Paper>
              </Section>

              {/* States: loading / empty / error */}
              <Section
                title="States: loading · empty · error · data"
                description="Every data surface needs all four. Toggle to preview."
              >
                <StateDemos />
              </Section>

              {/* Cards */}
              <Section
                title="Data cards"
                description="Composed from primitives — no one-off styles."
              >
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  <Card>
                    <Group justify="space-between" align="flex-start">
                      <Stack gap="xs">
                        <Badge color="teal">Live</Badge>
                        <Text size="sm" c="dimmed">
                          Active sessions
                        </Text>
                        <Title order={2}>1,284</Title>
                        <Text size="xs" c="dimmed">
                          +12.4% vs last week
                        </Text>
                      </Stack>
                      <Ring value={68} color={t.colors.violet[7]} label="68%" />
                    </Group>
                  </Card>
                  <Card>
                    <Stack gap="xs">
                      <Badge color="violet">Settings</Badge>
                      <Text fw={600}>Quick actions</Text>
                      <Switch label="Auto-refresh" defaultChecked />
                      <Switch label="Compact mode" />
                      <Switch label="Show beta features" />
                    </Stack>
                  </Card>
                  <Card>
                    <Stack gap="xs">
                      <Badge color="amber">Status</Badge>
                      <Text fw={600}>Latest run</Text>
                      <Group gap={6}>
                        <ThemeIcon
                          size="sm"
                          color="teal"
                          variant="light"
                          radius="xl"
                        >
                          <IconCheck size={12} />
                        </ThemeIcon>
                        <Text size="sm">scenario_42 passed</Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        3 min ago · 1.2s
                      </Text>
                      <Stack gap={6} mt="xs">
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                            Coverage
                          </Text>
                          <Text size="xs" c="dimmed">
                            82%
                          </Text>
                        </Group>
                        <Progress value={82} color="violet" radius="xl" />
                      </Stack>
                    </Stack>
                  </Card>
                </SimpleGrid>
              </Section>

              {/* Table */}
              <Section
                title="Table"
                description="Sortable header, hover highlight, row actions, status badges."
              >
                <Paper p={0}>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Role</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Last active</Table.Th>
                        <Table.Th w={60} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {[
                        {
                          name: "Jane Cooper",
                          role: "Admin",
                          status: "Active",
                          color: "teal",
                          last: "2 min ago",
                        },
                        {
                          name: "Marcus Lin",
                          role: "Editor",
                          status: "Pending",
                          color: "amber",
                          last: "1 hour ago",
                        },
                        {
                          name: "Aisha Rahman",
                          role: "Viewer",
                          status: "Disabled",
                          color: "gray",
                          last: "3 days ago",
                        },
                      ].map((r) => (
                        <Table.Tr key={r.name}>
                          <Table.Td>
                            <Group gap="sm">
                              <Avatar size="sm" color="violet" radius="xl">
                                {r.name[0]}
                              </Avatar>
                              <Text size="sm" fw={500}>
                                {r.name}
                              </Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{r.role}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={r.color} variant="light">
                              {r.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {r.last}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <ActionIcon aria-label={`More actions for ${r.name}`}>
                              <IconChevronRight size={16} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Section>

              {/* Form */}
              <Section
                title="Forms"
                description="Inputs share radius and border with buttons. Required fields marked. Errors inline."
              >
                <Paper>
                  <Tabs defaultValue="profile">
                    <Tabs.List>
                      <Tabs.Tab
                        value="profile"
                        leftSection={<IconUsers size={14} />}
                      >
                        Profile
                      </Tabs.Tab>
                      <Tabs.Tab
                        value="notifications"
                        leftSection={<IconBell size={14} />}
                      >
                        Notifications
                      </Tabs.Tab>
                      <Tabs.Tab
                        value="advanced"
                        leftSection={<IconSettings size={14} />}
                      >
                        Advanced
                      </Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="profile" pt="lg">
                      <Stack gap="md" maw={520}>
                        <TextInput
                          label="Display name"
                          required
                          defaultValue="Jane Cooper"
                        />
                        <TextInput
                          label="Email"
                          required
                          placeholder="you@company.com"
                          error="Enter a valid email address"
                        />
                        <Select
                          label="Role"
                          data={["Admin", "Editor", "Viewer"]}
                          defaultValue="Admin"
                        />
                        <Textarea
                          label="Bio"
                          placeholder="A short description"
                          minRows={3}
                          autosize
                        />
                        <Switch label="Email me a weekly digest" defaultChecked />
                        <Divider my="xs" />
                        <Group justify="flex-end">
                          <Button variant="subtle">Cancel</Button>
                          <Button>Save changes</Button>
                        </Group>
                      </Stack>
                    </Tabs.Panel>
                    <Tabs.Panel value="notifications" pt="lg">
                      <Text c="dimmed" size="sm">
                        Notification preferences would live here.
                      </Text>
                    </Tabs.Panel>
                    <Tabs.Panel value="advanced" pt="lg">
                      <Text c="dimmed" size="sm">
                        Advanced settings would live here.
                      </Text>
                    </Tabs.Panel>
                  </Tabs>
                </Paper>
              </Section>

              {/* Mobile preview */}
              <Section
                title="Responsive"
                description="375px (mobile) preview. Touch targets ≥ 44px (WCAG 2.5.5)."
              >
                <Group align="flex-start" gap="lg" wrap="wrap">
                  <Box
                    style={{
                      width: 375,
                      height: 560,
                      border: `1px solid ${borderColor}`,
                      borderRadius: 28,
                      overflow: "hidden",
                      background: dark ? t.colors.dark[7] : t.colors.warmGray[1],
                      boxShadow: t.shadows.lg,
                    }}
                  >
                    <Stack p="md" gap="md">
                      <Group justify="space-between">
                        <Group gap={6}>
                          <IconDeviceMobile size={16} />
                          <Text size="xs" c="dimmed">
                            375 × 560
                          </Text>
                        </Group>
                        <ThemeIcon size="lg" radius="md">
                          <IconHome size={16} />
                        </ThemeIcon>
                      </Group>
                      <Card>
                        <Stack gap="xs">
                          <Text size="xs" c="dimmed">
                            Today
                          </Text>
                          <Title order={3}>$19,350</Title>
                          <Progress value={68} color="violet" radius="xl" />
                        </Stack>
                      </Card>
                      <Button fullWidth size="md">
                        Primary action
                      </Button>
                      <Button fullWidth size="md" variant="default">
                        Secondary
                      </Button>
                    </Stack>
                  </Box>
                  <Stack gap="xs" maw={300}>
                    <Group gap={6}>
                      <IconDeviceDesktop size={16} />
                      <Text size="sm" fw={600}>
                        Density rule
                      </Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                      Buttons jump from <code>sm</code> on desktop to{" "}
                      <code>md</code> on mobile so every tap hits the 44px
                      target. Card padding stays the same — content reflows,
                      not the chrome.
                    </Text>
                  </Stack>
                </Group>
              </Section>

              {/* Accessibility */}
              <Section
                title="Accessibility"
                description="Built in, not bolted on."
              >
                <Paper>
                  <Stack gap="xs">
                    {[
                      "Skip-link at top of page (Tab once to reveal)",
                      "Visible focus rings via :focus-visible (WCAG 2.4.7)",
                      "prefers-reduced-motion respected globally (WCAG 2.3.3)",
                      "Status carries text + icon, never color alone (WCAG 1.4.1)",
                      "All interactive elements have aria-labels",
                      "Touch targets ≥ 44px on mobile sizes (WCAG 2.5.5)",
                      "Form errors announced inline, tied to inputs",
                    ].map((item) => (
                      <Group key={item} gap="sm" align="flex-start">
                        <ThemeIcon
                          size="sm"
                          color="teal"
                          variant="light"
                          radius="xl"
                        >
                          <IconCheck size={12} />
                        </ThemeIcon>
                        <Text size="sm">{item}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              </Section>

              <Text ta="center" size="xs" c="dimmed" pb="xl">
                All tokens defined in <code>src/theme.ts</code> · Press Tab to
                see focus order
              </Text>
            </Stack>
          </Container>
        </AppShell.Main>
      </AppShell>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ColorSchemeScript defaultColorScheme="light" />
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications />
      <Demo />
    </MantineProvider>
  </React.StrictMode>
);
