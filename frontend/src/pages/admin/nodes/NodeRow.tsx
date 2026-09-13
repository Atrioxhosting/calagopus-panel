import { faHeart, faHeartBroken } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { forwardRef } from 'react';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { ContextMenuChildrenProps, ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { isNodeAIO, nodeDeploymentStateInfo } from '@/lib/domain/node.ts';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { AdminNode } from '@/lib/schemas/admin/nodes.ts';
import { useNodeDeployment } from '@/plugins/nodes/useNodeDeployment.ts';
import { useNodeVersion } from '@/plugins/nodes/useNodeVersion.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface NodeRowProps {
  node: AdminNode;
  desync?: number;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  contextMenuProps?: ContextMenuChildrenProps;
}

const NodeRow = forwardRef<HTMLTableRowElement, NodeRowProps>(function NodeRow(
  { node, desync, isSelected, onSelectionChange, contextMenuProps },
  ref,
) {
  const { t } = useTranslations();
  const { version, unavailable, loading, updateAvailable } = useNodeVersion(node);
  const { state: deploymentState, usage: deploymentUsage } = useNodeDeployment(node);

  return (
    <TableRow
      bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          onSelectionChange?.(true);
          return true;
        }
        return false;
      }}
      onContextMenu={(e) => {
        if (!contextMenuProps) return;

        e.preventDefault();
        contextMenuProps.openMenu(e.clientX, e.clientY);
      }}
      ref={ref}
    >
      {onSelectionChange !== undefined && (
        <TableData className='pl-4 relative cursor-pointer w-10 text-center'>
          <Checkbox
            id={node.uuid}
            checked={isSelected}
            onChange={(e) => onSelectionChange(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            classNames={{ input: 'cursor-pointer!' }}
          />
        </TableData>
      )}

      <TableData>
        {loading ? (
          <Spinner size={16} />
        ) : unavailable || !version ? (
          <Tooltip label={t('pages.admin.nodes.tabs.general.page.tooltip.errorWhileFetchingVersion', {})}>
            <FontAwesomeIcon icon={faHeartBroken} className='text-red-500' />
          </Tooltip>
        ) : updateAvailable ? (
          <Tooltip label={t('pages.admin.nodes.tabs.general.page.tooltip.updateAvailable', { version })}>
            <FontAwesomeIcon icon={faHeart} className='text-yellow-500 animate-pulse' />
          </Tooltip>
        ) : (
          <Tooltip label={version}>
            <FontAwesomeIcon icon={faHeart} className='text-green-500 animate-pulse' />
          </Tooltip>
        )}
      </TableData>

      <TableData>
        <TableLink to={`/admin/nodes/${node.uuid}`}>
          <Code>{node.uuid}</Code>
        </TableLink>
      </TableData>

      {desync !== undefined && <TableData>{desync}ms</TableData>}

      <TableData>
        <span className='flex gap-2 items-center'>
          {node.name}&nbsp;
          <Tooltip
            label={
              deploymentUsage ? (
                <>
                  <div>
                    {deploymentUsage.memory.limit === 0
                      ? t('common.node.deployment.memoryUsageUnlimited', {
                          used: bytesToString(mbToBytes(deploymentUsage.memory.used)),
                        })
                      : t('common.node.deployment.memoryUsage', {
                          used: bytesToString(mbToBytes(deploymentUsage.memory.used)),
                          limit: bytesToString(mbToBytes(deploymentUsage.memory.limit)),
                        })}
                  </div>
                  <div>
                    {deploymentUsage.disk.limit === 0
                      ? t('common.node.deployment.diskUsageUnlimited', {
                          used: bytesToString(mbToBytes(deploymentUsage.disk.used)),
                        })
                      : t('common.node.deployment.diskUsage', {
                          used: bytesToString(mbToBytes(deploymentUsage.disk.used)),
                          limit: bytesToString(mbToBytes(deploymentUsage.disk.limit)),
                        })}
                  </div>
                </>
              ) : (
                nodeDeploymentStateInfo[deploymentState].label()
              )
            }
          >
            <Badge color={nodeDeploymentStateInfo[deploymentState].badgeColor} variant='light'>
              {nodeDeploymentStateInfo[deploymentState].label()}
            </Badge>
          </Tooltip>
          {node.maintenanceEnabled && (
            <Badge color='red' variant='light'>
              {t('pages.admin.nodes.tabs.capacity.page.status.maintenanceEnabled', {})}
            </Badge>
          )}
          {isNodeAIO(node) && (
            <Tooltip label={t('pages.admin.nodes.tabs.general.page.tooltip.allInOneNode', {})}>
              <FontAwesomeIcon icon={faHeart} className='text-purple-500' />
            </Tooltip>
          )}
        </span>
      </TableData>

      <TableData>
        <TableLink to={`/admin/locations/${node.location.uuid}`} className='block w-fit'>
          <Code className='flex flex-row items-center w-fit'>
            {node.location.flag && (
              <img
                src={`/flags/${node.location.flag}.svg`}
                alt={node.location.name}
                className='w-5 h-5 mr-1 rounded-md shrink-0 my-auto'
              />
            )}{' '}
            {node.location.name}
          </Code>
        </TableLink>
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={node.created} />
      </TableData>

      {contextMenuProps && (
        <TableData className='relative cursor-pointer min-w-10 text-center'>
          <ContextMenuToggle items={contextMenuProps.items} openMenu={contextMenuProps.openMenu} />
        </TableData>
      )}
    </TableRow>
  );
});

export default NodeRow;
