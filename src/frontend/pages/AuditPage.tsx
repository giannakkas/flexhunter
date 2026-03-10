import React, { useEffect } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, IndexTable, EmptyState,
} from '@shopify/polaris';
import { useApi } from '../hooks/useApi';

const ACTION_COLORS: Record<string, any> = {
  PRODUCT_RECOMMENDED: 'info',
  PRODUCT_IMPORTED: 'success',
  PRODUCT_FLAGGED_WEAK: 'critical',
  REPLACEMENT_SUGGESTED: 'warning',
  REPLACEMENT_APPROVED: 'info',
  REPLACEMENT_EXECUTED: 'success',
  REPLACEMENT_REJECTED: 'subdued',
  PRODUCT_PINNED: 'attention',
  PRODUCT_UNPINNED: 'subdued',
  PRODUCT_ARCHIVED: 'subdued',
  SETTINGS_CHANGED: 'info',
  RESEARCH_COMPLETED: 'success',
  STORE_ANALYZED: 'info',
};

export function AuditPage() {
  const { data: logs, get, loading } = useApi<any[]>();

  useEffect(() => { get('/audit?limit=100'); }, [get]);

  const items = logs || [];

  const rowMarkup = items.map((item: any, index: number) => (
    <IndexTable.Row id={item.id} key={item.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={ACTION_COLORS[item.action] || 'info'}>
          {item.action.replace(/_/g, ' ')}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">{item.entityType || '—'}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">{item.explanation || '—'}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {item.details ? JSON.stringify(item.details).slice(0, 100) : '—'}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Audit Log" subtitle="Every decision, explained">
      {items.length === 0 && !loading ? (
        <Card>
          <EmptyState
            heading="No audit entries yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p">Actions like research, imports, and replacements will be logged here.</Text>
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <IndexTable
            resourceName={{ singular: 'log', plural: 'logs' }}
            itemCount={items.length}
            headings={[
              { title: 'Time' },
              { title: 'Action' },
              { title: 'Entity' },
              { title: 'Explanation' },
              { title: 'Details' },
            ]}
            selectable={false}
            loading={loading}
          >
            {rowMarkup}
          </IndexTable>
        </Card>
      )}
      <div style={{ height: 80 }} />
    </Page>
  );
}
