import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { NotificationRules } from './NotificationRules';
import type { NotificationSetting } from '@/services/notificationApi';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
const rule: NotificationSetting = {
  id: 1, notification_type: 'expiration_warning', is_enabled: true, advance_days: 1,
  notification_channels: ['telegram'], repeat_notification: false, created_at: '', updated_at: '',
};

describe('notification card layout and controls', () => {
  test('overrides the headerless CardContent padding at both responsive sizes', () => {
    render(<NotificationRules settings={[rule]} onUpdate={vi.fn()} />);
    const content = screen.getByRole('heading').closest('[data-card]')?.firstElementChild;
    expect(content).toHaveClass('p-5', 'sm:p-6');
    expect(content).not.toHaveClass('pt-0', 'sm:pt-0');
  });
  test('keeps the enable switch and channel selection working', () => {
    const update = vi.fn();
    render(<NotificationRules settings={[rule]} onUpdate={update} />);
    fireEvent.click(screen.getByRole('switch', { name: 'types.expiration_warning' }));
    expect(update).toHaveBeenLastCalledWith({ ...rule, is_enabled: false });
    fireEvent.keyDown(screen.getByRole('button', { name: 'channels.email' }), { key: 'Enter' });
    expect(update).toHaveBeenLastCalledWith({ ...rule, notification_channels: ['telegram', 'email'] });
    expect(screen.getByText('channelsLabel: channels.telegram')).toBeInTheDocument();
  });
});
