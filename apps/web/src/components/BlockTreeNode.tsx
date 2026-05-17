import { ReactNode } from "react";
import { Badge, Collapse, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import type { BlockDefData, BlockTreeNode as TreeNode } from "@runbook/shared";

type Props = {
  nodes: TreeNode[];
  renderLeaf: (block: BlockDefData) => ReactNode;
  isExpanded: (path: string[]) => boolean;
  onToggle: (path: string[]) => void;
  depth?: number;
};

export function BlockTreeNodes({ nodes, renderLeaf, isExpanded, onToggle, depth = 0 }: Props) {
  return (
    <Stack gap="xs">
      {nodes.map((node, idx) => {
        if (node.type === "leaf") {
          return (
            <div
              key={`leaf-${node.block.kind}-${idx}`}
              style={{ paddingLeft: depth * 12 }}
            >
              {renderLeaf(node.block)}
            </div>
          );
        }
        const open = isExpanded(node.path);
        return (
          <div key={`group-${node.path.join("/")}`} style={{ paddingLeft: depth * 12 }}>
            <UnstyledButton
              onClick={() => onToggle(node.path)}
              aria-expanded={open}
              aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`}
              style={{ width: "100%" }}
            >
              <Group gap={6} py={4}>
                {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                <Text size="sm" fw={600}>
                  {node.label}
                </Text>
                <Badge size="xs" variant="light" color="gray">
                  {node.blockCount}
                </Badge>
              </Group>
            </UnstyledButton>
            <Collapse in={open}>
              <BlockTreeNodes
                nodes={node.children}
                renderLeaf={renderLeaf}
                isExpanded={isExpanded}
                onToggle={onToggle}
                depth={depth + 1}
              />
            </Collapse>
          </div>
        );
      })}
    </Stack>
  );
}
