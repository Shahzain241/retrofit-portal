import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ServiceCard } from '../pages/Services';

const service = {
  id: 'test-1',
  image: 'https://example.com/service.png',
  tag: 'PAS 2035',
  title: 'Retrofit Whole-House Assessment',
  description: 'A test description',
  duration: '5-7 Days',
  price: 450,
  category: 'Assessment',
  budget: 'under500',
};

describe('ServiceCard', () => {
  it('renders the title, price, and image from props', () => {
    render(
      <MemoryRouter>
        <ServiceCard service={service} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Retrofit Whole-House Assessment')).toBeInTheDocument();
    expect(screen.getByText('£450')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Retrofit Whole-House Assessment' })).toHaveAttribute(
      'src',
      'https://example.com/service.png',
    );
  });
});
