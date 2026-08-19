import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../components/ui/Modal';

describe('Modal', () => {
  it('does not render when closed', () => {
    render(<Modal isOpen={false} onClose={() => {}} title="Test dialog" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    render(<Modal isOpen onClose={() => {}} title="Test dialog" />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} title="Test dialog" />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal isOpen onClose={onClose} title="Test dialog" />);
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
