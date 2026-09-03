import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import {
  TopbarAvatar,
  isImageSource,
  getAvatarInitials,
} from '../components/Topbar';

describe('TopbarAvatar — no leaked text, clean fallback', () => {
  it('renders the image when a valid avatar URL is set', () => {
    render(<TopbarAvatar avatar="https://example.com/me.png" name="Jane Doe" className="w-11 h-11" />);
    const img = screen.getByAltText('User avatar');
    expect(img).toHaveAttribute('src', 'https://example.com/me.png');
    expect(screen.queryByText('JD')).not.toBeInTheDocument();
  });

  it('renders fallback initials (not the raw avatar string) when avatar is missing', () => {
    render(<TopbarAvatar avatar={null} name="Jane Doe" className="w-11 h-11" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.queryByAltText('User avatar')).not.toBeInTheDocument();
  });

  it('never renders a garbage/error/notification string as avatar text', () => {
    const leaked = 'Invitation sent, but the password-set email could not be delivered.';
    render(<TopbarAvatar avatar={leaked} name="Jane Doe" className="w-11 h-11" />);
    // The raw string must never appear in the DOM.
    expect(screen.queryByText(leaked)).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be deli/i)).not.toBeInTheDocument();
    // Clean fallback initials are shown instead.
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.queryByAltText('User avatar')).not.toBeInTheDocument();
  });

  it('swaps to initials when the image fails to load (no broken/alt text shown)', () => {
    render(<TopbarAvatar avatar="https://example.com/broken.png" name="Jane Doe" className="w-11 h-11" />);
    const img = screen.getByAltText('User avatar');
    fireEvent.error(img);
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.queryByAltText('User avatar')).not.toBeInTheDocument();
  });

  it('isImageSource only accepts http(s) URLs and data-image URIs', () => {
    expect(isImageSource('https://x/y.png')).toBe(true);
    expect(isImageSource('data:image/png;base64,AAAA')).toBe(true);
    expect(isImageSource('Invitation sent, but the email could not be delivered.')).toBe(false);
    expect(isImageSource('')).toBe(false);
    expect(isImageSource(null)).toBe(false);
    expect(isImageSource(undefined)).toBe(false);
  });

  it('getAvatarInitials derives initials from a display name', () => {
    expect(getAvatarInitials('Jane Doe')).toBe('JD');
    expect(getAvatarInitials('John')).toBe('JO');
    expect(getAvatarInitials('')).toBe('?');
    expect(getAvatarInitials(null)).toBe('?');
  });
});