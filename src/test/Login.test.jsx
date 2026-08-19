import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/auth/Login';
import { ProfileProvider } from '../context/ProfileContext';
import { ToastProvider } from '../context/ToastContext';

function renderLogin() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ProfileProvider>
          <Login />
        </ProfileProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('Login form validation', () => {
  it('shows an error for an invalid email after blur', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await userEvent.tab();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('enables the submit button for valid input', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email address/i), 'john@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret123');
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
  });
});
