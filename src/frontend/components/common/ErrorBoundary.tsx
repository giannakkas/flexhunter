import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, BlockStack, Text, Button } from '@shopify/polaris';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, maxWidth: 600, margin: '0 auto' }}>
          <Card>
            <BlockStack gap="400">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                <Text as="h1" variant="headingLg">Something went wrong</Text>
              </div>

              <Text as="p" variant="bodyMd" tone="subdued">
                An unexpected error occurred. This has been logged and we'll look into it.
              </Text>

              <div style={{ padding: 16, background: '#FEF2F2', borderRadius: 10, border: '1px solid #FECACA' }}>
                <Text as="p" variant="bodySm" fontWeight="bold">
                  {this.state.error?.message || 'Unknown error'}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>Technical details</summary>
                    <pre style={{ fontSize: 10, color: '#6B7280', overflow: 'auto', maxHeight: 200, marginTop: 4 }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <Button variant="primary" onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.hash = '';
                  window.location.reload();
                }}>
                  Reload Page
                </Button>
                <Button onClick={() => window.location.href = '/'}>
                  Go to Dashboard
                </Button>
              </div>
            </BlockStack>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
