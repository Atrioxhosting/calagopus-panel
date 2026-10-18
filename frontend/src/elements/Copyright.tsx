import classNames from 'classnames';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Anchor from '@/elements/typography/Anchor.tsx';

export default function Copyright({ className }: { className?: string }) {
  return (
    <div className={classNames('flex flex-col text-xs transition-all text-(--mantine-color-dimmed)', className)}>
      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.elements.copyright.prependedComponents}
        name='global-copyright-prepended'
      />

      <span className='flex flex-row gap-2'>
        <Anchor size='xs' href='https://atrioxhost.com/' target='_blank'>
          Atrioxhosting
        </Anchor>
        &copy; 2021 - 2026
      </span>

      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.elements.copyright.appendedComponents}
        name='global-copyright-appended'
      />
    </div>
  );
}
