import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../context/ToastContext';

function ToastTrigger({ message }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast({ type: 'success', message })}>
      Show toast
    </button>
  );
}

describe('Toast', () => {
  it('displays a message and dismisses it via the close button', async () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Saved successfully" />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Show toast' }));
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument();
  });
});
