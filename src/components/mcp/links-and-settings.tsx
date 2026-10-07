import { getMcpShell } from '@/lib/queries/mcp';

import { Card } from '@/components/ui/card';
import { McpLinks } from '@/components/mcp/links';
import { McpSettingsForm } from '@/components/mcp/settings-form';

export async function McpLinksAndSettings() {
  const result = await getMcpShell();
  if (result.error || !result.data) {
    return (
      <Card className="space-y-2">
        <div className="text-sm text-error">Failed to load links and settings</div>
        <div className="text-xs text-muted">{result.error}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <McpLinks links={result.data.links} />
      </Card>
      <Card>
        <div className="mb-3 text-xs uppercase tracking-wider text-muted">
          Warning settings
        </div>
        <McpSettingsForm settings={result.data.settings} />
      </Card>
    </div>
  );
}
